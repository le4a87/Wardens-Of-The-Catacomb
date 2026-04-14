import { vecLength } from "../utils.js";
import { getPriorityTarget, moveEnemyTowardPoint } from "./enemyAiShared.js";

function tryRecoverMinotaurMovement(game, enemy, dirX, dirY, tile) {
  enemy._pathToTargetCache = null;
  enemy.chargeTimer = 0;
  enemy.chargeWindupTimer = 0;
  const perpX = -dirY;
  const perpY = dirX;
  const recoveryStep = tile * 0.38;
  const options = [
    { x: perpX, y: perpY },
    { x: -perpX, y: -perpY },
    { x: -dirX, y: -dirY }
  ];
  for (const option of options) {
    const beforeX = enemy.x;
    const beforeY = enemy.y;
    game.moveWithCollision(enemy, option.x * recoveryStep, option.y * recoveryStep);
    if (vecLength(enemy.x - beforeX, enemy.y - beforeY) > tile * 0.08) return true;
  }
  return false;
}

function trackMinotaurStall(game, enemy, beforeX, beforeY, dt, dirX, dirY, tile) {
  const moved = vecLength(enemy.x - beforeX, enemy.y - beforeY);
  enemy.stuckTimer = moved <= Math.max(1, tile * 0.03) ? Math.max(0, (enemy.stuckTimer || 0) + dt) : 0;
  if ((enemy.stuckTimer || 0) < 0.45) return;
  enemy.stuckTimer = 0;
  tryRecoverMinotaurMovement(game, enemy, dirX, dirY, tile);
}

export function updateMinotaur(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const target = getPriorityTarget(game, enemy, tile * 12);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  const dirX = dx / dist;
  const dirY = dy / dist;
  const chargeRange = (game.config.enemy.minotaurChargeRangeTiles || 6.5) * tile;
  const stompRange = (game.config.enemy.minotaurStompRangeTiles || 1.8) * tile;
  const chargePushDistance = (game.config.enemy.minotaurChargePushDistanceTiles || 1.2) * tile;
  const chargeDamageMultiplier = Math.max(1, game.config.enemy.minotaurChargeContactDamageMultiplier || 1.3);

  enemy.chargeCooldown = Math.max(0, (enemy.chargeCooldown || 0) - dt);
  enemy.chargeTimer = Math.max(0, (enemy.chargeTimer || 0) - dt);
  enemy.chargeWindupTimer = Math.max(0, (enemy.chargeWindupTimer || 0) - dt);
  enemy.stompCooldown = Math.max(0, (enemy.stompCooldown || 0) - dt);
  enemy.chargeImpactCooldown = Math.max(0, (enemy.chargeImpactCooldown || 0) - dt);

  if ((enemy.chargeTimer || 0) > 0) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "charging");
    const chargeScale = (game.config.enemy.minotaurChargeSpeedMultiplier || 2.2) * (Number.isFinite(speedScale) ? speedScale : 1);
    const chargeTravel = (game.config.enemy.minotaurChargeTravelTiles || 7) * tile;
    const beforeX = enemy.x;
    const beforeY = enemy.y;
    moveEnemyTowardPoint(
      game,
      enemy,
      { x: enemy.x + (enemy.chargeDirX || dirX) * chargeTravel, y: enemy.y + (enemy.chargeDirY || dirY) * chargeTravel },
      dt,
      chargeScale
    );
    trackMinotaurStall(game, enemy, beforeX, beforeY, dt, enemy.chargeDirX || dirX, enemy.chargeDirY || dirY, tile);
    if (game.isPlayerEntity && game.isPlayerEntity(target)) {
      const playerRadius = typeof game.getPlayerEnemyCollisionRadiusFor === "function"
        ? game.getPlayerEnemyCollisionRadiusFor(target)
        : (target.size || 20) * 0.5;
      const collisionRange = playerRadius + (enemy.size || 34) * 0.52;
      const playerDist = vecLength(target.x - enemy.x, target.y - enemy.y);
      if (playerDist <= collisionRange) {
        game.moveWithCollision(target, (enemy.chargeDirX || dirX) * chargePushDistance * dt, (enemy.chargeDirY || dirY) * chargePushDistance * dt);
        if (enemy.chargeImpactCooldown <= 0 && (target.hitCooldown || 0) <= 0) {
          target.hitCooldown = 0.75;
          enemy.chargeImpactCooldown = 0.18;
          const rawDamage = game.rollEnemyContactDamage(enemy) * chargeDamageMultiplier;
          const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
          game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledEnemyDamage, "physical"), "physical");
        }
      }
    }
    return;
  }

  if ((enemy.chargeWindupTimer || 0) > 0) {
    enemy.stuckTimer = 0;
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "windup");
    return;
  }

  if (dist <= stompRange && enemy.stompCooldown <= 0) {
    enemy.stuckTimer = 0;
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "stomp");
    enemy.stompCooldown = game.config.enemy.minotaurStompCooldown || 2.2;
    if (game.isPlayerEntity && game.isPlayerEntity(target) && (target.hitCooldown || 0) <= 0) {
      target.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledEnemyDamage, "physical"), "physical");
    } else if (!game.isPlayerEntity || !game.isPlayerEntity(target)) {
      game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical");
    }
    return;
  }

  if (dist >= stompRange * 1.4 && dist <= chargeRange && enemy.chargeCooldown <= 0) {
    enemy.stuckTimer = 0;
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "windup");
    enemy.chargeDirX = dirX;
    enemy.chargeDirY = dirY;
    enemy.chargeWindupTimer = game.config.enemy.minotaurWindup || 0.45;
    enemy.chargeCooldown = game.config.enemy.minotaurChargeCooldown || 3.8;
    enemy.chargeTimer = game.config.enemy.minotaurChargeDuration || 0.6;
    return;
  }

  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "advancing");
  const beforeX = enemy.x;
  const beforeY = enemy.y;
  moveEnemyTowardPoint(game, enemy, target, dt, speedScale, Math.max(8, stompRange * 0.45));
  trackMinotaurStall(game, enemy, beforeX, beforeY, dt, dirX, dirY, tile);
}
