import { vecLength } from "../utils.js";
import {
  findRatCoverTarget,
  getEnemyAttackOwnerId,
  getPriorityTarget,
  hasLineOfSight,
  isFriendlyToPlayer,
  isProjectileThreatening,
  moveEnemyTowardPoint
} from "./enemyAiShared.js";

function findControlledSkeletonGuardTarget(game, enemy, owner) {
  if (!game || !enemy || !owner) return null;
  const tile = game.config?.map?.tile || 32;
  const follow = (game.config?.necromancer?.followDistanceTiles || 2.2) * tile;
  const guardRadius = Math.max(tile * 2.25, follow * 1.2);
  const interceptRadius = Math.max(tile * 1.5, follow * 0.95);
  let best = null;
  let bestOwnerDist = Number.POSITIVE_INFINITY;
  let bestEnemyDist = Number.POSITIVE_INFINITY;
  for (const other of game.enemies || []) {
    if (!other || other === enemy || (other.hp || 0) <= 0) continue;
    if (isFriendlyToPlayer(game, other)) continue;
    if (other.type === "mimic" && other.dormant) continue;
    if (other.type === "skeleton_warrior" && other.collapsed) continue;
    const ownerDist = vecLength((other.x || 0) - owner.x, (other.y || 0) - owner.y);
    const enemyDist = vecLength((other.x || 0) - enemy.x, (other.y || 0) - enemy.y);
    if (ownerDist > guardRadius && enemyDist > interceptRadius) continue;
    if (ownerDist < bestOwnerDist || (ownerDist <= bestOwnerDist + 0.001 && enemyDist < bestEnemyDist)) {
      best = other;
      bestOwnerDist = ownerDist;
      bestEnemyDist = enemyDist;
    }
  }
  return best;
}

function updateFriendlySkeletonBodyguard(game, enemy, dt, speedScale, attackRange = 0, ownerId = null) {
  const owner =
    typeof game.getControllingPlayerEntityForEnemy === "function"
      ? game.getControllingPlayerEntityForEnemy(enemy)
      : game.player;
  if (!owner) return false;
  const ownerSpeed = typeof game.getPlayerMoveSpeedFor === "function" ? game.getPlayerMoveSpeedFor(owner) : game.getPlayerMoveSpeed();
  enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, ownerSpeed * 1.05);
  const tile = game.config?.map?.tile || 32;
  const follow = (game.config?.necromancer?.followDistanceTiles || 2.2) * tile;
  const anchor =
    typeof game.getControlledUndeadFormationPoint === "function"
      ? game.getControlledUndeadFormationPoint(enemy)
      : { x: owner.x, y: owner.y };
  const distToOwner = vecLength(owner.x - enemy.x, owner.y - enemy.y);
  const distToAnchor = vecLength(anchor.x - enemy.x, anchor.y - enemy.y);
  const hardLeash = Math.max(tile * 2.8, follow * 1.7);
  const guardThreat = findControlledSkeletonGuardTarget(game, enemy, owner);

  if (distToOwner > hardLeash) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "return");
    moveEnemyTowardPoint(game, enemy, anchor, dt, Math.max(1.05, speedScale), Math.max(8, tile * 0.3));
    return true;
  }

  if (guardThreat) {
    const dx = guardThreat.x - enemy.x;
    const dy = guardThreat.y - enemy.y;
    const dist = vecLength(dx, dy) || 1;
    enemy.dirX = dx / dist;
    enemy.dirY = dy / dist;
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "guard");
    if (attackRange > 0 && dist <= attackRange && (enemy.attackCooldown || 0) <= 0) {
      enemy.attackCooldown = (game.config.enemy.skeletonWarriorAttackCooldown || 1.0) / Math.max(0.4, 1 + (enemy.controlledAttackSpeedBonusPct || 0));
      game.applyEnemyDamage(guardThreat, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical", ownerId);
      return true;
    }
    moveEnemyTowardPoint(game, enemy, guardThreat, dt, Math.max(0.95, speedScale), Math.max(6, tile * 0.18));
    return true;
  }

  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "escort");
  if (distToAnchor > Math.max(tile * 0.35, follow * 0.22)) {
    moveEnemyTowardPoint(game, enemy, anchor, dt, Math.max(0.92, speedScale), Math.max(6, tile * 0.18));
  }
  return true;
}

export function updateRatArcher(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  const tile = game.config?.map?.tile || 32;
  const preferredRange = (game.config.enemy.ratArcherPreferredRangeTiles || 7) * tile;
  const retreatRange = (game.config.enemy.ratArcherRetreatRangeTiles || 5) * tile;
  const advanceRange = Math.max(preferredRange, (game.config.enemy.ratArcherAdvanceRangeTiles || 8.5) * tile);
  const holdBand = Math.max(tile * 0.5, (game.config.enemy.ratArcherHoldBandTiles || 1.1) * tile);
  const dodgeRadius = (game.config.enemy.ratArcherDodgeRadiusTiles || 2) * tile;
  const target = getPriorityTarget(game, enemy, preferredRange * 1.8);
  const toPlayerX = target.x - enemy.x;
  const toPlayerY = target.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const seesPlayer = hasLineOfSight(game, enemy.x, enemy.y, target.x, target.y);
  enemy.dirX = toPlayerX / playerDist;
  enemy.dirY = toPlayerY / playerDist;
  const prevWindupTimer = Number.isFinite(enemy.shotWindupTimer) ? enemy.shotWindupTimer : 0;
  enemy.shotWindupTimer = Math.max(0, prevWindupTimer - dt);
  enemy.shotIntervalTimer = Math.max(0, (enemy.shotIntervalTimer || 0) - dt);
  enemy.burstCooldownTimer = Math.max(0, (enemy.burstCooldownTimer || 0) - dt);
  enemy.repositionTimer = Math.max(0, (enemy.repositionTimer || 0) - dt);
  enemy.dodgeCooldownTimer = Math.max(0, (enemy.dodgeCooldownTimer || 0) - dt);
  enemy.dodgeTimer = Math.max(0, (enemy.dodgeTimer || 0) - dt);
  const inHoldBand = Math.abs(playerDist - preferredRange) <= holdBand;
  let nextStage = "hold";
  if (playerDist < retreatRange) nextStage = "retreat";
  else if (inHoldBand) nextStage = "hold";
  else if (enemy.repositionTimer > 0 || enemy.burstCooldownTimer > 0 || enemy.shotIntervalTimer > 0) nextStage = "reposition";
  else if (playerDist > advanceRange || !seesPlayer) nextStage = "advance";
  enemy.rangeStage = nextStage;
  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, nextStage);
  if ((enemy.dodgeTimer || 0) > 0) {
    game.moveWithCollision(enemy, (enemy.dodgeVx || 0) * dt, (enemy.dodgeVy || 0) * dt);
    return;
  }
  for (const bullet of game.bullets) {
    if (bullet.projectileType === "trapArrow" || bullet.projectileType === "ratArrow") continue;
    if (!isProjectileThreatening(enemy, bullet, dodgeRadius)) continue;
    if ((enemy.dodgeCooldownTimer || 0) > 0) break;
    const sidestepChoices = [
      { x: -(bullet.vy || 0), y: bullet.vx || 0 },
      { x: bullet.vy || 0, y: -(bullet.vx || 0) }
    ];
    const dodgeDistance = (game.config.enemy.ratArcherDodgeDistanceTiles || 1.1) * tile;
    const dodgeDuration = Math.max(0.04, game.config.enemy.ratArcherDodgeDuration || 0.12);
    for (const choice of sidestepChoices) {
      const sidestepLen = vecLength(choice.x, choice.y) || 1;
      enemy.dodgeVx = (choice.x / sidestepLen) * (dodgeDistance / dodgeDuration);
      enemy.dodgeVy = (choice.y / sidestepLen) * (dodgeDistance / dodgeDuration);
      enemy.dodgeTimer = dodgeDuration;
      break;
    }
    enemy.dodgeCooldownTimer = game.config.enemy.ratArcherDodgeCooldown || 2.5;
    enemy.coverTargetX = enemy.x;
    enemy.coverTargetY = enemy.y;
    return;
  }
  if (prevWindupTimer > 0) {
    if (enemy.shotWindupTimer <= 0.0001) {
      const count = Math.max(1, Math.floor(game.config.enemy.ratArcherSpreadCount || 3));
      const spreadDeg = game.config.enemy.ratArcherSpreadDeg || 20;
      const spreadRad = (spreadDeg * Math.PI) / 180;
      const baseAngle = Math.atan2(enemy.dirY || 0, enemy.dirX || 1);
      const speed = game.config.enemy.ratArcherProjectileSpeed || 360;
      const damageMin = game.config.enemy.ratArcherDamageMin;
      const damageMax = game.config.enemy.ratArcherDamageMax;
      for (let i = 0; i < count; i++) {
        const t = count <= 1 ? 0 : i / (count - 1);
        const offset = count <= 1 ? 0 : (t - 0.5) * spreadRad;
        const angle = baseAngle + offset;
        game.bullets.push({
          x: enemy.x + Math.cos(angle) * 9,
          y: enemy.y + Math.sin(angle) * 9,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          angle,
          life: game.config.enemy.ratArcherProjectileLife || 1.3,
          size: 6,
          projectileType: "ratArrow",
          damageMin,
          damageMax
        });
      }
      enemy.shotWindupTimer = 0;
      enemy.shotsRemaining = Math.max(0, (enemy.shotsRemaining || 0) - 1);
      if (enemy.shotsRemaining <= 0) {
        enemy.shotsRemaining = game.config.enemy.ratArcherBurstShots || 3;
        enemy.burstCooldownTimer = game.config.enemy.ratArcherBurstCooldown || 5;
      } else {
        enemy.shotIntervalTimer = game.config.enemy.ratArcherShotInterval || 1.5;
      }
      const cover = findRatCoverTarget(game, enemy, retreatRange);
      if (cover) {
        enemy.coverTargetX = cover.x;
        enemy.coverTargetY = cover.y;
        enemy.repositionTimer = game.config.enemy.ratArcherRepositionCommitTime || 1.35;
      }
      return;
    }
    return;
  }
  if (playerDist < retreatRange) {
    moveEnemyTowardPoint(game, enemy, { x: enemy.x - (toPlayerX / playerDist) * 96, y: enemy.y - (toPlayerY / playerDist) * 96 }, dt, speedScale);
    return;
  }
  if (enemy.repositionTimer > 0 || enemy.burstCooldownTimer > 0 || enemy.shotIntervalTimer > 0) {
    const cx = Number.isFinite(enemy.coverTargetX) ? enemy.coverTargetX : enemy.x;
    const cy = Number.isFinite(enemy.coverTargetY) ? enemy.coverTargetY : enemy.y;
    const dx = cx - enemy.x;
    const dy = cy - enemy.y;
    const len = vecLength(dx, dy);
    if (len > 6) {
      moveEnemyTowardPoint(game, enemy, { x: cx, y: cy }, dt, speedScale);
      return;
    }
  }
  if (!inHoldBand && (playerDist > advanceRange || !seesPlayer)) {
    if (typeof game.moveEnemyTowardTarget === "function") game.moveEnemyTowardTarget(enemy, target, speedScale, dt, 6);
    else game.moveEnemyTowardPlayer(enemy, speedScale, dt);
    return;
  }
  if (inHoldBand) {
    enemy.coverTargetX = enemy.x;
    enemy.coverTargetY = enemy.y;
  }
  if (enemy.burstCooldownTimer <= 0 && enemy.shotIntervalTimer <= 0 && seesPlayer) {
    enemy.shotWindupTimer = game.config.enemy.ratArcherWindup || 0.4;
  }
}

export function updateSkeletonWarrior(game, enemy, dt, speedScale) {
  const ownerId = getEnemyAttackOwnerId(game, enemy);
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
  if (enemy.collapsed) {
    if (typeof game.setEnemyTacticPhase === "function") {
      game.setEnemyTacticPhase(enemy, enemy.reanimating ? "reanimating" : "collapsed");
    }
    enemy.collapseTimer = Math.max(0, (enemy.collapseTimer || 0) - dt);
    if (enemy.reviveAtEnd && !enemy.reanimating && enemy.collapseTimer <= 0) {
      enemy.reanimating = true;
      enemy.reanimateTimer = Math.max(0.15, game.config.enemy.skeletonWarriorReanimateWindup || 1.2);
    }
    if (enemy.reanimating) {
      enemy.reanimateTimer = Math.max(0, (enemy.reanimateTimer || 0) - dt);
      if (enemy.reanimateTimer <= 0) {
        enemy.collapsed = false;
        enemy.reanimating = false;
        enemy.reviveAtEnd = false;
        enemy.hp = Math.max(1, Math.round(enemy.maxHp * Math.max(0.1, game.config.enemy.skeletonWarriorReviveHpPct || 0.35)));
        enemy.attackCooldown = game.config.enemy.skeletonWarriorAttackCooldown || 1.0;
      }
    } else if (enemy.collapseTimer <= 0 && !enemy.reviveAtEnd) {
      enemy.hp = 0;
    }
    return;
  }
  if (isFriendlyToPlayer(game, enemy)) {
    updateFriendlySkeletonBodyguard(game, enemy, dt, speedScale, game.config.enemy.skeletonWarriorAttackRange || 42, ownerId);
    return;
  }
  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "advancing");
  const range = game.config.enemy.skeletonWarriorAttackRange || 42;
  const target = getPriorityTarget(game, enemy, range * 4);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  enemy.dirX = dx / dist;
  enemy.dirY = dy / dist;
  if (dist <= range && enemy.attackCooldown <= 0) {
    enemy.attackCooldown = (game.config.enemy.skeletonWarriorAttackCooldown || 1.0) / Math.max(0.4, 1 + (enemy.controlledAttackSpeedBonusPct || 0));
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
  if (typeof game.moveEnemyTowardTarget === "function") game.moveEnemyTowardTarget(enemy, target, speedScale, dt, 6);
  else game.moveEnemyTowardPlayer(enemy, speedScale, dt);
}

export function updateSkeleton(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy)) {
    updateFriendlySkeletonBodyguard(game, enemy, dt, speedScale);
    return;
  }
  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "advancing");
  const target = getPriorityTarget(game, enemy);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  enemy.dirX = dx / dist;
  enemy.dirY = dy / dist;
  moveEnemyTowardPoint(game, enemy, target, dt, speedScale, 6);
}
