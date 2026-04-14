import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { diffMetric, mean, percentile, readBaseline } from "./perf/helpers.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = resolve(projectRoot, "artifacts", "perf");
const OUTPUT_PATH = resolve(artifactsDir, "network-browser-latest.json");
const BASELINE_PATH = resolve(artifactsDir, "network-browser-baseline.json");
const HTTP_PORT = 8183;
const WS_PORT = 8193;
const ROOM_ID = "perf-network-browser";
const NET_DELAY_CONTROLLER_MS = Number.parseInt(process.env.NET_DELAY_CONTROLLER_MS || "", 10);
const GAME_URL =
  Number.isFinite(NET_DELAY_CONTROLLER_MS) && NET_DELAY_CONTROLLER_MS >= 0
    ? `http://127.0.0.1:${HTTP_PORT}?netDelayController=${NET_DELAY_CONTROLLER_MS}`
    : `http://127.0.0.1:${HTTP_PORT}`;
const SAMPLE_WINDOW_MS = 5000;
const SAMPLE_INTERVAL_MS = 250;

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

async function captureFailure(page, error, state = null, perfData = null, samples = []) {
  mkdirSync(artifactsDir, { recursive: true });
  const screenshotPath = resolve(artifactsDir, "network-browser-failure.png");
  const statePath = resolve(artifactsDir, "network-browser-failure.json");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        state,
        perfData,
        samples
      },
      null,
      2
    )
  );
  return { screenshotPath, statePath };
}

async function installPerfMonitor(page) {
  await page.evaluate(() => {
    if (window.__WOTC_BROWSER_PERF__) return;
    const monitor = {
      startedAt: performance.now(),
      frameDeltas: [],
      longTasks: [],
      samples: [],
      lastFrameAt: 0
    };
    const loop = (now) => {
      if (monitor.lastFrameAt > 0) {
        monitor.frameDeltas.push(now - monitor.lastFrameAt);
        if (monitor.frameDeltas.length > 1200) monitor.frameDeltas.splice(0, monitor.frameDeltas.length - 1200);
      }
      monitor.lastFrameAt = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          monitor.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration
          });
        }
        if (monitor.longTasks.length > 200) monitor.longTasks.splice(0, monitor.longTasks.length - 200);
      });
      observer.observe({ entryTypes: ["longtask"] });
      monitor.longTaskObserverReady = true;
    } catch {
      monitor.longTaskObserverReady = false;
    }

    window.__WOTC_BROWSER_PERF__ = {
      pushSample(sample) {
        monitor.samples.push({
          atMs: Math.round(performance.now() - monitor.startedAt),
          sample
        });
        if (monitor.samples.length > 400) monitor.samples.splice(0, monitor.samples.length - 400);
      },
      snapshot() {
        return {
          startedAt: monitor.startedAt,
          frameDeltas: [...monitor.frameDeltas],
          longTasks: [...monitor.longTasks],
          samples: [...monitor.samples],
          longTaskObserverReady: monitor.longTaskObserverReady
        };
      }
    };
  });
}

async function measureMovementLatency(page, key) {
  const startState = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
  assert(startState?.player, "debug state unavailable before movement latency probe");
  const startX = startState.player.x;
  const startY = startState.player.y;
  const startedAt = Date.now();
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ([axisKey, originX, originY]) => {
        const state = window.__WOTC_DEBUG__?.getState?.();
        if (!state?.player) return false;
        const dx = Math.abs((state.player.x || 0) - originX);
        const dy = Math.abs((state.player.y || 0) - originY);
        if (axisKey === "d" || axisKey === "a") return dx > 6;
        return dy > 6;
      },
      [key, startX, startY],
      { timeout: 3000 }
    );
    return Date.now() - startedAt;
  } finally {
    await page.keyboard.up(key);
  }
}

function summarizeBrowserPerf(perfData) {
  const frameDeltas = Array.isArray(perfData?.frameDeltas) ? perfData.frameDeltas : [];
  const longTasks = Array.isArray(perfData?.longTasks) ? perfData.longTasks.map((entry) => entry.duration) : [];
  const samples = Array.isArray(perfData?.samples) ? perfData.samples.map((entry) => entry.sample || {}) : [];
  const pendingInputs = samples.map((sample) => sample.net?.pendingInputs || 0);
  const snapshotBuffers = samples.map((sample) => sample.net?.snapshotBuffer || 0);
  const correctionPx = samples.map((sample) => sample.networkPerf?.lastCorrectionPx || 0);
  const hardSnapCounts = samples.map((sample) => sample.networkPerf?.hardSnapCount || 0);
  const focusDrops = samples.filter((sample) => sample.documentHasFocus !== true).length;
  return {
    avgFrameMs: mean(frameDeltas),
    p95FrameMs: percentile(frameDeltas, 95),
    frameSpikeCount: frameDeltas.filter((value) => value > 50).length,
    longTaskCount: longTasks.length,
    longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
    p95LongTaskMs: percentile(longTasks, 95),
    avgPendingInputs: mean(pendingInputs),
    p95PendingInputs: percentile(pendingInputs, 95),
    avgSnapshotBuffer: mean(snapshotBuffers),
    p95SnapshotBuffer: percentile(snapshotBuffers, 95),
    avgCorrectionPx: mean(correctionPx),
    p95CorrectionPx: percentile(correctionPx, 95),
    maxCorrectionPx: correctionPx.length ? Math.max(...correctionPx) : 0,
    hardSnapCount: hardSnapCounts.length ? Math.max(...hardSnapCounts) : 0,
    focusDrops
  };
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let lastState = null;
  let perfData = null;
  try {
    await page.goto(GAME_URL, { waitUntil: "networkidle" });
    await page.bringToFront();
    await installPerfMonitor(page);
    await page.keyboard.press("Space");
    await page.locator("#mode-select").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#menu-network").click();
    await page.locator("#network-setup-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#net-server-url").fill(`ws://127.0.0.1:${WS_PORT}`);
    await page.locator("#net-room-id").fill(ROOM_ID);
    await page.locator("#net-player-name-setup").fill("BrowserPerf");
    await page.locator("#network-setup-next").click();
    await page.locator("#network-lobby-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator('[data-lobby-class-option="warrior"]').click();
    await page.locator("#network-lobby-toggle-ready").click();

    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.networkReady === true && state.networkRole === "Active";
    }, { timeout: 15000 });

    const moveLatenciesMs = [];
    moveLatenciesMs.push(await measureMovementLatency(page, "d"));
    await delay(250);
    moveLatenciesMs.push(await measureMovementLatency(page, "s"));

    await page.keyboard.down("d");
    const startedAt = Date.now();
    while (Date.now() - startedAt < SAMPLE_WINDOW_MS) {
      await delay(SAMPLE_INTERVAL_MS);
      lastState = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
      assert(lastState, "debug state unavailable during browser perf sampling");
      await page.evaluate((state) => {
        window.__WOTC_BROWSER_PERF__?.pushSample?.(state);
      }, lastState);
      if (((Date.now() - startedAt) / SAMPLE_INTERVAL_MS) % 4 === 0) {
        await page.mouse.move(80 + ((Date.now() - startedAt) % 200), 120);
      }
    }
    await page.keyboard.up("d");

    perfData = await page.evaluate(() => window.__WOTC_BROWSER_PERF__?.snapshot?.() || null);
    lastState = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
    assert(perfData, "browser perf snapshot unavailable");
    assert(lastState, "final debug state unavailable");

    const summary = {
      meta: {
        startedAt: new Date(Date.now() - SAMPLE_WINDOW_MS).toISOString(),
        finishedAt: new Date().toISOString(),
        mode: "browser-network",
        roomId: ROOM_ID,
        durationMs: SAMPLE_WINDOW_MS,
        baselinePath: BASELINE_PATH
      },
      movementLatencyMs: {
        values: moveLatenciesMs,
        avg: mean(moveLatenciesMs),
        p95: percentile(moveLatenciesMs, 95)
      },
      browser: summarizeBrowserPerf(perfData),
      finalDebugState: {
        walkable: lastState.walkable,
        documentHasFocus: lastState.documentHasFocus,
        pendingInputs: lastState.net?.pendingInputs || 0,
        snapshotBuffer: lastState.net?.snapshotBuffer || 0,
        correctionPx: lastState.networkPerf?.lastCorrectionPx || 0,
        maxCorrectionPx: lastState.networkPerf?.maxCorrectionPx || 0
      }
    };

    const baseline = readBaseline(BASELINE_PATH);
    let comparison = null;
    let baselineCreated = false;
    if (baseline) {
      comparison = {
        p95FrameMs: diffMetric(summary.browser.p95FrameMs, baseline.browser?.p95FrameMs),
        p95SnapshotBuffer: diffMetric(summary.browser.p95SnapshotBuffer, baseline.browser?.p95SnapshotBuffer),
        maxCorrectionPx: diffMetric(summary.browser.maxCorrectionPx, baseline.browser?.maxCorrectionPx),
        movementLatencyP95Ms: diffMetric(summary.movementLatencyMs.p95, baseline.movementLatencyMs?.p95)
      };
    } else {
      baselineCreated = true;
      comparison = {
        p95FrameMs: { delta: 0, deltaPct: 0 },
        p95SnapshotBuffer: { delta: 0, deltaPct: 0 },
        maxCorrectionPx: { delta: 0, deltaPct: 0 },
        movementLatencyP95Ms: { delta: 0, deltaPct: 0 }
      };
    }

    const artifact = {
      ...summary,
      comparison,
      baselineCreated
    };

    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    if (baselineCreated) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    }

    assert(summary.browser.focusDrops === 0, `browser tab focus dropped during active-tab perf run: ${summary.browser.focusDrops}`);
    assert(summary.browser.p95FrameMs <= 90, `browser p95 frame time too high: ${summary.browser.p95FrameMs.toFixed(2)}ms`);
    assert(summary.browser.p95SnapshotBuffer <= 30, `snapshot buffer depth too high: ${summary.browser.p95SnapshotBuffer}`);
    assert(summary.browser.maxCorrectionPx <= 260, `correction spikes too high: ${summary.browser.maxCorrectionPx.toFixed(2)}px`);
    assert(summary.movementLatencyMs.p95 <= 700, `movement response latency too high: ${summary.movementLatencyMs.p95.toFixed(2)}ms`);

    console.log(JSON.stringify({
      p95FrameMs: artifact.browser.p95FrameMs,
      longTaskCount: artifact.browser.longTaskCount,
      p95SnapshotBuffer: artifact.browser.p95SnapshotBuffer,
      maxCorrectionPx: artifact.browser.maxCorrectionPx,
      movementLatencyP95Ms: artifact.movementLatencyMs.p95,
      baselineCreated,
      outputPath: OUTPUT_PATH
    }, null, 2));
  } catch (error) {
    const state = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null).catch(() => lastState);
    const perfSnapshot = await page.evaluate(() => window.__WOTC_BROWSER_PERF__?.snapshot?.() || null).catch(() => perfData);
    const artifacts = await captureFailure(page, error, state, perfSnapshot);
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
