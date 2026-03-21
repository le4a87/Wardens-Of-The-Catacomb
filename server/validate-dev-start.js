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
const HTTP_PORT = 8184;
const GAME_URL = `http://127.0.0.1:${HTTP_PORT}/?dev=1`;
const classes = ["archer", "warrior", "necromancer"];
const floors = [2, 3, 4, 5];

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

function startChild(name, cmd, args) {
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    env: process.env,
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

async function ensurePortAvailable(port, label) {
  await new Promise((resolvePromise, rejectPromise) => {
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

async function getDebugState(page) {
  return page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
}

async function runScenario(page, classKey, floor) {
  const errors = [];
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(GAME_URL, { waitUntil: "networkidle" });
  await page.keyboard.press("Space");
  await page.locator("#character-select").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#net-player-name").fill("DevStartValidator");
  await page.locator(`[data-class-option="${classKey}"]`).click();
  await page.locator("#dev-start-floor").evaluate((element, value) => {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(floor));
  await page.locator("#start-game").click();

  await page.waitForFunction(
    ({ targetFloor }) => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.floor === targetFloor && state.walkable === true && state.tile?.value === "P";
    },
    { targetFloor: floor },
    { timeout: 10000 }
  );

  const before = await getDebugState(page);
  assert(before && before.floor === floor, `expected floor ${floor}, got ${before?.floor}`);
  assert(before.walkable === true, `start position on floor ${floor} was not walkable`);
  assert(before.tile?.value === "P", `expected player tile P on floor ${floor}, got ${before.tile?.value}`);

  const movementKeys = ["d", "s", "a", "w"];
  let after = before;
  let movementDelta = 0;
  for (const key of movementKeys) {
    await page.keyboard.down(key);
    await page.waitForTimeout(220);
    await page.keyboard.up(key);
    await page.waitForTimeout(80);
    after = await getDebugState(page);
    movementDelta = Math.hypot((after?.player?.x || 0) - before.player.x, (after?.player?.y || 0) - before.player.y);
    if (movementDelta > 4) break;
  }
  assert(movementDelta > 4, `dev start floor ${floor} for ${classKey} did not move after directional input sweep`);
  assert(errors.length === 0, `console/page errors on floor ${floor} for ${classKey}: ${errors.join(" | ")}`);

  return {
    classKey,
    floor,
    movementDelta,
    classType: after?.player?.classType || "",
    tile: after?.tile?.value || null
  };
}

async function captureFailure(page, error, results = [], state = null) {
  mkdirSync(artifactsDir, { recursive: true });
  const screenshotPath = resolve(artifactsDir, "validate-dev-start-failure.png");
  const statePath = resolve(artifactsDir, "validate-dev-start-failure.json");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        results,
        state
      },
      null,
      2
    )
  );
  return { screenshotPath, statePath };
}

async function main() {
  await ensurePortAvailable(HTTP_PORT, "HTTP");
  const python = choosePythonCommand();
  startChild("http", python.cmd, [...python.args, String(HTTP_PORT)]);
  await waitForHttpReady(`http://127.0.0.1:${HTTP_PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const results = [];

  try {
    for (const classKey of classes) {
      for (const floor of floors) {
        results.push(await runScenario(page, classKey, floor));
      }
    }

    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-dev-start-success.json");
    writeFileSync(successPath, JSON.stringify({ results }, null, 2));
    console.log(JSON.stringify({ scenarios: results.length, successPath, results }, null, 2));
  } catch (error) {
    const state = await getDebugState(page).catch(() => null);
    const artifacts = await captureFailure(page, error, results, state);
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
