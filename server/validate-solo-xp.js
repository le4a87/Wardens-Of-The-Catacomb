import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = resolve(projectRoot, "artifacts", "gameplay");
const HTTP_PORT = 8189;
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

async function getDebugState(page) {
  return page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
}

async function runDebug(page, action, payload = {}) {
  return page.evaluate(
    ({ command, data }) => window.__WOTC_DEBUG__?.run?.(command, data) || null,
    { command: action, data: payload }
  );
}

async function captureFailure(page, error, state) {
  mkdirSync(artifactsDir, { recursive: true });
  const screenshotPath = resolve(artifactsDir, "validate-solo-xp-failure.png");
  const statePath = resolve(artifactsDir, "validate-solo-xp-failure.json");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
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
  await waitForHttpReady(GAME_URL);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let lastState = null;
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle" });
    await page.keyboard.press("Space");
    await page.locator("#mode-select").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#menu-single").click();
    await page.locator("#character-select").waitFor({ state: "visible", timeout: 10000 });
    await page.locator('[data-class-option="archer"]').click();
    await page.locator("#start-game").click();

    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.networkReady === false && Number.isFinite(state.player?.xp);
    }, { timeout: 15000 });

    lastState = await getDebugState(page);
    const baselineXp = lastState?.player?.xp || 0;
    const baselineScore = lastState?.player?.score || 0;

    const damageResult = await runDebug(page, "damageNearestHostile", { amount: 9999 });
    assert(damageResult?.ok === true, `failed to damage a hostile for XP validation: ${JSON.stringify(damageResult)}`);

    await page.waitForFunction(
      ({ xp, score }) => {
        const state = window.__WOTC_DEBUG__?.getState?.();
        return !!state && ((state.player?.xp || 0) > xp || (state.player?.score || 0) > score);
      },
      { xp: baselineXp, score: baselineScore },
      { timeout: 5000 }
    );

    lastState = await getDebugState(page);
    assert((lastState?.player?.xp || 0) > baselineXp || (lastState?.player?.score || 0) > baselineScore, "solo kill did not grant XP or score");

    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-solo-xp-success.json");
    writeFileSync(
      successPath,
      JSON.stringify(
        {
          baselineXp,
          finalXp: lastState?.player?.xp || 0,
          baselineScore,
          finalScore: lastState?.player?.score || 0,
          damageResult
        },
        null,
        2
      )
    );
    console.log(JSON.stringify({
      baselineXp,
      finalXp: lastState?.player?.xp || 0,
      baselineScore,
      finalScore: lastState?.player?.score || 0,
      successPath
    }, null, 2));
  } catch (error) {
    const state = await getDebugState(page).catch(() => lastState);
    const artifacts = await captureFailure(page, error, state);
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
