import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { GameSim } from "../src/sim/GameSim.js";
import { diffMetric, estimateServerNow, mean, percentile, readBaseline, stddev } from "./perf/helpers.js";
import { updateProjectileStateFromSnapshot } from "./perf/projectileState.js";

const PERF_PORT = Number.parseInt(process.env.PERF_PORT || "8091", 10);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(projectRoot);
const OUTPUT_PATH = resolve(projectRoot, "artifacts/perf/latest.json");
const BASELINE_PATH = resolve(projectRoot, "artifacts/perf/baseline.json");
const ROOM_ID = "perf-room";
const RUN_MS = 5200;
const INPUT_HZ = 20;
const SNAPSHOT_HISTORY_CAP = 600;
const RENDER_STEP_MS = 1000 / 60;
const CLIENT_RENDER_DELAY_MS = 64;

function runLocalPerfSample(durationMs = 2200, stepMs = 1000 / 72) {
  const sim = new GameSim({
    classType: "archer",
    viewportWidth: 960,
    viewportHeight: 640
  });
  const steps = Math.max(1, Math.floor(durationMs / stepMs));
  const timings = [];
  for (let i = 0; i < steps; i++) {
    const t0 = performance.now();
    const phase = i / steps;
    sim.tick(stepMs / 1000, {
      seq: i + 1,
      moveX: Math.cos(phase * Math.PI * 2),
      moveY: Math.sin(phase * Math.PI * 2),
      hasAim: true,
      aimX: sim.player.x + 100,
      aimY: sim.player.y,
      firePrimaryQueued: i % 9 === 0,
      firePrimaryHeld: i % 2 === 0,
      fireAltQueued: false
    });
    timings.push(performance.now() - t0);
  }
  return {
    avgTickMs: mean(timings),
    p95TickMs: percentile(timings, 95)
  };
}

function makeInput(seq, elapsedMs) {
  const t = elapsedMs / 1000;
  const moveX = Math.cos(t * 1.7);
  const moveY = Math.sin(t * 1.3);
  return {
    seq,
    moveX,
    moveY,
    hasAim: true,
    aimX: 500 + Math.cos(t * 2.2) * 120,
    aimY: 320 + Math.sin(t * 1.9) * 120,
    firePrimaryQueued: seq % 6 === 0,
    firePrimaryHeld: seq % 2 === 0,
    fireAltQueued: false
  };
}

function startServer(port) {
  const child = spawn(process.execPath, ["server/networkServer.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let readyResolved = false;
  const readyPromise = new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => {
      if (!readyResolved) rejectReady(new Error("Timed out waiting for network server startup"));
    }, 5000);

    const onData = (buf) => {
      const text = String(buf);
      if (text.includes("Authoritative network server listening")) {
        readyResolved = true;
        clearTimeout(timer);
        resolveReady();
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      if (!readyResolved) {
        clearTimeout(timer);
        rejectReady(new Error(`Network server exited before startup (code ${code})`));
      }
    });
  });

  return { child, readyPromise };
}

async function runNetworkPerfSample(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const snapshotBytes = [];
  const snapshotIntervals = [];
  const corrections = [];
  const snapshotTimes = [];
  const bufferDepthSamples = [];
  const snapshotQueue = [];
  const projectileOriginErrors = [];
  const projectileLastPosById = new Map();
  const projectileState = {
    bullets: new Map(),
    fireArrows: new Map()
  };
  let projectileStateMapSignature = "";

  let seq = 0;
  let inputTimer = null;
  let actionTimer = null;
  let renderTimer = null;
  let startMs = 0;
  let mapMetaMs = 0;
  let firstChunkMs = 0;
  let mapReadyTimeMs = 0;
  let lastSnapshotAt = 0;
  let predictedX = 0;
  let predictedY = 0;
  let knownPlayer = false;
  let frameGapSpikes = 0;
  let snapshotCatchupEvents = 0;
  let clockOffsetMs = 0;
  let clockOffsetReady = false;
  let serverMetrics = null;
  let projectileSnapEvents = 0;
  let localPlayerId = null;
  let projectileOriginSampleCount = 0;

  const send = (type, payload = {}) => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type, ...payload }));
  };

  await new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => rejectReady(new Error("Timed out waiting for perf session completion")), RUN_MS + 6000);

    ws.on("open", () => {
      startMs = Date.now();
      send("join", { roomId: ROOM_ID, name: "PerfBot", classType: "archer", protocolVersion: 2 });
      const everyMs = Math.floor(1000 / INPUT_HZ);
      inputTimer = setInterval(() => {
        const elapsed = Date.now() - startMs;
        seq += 1;
        const input = makeInput(seq, elapsed);
        send("input", { input });
        if (knownPlayer) {
          const dt = everyMs / 1000;
          const len = Math.hypot(input.moveX, input.moveY) || 1;
          const speed = 250;
          predictedX += (input.moveX / len) * speed * dt;
          predictedY += (input.moveY / len) * speed * dt;
        }
      }, everyMs);

      actionTimer = setInterval(() => {
        const elapsed = Date.now() - startMs;
        if (elapsed > 1700 && elapsed < 2400) send("action", { action: { kind: "toggleShop" } });
        if (elapsed > 2600 && elapsed < 3200) send("action", { action: { kind: "closeShop" } });
      }, 220);

      renderTimer = setInterval(() => {
        const estimatedServerNow = estimateServerNow(clockOffsetMs, clockOffsetReady);
        const targetServerTime = Number.isFinite(estimatedServerNow) ? estimatedServerNow - CLIENT_RENDER_DELAY_MS : NaN;
        const targetRecvTime = performance.now() - CLIENT_RENDER_DELAY_MS;
        let chosenIndex = -1;
        for (let i = 0; i < snapshotQueue.length; i++) {
          const pkt = snapshotQueue[i];
          const compareTime = Number.isFinite(targetServerTime) && Number.isFinite(pkt.serverTime) ? pkt.serverTime : pkt.recvTime;
          if (compareTime <= (Number.isFinite(targetServerTime) ? targetServerTime : targetRecvTime)) chosenIndex = i;
          else break;
        }
        if (chosenIndex < 0) {
          bufferDepthSamples.push(snapshotQueue.length);
          return;
        }
        const pkt = snapshotQueue[chosenIndex];
        snapshotQueue.splice(0, chosenIndex + 1);
        bufferDepthSamples.push(snapshotQueue.length);

        const player = pkt?.state?.player;
        if (player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
          if (!knownPlayer) {
            predictedX = player.x;
            predictedY = player.y;
            knownPlayer = true;
          } else {
            const dx = player.x - predictedX;
            const dy = player.y - predictedY;
            corrections.push(Math.hypot(dx, dy));
          }
        }
      }, RENDER_STEP_MS);
    });

    ws.on("message", (raw) => {
      let msg = null;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "hello" && typeof msg.playerId === "string") {
        localPlayerId = msg.playerId;
        return;
      }

      if (msg.type === "state.mapMeta" && !mapMetaMs) {
        mapMetaMs = Date.now();
      }
      if (msg.type === "state.mapChunk" && !firstChunkMs) {
        firstChunkMs = Date.now();
      }
      if (msg.type === "perf.metrics") {
        serverMetrics = msg.metrics || null;
        return;
      }
      if (msg.type !== "state.snapshot") return;
      if (Number.isFinite(msg.snapshotSeq)) {
        send("state.snapshotAck", { snapshotSeq: Math.floor(msg.snapshotSeq) });
      }

      const bytes = Buffer.byteLength(String(raw), "utf8");
      snapshotBytes.push(bytes);
      if (snapshotBytes.length > SNAPSHOT_HISTORY_CAP) snapshotBytes.shift();

      const now = Date.now();
      if (lastSnapshotAt) {
        const gap = now - lastSnapshotAt;
        snapshotIntervals.push(gap);
        if (gap > 55) frameGapSpikes += 1;
      }
      lastSnapshotAt = now;
      if (Number.isFinite(msg.serverTime)) {
        const observedOffset = now - msg.serverTime;
        if (!clockOffsetReady) {
          clockOffsetMs = observedOffset;
          clockOffsetReady = true;
        } else {
          clockOffsetMs += (observedOffset - clockOffsetMs) * 0.12;
        }
        snapshotTimes.push(msg.serverTime);
      }

      snapshotQueue.push({
        recvTime: performance.now(),
        serverTime: Number.isFinite(msg.serverTime) ? msg.serverTime : NaN,
        state: msg.state
      });
      const player = msg?.state?.player;
      const snapshotMapSig = typeof msg?.mapSignature === "string" ? msg.mapSignature : "";
      if (snapshotMapSig && projectileStateMapSignature && snapshotMapSig !== projectileStateMapSignature) {
        projectileState.bullets.clear();
        projectileState.fireArrows.clear();
      }
      if (snapshotMapSig) projectileStateMapSignature = snapshotMapSig;
      updateProjectileStateFromSnapshot(msg?.state, projectileState);
      const allProjectiles = [
        ...Array.from(projectileState.bullets.values(), (p) => ({ kind: "bullet", ...p })),
        ...Array.from(projectileState.fireArrows.values(), (p) => ({ kind: "fireArrow", ...p }))
      ];
      for (const p of allProjectiles) {
        if (!p || typeof p !== "object" || typeof p.id !== "string") continue;
        const prev = projectileLastPosById.get(p.id);
        if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y) && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          const jump = Math.hypot(p.x - prev.x, p.y - prev.y);
          if (jump > 90) projectileSnapEvents += 1;
        }
        const canSampleOrigin =
          !prev &&
          player &&
          Number.isFinite(player.x) &&
          Number.isFinite(player.y) &&
          (!localPlayerId || p.ownerId === localPlayerId || p.ownerId == null);
        if (canSampleOrigin) {
          const rawDirX = Number.isFinite(p.vx)
            ? p.vx
            : Number.isFinite(p.angle)
            ? Math.cos(p.angle)
            : Number.isFinite(player.dirX)
            ? player.dirX
            : 1;
          const rawDirY = Number.isFinite(p.vy)
            ? p.vy
            : Number.isFinite(p.angle)
            ? Math.sin(p.angle)
            : Number.isFinite(player.dirY)
            ? player.dirY
            : 0;
          const dirLen = Math.hypot(rawDirX, rawDirY) || 1;
          const dirX = rawDirX / dirLen;
          const dirY = rawDirY / dirLen;
          const maxLife = p.kind === "fireArrow" ? 1.2 : 1.1;
          const elapsedLife = Number.isFinite(p.life) ? Math.max(0, Math.min(maxLife, maxLife - p.life)) : 0;
          const rewindX = (Number.isFinite(p.x) ? p.x : 0) - (Number.isFinite(p.vx) ? p.vx : 0) * elapsedLife;
          const rewindY = (Number.isFinite(p.y) ? p.y : 0) - (Number.isFinite(p.vy) ? p.vy : 0) * elapsedLife;
          const forwardOffset = p.kind === "fireArrow" ? 22 : 21;
          const perpX = -dirY;
          const perpY = dirX;
          const expectedX = player.x + dirX * forwardOffset + perpX * 0.8;
          const expectedY = player.y - 8 + dirY * forwardOffset + perpY * 0.8;
          projectileOriginErrors.push(Math.hypot(rewindX - expectedX, rewindY - expectedY));
          projectileOriginSampleCount += 1;
        }
        projectileLastPosById.set(p.id, { x: p.x, y: p.y });
      }
      if (snapshotQueue.length > SNAPSHOT_HISTORY_CAP) {
        snapshotQueue.splice(0, snapshotQueue.length - Math.floor(SNAPSHOT_HISTORY_CAP * 0.6));
        snapshotCatchupEvents += 1;
      }
      bufferDepthSamples.push(snapshotQueue.length);
      if (!mapReadyTimeMs && (mapMetaMs || firstChunkMs)) {
        const readyStart = mapMetaMs || firstChunkMs || startMs;
        mapReadyTimeMs = Math.max(0, now - readyStart);
      }

      if (now - startMs >= RUN_MS) {
        clearTimeout(timeout);
        resolveReady();
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      rejectReady(err);
    });
    ws.on("close", () => {
      if (Date.now() - startMs < RUN_MS - 300) {
        clearTimeout(timeout);
        rejectReady(new Error("WebSocket closed before scripted perf flow completed"));
      }
    });
  });

  if (inputTimer) clearInterval(inputTimer);
  if (actionTimer) clearInterval(actionTimer);
  if (renderTimer) clearInterval(renderTimer);

  await new Promise((resolveMetrics) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolveMetrics();
    };
    const timer = setTimeout(done, 900);
    const onMessage = (raw) => {
      let msg = null;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg?.type !== "perf.metrics") return;
      serverMetrics = msg.metrics || null;
      clearTimeout(timer);
      ws.off("message", onMessage);
      done();
    };
    ws.on("message", onMessage);
    send("perf.getMetrics", {});
  });

  try {
    ws.close();
  } catch {
    // no-op
  }

  const serverTickDeltas = [];
  for (let i = 1; i < snapshotTimes.length; i++) {
    const d = snapshotTimes[i] - snapshotTimes[i - 1];
    if (Number.isFinite(d) && d >= 0) serverTickDeltas.push(d);
  }

  return {
    avgTickMs: mean(serverTickDeltas.length ? serverTickDeltas : snapshotIntervals),
    p95TickMs: percentile(serverTickDeltas.length ? serverTickDeltas : snapshotIntervals, 95),
    p95FrameGapMs: percentile(snapshotIntervals, 95),
    snapshotCatchupEvents,
    avgSnapshotBytes: mean(snapshotBytes),
    p95SnapshotBytes: percentile(snapshotBytes, 95),
    avgCorrectionPx: mean(corrections),
    maxCorrectionPx: corrections.length ? Math.max(...corrections) : 0,
    projectileOriginErrorPx_p95: percentile(projectileOriginErrors, 95),
    projectileOriginSampleCount,
    projectileSnapEvents,
    clientJitterMs: stddev(snapshotIntervals),
    clientFrameGapSpikes: frameGapSpikes,
    avgBufferDepth: mean(bufferDepthSamples),
    p95BufferDepth: percentile(bufferDepthSamples, 95),
    mapReadyTimeMs,
    unknownTileCollisionCount: 0,
    serverMetrics: serverMetrics || {
      tickDurationMs: { avg: 0, p95: 0 },
      serializeDurationMs: { avg: 0, p95: 0 },
      snapshotBroadcastDurationMs: { avg: 0, p95: 0 },
      tickScheduleOverrunMs: { avg: 0, p95: 0, count: 0 },
      tickScheduleUnderrunMs: { avg: 0, p95: 0, count: 0 },
      droppedSnapshots: 0,
      snapshotBroadcastCount: 0
    }
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const local = runLocalPerfSample();
  const { child, readyPromise } = startServer(PERF_PORT);

  try {
    await readyPromise;
    const network = await runNetworkPerfSample(PERF_PORT);
    const baseline = readBaseline(BASELINE_PATH);
    const comparison = baseline
      ? {
          avgSnapshotBytes: diffMetric(network.avgSnapshotBytes, baseline.avgSnapshotBytes),
          p95SnapshotBytes: diffMetric(network.p95SnapshotBytes, baseline.p95SnapshotBytes),
          p95FrameGapMs: diffMetric(network.p95FrameGapMs, baseline.p95FrameGapMs),
          avgCorrectionPx: diffMetric(network.avgCorrectionPx, baseline.avgCorrectionPx)
        }
      : null;
    const artifact = {
      meta: {
        startedAt,
        finishedAt: new Date().toISOString(),
        mode: "local+network",
        roomId: ROOM_ID,
        durationMs: RUN_MS,
        baselinePath: BASELINE_PATH,
        hasBaseline: !!baseline
      },
      local,
      ...network,
      comparison
    };

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    console.log(`Perf run complete. Wrote ${OUTPUT_PATH}`);
    console.log(
      `avgTickMs=${artifact.avgTickMs.toFixed(2)} p95TickMs=${artifact.p95TickMs.toFixed(2)} avgSnapshotBytes=${artifact.avgSnapshotBytes.toFixed(2)}`
    );
  } finally {
    if (!child.killed) {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 350);
    }
  }
}

main().catch((err) => {
  console.error("perfRunner failed:", err);
  process.exit(1);
});
