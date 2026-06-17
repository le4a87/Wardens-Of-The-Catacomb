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
const WS_PORT = 8194;
const ROOM_ID = "validate-network-archer";
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

function normalizeAngleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

async function captureFailure(page, error, state = null, samples = null) {
  mkdirSync(artifactsDir, { recursive: true });
  const screenshotPath = resolve(artifactsDir, "validate-network-archer-failure.png");
  const statePath = resolve(artifactsDir, "validate-network-archer-failure.json");
  const sentInputs = await page.evaluate(() => Array.isArray(window.__WOTC_SENT_INPUTS__) ? window.__WOTC_SENT_INPUTS__.slice(-24) : []).catch(() => []);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        state,
        samples,
        sentInputs
      },
      null,
      2
    )
  );
  return { screenshotPath, statePath };
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
  const shotSamples = [];
  const skippedAttempts = [];
  let lastState = null;
  try {
    await page.addInitScript(() => {
      window.__WOTC_SENT_INPUTS__ = [];
      const send = window.WebSocket.prototype.send;
      window.WebSocket.prototype.send = function captureInput(data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.type === "input") {
            window.__WOTC_SENT_INPUTS__.push(parsed.input);
            if (window.__WOTC_SENT_INPUTS__.length > 48) window.__WOTC_SENT_INPUTS__.shift();
          }
        } catch {}
        return send.call(this, data);
      };
    });
    await page.goto(GAME_URL, { waitUntil: "networkidle" });
    await page.keyboard.press("Space");
    await page.locator("#mode-select").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#menu-network").click();
    await page.locator("#network-setup-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#net-server-url").fill(`ws://127.0.0.1:${WS_PORT}`);
    await page.locator("#net-room-id").fill(ROOM_ID);
    await page.locator("#net-player-name-setup").fill("ArcherValidator");
    await page.locator("#network-setup-next").click();
    await page.locator("#network-lobby-screen").waitFor({ state: "visible", timeout: 10000 });
    await page.locator('[data-lobby-class-option="archer"]').click();
    await page.locator("#network-lobby-toggle-ready").click();

    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.networkReady === true && state.networkRole === "Active" && state.player.classType === "archer";
    }, { timeout: 15000 });

    const canvas = page.locator("#game");
    const box = await canvas.boundingBox();
    assert(box, "game canvas bounding box unavailable");
    const canvasSize = await canvas.evaluate((node) => ({ width: node.width, height: node.height }));
    const toClientPoint = (screenX, screenY) => ({
      x: box.x + Math.max(40, Math.min(canvasSize.width - 40, screenX)) * (box.width / canvasSize.width),
      y: box.y + Math.max(40, Math.min(canvasSize.height - 40, screenY)) * (box.height / canvasSize.height)
    });

    const sampleTargetCount = 3;
    const maxAttempts = 8;
    const movementLanes = [
      { key: "d", dx: 1, dy: 0 },
      { key: "s", dx: 0, dy: 1 },
      { key: "a", dx: -1, dy: 0 },
      { key: "w", dx: 0, dy: -1 }
    ];

    for (let attemptIndex = 0; attemptIndex < maxAttempts && shotSamples.length < sampleTargetCount; attemptIndex++) {
      const before = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
      assert(before, "debug state unavailable before archer shot");
      const lane = movementLanes[attemptIndex % movementLanes.length];
      const primaryTarget = Array.isArray(before.hostiles)
        ? before.hostiles.find((entry) =>
            entry &&
            Number.isFinite(entry.screenX) &&
            Number.isFinite(entry.screenY) &&
            Number.isFinite(entry.distToPlayer) &&
            entry.distToPlayer >= 160 &&
            entry.screenX >= 40 &&
            entry.screenX <= canvasSize.width - 40 &&
            entry.screenY >= 40 &&
            entry.screenY <= canvasSize.height - 40
          )
        : null;
      const aimPoint = primaryTarget
        ? toClientPoint(primaryTarget.screenX, primaryTarget.screenY)
        : toClientPoint(
            before.player.x - before.camera.x + lane.dx * 120,
            before.player.y - before.camera.y + lane.dy * 120
          );
      await page.mouse.move(aimPoint.x, aimPoint.y);
      const baselineProjectileSeq = Array.isArray(before.combat?.ownedProjectiles)
        ? before.combat.ownedProjectiles
            .filter((entry) => entry?.source === "authoritative" && Number.isFinite(entry.spawnSeq))
            .reduce((max, entry) => Math.max(max, Math.floor(entry.spawnSeq)), 0)
        : 0;
      await page.keyboard.down(lane.key);
      await delay(260);
      const clickStartedAt = await page.evaluate(() => performance.now());
      await page.mouse.click(aimPoint.x, aimPoint.y, { button: "left" });
      await delay(70);
      await page.keyboard.up(lane.key);

      const projectileReadyHandle = await page.waitForFunction(({ baselineSeq }) => {
        const state = window.__WOTC_DEBUG__?.getState?.();
        if (!state) return null;
        const owned = Array.isArray(state.combat?.ownedProjectiles) ? state.combat.ownedProjectiles : [];
        const authoritative = owned.filter((projectile) =>
          projectile &&
          projectile.source === "authoritative" &&
          Number.isFinite(projectile.spawnSeq) &&
          Math.floor(projectile.spawnSeq) > baselineSeq
        );
        if (authoritative.length <= 0) return null;
        const matched = authoritative
          .filter((projectile) =>
            Number.isFinite(projectile.angle) && String(projectile.projectileType || "").startsWith("ranger_")
          )
          .sort((a, b) => Math.floor(b.spawnSeq) - Math.floor(a.spawnSeq))[0];
        if (!matched) return null;
        return {
          state,
          projectile: matched,
          visibleAtMs: performance.now()
        };
      }, { baselineSeq: baselineProjectileSeq }, { timeout: 800 }).catch(() => null);
      if (!projectileReadyHandle) {
        skippedAttempts.push({
          attemptIndex,
          reason: "noAuthoritativeProjectileObserved",
          lane: lane.key,
          targetedVisibleHostile: !!primaryTarget
        });
        continue;
      }
      const projectileReady = await projectileReadyHandle.jsonValue();
      const after = projectileReady?.state || null;
      const projectile = projectileReady?.projectile || null;
      assert(after && projectile, "debug state unavailable after authoritative archer shot");
      const aimX = after.aim?.x;
      const aimY = after.aim?.y;
      assert(Number.isFinite(aimX) && Number.isFinite(aimY), "aim state unavailable after authoritative archer shot");
      const targetAngle = Math.atan2(aimY - after.player.y, aimX - after.player.x);
      const projectileError = Math.abs(normalizeAngleDiff(projectile.angle, targetAngle));
      const visibleLatencyMs = Math.max(0, (projectileReady?.visibleAtMs || performance.now()) - clickStartedAt);
      shotSamples.push({
        shotIndex: shotSamples.length + 1,
        attemptIndex,
        visibleProjectileAngleErrorDeg: projectileError * (180 / Math.PI),
        visibleProjectileSource: projectile.source,
        projectileType: projectile.projectileType,
        visibleLatencyMs,
        lane: lane.key,
        targetedVisibleHostile: !!primaryTarget
      });
      assert(projectileError <= 0.16, `visible projectile drifted ${ (projectileError * 180 / Math.PI).toFixed(2) } deg`);
      assert(visibleLatencyMs <= 260, `projectile visibility latency ${visibleLatencyMs.toFixed(1)}ms is too high`);
    }

    assert(shotSamples.length >= 2, `captured only ${shotSamples.length} authoritative archer samples after ${maxAttempts} attempts`);

    lastState = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-network-archer-success.json");
    writeFileSync(successPath, JSON.stringify({ shots: shotSamples, skippedAttempts, finalState: lastState }, null, 2));
    console.log(JSON.stringify({
      shots: shotSamples,
      skippedAttempts,
      successPath
    }, null, 2));
  } catch (error) {
    const state = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null).catch(() => lastState);
    const artifacts = await captureFailure(page, error, state, shotSamples);
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
