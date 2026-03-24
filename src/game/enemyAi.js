import { vecLength } from "../utils.js";
import { applyGoblinGrowth, findNearestGoldDrop } from "./enemyRewards.js";
import {
  getEnemyAttackOwnerId,
  getPriorityTarget,
  hasLineOfSight,
  isProjectileThreatening,
  isFriendlyToPlayer,
  moveEnemyTowardPoint
} from "./enemyAiShared.js";
export { updateLeprechaunBoss } from "./enemyLeprechaunAi.js";

export { updateMinotaur, updateNecromancer, updateRatArcher, updateSkeletonWarrior } from "./enemyAdvancedAi.js";

export function updateGhost(game, enemy, dt, speedScale) {
  const ownerId = getEnemyAttackOwnerId(game, enemy);
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  const tile = game.config?.map?.tile || 32;
  const target = getPriorityTarget(game, enemy, tile * 12);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  const dirX = dx / dist;
  const dirY = dy / dist;
  const perpX = -dirY;
  const perpY = dirX;
  const preferredRange = Math.max(tile, (game.config.enemy.ghostPreferredRangeTiles || 2.8) * tile);
  const retreatRange = Math.max(tile * 0.75, (game.config.enemy.ghostRetreatRangeTiles || 1.3) * tile);
  const siphonRange = Math.max(tile * 0.75, (game.config.enemy.ghostSiphonRangeTiles || 1.45) * tile);
  const strafeScale = Math.max(0.2, game.config.enemy.ghostOrbitStrafeScale || 0.8);
  const approachScale = Math.max(0.2, game.config.enemy.ghostOrbitApproachScale || 0.7);
  const siphonTickInterval = Math.max(0.04, game.config.enemy.ghostSiphonTickInterval || 0.12);
  const siphonDps = Math.max(1, game.config.enemy.ghostSiphonDps || 9);
  const diveIntervalMin = Math.max(0.4, game.config.enemy.ghostDiveIntervalMin || 1.8);
  const diveIntervalMax = Math.max(diveIntervalMin, game.config.enemy.ghostDiveIntervalMax || 3.4);
  const diveDurationMax = Math.max(0.2, game.config.enemy.ghostDiveDuration || 0.65);
  const diveAttackRange = Math.max(tile * 0.4, (game.config.enemy.ghostDiveAttackRangeTiles || 0.95) * tile);
  enemy.siphoning = false;

  enemy.orbitSwapTimer = Math.max(0, (enemy.orbitSwapTimer || 0) - dt);
  enemy.siphonTickTimer = Math.max(0, (enemy.siphonTickTimer || 0) - dt);
  enemy.diveTimer = Math.max(0, (enemy.diveTimer || 0) - dt);
  enemy.diveDuration = Math.max(0, (enemy.diveDuration || 0) - dt);
  if (enemy.orbitSwapTimer <= 0) {
    const swapMin = Math.max(0.2, game.config.enemy.ghostOrbitSwapTimeMin || 0.9);
    const swapMax = Math.max(swapMin, game.config.enemy.ghostOrbitSwapTimeMax || 1.6);
    const swapChance = Math.max(0, Math.min(1, Number.isFinite(game.config.enemy.ghostOrbitSwapChance) ? game.config.enemy.ghostOrbitSwapChance : 0.45));
    enemy.orbitSwapTimer = swapMin + Math.random() * Math.max(0, swapMax - swapMin);
    if (Math.random() < swapChance) enemy.orbitDir = (enemy.orbitDir || 1) * -1;
  }
  if (enemy.diveDuration <= 0 && enemy.diveTimer <= 0) {
    enemy.diveDuration = diveDurationMax;
    enemy.diveTimer = diveIntervalMin + Math.random() * Math.max(0, diveIntervalMax - diveIntervalMin);
  }

  if (dist <= siphonRange) {
    enemy.siphoning = true;
    game.fireZones.push({
      zoneType: "ghostSiphon",
      x: enemy.x,
      y: enemy.y,
      targetX: target.x,
      targetY: target.y,
      life: 0.14
    });
  }

  while (dist <= siphonRange && enemy.siphonTickTimer <= 0) {
    enemy.siphonTickTimer += siphonTickInterval;
    const scaledDamage = siphonDps * siphonTickInterval * game.getEnemyDamageScale();
    if (game.isPlayerEntity && game.isPlayerEntity(target)) {
      game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledDamage, "unholy"), "unholy");
    } else if (target && (target.hp || 0) > 0) {
      game.applyEnemyDamage(target, scaledDamage, "necrotic", ownerId);
    }
  }

  if (enemy.diveDuration > 0) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "dive");
    moveEnemyTowardPoint(game, enemy, target, dt, speedScale * 1.08, Math.max(0, diveAttackRange * 0.2));
    if (dist <= diveAttackRange && (enemy.contactAttackCooldown || 0) <= 0) {
      enemy.contactAttackCooldown = 0.7;
      enemy.diveDuration = 0;
      if (game.isPlayerEntity && game.isPlayerEntity(target)) {
        if ((target.hitCooldown || 0) <= 0) {
          target.hitCooldown = 1.0;
          const rawDamage = game.rollEnemyContactDamage(enemy);
          const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
          game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledEnemyDamage, "physical"), "physical");
        }
      } else if (target && (target.hp || 0) > 0) {
        game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical", ownerId);
      }
    }
    return;
  }

  if (dist < retreatRange) {
    moveEnemyTowardPoint(game, enemy, { x: enemy.x - dirX * preferredRange, y: enemy.y - dirY * preferredRange }, dt, speedScale);
    return;
  }

  const orbitX = target.x - dirX * preferredRange + perpX * (enemy.orbitDir || 1) * preferredRange * 0.7;
  const orbitY = target.y - dirY * preferredRange + perpY * (enemy.orbitDir || 1) * preferredRange * 0.7;
  const orbitTarget = { x: orbitX, y: orbitY };
  if (dist > preferredRange * 1.22) {
    moveEnemyTowardPoint(game, enemy, target, dt, speedScale * approachScale, preferredRange * 0.9);
    return;
  }
  moveEnemyTowardPoint(game, enemy, orbitTarget, dt, speedScale * strafeScale);
}

export function updateGoblin(game, enemy, dt, speedScale) {
  const ownerId = getEnemyAttackOwnerId(game, enemy);
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  const strongThreshold = Number.isFinite(game.config.enemy.goblinStrongGoldThreshold) ? game.config.enemy.goblinStrongGoldThreshold : 20;
  const fearRadius = Number.isFinite(game.config.enemy.goblinFearRadius) ? game.config.enemy.goblinFearRadius : 220;
  const feedSearchRadius = (Number.isFinite(game.config.enemy.goblinFeedSearchRadiusTiles) ? game.config.enemy.goblinFeedSearchRadiusTiles : 8) * (game.config?.map?.tile || 32);
  const enrageRange = (Number.isFinite(game.config.enemy.goblinEnrageRangeTiles) ? game.config.enemy.goblinEnrageRangeTiles : 1.5) * (game.config?.map?.tile || 32);
  const fearBlend = Number.isFinite(game.config.enemy.goblinFearBlend) ? game.config.enemy.goblinFearBlend : 0.25;
  const wanderJitter = Number.isFinite(game.config.enemy.goblinWanderJitter) ? game.config.enemy.goblinWanderJitter : 1.8;
  const aggroPursuitRadius = Number.isFinite(game.config.enemy.goblinAggroPursuitRadius) ? game.config.enemy.goblinAggroPursuitRadius : fearRadius * 1.35;
  const isStrong = enemy.goldEaten >= strongThreshold;
  const threat = getPriorityTarget(game, enemy, aggroPursuitRadius);
  const toPlayerX = threat.x - enemy.x;
  const toPlayerY = threat.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const awayPlayerX = -toPlayerX / playerDist;
  const awayPlayerY = -toPlayerY / playerDist;
  const targetGold = findNearestGoldDrop(game, enemy.x, enemy.y);
  const targetGoldDist = targetGold ? vecLength(targetGold.x - enemy.x, targetGold.y - enemy.y) : Number.POSITIVE_INFINITY;
  let nextStage = "scared";
  if (isStrong) nextStage = "enraged";
  else if (targetGold && targetGoldDist <= feedSearchRadius) nextStage = "feeding";
  enemy.growthStage = nextStage;
  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, nextStage);

  if (targetGold) {
    const toGoldX = targetGold.x - enemy.x;
    const toGoldY = targetGold.y - enemy.y;
    const goldLen = vecLength(toGoldX, toGoldY) || 1;
    let dirX = toGoldX / goldLen;
    let dirY = toGoldY / goldLen;
    if (!isStrong && playerDist < fearRadius) {
      dirX = dirX * (1 - fearBlend) + awayPlayerX * fearBlend;
      dirY = dirY * (1 - fearBlend) + awayPlayerY * fearBlend;
    }
    const dirLen = vecLength(dirX, dirY) || 1;
    moveEnemyTowardPoint(game, enemy, { x: enemy.x + (dirX / dirLen) * 96, y: enemy.y + (dirY / dirLen) * 96 }, dt, speedScale);
    if (goldLen < enemy.size * 0.45 + targetGold.size * 0.75) {
      targetGold.life = 0;
      applyGoblinGrowth(game, enemy, targetGold.amount);
    }
    return;
  }
  if (!isStrong && playerDist < fearRadius * 1.2) {
    moveEnemyTowardPoint(game, enemy, { x: enemy.x + awayPlayerX * 96, y: enemy.y + awayPlayerY * 96 }, dt, speedScale);
    enemy.wanderAngle = Math.atan2(awayPlayerY, awayPlayerX);
    return;
  }
  if (isStrong && playerDist <= enrageRange) {
    if (game.isPlayerEntity && game.isPlayerEntity(threat) && (threat.hitCooldown || 0) <= 0) {
      threat.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      game.applyDamageToPlayerEntity(threat, game.getDamageTakenForPlayerEntity(threat, scaledEnemyDamage, "physical"), "physical");
      enemy.contactAttackCooldown = 0.55;
    } else if (!game.isPlayerEntity || !game.isPlayerEntity(threat)) {
      game.applyEnemyDamage(threat, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical", ownerId);
      enemy.contactAttackCooldown = 0.55;
    }
    return;
  }
  enemy.wanderTimer -= dt;
  if (enemy.wanderTimer <= 0) {
    enemy.wanderTimer = 0.6 + Math.random() * 1.2;
    enemy.wanderAngle += (Math.random() - 0.5) * wanderJitter;
  }
  const pursueX = toPlayerX / playerDist;
  const pursueY = toPlayerY / playerDist;
  const wanderX = Math.cos(enemy.wanderAngle);
  const wanderY = Math.sin(enemy.wanderAngle);
  const vx = wanderX * (1 - enemy.aggression) + pursueX * enemy.aggression;
  const vy = wanderY * (1 - enemy.aggression) + pursueY * enemy.aggression;
  const len = vecLength(vx, vy) || 1;
  moveEnemyTowardPoint(game, enemy, { x: enemy.x + (vx / len) * 96, y: enemy.y + (vy / len) * 96 }, dt, speedScale);
  enemy.wanderAngle = Math.atan2(vy, vx);
}

export function updateMummy(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.05);
  }
  const tile = game.config?.map?.tile || 32;
  const auraRange = (game.config.enemy.mummyAuraRangeTiles || 1.8) * tile;
  const target = getPriorityTarget(game, enemy, auraRange * 6);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  if (typeof game.setEnemyTacticPhase === "function") {
    game.setEnemyTacticPhase(enemy, dist <= auraRange ? "aura" : "advancing");
  }
  enemy.auraPulseTimer = Math.max(0, (enemy.auraPulseTimer || 0) - dt);
  moveEnemyTowardPoint(game, enemy, target, dt, speedScale, Math.max(8, auraRange * 0.45));
}

export function updateMimic(game, enemy, dt, speedScale) {
  const ownerId = getEnemyAttackOwnerId(game, enemy);
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  const tile = game.config?.map?.tile || 32;
  const wakeRadius = (game.config.enemy.mimicWakeRadiusTiles || 3) * tile;
  const tongueRange = (game.config.enemy.mimicTongueRangeTiles || 2) * tile;
  const tongueCooldownMax = game.config.enemy.mimicTongueCooldown || 1.35;
  const tongueWindup = game.config.enemy.mimicTongueWindup || 0.18;
  const target = getPriorityTarget(game, enemy, wakeRadius * 2.2);
  const toPlayerX = target.x - enemy.x;
  const toPlayerY = target.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const seesPlayer = hasLineOfSight(game, enemy.x, enemy.y, target.x, target.y);
  enemy.tongueCooldown = Math.max(0, (enemy.tongueCooldown || 0) - dt);
  enemy.tongueTimer = Math.max(0, (enemy.tongueTimer || 0) - dt);
  if (enemy.dormant) {
    enemy.tongueLength = 0;
    if (seesPlayer && playerDist <= wakeRadius) {
      enemy.dormant = false;
      enemy.revealed = true;
    }
    return;
  }
  if (!seesPlayer) {
    const dx = enemy.homeX - enemy.x;
    const dy = enemy.homeY - enemy.y;
    const homeDist = vecLength(dx, dy);
    enemy.tongueLength = 0;
    if (homeDist <= 4) {
      enemy.x = enemy.homeX;
      enemy.y = enemy.homeY;
      enemy.dormant = true;
      enemy.revealed = false;
      enemy.tongueCooldown = 0;
      return;
    }
    moveEnemyTowardPoint(game, enemy, { x: enemy.homeX, y: enemy.homeY }, dt, speedScale);
    return;
  }
  enemy.revealed = true;
  enemy.tongueDirX = toPlayerX / playerDist;
  enemy.tongueDirY = toPlayerY / playerDist;
  if (playerDist <= tongueRange && enemy.tongueCooldown <= 0) {
    enemy.tongueCooldown = tongueCooldownMax;
    enemy.tongueTimer = tongueWindup;
    enemy.tongueLength = Math.min(tongueRange, playerDist);
    if (game.isPlayerEntity && game.isPlayerEntity(target) && (target.hitCooldown || 0) <= 0) {
      target.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledEnemyDamage, "physical"), "physical");
    } else if (!game.isPlayerEntity || !game.isPlayerEntity(target)) {
      game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical", ownerId);
    }
    return;
  }
  if (enemy.tongueTimer > 0) {
    enemy.tongueLength = Math.min(tongueRange, playerDist);
    return;
  }
  enemy.tongueLength = 0;
  if (playerDist > tongueRange * 0.72) game.moveEnemyTowardPlayer(enemy, speedScale, dt);
}
export function updatePrisoner(game, enemy, dt, speedScale) {
  enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
  enemy.swingTimer = Math.max(0, (enemy.swingTimer || 0) - dt);
  const tile = game.config?.map?.tile || 32;
  const range = (game.config.enemy.prisonerAttackRangeTiles || 2) * tile;
  const target = getPriorityTarget(game, enemy, range * 3);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  enemy.dirX = dx / dist;
  enemy.dirY = dy / dist;
  const startSwing = (aimX, aimY) => {
    const aimLen = vecLength(aimX, aimY) || 1;
    enemy.dirX = aimX / aimLen;
    enemy.dirY = aimY / aimLen;
    enemy.attackCooldown = game.config.enemy.prisonerAttackCooldown || 0.65;
    enemy.swingTimer = game.config.enemy.prisonerWindup || 0.16;
    enemy.sweepApplied = false;
  };
  const hostileProjectile = (() => {
    const threatRadius = Math.max(enemy.size * 0.9, tile * 0.8);
    for (const bullet of game.bullets || []) {
      if ((bullet.life || 0) <= 0 || bullet.faction === "enemy" || bullet.projectileType === "trapArrow" || bullet.projectileType === "ratArrow") continue;
      if (!isProjectileThreatening(enemy, bullet, threatRadius)) continue;
      return { x: bullet.x + (bullet.vx || 0) * 0.05, y: bullet.y + (bullet.vy || 0) * 0.05 };
    }
    for (const arrow of game.fireArrows || []) {
      if ((arrow.life || 0) <= 0) continue;
      if (!isProjectileThreatening(enemy, arrow, threatRadius)) continue;
      return { x: arrow.x + (arrow.vx || 0) * 0.05, y: arrow.y + (arrow.vy || 0) * 0.05 };
    }
    return null;
  })();

  if ((enemy.swingTimer || 0) > 0) {
    if (!enemy.sweepApplied && enemy.swingTimer <= (game.config.enemy.prisonerWindup || 0.32) * 0.5) {
      enemy.sweepApplied = true;
      const swingRange = range;
      const swingArc = ((game.config.enemy.prisonerAttackArcDeg || 70) * Math.PI) / 180;
      const halfArc = swingArc * 0.5;
      const enemyAngle = Math.atan2(enemy.dirY || 0, enemy.dirX || 1);
      const inSwingArc = (x, y, radius = 0) => {
        const tx = x - enemy.x;
        const ty = y - enemy.y;
        const targetDist = vecLength(tx, ty);
        if (targetDist > swingRange + radius) return false;
        let diff = Math.atan2(ty, tx) - enemyAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.abs(diff) <= halfArc;
      };
      if (game.isPlayerEntity && game.isPlayerEntity(target) && inSwingArc(target.x, target.y, game.getPlayerEnemyCollisionRadiusFor(target))) {
        if ((target.hitCooldown || 0) <= 0) {
          target.hitCooldown = 1.0;
          const rawDamage = game.rollEnemyContactDamage(enemy);
          const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
          const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
          const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
          game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, damageTaken, "physical"), "physical");
        }
      } else if (target && (!game.isPlayerEntity || !game.isPlayerEntity(target)) && inSwingArc(target.x, target.y, (target.size || 20) * 0.5)) {
        game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical");
      }
      for (const bullet of game.bullets || []) {
        if ((bullet.life || 0) <= 0 || bullet.faction === "enemy" || bullet.projectileType === "trapArrow" || bullet.projectileType === "ratArrow") continue;
        if (!inSwingArc(bullet.x, bullet.y, (bullet.size || 6) * 0.5)) continue;
        if (bullet.projectileType === "deathBolt") game.triggerDeathBoltExplosion(bullet.x, bullet.y, bullet);
        bullet.life = 0;
      }
      for (const arrow of game.fireArrows || []) {
        if ((arrow.life || 0) <= 0) continue;
        if (!inSwingArc(arrow.x, arrow.y, (arrow.size || 8) * 0.5)) continue;
        game.triggerFireExplosion(arrow.x, arrow.y, arrow);
        arrow.life = 0;
      }
    }
    return;
  }

  if (hostileProjectile && enemy.attackCooldown <= 0) {
    startSwing(hostileProjectile.x - enemy.x, hostileProjectile.y - enemy.y);
    return;
  }
  if (dist <= range && enemy.attackCooldown <= 0) {
    startSwing(dx, dy);
    return;
  }
  if (typeof game.moveEnemyTowardTarget === "function") game.moveEnemyTowardTarget(enemy, target, speedScale, dt, Math.max(10, enemy.size * 0.25));
  else game.moveEnemyTowardPlayer(enemy, speedScale, dt);
}
