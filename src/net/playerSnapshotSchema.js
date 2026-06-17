export const PLAYER_SNAPSHOT_FIELDS = [
  "x",
  "y",
  "size",
  "health",
  "maxHealth",
  "hpBarTimer",
  "level",
  "score",
  "gold",
  "experience",
  "expToNextLevel",
  "skillPoints",
  "refundCount",
  "treasureKeys",
  "levelWeaponDamageBonus",
  "lanternFuel",
  "skills",
  "rangerTalents",
  "warriorTalents",
  "necromancerTalents",
  "rangerRuntime",
  "warriorRuntime",
  "necromancerRuntime",
  "consumableRuntime",
  "consumables",
  "upgrades",
  "dirX",
  "dirY",
  "facing",
  "teleportSeq",
  "classType"
];

export const ACTIVE_PLAYER_SNAPSHOT_FIELDS = [
  "id",
  "handle",
  "classType",
  "x",
  "y",
  "size",
  "health",
  "maxHealth",
  "hpBarTimer",
  "level",
  "score",
  "gold",
  "experience",
  "expToNextLevel",
  "skillPoints",
  "refundCount",
  "treasureKeys",
  "levelWeaponDamageBonus",
  "lanternFuel",
  "fireCooldown",
  "fireArrowCooldown",
  "deathBoltCooldown",
  "warriorMomentumTimer",
  "warriorRageActiveTimer",
  "warriorRageCooldownTimer",
  "warriorRageVictoryRushPool",
  "warriorRageVictoryRushTimer",
  "skills",
  "rangerTalents",
  "warriorTalents",
  "necromancerTalents",
  "upgrades",
  "consumableRuntime",
  "consumables",
  "rangerRuntime",
  "warriorRuntime",
  "necromancerRuntime",
  "dirX",
  "dirY",
  "facing",
  "teleportSeq",
  "moving",
  "alive",
  "spectateTargetId",
  "color"
];

function copySnapshotFields(source, fields) {
  const out = {};
  for (const field of fields) out[field] = source?.[field];
  if (!Number.isFinite(out.hpBarTimer)) out.hpBarTimer = 0;
  return out;
}

export function createNecromancerBeamSnapshot(beam) {
  if (!beam) return null;
  return {
    active: !!beam.active,
    targetId: typeof beam.targetId === "string" ? beam.targetId : null,
    targetX: Number.isFinite(beam.targetX) ? beam.targetX : 0,
    targetY: Number.isFinite(beam.targetY) ? beam.targetY : 0,
    progress: Number.isFinite(beam.progress) ? beam.progress : 0
  };
}

export function createPlayerSnapshot(player) {
  return copySnapshotFields(player, PLAYER_SNAPSHOT_FIELDS);
}

export function createActivePlayerSnapshot(player) {
  const out = copySnapshotFields(player, ACTIVE_PLAYER_SNAPSHOT_FIELDS);
  out.necromancerBeam = createNecromancerBeamSnapshot(player?.necromancerBeam);
  out.moving = !!player?.moving;
  out.alive = player?.alive !== false;
  out.spectateTargetId = typeof player?.spectateTargetId === "string" ? player.spectateTargetId : "";
  return out;
}

export function applyPlayerSnapshotToGameState(game, snapshotPlayer, { isNetworkController = false, syncNamedObject } = {}) {
  if (!game || !snapshotPlayer || typeof snapshotPlayer !== "object") return;
  if (Number.isFinite(snapshotPlayer.health)) game.player.health = snapshotPlayer.health;
  if (Number.isFinite(snapshotPlayer.maxHealth)) game.player.maxHealth = snapshotPlayer.maxHealth;
  if (Number.isFinite(snapshotPlayer.fireCooldown)) game.player.fireCooldown = snapshotPlayer.fireCooldown;
  if (Number.isFinite(snapshotPlayer.fireArrowCooldown)) game.player.fireArrowCooldown = snapshotPlayer.fireArrowCooldown;
  if (Number.isFinite(snapshotPlayer.deathBoltCooldown)) game.player.deathBoltCooldown = snapshotPlayer.deathBoltCooldown;
  if (Number.isFinite(snapshotPlayer.hitCooldown)) game.player.hitCooldown = snapshotPlayer.hitCooldown;
  if (Number.isFinite(snapshotPlayer.hpBarTimer)) game.player.hpBarTimer = snapshotPlayer.hpBarTimer;
  if (Number.isFinite(snapshotPlayer.teleportSeq)) game.player.teleportSeq = snapshotPlayer.teleportSeq;
  game.player.classType = snapshotPlayer.classType;
  if (typeof snapshotPlayer.classType === "string" && game.config?.classes?.[snapshotPlayer.classType]) {
    game.classType = snapshotPlayer.classType;
    game.classSpec = game.config.classes[snapshotPlayer.classType];
  }
  if (!isNetworkController) {
    if (Number.isFinite(snapshotPlayer.dirX)) game.player.dirX = snapshotPlayer.dirX;
    if (Number.isFinite(snapshotPlayer.dirY)) game.player.dirY = snapshotPlayer.dirY;
    if (Number.isFinite(snapshotPlayer.facing)) game.player.facing = snapshotPlayer.facing;
  }
  if (Number.isFinite(snapshotPlayer.level)) game.level = snapshotPlayer.level;
  if (Number.isFinite(snapshotPlayer.score)) game.score = snapshotPlayer.score;
  if (Number.isFinite(snapshotPlayer.gold)) game.gold = snapshotPlayer.gold;
  if (Number.isFinite(snapshotPlayer.experience)) game.experience = snapshotPlayer.experience;
  if (Number.isFinite(snapshotPlayer.expToNextLevel)) game.expToNextLevel = snapshotPlayer.expToNextLevel;
  if (Number.isFinite(snapshotPlayer.skillPoints)) game.skillPoints = snapshotPlayer.skillPoints;
  if (Number.isFinite(snapshotPlayer.refundCount)) game.refundCount = snapshotPlayer.refundCount;
  if (Number.isFinite(snapshotPlayer.treasureKeys)) game.treasureKeys = snapshotPlayer.treasureKeys;
  if (Number.isFinite(snapshotPlayer.levelWeaponDamageBonus)) game.levelWeaponDamageBonus = snapshotPlayer.levelWeaponDamageBonus;
  if (Number.isFinite(snapshotPlayer.lanternFuel)) game.player.lanternFuel = snapshotPlayer.lanternFuel;
  if (Number.isFinite(snapshotPlayer.warriorMomentumTimer)) game.warriorMomentumTimer = snapshotPlayer.warriorMomentumTimer;
  if (Number.isFinite(snapshotPlayer.warriorRageActiveTimer)) game.warriorRageActiveTimer = snapshotPlayer.warriorRageActiveTimer;
  if (Number.isFinite(snapshotPlayer.warriorRageCooldownTimer)) game.warriorRageCooldownTimer = snapshotPlayer.warriorRageCooldownTimer;
  if (Number.isFinite(snapshotPlayer.warriorRageVictoryRushPool)) game.warriorRageVictoryRushPool = snapshotPlayer.warriorRageVictoryRushPool;
  if (Number.isFinite(snapshotPlayer.warriorRageVictoryRushTimer)) game.warriorRageVictoryRushTimer = snapshotPlayer.warriorRageVictoryRushTimer;
  if (snapshotPlayer.necromancerBeam && typeof snapshotPlayer.necromancerBeam === "object") {
    game.necromancerBeam = {
      ...(game.necromancerBeam && typeof game.necromancerBeam === "object" ? game.necromancerBeam : {}),
      ...snapshotPlayer.necromancerBeam
    };
  } else if (game.necromancerBeam && typeof game.necromancerBeam === "object") {
    game.necromancerBeam.active = false;
    game.necromancerBeam.targetId = null;
    game.necromancerBeam.progress = 0;
  }
  if (typeof syncNamedObject !== "function") return;
  if (snapshotPlayer.skills && typeof snapshotPlayer.skills === "object") game.skills = syncNamedObject(game.skills, snapshotPlayer.skills);
  if (snapshotPlayer.rangerTalents && typeof snapshotPlayer.rangerTalents === "object") {
    game.rangerTalents = syncNamedObject(game.rangerTalents, snapshotPlayer.rangerTalents);
    if (game.player) game.player.rangerTalents = game.rangerTalents;
  }
  if (snapshotPlayer.warriorTalents && typeof snapshotPlayer.warriorTalents === "object") {
    game.warriorTalents = syncNamedObject(game.warriorTalents, snapshotPlayer.warriorTalents);
    if (game.player) game.player.warriorTalents = game.warriorTalents;
  }
  if (snapshotPlayer.necromancerTalents && typeof snapshotPlayer.necromancerTalents === "object") {
    game.necromancerTalents = syncNamedObject(game.necromancerTalents, snapshotPlayer.necromancerTalents);
    if (game.player) game.player.necromancerTalents = game.necromancerTalents;
  }
  if (snapshotPlayer.rangerRuntime && typeof snapshotPlayer.rangerRuntime === "object") {
    game.rangerRuntime = syncNamedObject(game.rangerRuntime, snapshotPlayer.rangerRuntime);
    if (game.player) game.player.rangerRuntime = game.rangerRuntime;
  }
  if (snapshotPlayer.warriorRuntime && typeof snapshotPlayer.warriorRuntime === "object") {
    game.warriorRuntime = syncNamedObject(game.warriorRuntime, snapshotPlayer.warriorRuntime);
    if (game.player) game.player.warriorRuntime = game.warriorRuntime;
  }
  if (snapshotPlayer.necromancerRuntime && typeof snapshotPlayer.necromancerRuntime === "object") {
    game.necromancerRuntime = syncNamedObject(game.necromancerRuntime, snapshotPlayer.necromancerRuntime);
    if (game.player) game.player.necromancerRuntime = game.necromancerRuntime;
  }
  if (snapshotPlayer.upgrades && typeof snapshotPlayer.upgrades === "object") game.upgrades = syncNamedObject(game.upgrades, snapshotPlayer.upgrades);
  if (snapshotPlayer.consumableRuntime && typeof snapshotPlayer.consumableRuntime === "object") {
    game.player.consumableRuntime = syncNamedObject(game.player.consumableRuntime, snapshotPlayer.consumableRuntime);
  }
  if (snapshotPlayer.consumables && typeof snapshotPlayer.consumables === "object") {
    game.consumables = syncNamedObject(game.consumables, snapshotPlayer.consumables);
  }
  if (typeof snapshotPlayer.classType === "string" && game.config?.classes?.[snapshotPlayer.classType]) {
    game.classType = snapshotPlayer.classType;
    game.classSpec = game.config.classes[snapshotPlayer.classType];
  }
}
