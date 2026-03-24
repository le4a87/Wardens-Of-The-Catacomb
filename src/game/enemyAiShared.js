import { vecLength } from "../utils.js";

export function hasLineOfSight(game, x0, y0, x1, y1) {
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

export function isFriendlyToPlayer(game, enemy) {
  return typeof game?.isEnemyFriendlyToPlayer === "function" ? game.isEnemyFriendlyToPlayer(enemy) : !!enemy?.isControlledUndead;
}

export function isHostilePair(game, source, target) {
  if (!source || !target || source === target) return false;
  return isFriendlyToPlayer(game, source) !== isFriendlyToPlayer(game, target);
}

export function isActiveCharmTarget(game, enemy) {
  if (!enemy) return false;
  if (typeof game?.isEnemyTargetedByAnyNecromancerBeam === "function") return game.isEnemyTargetedByAnyNecromancerBeam(enemy);
  return !!game?.necromancerBeam?.active && game.necromancerBeam.targetEnemy === enemy;
}

export function getEnemyAttackOwnerId(game, enemy) {
  if (!enemy || !isFriendlyToPlayer(game, enemy)) return null;
  return typeof enemy.controllerPlayerId === "string" && enemy.controllerPlayerId ? enemy.controllerPlayerId : null;
}

export function getPriorityTarget(game, enemy, maxRange = Infinity) {
  if (!enemy) return game.player;
  const sourceFriendly = isFriendlyToPlayer(game, enemy);
  const livingPlayers = typeof game.getLivingPlayerEntities === "function" ? game.getLivingPlayerEntities() : [game.player];
  const controllingPlayer =
    sourceFriendly && typeof game?.getControllingPlayerEntityForEnemy === "function"
      ? game.getControllingPlayerEntityForEnemy(enemy)
      : null;
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  if (!sourceFriendly) {
    for (const player of livingPlayers) {
      if (!player) continue;
      const dist = vecLength((player.x || 0) - enemy.x, (player.y || 0) - enemy.y);
      if (dist > maxRange || dist >= bestDist) continue;
      best = player;
      bestDist = dist;
    }
  }
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
  if (best) return best;
  if (sourceFriendly && controllingPlayer) {
    return {
      id: controllingPlayer.id || null,
      x: controllingPlayer.x,
      y: controllingPlayer.y,
      anchorOnly: true
    };
  }
  return livingPlayers[0] || game.player;
}

export function moveEnemyTowardPoint(game, enemy, target, dt, speedScale, minDistance = 0) {
  if (!enemy || !target) return;
  if (typeof game.moveEnemyTowardTarget === "function") {
    game.moveEnemyTowardTarget(enemy, target, speedScale, dt, minDistance);
    return;
  }
  if (typeof game.moveEnemyTowardTargetPoint === "function") {
    game.moveEnemyTowardTargetPoint(enemy, target, speedScale, dt, minDistance);
    return;
  }
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const len = vecLength(dx, dy) || 1;
  if (len <= minDistance) return;
  game.moveWithCollision(enemy, (dx / len) * enemy.speed * speedScale * dt, (dy / len) * enemy.speed * speedScale * dt);
}

export function countSummonedSkeletons(game) {
  return (game.enemies || []).filter((other) => other && other.type === "skeleton" && other.summonerBoss && other.hp > 0).length;
}

export function findSkeletonSummonPoint(game, enemy, angle, distance) {
  const tile = game.config?.map?.tile || 32;
  for (let attempt = 0; attempt < 4; attempt++) {
    const dist = distance + attempt * (tile * 0.35);
    const x = enemy.x + Math.cos(angle) * dist;
    const y = enemy.y + Math.sin(angle) * dist;
    if (!game.isWallAt(x, y, true)) return { x, y };
  }
  return null;
}

export function isProjectileThreatening(enemy, projectile, radius) {
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

export function segmentDistanceToPoint(x0, y0, x1, y1, px, py) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return vecLength(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lenSq));
  const cx = x0 + dx * t;
  const cy = y0 + dy * t;
  return vecLength(px - cx, py - cy);
}

export function isCoveredFromPlayer(game, x, y, self = null) {
  const player = typeof game.getNearestPlayerEntity === "function" ? game.getNearestPlayerEntity(x, y) : game.player;
  if (!player) return false;
  if (!hasLineOfSight(game, player.x, player.y, x, y)) return true;
  for (const br of game.breakables || []) {
    if ((br.hp || 0) <= 0) continue;
    const radius = (Number.isFinite(br.size) ? br.size : 20) * 0.5;
    if (segmentDistanceToPoint(player.x, player.y, x, y, br.x, br.y) <= radius) return true;
  }
  for (const enemy of game.enemies || []) {
    if (!enemy || enemy === self || (enemy.hp || 0) <= 0) continue;
    if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
    const radius = (Number.isFinite(enemy.size) ? enemy.size : 20) * 0.5;
    if (segmentDistanceToPoint(player.x, player.y, x, y, enemy.x, enemy.y) <= radius) return true;
  }
  return false;
}

export function findRatCoverTarget(game, enemy, minPlayerDist) {
  const player = typeof game.getNearestPlayerEntity === "function" ? game.getNearestPlayerEntity(enemy.x, enemy.y) : game.player;
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
      if (vecLength(player.x - x, player.y - y) < minPlayerDist) continue;
      if (!isCoveredFromPlayer(game, x, y, enemy)) continue;
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function findNecromancerTeleportPoint(game, enemy) {
  const player = typeof game.getNearestPlayerEntity === "function" ? game.getNearestPlayerEntity(enemy.x, enemy.y) : game.player;
  const tile = game.config?.map?.tile || 32;
  const minRange = Math.max(tile * 2, (game.config.enemy.necromancerBossTeleportMinRangeTiles || 3.25) * tile);
  const maxRange = Math.max(minRange + tile * 0.5, (game.config.enemy.necromancerBossTeleportMaxRangeTiles || 4.75) * tile);
  const radius = Math.max(6, (Number.isFinite(enemy?.size) ? enemy.size : tile * 0.9) * 0.5);
  const angles = [];
  const angleStep = Math.PI / 4;
  const startAngle = Math.random() * Math.PI * 2;
  for (let i = 0; i < 8; i++) angles.push(startAngle + i * angleStep);
  for (const angle of angles) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const dist = minRange + (maxRange - minRange) * (attempt / 2);
      const x = player.x + Math.cos(angle) * dist;
      const y = player.y + Math.sin(angle) * dist;
      const tx = Math.floor(x / tile);
      const ty = Math.floor(y / tile);
      if (!game.isWalkableTile(tx, ty)) continue;
      const safePoint =
        typeof game.findNearestSafePoint === "function"
          ? game.findNearestSafePoint(x, y, 4)
          : { x, y };
      if (!safePoint) continue;
      if (typeof game.isPositionWalkable === "function" && !game.isPositionWalkable(safePoint.x, safePoint.y, radius, true)) continue;
      if (vecLength(safePoint.x - player.x, safePoint.y - player.y) < minRange * 0.9) continue;
      if (vecLength(safePoint.x - enemy.x, safePoint.y - enemy.y) < tile) continue;
      return safePoint;
    }
  }
  return null;
}
