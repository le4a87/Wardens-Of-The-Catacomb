import { createRangerTalentState, cloneRangerTalentState } from "../../src/game/rangerTalentTree.js";
import { createWarriorTalentState, cloneWarriorTalentState } from "../../src/game/warriorTalentTree.js";
import { createNecromancerTalentState, cloneNecromancerTalentState } from "../../src/game/necromancerTalentTree.js";
import { cloneConsumableInventoryState } from "../../src/game/consumables.js";
import {
  cloneNecromancerBeamState,
  cloneNecromancerRuntimeState,
  cloneRangerRuntimeState,
  cloneSkillState,
  cloneUpgradeState,
  cloneWarriorRuntimeState
} from "./playerStateCloneHelpers.js";

export function createActivePlayerStateForRoom(room, client, spawn = null) {
  const classSpec = room.getClassSpec(client?.classType);
  const baseMaxHealth = Number.isFinite(classSpec.baseMaxHealth) ? classSpec.baseMaxHealth : room.sim.config?.player?.maxHealth || 100;
  const x = Number.isFinite(spawn?.x) ? spawn.x : room.sim.player?.x || 0;
  const y = Number.isFinite(spawn?.y) ? spawn.y : room.sim.player?.y || 0;
  return {
    id: client.id,
    handle: client.name,
    classType: client.classType,
    x,
    y,
    size: Number.isFinite(room.sim.player?.size) ? room.sim.player.size : 22,
    speed: Number.isFinite(classSpec.baseMoveSpeed) ? classSpec.baseMoveSpeed : room.sim.config?.player?.speed || 180,
    health: baseMaxHealth,
    maxHealth: baseMaxHealth,
    level: 1,
    score: 0,
    gold: 0,
    experience: 0,
    expToNextLevel: room.sim.config?.progression?.baseXpToLevel || 10,
    skillPoints: 0,
    refundCount: 0,
    treasureKeys: 0,
    levelWeaponDamageBonus: 0,
    lanternFuel: Number.isFinite(spawn?.lanternFuel) ? spawn.lanternFuel : room.sim.config?.lighting?.lanternInitialFuel,
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
    necromancerRuntime: cloneNecromancerRuntimeState(),
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
    spectateTargetId: "",
    color: room.getClientRunColor(client)
  };
}

export function syncSimPrimaryPlayerStateForRoom(room) {
  if (!room.pauseOwnerId) return null;
  const client = room.clients.get(room.pauseOwnerId);
  const state = client ? room.activePlayers.get(client.id) : null;
  if (!client || !state) return null;
  const classSpec = room.getClassSpec(state.classType);
  room.sim.classType = state.classType;
  room.sim.classSpec = classSpec;
  room.sim.player.classType = state.classType;
  room.sim.player.id = state.id;
  room.sim.player.handle = state.handle;
  room.sim.player.color = state.color;
  room.sim.player.x = Number.isFinite(state.x) ? state.x : room.sim.player.x;
  room.sim.player.y = Number.isFinite(state.y) ? state.y : room.sim.player.y;
  room.sim.player.size = Number.isFinite(state.size) ? state.size : room.sim.player.size;
  room.sim.player.speed = Number.isFinite(state.speed) ? state.speed : room.sim.player.speed;
  room.sim.player.health = Number.isFinite(state.health) ? state.health : room.sim.player.health;
  room.sim.player.maxHealth = Number.isFinite(state.maxHealth) ? state.maxHealth : room.sim.player.maxHealth;
  room.sim.player.alive = room.sim.player.health > 0;
  room.sim.player.fireCooldown = Number.isFinite(state.fireCooldown) ? state.fireCooldown : 0;
  room.sim.player.fireArrowCooldown = Number.isFinite(state.fireArrowCooldown) ? state.fireArrowCooldown : 0;
  room.sim.player.deathBoltCooldown = Number.isFinite(state.deathBoltCooldown) ? state.deathBoltCooldown : 0;
  room.sim.player.hitCooldown = Number.isFinite(state.hitCooldown) ? state.hitCooldown : 0;
  room.sim.player.hpBarTimer = Number.isFinite(state.hpBarTimer) ? state.hpBarTimer : 0;
  room.sim.player.animTime = Number.isFinite(state.animTime) ? state.animTime : 0;
  room.sim.player.dirX = Number.isFinite(state.dirX) ? state.dirX : room.sim.player.dirX;
  room.sim.player.dirY = Number.isFinite(state.dirY) ? state.dirY : room.sim.player.dirY;
  room.sim.player.facing = Number.isFinite(state.facing) ? state.facing : room.sim.player.facing;
  room.sim.player.moving = !!state.moving;
  room.sim.level = Number.isFinite(state.level) ? state.level : room.sim.level;
  room.sim.score = Number.isFinite(state.score) ? state.score : room.sim.score;
  room.sim.gold = Number.isFinite(state.gold) ? state.gold : room.sim.gold;
  room.sim.experience = Number.isFinite(state.experience) ? state.experience : room.sim.experience;
  room.sim.expToNextLevel = Number.isFinite(state.expToNextLevel) ? state.expToNextLevel : room.sim.expToNextLevel;
  room.sim.skillPoints = Number.isFinite(state.skillPoints) ? state.skillPoints : room.sim.skillPoints;
  room.sim.refundCount = Number.isFinite(state.refundCount) ? state.refundCount : room.sim.refundCount;
  room.sim.treasureKeys = Number.isFinite(state.treasureKeys) ? state.treasureKeys : room.sim.treasureKeys;
  room.sim.levelWeaponDamageBonus = Number.isFinite(state.levelWeaponDamageBonus) ? state.levelWeaponDamageBonus : room.sim.levelWeaponDamageBonus;
  room.sim.skills = cloneSkillState(state.skills);
  room.sim.rangerTalents = cloneRangerTalentState(state.rangerTalents);
  room.sim.warriorTalents = cloneWarriorTalentState(state.warriorTalents);
  room.sim.necromancerTalents = cloneNecromancerTalentState(state.necromancerTalents);
  room.sim.upgrades = cloneUpgradeState(state.upgrades);
  room.sim.consumables = cloneConsumableInventoryState(state.consumables);
  room.sim.rangerRuntime = cloneRangerRuntimeState(state.rangerRuntime);
  room.sim.warriorRuntime = cloneWarriorRuntimeState(state.warriorRuntime);
  room.sim.necromancerRuntime = cloneNecromancerRuntimeState(state.necromancerRuntime);
  room.sim.player.necromancerRuntime = room.sim.necromancerRuntime;
  room.sim.player.consumableRuntime = {
    tempHp: Number.isFinite(state?.consumableRuntime?.tempHp) ? state.consumableRuntime.tempHp : 0
  };
  room.sim.warriorMomentumTimer = Number.isFinite(state.warriorMomentumTimer) ? state.warriorMomentumTimer : 0;
  room.sim.warriorRageActiveTimer = Number.isFinite(state.warriorRageActiveTimer) ? state.warriorRageActiveTimer : 0;
  room.sim.warriorRageCooldownTimer = Number.isFinite(state.warriorRageCooldownTimer) ? state.warriorRageCooldownTimer : 0;
  room.sim.warriorRageVictoryRushPool = Number.isFinite(state.warriorRageVictoryRushPool) ? state.warriorRageVictoryRushPool : 0;
  room.sim.warriorRageVictoryRushTimer = Number.isFinite(state.warriorRageVictoryRushTimer) ? state.warriorRageVictoryRushTimer : 0;
  room.sim.necromancerBeam = cloneNecromancerBeamState(state.necromancerBeam);
  return state;
}

export function syncPrimaryActivePlayerFromSimForRoom(room) {
  if (!room.pauseOwnerId) return null;
  const client = room.clients.get(room.pauseOwnerId);
  if (!client) return null;
  const state = room.activePlayers.get(client.id) || createActivePlayerStateForRoom(room, client, room.sim.player);
  state.handle = client.name;
  state.classType = client.classType;
  state.x = room.sim.player.x;
  state.y = room.sim.player.y;
  state.size = room.sim.player.size;
  state.health = room.sim.player.health;
  state.maxHealth = room.sim.player.maxHealth;
  state.fireCooldown = room.sim.player.fireCooldown;
  state.fireArrowCooldown = room.sim.player.fireArrowCooldown;
  state.deathBoltCooldown = room.sim.player.deathBoltCooldown;
  state.skills = cloneSkillState(room.sim.skills);
  state.rangerTalents = cloneRangerTalentState(room.sim.rangerTalents);
  state.warriorTalents = cloneWarriorTalentState(room.sim.warriorTalents);
  state.necromancerTalents = cloneNecromancerTalentState(room.sim.necromancerTalents);
  state.upgrades = cloneUpgradeState(room.sim.upgrades);
  state.consumables = cloneConsumableInventoryState(room.sim.consumables);
  state.rangerRuntime = cloneRangerRuntimeState(room.sim.rangerRuntime);
  state.warriorRuntime = cloneWarriorRuntimeState(room.sim.warriorRuntime);
  state.necromancerRuntime = cloneNecromancerRuntimeState(room.sim.necromancerRuntime);
  state.score = room.sim.score;
  state.gold = room.sim.gold;
  state.experience = room.sim.experience;
  state.expToNextLevel = room.sim.expToNextLevel;
  state.skillPoints = room.sim.skillPoints;
  state.refundCount = Number.isFinite(room.sim.refundCount) ? room.sim.refundCount : 0;
  state.treasureKeys = Number.isFinite(room.sim.treasureKeys) ? room.sim.treasureKeys : 0;
  state.levelWeaponDamageBonus = room.sim.levelWeaponDamageBonus;
  state.lanternFuel = room.sim.player.lanternFuel;
  state.kills = room.sim.runStats?.totalKills || 0;
  state.damageDealt = room.sim.runStats?.damageDealt || 0;
  state.goldEarned = room.sim.runStats?.goldEarned || 0;
  state.warriorMomentumTimer = room.sim.warriorMomentumTimer || 0;
  state.warriorRageActiveTimer = room.sim.warriorRageActiveTimer || 0;
  state.warriorRageCooldownTimer = room.sim.warriorRageCooldownTimer || 0;
  state.warriorRageVictoryRushPool = room.sim.warriorRageVictoryRushPool || 0;
  state.warriorRageVictoryRushTimer = room.sim.warriorRageVictoryRushTimer || 0;
  state.necromancerBeam = cloneNecromancerBeamState(room.sim.necromancerBeam);
  state.hitCooldown = room.sim.player.hitCooldown;
  state.hpBarTimer = room.sim.player.hpBarTimer;
  state.animTime = room.sim.player.animTime;
  state.level = room.sim.level;
  state.dirX = room.sim.player.dirX;
  state.dirY = room.sim.player.dirY;
  state.facing = room.sim.player.facing;
  state.moving = !!room.sim.player.moving;
  state.alive = room.sim.player.health > 0;
  state.spectateTargetId = state.alive ? "" : (typeof client.input?.spectateTargetId === "string" ? client.input.spectateTargetId : "");
  state.consumableRuntime = {
    tempHp: Number.isFinite(room.sim.player?.consumableRuntime?.tempHp) ? room.sim.player.consumableRuntime.tempHp : 0
  };
  state.color = room.getClientRunColor(client);
  room.activePlayers.set(client.id, state);
  return state;
}

export function createPlayerSimulationContextForRoom(room, state) {
  if (!state) return null;
  const context = Object.create(room.sim);
  context.player = state;
  context.classType = state.classType;
  context.classSpec = room.getClassSpec(state.classType);
  context.level = Number.isFinite(state.level) ? state.level : 1;
  context.score = Number.isFinite(state.score) ? state.score : 0;
  context.gold = Number.isFinite(state.gold) ? state.gold : 0;
  context.experience = Number.isFinite(state.experience) ? state.experience : 0;
  context.expToNextLevel = Number.isFinite(state.expToNextLevel)
    ? state.expToNextLevel
    : room.sim.config?.progression?.baseXpToLevel || 10;
  context.skillPoints = Number.isFinite(state.skillPoints) ? state.skillPoints : 0;
  context.refundCount = Number.isFinite(state.refundCount) ? state.refundCount : 0;
  context.treasureKeys = Number.isFinite(state.treasureKeys) ? state.treasureKeys : 0;
  context.levelWeaponDamageBonus = Number.isFinite(state.levelWeaponDamageBonus) ? state.levelWeaponDamageBonus : 0;
  context.skills = cloneSkillState(state.skills);
  context.rangerTalents = cloneRangerTalentState(state.rangerTalents);
  context.warriorTalents = cloneWarriorTalentState(state.warriorTalents);
  context.necromancerTalents = cloneNecromancerTalentState(state.necromancerTalents);
  context.upgrades = cloneUpgradeState(state.upgrades);
  context.consumables = cloneConsumableInventoryState(state.consumables);
  context.rangerRuntime = cloneRangerRuntimeState(state.rangerRuntime);
  context.warriorRuntime = cloneWarriorRuntimeState(state.warriorRuntime);
  context.necromancerRuntime = cloneNecromancerRuntimeState(state.necromancerRuntime);
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

export function syncActivePlayerStateFromContextForRoom(state, context) {
  if (!state || !context) return;
  state.classType = context.classType;
  state.level = Number.isFinite(context.level) ? context.level : state.level;
  state.score = Number.isFinite(context.score) ? context.score : state.score;
  state.gold = Number.isFinite(context.gold) ? context.gold : state.gold;
  state.experience = Number.isFinite(context.experience) ? context.experience : state.experience;
  state.expToNextLevel = Number.isFinite(context.expToNextLevel) ? context.expToNextLevel : state.expToNextLevel;
  state.skillPoints = Number.isFinite(context.skillPoints) ? context.skillPoints : state.skillPoints;
  state.refundCount = Number.isFinite(context.refundCount) ? context.refundCount : state.refundCount;
  state.treasureKeys = Number.isFinite(context.treasureKeys) ? context.treasureKeys : state.treasureKeys;
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
  state.necromancerRuntime = cloneNecromancerRuntimeState(context.necromancerRuntime);
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
