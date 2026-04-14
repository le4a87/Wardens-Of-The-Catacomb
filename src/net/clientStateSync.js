import {
  applyMetaStateToGame,
  captureEnemyStateById,
  createProjectileSpawnReconciler,
  findSnapshotLocalPlayer,
  getPredictionPressure,
  queuePlayerDeathNotifications,
  syncFloorBossState,
  syncNamedObject,
  syncRemotePlayers,
  synthesizeEnemyDamageFloatingTexts
} from "./clientSnapshotHelpers.js";

export { applyMetaStateToGame } from "./clientSnapshotHelpers.js";

function normalizeMapRow(row) {
  if (typeof row === "string") return Array.from(row);
  if (Array.isArray(row)) return row.slice();
  return [];
}

export function applyMapStateToGame(game, payload) {
  if (!Array.isArray(payload.map) || payload.map.length === 0) return "";
  const normalizedMap = payload.map.map((row) => normalizeMapRow(row));
  const firstRow = normalizedMap[0];
  const rowLength =
    typeof firstRow === "string"
      ? firstRow.length
      : Array.isArray(firstRow)
      ? firstRow.length
      : 0;
  if (rowLength <= 0) return "";
  const tile = game.config.map.tile;
  if (typeof game.setBiomeKey === "function" && typeof payload?.biomeKey === "string") game.setBiomeKey(payload.biomeKey);
  game.map = normalizedMap;
  game.mapWidth = Number.isFinite(payload.mapWidth) ? payload.mapWidth : rowLength;
  game.mapHeight = Number.isFinite(payload.mapHeight) ? payload.mapHeight : normalizedMap.length;
  game.worldWidth = rowLength * tile;
  game.worldHeight = normalizedMap.length * tile;
  game.explored = Array.from({ length: normalizedMap.length }, () => Array(rowLength).fill(false));
  game.navDistance = Array.from({ length: normalizedMap.length }, () => Array(rowLength).fill(-1));
  game.navPlayerTile = { x: -1, y: -1 };
  for (let y = 0; y < normalizedMap.length; y++) {
    const row = normalizedMap[y];
    const chars = typeof row === "string" ? row : Array.isArray(row) ? row.join("") : "";
    if (!chars) continue;
    for (let x = 0; x < chars.length; x++) {
      const ch = chars[x];
      const px = x * tile + tile * 0.5;
      const py = y * tile + tile * 0.5;
      if (ch === "P") {
        if (game.player) {
          game.player.x = px;
          game.player.y = py;
        }
      } else if (ch === "D") {
        game.door = { ...(game.door || {}), x: px, y: py };
      } else if (ch === "K") {
        game.pickup = { ...(game.pickup || {}), x: px, y: py };
      }
    }
  }
  if (typeof game.ensurePlayerSafePosition === "function") game.ensurePlayerSafePosition(12);
  return typeof payload.mapSignature === "string" ? payload.mapSignature : `${game.biomeKey}:${game.floor}:${game.mapWidth}x${game.mapHeight}`;
}

export function applyMapMetaToGame(game, payload) {
  const mapWidth = Number.isFinite(payload?.mapWidth) ? Math.max(1, Math.floor(payload.mapWidth)) : 0;
  const mapHeight = Number.isFinite(payload?.mapHeight) ? Math.max(1, Math.floor(payload.mapHeight)) : 0;
  if (mapWidth <= 0 || mapHeight <= 0) return "";
  const tile = game.config.map.tile;
  if (typeof game.setBiomeKey === "function" && typeof payload?.biomeKey === "string") game.setBiomeKey(payload.biomeKey);
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
  return typeof payload.mapSignature === "string" ? payload.mapSignature : `${game.biomeKey}:${game.floor}:${game.mapWidth}x${game.mapHeight}`;
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
    if (typeof game.map[y] === "string") game.map[y] = Array.from(game.map[y]);
    else if (!Array.isArray(game.map[y])) game.map[y] = normalizeMapRow(game.map[y]);
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
  const previousAliveById = new Map();
  if (game?.player?.id) previousAliveById.set(game.player.id, (game.player.alive !== false) && (game.player.health || 0) > 0);
  for (const player of Array.isArray(game?.remotePlayers) ? game.remotePlayers : []) {
    if (player?.id) previousAliveById.set(player.id, (player.alive !== false) && (player.health || 0) > 0);
  }
  if (!game.networkPerf || typeof game.networkPerf !== "object") {
    game.networkPerf = {
      appliedSnapshotCount: 0,
      lastCorrectionPx: 0,
      maxCorrectionPx: 0,
      hardSnapCount: 0,
      softCorrectionCount: 0,
      settleCorrectionCount: 0,
      blockedSnapCount: 0,
      projectileReconcileRejects: 0,
      recentCorrections: []
    };
  }
  const recordCorrection = (kind, errorDist, extra = {}) => {
    if (!Array.isArray(game.networkPerf.recentCorrections)) game.networkPerf.recentCorrections = [];
    game.networkPerf.recentCorrections.push({
      atMs: Math.round(performance.now()),
      kind,
      errorPx: Math.round(errorDist),
      ackSeq: Number.isFinite(ackSeq) ? ackSeq : 0,
      pendingInputs: Array.isArray(netPendingInputs) ? netPendingInputs.length : 0,
      ...extra
    });
    if (game.networkPerf.recentCorrections.length > 24) {
      game.networkPerf.recentCorrections.splice(0, game.networkPerf.recentCorrections.length - 24);
    }
  };
  game.networkPerf.appliedSnapshotCount += 1;
  const isInitialControllerSync = !!controller && ackSeq <= 0 && !!state?.delta?.keyframe;
  const snapshotLocalPlayer = findSnapshotLocalPlayer(state, localPlayerId);
  const snapshotPlayer = snapshotLocalPlayer || state.player;

  if (snapshotPlayer && typeof snapshotPlayer === "object") {
    if (!controller) {
      Object.assign(game.player, snapshotPlayer);
    } else {
      const baseX = Number.isFinite(snapshotPlayer.x) ? snapshotPlayer.x : game.player.x;
      const baseY = Number.isFinite(snapshotPlayer.y) ? snapshotPlayer.y : game.player.y;
      let correctedX = baseX;
      let correctedY = baseY;
      if (ackSeq > 0) {
        netLastAckSeq = Math.max(netLastAckSeq, ackSeq);
        let keepFrom = 0;
        while (keepFrom < netPendingInputs.length && netPendingInputs[keepFrom].seq <= netLastAckSeq) keepFrom += 1;
        if (keepFrom > 0) netPendingInputs.splice(0, keepFrom);
        const predictionPressure = getPredictionPressure(game);
        const probe = { x: baseX, y: baseY, size: game.player.size };
        let replayInputs = netPendingInputs;
        let replayMode = "all";
        if (predictionPressure.strong) {
          replayInputs = [];
          replayMode = "skip";
        } else if (predictionPressure.moderate && netPendingInputs.length > 1) {
          replayInputs = netPendingInputs.slice(-1);
          replayMode = "tail";
        }
        game.networkPerf.lastReplayMode = replayMode;
        game.networkPerf.lastPredictionPressure = predictionPressure;
        for (const entry of replayInputs) {
          const mx = entry.moveX;
          const my = entry.moveY;
          if (mx || my) {
            const len = Math.hypot(mx, my) || 1;
            const speed = game.getPlayerMoveSpeed();
            game.moveWithCollisionSubsteps(probe, (mx / len) * speed * entry.dt, (my / len) * speed * entry.dt);
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
      const localPlayerRadius = Math.max(4, (game.player?.size || 20) * 0.5);
      const localPlayerBlocked =
        typeof game.isPositionWalkable === "function"
          ? !game.isPositionWalkable(game.player.x, game.player.y, localPlayerRadius, true)
          : false;
      game.networkPerf.lastCorrectionPx = errorDist;
      if (errorDist > game.networkPerf.maxCorrectionPx) game.networkPerf.maxCorrectionPx = errorDist;
      if (isInitialControllerSync || localPlayerBlocked || errorDist > hardSnapDist) {
        game.networkPerf.hardSnapCount += 1;
        if (localPlayerBlocked) game.networkPerf.blockedSnapCount += 1;
        recordCorrection(localPlayerBlocked ? "blockedHardSnap" : "hardSnap", errorDist, {
          correctedX: Math.round(correctedX),
          correctedY: Math.round(correctedY)
        });
        game.player.x = correctedX;
        game.player.y = correctedY;
      } else if (ackSeq > 0 && errorDist > softSnapDist) {
        game.networkPerf.softCorrectionCount += 1;
        recordCorrection("softCorrection", errorDist);
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
        game.networkPerf.settleCorrectionCount += 1;
        recordCorrection("settleCorrection", errorDist);
        game.player.x += dx * 0.05;
        game.player.y += dy * 0.05;
      }
      game.player.health = snapshotPlayer.health;
      game.player.maxHealth = snapshotPlayer.maxHealth;
      if (Number.isFinite(snapshotPlayer.fireCooldown)) game.player.fireCooldown = snapshotPlayer.fireCooldown;
      if (Number.isFinite(snapshotPlayer.fireArrowCooldown)) game.player.fireArrowCooldown = snapshotPlayer.fireArrowCooldown;
      if (Number.isFinite(snapshotPlayer.deathBoltCooldown)) game.player.deathBoltCooldown = snapshotPlayer.deathBoltCooldown;
      if (Number.isFinite(snapshotPlayer.hitCooldown)) game.player.hitCooldown = snapshotPlayer.hitCooldown;
      if (Number.isFinite(snapshotPlayer.hpBarTimer)) game.player.hpBarTimer = snapshotPlayer.hpBarTimer;
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
    }
    if (Number.isFinite(snapshotPlayer.level)) game.level = snapshotPlayer.level;
    if (Number.isFinite(snapshotPlayer.score)) game.score = snapshotPlayer.score;
    if (Number.isFinite(snapshotPlayer.gold)) game.gold = snapshotPlayer.gold;
    if (Number.isFinite(snapshotPlayer.experience)) game.experience = snapshotPlayer.experience;
    if (Number.isFinite(snapshotPlayer.expToNextLevel)) game.expToNextLevel = snapshotPlayer.expToNextLevel;
    if (Number.isFinite(snapshotPlayer.skillPoints)) game.skillPoints = snapshotPlayer.skillPoints;
    if (Number.isFinite(snapshotPlayer.refundCount)) game.refundCount = snapshotPlayer.refundCount;
    if (Number.isFinite(snapshotPlayer.levelWeaponDamageBonus)) game.levelWeaponDamageBonus = snapshotPlayer.levelWeaponDamageBonus;
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
  syncRemotePlayers(game, state, localPlayerId, 0.72, syncByIdLerp);
  queuePlayerDeathNotifications(game, previousAliveById, snapshotPlayer, game.remotePlayers);
  if (typeof game.updateSpectateTarget === "function") game.updateSpectateTarget();

  if (state.door && typeof state.door === "object") game.door = { ...state.door };
  if (state.pickup && typeof state.pickup === "object") game.pickup = { ...state.pickup };
  if (state.portal && typeof state.portal === "object") game.portal = { ...state.portal };
  const snapAlpha = isNetworkController ? 0.72 : 0.62;
  const previousEnemyStateById = captureEnemyStateById(game.enemies);
  const reconcileProjectileSpawn = createProjectileSpawnReconciler({
    controller,
    isNetworkController,
    localPlayerId,
    netPredictedProjectiles,
    game,
    frameGapMs
  });
  if (state.delta && typeof state.delta === "object") {
    const keyframe = !!state.delta.keyframe;
    game.enemies = applyDeltaCollection(game.enemies, state.delta.enemies, { keyframe, positionAlpha: snapAlpha });
    game.drops = applyDeltaCollection(game.drops, state.delta.drops, { keyframe, positionAlpha: snapAlpha });
    game.breakables = applyDeltaCollection(game.breakables, state.delta.breakables, { keyframe, positionAlpha: 1 });
    game.wallTraps = applyDeltaCollection(game.wallTraps, state.delta.wallTraps, { keyframe, positionAlpha: 1 });
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
    synthesizeEnemyDamageFloatingTexts(game, previousEnemyStateById, { skip: keyframe });
  } else {
    game.armorStands = syncByIdLerp(game.armorStands, state.armorStands, 1);
    game.enemies = syncByIdLerp(game.enemies, state.enemies, snapAlpha);
    game.drops = syncByIdLerp(game.drops, state.drops, snapAlpha);
    game.breakables = syncByIdLerp(game.breakables, state.breakables, 1);
    game.wallTraps = syncByIdLerp(game.wallTraps, state.wallTraps, 1);
    game.bullets = syncByIdLerp(game.bullets, (state.bullets || []).map((p) => reconcileProjectileSpawn(p, "bullet")), 1);
    game.fireArrows = syncByIdLerp(game.fireArrows, (state.fireArrows || []).map((p) => reconcileProjectileSpawn(p, "fireArrow")), 1);
    game.fireZones = syncByIdLerp(game.fireZones, state.fireZones, 1);
    game.meleeSwings = syncByIdLerp(game.meleeSwings, state.meleeSwings, 1);
    synthesizeEnemyDamageFloatingTexts(game, previousEnemyStateById, { skip: false });
  }

  return { netPendingInputs, netLastAckSeq };
}
