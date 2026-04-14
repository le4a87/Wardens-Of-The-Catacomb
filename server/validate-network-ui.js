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
const HTTP_PORT = 8183;
const WS_PORT = 8194;
const ROOM_ID = "validate-network-ui";
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

async function captureFailure(page, error, state = null, actionLog = []) {
  mkdirSync(artifactsDir, { recursive: true });
  const screenshotPath = resolve(artifactsDir, "validate-network-ui-failure.png");
  const statePath = resolve(artifactsDir, "validate-network-ui-failure.json");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        state,
        actionLog
      },
      null,
      2
    )
  );
  return { screenshotPath, statePath };
}

async function getDebugState(page) {
  return page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
}

async function getActionLog(page) {
  return page.evaluate(() => Array.isArray(window.__WOTC_NET_SEND_LOG__) ? window.__WOTC_NET_SEND_LOG__.slice() : []);
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
  await context.addInitScript(() => {
    const log = [];
    window.__WOTC_NET_SEND_LOG__ = log;
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = class LoggedWebSocket extends OriginalWebSocket {
      constructor(url, protocols) {
        super(url, protocols);
      }
      send(data) {
        try {
          const text = typeof data === "string" ? data : "";
          const parsed = text ? JSON.parse(text) : null;
          log.push({
            atMs: Math.round(performance.now()),
            type: parsed?.type || "",
            actionKind: parsed?.action?.kind || "",
            actionKey: parsed?.action?.key || ""
          });
          if (log.length > 60) log.splice(0, log.length - 60);
        } catch {}
        return super.send(data);
      }
    };
  });
  const page = await context.newPage();
  let lastState = null;
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle" });
    await page.keyboard.press("Space");
    await page.locator("#mode-select").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#menu-network").click();
    await page.locator("#network-setup-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#net-server-url").fill(`ws://127.0.0.1:${WS_PORT}`);
    await page.locator("#net-room-id").fill(ROOM_ID);
    await page.locator("#net-player-name-setup").fill("UiValidator");
    await page.locator("#network-setup-next").click();
    await page.locator("#network-lobby-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator('[data-lobby-class-option="archer"]').click();
    await page.locator("#network-lobby-toggle-ready").click();

    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.networkReady === true && state.networkRole === "Active" && !!state.ui?.shopButton && !!state.ui?.skillTreeButton;
    }, { timeout: 12000 });

    lastState = await getDebugState(page);
    assert(lastState?.ui?.shopButton, "shop button rect unavailable");
    assert(lastState?.ui?.skillTreeButton, "skill tree button rect unavailable");

    await page.keyboard.press("b");
    await delay(250);
    const shopState = await getDebugState(page);
    const afterShopLog = await getActionLog(page);

    await page.keyboard.press("k");
    await delay(250);
    const skillState = await getDebugState(page);
    const afterSkillLog = await getActionLog(page);

    const sentToggleShop = afterShopLog.some((entry) => entry.type === "action" && entry.actionKind === "toggleShop");
    const sentToggleSkillTree = afterSkillLog.some((entry) => entry.type === "action" && entry.actionKind === "toggleSkillTree");

    const summary = {
      shopRectPresent: !!lastState.ui.shopButton,
      skillRectPresent: !!lastState.ui.skillTreeButton,
      sentToggleShop,
      sentToggleSkillTree,
      shopOpened: !!shopState?.ui?.shopOpen,
      skillTreeOpened: !!skillState?.ui?.skillTreeOpen,
      actionLog: afterSkillLog.slice(-12)
    };

    assert(sentToggleShop, "pressing B did not send toggleShop");
    assert(sentToggleSkillTree, "pressing K did not send toggleSkillTree");
    assert(shopState?.ui?.shopOpen === true, "shop did not open after toggleShop");
    assert(skillState?.ui?.skillTreeOpen === true, "skill tree did not open after toggleSkillTree");

    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-network-ui-success.json");
    writeFileSync(successPath, JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ...summary, successPath }, null, 2));
  } catch (error) {
    const state = await getDebugState(page).catch(() => lastState);
    const actionLog = await getActionLog(page).catch(() => []);
    const artifacts = await captureFailure(page, error, state, actionLog);
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nArtifacts: ${artifacts.screenshotPath}, ${artifacts.statePath}`);
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
