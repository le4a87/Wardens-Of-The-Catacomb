export function applyMapStateToGame(game, payload) {
  if (!Array.isArray(payload.map) || payload.map.length === 0) return "";
  const firstRow = payload.map[0];
  const rowLength =
    typeof firstRow === "string"
      ? firstRow.length
      : Array.isArray(firstRow)
      ? firstRow.length
      : 0;
  if (rowLength <= 0) return "";
  const tile = game.config.map.tile;
  game.map = payload.map;
  game.mapWidth = Number.isFinite(payload.mapWidth) ? payload.mapWidth : rowLength;
  game.mapHeight = Number.isFinite(payload.mapHeight) ? payload.mapHeight : payload.map.length;
  game.worldWidth = rowLength * tile;
  game.worldHeight = payload.map.length * tile;
  game.explored = Array.from({ length: payload.map.length }, () => Array(rowLength).fill(false));
  game.navDistance = Array.from({ length: payload.map.length }, () => Array(rowLength).fill(-1));
  game.navPlayerTile = { x: -1, y: -1 };
  return typeof payload.mapSignature === "string" ? payload.mapSignature : `${game.floor}:${game.mapWidth}x${game.mapHeight}`;
}

export function applyMapMetaToGame(game, payload) {
  const mapWidth = Number.isFinite(payload?.mapWidth) ? Math.max(1, Math.floor(payload.mapWidth)) : 0;
  const mapHeight = Number.isFinite(payload?.mapHeight) ? Math.max(1, Math.floor(payload.mapHeight)) : 0;
  if (mapWidth <= 0 || mapHeight <= 0) return "";
  const tile = game.config.map.tile;
  game.mapWidth = mapWidth;
  game.mapHeight = mapHeight;
  // Use a dedicated unknown marker so client-side prediction can avoid treating
  // unsynced tiles as solid collision walls.
  game.map = Array.from({ length: mapHeight }, () => Array(mapWidth).fill("?"));
  game.worldWidth = mapWidth * tile;
  game.worldHeight = mapHeight * tile;
  game.explored = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false));
  game.navDistance = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(-1));
  game.navPlayerTile = { x: -1, y: -1 };
  return typeof payload.mapSignature === "string" ? payload.mapSignature : `${game.floor}:${game.mapWidth}x${game.mapHeight}`;
}

export function isKnownMapTileAt(game, x, y) {
  if (!game || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const tileSize = game.config?.map?.tile || 32;
  const tx = Math.floor(x / tileSize);
  const ty = Math.floor(y / tileSize);
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
  if (ty < 0 || tx < 0 || ty >= game.map.length || tx >= game.map[0].length) return false;
  const row = game.map[ty];
  if (!row) return false;
  const tile = row[tx];
  return tile !== "?";
}

export function applyMapChunkToGame(game, payload) {
  if (!Array.isArray(game.map) || game.map.length === 0) return false;
  const chunkSize = Number.isFinite(payload?.chunkSize) ? Math.max(1, Math.floor(payload.chunkSize)) : 0;
  const cx = Number.isFinite(payload?.cx) ? Math.floor(payload.cx) : NaN;
  const cy = Number.isFinite(payload?.cy) ? Math.floor(payload.cy) : NaN;
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (chunkSize <= 0 || !Number.isFinite(cx) || !Number.isFinite(cy) || rows.length === 0) return false;
  const startX = cx * chunkSize;
  const startY = cy * chunkSize;
  let wrote = false;
  for (let r = 0; r < rows.length; r++) {
    const rowData = rows[r];
    if (typeof rowData !== "string" && !Array.isArray(rowData)) continue;
    const y = startY + r;
    if (y < 0 || y >= game.map.length) continue;
    const chars = typeof rowData === "string" ? rowData : rowData.join("");
    for (let c = 0; c < chars.length; c++) {
      const x = startX + c;
      if (x < 0 || x >= game.map[0].length) continue;
      const ch = chars[c];
      if (typeof ch !== "string" || ch.length === 0) continue;
      game.map[y][x] = ch;
      wrote = true;
    }
  }
  return wrote;
}

export function syncByIdLerp(target, source, positionAlpha = 1, decorate) {
  const src = Array.isArray(source) ? source : [];
  if (!Array.isArray(target)) {
    return src.map((entry) => {
      const obj = { ...entry };
      if (decorate) decorate(obj);
      return obj;
    });
  }
  const existingById = new Map();
  for (let i = 0; i < target.length; i++) {
    const item = target[i];
    if (item && item.id != null) existingById.set(item.id, item);
  }
  for (let i = 0; i < src.length; i++) {
    const srcItem = src[i];
    const id = srcItem && srcItem.id != null ? srcItem.id : null;
    let dst = id != null ? existingById.get(id) : target[i];
    if (!dst) {
      dst = { ...srcItem };
    } else {
      const prevX = Number.isFinite(dst.x) ? dst.x : null;
      const prevY = Number.isFinite(dst.y) ? dst.y : null;
      const sx = Number.isFinite(srcItem.x) ? srcItem.x : null;
      const sy = Number.isFinite(srcItem.y) ? srcItem.y : null;
      Object.assign(dst, srcItem);
      if (sx !== null && sy !== null && prevX !== null && prevY !== null && positionAlpha < 1) {
        dst.x = prevX * (1 - positionAlpha) + sx * positionAlpha;
        dst.y = prevY * (1 - positionAlpha) + sy * positionAlpha;
      }
    }
    if (decorate) decorate(dst);
    target[i] = dst;
  }
  target.length = src.length;
  return target;
}

function applyDeltaCollection(target, delta, { keyframe = false, positionAlpha = 1, decorate, mapSpawn } = {}) {
  if (!Array.isArray(target)) target = [];
  const d = delta && typeof delta === "object" ? delta : null;
  if (!d) return target;
  const existing = new Map();
  for (const item of target) {
    if (item && item.id != null) existing.set(item.id, item);
  }

  const spawnList = Array.isArray(d.spawn) ? d.spawn : [];
  const updateList = Array.isArray(d.update) ? d.update : [];
  const despawnList = Array.isArray(d.despawn) ? d.despawn : [];

  if (keyframe) existing.clear();

  for (const raw of spawnList) {
    if (!raw || raw.id == null) continue;
    const entry = mapSpawn ? mapSpawn(raw) : raw;
    const obj = { ...entry };
    if (decorate) decorate(obj);
    existing.set(obj.id, obj);
  }

  for (const patch of updateList) {
    if (!patch || patch.id == null) continue;
    const current = existing.get(patch.id);
    if (!current) {
      const obj = { ...patch };
      if (decorate) decorate(obj);
      existing.set(obj.id, obj);
      continue;
    }
    const prevX = Number.isFinite(current.x) ? current.x : null;
    const prevY = Number.isFinite(current.y) ? current.y : null;
    const nextX = Number.isFinite(patch.x) ? patch.x : null;
    const nextY = Number.isFinite(patch.y) ? patch.y : null;
    Object.assign(current, patch);
    if (prevX !== null && prevY !== null && nextX !== null && nextY !== null && positionAlpha < 1) {
      current.x = prevX * (1 - positionAlpha) + nextX * positionAlpha;
      current.y = prevY * (1 - positionAlpha) + nextY * positionAlpha;
    }
    if (decorate) decorate(current);
  }

  for (const id of despawnList) existing.delete(id);

  target.length = 0;
  for (const item of existing.values()) target.push(item);
  return target;
}

function syncNamedObject(target, source) {
  if (!source || typeof source !== "object") return target;
  if (!target || typeof target !== "object") return { ...source };
  for (const key of Object.keys(source)) {
    const src = source[key];
    if (src && typeof src === "object" && !Array.isArray(src)) {
      target[key] = syncNamedObject(target[key], src);
    } else {
      target[key] = src;
    }
  }
  return target;
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function syncFloorBossState(target, source, game) {
  if (!source || typeof source !== "object") return target;
  const base =
    target && typeof target === "object"
      ? target
      : typeof game?.createFloorBossState === "function"
      ? game.createFloorBossState(Number.isFinite(source.floor) ? source.floor : game.floor)
      : {};
  Object.assign(base, source);
  return base;
}

export function applyMetaStateToGame(game, state) {
  if (!state || typeof state !== "object") return;
  if (Number.isFinite(state.time)) game.time = state.time;
  if (Number.isFinite(state.floor)) game.floor = state.floor;
  if (Number.isFinite(state.level)) game.level = state.level;
  if (Number.isFinite(state.score)) game.score = state.score;
  if (Number.isFinite(state.gold)) game.gold = state.gold;
  if (Number.isFinite(state.experience)) game.experience = state.experience;
  if (Number.isFinite(state.expToNextLevel)) game.expToNextLevel = state.expToNextLevel;
  if (Number.isFinite(state.skillPoints)) game.skillPoints = state.skillPoints;
  if (hasOwn(state, "hasKey")) game.hasKey = !!state.hasKey;
  if (hasOwn(state, "gameOver")) game.gameOver = !!state.gameOver;
  if (hasOwn(state, "paused")) game.paused = !!state.paused;
  if (hasOwn(state, "shopOpen")) game.shopOpen = !!state.shopOpen;
  if (hasOwn(state, "skillTreeOpen")) game.skillTreeOpen = !!state.skillTreeOpen;
  if (hasOwn(state, "statsPanelOpen")) game.statsPanelOpen = !!state.statsPanelOpen;
  if (Number.isFinite(state.warriorMomentumTimer)) game.warriorMomentumTimer = state.warriorMomentumTimer;
  if (Number.isFinite(state.warriorRageActiveTimer)) game.warriorRageActiveTimer = state.warriorRageActiveTimer;
  if (Number.isFinite(state.warriorRageCooldownTimer)) game.warriorRageCooldownTimer = state.warriorRageCooldownTimer;
  if (state.floorBoss && typeof state.floorBoss === "object") game.floorBoss = syncFloorBossState(game.floorBoss, state.floorBoss, game);
  if (state.portal && typeof state.portal === "object") game.portal = { ...state.portal };
  if (state.musicTrack && typeof state.musicTrack === "object") game.musicTrack = { ...state.musicTrack };
  if (state.skills && typeof state.skills === "object") game.skills = syncNamedObject(game.skills, state.skills);
  if (state.upgrades && typeof state.upgrades === "object") game.upgrades = syncNamedObject(game.upgrades, state.upgrades);
}

export function applySnapshotToGame({
  game,
  state,
  controller = false,
  ackSeq = 0,
  isNetworkController = false,
  localPlayerId = null,
  netPredictedProjectiles = null,
  netPendingInputs = [],
  netLastAckSeq = 0,
  snapshotJitterMs = 0,
  frameGapMs = 16.67
}) {
  if (!state || typeof state !== "object") return { netPendingInputs, netLastAckSeq };
  applyMetaStateToGame(game, state);

  if (state.player && typeof state.player === "object") {
    if (!controller) {
      Object.assign(game.player, state.player);
    } else {
      const baseX = Number.isFinite(state.player.x) ? state.player.x : game.player.x;
      const baseY = Number.isFinite(state.player.y) ? state.player.y : game.player.y;
      let correctedX = baseX;
      let correctedY = baseY;
      if (ackSeq > 0) {
        netLastAckSeq = Math.max(netLastAckSeq, ackSeq);
        let keepFrom = 0;
        while (keepFrom < netPendingInputs.length && netPendingInputs[keepFrom].seq <= netLastAckSeq) keepFrom += 1;
        if (keepFrom > 0) netPendingInputs.splice(0, keepFrom);
        const probe = { x: baseX, y: baseY, size: game.player.size };
        for (const entry of netPendingInputs) {
          const mx = entry.moveX;
          const my = entry.moveY;
          if (mx || my) {
            const len = Math.hypot(mx, my) || 1;
            const speed = game.getPlayerMoveSpeed();
            game.moveWithCollision(probe, (mx / len) * speed * entry.dt, (my / len) * speed * entry.dt);
          }
        }
        correctedX = probe.x;
        correctedY = probe.y;
      }

      const dx = correctedX - game.player.x;
      const dy = correctedY - game.player.y;
      const errorSq = dx * dx + dy * dy;
      const errorDist = Math.sqrt(errorSq);
      const jitterMs = Number.isFinite(snapshotJitterMs) ? Math.max(0, snapshotJitterMs) : 0;
      const frameGap = Number.isFinite(frameGapMs) ? Math.max(0, frameGapMs) : 16.67;
      const pendingDepth = Array.isArray(netPendingInputs) ? netPendingInputs.length : 0;
      const jitterFactor = Math.max(0, Math.min(2.5, jitterMs / 8));
      const gapFactor = Math.max(0, Math.min(2, (frameGap - 16.67) / 20));
      const pendingFactor = Math.max(0, Math.min(1.5, pendingDepth / 60));
      const adapt = jitterFactor * 0.6 + gapFactor * 0.25 + pendingFactor * 0.15;
      const hardSnapDist = 220 + adapt * 56;
      const softSnapDist = 24 + adapt * 20;
      const settleDist = 5 + adapt * 3;
      if (errorDist > hardSnapDist) {
        game.player.x = correctedX;
        game.player.y = correctedY;
      } else if (ackSeq > 0 && errorDist > softSnapDist) {
        const denom = Math.max(1, hardSnapDist - softSnapDist);
        const errorNorm = Math.max(0, Math.min(1, (errorDist - softSnapDist) / denom));
        const jitterDamping = Math.max(0.5, 1 - jitterMs / 26);
        const baseBlend = 0.07;
        const maxBlend = 0.24;
        const blend = (baseBlend + (maxBlend - baseBlend) * errorNorm) * jitterDamping;
        const maxStep = Math.max(settleDist, errorDist * 0.34);
        const step = Math.min(maxStep, errorDist * blend);
        if (errorDist > 0.0001) {
          const inv = 1 / errorDist;
          game.player.x += dx * inv * step;
          game.player.y += dy * inv * step;
        }
      } else if (ackSeq > 0 && errorDist > settleDist) {
        game.player.x += dx * 0.05;
        game.player.y += dy * 0.05;
      }
      game.player.health = state.player.health;
      game.player.maxHealth = state.player.maxHealth;
      if (Number.isFinite(state.player.fireCooldown)) game.player.fireCooldown = state.player.fireCooldown;
      if (Number.isFinite(state.player.fireArrowCooldown)) game.player.fireArrowCooldown = state.player.fireArrowCooldown;
      if (Number.isFinite(state.player.hitCooldown)) game.player.hitCooldown = state.player.hitCooldown;
      if (Number.isFinite(state.player.hpBarTimer)) game.player.hpBarTimer = state.player.hpBarTimer;
      game.player.classType = state.player.classType;
      if (!isNetworkController) {
        if (Number.isFinite(state.player.dirX)) game.player.dirX = state.player.dirX;
        if (Number.isFinite(state.player.dirY)) game.player.dirY = state.player.dirY;
        if (Number.isFinite(state.player.facing)) game.player.facing = state.player.facing;
      }
    }
  }

  if (state.door && typeof state.door === "object") game.door = { ...state.door };
  if (state.pickup && typeof state.pickup === "object") game.pickup = { ...state.pickup };
  if (state.portal && typeof state.portal === "object") game.portal = { ...state.portal };
  const snapAlpha = isNetworkController ? 0.72 : 0.62;
  const reconcileProjectileSpawn = (p, type) => {
    if (!p || !controller || !isNetworkController) return p;
    if (!netPredictedProjectiles || typeof netPredictedProjectiles.get !== "function") return p;
    if (typeof p.ownerId === "string" && localPlayerId && p.ownerId !== localPlayerId) return p;
    const seq = Number.isFinite(p.spawnSeq) ? Math.floor(p.spawnSeq) : 0;
    if (seq <= 0) return p;
    const bucket = netPredictedProjectiles.get(seq);
    if (!Array.isArray(bucket) || bucket.length === 0) return p;
    let bestIdx = -1;
    let bestDistSq = Infinity;
    for (let i = 0; i < bucket.length; i++) {
      const candidate = bucket[i];
      if (!candidate || candidate.type !== type) continue;
      const dx = (Number.isFinite(candidate.x) ? candidate.x : 0) - (Number.isFinite(p.x) ? p.x : 0);
      const dy = (Number.isFinite(candidate.y) ? candidate.y : 0) - (Number.isFinite(p.y) ? p.y : 0);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return p;
    const matched = bucket.splice(bestIdx, 1)[0];
    if (bucket.length === 0) netPredictedProjectiles.delete(seq);
    const blend = Number.isFinite(p.life) && p.life > 0.85 ? 0.82 : 0.58;
    return {
      ...p,
      x: matched.x * blend + p.x * (1 - blend),
      y: matched.y * blend + p.y * (1 - blend)
    };
  };
  if (state.delta && typeof state.delta === "object") {
    const keyframe = !!state.delta.keyframe;
    game.enemies = applyDeltaCollection(game.enemies, state.delta.enemies, { keyframe, positionAlpha: snapAlpha });
    game.drops = applyDeltaCollection(game.drops, state.delta.drops, { keyframe, positionAlpha: snapAlpha });
    game.breakables = applyDeltaCollection(game.breakables, state.delta.breakables, { keyframe, positionAlpha: 1 });
    game.bullets = applyDeltaCollection(game.bullets, state.delta.bullets, {
      keyframe,
      positionAlpha: 1,
      mapSpawn: (p) => reconcileProjectileSpawn(p, "bullet")
    });
    game.fireArrows = applyDeltaCollection(game.fireArrows, state.delta.fireArrows, {
      keyframe,
      positionAlpha: 1,
      mapSpawn: (p) => reconcileProjectileSpawn(p, "fireArrow")
    });
    game.fireZones = applyDeltaCollection(game.fireZones, state.delta.fireZones, { keyframe, positionAlpha: 1 });
    game.meleeSwings = applyDeltaCollection(game.meleeSwings, state.delta.meleeSwings, { keyframe, positionAlpha: 1 });
    game.floatingTexts = applyDeltaCollection(game.floatingTexts, state.delta.floatingTexts, {
      keyframe,
      positionAlpha: 1,
      decorate: (t) => {
        t.maxLife = t.maxLife || t.life;
        t.vy = t.vy || 22;
      }
    });
  } else {
    game.armorStands = syncByIdLerp(game.armorStands, state.armorStands, 1);
    game.enemies = syncByIdLerp(game.enemies, state.enemies, snapAlpha);
    game.drops = syncByIdLerp(game.drops, state.drops, snapAlpha);
    game.breakables = syncByIdLerp(game.breakables, state.breakables, 1);
    game.bullets = syncByIdLerp(game.bullets, (state.bullets || []).map((p) => reconcileProjectileSpawn(p, "bullet")), 1);
    game.fireArrows = syncByIdLerp(game.fireArrows, (state.fireArrows || []).map((p) => reconcileProjectileSpawn(p, "fireArrow")), 1);
    game.fireZones = syncByIdLerp(game.fireZones, state.fireZones, 1);
    game.meleeSwings = syncByIdLerp(game.meleeSwings, state.meleeSwings, 1);
    game.floatingTexts = syncByIdLerp(game.floatingTexts, state.floatingTexts, 1, (t) => {
      t.maxLife = t.maxLife || t.life;
      t.vy = t.vy || 22;
    });
  }

  return { netPendingInputs, netLastAckSeq };
}
