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

    const sampleTargetCount = 3;
    const maxAttempts = 8;

    for (let attemptIndex = 0; attemptIndex < maxAttempts && shotSamples.length < sampleTargetCount; attemptIndex++) {
      const before = await page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
      assert(before, "debug state unavailable before archer shot");
      const primaryTarget = Array.isArray(before.hostiles)
        ? before.hostiles.find((entry) => entry && Number.isFinite(entry.screenX) && Number.isFinite(entry.screenY))
        : null;
      const aimPoint = primaryTarget
        ? {
            x: box.x + Math.max(40, Math.min(box.width - 40, primaryTarget.screenX)),
            y: box.y + Math.max(40, Math.min(box.height - 40, primaryTarget.screenY))
          }
        : {
            x: box.x + box.width * 0.76,
            y: box.y + box.height * 0.42
          };
      await page.mouse.move(aimPoint.x, aimPoint.y);
      const beforeCount = before.combat?.recentPlayerShots?.length || 0;
      const baselineProjectileCount = Array.isArray(before.combat?.ownedProjectiles)
        ? before.combat.ownedProjectiles.filter((entry) => entry?.source === "authoritative").length
        : 0;
      const clickStartedAt = performance.now();
      await page.keyboard.down("d");
      await delay(260);
      await page.mouse.click(aimPoint.x, aimPoint.y, { button: "left" });
      await delay(70);
      await page.keyboard.up("d");

      const shotReadyHandle = await page.waitForFunction((countBefore) => {
        const state = window.__WOTC_DEBUG__?.getState?.();
        if (!!state && (state.combat?.recentPlayerShots?.length || 0) > countBefore) {
          return {
            state,
            atMs: performance.now()
          };
        }
        return null;
      }, beforeCount, { timeout: 2000 });
      const shotReady = await shotReadyHandle.jsonValue();
      const afterShot = shotReady?.state || null;
      assert(afterShot, "debug state unavailable after archer shot");
      const shots = afterShot.combat?.recentPlayerShots || [];
      const newShots = shots.slice(beforeCount);
      const primaryShots = newShots.filter((entry) => entry?.source === "primary" || entry?.source === "predictedPrimary");
      assert(primaryShots.length === 1, `single click produced ${primaryShots.length} primary shot telemetry entries from ${newShots.length} total`);
      const shot = primaryShots[0];
      assert(Array.isArray(shot.volleyAngles) && shot.volleyAngles.length === shot.multishotCount, `bad volley telemetry: ${JSON.stringify(shot)}`);
      const aimX = Number.isFinite(shot.aimX) ? shot.aimX : afterShot.aim?.x;
      const aimY = Number.isFinite(shot.aimY) ? shot.aimY : afterShot.aim?.y;
      assert(Number.isFinite(aimX) && Number.isFinite(aimY), `aim telemetry missing: ${JSON.stringify(shot)}`);
      const targetAngle = Math.atan2(aimY - shot.playerY, aimX - shot.playerX);
      const baseAngleError = Math.abs(normalizeAngleDiff(shot.intendedAngle, targetAngle));
      const meanVolleyAngle = shot.volleyAngles.reduce((sum, value) => sum + value, 0) / Math.max(1, shot.volleyAngles.length);
      const meanVolleyError = Math.abs(normalizeAngleDiff(meanVolleyAngle, targetAngle));
      const spreadWidthDeg =
        shot.volleyAngles.length > 1
          ? Math.abs(normalizeAngleDiff(shot.volleyAngles[shot.volleyAngles.length - 1], shot.volleyAngles[0])) * (180 / Math.PI)
          : 0;
      const projectileReadyHandle = await page.waitForFunction(({ seq, baselineCount }) => {
        const state = window.__WOTC_DEBUG__?.getState?.();
        if (!state) return null;
        const owned = Array.isArray(state.combat?.ownedProjectiles) ? state.combat.ownedProjectiles : [];
        const matched = owned.find((projectile) => projectile && projectile.source === "authoritative" && projectile.spawnSeq === seq);
        if (!matched) {
          const authoritativeCount = owned.filter((projectile) => projectile && projectile.source === "authoritative").length;
          if (authoritativeCount <= baselineCount) return null;
        }
        return {
          state,
          projectile: matched || null,
          visibleAtMs: performance.now()
        };
      }, { seq: shot.seq || 0, baselineCount: baselineProjectileCount }, { timeout: 2600 }).catch(() => null);
      if (!projectileReadyHandle) {
        skippedAttempts.push({
          attemptIndex,
          reason: "noAuthoritativeProjectileObserved",
          shot
        });
        continue;
      }
      const projectileReady = await projectileReadyHandle.jsonValue();
      const after = projectileReady?.state || afterShot;
      const ownedProjectiles = after.combat?.ownedProjectiles || [];
      const projectileCandidates = ownedProjectiles.filter((projectile) => projectile.source === "authoritative" && Number.isFinite(projectile.angle));
      if (projectileCandidates.length === 0) {
        skippedAttempts.push({
          attemptIndex,
          reason: "missingAuthoritativeAngleTelemetry",
          shot,
          ownedProjectiles
        });
        continue;
      }
      const matchedProjectile = projectileReady?.projectile || null;
      let bestProjectile = matchedProjectile;
      let bestProjectileError = matchedProjectile && Number.isFinite(matchedProjectile.angle)
        ? Math.abs(normalizeAngleDiff(matchedProjectile.angle, targetAngle))
        : Infinity;
      if (!bestProjectile || !Number.isFinite(bestProjectile.angle)) {
        for (const candidate of projectileCandidates) {
          const candidateError = Math.abs(normalizeAngleDiff(candidate.angle, targetAngle));
          if (candidateError < bestProjectileError) {
            bestProjectile = candidate;
            bestProjectileError = candidateError;
          }
        }
      }
      const visibleLatencyMs = Math.max(0, (projectileReady?.visibleAtMs || performance.now()) - clickStartedAt);
      shotSamples.push({
        shotIndex: shotSamples.length + 1,
        attemptIndex,
        primaryShotCount: primaryShots.length,
        totalShotTelemetryCount: newShots.length,
        baseAngleErrorDeg: baseAngleError * (180 / Math.PI),
        meanVolleyErrorDeg: meanVolleyError * (180 / Math.PI),
        visibleProjectileAngleErrorDeg: bestProjectileError * (180 / Math.PI),
        visibleProjectileSource: bestProjectile.source,
        visibleLatencyMs,
        spreadWidthDeg,
        projectileSpeed: shot.projectileSpeed,
        fireCooldown: shot.fireCooldown,
        moving: shot.moving
      });
      assert(baseAngleError <= 0.12, `base shot angle drifted ${ (baseAngleError * 180 / Math.PI).toFixed(2) } deg`);
      assert(meanVolleyError <= 0.12, `volley center drifted ${ (meanVolleyError * 180 / Math.PI).toFixed(2) } deg`);
      assert(bestProjectileError <= 0.16, `visible projectile drifted ${ (bestProjectileError * 180 / Math.PI).toFixed(2) } deg`);
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
