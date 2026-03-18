import { GameSim } from "../../src/sim/GameSim.js";

export class AuthoritativeRoom {
  constructor(id, classType, options) {
    this.id = id;
    this.options = options;
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
    this.currentMusicTrack = this.options.chooseGameplayTrack();
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
    if (!this.controllerId) return this.options.makeDefaultInput();
    const client = this.clients.get(this.controllerId);
    return client ? client.input : this.options.makeDefaultInput();
  }

  tick(nowMs, scheduleDriftMs = 0) {
    this.sim.activePlayerCount = Math.max(1, this.clients.size);
    this.tickDriftSampleCounter += 1;
    if (Number.isFinite(scheduleDriftMs)) {
      if (scheduleDriftMs > this.options.tickDriftEpsilonMs) {
        this.telemetry.tickOverrunCount += 1;
        if (this.tickDriftSampleCounter % 3 === 0) {
          this.options.pushTelemetrySample(this.telemetry.tickScheduleOverrunMs, scheduleDriftMs);
        }
      } else if (scheduleDriftMs < -this.options.tickDriftEpsilonMs) {
        this.telemetry.tickUnderrunCount += 1;
        if (this.tickDriftSampleCounter % 3 === 0) {
          this.options.pushTelemetrySample(this.telemetry.tickScheduleUnderrunMs, -scheduleDriftMs);
        }
      }
    }
    const t0 = this.options.monotonicNowMs();
    const preBulletCount = this.sim.bullets.length;
    const preFireArrowCount = this.sim.fireArrows.length;
    const dt = Math.min((nowMs - this.lastTickMs) / 1000, 0.05);
    this.lastTickMs = nowMs;
    this.sim.tick(dt, this.getControllerInput());
    const controllerClient = this.clients.get(this.controllerId);
    const taggedSeq = controllerClient ? controllerClient.input?.seq || controllerClient.lastInputSeq || 0 : 0;
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
    if (controllerClient) {
      controllerClient.input.firePrimaryQueued = false;
      controllerClient.input.fireAltQueued = false;
    }
    this.options.pushTelemetrySample(this.telemetry.tickDurationsMs, this.options.monotonicNowMs() - t0);
  }

  broadcast(type, payload) {
    const t0 = this.options.monotonicNowMs();
    const msg = JSON.stringify({ type, roomId: this.id, ...payload });
    let dropped = 0;
    for (const client of this.clients.values()) {
      if (client.ws.readyState !== client.ws.OPEN) continue;
      if (type === "state.snapshot" && client.ws.bufferedAmount > this.options.maxWsBufferedBytes) {
        dropped += 1;
        continue;
      }
      client.ws.send(msg);
    }
    const elapsed = this.options.monotonicNowMs() - t0;
    if (type === "state.snapshot") {
      this.telemetry.snapshotBroadcastCount += 1;
      this.telemetry.droppedSnapshots += dropped;
      this.options.pushTelemetrySample(this.telemetry.snapshotBroadcastDurationsMs, elapsed);
    }
    return { elapsedMs: elapsed, dropped };
  }

  broadcastRoster() {
    this.broadcast("room.roster", {
      controllerId: this.controllerId,
      players: Array.from(this.clients.values()).map((client) => ({
        id: client.id,
        name: client.name,
        classType: client.classType
      }))
    });
  }

  sendMapMeta(toClient = null) {
    const payload = {
      mapSignature: this.mapSignature(),
      floor: this.sim.floor,
      mapWidth: this.sim.mapWidth,
      mapHeight: this.sim.mapHeight,
      tileSize: this.sim.config.map.tile,
      armorStands: this.sim.armorStands.map((stand) => ({
        id: this.options.getStableId(this, "armorStand", "as", stand),
        x: stand.x,
        y: stand.y,
        size: stand.size,
        animated: !!stand.animated,
        activated: !!stand.activated
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
    const centerCx = Math.floor(ptx / this.options.mapChunkSize);
    const centerCy = Math.floor(pty / this.options.mapChunkSize);
    const sig = this.mapSignature();

    for (let cy = centerCy - this.options.mapChunkRadius; cy <= centerCy + this.options.mapChunkRadius; cy++) {
      for (let cx = centerCx - this.options.mapChunkRadius; cx <= centerCx + this.options.mapChunkRadius; cx++) {
        if (cx < 0 || cy < 0) continue;
        const key = `${sig}:${cx}:${cy}`;
        if (chunkState.sent.has(key) && nowMs - this.lastChunkPushMs < this.options.mapChunkPushMs) continue;
        const chunk = this.options.buildMapChunkRows(this.sim, cx, cy, this.options.mapChunkSize);
        if (!chunk) continue;
        client.ws.send(
          JSON.stringify({
            type: "state.mapChunk",
            roomId: this.id,
            mapSignature: sig,
            cx,
            cy,
            chunkSize: this.options.mapChunkSize,
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
      this.currentMusicTrack = this.options.chooseGameplayTrack();
      this.snapshotCounter = 0;
      for (const cache of Object.values(this.deltaCache)) cache.clear();
      for (const state of this.clientChunkState.values()) state.sent.clear();
      this.sendMapMeta();
      this.maybeBroadcastMeta(nowMs, true);
    }
    for (const client of this.clients.values()) this.sendMapChunksToClient(client, nowMs);
    const controllerClient = this.clients.get(this.controllerId);
    const serializeStart = this.options.monotonicNowMs();
    const fullState = this.options.serializeState(this);
    this.options.pushTelemetrySample(this.telemetry.serializeDurationsMs, this.options.monotonicNowMs() - serializeStart);
    this.snapshotCounter += 1;
    this.snapshotSeq += 1;
    const cadenceKeyframe = this.snapshotCounter % Math.max(1, this.options.deltaKeyframeEvery) === 1;
    let ackRecoveryKeyframe = false;
    for (const client of this.clients.values()) {
      const ackSeq = Number.isFinite(client.lastSnapshotAckSeq) ? client.lastSnapshotAckSeq : 0;
      if (this.snapshotSeq - ackSeq > this.options.snapshotAckGapForceKeyframe) {
        ackRecoveryKeyframe = true;
        break;
      }
    }
    const keyframe = cadenceKeyframe || ackRecoveryKeyframe;
    const delta = { keyframe };
    const enemyDelta = this.options.buildDeltaCollection(this.deltaCache.enemies, fullState.enemies, keyframe);
    const dropDelta = this.options.buildDeltaCollection(this.deltaCache.drops, fullState.drops, keyframe);
    const breakableDelta = this.options.buildDeltaCollection(this.deltaCache.breakables, fullState.breakables, keyframe);
    const wallTrapDelta = this.options.buildDeltaCollection(this.deltaCache.wallTraps, fullState.wallTraps, keyframe);
    const bulletDelta = this.options.buildDeltaCollection(this.deltaCache.bullets, fullState.bullets, keyframe);
    const fireArrowDelta = this.options.buildDeltaCollection(this.deltaCache.fireArrows, fullState.fireArrows, keyframe);
    const fireZoneDelta = this.options.buildDeltaCollection(this.deltaCache.fireZones, fullState.fireZones, keyframe);
    const meleeSwingDelta = this.options.buildDeltaCollection(this.deltaCache.meleeSwings, fullState.meleeSwings, keyframe);
    const floatingTextDelta = this.options.buildDeltaCollection(this.deltaCache.floatingTexts, fullState.floatingTexts, keyframe);
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
    const meta = this.options.serializeMetaState(this);
    const payloadJson = JSON.stringify(meta);
    const changed = payloadJson !== this.lastMetaPayloadJson;
    if (!force && !changed && nowMs - this.lastMetaBroadcastMs < this.options.metaBroadcastMinMs) return;
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
    const meta = this.options.serializeMetaState(this);
    const payloadJson = JSON.stringify(meta);
    const changed = payloadJson !== this.lastMetaPayloadJson;
    if (force || changed || nowMs - this.lastMetaBroadcastMs >= this.options.metaBroadcastMinMs) {
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
        avg: this.options.average(this.telemetry.tickDurationsMs),
        p95: this.options.percentile(this.telemetry.tickDurationsMs, 95)
      },
      serializeDurationMs: {
        avg: this.options.average(this.telemetry.serializeDurationsMs),
        p95: this.options.percentile(this.telemetry.serializeDurationsMs, 95)
      },
      snapshotBroadcastDurationMs: {
        avg: this.options.average(this.telemetry.snapshotBroadcastDurationsMs),
        p95: this.options.percentile(this.telemetry.snapshotBroadcastDurationsMs, 95)
      },
      tickScheduleOverrunMs: {
        avg: this.options.average(this.telemetry.tickScheduleOverrunMs),
        p95: this.options.percentile(this.telemetry.tickScheduleOverrunMs, 95),
        count: this.telemetry.tickOverrunCount
      },
      tickScheduleUnderrunMs: {
        avg: this.options.average(this.telemetry.tickScheduleUnderrunMs),
        p95: this.options.percentile(this.telemetry.tickScheduleUnderrunMs, 95),
        count: this.telemetry.tickUnderrunCount
      },
      droppedSnapshots: this.telemetry.droppedSnapshots,
      snapshotBroadcastCount: this.telemetry.snapshotBroadcastCount
    };
  }
}
