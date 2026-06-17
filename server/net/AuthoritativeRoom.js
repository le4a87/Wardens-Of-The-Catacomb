import { GameSim } from "../../src/sim/GameSim.js";
import { getClassDisplayLabel } from "../../src/game/classDisplay.js";
import { tickConsumables } from "../../src/game/world/consumablesEconomy.js";
import { buildAgoraVoiceUid, buildVoiceClientConfig } from "./voiceConfig.js";
import { createRandomActivePlayerStates, placeActivePlayersAtRandomFloorSpawns } from "./floorTransitionHelpers.js";
import {
  getInputQueueDepth,
  getProcessedInputSeq,
  getReceivedInputSeq,
  promoteQueuedClientInput,
  resetClientInputState
} from "./clientInputQueue.js";
import {
  createActivePlayerStateForRoom,
  createPlayerSimulationContextForRoom,
  syncActivePlayerStateFromContextForRoom,
  syncPrimaryActivePlayerFromSimForRoom,
  syncSimPrimaryPlayerStateForRoom
} from "./activePlayerState.js";
import { applyRemoteActionAimToContext, getRemoteActionAimVector } from "./remoteActionAim.js";
import { processRemoteNecromancerBeamForRoom } from "./remoteNecromancerBeam.js";

const PLAYER_COLOR_PALETTE = ["#5bb3ff", "#ff8f6b", "#7ae582", "#f3cf6b", "#c78bff", "#ff6fae"];

export class AuthoritativeRoom {
  constructor(id, classType, options) {
    this.id = id;
    this.options = options;
    this.initialClassType = classType;
    this.sim = new GameSim({
      classType,
      viewportWidth: 960,
      viewportHeight: 640
    });
    this.clients = new Map();
    this.phase = "lobby";
    this.roomOwnerId = null;
    this.pauseOwnerId = null;
    this.lobbyCountdownStartedAt = 0;
    this.lobbyCountdownEndsAt = 0;
    this.lobbyCountdownDurationMs = 5000;
    this.lobbyInlineMessage = "";
    this.requestedStartFloor = 1;
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
    this.serverStateAnomalyEventId = 0;
    this.recentServerStateAnomalies = [];
    this.lastServerStateAnomalySignature = "";
    this.telemetry = {
      tickDurationsMs: [],
      serializeDurationsMs: [],
      snapshotBroadcastDurationsMs: [],
      snapshotPayloadBytes: [],
      snapshotBroadcastGapsMs: [],
      snapshotSendQueueBytes: [],
      mapChunkPushDurationsMs: [],
      tickScheduleOverrunMs: [],
      tickScheduleUnderrunMs: [],
      tickOverrunCount: 0,
      tickUnderrunCount: 0,
      droppedSnapshots: 0,
      snapshotBroadcastCount: 0,
      lastSnapshotTelemetry: null
    };
    this.tickDriftSampleCounter = 0;
    this.clientChunkState = new Map();
    this.activePlayers = new Map();
    this.completedRunPlayers = new Map();
    this.finalResults = null;
    this.deltaCache = {
      enemies: new Map(),
      drops: new Map(),
      treasureChests: new Map(),
      lightSources: new Map(),
      breakables: new Map(),
      wallTraps: new Map(),
      bullets: new Map(),
      fireArrows: new Map(),
      fireZones: new Map(),
      meleeSwings: new Map()
    };
    this.idCounters = {
      enemy: 1,
      drop: 1,
      treasureChest: 1,
      bullet: 1,
      fireArrow: 1,
      fireZone: 1,
      meleeSwing: 1,
      armorStand: 1,
      lightSource: 1,
      breakable: 1,
      wallTrap: 1
    };
    this.idMaps = {
      enemy: new WeakMap(),
      drop: new WeakMap(),
      treasureChest: new WeakMap(),
      bullet: new WeakMap(),
      fireArrow: new WeakMap(),
      fireZone: new WeakMap(),
      meleeSwing: new WeakMap(),
      armorStand: new WeakMap(),
      lightSource: new WeakMap(),
      breakable: new WeakMap(),
      wallTrap: new WeakMap()
    };
  }

  get controllerId() {
    return this.pauseOwnerId;
  }

  set controllerId(value) {
    this.pauseOwnerId = typeof value === "string" && value ? value : null;
  }

  getVoiceRoomConfig(playerId = "") {
    if (!this.voiceConfig || !this.voiceConfig.enabled) return { enabled: false };
    const channel =
      typeof this.voiceConfig.channel === "string" && this.voiceConfig.channel
        ? this.voiceConfig.channel
        : `wardens-${this.id}`;
    return buildVoiceClientConfig({ ...this.voiceConfig, channel }, playerId);
  }

  getVoiceUid(playerId) {
    return buildAgoraVoiceUid(playerId);
  }

  mapSignature() {
    return typeof this.sim.getMapSignature === "function"
      ? this.sim.getMapSignature()
      : `${this.sim.biomeKey}:${this.sim.floor}:${this.sim.mapWidth}x${this.sim.mapHeight}`;
  }

  createFreshSim(classType = this.initialClassType) {
    return new GameSim({
      classType,
      viewportWidth: 960,
      viewportHeight: 640
    });
  }

  getNextAvailableColorIndex() {
    const used = new Set();
    for (const client of this.clients.values()) {
      if (Number.isFinite(client.colorIndex)) used.add(client.colorIndex);
    }
    for (let i = 0; i < PLAYER_COLOR_PALETTE.length; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }

  getClientRunColor(client) {
    if (!client) return PLAYER_COLOR_PALETTE[0];
    const index = Number.isFinite(client.colorIndex) ? Math.max(0, Math.floor(client.colorIndex)) : 0;
    return PLAYER_COLOR_PALETTE[index % PLAYER_COLOR_PALETTE.length];
  }

  getRosterEntry(client) {
    return {
      id: client.id,
      voiceUid: buildAgoraVoiceUid(client.id),
      handle: client.name,
      name: client.name,
      classType: client.classType,
      locked: !!client.classLocked,
      ready: !!client.classLocked,
      colorIndex: Number.isFinite(client.colorIndex) ? client.colorIndex : 0,
      color: this.getClientRunColor(client),
      isOwner: client.id === this.roomOwnerId,
      isPauseOwner: client.id === this.pauseOwnerId
    };
  }

  getRosterEntries() {
    return Array.from(this.clients.values()).map((client) => this.getRosterEntry(client));
  }

  getClassSpec(classType) {
    return this.sim.config?.classes?.[classType] || this.sim.config?.classes?.archer || {};
  }

  createActivePlayerState(client, spawn = null) {
    return createActivePlayerStateForRoom(this, client, spawn);
  }

  buildRunParticipantRecord(client, state = null, outcome = "Dead") {
    const source = state || null;
    const primaryClient = client && client.id === this.pauseOwnerId ? client : null;
    const primaryState = primaryClient ? this.syncPrimaryActivePlayerFromSim() : null;
    const resolved = primaryState && client?.id === primaryState.id ? primaryState : source;
    const classType = resolved?.classType || client?.classType || this.sim.player?.classType || "archer";
    const classLabel = getClassDisplayLabel({ classType, ...resolved });
    return {
      id: client?.id || resolved?.id || "",
      handle: client?.name || resolved?.handle || "Player",
      classType,
      classLabel,
      color: client ? this.getClientRunColor(client) : (resolved?.color || PLAYER_COLOR_PALETTE[0]),
      level: Number.isFinite(resolved?.level) ? resolved.level : 1,
      kills: Number.isFinite(resolved?.kills) ? resolved.kills : 0,
      damageDealt: Math.round(Number.isFinite(resolved?.damageDealt) ? resolved.damageDealt : 0),
      outcome
    };
  }

  recordCompletedRunPlayer(client, state = null, outcome = "Disconnected") {
    if (!client?.id) return null;
    const record = this.buildRunParticipantRecord(client, state, outcome);
    this.completedRunPlayers.set(client.id, record);
    return record;
  }

  buildFinalResults() {
    const roster = [];
    const seen = new Set();
    for (const client of this.clients.values()) {
      const state = client.id === this.pauseOwnerId ? this.syncPrimaryActivePlayerFromSim() : this.activePlayers.get(client.id);
      const outcome = Number.isFinite(state?.health) && state.health > 0 ? "Alive" : "Dead";
      const record = this.buildRunParticipantRecord(client, state, outcome);
      roster.push(record);
      seen.add(client.id);
    }
    for (const [id, record] of this.completedRunPlayers.entries()) {
      if (seen.has(id)) continue;
      roster.push({ ...record });
    }
    return {
      teamOutcome: "Defeat",
      totalParticipants: roster.length,
      players: roster
    };
  }

  initializeActivePlayers() {
    createRandomActivePlayerStates(this);
  }

  syncSimPrimaryPlayerState() {
    return syncSimPrimaryPlayerStateForRoom(this);
  }

  syncPrimaryActivePlayerFromSim() {
    return syncPrimaryActivePlayerFromSimForRoom(this);
  }

  createPlayerSimulationContext(state) {
    return createPlayerSimulationContextForRoom(this, state);
  }

  syncActivePlayerStateFromContext(state, context) {
    syncActivePlayerStateFromContextForRoom(state, context);
  }

  trimServerStateAnomalies(limit = 48) {
    if (this.recentServerStateAnomalies.length > limit) {
      this.recentServerStateAnomalies.splice(0, this.recentServerStateAnomalies.length - limit);
    }
  }

  getPlayerAuditRecords() {
    const records = [];
    const pushRecord = (source, player) => {
      if (!player) return;
      const id = typeof player.id === "string" ? player.id : "";
      const client = id ? this.clients.get(id) : null;
      records.push({
        source,
        id,
        classType: typeof player.classType === "string" ? player.classType : "",
        clientClassType: typeof client?.classType === "string" ? client.classType : "",
        health: Number.isFinite(player.health) ? player.health : null,
        alive: player.alive !== false && (!Number.isFinite(player.health) || player.health > 0),
        mimicTimer: Number.isFinite(player.necromancerRuntime?.mimicTimer) ? player.necromancerRuntime.mimicTimer : 0,
        mimicHealth: Number.isFinite(player.necromancerRuntime?.mimicHealth) ? player.necromancerRuntime.mimicHealth : 0
      });
    };
    pushRecord("simPrimary", this.sim.player);
    for (const state of this.activePlayers.values()) pushRecord("activePlayer", state);
    return records;
  }

  collectServerStateAudit() {
    const tripleStatusEnemies = [];
    for (const enemy of Array.isArray(this.sim.enemies) ? this.sim.enemies : []) {
      if (!enemy || (enemy.hp || 0) <= 0) continue;
      const burningTimer = Number.isFinite(enemy.burningTimer) ? enemy.burningTimer : 0;
      const curseTimer = Number.isFinite(enemy.curseTimer) ? enemy.curseTimer : 0;
      const rotTimer = Number.isFinite(enemy.rotTimer) ? enemy.rotTimer : 0;
      if (!(burningTimer > 0 && curseTimer > 0 && rotTimer > 0)) continue;
      tripleStatusEnemies.push({
        id: this.options.getStableId(this, "enemy", "e", enemy),
        type: typeof enemy.type === "string" ? enemy.type : "",
        hp: Number.isFinite(enemy.hp) ? enemy.hp : null,
        maxHp: Number.isFinite(enemy.maxHp) ? enemy.maxHp : null,
        burningTimer,
        curseTimer,
        rotTimer,
        burningDps: Number.isFinite(enemy.burningDps) ? enemy.burningDps : 0,
        rotDps: Number.isFinite(enemy.rotDps) ? enemy.rotDps : 0
      });
    }

    const players = this.getPlayerAuditRecords();
    const mimicPlayers = players.filter((player) => player.mimicTimer > 0 || player.mimicHealth > 0);
    const classMismatches = players.filter((player) =>
      player.id &&
      player.clientClassType &&
      player.classType &&
      player.classType !== player.clientClassType
    );
    const parts = [];
    if (tripleStatusEnemies.length >= 3) {
      parts.push(`enemyStatusFanout:${tripleStatusEnemies.map((enemy) => enemy.id).join(",")}`);
    }
    if (mimicPlayers.length > 0) {
      parts.push(`playerMimicRuntimeVisible:${mimicPlayers.map((player) => `${player.source}:${player.id}:${Math.round(player.mimicTimer * 10)}`).join(",")}`);
    }
    if (classMismatches.length > 0) {
      parts.push(`playerClassMismatch:${classMismatches.map((player) => `${player.source}:${player.id}:${player.classType}->${player.clientClassType}`).join(",")}`);
    }
    return {
      signature: parts.join("|"),
      tripleStatusEnemies,
      mimicPlayers,
      classMismatches
    };
  }

  recordServerStateAnomaly(kind, details = {}) {
    this.serverStateAnomalyEventId += 1;
    const event = {
      id: this.serverStateAnomalyEventId,
      atMs: Date.now(),
      snapshotSeq: this.snapshotSeq,
      phase: this.phase,
      paused: !!this.sim.paused,
      kind,
      controllerId: this.pauseOwnerId || null,
      lastInputSeqByPlayer: this.getLastInputSeqByPlayer(),
      inputQueueDepthByPlayer: this.getInputQueueDepthByPlayer(),
      ...details
    };
    this.recentServerStateAnomalies.push(event);
    this.trimServerStateAnomalies();
    return event;
  }

  auditServerState(context = {}) {
    const audit = this.collectServerStateAudit();
    if (!audit.signature || audit.signature === this.lastServerStateAnomalySignature) return null;
    this.lastServerStateAnomalySignature = audit.signature;
    const kind = audit.tripleStatusEnemies.length >= 3
      ? "enemyStatusFanout"
      : audit.mimicPlayers.length > 0
      ? "playerMimicRuntimeVisible"
      : "playerClassMismatch";
    return this.recordServerStateAnomaly(kind, {
      context,
      signature: audit.signature,
      enemyCount: Array.isArray(this.sim.enemies) ? this.sim.enemies.length : 0,
      tripleStatusCount: audit.tripleStatusEnemies.length,
      tripleStatusEnemies: audit.tripleStatusEnemies.slice(0, 8),
      mimicPlayers: audit.mimicPlayers.slice(0, 8),
      classMismatches: audit.classMismatches.slice(0, 8)
    });
  }

  clearQueuedCombatInputFlags(clients = this.clients.values()) {
    for (const client of clients) {
      if (!client?.input) continue;
      client.input.swapAttackQueued = false;
      client.input.firePrimaryQueued = false;
      client.input.fireAltQueued = false;
      client.input.modeSwapQueued = false;
    }
  }

  beamHasLineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) return true;
    const tile = this.sim.config?.map?.tile || 32;
    const step = Math.max(8, tile * 0.35);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x0 + dx * t;
      const sy = y0 + dy * t;
      if (this.sim.isWallAt(sx, sy, false)) return false;
    }
    return true;
  }

  getAimLineDistance(state, input, target, aimLen = 1) {
    return Math.abs(
      (input.aimY - state.y) * target.x -
      (input.aimX - state.x) * target.y +
      input.aimX * state.y -
      input.aimY * state.x
    ) / Math.max(1, aimLen);
  }

  processRemoteNecromancerBeam(state, input, dt) {
    return processRemoteNecromancerBeamForRoom(this, state, input, dt);
  }

  tagNewProjectilesForPlayer(beforeCounts, ownerId, spawnSeq = 0) {
    const bulletStart = Number.isFinite(beforeCounts?.bullets) ? beforeCounts.bullets : this.sim.bullets.length;
    const fireArrowStart = Number.isFinite(beforeCounts?.fireArrows) ? beforeCounts.fireArrows : this.sim.fireArrows.length;
    const meleeStart = Number.isFinite(beforeCounts?.meleeSwings) ? beforeCounts.meleeSwings : this.sim.meleeSwings.length;
    for (let i = bulletStart; i < this.sim.bullets.length; i++) {
      const bullet = this.sim.bullets[i];
      if (!bullet || typeof bullet !== "object") continue;
      bullet.spawnSeq = spawnSeq;
      bullet.ownerId = ownerId;
    }
    for (let i = fireArrowStart; i < this.sim.fireArrows.length; i++) {
      const arrow = this.sim.fireArrows[i];
      if (!arrow || typeof arrow !== "object") continue;
      arrow.spawnSeq = spawnSeq;
      arrow.ownerId = ownerId;
    }
    for (let i = meleeStart; i < this.sim.meleeSwings.length; i++) {
      const swing = this.sim.meleeSwings[i];
      if (!swing || typeof swing !== "object") continue;
      swing.ownerId = ownerId;
    }
  }

  performActionForActivePlayer(clientId, fn, input = null) {
    if (!clientId || typeof fn !== "function") return false;
    const state = this.activePlayers.get(clientId);
    if (!state || state.alive === false || (state.health || 0) <= 0) return false;
    const context = this.createPlayerSimulationContext(state);
    if (!context) return false;
    applyRemoteActionAimToContext(context, state, input);
    const beforeCounts = {
      bullets: this.sim.bullets.length,
      fireArrows: this.sim.fireArrows.length,
      meleeSwings: this.sim.meleeSwings.length
    };
    const beforeX = Number.isFinite(context.player?.x) ? context.player.x : null;
    const beforeY = Number.isFinite(context.player?.y) ? context.player.y : null;
    const result = fn(context, state);
    this.syncActivePlayerStateFromContext(state, context);
    const afterX = Number.isFinite(state.x) ? state.x : null;
    const afterY = Number.isFinite(state.y) ? state.y : null;
    if (input?.fireAltQueued && beforeX !== null && beforeY !== null && afterX !== null && afterY !== null) {
      const movedPx = Math.hypot(afterX - beforeX, afterY - beforeY);
      if (movedPx >= 48) state.teleportSeq = getProcessedInputSeq(this.clients.get(clientId));
    }
    this.tagNewProjectilesForPlayer(beforeCounts, clientId, getProcessedInputSeq(this.clients.get(clientId)));
    this.auditServerState({
      source: "activePlayerAction",
      playerId: clientId,
      classType: state.classType,
      processedInputSeq: getProcessedInputSeq(this.clients.get(clientId))
    });
    return result;
  }

  tickRemoteActivePlayerConsumables(state, dt) {
    if (!state || state.alive === false || (state.health || 0) <= 0 || dt <= 0) return;
    const context = this.createPlayerSimulationContext(state);
    if (!context) return;
    tickConsumables(context, dt);
    if (Number.isFinite(context.nextFloatingTextId)) {
      this.sim.nextFloatingTextId = Math.max(this.sim.nextFloatingTextId || 0, context.nextFloatingTextId);
    }
    this.syncActivePlayerStateFromContext(state, context);
  }

  getSimulationPlayerEntities() {
    this.syncSimPrimaryPlayerState();
    const primary = this.syncPrimaryActivePlayerFromSim();
    if (primary) {
      this.sim.player.id = primary.id;
      this.sim.player.handle = primary.handle;
      this.sim.player.classType = primary.classType;
      this.sim.player.color = primary.color;
      this.sim.player.alive = primary.alive;
    }
    const out = [];
    for (const client of this.clients.values()) {
      if (client.id === this.pauseOwnerId) out.push(this.sim.player);
      else {
        const state = this.activePlayers.get(client.id);
        if (state) out.push(state);
      }
    }
    return out;
  }

  updateRemoteActivePlayers(dt) {
    for (const client of this.clients.values()) {
      if (!client || client.id === this.pauseOwnerId) continue;
      const state = this.activePlayers.get(client.id);
      if (!state) continue;
      const input = client.input || this.options.makeDefaultInput();
      const alive = state.alive !== false && (state.health || 0) > 0;
      if (!alive) {
        state.moving = false;
        state.spectateTargetId = typeof input.spectateTargetId === "string" ? input.spectateTargetId : "";
        input.moveX = 0;
        input.moveY = 0;
        input.swapAttackQueued = false;
        input.firePrimaryQueued = false;
        input.firePrimaryHeld = false;
        input.fireAltQueued = false;
        input.modeSwapQueued = false;
        continue;
      }
      this.tickRemoteActivePlayerConsumables(state, dt);
      const mx = Number.isFinite(input.moveX) ? input.moveX : 0;
      const my = Number.isFinite(input.moveY) ? input.moveY : 0;
      if (mx || my) {
        const len = Math.hypot(mx, my) || 1;
        this.sim.moveWithCollisionSubsteps(state, (mx / len) * state.speed * dt, (my / len) * state.speed * dt);
      }
      state.moving = !!(mx || my);
      state.spectateTargetId = "";
      if (input.hasAim) {
        if (Number.isFinite(input.aimDirX) && Number.isFinite(input.aimDirY)) {
          const alen = Math.hypot(input.aimDirX, input.aimDirY) || 1;
          state.dirX = input.aimDirX / alen;
          state.dirY = input.aimDirY / alen;
        } else if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) {
          const ax = input.aimX - state.x;
          const ay = input.aimY - state.y;
          const alen = Math.hypot(ax, ay) || 1;
          state.dirX = ax / alen;
          state.dirY = ay / alen;
        }
        const angle = Math.atan2(state.dirY || 0, state.dirX || 1);
        state.facing = Math.max(0, Math.min(7, Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8));
      }
      state.handle = client.name;
      state.classType = client.classType;
      state.color = this.getClientRunColor(client);
      this.applyRemotePlayerCombat(client, state, input, dt);
      input.swapAttackQueued = false;
      input.firePrimaryQueued = false;
      input.fireAltQueued = false;
      input.modeSwapQueued = false;
    }
  }

  applyRemotePlayerCombat(client, state, input, dt) {
    if (!client || !state || !input || state.alive === false || (state.health || 0) <= 0) return;
    if (input.swapAttackQueued && state.classType === "fighter") {
      this.performActionForActivePlayer(client.id, (context) => {
        if (typeof context.toggleWarriorAttackMode !== "function") return false;
        return context.toggleWarriorAttackMode();
      });
    }
    if (state.classType === "archer" && input.modeSwapQueued) {
      this.performActionForActivePlayer(client.id, (context) => {
        if (typeof context.switchRangerWeaponMode !== "function") return false;
        context.switchRangerWeaponMode();
        return true;
      });
    }
    if (state.classType === "necromancer" && input.modeSwapQueued) {
      this.performActionForActivePlayer(client.id, (context) => {
        if (typeof context.toggleMageMode !== "function") return false;
        return context.toggleMageMode();
      });
    }
    const wantsPrimary = !!input.firePrimaryQueued || (!!input.firePrimaryHeld && !!input.hasAim);
    if (state.classType === "necromancer") {
      const cantrip = state.necromancerTalents
        ? Object.entries(state.necromancerTalents).find(([key, node]) => key.endsWith("Cantrip") && (node?.points || 0) > 0)?.[0]
        : null;
      const mode = state.necromancerRuntime?.activeMode === "spell" ? "spell" : "cantrip";
      if (mode === "cantrip" && cantrip === "necroticBeamCantrip") this.processRemoteNecromancerBeam(state, input, dt);
      else if (wantsPrimary) {
        const aim = getRemoteActionAimVector(state, input);
        this.performActionForActivePlayer(client.id, (context) => {
          return typeof context.fire === "function" && (context.fire(aim.dx, aim.dy), true);
        }, input);
      }
    } else if (wantsPrimary) {
      const aim = getRemoteActionAimVector(state, input);
      this.performActionForActivePlayer(client.id, (context) => {
        return typeof context.fire === "function" && (context.fire(aim.dx, aim.dy), true);
      }, input);
    }
    if (!input.fireAltQueued) return;
    if (state.classType === "archer") {
      const aim = getRemoteActionAimVector(state, input);
      this.performActionForActivePlayer(client.id, (context) => {
        return typeof context.fireFireArrow === "function" && (context.fireFireArrow(aim.dx, aim.dy), true);
      }, input);
      return;
    }
    if (state.classType === "fighter") {
      this.performActionForActivePlayer(client.id, (context) => {
        if (typeof context.activateWarriorRage !== "function") return false;
        return context.activateWarriorRage();
      });
      return;
    }
    if (state.classType === "necromancer") {
      const aim = getRemoteActionAimVector(state, input);
      this.performActionForActivePlayer(client.id, (context) => {
        return typeof context.activateMageClassSkill === "function" && context.activateMageClassSkill(aim.dx, aim.dy);
      }, input);
    }
  }

  getActivePlayerStates() {
    return Array.from(this.activePlayers.values());
  }

  getLivingActivePlayerStates() {
    return this.getActivePlayerStates().filter((state) =>
      state &&
      state.alive !== false &&
      (Number.isFinite(state.health) ? state.health > 0 : true) &&
      this.clients.has(state.id)
    );
  }

  transferPauseOwnerToLivingPlayer(nowMs = Date.now()) {
    const next = this.getLivingActivePlayerStates().find((state) => state.id !== this.pauseOwnerId)
      || this.getLivingActivePlayerStates()[0]
      || null;
    if (!next?.id || next.id === this.pauseOwnerId) return false;
    this.pauseOwnerId = next.id;
    this.sim.gameOver = false;
    this.sim.gameOverTitle = "GAME OVER";
    this.sim.paused = false;
    this.finalResults = null;
    this.syncSimPrimaryPlayerState();
    this.broadcastRoster();
    this.maybeBroadcastMeta(nowMs, true);
    return true;
  }

  getLastInputSeqByPlayer() {
    const out = {};
    for (const client of this.clients.values()) {
      out[client.id] = getProcessedInputSeq(client);
    }
    return out;
  }

  getLastReceivedInputSeqByPlayer() {
    const out = {};
    for (const client of this.clients.values()) {
      out[client.id] = getReceivedInputSeq(client);
    }
    return out;
  }

  getLastActionSeqByPlayer() {
    const out = {};
    for (const client of this.clients.values()) {
      out[client.id] = Number.isFinite(client.lastActionSeq) ? Math.max(0, Math.floor(client.lastActionSeq)) : 0;
    }
    return out;
  }

  getInputQueueDepthByPlayer() {
    const out = {};
    for (const client of this.clients.values()) {
      out[client.id] = getInputQueueDepth(client);
    }
    return out;
  }

  getLobbyCountdownRemainingMs(nowMs = Date.now()) {
    if (!(this.phase === "lobby" && this.lobbyCountdownEndsAt > 0)) return 0;
    return Math.max(0, this.lobbyCountdownEndsAt - nowMs);
  }

  setLobbyInlineMessage(text = "") {
    this.lobbyInlineMessage = typeof text === "string" ? text : "";
  }

  areAllClientsLocked() {
    if (this.clients.size <= 0) return false;
    for (const client of this.clients.values()) {
      if (!client.classLocked) return false;
    }
    return true;
  }

  cancelLobbyCountdown(message = "") {
    const hadCountdown = this.lobbyCountdownEndsAt > 0;
    this.lobbyCountdownStartedAt = 0;
    this.lobbyCountdownEndsAt = 0;
    if (message) this.setLobbyInlineMessage(message);
    return hadCountdown;
  }

  maybeStartLobbyCountdown(nowMs = Date.now(), message = "") {
    if (this.phase !== "lobby") return false;
    if (!this.areAllClientsLocked()) return false;
    this.lobbyCountdownStartedAt = nowMs;
    this.lobbyCountdownEndsAt = nowMs + this.lobbyCountdownDurationMs;
    if (message) this.setLobbyInlineMessage(message);
    return true;
  }

  refreshLobbyState(nowMs = Date.now(), reasonMessage = "") {
    if (this.phase !== "lobby") return false;
    const everyoneLocked = this.areAllClientsLocked();
    let changed = false;
    if (!everyoneLocked) {
      if (this.cancelLobbyCountdown(reasonMessage)) changed = true;
      else if (reasonMessage) {
        this.setLobbyInlineMessage(reasonMessage);
        changed = true;
      }
      return changed;
    }
    if (this.lobbyCountdownEndsAt <= 0) {
      this.maybeStartLobbyCountdown(nowMs, reasonMessage);
      changed = true;
    } else if (reasonMessage) {
      this.setLobbyInlineMessage(reasonMessage);
      changed = true;
    }
    return changed;
  }

  startRun(nowMs = Date.now()) {
    if (this.phase === "active") return false;
    if (this.requestedStartFloor > 1 && typeof this.sim.applyDebugStartingFloor === "function") {
      this.sim.applyDebugStartingFloor(this.requestedStartFloor);
    }
    for (const client of this.clients.values()) resetClientInputState(client, this.options.makeDefaultInput);
    this.initializeActivePlayers();
    this.completedRunPlayers.clear();
    this.finalResults = null;
    this.phase = "active";
    this.setLobbyInlineMessage("");
    this.lobbyCountdownStartedAt = 0;
    this.lobbyCountdownEndsAt = 0;
    this.lastTickMs = nowMs;
    this.broadcast("room.started", {
      phase: this.phase,
      ownerId: this.roomOwnerId,
      pauseOwnerId: this.pauseOwnerId,
      controllerId: this.pauseOwnerId
    });
    this.sendMapState();
    this.maybeBroadcastMeta(nowMs, true);
    return true;
  }

  resetToLobby(nowMs = Date.now()) {
    const nextClassType = this.roomOwnerId && this.clients.get(this.roomOwnerId)?.classType
      ? this.clients.get(this.roomOwnerId).classType
      : this.initialClassType;
    this.sim = this.createFreshSim(nextClassType);
    this.phase = "lobby";
    this.activePlayers.clear();
    this.completedRunPlayers.clear();
    this.finalResults = null;
    this.lobbyCountdownStartedAt = 0;
    this.lobbyCountdownEndsAt = 0;
    this.setLobbyInlineMessage("");
    this.lastTickMs = nowMs;
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
    this.snapshotCounter = 0;
    this.snapshotSeq = 0;
    this.serverStateAnomalyEventId = 0;
    this.recentServerStateAnomalies = [];
    this.lastServerStateAnomalySignature = "";
    this.deltaCache = {
      enemies: new Map(),
      drops: new Map(),
      treasureChests: new Map(),
      lightSources: new Map(),
      breakables: new Map(),
      wallTraps: new Map(),
      bullets: new Map(),
      fireArrows: new Map(),
      fireZones: new Map(),
      meleeSwings: new Map()
    };
    this.idCounters = {
      enemy: 1,
      drop: 1,
      treasureChest: 1,
      bullet: 1,
      fireArrow: 1,
      fireZone: 1,
      meleeSwing: 1,
      armorStand: 1,
      lightSource: 1,
      breakable: 1,
      wallTrap: 1
    };
    this.idMaps = {
      enemy: new WeakMap(),
      drop: new WeakMap(),
      treasureChest: new WeakMap(),
      bullet: new WeakMap(),
      fireArrow: new WeakMap(),
      fireZone: new WeakMap(),
      meleeSwing: new WeakMap(),
      armorStand: new WeakMap(),
      lightSource: new WeakMap(),
      breakable: new WeakMap(),
      wallTrap: new WeakMap()
    };
    for (const client of this.clients.values()) {
      resetClientInputState(client, this.options.makeDefaultInput);
      client.lastSnapshotAckSeq = 0;
      client.classLocked = false;
    }
    for (const state of this.clientChunkState.values()) {
      if (state?.sent instanceof Set) state.sent.clear();
    }
    this.refreshLobbyState(nowMs);
    this.broadcastRoster();
    this.maybeBroadcastMeta(nowMs, true);
    return true;
  }

  addClient(client) {
    if (typeof this.sim.ensurePlayerSafePosition === "function") this.sim.ensurePlayerSafePosition(12);
    client.lastSnapshotAckSeq = 0;
    client.classLocked = !!client.classLocked;
    client.colorIndex = Number.isFinite(client.colorIndex) ? client.colorIndex : this.getNextAvailableColorIndex();
    this.clients.set(client.id, client);
    this.clientChunkState.set(client.id, { sent: new Set() });
    if (!this.roomOwnerId) this.roomOwnerId = client.id;
    if (!this.pauseOwnerId) this.pauseOwnerId = client.id;
    if (this.phase === "active") this.activePlayers.set(client.id, this.createActivePlayerState(client, this.sim.player));
    if (this.phase === "active" && this.sim.gameOver && this.getLivingActivePlayerStates().length > 0) {
      this.transferPauseOwnerToLivingPlayer(Date.now());
    }
    if (this.phase === "lobby") this.refreshLobbyState(Date.now());
  }

  removeClient(clientId) {
    const removedClient = this.clients.get(clientId);
    const removedState =
      removedClient?.id && removedClient.id === this.pauseOwnerId
        ? this.syncPrimaryActivePlayerFromSim()
        : this.activePlayers.get(clientId) || null;
    const previousOwnerId = this.roomOwnerId;
    this.clients.delete(clientId);
    this.clientChunkState.delete(clientId);
    if (this.roomOwnerId === clientId) {
      const next = this.clients.keys().next();
      this.roomOwnerId = next.done ? null : next.value;
    }
    if (this.pauseOwnerId === clientId) {
      const next = this.clients.keys().next();
      this.pauseOwnerId = next.done ? null : next.value;
    }
    if (this.phase === "active" && this.pauseOwnerId) this.syncSimPrimaryPlayerState();
    if (this.phase === "lobby") {
      const handle = removedClient?.name || "A player";
      const ownerTransferred = previousOwnerId === clientId && this.roomOwnerId;
      let message = `${handle} left. Countdown restarted.`;
      if (ownerTransferred) {
        const nextOwner = this.clients.get(this.roomOwnerId);
        if (nextOwner?.name) message = `${handle} left. ${nextOwner.name} is now the room owner.`;
      }
      this.cancelLobbyCountdown(message);
      this.refreshLobbyState(Date.now(), message);
    }
    if (this.phase === "active" && removedClient) {
      this.recordCompletedRunPlayer(removedClient, removedState, "Disconnected");
      this.finalResults = null;
      if (this.clients.size <= 0) {
        this.sim.gameOver = true;
        this.finalResults = this.buildFinalResults();
      }
    }
    this.activePlayers.delete(clientId);
  }

  isEmpty() {
    return this.clients.size === 0;
  }

  getControllerInput() {
    if (!this.pauseOwnerId) return this.options.makeDefaultInput();
    const client = this.clients.get(this.pauseOwnerId);
    if (!client) return this.options.makeDefaultInput();
    if ((this.sim.player?.health || 0) <= 0) return this.options.makeDefaultInput();
    return client.input;
  }

  promoteQueuedClientInputs() {
    for (const client of this.clients.values()) promoteQueuedClientInput(client);
  }

  updateClientLobbyState(clientId, { classType, locked } = {}) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    let changed = false;
    const wasLocked = !!client.classLocked;
    if (typeof classType === "string" && classType && client.classType !== classType) {
      client.classType = classType;
      changed = true;
    }
    if (typeof locked === "boolean" && client.classLocked !== locked) {
      client.classLocked = locked;
      changed = true;
    }
    if (changed && this.phase === "lobby") {
      if (wasLocked && !client.classLocked) {
        this.cancelLobbyCountdown(`${client.name} is no longer ready.`);
      }
      this.refreshLobbyState(Date.now(), wasLocked && !client.classLocked ? `${client.name} is no longer ready.` : "");
    }
    return changed;
  }

  updateRequestedStartFloor(clientId, floor = 1) {
    if (this.phase !== "lobby") return false;
    if (clientId !== this.roomOwnerId) return false;
    const nextFloor = Math.max(1, Math.floor(Number.isFinite(floor) ? floor : 1));
    if (nextFloor === this.requestedStartFloor) return false;
    this.requestedStartFloor = nextFloor;
    this.cancelLobbyCountdown("Start floor changed. Countdown restarted.");
    this.refreshLobbyState(Date.now(), "Start floor changed. Countdown restarted.");
    return true;
  }

  tick(nowMs, scheduleDriftMs = 0) {
    if (this.phase === "lobby") {
      this.lastTickMs = nowMs;
      const countdownActive = this.lobbyCountdownStartedAt > 0 && this.lobbyCountdownEndsAt > this.lobbyCountdownStartedAt;
      const countdownElapsed = countdownActive && nowMs - this.lobbyCountdownStartedAt >= this.lobbyCountdownDurationMs;
      if (countdownElapsed && nowMs >= this.lobbyCountdownEndsAt) {
        this.startRun(nowMs);
        this.broadcastRoster();
      }
      return;
    }
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
    let effectiveNowMs = Number.isFinite(nowMs) ? nowMs : this.lastTickMs;
    if (Number.isFinite(effectiveNowMs) && Number.isFinite(this.lastTickMs) && effectiveNowMs < this.lastTickMs) {
      this.recordServerStateAnomaly("tickClockBackwards", {
        context: {
          source: "tickClock",
          rawDtMs: Math.round(effectiveNowMs - this.lastTickMs),
          previousTickMs: this.lastTickMs,
          nowMs: effectiveNowMs
        }
      });
      effectiveNowMs = this.lastTickMs;
    }
    const rawDt = Number.isFinite(effectiveNowMs) && Number.isFinite(this.lastTickMs)
      ? (effectiveNowMs - this.lastTickMs) / 1000
      : 0;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    this.lastTickMs = effectiveNowMs;
    this.promoteQueuedClientInputs();
    if (this.sim.paused && !this.sim.gameOver) {
      this.clearQueuedCombatInputFlags();
      this.options.pushTelemetrySample(this.telemetry.tickDurationsMs, this.options.monotonicNowMs() - t0);
      return;
    }
    if (typeof this.sim.ensurePlayerSafePosition === "function") this.sim.ensurePlayerSafePosition(12);
    const preBulletCount = this.sim.bullets.length;
    const preFireArrowCount = this.sim.fireArrows.length;
    const previousFloor = Number.isFinite(this.sim.floor) ? this.sim.floor : null;
    this.sim.networkActivePlayers = this.getSimulationPlayerEntities();
    this.sim.tick(dt, this.getControllerInput());
    const floorAdvanced = previousFloor !== null && Number.isFinite(this.sim.floor) && this.sim.floor > previousFloor;
    if (floorAdvanced) placeActivePlayersAtRandomFloorSpawns(this);
    this.updateRemoteActivePlayers(floorAdvanced ? 0 : dt);
    this.syncPrimaryActivePlayerFromSim();
    if (this.sim.gameOver && this.getLivingActivePlayerStates().length > 0) {
      this.transferPauseOwnerToLivingPlayer(nowMs);
    }
    if (this.sim.gameOver && !this.finalResults) {
      this.finalResults = this.buildFinalResults();
    }
    if (typeof this.sim.ensurePlayerSafePosition === "function") this.sim.ensurePlayerSafePosition(12);
    const controllerClient = this.clients.get(this.pauseOwnerId);
    const taggedSeq = getProcessedInputSeq(controllerClient);
    const ownerId = this.pauseOwnerId || null;
    for (let i = preBulletCount; i < this.sim.bullets.length; i++) {
      const bullet = this.sim.bullets[i];
      if (!bullet || typeof bullet !== "object") continue;
      if (bullet.projectileType === "trapArrow" || bullet.projectileType === "ratArrow") continue;
      if (!(Number.isFinite(bullet.spawnSeq) && bullet.spawnSeq > 0)) bullet.spawnSeq = taggedSeq;
      if (!(typeof bullet.ownerId === "string" && bullet.ownerId)) bullet.ownerId = ownerId;
    }
    for (let i = preFireArrowCount; i < this.sim.fireArrows.length; i++) {
      const fireArrow = this.sim.fireArrows[i];
      if (!fireArrow || typeof fireArrow !== "object") continue;
      if (!(Number.isFinite(fireArrow.spawnSeq) && fireArrow.spawnSeq > 0)) fireArrow.spawnSeq = taggedSeq;
      if (!(typeof fireArrow.ownerId === "string" && fireArrow.ownerId)) fireArrow.ownerId = ownerId;
    }
    if (controllerClient) this.clearQueuedCombatInputFlags([controllerClient]);
    this.auditServerState({
      source: "tick",
      dtMs: Math.round(dt * 1000),
      rawDtMs: Math.round(rawDt * 1000),
      controllerId: this.pauseOwnerId || null,
      processedInputSeq: getProcessedInputSeq(controllerClient)
    });
    this.options.pushTelemetrySample(this.telemetry.tickDurationsMs, this.options.monotonicNowMs() - t0);
  }

  broadcast(type, payload) {
    const t0 = this.options.monotonicNowMs();
    const msg = JSON.stringify({ type, roomId: this.id, ...payload });
    const payloadBytes = Buffer.byteLength(msg);
    let dropped = 0;
    let recipientCount = 0;
    let maxBufferedBeforeBytes = 0;
    for (const client of this.clients.values()) {
      if (!client.transport?.isOpen()) continue;
      recipientCount += 1;
      const bufferedBefore = Number.isFinite(client.transport.bufferedAmount) ? client.transport.bufferedAmount : 0;
      if (bufferedBefore > maxBufferedBeforeBytes) maxBufferedBeforeBytes = bufferedBefore;
      if (type === "state.snapshot" && client.transport.bufferedAmount > this.options.maxWsBufferedBytes) {
        dropped += 1;
        continue;
      }
      client.transport.send(msg);
    }
    const elapsed = this.options.monotonicNowMs() - t0;
    if (type === "state.snapshot") {
      this.telemetry.snapshotBroadcastCount += 1;
      this.telemetry.droppedSnapshots += dropped;
      this.options.pushTelemetrySample(this.telemetry.snapshotBroadcastDurationsMs, elapsed);
      this.options.pushTelemetrySample(this.telemetry.snapshotPayloadBytes, payloadBytes);
      this.options.pushTelemetrySample(this.telemetry.snapshotSendQueueBytes, maxBufferedBeforeBytes);
      this.telemetry.lastSnapshotTelemetry = {
        broadcastDurationMs: Math.round(elapsed * 10) / 10,
        payloadBytes,
        recipientCount,
        droppedSnapshots: dropped,
        maxBufferedBeforeBytes,
        snapshotBroadcastCount: this.telemetry.snapshotBroadcastCount
      };
    }
    return { elapsedMs: elapsed, dropped, payloadBytes, recipientCount, maxBufferedBeforeBytes };
  }

  broadcastRoster() {
    this.broadcast("room.roster", {
      phase: this.phase,
      ownerId: this.roomOwnerId,
      pauseOwnerId: this.pauseOwnerId,
      controllerId: this.pauseOwnerId,
      requestedStartFloor: this.requestedStartFloor,
      lobbyCountdownEndsAt: this.lobbyCountdownEndsAt || 0,
      lobbyCountdownRemainingMs: this.getLobbyCountdownRemainingMs(),
      lobbyInlineMessage: this.lobbyInlineMessage,
      voice: this.getVoiceRoomConfig(),
      players: this.getRosterEntries()
    });
  }

  sendMapMeta(toClient = null) {
    const payload = {
      mapSignature: this.mapSignature(),
      floor: this.sim.floor,
      biomeKey: this.sim.biomeKey,
      mapWidth: this.sim.mapWidth,
      mapHeight: this.sim.mapHeight,
      tileSize: this.sim.config.map.tile,
      armorStands: this.sim.armorStands.map((stand) => ({
        id: this.options.getStableId(this, "armorStand", "as", stand),
        x: stand.x,
        y: stand.y,
        size: stand.size,
        animated: !!stand.animated,
        activated: !!stand.activated,
        variant: typeof stand.variant === "string" ? stand.variant : null
      })),
      lightSources: (this.sim.lightSources || []).map((light) => ({
        id: this.options.getStableId(this, "lightSource", "ls", light),
        type: typeof light?.type === "string" ? light.type : "light",
        x: light.x,
        y: light.y,
        size: light.size,
        lit: light.lit !== false,
        lightRadius: light.lightRadius,
        snuffCooldown: Number.isFinite(light.snuffCooldown) ? light.snuffCooldown : 0
      }))
    };
    if (toClient) {
      toClient.transport?.sendJson({ type: "state.mapMeta", roomId: this.id, ...payload });
      return;
    }
    this.broadcast("state.mapMeta", payload);
  }

  sendMapState(toClient = null) {
    const payload = {
      mapSignature: this.mapSignature(),
      floor: this.sim.floor,
      mapWidth: this.sim.mapWidth,
      mapHeight: this.sim.mapHeight,
      map: this.sim.map,
      armorStands: this.sim.armorStands.map((stand) => ({
        id: this.options.getStableId(this, "armorStand", "as", stand),
        x: stand.x,
        y: stand.y,
        size: stand.size,
        animated: !!stand.animated,
        activated: !!stand.activated
      })),
      lightSources: (this.sim.lightSources || []).map((light) => ({
        id: this.options.getStableId(this, "lightSource", "ls", light),
        type: typeof light?.type === "string" ? light.type : "light",
        x: light.x,
        y: light.y,
        size: light.size,
        lit: light.lit !== false,
        lightRadius: light.lightRadius,
        snuffCooldown: Number.isFinite(light.snuffCooldown) ? light.snuffCooldown : 0
      }))
    };
    if (toClient) {
      toClient.transport?.sendJson({ type: "state.map", roomId: this.id, ...payload });
      return;
    }
    this.broadcast("state.map", payload);
  }

  sendMapChunksToClient(client, nowMs = Date.now()) {
    const startedAt = this.options.monotonicNowMs();
    const result = { sent: 0, bytes: 0, elapsedMs: 0 };
    if (!client?.transport?.isOpen()) return result;
    const chunkState = this.clientChunkState.get(client.id);
    if (!chunkState) return result;
    const tile = this.sim.config.map.tile || 32;
    const chunkPlayer = this.activePlayers.get(client.id) || this.sim.player;
    const ptx = Math.floor((chunkPlayer?.x || 0) / tile);
    const pty = Math.floor((chunkPlayer?.y || 0) / tile);
    const centerCx = Math.floor(ptx / this.options.mapChunkSize);
    const centerCy = Math.floor(pty / this.options.mapChunkSize);
    const sig = this.mapSignature();
    const maxChunks = Math.max(1, Number.isFinite(this.options.maxMapChunksPerSnapshot) ? Math.floor(this.options.maxMapChunksPerSnapshot) : 4);

    for (let cy = centerCy - this.options.mapChunkRadius; cy <= centerCy + this.options.mapChunkRadius; cy++) {
      for (let cx = centerCx - this.options.mapChunkRadius; cx <= centerCx + this.options.mapChunkRadius; cx++) {
        if (cx < 0 || cy < 0) continue;
        const key = `${sig}:${cx}:${cy}`;
        if (chunkState.sent.has(key) && nowMs - this.lastChunkPushMs < this.options.mapChunkPushMs) continue;
        const chunk = this.options.buildMapChunkRows(this.sim, cx, cy, this.options.mapChunkSize);
        if (!chunk) continue;
        const payload = {
          type: "state.mapChunk",
          roomId: this.id,
          mapSignature: sig,
          cx,
          cy,
          chunkSize: this.options.mapChunkSize,
          rows: chunk.rows
        };
        result.bytes += Buffer.byteLength(JSON.stringify(payload));
        client.transport.sendJson(payload);
        chunkState.sent.add(key);
        result.sent += 1;
        if (result.sent >= maxChunks) {
          this.lastChunkPushMs = nowMs;
          result.elapsedMs = this.options.monotonicNowMs() - startedAt;
          return result;
        }
      }
    }
    this.lastChunkPushMs = nowMs;
    result.elapsedMs = this.options.monotonicNowMs() - startedAt;
    return result;
  }

  maybeBroadcastSnapshot(nowMs) {
    return this.broadcastSnapshot(nowMs, false);
  }

  broadcastSnapshot(nowMs, force = false) {
    if (this.phase !== "active") return false;
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
      this.sendMapState();
      this.maybeBroadcastMeta(nowMs, true);
    }
    const previousSnapshotMs = this.lastSnapshotMs;
    const snapshotBroadcastGapMs = previousSnapshotMs > 0 ? Math.max(0, nowMs - previousSnapshotMs) : 0;
    if (snapshotBroadcastGapMs > 0) this.options.pushTelemetrySample(this.telemetry.snapshotBroadcastGapsMs, snapshotBroadcastGapMs);
    const chunkTelemetry = { sent: 0, bytes: 0, elapsedMs: 0 };
    for (const client of this.clients.values()) {
      const pushed = this.sendMapChunksToClient(client, nowMs);
      chunkTelemetry.sent += pushed?.sent || 0;
      chunkTelemetry.bytes += pushed?.bytes || 0;
      chunkTelemetry.elapsedMs += pushed?.elapsedMs || 0;
    }
    this.options.pushTelemetrySample(this.telemetry.mapChunkPushDurationsMs, chunkTelemetry.elapsedMs);
    const controllerClient = this.clients.get(this.pauseOwnerId);
    const serializeStart = this.options.monotonicNowMs();
    const fullState = this.options.serializeState(this);
    this.auditServerState({
      source: "snapshot",
      force: !!force
    });
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
    const treasureChestDelta = this.options.buildDeltaCollection(this.deltaCache.treasureChests, fullState.treasureChests, keyframe);
    const lightSourceDelta = this.options.buildDeltaCollection(this.deltaCache.lightSources, fullState.lightSources, keyframe);
    const breakableDelta = this.options.buildDeltaCollection(this.deltaCache.breakables, fullState.breakables, keyframe);
    const wallTrapDelta = this.options.buildDeltaCollection(this.deltaCache.wallTraps, fullState.wallTraps, keyframe);
    const bulletDelta = this.options.buildDeltaCollection(this.deltaCache.bullets, fullState.bullets, keyframe);
    const fireArrowDelta = this.options.buildDeltaCollection(this.deltaCache.fireArrows, fullState.fireArrows, keyframe);
    const fireZoneDelta = this.options.buildDeltaCollection(this.deltaCache.fireZones, fullState.fireZones, keyframe);
    const meleeSwingDelta = this.options.buildDeltaCollection(this.deltaCache.meleeSwings, fullState.meleeSwings, keyframe);
    if (keyframe || enemyDelta) delta.enemies = enemyDelta || {};
    if (keyframe || dropDelta) delta.drops = dropDelta || {};
    if (keyframe || treasureChestDelta) delta.treasureChests = treasureChestDelta || {};
    if (keyframe || lightSourceDelta) delta.lightSources = lightSourceDelta || {};
    if (keyframe || breakableDelta) delta.breakables = breakableDelta || {};
    if (keyframe || wallTrapDelta) delta.wallTraps = wallTrapDelta || {};
    if (keyframe || bulletDelta) delta.bullets = bulletDelta || {};
    if (keyframe || fireArrowDelta) delta.fireArrows = fireArrowDelta || {};
    if (keyframe || fireZoneDelta) delta.fireZones = fireZoneDelta || {};
    if (keyframe || meleeSwingDelta) delta.meleeSwings = meleeSwingDelta || {};
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
      players: fullState.players,
      serverStateAnomalies: this.recentServerStateAnomalies.slice(-12).map((entry) => ({ ...entry })),
      owlDelivery: fullState.owlDelivery,
      flameOfTheFallen: fullState.flameOfTheFallen,
      shopStock: fullState.shopStock,
      shopRotationEvents: fullState.shopRotationEvents,
      delta
    };
    if (Array.isArray(fullState.floatingTexts) && fullState.floatingTexts.length > 0) {
      state.floatingTexts = fullState.floatingTexts;
    }
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
    const snapshotBroadcast = this.broadcast("state.snapshot", {
      serverTime: nowMs,
      snapshotSeq: this.snapshotSeq,
      snapshotTelemetry: {
        snapshotBroadcastGapMs: Math.round(snapshotBroadcastGapMs),
        mapChunksSent: chunkTelemetry.sent,
        mapChunkBytes: chunkTelemetry.bytes,
        mapChunkPushDurationMs: Math.round(chunkTelemetry.elapsedMs * 10) / 10,
        previousPayloadBytes: this.telemetry.lastSnapshotTelemetry?.payloadBytes || 0,
        previousBroadcastDurationMs: this.telemetry.lastSnapshotTelemetry?.broadcastDurationMs || 0,
        previousMaxBufferedBeforeBytes: this.telemetry.lastSnapshotTelemetry?.maxBufferedBeforeBytes || 0,
        droppedSnapshotsTotal: this.telemetry.droppedSnapshots
      },
      phase: this.phase,
      ownerId: this.roomOwnerId,
      pauseOwnerId: this.pauseOwnerId,
      controllerId: this.pauseOwnerId,
      lastInputSeq: getProcessedInputSeq(controllerClient),
      lastInputSeqByPlayer: this.getLastInputSeqByPlayer(),
      lastReceivedInputSeqByPlayer: this.getLastReceivedInputSeqByPlayer(),
      lastActionSeqByPlayer: this.getLastActionSeqByPlayer(),
      inputQueueDepthByPlayer: this.getInputQueueDepthByPlayer(),
      mapSignature: sig,
      state
    });
    if (Array.isArray(this.sim.networkFloatingTextEvents) && snapshotBroadcast.dropped <= 0) {
      this.sim.networkFloatingTextEvents.length = 0;
    }
    this.lastSnapshotMs = nowMs;
    this.maybeBroadcastMeta(nowMs);
    return true;
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
    if (!toClient?.transport?.isOpen()) return;
    const meta = this.options.serializeMetaState(this);
    const payloadJson = JSON.stringify(meta);
    const changed = payloadJson !== this.lastMetaPayloadJson;
    if (force || changed || nowMs - this.lastMetaBroadcastMs >= this.options.metaBroadcastMinMs) {
      this.lastMetaPayloadJson = payloadJson;
      this.lastMetaBroadcastMs = nowMs;
    }
    toClient.transport.sendJson({
      type: "state.meta",
      roomId: this.id,
      serverTime: nowMs,
      mapSignature: this.mapSignature(),
      meta
    });
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
      snapshotBroadcastGapMs: {
        avg: this.options.average(this.telemetry.snapshotBroadcastGapsMs),
        p95: this.options.percentile(this.telemetry.snapshotBroadcastGapsMs, 95)
      },
      snapshotPayloadBytes: {
        avg: this.options.average(this.telemetry.snapshotPayloadBytes),
        p95: this.options.percentile(this.telemetry.snapshotPayloadBytes, 95)
      },
      snapshotSendQueueBytes: {
        avg: this.options.average(this.telemetry.snapshotSendQueueBytes),
        p95: this.options.percentile(this.telemetry.snapshotSendQueueBytes, 95)
      },
      mapChunkPushDurationMs: {
        avg: this.options.average(this.telemetry.mapChunkPushDurationsMs),
        p95: this.options.percentile(this.telemetry.mapChunkPushDurationsMs, 95)
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
      snapshotBroadcastCount: this.telemetry.snapshotBroadcastCount,
      lastSnapshotTelemetry: this.telemetry.lastSnapshotTelemetry ? { ...this.telemetry.lastSnapshotTelemetry } : null
    };
  }
}
