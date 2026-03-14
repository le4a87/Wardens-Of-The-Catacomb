import { vecLength } from "../../utils.js";

function isBreakableBlockingTile(game, tx, ty) {
  const list = game.breakables || [];
  if (!Array.isArray(list) || list.length === 0) return false;
  const tileSize = game.config.map.tile;
  const left = tx * tileSize;
  const top = ty * tileSize;
  const right = left + tileSize;
  const bottom = top + tileSize;
  for (const br of list) {
    if (!br || (br.hp || 0) <= 0) continue;
    const r = (Number.isFinite(br.size) ? br.size : 20) * 0.5;
    const bx0 = br.x - r;
    const by0 = br.y - r;
    const bx1 = br.x + r;
    const by1 = br.y + r;
    if (bx1 < left || bx0 > right || by1 < top || by0 > bottom) continue;
    return true;
  }
  return false;
}

export function parseMap(game) {
  const tile = game.config.map.tile;
  for (let y = 0; y < game.map.length; y++) {
    for (let x = 0; x < game.map[0].length; x++) {
      const c = game.map[y][x];
      const px = x * tile + tile / 2;
      const py = y * tile + tile / 2;
      if (c === "P") {
        game.player.x = px;
        game.player.y = py;
      } else if (c === "D") {
        game.door.x = px;
        game.door.y = py;
      } else if (c === "K") {
        game.pickup.x = px;
        game.pickup.y = py;
      }
    }
  }
  revealAroundPlayer(game);
}

export function revealAroundPlayer(game) {
  const r = game.config.map.exploreRadiusTiles;
  const tile = game.config.map.tile;
  const tileX = Math.floor(game.player.x / tile);
  const tileY = Math.floor(game.player.y / tile);
  for (let y = tileY - r; y <= tileY + r; y++) {
    for (let x = tileX - r; x <= tileX + r; x++) {
      if (y < 0 || x < 0 || y >= game.map.length || x >= game.map[0].length) continue;
      if (vecLength(x - tileX, y - tileY) <= r + 0.25) game.explored[y][x] = true;
    }
  }
}

export function isWallAt(game, x, y, blockBreakables = true) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  const tileSize = game.config.map.tile;
  const tx = Math.floor(x / tileSize);
  const ty = Math.floor(y / tileSize);
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return true;
  if (tx < 0 || ty < 0 || ty >= game.map.length || tx >= game.map[0].length) return true;
  if (!game.map[ty]) return true;
  const tile = game.map[ty][tx];
  if (tile === "#") return true;
  if (tile === "D" && !game.door.open) return true;
  if (blockBreakables && isBreakableBlockingTile(game, tx, ty)) return true;
  return false;
}

export function isWalkableTile(game, tx, ty) {
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
  if (tx < 0 || ty < 0 || ty >= game.map.length || tx >= game.map[0].length) return false;
  if (!game.map[ty]) return false;
  const tile = game.map[ty][tx];
  if (tile === "#") return false;
  if (tile === "D" && !game.door.open) return false;
  if (isBreakableBlockingTile(game, tx, ty)) return false;
  return true;
}

export function updateNavigationField(game, force = false) {
  const tileSize = game.config.map.tile;
  const ptx = Math.floor(game.player.x / tileSize);
  const pty = Math.floor(game.player.y / tileSize);
  const playerTileChanged = ptx !== game.navPlayerTile.x || pty !== game.navPlayerTile.y;
  if (!force && !playerTileChanged) return;

  game.navPlayerTile.x = ptx;
  game.navPlayerTile.y = pty;

  for (let y = 0; y < game.navDistance.length; y++) {
    game.navDistance[y].fill(-1);
  }
  if (!isWalkableTile(game, ptx, pty)) return;

  const queueX = [ptx];
  const queueY = [pty];
  game.navDistance[pty][ptx] = 0;
  let head = 0;
  const dirsX = [1, -1, 0, 0];
  const dirsY = [0, 0, 1, -1];
  while (head < queueX.length) {
    const cx = queueX[head];
    const cy = queueY[head];
    head += 1;
    const baseDist = game.navDistance[cy][cx];
    for (let i = 0; i < 4; i++) {
      const nx = cx + dirsX[i];
      const ny = cy + dirsY[i];
      if (!isWalkableTile(game, nx, ny)) continue;
      if (game.navDistance[ny][nx] !== -1) continue;
      game.navDistance[ny][nx] = baseDist + 1;
      queueX.push(nx);
      queueY.push(ny);
    }
  }
}

export function getPathDirectionToPlayer(game, entity) {
  const tileSize = game.config.map.tile;
  const tx = Math.floor(entity.x / tileSize);
  const ty = Math.floor(entity.y / tileSize);
  const directDx = game.player.x - entity.x;
  const directDy = game.player.y - entity.y;
  const directLen = vecLength(directDx, directDy) || 1;

  if (!Number.isFinite(tx) || !Number.isFinite(ty) || game.navDistance.length === 0 || !game.navDistance[0]) {
    return { x: directDx / directLen, y: directDy / directLen };
  }
  if (ty < 0 || tx < 0 || ty >= game.navDistance.length || tx >= game.navDistance[0].length) {
    return { x: directDx / directLen, y: directDy / directLen };
  }

  const current = game.navDistance[ty][tx];
  if (current <= 0) return { x: directDx / directLen, y: directDy / directLen };

  let bestTx = tx;
  let bestTy = ty;
  let bestDist = current;
  const dirsX = [1, -1, 0, 0];
  const dirsY = [0, 0, 1, -1];
  for (let i = 0; i < 4; i++) {
    const nx = tx + dirsX[i];
    const ny = ty + dirsY[i];
    if (!isWalkableTile(game, nx, ny)) continue;
    const d = game.navDistance[ny][nx];
    if (d < 0 || d >= current) continue;
    if (d < bestDist) {
      bestDist = d;
      bestTx = nx;
      bestTy = ny;
    }
  }

  if (bestDist >= current) return { x: directDx / directLen, y: directDy / directLen };

  const targetX = bestTx * tileSize + tileSize / 2;
  const targetY = bestTy * tileSize + tileSize / 2;
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const len = vecLength(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function moveEnemyTowardPlayer(game, enemy, speedScale, dt) {
  if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) {
    return;
  }
  const enemySpeed = Number.isFinite(enemy.speed) ? enemy.speed : 70;
  const sScale = Number.isFinite(speedScale) ? speedScale : 1;
  const delta = Number.isFinite(dt) ? dt : 0;
  const speedStep = enemySpeed * sScale * delta;
  if (!Number.isFinite(speedStep) || speedStep <= 0) return;
  const dx = game.player.x - enemy.x;
  const dy = game.player.y - enemy.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  const len = vecLength(dx, dy) || 1;
  const playerRadius = typeof game.getPlayerEnemyCollisionRadius === "function"
    ? game.getPlayerEnemyCollisionRadius()
    : ((game.config?.player?.enemyCollisionSize ?? game.player?.size ?? 0) * 0.5);
  const minDistance = playerRadius + enemy.size * 0.5;
  if (len <= minDistance) return;
  const moveStep = Math.min(speedStep, len - minDistance);
  if (!Number.isFinite(moveStep) || moveStep <= 0) return;
  const dirX = dx / len;
  const dirY = dy / len;
  const perpX = -dirY;
  const perpY = dirX;

  const beforeX = enemy.x;
  const beforeY = enemy.y;
  moveWithCollision(game, enemy, dirX * moveStep, dirY * moveStep);
  const movedDirect = vecLength(enemy.x - beforeX, enemy.y - beforeY) > moveStep * 0.12;
  if (movedDirect) return;

  // If direct path is blocked, probe around corners.
  const probes = [
    { x: perpX, y: perpY },
    { x: -perpX, y: -perpY },
    { x: dirX * 0.65 + perpX * 0.75, y: dirY * 0.65 + perpY * 0.75 },
    { x: dirX * 0.65 - perpX * 0.75, y: dirY * 0.65 - perpY * 0.75 }
  ];

  for (const p of probes) {
    const plen = vecLength(p.x, p.y) || 1;
    const sx = (p.x / plen) * moveStep;
    const sy = (p.y / plen) * moveStep;
    const px = enemy.x;
    const py = enemy.y;
    moveWithCollision(game, enemy, sx, sy);
    if (vecLength(enemy.x - px, enemy.y - py) > moveStep * 0.12) return;
  }
}

export function separateEnemyFromPlayer(game, enemy) {
  if (!game?.player || !enemy) return;
  const playerRadius = typeof game.getPlayerEnemyCollisionRadius === "function"
    ? game.getPlayerEnemyCollisionRadius()
    : ((game.config?.player?.enemyCollisionSize ?? game.player?.size ?? 0) * 0.5);
  const enemyRadius = (Number.isFinite(enemy.size) ? enemy.size : 0) * 0.5;
  const minDistance = playerRadius + enemyRadius;
  let dx = enemy.x - game.player.x;
  let dy = enemy.y - game.player.y;
  let dist = vecLength(dx, dy);
  if (dist >= minDistance) return;

  if (dist < 0.001) {
    dx = Number.isFinite(enemy.lastX) ? enemy.x - enemy.lastX : 0;
    dy = Number.isFinite(enemy.lastY) ? enemy.y - enemy.lastY : 0;
    dist = vecLength(dx, dy);
    if (dist < 0.001) {
      dx = game.player.dirX || 1;
      dy = game.player.dirY || 0;
      dist = vecLength(dx, dy) || 1;
    }
  }

  const overlap = minDistance - dist;
  moveWithCollision(game, enemy, (dx / dist) * overlap, (dy / dist) * overlap);
}

export function moveWithCollision(game, entity, dx, dy) {
  if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  const r = entity.size / 2;
  const nx = entity.x + dx;
  const ny = entity.y + dy;
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
  if (
    !isWallAt(game, nx - r, entity.y - r) &&
    !isWallAt(game, nx + r, entity.y - r) &&
    !isWallAt(game, nx - r, entity.y + r) &&
    !isWallAt(game, nx + r, entity.y + r)
  ) {
    entity.x = nx;
  }
  if (
    !isWallAt(game, entity.x - r, ny - r) &&
    !isWallAt(game, entity.x + r, ny - r) &&
    !isWallAt(game, entity.x - r, ny + r) &&
    !isWallAt(game, entity.x + r, ny + r)
  ) {
    entity.y = ny;
  }
}
