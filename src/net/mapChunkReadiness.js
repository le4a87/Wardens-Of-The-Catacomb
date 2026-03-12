function mapChunkKey(cx, cy) {
  return `${cx}:${cy}`;
}

export function getRequiredChunkKeysForView(game, playerX, playerY, chunkSize = 24) {
  const keys = new Set();
  if (!game || !Number.isFinite(playerX) || !Number.isFinite(playerY)) return keys;
  const tile = game.config?.map?.tile || 32;
  const safeChunkSize = Number.isFinite(chunkSize) ? Math.max(1, Math.floor(chunkSize)) : 24;
  const mapW = Number.isFinite(game.mapWidth) ? game.mapWidth : 0;
  const mapH = Number.isFinite(game.mapHeight) ? game.mapHeight : 0;
  if (mapW <= 0 || mapH <= 0) return keys;

  const playW = typeof game.getPlayAreaWidth === "function" ? game.getPlayAreaWidth() : 960;
  const viewH = Number.isFinite(game.canvas?.height) ? game.canvas.height : 640;
  const halfW = playW * 0.5;
  const halfH = viewH * 0.5;
  const worldMaxX = Math.max(0, mapW * tile - playW);
  const worldMaxY = Math.max(0, mapH * tile - viewH);
  const camX = Math.max(0, Math.min(worldMaxX, playerX - halfW));
  const camY = Math.max(0, Math.min(worldMaxY, playerY - halfH));
  const padTiles = 6;

  const minTx = Math.max(0, Math.floor(camX / tile) - padTiles);
  const maxTx = Math.min(mapW - 1, Math.ceil((camX + playW) / tile) + padTiles);
  const minTy = Math.max(0, Math.floor(camY / tile) - padTiles);
  const maxTy = Math.min(mapH - 1, Math.ceil((camY + viewH) / tile) + padTiles);

  const minCx = Math.floor(minTx / safeChunkSize);
  const maxCx = Math.floor(maxTx / safeChunkSize);
  const minCy = Math.floor(minTy / safeChunkSize);
  const maxCy = Math.floor(maxTy / safeChunkSize);

  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      if (cx < 0 || cy < 0) continue;
      keys.add(mapChunkKey(cx, cy));
    }
  }
  return keys;
}

export function computeChunkReadiness(game, playerX, playerY, chunkSize, receivedChunkKeys) {
  if (game && game.networkChunkSync === false) {
    return { requiredChunkKeys: new Set(), hasChunks: true };
  }
  if (!game) return { requiredChunkKeys: new Set(), hasChunks: false };
  if (!game.networkHasMap) {
    return { requiredChunkKeys: new Set(), hasChunks: false };
  }
  const requiredChunkKeys = getRequiredChunkKeysForView(game, playerX, playerY, chunkSize);
  if (requiredChunkKeys.size === 0) {
    return { requiredChunkKeys, hasChunks: receivedChunkKeys.size > 0 };
  }
  for (const key of requiredChunkKeys) {
    if (!receivedChunkKeys.has(key)) {
      return { requiredChunkKeys, hasChunks: false };
    }
  }
  return { requiredChunkKeys, hasChunks: true };
}

export function chunkKey(cx, cy) {
  return mapChunkKey(cx, cy);
}
