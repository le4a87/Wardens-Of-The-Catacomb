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
const HTTP_PORT = 8182;
const WS_PORT = 8192;
const ROOM_ID = "validate-network-audio";
const GAME_URL = `http://127.0.0.1:${HTTP_PORT}`;
const SAMPLE_COUNT = 12;
const SAMPLE_DELAY_MS = 500;
const cliArgs = new Set(process.argv.slice(1));
const HEADED = cliArgs.has("--headed");
const FOCUS_CYCLE = cliArgs.has("--focus-cycle");

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

async function captureFailure(page, error, state = null, samples = []) {
  mkdirSync(artifactsDir, { recursive: true });
  const screenshotPath = resolve(artifactsDir, "validate-network-audio-failure.png");
  const statePath = resolve(artifactsDir, "validate-network-audio-failure.json");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        state,
        samples
      },
      null,
      2
    )
  );
  return { screenshotPath, statePath };
}

function sampleSummary(sample) {
  return {
    atMs: sample.atMs,
    focus: sample.documentHasFocus,
    visibility: sample.documentVisibilityState || sample.audio?.documentVisibilityState || "",
    mode: sample.audio?.currentMode || "",
    track: sample.audio?.activeTrackTitle || "",
    time: sample.audio?.currentTrackTime || 0,
    paused: sample.audio?.currentTrackPaused,
    resets: sample.audio?.resetCount || 0,
    playAttempts: sample.audio?.playAttempts || 0,
    waiting: sample.audio?.waitingCount || 0,
    stalled: sample.audio?.stalledCount || 0,
    focusCount: sample.audio?.focusCount || 0,
    blurCount: sample.audio?.blurCount || 0,
    visibilityChangeCount: sample.audio?.visibilityChangeCount || 0
  };
}

async function runFocusCycle(browser, primaryPage) {
  const distractor = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    await distractor.goto("data:text/html,<title>FocusCycle</title><body>focus cycle</body>", { waitUntil: "load" });
    await distractor.bringToFront();
    await delay(600);
    await primaryPage.bringToFront();
    await delay(700);
  } finally {
    await distractor.close().catch(() => {});
  }
}

async function main() {
  await ensurePortAvailable(HTTP_PORT, "HTTP");
  await ensurePortAvailable(WS_PORT, "WS");

  const python = choosePythonCommand();
  startChild("http", python.cmd, [...python.args, String(HTTP_PORT)]);
  startChild("ws", process.execPath, ["server/networkServer.js"], { PORT: String(WS_PORT) });

  await waitForHttpReady(GAME_URL);
  await waitForTcpReady(WS_PORT);

  const browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const samples = [];
  let lastState = null;
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle" });
    await page.bringToFront();
    await page.keyboard.press("Space");
    await page.locator("#mode-select").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#menu-network").click();
    await page.locator("#network-setup-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#net-server-url").fill(`ws://127.0.0.1:${WS_PORT}`);
    await page.locator("#net-room-id").fill(ROOM_ID);
    await page.locator("#net-player-name-setup").fill("AudioValidator");
    await page.locator("#network-setup-next").click();
    await page.locator("#network-lobby-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator('[data-lobby-class-option="archer"]').click();
    await page.locator("#network-lobby-toggle-ready").click();

    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.networkReady === true && state.networkRole === "Active";
    }, { timeout: 15000 });

    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && !!state.audio && state.audio.currentMode === "gameplay" && !!state.audio.activeTrackTitle;
    }, { timeout: 8000 });

    const baseline = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
    assert(baseline?.audio, "debug audio state unavailable after join");
    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      if (FOCUS_CYCLE && i === Math.floor(SAMPLE_COUNT / 2)) {
        await runFocusCycle(browser, page);
      }
      await delay(SAMPLE_DELAY_MS);
      await page.mouse.move(40 + i * 5, 40 + (i % 3) * 5);
      lastState = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
      assert(lastState?.audio, "debug audio state unavailable during sampling");
      samples.push({
        atMs: i * SAMPLE_DELAY_MS,
        documentHasFocus: lastState.documentHasFocus,
        audio: lastState.audio
      });
    }

    const finalState = samples[samples.length - 1]?.audio || baseline.audio;
    const focusDrops = samples.filter((sample) => sample.documentHasFocus !== true).length;
    const progressedSeconds = (finalState.currentTrackTime || 0) - (baseline.audio.currentTrackTime || 0);
    const playAttemptsDelta = (finalState.playAttempts || 0) - (baseline.audio.playAttempts || 0);
    const resetDelta = (finalState.resetCount || 0) - (baseline.audio.resetCount || 0);
    const focusDelta = (finalState.focusCount || 0) - (baseline.audio.focusCount || 0);
    const blurDelta = (finalState.blurCount || 0) - (baseline.audio.blurCount || 0);
    const visibilityDelta = (finalState.visibilityChangeCount || 0) - (baseline.audio.visibilityChangeCount || 0);
    const focusCycleObserved = focusDrops > 0 || focusDelta > 0 || blurDelta > 0 || visibilityDelta > 0;
    const interruptionDelta =
      ((finalState.waitingCount || 0) + (finalState.stalledCount || 0)) -
      ((baseline.audio.waitingCount || 0) + (baseline.audio.stalledCount || 0));

    if (!FOCUS_CYCLE) {
      assert(focusDrops === 0, `page focus dropped during active-tab audio validation: ${focusDrops} sample(s)`);
    } else {
      if (HEADED) {
        assert(blurDelta >= 1, `focus-cycle run did not record a blur transition: ${blurDelta}`);
        assert(focusDelta >= 1, `focus-cycle run did not record a focus transition: ${focusDelta}`);
        assert(visibilityDelta >= 1, `focus-cycle run did not record a visibility transition: ${visibilityDelta}`);
      }
    }
    assert(progressedSeconds >= 3.5, `music playback progressed too slowly while focused: ${progressedSeconds.toFixed(2)}s`);
    assert(playAttemptsDelta <= 2, `music play attempts restarted too often while focused: ${playAttemptsDelta}`);
    assert(resetDelta <= 1, `music reset too often while focused: ${resetDelta}`);
    assert(interruptionDelta <= 2, `music buffering/stall events too high while focused: ${interruptionDelta}`);

    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-network-audio-success.json");
    writeFileSync(
      successPath,
      JSON.stringify(
        {
          mode: {
            headed: HEADED,
            focusCycle: FOCUS_CYCLE,
            focusCycleObserved
          },
          baseline: sampleSummary({ ...baseline, atMs: 0 }),
          final: sampleSummary({ atMs: SAMPLE_COUNT * SAMPLE_DELAY_MS, ...lastState }),
          samples: samples.map(sampleSummary)
        },
        null,
        2
      )
    );
    console.log(JSON.stringify({
      headed: HEADED,
      focusCycle: FOCUS_CYCLE,
      progressedSeconds,
      playAttemptsDelta,
      resetDelta,
      focusDelta,
      blurDelta,
      visibilityDelta,
      focusCycleObserved,
      interruptionDelta,
      successPath
    }, null, 2));
  } catch (error) {
    const state = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null).catch(() => lastState);
    const artifacts = await captureFailure(page, error, state, samples.map(sampleSummary));
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
