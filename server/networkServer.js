import { WebSocketServer } from "ws";
import { GameSim } from "../src/sim/GameSim.js";
import { buildDeltaCollection, buildJoinKeyframeState } from "./net/deltaProtocol.js";
import { chooseGameplayTrack } from "./musicCatalog.js";
import { buildMapChunkRows } from "./net/mapChunkStreaming.js";
import { getStableId, serializeMetaState, serializeState } from "./net/stateSerialization.js";
import { average, makeSamplePusher, monotonicNowMs, percentile } from "./net/telemetry.js";
import { handleClientClose, handleClientMessage } from "./net/clientMessageHandler.js";
import { startRoomSchedulers } from "./net/serverScheduler.js";

const PORT = Number.parseInt(process.env.PORT || "8090", 10);
// Higher rates reduce perceived input latency and visual jitter.
const TICK_RATE = Number.parseInt(process.env.TICK_RATE || "72", 10);
const SNAPSHOT_RATE = Number.parseInt(process.env.SNAPSHOT_RATE || "28", 10);
const META_BROADCAST_MIN_MS = Number.parseInt(process.env.META_BROADCAST_MIN_MS || "160", 10);
const MAP_CHUNK_SIZE = Number.parseInt(process.env.MAP_CHUNK_SIZE || "24", 10);
const MAP_CHUNK_RADIUS = Number.parseInt(process.env.MAP_CHUNK_RADIUS || "2", 10);
const MAP_CHUNK_PUSH_MS = Number.parseInt(process.env.MAP_CHUNK_PUSH_MS || "120", 10);
const DELTA_KEYFRAME_EVERY = Number.parseInt(process.env.DELTA_KEYFRAME_EVERY || "30", 10);
const SNAPSHOT_ACK_GAP_FORCE_KEYFRAME = Number.parseInt(process.env.SNAPSHOT_ACK_GAP_FORCE_KEYFRAME || "8", 10);
const MAX_ROOMS = 64;
const MAX_PEERS_PER_ROOM = 8;
const MAX_WS_BUFFERED_BYTES = Number.parseInt(process.env.MAX_WS_BUFFERED_BYTES || "262144", 10);
const MAX_TELEMETRY_SAMPLES = Number.parseInt(process.env.MAX_TELEMETRY_SAMPLES || "4096", 10);
const TICK_DRIFT_EPSILON_MS = Number.parseFloat(process.env.TICK_DRIFT_EPSILON_MS || "0.5");
const MAX_TICKS_PER_LOOP = Number.parseInt(process.env.MAX_TICKS_PER_LOOP || "6", 10);
const MAX_SNAPSHOT_STEPS_PER_LOOP = Number.parseInt(process.env.MAX_SNAPSHOT_STEPS_PER_LOOP || "3", 10);
const pushTelemetrySample = makeSamplePusher(MAX_TELEMETRY_SAMPLES);

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(lo, Math.min(hi, v));
}


function normClassType(value) {
  return value === "fighter" || value === "warrior" ? "fighter" : "archer";
}

function makeDefaultInput() {
  return {
    seq: 0,
    moveX: 0,
    moveY: 0,
    hasAim: false,
    aimX: 0,
    aimY: 0,
    firePrimaryQueued: false,
    firePrimaryHeld: false,
    fireAltQueued: false
  };
}

function sanitizeInput(raw, previous) {
  const next = { ...previous };
  if (raw && typeof raw === "object") {
    next.seq = Number.isFinite(raw.seq) ? Math.max(0, Math.floor(raw.seq)) : next.seq;
    next.moveX = clamp(raw.moveX, -1, 1);
    next.moveY = clamp(raw.moveY, -1, 1);
    next.hasAim = !!raw.hasAim;
    next.aimX = Number.isFinite(raw.aimX) ? raw.aimX : next.aimX;
    next.aimY = Number.isFinite(raw.aimY) ? raw.aimY : next.aimY;
    next.firePrimaryQueued = !!raw.firePrimaryQueued;
    next.firePrimaryHeld = !!raw.firePrimaryHeld;
    next.fireAltQueued = !!raw.fireAltQueued;
  }
  return next;
}

class Room {
  constructor(id, classType) {
    this.id = id;
    this.sim = new GameSim({
      classType,
      viewportWidth: 960,
      viewportHeight: 640
    });
    this.clients = new Map();
    this.controllerId = null;
    this.lastTickMs = Date.now();
    this.lastSnapshotMs = 0;
    this.lastMetaBroadcastMs = 0;
    this.lastMetaPayloadJson = "";
    this.lastChunkPushMs = 0;
    this.lastMapSignature = this.mapSignature();
    this.lastSnapshotFloor = null;
    this.lastSnapshotBossPhase = null;
    this.lastSnapshotDoorOpen = null;
    this.lastSnapshotPickupTaken = null;
    this.lastSnapshotPortalActive = null;
    this.currentMusicTrack = chooseGameplayTrack();
    this.snapshotCounter = 0;
    this.snapshotSeq = 0;
    this.telemetry = {
      tickDurationsMs: [],
      serializeDurationsMs: [],
      snapshotBroadcastDurationsMs: [],
      tickScheduleOverrunMs: [],
      tickScheduleUnderrunMs: [],
      tickOverrunCount: 0,
      tickUnderrunCount: 0,
      droppedSnapshots: 0,
      snapshotBroadcastCount: 0
    };
    this.tickDriftSampleCounter = 0;
    this.clientChunkState = new Map();
    this.deltaCache = {
      enemies: new Map(),
      drops: new Map(),
      breakables: new Map(),
      wallTraps: new Map(),
      bullets: new Map(),
      fireArrows: new Map(),
      fireZones: new Map(),
      meleeSwings: new Map(),
      floatingTexts: new Map()
    };
    this.idCounters = {
      enemy: 1,
      drop: 1,
      bullet: 1,
      fireArrow: 1,
      fireZone: 1,
      meleeSwing: 1,
      armorStand: 1,
      floatingText: 1,
      breakable: 1,
      wallTrap: 1
    };
    this.idMaps = {
      enemy: new WeakMap(),
      drop: new WeakMap(),
      bullet: new WeakMap(),
      fireArrow: new WeakMap(),
      fireZone: new WeakMap(),
      meleeSwing: new WeakMap(),
      armorStand: new WeakMap(),
      floatingText: new WeakMap(),
      breakable: new WeakMap(),
      wallTrap: new WeakMap()
    };
  }

  mapSignature() {
    return `${this.sim.floor}:${this.sim.mapWidth}x${this.sim.mapHeight}`;
  }

  addClient(client) {
    client.lastSnapshotAckSeq = 0;
    this.clients.set(client.id, client);
    this.clientChunkState.set(client.id, { sent: new Set() });
    if (!this.controllerId) this.controllerId = client.id;
  }

  removeClient(clientId) {
    this.clients.delete(clientId);
    this.clientChunkState.delete(clientId);
    if (this.controllerId === clientId) {
      const next = this.clients.keys().next();
      this.controllerId = next.done ? null : next.value;
    }
  }

  isEmpty() {
    return this.clients.size === 0;
  }

  getControllerInput() {
    if (!this.controllerId) return makeDefaultInput();
    const client = this.clients.get(this.controllerId);
    return client ? client.input : makeDefaultInput();
  }

  tick(nowMs, scheduleDriftMs = 0) {
    this.tickDriftSampleCounter += 1;
    if (Number.isFinite(scheduleDriftMs)) {
      if (scheduleDriftMs > TICK_DRIFT_EPSILON_MS) {
        this.telemetry.tickOverrunCount += 1;
        if (this.tickDriftSampleCounter % 3 === 0) {
          pushTelemetrySample(this.telemetry.tickScheduleOverrunMs, scheduleDriftMs);
        }
      } else if (scheduleDriftMs < -TICK_DRIFT_EPSILON_MS) {
        this.telemetry.tickUnderrunCount += 1;
        if (this.tickDriftSampleCounter % 3 === 0) {
          pushTelemetrySample(this.telemetry.tickScheduleUnderrunMs, -scheduleDriftMs);
        }
      }
    }
    const t0 = monotonicNowMs();
    const preBulletCount = this.sim.bullets.length;
    const preFireArrowCount = this.sim.fireArrows.length;
    const dt = Math.min((nowMs - this.lastTickMs) / 1000, 0.05);
    this.lastTickMs = nowMs;
    this.sim.tick(dt, this.getControllerInput());
    const c = this.clients.get(this.controllerId);
    const taggedSeq = c ? c.input?.seq || c.lastInputSeq || 0 : 0;
    const ownerId = this.controllerId || null;
    for (let i = preBulletCount; i < this.sim.bullets.length; i++) {
      const bullet = this.sim.bullets[i];
      if (!bullet || typeof bullet !== "object") continue;
      if (bullet.projectileType === "trapArrow" || bullet.projectileType === "ratArrow") continue;
      bullet.spawnSeq = taggedSeq;
      bullet.ownerId = ownerId;
    }
    for (let i = preFireArrowCount; i < this.sim.fireArrows.length; i++) {
      const fireArrow = this.sim.fireArrows[i];
      if (!fireArrow || typeof fireArrow !== "object") continue;
      fireArrow.spawnSeq = taggedSeq;
      fireArrow.ownerId = ownerId;
    }
    if (c) {
      c.input.firePrimaryQueued = false;
      c.input.fireAltQueued = false;
    }
    pushTelemetrySample(this.telemetry.tickDurationsMs, monotonicNowMs() - t0);
  }

  broadcast(type, payload) {
    const t0 = monotonicNowMs();
    const msg = JSON.stringify({ type, roomId: this.id, ...payload });
    let dropped = 0;
    for (const c of this.clients.values()) {
      if (c.ws.readyState !== c.ws.OPEN) continue;
      if (type === "state.snapshot" && c.ws.bufferedAmount > MAX_WS_BUFFERED_BYTES) {
        dropped += 1;
        continue;
      }
      c.ws.send(msg);
    }
    const elapsed = monotonicNowMs() - t0;
    if (type === "state.snapshot") {
      this.telemetry.snapshotBroadcastCount += 1;
      this.telemetry.droppedSnapshots += dropped;
      pushTelemetrySample(this.telemetry.snapshotBroadcastDurationsMs, elapsed);
    }
    return { elapsedMs: elapsed, dropped };
  }

  broadcastRoster() {
    this.broadcast("room.roster", {
      controllerId: this.controllerId,
      players: Array.from(this.clients.values()).map((c) => ({ id: c.id, name: c.name, classType: c.classType }))
    });
  }

  sendMapMeta(toClient = null) {
    const payload = {
      mapSignature: this.mapSignature(),
      floor: this.sim.floor,
      mapWidth: this.sim.mapWidth,
      mapHeight: this.sim.mapHeight,
      tileSize: this.sim.config.map.tile,
      armorStands: this.sim.armorStands.map((s) => ({
        id: getStableId(this, "armorStand", "as", s),
        x: s.x,
        y: s.y,
        size: s.size,
        animated: !!s.animated,
        activated: !!s.activated
      }))
    };
    if (toClient) {
      if (toClient.ws.readyState === toClient.ws.OPEN) {
        toClient.ws.send(JSON.stringify({ type: "state.mapMeta", roomId: this.id, ...payload }));
      }
      return;
    }
    this.broadcast("state.mapMeta", payload);
  }

  sendMapChunksToClient(client, nowMs = Date.now()) {
    if (!client || client.ws.readyState !== client.ws.OPEN) return;
    const chunkState = this.clientChunkState.get(client.id);
    if (!chunkState) return;
    const tile = this.sim.config.map.tile || 32;
    const ptx = Math.floor((this.sim.player?.x || 0) / tile);
    const pty = Math.floor((this.sim.player?.y || 0) / tile);
    const centerCx = Math.floor(ptx / MAP_CHUNK_SIZE);
    const centerCy = Math.floor(pty / MAP_CHUNK_SIZE);
    const sig = this.mapSignature();

    for (let cy = centerCy - MAP_CHUNK_RADIUS; cy <= centerCy + MAP_CHUNK_RADIUS; cy++) {
      for (let cx = centerCx - MAP_CHUNK_RADIUS; cx <= centerCx + MAP_CHUNK_RADIUS; cx++) {
        if (cx < 0 || cy < 0) continue;
        const key = `${sig}:${cx}:${cy}`;
        if (chunkState.sent.has(key) && nowMs - this.lastChunkPushMs < MAP_CHUNK_PUSH_MS) continue;
        const chunk = buildMapChunkRows(this.sim, cx, cy, MAP_CHUNK_SIZE);
        if (!chunk) continue;
        client.ws.send(
          JSON.stringify({
            type: "state.mapChunk",
            roomId: this.id,
            mapSignature: sig,
            cx,
            cy,
            chunkSize: MAP_CHUNK_SIZE,
            rows: chunk.rows
          })
        );
        chunkState.sent.add(key);
      }
    }
    this.lastChunkPushMs = nowMs;
  }

  maybeBroadcastSnapshot(nowMs) {
    const sig = this.mapSignature();
    if (sig !== this.lastMapSignature) {
      this.lastMapSignature = sig;
      this.lastSnapshotFloor = null;
      this.lastSnapshotBossPhase = null;
      this.lastSnapshotDoorOpen = null;
      this.lastSnapshotPickupTaken = null;
      this.lastSnapshotPortalActive = null;
      this.currentMusicTrack = chooseGameplayTrack();
      this.snapshotCounter = 0;
      for (const cache of Object.values(this.deltaCache)) cache.clear();
      for (const state of this.clientChunkState.values()) state.sent.clear();
      this.sendMapMeta();
      this.maybeBroadcastMeta(nowMs, true);
    }
    for (const client of this.clients.values()) this.sendMapChunksToClient(client, nowMs);
    const controllerClient = this.clients.get(this.controllerId);
    const serializeStart = monotonicNowMs();
    const fullState = serializeState(this);
    pushTelemetrySample(this.telemetry.serializeDurationsMs, monotonicNowMs() - serializeStart);
    this.snapshotCounter += 1;
    this.snapshotSeq += 1;
    const cadenceKeyframe = this.snapshotCounter % Math.max(1, DELTA_KEYFRAME_EVERY) === 1;
    let ackRecoveryKeyframe = false;
    for (const client of this.clients.values()) {
      const ackSeq = Number.isFinite(client.lastSnapshotAckSeq) ? client.lastSnapshotAckSeq : 0;
      if (this.snapshotSeq - ackSeq > SNAPSHOT_ACK_GAP_FORCE_KEYFRAME) {
        ackRecoveryKeyframe = true;
        break;
      }
    }
    const keyframe = cadenceKeyframe || ackRecoveryKeyframe;
    const delta = { keyframe };
    const enemyDelta = buildDeltaCollection(this.deltaCache.enemies, fullState.enemies, keyframe);
    const dropDelta = buildDeltaCollection(this.deltaCache.drops, fullState.drops, keyframe);
    const breakableDelta = buildDeltaCollection(this.deltaCache.breakables, fullState.breakables, keyframe);
    const wallTrapDelta = buildDeltaCollection(this.deltaCache.wallTraps, fullState.wallTraps, keyframe);
    const bulletDelta = buildDeltaCollection(this.deltaCache.bullets, fullState.bullets, keyframe);
    const fireArrowDelta = buildDeltaCollection(this.deltaCache.fireArrows, fullState.fireArrows, keyframe);
    const fireZoneDelta = buildDeltaCollection(this.deltaCache.fireZones, fullState.fireZones, keyframe);
    const meleeSwingDelta = buildDeltaCollection(this.deltaCache.meleeSwings, fullState.meleeSwings, keyframe);
    const floatingTextDelta = buildDeltaCollection(this.deltaCache.floatingTexts, fullState.floatingTexts, keyframe);
    if (keyframe || enemyDelta) delta.enemies = enemyDelta || {};
    if (keyframe || dropDelta) delta.drops = dropDelta || {};
    if (keyframe || breakableDelta) delta.breakables = breakableDelta || {};
    if (keyframe || wallTrapDelta) delta.wallTraps = wallTrapDelta || {};
    if (keyframe || bulletDelta) delta.bullets = bulletDelta || {};
    if (keyframe || fireArrowDelta) delta.fireArrows = fireArrowDelta || {};
    if (keyframe || fireZoneDelta) delta.fireZones = fireZoneDelta || {};
    if (keyframe || meleeSwingDelta) delta.meleeSwings = meleeSwingDelta || {};
    if (keyframe || floatingTextDelta) delta.floatingTexts = floatingTextDelta || {};
    const floorBossPhase = fullState.floorBoss?.phase || null;
    const floorStateChanged = fullState.floor !== this.lastSnapshotFloor;
    const bossPhaseChanged = floorBossPhase !== this.lastSnapshotBossPhase;
    const doorStateChanged = !!fullState.door?.open !== this.lastSnapshotDoorOpen;
    const pickupStateChanged = !!fullState.pickup?.taken !== this.lastSnapshotPickupTaken;
    const portalStateChanged = !!fullState.portal?.active !== this.lastSnapshotPortalActive;
    const state = {
      mapSignature: fullState.mapSignature,
      time: fullState.time,
      player: fullState.player,
      delta
    };
    if (keyframe || floorStateChanged) state.floor = fullState.floor;
    if (keyframe || bossPhaseChanged) state.floorBoss = fullState.floorBoss;
    if (keyframe || doorStateChanged) state.door = fullState.door;
    if (keyframe || pickupStateChanged) state.pickup = fullState.pickup;
    if (keyframe || portalStateChanged) state.portal = fullState.portal;
    this.lastSnapshotFloor = fullState.floor;
    this.lastSnapshotBossPhase = floorBossPhase;
    this.lastSnapshotDoorOpen = !!fullState.door?.open;
    this.lastSnapshotPickupTaken = !!fullState.pickup?.taken;
    this.lastSnapshotPortalActive = !!fullState.portal?.active;
    this.broadcast("state.snapshot", {
      serverTime: nowMs,
      snapshotSeq: this.snapshotSeq,
      controllerId: this.controllerId,
      lastInputSeq: controllerClient ? controllerClient.lastInputSeq : 0,
      mapSignature: sig,
      state
    });
    this.maybeBroadcastMeta(nowMs);
  }

  maybeBroadcastMeta(nowMs, force = false) {
    const meta = serializeMetaState(this);
    const payloadJson = JSON.stringify(meta);
    const changed = payloadJson !== this.lastMetaPayloadJson;
    if (!force && !changed && nowMs - this.lastMetaBroadcastMs < META_BROADCAST_MIN_MS) return;
    this.lastMetaPayloadJson = payloadJson;
    this.lastMetaBroadcastMs = nowMs;
    this.broadcast("state.meta", {
      serverTime: nowMs,
      mapSignature: this.mapSignature(),
      meta
    });
  }

  sendMeta(toClient, nowMs = Date.now(), force = true) {
    if (!toClient || toClient.ws.readyState !== toClient.ws.OPEN) return;
    const meta = serializeMetaState(this);
    const payloadJson = JSON.stringify(meta);
    const changed = payloadJson !== this.lastMetaPayloadJson;
    if (force || changed || nowMs - this.lastMetaBroadcastMs >= META_BROADCAST_MIN_MS) {
      this.lastMetaPayloadJson = payloadJson;
      this.lastMetaBroadcastMs = nowMs;
    }
    toClient.ws.send(
      JSON.stringify({
        type: "state.meta",
        roomId: this.id,
        serverTime: nowMs,
        mapSignature: this.mapSignature(),
        meta
      })
    );
  }

  getTelemetrySnapshot() {
    return {
      tickDurationMs: {
        avg: average(this.telemetry.tickDurationsMs),
        p95: percentile(this.telemetry.tickDurationsMs, 95)
      },
      serializeDurationMs: {
        avg: average(this.telemetry.serializeDurationsMs),
        p95: percentile(this.telemetry.serializeDurationsMs, 95)
      },
      snapshotBroadcastDurationMs: {
        avg: average(this.telemetry.snapshotBroadcastDurationsMs),
        p95: percentile(this.telemetry.snapshotBroadcastDurationsMs, 95)
      },
      tickScheduleOverrunMs: {
        avg: average(this.telemetry.tickScheduleOverrunMs),
        p95: percentile(this.telemetry.tickScheduleOverrunMs, 95),
        count: this.telemetry.tickOverrunCount
      },
      tickScheduleUnderrunMs: {
        avg: average(this.telemetry.tickScheduleUnderrunMs),
        p95: percentile(this.telemetry.tickScheduleUnderrunMs, 95),
        count: this.telemetry.tickUnderrunCount
      },
      droppedSnapshots: this.telemetry.droppedSnapshots,
      snapshotBroadcastCount: this.telemetry.snapshotBroadcastCount
    };
  }
}

const rooms = new Map();

function getOrCreateRoom(roomId, classType) {
  let room = rooms.get(roomId);
  if (!room) {
    if (rooms.size >= MAX_ROOMS) return null;
    room = new Room(roomId, classType);
    rooms.set(roomId, room);
  }
  return room;
}

function safeSend(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

const wss = new WebSocketServer({
  port: PORT,
  // Disabling per-message compression reduces CPU spikes/stalls in local realtime sessions.
  perMessageDeflate: false
});

wss.on("connection", (ws) => {
  if (ws._socket && typeof ws._socket.setNoDelay === "function") {
    ws._socket.setNoDelay(true);
  }
  const client = {
    id: uid("p"),
    ws,
    roomId: null,
    name: "Player",
    classType: "archer",
    protocolVersion: 1,
    input: makeDefaultInput(),
    lastInputSeq: 0
  };

  safeSend(ws, {
    type: "hello",
    playerId: client.id,
    protocol: 2,
    note: "Server authoritative alpha. One active controller per room; others are spectators."
  });

  ws.on("message", (raw) => {
    handleClientMessage(raw, {
      ws,
      client,
      rooms,
      getOrCreateRoom,
      normClassType,
      maxPeersPerRoom: MAX_PEERS_PER_ROOM,
      makeDefaultInput,
      sanitizeInput,
      serializeState,
      buildJoinKeyframeState,
      safeSend
    });
  });

  ws.on("close", () => {
    handleClientClose(client, rooms);
  });
});

startRoomSchedulers({
  rooms,
  tickRate: TICK_RATE,
  snapshotRate: SNAPSHOT_RATE,
  maxTicksPerLoop: MAX_TICKS_PER_LOOP,
  maxSnapshotStepsPerLoop: MAX_SNAPSHOT_STEPS_PER_LOOP,
  monotonicNowMs
});

console.log(`Authoritative network server listening on ws://localhost:${PORT}`);
