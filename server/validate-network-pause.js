import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = resolve(projectRoot, "artifacts", "network");
const HTTP_PORT = 8190;
const WS_PORT = 8197;
const ROOM_ID = "validate-network-pause";
const GAME_URL = `http://127.0.0.1:${HTTP_PORT}`;

const children = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasCommand(cmd, args = ["--version"]) {
  const res = spawnSync(cmd, args, { stdio: "ignore" });
  return res.status === 0;
}

function choosePythonCommand() {
  if (hasCommand("python3")) return { cmd: "python3", args: ["-m", "http.server"] };
  if (hasCommand("python")) return { cmd: "python", args: ["-m", "http.server"] };
  if (hasCommand("py", ["-3", "--version"])) return { cmd: "py", args: ["-3", "-m", "http.server"] };
  throw new Error("Python not found. Install Python or add it to PATH.");
}

function startChild(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: "pipe",
    shell: false
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

function ensurePortAvailable(port, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err?.code === "EADDRINUSE") {
        rejectPromise(new Error(`${label} port ${port} is already in use.`));
        return;
      }
      rejectPromise(err);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close((closeErr) => {
        if (closeErr) rejectPromise(closeErr);
        else resolvePromise();
      });
    });
  });
}

async function waitForHttpReady(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Timed out waiting for HTTP server at ${url}`);
}

async function waitForTcpReady(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await new Promise((resolvePromise) => {
      const socket = net.connect({ port, host: "127.0.0.1" }, () => {
        socket.destroy();
        resolvePromise(true);
      });
      socket.on("error", () => resolvePromise(false));
    });
    if (ready) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for TCP port ${port}`);
}

function rectCenter(rect) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2
  };
}

async function clickCanvasRect(page, rect) {
  const point = rectCenter(rect);
  await page.mouse.click(point.x, point.y);
}

async function getDebugState(page) {
  return page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
}

async function openLobby(page, { wsUrl, roomId, playerName, classType }) {
  await page.goto(GAME_URL, { waitUntil: "networkidle" });
  await page.keyboard.press("Space");
  await page.locator("#mode-select").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#menu-network").click();
  await page.locator("#network-setup-screen").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#net-server-url").fill(wsUrl);
  await page.locator("#net-room-id").fill(roomId);
  await page.locator("#net-player-name-setup").fill(playerName);
  await page.locator("#network-setup-next").click();
  await page.locator("#network-lobby-screen").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(`[data-lobby-class-option="${classType}"]`).click();
}

async function setReady(page) {
  await page.locator("#network-lobby-toggle-ready").click();
}

async function waitForRole(page, expectedRole, timeoutMs = 25000) {
  await page.waitForFunction((role) => {
    const state = window.__WOTC_DEBUG__?.getState?.();
    return !!state && state.networkReady === true && state.networkRole === role && !!state.ui?.shopButton;
  }, expectedRole, { timeout: timeoutMs });
  return getDebugState(page);
}

async function captureFailure(pages, error, details) {
  mkdirSync(artifactsDir, { recursive: true });
  const statePath = resolve(artifactsDir, "validate-network-pause-failure.json");
  const screenshots = [];
  for (const entry of pages) {
    const screenshotPath = resolve(artifactsDir, `validate-network-pause-${entry.label}-failure.png`);
    screenshots.push(screenshotPath);
    try {
      await entry.page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {}
  }
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        details,
        screenshots
      },
      null,
      2
    )
  );
  return { statePath, screenshots };
}

async function main() {
  await ensurePortAvailable(HTTP_PORT, "HTTP");
  await ensurePortAvailable(WS_PORT, "WS");

  const python = choosePythonCommand();
  startChild("http", python.cmd, [...python.args, String(HTTP_PORT)]);
  startChild("ws", process.execPath, ["server/networkServer.js"], { PORT: String(WS_PORT) });

  await waitForHttpReady(GAME_URL);
  await waitForTcpReady(WS_PORT);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ownerPage = await context.newPage();
  const otherPage = await context.newPage();

  let ownerState = null;
  let otherState = null;
  try {
    const wsUrl = `ws://127.0.0.1:${WS_PORT}`;
    await openLobby(ownerPage, {
      wsUrl,
      roomId: ROOM_ID,
      playerName: "PauseOwner",
      classType: "warrior"
    });
    await openLobby(otherPage, {
      wsUrl,
      roomId: ROOM_ID,
      playerName: "PausePeer",
      classType: "archer"
    });

    await setReady(ownerPage);
    await setReady(otherPage);

    ownerState = await waitForRole(ownerPage, "Active", 12000);
    otherState = await waitForRole(otherPage, "Active", 12000);

    assert(ownerState?.ui?.shopButton, "pause owner shop button unavailable");
    await ownerPage.keyboard.press("b");

    await ownerPage.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.ui?.paused === true && state.ui?.shopOpen === true;
    }, { timeout: 5000 });
    await otherPage.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.ui?.paused === true;
    }, { timeout: 5000 });

    ownerState = await getDebugState(ownerPage);
    otherState = await getDebugState(otherPage);

    assert(ownerState?.ui?.shopOpen === true, "pause owner shop did not open");
    assert(otherState?.ui?.shopOpen === false, "non-owner unexpectedly opened the shop");
    assert(otherState?.ui?.skillTreeOpen === false, "non-owner unexpectedly opened the skill tree");

    await ownerPage.keyboard.press("Escape");

    await otherPage.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.ui?.paused === false;
    }, { timeout: 5000 });

    ownerState = await getDebugState(ownerPage);
    otherState = await getDebugState(otherPage);
    assert(ownerState?.ui?.shopOpen === false, "pause owner shop did not close");
    assert(otherState?.ui?.paused === false, "non-owner remained paused after owner closed the shop");

    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-network-pause-success.json");
    writeFileSync(
      successPath,
      JSON.stringify(
        {
          owner: ownerState,
          other: otherState
        },
        null,
        2
      )
    );
    console.log(JSON.stringify({
      ownerRole: ownerState?.networkRole || "",
      otherRole: otherState?.networkRole || "",
      successPath
    }, null, 2));
  } catch (error) {
    ownerState = await getDebugState(ownerPage).catch(() => ownerState);
    otherState = await getDebugState(otherPage).catch(() => otherState);
    const artifacts = await captureFailure(
      [
        { label: "owner", page: ownerPage },
        { label: "other", page: otherPage }
      ],
      error,
      {
        ownerState,
        otherState
      }
    );
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nArtifacts: ${artifacts.screenshots.join(", ")}, ${artifacts.statePath}`);
  } finally {
    await browser.close();
    stopChildren();
  }
}

main().catch((error) => {
  stopChildren();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
