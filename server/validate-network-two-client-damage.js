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
const HTTP_PORT = 8186;
const WS_PORT = 8196;
const ROOM_ID = "validate-network-two-client-damage";
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

function trackPageIssues(page, label, issues) {
  page.removeAllListeners("pageerror");
  page.on("pageerror", (error) => {
    issues.push({
      label,
      kind: "pageerror",
      message: error instanceof Error ? error.message : String(error)
    });
  });
  page.on("crash", () => {
    issues.push({
      label,
      kind: "crash",
      message: "page crashed"
    });
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    issues.push({
      label,
      kind: "console",
      message: msg.text()
    });
  });
}

async function getDebugState(page) {
  return page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
}

function chooseTarget(state) {
  const hostiles = Array.isArray(state?.hostiles) ? state.hostiles : [];
  const targetable = hostiles.filter((enemy) => enemy && Number.isFinite(enemy.distToPlayer));
  if (targetable.length === 0) return null;
  const immediate = targetable.find((enemy) => enemy.distToPlayer <= 220);
  return immediate || targetable[0];
}

async function tapMovement(page, dx, dy, durationMs = 90) {
  const keys = [];
  if (dx >= 10) keys.push("d");
  else if (dx <= -10) keys.push("a");
  if (dy >= 10) keys.push("s");
  else if (dy <= -10) keys.push("w");
  if (keys.length === 0) return;
  for (const key of keys) await page.keyboard.down(key);
  await delay(durationMs);
  for (const key of keys.reverse()) await page.keyboard.up(key);
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
    return !!state && state.networkReady === true && state.networkRole === role;
  }, expectedRole, { timeout: timeoutMs });
  return getDebugState(page);
}

async function waitForSnapshotAdvance(page, baselineCount, targetIncrease = 6, timeoutMs = 4000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const state = await getDebugState(page);
    if ((state?.networkPerf?.appliedSnapshotCount || 0) >= baselineCount + targetIncrease) return state;
    await delay(60);
  }
  return getDebugState(page);
}

async function roamForChunkStreaming(page, samples, minDistance = 900, maxSteps = 24) {
  const start = await getDebugState(page);
  assert(start, "debug state unavailable before chunk-stream roam");
  let lastX = start.player?.x || 0;
  let lastY = start.player?.y || 0;
  let travelled = 0;
  const pattern = [
    { dx: 160, dy: 0 },
    { dx: 160, dy: 0 },
    { dx: 0, dy: 160 },
    { dx: 0, dy: 160 },
    { dx: -160, dy: 0 },
    { dx: 0, dy: 160 },
    { dx: 160, dy: 0 },
    { dx: 0, dy: -160 }
  ];
  for (let step = 0; step < maxSteps && travelled < minDistance; step++) {
    const dir = pattern[step % pattern.length];
    await tapMovement(page, dir.dx, dir.dy, 140);
    await delay(80);
    const state = await getDebugState(page);
    assert(state, `debug state unavailable during roam step ${step}`);
    const px = state.player?.x || 0;
    const py = state.player?.y || 0;
    travelled += Math.hypot(px - lastX, py - lastY);
    lastX = px;
    lastY = py;
    samples.push({
      phase: "roam",
      step,
      x: px,
      y: py,
      travelled
    });
  }
  return {
    start,
    end: await getDebugState(page),
    travelled
  };
}

async function waitForPlayerDamage(page, samples, timeoutMs = 12000) {
  const initial = await getDebugState(page);
  assert(initial, "debug state unavailable before damage wait");
  const baselineHealth = initial.player?.health || 0;
  const startedAt = performance.now();
  let latestState = initial;
  while (performance.now() - startedAt < timeoutMs) {
    latestState = await getDebugState(page);
    assert(latestState, "debug state unavailable while waiting for damage");
    const currentHealth = latestState.player?.health || 0;
    if (currentHealth < baselineHealth) {
      return {
        baselineHealth,
        currentHealth,
        state: latestState,
        elapsedMs: performance.now() - startedAt
      };
    }
    const target = chooseTarget(latestState);
    samples.push({
      phase: "damage-seek",
      elapsedMs: Math.round(performance.now() - startedAt),
      health: currentHealth,
      targetId: target?.id || null,
      targetType: target?.type || null,
      targetDistance: target?.distToPlayer ?? null
    });
    if (target && Number.isFinite(target.distToPlayer) && target.distToPlayer > 44) {
      await tapMovement(page, target.x - latestState.player.x, target.y - latestState.player.y, 110);
      await delay(100);
    } else {
      await delay(260);
    }
  }
  return {
    baselineHealth,
    currentHealth: latestState?.player?.health || 0,
    state: latestState,
    elapsedMs: performance.now() - startedAt
  };
}

async function captureFailure(pages, error, details) {
  mkdirSync(artifactsDir, { recursive: true });
  const statePath = resolve(artifactsDir, "validate-network-two-client-damage-failure.json");
  const screenshots = [];
  for (const entry of pages) {
    const screenshotPath = resolve(artifactsDir, `validate-network-two-client-damage-${entry.label}-failure.png`);
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
  const controllerPage = await context.newPage();
  const spectatorPage = await context.newPage();
  const issues = [];
  const samples = [];
  trackPageIssues(controllerPage, "controller", issues);
  trackPageIssues(spectatorPage, "spectator", issues);

  let controllerState = null;
  let spectatorState = null;
  try {
    const wsUrl = `ws://127.0.0.1:${WS_PORT}`;
    await openLobby(controllerPage, {
      wsUrl,
      roomId: ROOM_ID,
      playerName: "ControllerRegression",
      classType: "warrior"
    });

    await openLobby(spectatorPage, {
      wsUrl,
      roomId: ROOM_ID,
      playerName: "PeerRegression",
      classType: "archer"
    });

    await setReady(controllerPage);
    await setReady(spectatorPage);

    controllerState = await waitForRole(controllerPage, "Active");
    spectatorState = await waitForRole(spectatorPage, "Active");

    assert(controllerState?.walkable === true, `controller spawned in blocked space: ${JSON.stringify(controllerState?.tile)}`);
    assert(spectatorState?.networkReady === true, "spectator did not finish room sync");

    const controllerSnapshotBase = controllerState?.networkPerf?.appliedSnapshotCount || 0;
    const spectatorSnapshotBase = spectatorState?.networkPerf?.appliedSnapshotCount || 0;

    const roamResult = await roamForChunkStreaming(controllerPage, samples, 520, 28);
    assert(roamResult.travelled >= 440, `controller did not travel far enough to stress chunk streaming: ${roamResult.travelled.toFixed(1)}px`);

    controllerState = await waitForSnapshotAdvance(controllerPage, controllerSnapshotBase, 10, 5000);
    spectatorState = await waitForSnapshotAdvance(spectatorPage, spectatorSnapshotBase, 10, 5000);
    assert((issues.length || 0) === 0, `browser errors detected during chunk-stream phase: ${JSON.stringify(issues)}`);

    const damageResult = await waitForPlayerDamage(controllerPage, samples, 14000);
    controllerState = damageResult.state;
    spectatorState = await waitForSnapshotAdvance(
      spectatorPage,
      spectatorState?.networkPerf?.appliedSnapshotCount || spectatorSnapshotBase,
      4,
      4000
    );

    assert(
      damageResult.currentHealth < damageResult.baselineHealth,
      `controller never took damage: baseline=${damageResult.baselineHealth}, current=${damageResult.currentHealth}`
    );
    assert(controllerState?.networkReady === true, "controller lost network readiness after damage");
    assert(spectatorState?.networkReady === true, "spectator lost network readiness after damage");
    assert((controllerState?.player?.hpBarTimer || 0) > 0, "controller self hp bar timer did not activate after taking damage");
    assert((controllerState?.networkPerf?.appliedSnapshotCount || 0) > controllerSnapshotBase, "controller snapshots stopped advancing");
    assert((spectatorState?.networkPerf?.appliedSnapshotCount || 0) > spectatorSnapshotBase, "spectator snapshots stopped advancing");
    assert((spectatorState?.player?.health || Infinity) <= damageResult.baselineHealth, "spectator did not observe synced player health");
    assert(issues.length === 0, `browser errors detected after damage sync: ${JSON.stringify(issues)}`);

    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-network-two-client-damage-success.json");
    writeFileSync(
      successPath,
      JSON.stringify(
        {
          roam: {
            travelled: roamResult.travelled,
            start: roamResult.start?.player || null,
            end: roamResult.end?.player || null
          },
          damage: {
            baselineHealth: damageResult.baselineHealth,
            currentHealth: damageResult.currentHealth,
            elapsedMs: damageResult.elapsedMs
          },
          controller: controllerState,
          spectator: spectatorState,
          issues,
          samples
        },
        null,
        2
      )
    );
    console.log(JSON.stringify({
      travelledPx: Math.round(roamResult.travelled),
      damageTaken: damageResult.baselineHealth - damageResult.currentHealth,
      controllerSnapshots: controllerState?.networkPerf?.appliedSnapshotCount || 0,
      spectatorSnapshots: spectatorState?.networkPerf?.appliedSnapshotCount || 0,
      successPath
    }, null, 2));
  } catch (error) {
    controllerState = await getDebugState(controllerPage).catch(() => controllerState);
    spectatorState = await getDebugState(spectatorPage).catch(() => spectatorState);
    const artifacts = await captureFailure(
      [
        { label: "controller", page: controllerPage },
        { label: "spectator", page: spectatorPage }
      ],
      error,
      {
        controllerState,
        spectatorState,
        issues,
        samples
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
