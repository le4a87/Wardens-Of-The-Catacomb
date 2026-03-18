import { vecLength } from "../utils.js";
import { applyGoblinGrowth, findNearestGoldDrop } from "./enemyRewards.js";
import { spawnSkeleton } from "./enemySpawnFactories.js";

function hasLineOfSight(game, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = vecLength(dx, dy);
  if (dist <= 1) return true;
  const tile = game.config?.map?.tile || 32;
  const step = Math.max(8, tile * 0.35);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = x0 + dx * t;
    const sy = y0 + dy * t;
    if (game.isWallAt(sx, sy, false)) return false;
  }
  return true;
}

function isFriendlyToPlayer(game, enemy) {
  return typeof game?.isEnemyFriendlyToPlayer === "function" ? game.isEnemyFriendlyToPlayer(enemy) : !!enemy?.isControlledUndead;
}

function isHostilePair(game, source, target) {
  if (!source || !target || source === target) return false;
  return isFriendlyToPlayer(game, source) !== isFriendlyToPlayer(game, target);
}

function isActiveCharmTarget(game, enemy) {
  return !!enemy && !!game?.necromancerBeam?.active && game.necromancerBeam.targetEnemy === enemy;
}

function getPriorityTarget(game, enemy, maxRange = Infinity) {
  if (!enemy) return game.player;
  const sourceFriendly = isFriendlyToPlayer(game, enemy);
  let best = sourceFriendly ? null : game.player;
  let bestDist = sourceFriendly ? Number.POSITIVE_INFINITY : vecLength(game.player.x - enemy.x, game.player.y - enemy.y);
  for (const other of game.enemies || []) {
    if (!other || !isHostilePair(game, enemy, other) || (other.hp || 0) <= 0) continue;
    if (sourceFriendly && other.type === "mimic" && other.dormant) continue;
    if (sourceFriendly && isActiveCharmTarget(game, other)) continue;
    if (other.type === "skeleton_warrior" && other.collapsed) continue;
    const dist = vecLength(other.x - enemy.x, other.y - enemy.y);
    if (dist > maxRange) continue;
    if (dist < bestDist) {
      best = other;
      bestDist = dist;
    }
  }
  return best || game.player;
}

function countSummonedSkeletons(game) {
  return (game.enemies || []).filter((other) => other && other.type === "skeleton" && other.summonerBoss && other.hp > 0).length;
}

function findSkeletonSummonPoint(game, enemy, angle, distance) {
  const tile = game.config?.map?.tile || 32;
  for (let attempt = 0; attempt < 4; attempt++) {
    const dist = distance + attempt * (tile * 0.35);
    const x = enemy.x + Math.cos(angle) * dist;
    const y = enemy.y + Math.sin(angle) * dist;
    if (!game.isWallAt(x, y, true)) return { x, y };
  }
  return null;
}

function isProjectileThreatening(enemy, projectile, radius) {
  if (!enemy || !projectile) return false;
  const vx = Number.isFinite(projectile.vx) ? projectile.vx : 0;
  const vy = Number.isFinite(projectile.vy) ? projectile.vy : 0;
  const speedSq = vx * vx + vy * vy;
  if (speedSq <= 1) return false;
  const dx = enemy.x - projectile.x;
  const dy = enemy.y - projectile.y;
  const t = (dx * vx + dy * vy) / speedSq;
  if (t < 0 || t > 0.45) return false;
  const closestX = projectile.x + vx * t;
  const closestY = projectile.y + vy * t;
  return vecLength(enemy.x - closestX, enemy.y - closestY) <= radius;
}

function segmentDistanceToPoint(x0, y0, x1, y1, px, py) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return vecLength(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lenSq));
  const cx = x0 + dx * t;
  const cy = y0 + dy * t;
  return vecLength(px - cx, py - cy);
}

function isCoveredFromPlayer(game, x, y, self = null) {
  if (!hasLineOfSight(game, game.player.x, game.player.y, x, y)) return true;
  for (const br of game.breakables || []) {
    if ((br.hp || 0) <= 0) continue;
    const radius = (Number.isFinite(br.size) ? br.size : 20) * 0.5;
    if (segmentDistanceToPoint(game.player.x, game.player.y, x, y, br.x, br.y) <= radius) return true;
  }
  for (const enemy of game.enemies || []) {
    if (!enemy || enemy === self || (enemy.hp || 0) <= 0) continue;
    if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
    const radius = (Number.isFinite(enemy.size) ? enemy.size : 20) * 0.5;
    if (segmentDistanceToPoint(game.player.x, game.player.y, x, y, enemy.x, enemy.y) <= radius) return true;
  }
  return false;
}

function findRatCoverTarget(game, enemy, minPlayerDist) {
  const tile = game.config?.map?.tile || 32;
  const radiusTiles = Math.max(2, Math.floor(game.config.enemy.ratArcherCoverSearchRadiusTiles || 6));
  const originTx = Math.floor(enemy.x / tile);
  const originTy = Math.floor(enemy.y / tile);
  const candidates = [];
  for (let oy = -radiusTiles; oy <= radiusTiles; oy++) {
    for (let ox = -radiusTiles; ox <= radiusTiles; ox++) {
      const tx = originTx + ox;
      const ty = originTy + oy;
      if (!game.isWalkableTile(tx, ty)) continue;
      const x = tx * tile + tile * 0.5;
      const y = ty * tile + tile * 0.5;
      if (vecLength(game.player.x - x, game.player.y - y) < minPlayerDist) continue;
      if (!isCoveredFromPlayer(game, x, y, enemy)) continue;
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function updateGoblin(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  const isStrong = enemy.goldEaten >= game.config.enemy.goblinStrongGoldThreshold;
  const threat = getPriorityTarget(game, enemy, game.config.enemy.goblinFearRadius * 1.3);
  const toPlayerX = threat.x - enemy.x;
  const toPlayerY = threat.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const awayPlayerX = -toPlayerX / playerDist;
  const awayPlayerY = -toPlayerY / playerDist;
  const targetGold = findNearestGoldDrop(game, enemy.x, enemy.y);
  if (targetGold) {
    const toGoldX = targetGold.x - enemy.x;
    const toGoldY = targetGold.y - enemy.y;
    const goldLen = vecLength(toGoldX, toGoldY) || 1;
    let dirX = toGoldX / goldLen;
    let dirY = toGoldY / goldLen;
    if (!isStrong && playerDist < game.config.enemy.goblinFearRadius) {
      dirX = dirX * 0.75 + awayPlayerX * 0.25;
      dirY = dirY * 0.75 + awayPlayerY * 0.25;
    }
    const dirLen = vecLength(dirX, dirY) || 1;
    game.moveWithCollision(enemy, (dirX / dirLen) * enemy.speed * speedScale * dt, (dirY / dirLen) * enemy.speed * speedScale * dt);
    if (goldLen < enemy.size * 0.45 + targetGold.size * 0.75) {
      targetGold.life = 0;
      applyGoblinGrowth(game, enemy, targetGold.amount);
    }
    return;
  }
  if (!isStrong && playerDist < game.config.enemy.goblinFearRadius * 1.2) {
    game.moveWithCollision(enemy, awayPlayerX * enemy.speed * speedScale * dt, awayPlayerY * enemy.speed * speedScale * dt);
    enemy.wanderAngle = Math.atan2(awayPlayerY, awayPlayerX);
    return;
  }
  enemy.wanderTimer -= dt;
  if (enemy.wanderTimer <= 0) {
    enemy.wanderTimer = 0.6 + Math.random() * 1.2;
    enemy.wanderAngle += (Math.random() - 0.5) * 1.8;
  }
  const pursueX = toPlayerX / playerDist;
  const pursueY = toPlayerY / playerDist;
  const wanderX = Math.cos(enemy.wanderAngle);
  const wanderY = Math.sin(enemy.wanderAngle);
  const vx = wanderX * (1 - enemy.aggression) + pursueX * enemy.aggression;
  const vy = wanderY * (1 - enemy.aggression) + pursueY * enemy.aggression;
  const len = vecLength(vx, vy) || 1;
  game.moveWithCollision(enemy, (vx / len) * enemy.speed * speedScale * dt, (vy / len) * enemy.speed * speedScale * dt);
  enemy.wanderAngle = Math.atan2(vy, vx);
}

export function updateMimic(game, enemy, dt, speedScale) {
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
    const len = homeDist || 1;
    game.moveWithCollision(enemy, (dx / len) * enemy.speed * speedScale * dt, (dy / len) * enemy.speed * speedScale * dt);
    return;
  }
  enemy.revealed = true;
  enemy.tongueDirX = toPlayerX / playerDist;
  enemy.tongueDirY = toPlayerY / playerDist;
  if (playerDist <= tongueRange && enemy.tongueCooldown <= 0) {
    enemy.tongueCooldown = tongueCooldownMax;
    enemy.tongueTimer = tongueWindup;
    enemy.tongueLength = Math.min(tongueRange, playerDist);
    if (target === game.player && game.player.hitCooldown <= 0) {
      game.player.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
      const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
      game.applyPlayerDamage(damageTaken);
    } else if (target !== game.player) {
      game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical");
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

export function updateRatArcher(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  const tile = game.config?.map?.tile || 32;
  const preferredRange = (game.config.enemy.ratArcherPreferredRangeTiles || 7) * tile;
  const retreatRange = (game.config.enemy.ratArcherRetreatRangeTiles || 5) * tile;
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
        enemy.repositionTimer = 1.2;
      }
      return;
    }
    return;
  }
  if (playerDist < retreatRange) {
    game.moveWithCollision(enemy, (-toPlayerX / playerDist) * enemy.speed * speedScale * dt, (-toPlayerY / playerDist) * enemy.speed * speedScale * dt);
    return;
  }
  if (enemy.repositionTimer > 0 || enemy.burstCooldownTimer > 0 || enemy.shotIntervalTimer > 0) {
    const cx = Number.isFinite(enemy.coverTargetX) ? enemy.coverTargetX : enemy.x;
    const cy = Number.isFinite(enemy.coverTargetY) ? enemy.coverTargetY : enemy.y;
    const dx = cx - enemy.x;
    const dy = cy - enemy.y;
    const len = vecLength(dx, dy);
    if (len > 6) {
      game.moveWithCollision(enemy, (dx / len) * enemy.speed * speedScale * dt, (dy / len) * enemy.speed * speedScale * dt);
      return;
    }
  }
  if (playerDist > preferredRange || !seesPlayer) {
    if (typeof game.moveEnemyTowardTarget === "function") game.moveEnemyTowardTarget(enemy, target, speedScale, dt, 6);
    else game.moveEnemyTowardPlayer(enemy, speedScale, dt);
    return;
  }
  if (enemy.burstCooldownTimer <= 0 && enemy.shotIntervalTimer <= 0 && seesPlayer) {
    enemy.shotWindupTimer = game.config.enemy.ratArcherWindup || 0.4;
  }
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
      if (target === game.player && inSwingArc(game.player.x, game.player.y, game.getPlayerEnemyCollisionRadius())) {
        if (game.player.hitCooldown <= 0) {
          game.player.hitCooldown = 1.0;
          const rawDamage = game.rollEnemyContactDamage(enemy);
          const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
          const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
          const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
          game.applyPlayerDamage(damageTaken);
        }
      } else if (target && target !== game.player && inSwingArc(target.x, target.y, (target.size || 20) * 0.5)) {
        game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical");
      }
      for (const bullet of game.bullets || []) {
        if ((bullet.life || 0) <= 0 || bullet.faction === "enemy" || bullet.projectileType === "trapArrow" || bullet.projectileType === "ratArrow") continue;
        if (!inSwingArc(bullet.x, bullet.y, (bullet.size || 6) * 0.5)) continue;
        if (bullet.projectileType === "deathBolt") game.triggerDeathBoltExplosion(bullet.x, bullet.y);
        bullet.life = 0;
      }
      for (const arrow of game.fireArrows || []) {
        if ((arrow.life || 0) <= 0) continue;
        if (!inSwingArc(arrow.x, arrow.y, (arrow.size || 8) * 0.5)) continue;
        game.triggerFireExplosion(arrow.x, arrow.y);
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

export function updateSkeletonWarrior(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
  if (enemy.collapsed) {
    enemy.collapseTimer = Math.max(0, (enemy.collapseTimer || 0) - dt);
    if (enemy.collapseTimer <= 0) {
      if (enemy.reviveAtEnd) {
        enemy.collapsed = false;
        enemy.hp = 1;
        enemy.attackCooldown = game.config.enemy.skeletonWarriorAttackCooldown || 1.0;
      } else {
        enemy.hp = 0;
      }
    }
    return;
  }
  const range = game.config.enemy.skeletonWarriorAttackRange || 42;
  const target = getPriorityTarget(game, enemy, range * 4);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  enemy.dirX = dx / dist;
  enemy.dirY = dy / dist;
  if (dist <= range && enemy.attackCooldown <= 0) {
    enemy.attackCooldown = game.config.enemy.skeletonWarriorAttackCooldown || 1.0;
    if (target === game.player && game.player.hitCooldown <= 0) {
      game.player.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
      const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
      game.applyPlayerDamage(damageTaken);
    } else if (target !== game.player) {
      game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical");
    }
    return;
  }
  if (typeof game.moveEnemyTowardTarget === "function") game.moveEnemyTowardTarget(enemy, target, speedScale, dt, 6);
  else game.moveEnemyTowardPlayer(enemy, speedScale, dt);
}

export function updateNecromancer(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const preferredRange = (game.config.enemy.necromancerPreferredRangeTiles || 5) * tile;
  const retreatRange = (game.config.enemy.necromancerRetreatRangeTiles || 3) * tile;
  const castCooldownMax = Math.max(0.3, game.config.enemy.necromancerCastCooldown || 2.2);
  const bossSummonCooldownMultiplier = enemy.isFloorBoss && Number.isFinite(game.config.enemy.necromancerBossSummonCooldownMultiplier)
    ? Math.max(0.25, game.config.enemy.necromancerBossSummonCooldownMultiplier)
    : 1;
  const summonCooldownMax = Math.max(0.8, (game.config.enemy.necromancerSummonCooldown || 5.5) * bossSummonCooldownMultiplier);
  const summonCapBonus = enemy.isFloorBoss && Number.isFinite(game.config.enemy.necromancerBossSummonCapBonus)
    ? Math.max(0, Math.floor(game.config.enemy.necromancerBossSummonCapBonus))
    : 0;
  const summonCountBonus = enemy.isFloorBoss && Number.isFinite(game.config.enemy.necromancerBossSummonCountBonus)
    ? Math.max(0, Math.floor(game.config.enemy.necromancerBossSummonCountBonus))
    : 0;
  const summonCap = Math.max(1, Math.floor(game.config.enemy.necromancerSummonCap || 5) + summonCapBonus);
  const summonCount = Math.max(1, Math.floor(game.config.enemy.necromancerSummonCount || 2) + summonCountBonus);
  const toPlayerX = game.player.x - enemy.x;
  const toPlayerY = game.player.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const dirX = toPlayerX / playerDist;
  const dirY = toPlayerY / playerDist;
  const perpX = -dirY;
  const perpY = dirX;
  const moveStep = enemy.speed * (Number.isFinite(speedScale) ? speedScale : 1) * Math.max(0, dt);
  enemy.strafeTimer = Math.max(0, (enemy.strafeTimer || 0) - dt);
  enemy.castCooldown = Math.max(0, (enemy.castCooldown || 0) - dt);
  enemy.summonCooldown = Math.max(0, (enemy.summonCooldown || 0) - dt);
  if (enemy.strafeTimer <= 0) {
    enemy.strafeTimer = 0.8 + Math.random() * 1.4;
    enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }
  if (playerDist < retreatRange) {
    game.moveWithCollision(enemy, -dirX * moveStep, -dirY * moveStep);
    return;
  }
  if (playerDist > preferredRange || !hasLineOfSight(game, enemy.x, enemy.y, game.player.x, game.player.y)) {
    game.moveEnemyTowardPlayer(enemy, speedScale * 0.92, dt);
    return;
  }
  if (enemy.summonCooldown <= 0 && countSummonedSkeletons(game) < summonCap) {
    const activeCount = countSummonedSkeletons(game);
    const budget = Math.max(0, summonCap - activeCount);
    const toSpawn = Math.min(summonCount, budget);
    const baseAngle = Math.atan2(dirY, dirX) + Math.PI * 0.5;
    const radius = enemy.size + tile * 0.65;
    let spawned = 0;
    for (let i = 0; i < toSpawn; i++) {
      const offset = (i - (toSpawn - 1) * 0.5) * 0.85;
      const point = findSkeletonSummonPoint(game, enemy, baseAngle + offset, radius);
      if (!point) continue;
      game.enemies.push(spawnSkeleton(game, point.x, point.y, { summonedByNecromancer: true, summonerBoss: true }));
      spawned += 1;
    }
    if (spawned > 0) {
      enemy.summonCooldown = summonCooldownMax;
      game.spawnFloatingText(enemy.x, enemy.y - enemy.size - 10, "Raise Dead", "#cfc1ff", 1.1, 14);
    }
  }
  if (enemy.castCooldown <= 0) {
    const baseAngle = Math.atan2(dirY, dirX);
    const spread = ((game.config.enemy.necromancerProjectileSpreadDeg || 16) * Math.PI) / 180;
    const speed = game.config.enemy.necromancerProjectileSpeed || 230;
    const size = game.config.enemy.necromancerProjectileSize || 12;
    const damage = game.config.enemy.necromancerProjectileDamage || 16;
    const life = game.config.enemy.necromancerProjectileLife || 2.8;
    const originDistance = enemy.size * 0.75;
    for (const offset of [-spread, 0, spread]) {
      const angle = baseAngle + offset;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      game.bullets.push({
        x: enemy.x + Math.cos(angle) * originDistance,
        y: enemy.y + Math.sin(angle) * originDistance,
        vx,
        vy,
        angle,
        life,
        size,
        kind: "necroticBolt",
        faction: "enemy",
        damage,
        damageType: "necrotic"
      });
    }
    enemy.castCooldown = castCooldownMax;
    enemy.hpBarTimer = Math.max(enemy.hpBarTimer || 0, game.config.enemy.hpBarDuration);
  }
  const strafeScale = playerDist > preferredRange * 0.7 ? 0.9 : 0.55;
  game.moveWithCollision(enemy, perpX * enemy.strafeDir * moveStep * strafeScale, perpY * enemy.strafeDir * moveStep * strafeScale);
}

function moveEntityTowardPoint(game, entity, targetX, targetY, speed, dt, minDistance = 0) {
  if (!entity || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return 0;
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const dist = vecLength(dx, dy) || 1;
  if (dist <= minDistance) return dist;
  const step = Math.max(0, speed) * Math.max(0, dt);
  const moveStep = Math.min(step, dist - minDistance);
  game.moveWithCollision(entity, (dx / dist) * moveStep, (dy / dist) * moveStep);
  return dist;
}

function dropLeprechaunGoldPile(game, enemy) {
  const remaining = Math.max(0, (game.config.enemy.leprechaunGoldDropTotal || 1000) - (enemy.goldDropped || 0));
  if (remaining <= 0) return false;
  const min = Math.max(1, game.config.enemy.leprechaunGoldPileMin || 10);
  const max = Math.max(min, game.config.enemy.leprechaunGoldPileMax || 35);
  const duration = Math.max(1, game.config.enemy.leprechaunGoldDropMinDuration || 10);
  const cooldown = Math.max(0.05, game.config.enemy.leprechaunGoldDropCooldown || 0.1);
  const timeRemaining = Math.max(0, duration - (enemy.fleeElapsed || 0));
  const dropsLeft = Math.max(1, Math.ceil(timeRemaining / cooldown) + 1);
  const guided = Math.round(remaining / dropsLeft);
  const amount = Math.min(remaining, Math.max(min, Math.min(max, guided || min)));
  const scatter = enemy.size * 0.45;
  game.drops.push({
    type: "gold",
    x: enemy.x + (Math.random() - 0.5) * scatter,
    y: enemy.y + (Math.random() - 0.5) * scatter,
    size: 9,
    amount,
    life: game.config.drops.life + 24
  });
  enemy.goldDropped = (enemy.goldDropped || 0) + amount;
  return true;
}

function spawnLuckyCharmVolley(game, enemy) {
  const count = Math.max(1, Math.floor(game.config.enemy.leprechaunCharmVolleyCount || 5));
  const spreadRad = ((game.config.enemy.leprechaunCharmSpreadDeg || 28) * Math.PI) / 180;
  const baseAngle = Math.atan2(enemy.dirY || 0, enemy.dirX || 1);
  const speed = game.config.enemy.leprechaunCharmProjectileSpeed || 300;
  const life = game.config.enemy.leprechaunCharmProjectileLife || 2.2;
  const damage = game.config.enemy.leprechaunCharmProjectileDamage || 18;
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const offset = (t - 0.5) * spreadRad;
    const angle = baseAngle + offset;
    game.bullets.push({
      x: enemy.x + Math.cos(angle) * enemy.size * 0.7,
      y: enemy.y + Math.sin(angle) * enemy.size * 0.7,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      life,
      size: 10,
      projectileType: "luckyCharm",
      faction: "enemy",
      damage,
      damageType: "magic"
    });
  }
}

function applyLeprechaunPunch(game, enemy) {
  const dx = game.player.x - enemy.x;
  const dy = game.player.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  const range = (game.config.enemy.leprechaunPunchRangeTiles || 2.2) * (game.config.map?.tile || 32);
  if (dist > range + game.getPlayerEnemyCollisionRadius()) return false;
  if (game.player.hitCooldown > 0) return false;
  game.player.hitCooldown = 1.0;
  const rawDamage = game.rollEnemyContactDamage({
    damageMin: game.config.enemy.leprechaunPunchDamageMin,
    damageMax: game.config.enemy.leprechaunPunchDamageMax
  });
  const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
  const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
  const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
  game.applyPlayerDamage(damageTaken);
  if (typeof game.applyPlayerKnockback === "function") {
    game.applyPlayerKnockback(
      (game.config.enemy.leprechaunPunchKnockbackTiles || 20) * (game.config.map?.tile || 32),
      dx / dist,
      dy / dist
    );
  }
  return true;
}

export function updateLeprechaunBoss(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const toPlayerX = game.player.x - enemy.x;
  const toPlayerY = game.player.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  enemy.dirX = toPlayerX / playerDist;
  enemy.dirY = toPlayerY / playerDist;
  enemy.goldDropCooldown = Math.max(0, (enemy.goldDropCooldown || 0) - dt);
  enemy.charmCooldown = Math.max(0, (enemy.charmCooldown || 0) - dt);
  enemy.punchCooldown = Math.max(0, (enemy.punchCooldown || 0) - dt);
  enemy.punchWindup = Math.max(0, (enemy.punchWindup || 0) - dt);
  enemy.speechCooldown = Math.max(0, (enemy.speechCooldown || 0) - dt);

  if (enemy.phase === "intro") {
    enemy.invincible = true;
    enemy.speed = game.config.enemy.leprechaunIntroSpeed || game.config.enemy.leprechaunFleeSpeed;
    if (typeof game.moveEnemyTowardTargetPoint === "function") {
      game.moveEnemyTowardTargetPoint(enemy, game.player.x, game.player.y, speedScale, dt, (game.config.enemy.leprechaunIntroApproachTiles || 3) * tile);
    } else {
      moveEntityTowardPoint(game, enemy, game.player.x, game.player.y, enemy.speed * (speedScale || 1), dt, (game.config.enemy.leprechaunIntroApproachTiles || 3) * tile);
    }
    if (playerDist <= (game.config.enemy.leprechaunIntroApproachTiles || 3) * tile) {
      enemy.phase = "flee";
      if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("flee");
      if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("Catch me if ye can!", enemy.x, enemy.y, 1.8);
    }
    return;
  }

  if (enemy.phase === "flee") {
    enemy.invincible = true;
    enemy.speed = game.config.enemy.leprechaunFleeSpeed;
    enemy.fleeElapsed = (enemy.fleeElapsed || 0) + dt;
    moveEntityTowardPoint(game, enemy, enemy.x - toPlayerX, enemy.y - toPlayerY, enemy.speed * (speedScale || 1), dt);
    if (enemy.goldDropCooldown <= 0) {
      if (dropLeprechaunGoldPile(game, enemy)) {
        enemy.goldDropCooldown = game.config.enemy.leprechaunGoldDropCooldown || 0.1;
      }
      if (
        (enemy.goldDropped || 0) >= (game.config.enemy.leprechaunGoldDropTotal || 1000) &&
        (enemy.fleeElapsed || 0) >= (game.config.enemy.leprechaunGoldDropMinDuration || 10)
      ) {
        enemy.phase = "to_pot";
        enemy.potSpawned = true;
        if (game.floorBoss) {
          game.floorBoss.potX = enemy.potX;
          game.floorBoss.potY = enemy.potY;
        }
        if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("to_pot");
        if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("The pot awaits, if ye dare!", enemy.x, enemy.y, 2.1);
      }
    }
    return;
  }

  if (enemy.phase === "to_pot") {
    enemy.invincible = true;
    enemy.speed = game.config.enemy.leprechaunRunToPotSpeed;
    if (typeof game.moveEnemyTowardTargetPoint === "function") {
      game.moveEnemyTowardTargetPoint(enemy, enemy.potX, enemy.potY, 1, dt, tile * 0.4, true);
    } else {
      moveEntityTowardPoint(game, enemy, enemy.potX, enemy.potY, enemy.speed, dt, tile * 0.4);
    }
    const potDist = vecLength(enemy.potX - enemy.x, enemy.potY - enemy.y);
    if (potDist <= tile * 0.8) {
      enemy.phase = "waiting";
      if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("waiting");
    }
    return;
  }

  if (enemy.phase === "waiting") {
    enemy.invincible = true;
    if (playerDist <= (game.config.enemy.leprechaunTransformRangeTiles || 8) * tile) {
      enemy.phase = "enraged";
      enemy.invincible = false;
      enemy.size = 46;
      enemy.speed = game.config.enemy.leprechaunEnragedSpeed;
      enemy.hp = enemy.maxHp;
      enemy.hpBarTimer = 9999;
      if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("enraged");
      if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("Now ye face the gold's true guardian!", enemy.x, enemy.y, 2.6);
    }
    return;
  }

  enemy.invincible = false;
  enemy.speed = game.config.enemy.leprechaunEnragedSpeed;
  if (enemy.speechCooldown <= 0 && typeof game.maybeQueueRandomLeprechaunSpeech === "function") {
    if (game.maybeQueueRandomLeprechaunSpeech(enemy)) enemy.speechCooldown = 4 + Math.random() * 3.5;
  }
  if ((enemy.punchWindup || 0) > 0) {
    if (!enemy.punchApplied && enemy.punchWindup <= (game.config.enemy.leprechaunPunchWindup || 0.32) * 0.45) {
      enemy.punchApplied = true;
      applyLeprechaunPunch(game, enemy);
    }
    return;
  }
  const punchRange = (game.config.enemy.leprechaunPunchRangeTiles || 2.2) * tile;
  if (playerDist <= punchRange && enemy.punchCooldown <= 0) {
    enemy.punchCooldown = game.config.enemy.leprechaunPunchCooldown || 2.2;
    enemy.punchWindup = game.config.enemy.leprechaunPunchWindup || 0.32;
    enemy.punchApplied = false;
    if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("Taste me lucky left hook!", enemy.x, enemy.y, 1.9);
    return;
  }
  if (enemy.charmCooldown <= 0) {
    spawnLuckyCharmVolley(game, enemy);
    enemy.charmCooldown = game.config.enemy.leprechaunCharmCooldown || 1.2;
    return;
  }
  moveEntityTowardPoint(game, enemy, game.player.x, game.player.y, enemy.speed, dt, Math.max(12, punchRange * 0.4));
}
