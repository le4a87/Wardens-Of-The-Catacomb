import { GameSim } from "../../src/sim/GameSim.js";
import {
  createNecromancerBeamState,
  createRangerRuntimeState,
  createWarriorRuntimeState,
  createSkillState,
  createUpgradeState
} from "../../src/game/runtimeBaseStateFactories.js";
import { cloneRangerTalentState, createRangerTalentState } from "../../src/game/rangerTalentTree.js";
import { cloneWarriorTalentState, createWarriorTalentState } from "../../src/game/warriorTalentTree.js";
import { cloneNecromancerTalentState, createNecromancerTalentState } from "../../src/game/necromancerTalentTree.js";
import { cloneConsumableInventoryState } from "../../src/game/consumables.js";

const PLAYER_COLOR_PALETTE = ["#5bb3ff", "#ff8f6b", "#7ae582", "#f3cf6b", "#c78bff", "#ff6fae"];

function cloneSkillState(source = null) {
  const next = createSkillState();
  if (!source || typeof source !== "object") return next;
  for (const [key, skill] of Object.entries(next)) {
    const raw = source[key];
    if (!raw || typeof raw !== "object") continue;
    if (Number.isFinite(raw.points)) skill.points = Math.max(0, Math.min(skill.maxPoints, Math.floor(raw.points)));
  }
  return next;
}

function cloneUpgradeState(source = null) {
  const next = createUpgradeState();
  if (!source || typeof source !== "object") return next;
  for (const [key, upgrade] of Object.entries(next)) {
    const raw = source[key];
    if (!raw || typeof raw !== "object") continue;
    if (Number.isFinite(raw.level)) upgrade.level = Math.max(0, Math.min(upgrade.maxLevel, Math.floor(raw.level)));
  }
  return next;
}

function cloneRangerRuntimeState(source = null) {
  return {
    ...createRangerRuntimeState(),
    ...(source && typeof source === "object" ? source : {})
  };
}

function cloneWarriorRuntimeState(source = null) {
  return {
    ...createWarriorRuntimeState(),
    ...(source && typeof source === "object" ? source : {})
  };
}

function cloneNecromancerBeamState(source = null) {
  return {
    ...createNecromancerBeamState(),
    ...(source && typeof source === "object" ? source : {})
  };
}

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
    this.activePlayers = new Map();
    this.completedRunPlayers = new Map();
    this.finalResults = null;
    this.deltaCache = {
      enemies: new Map(),
      drops: new Map(),
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
      bullet: 1,
      fireArrow: 1,
      fireZone: 1,
      meleeSwing: 1,
      armorStand: 1,
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
    const classSpec = this.getClassSpec(client?.classType);
    const baseMaxHealth = Number.isFinite(classSpec.baseMaxHealth) ? classSpec.baseMaxHealth : this.sim.config?.player?.maxHealth || 100;
    const x = Number.isFinite(spawn?.x) ? spawn.x : this.sim.player?.x || 0;
    const y = Number.isFinite(spawn?.y) ? spawn.y : this.sim.player?.y || 0;
    return {
      id: client.id,
      handle: client.name,
      classType: client.classType,
      x,
      y,
      size: Number.isFinite(this.sim.player?.size) ? this.sim.player.size : 22,
      speed: Number.isFinite(classSpec.baseMoveSpeed) ? classSpec.baseMoveSpeed : this.sim.config?.player?.speed || 180,
      health: baseMaxHealth,
      maxHealth: baseMaxHealth,
      level: 1,
      score: 0,
      gold: 0,
      experience: 0,
      expToNextLevel: this.sim.config?.progression?.baseXpToLevel || 10,
      skillPoints: 0,
      levelWeaponDamageBonus: 0,
      kills: 0,
      damageDealt: 0,
      goldEarned: 0,
      fireCooldown: 0,
      fireArrowCooldown: 0,
      deathBoltCooldown: 0,
      skills: cloneSkillState(),
      rangerTalents: createRangerTalentState(),
      warriorTalents: createWarriorTalentState(),
      necromancerTalents: createNecromancerTalentState(),
      upgrades: cloneUpgradeState(),
      consumables: cloneConsumableInventoryState(),
      rangerRuntime: cloneRangerRuntimeState(),
      warriorRuntime: cloneWarriorRuntimeState(),
      necromancerRuntime: { vigorTimer: 0, vigorBeamTimer: 0, vigorHealPool: 0, vigorTotalDuration: 0, harvesterBonusPct: 0, tempHp: 0 },
      consumableRuntime: { tempHp: 0 },
      warriorMomentumTimer: 0,
      warriorRageActiveTimer: 0,
      warriorRageCooldownTimer: 0,
      warriorRageVictoryRushPool: 0,
      warriorRageVictoryRushTimer: 0,
      necromancerBeam: cloneNecromancerBeamState(),
      hitCooldown: 0,
      hpBarTimer: 0,
      animTime: 0,
      dirX: 1,
      dirY: 0,
      facing: 0,
      moving: false,
      alive: true,
      color: this.getClientRunColor(client)
    };
  }

  buildRunParticipantRecord(client, state = null, outcome = "Dead") {
    const source = state || null;
    const primaryClient = client && client.id === this.pauseOwnerId ? client : null;
    const primaryState = primaryClient ? this.syncPrimaryActivePlayerFromSim() : null;
    const resolved = primaryState && client?.id === primaryState.id ? primaryState : source;
    const classType = resolved?.classType || client?.classType || this.sim.player?.classType || "archer";
    const classLabel = this.getClassSpec(classType)?.label || classType;
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
    this.activePlayers.clear();
    const baseSpawn = { x: this.sim.player?.x || 0, y: this.sim.player?.y || 0 };
    const tile = this.sim.config?.map?.tile || 32;
    let slot = 0;
    for (const client of this.clients.values()) {
      const angle = slot * ((Math.PI * 2) / Math.max(1, this.clients.size));
      const offsetX = Math.cos(angle) * tile * 0.85;
      const offsetY = Math.sin(angle) * tile * 0.85;
      const candidate =
        slot === 0 || typeof this.sim.findNearestSafePoint !== "function"
          ? baseSpawn
          : this.sim.findNearestSafePoint(baseSpawn.x + offsetX, baseSpawn.y + offsetY, 8);
      this.activePlayers.set(client.id, this.createActivePlayerState(client, candidate));
      slot += 1;
    }
    this.syncSimPrimaryPlayerState();
    this.syncPrimaryActivePlayerFromSim();
  }

  syncSimPrimaryPlayerState() {
    if (!this.pauseOwnerId) return null;
    const client = this.clients.get(this.pauseOwnerId);
    const state = client ? this.activePlayers.get(client.id) : null;
    if (!client || !state) return null;
    const classSpec = this.getClassSpec(state.classType);
    this.sim.classType = state.classType;
    this.sim.classSpec = classSpec;
    this.sim.player.classType = state.classType;
    this.sim.player.id = state.id;
    this.sim.player.handle = state.handle;
    this.sim.player.color = state.color;
    this.sim.player.x = Number.isFinite(state.x) ? state.x : this.sim.player.x;
    this.sim.player.y = Number.isFinite(state.y) ? state.y : this.sim.player.y;
    this.sim.player.size = Number.isFinite(state.size) ? state.size : this.sim.player.size;
    this.sim.player.speed = Number.isFinite(state.speed) ? state.speed : this.sim.player.speed;
    this.sim.player.health = Number.isFinite(state.health) ? state.health : this.sim.player.health;
    this.sim.player.maxHealth = Number.isFinite(state.maxHealth) ? state.maxHealth : this.sim.player.maxHealth;
    this.sim.player.fireCooldown = Number.isFinite(state.fireCooldown) ? state.fireCooldown : 0;
    this.sim.player.fireArrowCooldown = Number.isFinite(state.fireArrowCooldown) ? state.fireArrowCooldown : 0;
    this.sim.player.deathBoltCooldown = Number.isFinite(state.deathBoltCooldown) ? state.deathBoltCooldown : 0;
    this.sim.player.hitCooldown = Number.isFinite(state.hitCooldown) ? state.hitCooldown : 0;
    this.sim.player.hpBarTimer = Number.isFinite(state.hpBarTimer) ? state.hpBarTimer : 0;
    this.sim.player.animTime = Number.isFinite(state.animTime) ? state.animTime : 0;
    this.sim.player.dirX = Number.isFinite(state.dirX) ? state.dirX : this.sim.player.dirX;
    this.sim.player.dirY = Number.isFinite(state.dirY) ? state.dirY : this.sim.player.dirY;
    this.sim.player.facing = Number.isFinite(state.facing) ? state.facing : this.sim.player.facing;
    this.sim.player.moving = !!state.moving;
    this.sim.level = Number.isFinite(state.level) ? state.level : this.sim.level;
    this.sim.score = Number.isFinite(state.score) ? state.score : this.sim.score;
    this.sim.gold = Number.isFinite(state.gold) ? state.gold : this.sim.gold;
    this.sim.experience = Number.isFinite(state.experience) ? state.experience : this.sim.experience;
    this.sim.expToNextLevel = Number.isFinite(state.expToNextLevel) ? state.expToNextLevel : this.sim.expToNextLevel;
    this.sim.skillPoints = Number.isFinite(state.skillPoints) ? state.skillPoints : this.sim.skillPoints;
    this.sim.levelWeaponDamageBonus = Number.isFinite(state.levelWeaponDamageBonus) ? state.levelWeaponDamageBonus : this.sim.levelWeaponDamageBonus;
    this.sim.skills = cloneSkillState(state.skills);
    this.sim.rangerTalents = cloneRangerTalentState(state.rangerTalents);
    this.sim.warriorTalents = cloneWarriorTalentState(state.warriorTalents);
    this.sim.necromancerTalents = cloneNecromancerTalentState(state.necromancerTalents);
    this.sim.upgrades = cloneUpgradeState(state.upgrades);
    this.sim.consumables = cloneConsumableInventoryState(state.consumables);
    this.sim.rangerRuntime = cloneRangerRuntimeState(state.rangerRuntime);
    this.sim.warriorRuntime = cloneWarriorRuntimeState(state.warriorRuntime);
    this.sim.player.consumableRuntime = {
      tempHp: Number.isFinite(state?.consumableRuntime?.tempHp) ? state.consumableRuntime.tempHp : 0
    };
    this.sim.warriorMomentumTimer = Number.isFinite(state.warriorMomentumTimer) ? state.warriorMomentumTimer : 0;
    this.sim.warriorRageActiveTimer = Number.isFinite(state.warriorRageActiveTimer) ? state.warriorRageActiveTimer : 0;
    this.sim.warriorRageCooldownTimer = Number.isFinite(state.warriorRageCooldownTimer) ? state.warriorRageCooldownTimer : 0;
    this.sim.warriorRageVictoryRushPool = Number.isFinite(state.warriorRageVictoryRushPool) ? state.warriorRageVictoryRushPool : 0;
    this.sim.warriorRageVictoryRushTimer = Number.isFinite(state.warriorRageVictoryRushTimer) ? state.warriorRageVictoryRushTimer : 0;
    this.sim.necromancerBeam = cloneNecromancerBeamState(state.necromancerBeam);
    return state;
  }

  syncPrimaryActivePlayerFromSim() {
    if (!this.pauseOwnerId) return null;
    const client = this.clients.get(this.pauseOwnerId);
    if (!client) return null;
    const state = this.activePlayers.get(client.id) || this.createActivePlayerState(client, this.sim.player);
    state.handle = client.name;
    state.classType = client.classType;
    state.x = this.sim.player.x;
    state.y = this.sim.player.y;
    state.size = this.sim.player.size;
    state.health = this.sim.player.health;
    state.maxHealth = this.sim.player.maxHealth;
    state.fireCooldown = this.sim.player.fireCooldown;
    state.fireArrowCooldown = this.sim.player.fireArrowCooldown;
    state.deathBoltCooldown = this.sim.player.deathBoltCooldown;
    state.skills = cloneSkillState(this.sim.skills);
    state.rangerTalents = cloneRangerTalentState(this.sim.rangerTalents);
    state.warriorTalents = cloneWarriorTalentState(this.sim.warriorTalents);
    state.necromancerTalents = cloneNecromancerTalentState(this.sim.necromancerTalents);
    state.upgrades = cloneUpgradeState(this.sim.upgrades);
    state.consumables = cloneConsumableInventoryState(this.sim.consumables);
    state.rangerRuntime = cloneRangerRuntimeState(this.sim.rangerRuntime);
    state.warriorRuntime = cloneWarriorRuntimeState(this.sim.warriorRuntime);
    state.score = this.sim.score;
    state.gold = this.sim.gold;
    state.experience = this.sim.experience;
    state.expToNextLevel = this.sim.expToNextLevel;
    state.skillPoints = this.sim.skillPoints;
    state.levelWeaponDamageBonus = this.sim.levelWeaponDamageBonus;
    state.kills = this.sim.runStats?.totalKills || 0;
    state.damageDealt = this.sim.runStats?.damageDealt || 0;
    state.goldEarned = this.sim.runStats?.goldEarned || 0;
    state.warriorMomentumTimer = this.sim.warriorMomentumTimer || 0;
    state.warriorRageActiveTimer = this.sim.warriorRageActiveTimer || 0;
    state.warriorRageCooldownTimer = this.sim.warriorRageCooldownTimer || 0;
    state.warriorRageVictoryRushPool = this.sim.warriorRageVictoryRushPool || 0;
    state.warriorRageVictoryRushTimer = this.sim.warriorRageVictoryRushTimer || 0;
    state.necromancerBeam = cloneNecromancerBeamState(this.sim.necromancerBeam);
    state.hitCooldown = this.sim.player.hitCooldown;
    state.hpBarTimer = this.sim.player.hpBarTimer;
    state.animTime = this.sim.player.animTime;
    state.level = this.sim.level;
    state.dirX = this.sim.player.dirX;
    state.dirY = this.sim.player.dirY;
    state.facing = this.sim.player.facing;
    state.moving = !!this.sim.player.moving;
    state.alive = this.sim.player.health > 0;
    state.consumableRuntime = {
      tempHp: Number.isFinite(this.sim.player?.consumableRuntime?.tempHp) ? this.sim.player.consumableRuntime.tempHp : 0
    };
    state.color = this.getClientRunColor(client);
    this.activePlayers.set(client.id, state);
    return state;
  }

  createPlayerSimulationContext(state) {
    if (!state) return null;
    const context = Object.create(this.sim);
    context.player = state;
    context.classType = state.classType;
    context.classSpec = this.getClassSpec(state.classType);
    context.level = Number.isFinite(state.level) ? state.level : 1;
    context.score = Number.isFinite(state.score) ? state.score : 0;
    context.gold = Number.isFinite(state.gold) ? state.gold : 0;
    context.experience = Number.isFinite(state.experience) ? state.experience : 0;
    context.expToNextLevel = Number.isFinite(state.expToNextLevel)
      ? state.expToNextLevel
      : this.sim.config?.progression?.baseXpToLevel || 10;
    context.skillPoints = Number.isFinite(state.skillPoints) ? state.skillPoints : 0;
    context.levelWeaponDamageBonus = Number.isFinite(state.levelWeaponDamageBonus) ? state.levelWeaponDamageBonus : 0;
    context.skills = cloneSkillState(state.skills);
    context.rangerTalents = cloneRangerTalentState(state.rangerTalents);
    context.warriorTalents = cloneWarriorTalentState(state.warriorTalents);
    context.necromancerTalents = cloneNecromancerTalentState(state.necromancerTalents);
    context.upgrades = cloneUpgradeState(state.upgrades);
    context.consumables = cloneConsumableInventoryState(state.consumables);
    context.rangerRuntime = cloneRangerRuntimeState(state.rangerRuntime);
    context.warriorRuntime = cloneWarriorRuntimeState(state.warriorRuntime);
    context.necromancerRuntime = {
      vigorTimer: Number.isFinite(state?.necromancerRuntime?.vigorTimer) ? state.necromancerRuntime.vigorTimer : 0,
      vigorBeamTimer: Number.isFinite(state?.necromancerRuntime?.vigorBeamTimer) ? state.necromancerRuntime.vigorBeamTimer : 0,
      vigorHealPool: Number.isFinite(state?.necromancerRuntime?.vigorHealPool) ? state.necromancerRuntime.vigorHealPool : 0,
      vigorTotalDuration: Number.isFinite(state?.necromancerRuntime?.vigorTotalDuration) ? state.necromancerRuntime.vigorTotalDuration : 0,
      harvesterBonusPct: Number.isFinite(state?.necromancerRuntime?.harvesterBonusPct) ? state.necromancerRuntime.harvesterBonusPct : 0,
      tempHp: Number.isFinite(state?.necromancerRuntime?.tempHp) ? state.necromancerRuntime.tempHp : 0
    };
    context.player.consumableRuntime = {
      tempHp: Number.isFinite(state?.consumableRuntime?.tempHp) ? state.consumableRuntime.tempHp : 0
    };
    context.warriorMomentumTimer = Number.isFinite(state.warriorMomentumTimer) ? state.warriorMomentumTimer : 0;
    context.warriorRageActiveTimer = Number.isFinite(state.warriorRageActiveTimer) ? state.warriorRageActiveTimer : 0;
    context.warriorRageCooldownTimer = Number.isFinite(state.warriorRageCooldownTimer) ? state.warriorRageCooldownTimer : 0;
    context.warriorRageVictoryRushPool = Number.isFinite(state.warriorRageVictoryRushPool) ? state.warriorRageVictoryRushPool : 0;
    context.warriorRageVictoryRushTimer = Number.isFinite(state.warriorRageVictoryRushTimer) ? state.warriorRageVictoryRushTimer : 0;
    context.necromancerBeam = cloneNecromancerBeamState(state.necromancerBeam);
    context.recordRunGoldSpent = () => {};
    context.recordClassSpecificStat = () => {};
    return context;
  }

  syncActivePlayerStateFromContext(state, context) {
    if (!state || !context) return;
    state.classType = context.classType;
    state.level = Number.isFinite(context.level) ? context.level : state.level;
    state.score = Number.isFinite(context.score) ? context.score : state.score;
    state.gold = Number.isFinite(context.gold) ? context.gold : state.gold;
    state.experience = Number.isFinite(context.experience) ? context.experience : state.experience;
    state.expToNextLevel = Number.isFinite(context.expToNextLevel) ? context.expToNextLevel : state.expToNextLevel;
    state.skillPoints = Number.isFinite(context.skillPoints) ? context.skillPoints : state.skillPoints;
    state.levelWeaponDamageBonus = Number.isFinite(context.levelWeaponDamageBonus)
      ? context.levelWeaponDamageBonus
      : state.levelWeaponDamageBonus;
    state.skills = cloneSkillState(context.skills);
    state.rangerTalents = cloneRangerTalentState(context.rangerTalents);
    state.warriorTalents = cloneWarriorTalentState(context.warriorTalents);
    state.necromancerTalents = cloneNecromancerTalentState(context.necromancerTalents);
    state.upgrades = cloneUpgradeState(context.upgrades);
    state.consumables = cloneConsumableInventoryState(context.consumables);
    state.rangerRuntime = cloneRangerRuntimeState(context.rangerRuntime);
    state.warriorRuntime = cloneWarriorRuntimeState(context.warriorRuntime);
    state.necromancerRuntime = {
      vigorTimer: Number.isFinite(context?.necromancerRuntime?.vigorTimer) ? context.necromancerRuntime.vigorTimer : 0,
      vigorBeamTimer: Number.isFinite(context?.necromancerRuntime?.vigorBeamTimer) ? context.necromancerRuntime.vigorBeamTimer : 0,
      vigorHealPool: Number.isFinite(context?.necromancerRuntime?.vigorHealPool) ? context.necromancerRuntime.vigorHealPool : 0,
      vigorTotalDuration: Number.isFinite(context?.necromancerRuntime?.vigorTotalDuration) ? context.necromancerRuntime.vigorTotalDuration : 0,
      harvesterBonusPct: Number.isFinite(context?.necromancerRuntime?.harvesterBonusPct) ? context.necromancerRuntime.harvesterBonusPct : 0,
      tempHp: Number.isFinite(context?.necromancerRuntime?.tempHp) ? context.necromancerRuntime.tempHp : 0
    };
    state.consumableRuntime = {
      tempHp: Number.isFinite(context?.player?.consumableRuntime?.tempHp) ? context.player.consumableRuntime.tempHp : 0
    };
    state.warriorMomentumTimer = Number.isFinite(context.warriorMomentumTimer) ? context.warriorMomentumTimer : 0;
    state.warriorRageActiveTimer = Number.isFinite(context.warriorRageActiveTimer) ? context.warriorRageActiveTimer : 0;
    state.warriorRageCooldownTimer = Number.isFinite(context.warriorRageCooldownTimer) ? context.warriorRageCooldownTimer : 0;
    state.warriorRageVictoryRushPool = Number.isFinite(context.warriorRageVictoryRushPool) ? context.warriorRageVictoryRushPool : 0;
    state.warriorRageVictoryRushTimer = Number.isFinite(context.warriorRageVictoryRushTimer) ? context.warriorRageVictoryRushTimer : 0;
    state.necromancerBeam = cloneNecromancerBeamState(context.necromancerBeam);
    if (typeof context.getPlayerMoveSpeed === "function") state.speed = context.getPlayerMoveSpeed();
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
    if (!state) return false;
    const context = this.createPlayerSimulationContext(state);
    if (!context || typeof input !== "object") return false;
    const beam = context.necromancerBeam || (context.necromancerBeam = cloneNecromancerBeamState());
    for (const enemy of this.sim.enemies || []) {
      if (enemy) enemy.charmLocked = false;
    }
    const held = !!input.firePrimaryHeld && !!input.hasAim;
    const beamRange = (this.sim.config?.necromancer?.controlRangeTiles || 10) * (this.sim.config?.map?.tile || 32);
    const beamWidth = Number.isFinite(this.sim.config?.necromancer?.beamWidth) ? this.sim.config.necromancer.beamWidth : 11;
    beam.active = held;
    beam.targetId = null;
    beam.targetEnemy = null;
    beam.targetX = Number.isFinite(input.aimX) ? input.aimX : state.x;
    beam.targetY = Number.isFinite(input.aimY) ? input.aimY : state.y;
    if (!held) {
      beam.progress = 0;
      beam.healTickTimer = 0;
      beam.mode = "idle";
      this.syncActivePlayerStateFromContext(state, context);
      return false;
    }

    const aimLen = Math.hypot((input.aimX || state.x) - state.x, (input.aimY || state.y) - state.y) || 1;
    let hitBreakable = null;
    let bestBreakableDist = Number.POSITIVE_INFINITY;
    for (const br of this.sim.breakables || []) {
      if (!br || (br.hp || 0) <= 0) continue;
      const beamDist = Math.hypot(br.x - state.x, br.y - state.y);
      if (beamDist > beamRange) continue;
      if (!this.beamHasLineOfSight(state.x, state.y, br.x, br.y)) continue;
      const lineDist = this.getAimLineDistance(state, input, br, aimLen);
      if (lineDist > beamWidth + (br.size || 20) * 0.35) continue;
      const distToAim = Math.hypot(br.x - input.aimX, br.y - input.aimY);
      if (distToAim < bestBreakableDist) {
        hitBreakable = br;
        bestBreakableDist = distToAim;
      }
    }
    if (hitBreakable) {
      beam.targetX = hitBreakable.x;
      beam.targetY = hitBreakable.y;
      beam.progress = 0;
      beam.healTickTimer = 0;
      beam.mode = "idle";
      hitBreakable.hp = 0;
      this.syncActivePlayerStateFromContext(state, context);
      return true;
    }

    let invalidTarget = null;
    let invalidTargetDist = Number.POSITIVE_INFINITY;
    let bestTarget = null;
    let bestTargetDist = Number.POSITIVE_INFINITY;
    for (const enemy of this.sim.enemies || []) {
      if (!enemy || (enemy.hp || 0) <= 0) continue;
      if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
      const beamDist = Math.hypot(enemy.x - state.x, enemy.y - state.y);
      if (beamDist > beamRange) continue;
      if (!this.beamHasLineOfSight(state.x, state.y, enemy.x, enemy.y)) continue;
      const lineDist = this.getAimLineDistance(state, input, enemy, aimLen);
      if (lineDist > beamWidth) continue;
      const distToAim = Math.hypot(enemy.x - input.aimX, enemy.y - input.aimY);
      if (distToAim < invalidTargetDist) {
        invalidTarget = enemy;
        invalidTargetDist = distToAim;
      }
      if (!context.isUndeadEnemy(enemy)) continue;
      if (distToAim < bestTargetDist) {
        bestTarget = enemy;
        bestTargetDist = distToAim;
      }
    }

    if (
      !hitBreakable &&
      invalidTarget &&
      (!context.isUndeadEnemy(invalidTarget) || (!context.isControlledUndead(invalidTarget) && !context.canControlMoreUndead(state)))
    ) {
      beam.active = false;
      beam.progress = 0;
      beam.healTickTimer = 0;
      beam.mode = "idle";
      this.syncActivePlayerStateFromContext(state, context);
      return false;
    }

    const canTarget =
      !!bestTarget &&
      context.isUndeadEnemy(bestTarget) &&
      (context.isControlledUndead(bestTarget)
        ? context.getControlledUndeadOwnerId(bestTarget) === state.id
        : context.canControlMoreUndead(state));

    if (!canTarget) {
      beam.progress = 0;
      beam.healTickTimer = 0;
      beam.mode = "idle";
      this.syncActivePlayerStateFromContext(state, context);
      return beam.active;
    }

    beam.targetEnemy = bestTarget;
    beam.targetX = bestTarget.x;
    beam.targetY = bestTarget.y;
    beam.targetId = bestTarget.id || null;
    if (context.isControlledUndead(bestTarget)) {
      beam.mode = "heal";
      beam.progress = 0;
      beam.healTickTimer = (beam.healTickTimer || 0) + Math.max(0, Number.isFinite(dt) ? dt : 0);
      const healPeriod = this.sim.config?.necromancer?.healTickSeconds || 0.2;
      while (beam.healTickTimer >= healPeriod) {
        beam.healTickTimer -= healPeriod;
        context.healControlledUndead(bestTarget, context.getNecroticBeamHealAmount());
      }
    } else {
      beam.mode = "charm";
      beam.healTickTimer = 0;
      bestTarget.charmLocked = true;
      beam.progress += Math.max(0, Number.isFinite(dt) ? dt : 0);
      if (beam.progress >= context.getNecromancerCharmDurationForPlayer(state)) {
        if (context.markUndeadAsControlled(bestTarget, state)) {
          beam.progress = 0;
          context.spawnFloatingText(bestTarget.x, bestTarget.y - bestTarget.size * 0.7, "Charmed", "#8eb8ff", 0.9, 14);
        }
      }
    }
    this.syncActivePlayerStateFromContext(state, context);
    return true;
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

  performActionForActivePlayer(clientId, fn) {
    if (!clientId || typeof fn !== "function") return false;
    const state = this.activePlayers.get(clientId);
    if (!state || state.alive === false || (state.health || 0) <= 0) return false;
    const context = this.createPlayerSimulationContext(state);
    if (!context) return false;
    const beforeCounts = {
      bullets: this.sim.bullets.length,
      fireArrows: this.sim.fireArrows.length,
      meleeSwings: this.sim.meleeSwings.length
    };
    const result = fn(context, state);
    this.syncActivePlayerStateFromContext(state, context);
    this.tagNewProjectilesForPlayer(beforeCounts, clientId, this.clients.get(clientId)?.lastInputSeq || 0);
    return result;
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
        input.moveX = 0;
        input.moveY = 0;
        input.firePrimaryQueued = false;
        input.firePrimaryHeld = false;
        input.fireAltQueued = false;
        continue;
      }
      const mx = Number.isFinite(input.moveX) ? input.moveX : 0;
      const my = Number.isFinite(input.moveY) ? input.moveY : 0;
      if (mx || my) {
        const len = Math.hypot(mx, my) || 1;
        this.sim.moveWithCollisionSubsteps(state, (mx / len) * state.speed * dt, (my / len) * state.speed * dt);
      }
      state.moving = !!(mx || my);
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
      input.firePrimaryQueued = false;
      input.fireAltQueued = false;
    }
  }

  applyRemotePlayerCombat(client, state, input, dt) {
    if (!client || !state || !input || state.alive === false || (state.health || 0) <= 0) return;
    const wantsPrimary = !!input.firePrimaryQueued || (!!input.firePrimaryHeld && !!input.hasAim);
    if (state.classType === "necromancer") {
      this.processRemoteNecromancerBeam(state, input, dt);
    } else if (wantsPrimary) {
      this.performActionForActivePlayer(client.id, (context) => {
        if (typeof context.fire !== "function") return false;
        context.fire(state.dirX || 1, state.dirY || 0);
        return true;
      });
    }
    if (!input.fireAltQueued) return;
    if (state.classType === "archer") {
      this.performActionForActivePlayer(client.id, (context) => {
        if (typeof context.fireFireArrow !== "function") return false;
        context.fireFireArrow(state.dirX || 1, state.dirY || 0);
        return true;
      });
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
      this.performActionForActivePlayer(client.id, (context) => {
        if (typeof context.fireDeathBolt !== "function") return false;
        return context.fireDeathBolt(state.dirX || 1, state.dirY || 0);
      });
    }
  }

  getActivePlayerStates() {
    return Array.from(this.activePlayers.values());
  }

  getLastInputSeqByPlayer() {
    const out = {};
    for (const client of this.clients.values()) {
      out[client.id] = Number.isFinite(client.lastInputSeq) ? client.lastInputSeq : 0;
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
    this.deltaCache = {
      enemies: new Map(),
      drops: new Map(),
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
      bullet: 1,
      fireArrow: 1,
      fireZone: 1,
      meleeSwing: 1,
      armorStand: 1,
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
      breakable: new WeakMap(),
      wallTrap: new WeakMap()
    };
    for (const client of this.clients.values()) {
      client.input = this.options.makeDefaultInput();
      client.lastInputSeq = 0;
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
    if (typeof this.sim.ensurePlayerSafePosition === "function") this.sim.ensurePlayerSafePosition(12);
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
    this.sim.networkActivePlayers = this.getSimulationPlayerEntities();
    this.sim.tick(dt, this.getControllerInput());
    this.updateRemoteActivePlayers(dt);
    this.syncPrimaryActivePlayerFromSim();
    if (this.sim.gameOver && !this.finalResults) {
      this.finalResults = this.buildFinalResults();
    }
    if (typeof this.sim.ensurePlayerSafePosition === "function") this.sim.ensurePlayerSafePosition(12);
    const controllerClient = this.clients.get(this.pauseOwnerId);
    const taggedSeq = controllerClient ? controllerClient.input?.seq || controllerClient.lastInputSeq || 0 : 0;
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
      phase: this.phase,
      ownerId: this.roomOwnerId,
      pauseOwnerId: this.pauseOwnerId,
      controllerId: this.pauseOwnerId,
      requestedStartFloor: this.requestedStartFloor,
      lobbyCountdownEndsAt: this.lobbyCountdownEndsAt || 0,
      lobbyCountdownRemainingMs: this.getLobbyCountdownRemainingMs(),
      lobbyInlineMessage: this.lobbyInlineMessage,
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
      }))
    };
    if (toClient) {
      if (toClient.ws.readyState === toClient.ws.OPEN) {
        toClient.ws.send(JSON.stringify({ type: "state.map", roomId: this.id, ...payload }));
      }
      return;
    }
    this.broadcast("state.map", payload);
  }

  sendMapChunksToClient(client, nowMs = Date.now()) {
    if (!client || client.ws.readyState !== client.ws.OPEN) return;
    const chunkState = this.clientChunkState.get(client.id);
    if (!chunkState) return;
    const tile = this.sim.config.map.tile || 32;
    const chunkPlayer = this.activePlayers.get(client.id) || this.sim.player;
    const ptx = Math.floor((chunkPlayer?.x || 0) / tile);
    const pty = Math.floor((chunkPlayer?.y || 0) / tile);
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
    for (const client of this.clients.values()) this.sendMapChunksToClient(client, nowMs);
    const controllerClient = this.clients.get(this.pauseOwnerId);
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
    if (keyframe || enemyDelta) delta.enemies = enemyDelta || {};
    if (keyframe || dropDelta) delta.drops = dropDelta || {};
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
      phase: this.phase,
      ownerId: this.roomOwnerId,
      pauseOwnerId: this.pauseOwnerId,
      controllerId: this.pauseOwnerId,
      lastInputSeq: controllerClient ? controllerClient.lastInputSeq : 0,
      lastInputSeqByPlayer: this.getLastInputSeqByPlayer(),
      mapSignature: sig,
      state
    });
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
