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

function captureEnemyStateById(enemies) {
  const byId = new Map();
  for (const enemy of Array.isArray(enemies) ? enemies : []) {
    if (!enemy || enemy.id == null) continue;
    byId.set(enemy.id, {
      hp: Number.isFinite(enemy.hp) ? enemy.hp : null,
      x: Number.isFinite(enemy.x) ? enemy.x : null,
      y: Number.isFinite(enemy.y) ? enemy.y : null,
      size: Number.isFinite(enemy.size) ? enemy.size : 20
    });
  }
  return byId;
}

function findSnapshotLocalPlayer(state, localPlayerId) {
  const snapshotPlayers = Array.isArray(state?.players) ? state.players : [];
  if (localPlayerId) {
    const exact = snapshotPlayers.find((player) => player && player.id === localPlayerId);
    if (exact) return exact;
  }
  if (state?.player && typeof state.player === "object") return state.player;
  return snapshotPlayers[0] && typeof snapshotPlayers[0] === "object" ? snapshotPlayers[0] : null;
}

function getPredictionPressure(game) {
  const hostiles = Array.isArray(game?.enemies)
    ? game.enemies.filter((enemy) => enemy && (enemy.hp || 0) > 0 && (!game.isEnemyFriendlyToPlayer || !game.isEnemyFriendlyToPlayer(enemy)))
    : [];
  const playerX = Number.isFinite(game?.player?.x) ? game.player.x : 0;
  const playerY = Number.isFinite(game?.player?.y) ? game.player.y : 0;
  let closestHostilePx = Infinity;
  let nearbyHostileCount = 0;
  for (const enemy of hostiles) {
    const dist = Math.hypot((enemy.x || 0) - playerX, (enemy.y || 0) - playerY);
    if (dist < closestHostilePx) closestHostilePx = dist;
    if (dist <= 132) nearbyHostileCount += 1;
  }
  const perf = game?.networkPerf && typeof game.networkPerf === "object" ? game.networkPerf : null;
  const recentCorrections = Array.isArray(perf?.recentCorrections) ? perf.recentCorrections : [];
  const recentMaxCorrectionPx = recentCorrections.reduce((max, entry) => {
    const errorPx = Number.isFinite(entry?.errorPx) ? entry.errorPx : 0;
    return errorPx > max ? errorPx : max;
  }, 0);
  const lastCorrectionPx = Number.isFinite(perf?.lastCorrectionPx) ? perf.lastCorrectionPx : 0;
  const hasCrowding = closestHostilePx <= 72 || nearbyHostileCount >= 3;
  const strong =
    lastCorrectionPx >= 40 ||
    recentMaxCorrectionPx >= 40 ||
    (hasCrowding && (lastCorrectionPx >= 20 || recentMaxCorrectionPx >= 20));
  const moderate =
    strong ||
    lastCorrectionPx >= 24 ||
    recentMaxCorrectionPx >= 24 ||
    (hasCrowding && (lastCorrectionPx >= 12 || recentMaxCorrectionPx >= 12));
  return {
    strong,
    moderate,
    closestHostilePx: Number.isFinite(closestHostilePx) ? closestHostilePx : null,
    nearbyHostileCount,
    recentMaxCorrectionPx,
    lastCorrectionPx
  };
}

function syncRemotePlayers(game, state, localPlayerId, positionAlpha) {
  const snapshotPlayers = Array.isArray(state?.players) ? state.players : [];
  const remotes = snapshotPlayers.filter((player) => player && player.id !== localPlayerId);
  game.remotePlayers = syncByIdLerp(game.remotePlayers, remotes, positionAlpha, (player) => {
    player.remote = true;
    player.alive = player.alive !== false;
    if (!Number.isFinite(player.size)) player.size = 22;
    if (!Number.isFinite(player.level)) player.level = 1;
    if (!Number.isFinite(player.dirX)) player.dirX = 1;
    if (!Number.isFinite(player.dirY)) player.dirY = 0;
    if (!Number.isFinite(player.facing)) player.facing = 0;
    player.handle = typeof player.handle === "string" && player.handle.trim() ? player.handle.trim() : "Player";
    player.color = typeof player.color === "string" && player.color.trim() ? player.color.trim() : "#58a6ff";
  });
}

function queuePlayerDeathNotifications(game, previousById, snapshotPlayer, remotes) {
  if (typeof game?.pushMultiplayerNotification !== "function") return;
  const nextPlayers = [];
  if (snapshotPlayer && typeof snapshotPlayer === "object") {
    nextPlayers.push({
      id: snapshotPlayer.id || game.player?.id || "local",
      handle: typeof snapshotPlayer.handle === "string" && snapshotPlayer.handle.trim() ? snapshotPlayer.handle.trim() : game.playerHandle || "Player",
      alive: snapshotPlayer.alive !== false && (snapshotPlayer.health || 0) > 0
    });
  }
  for (const player of Array.isArray(remotes) ? remotes : []) {
    nextPlayers.push({
      id: player?.id || "",
      handle: typeof player?.handle === "string" && player.handle.trim() ? player.handle.trim() : "Player",
      alive: player?.alive !== false && (player?.health || 0) > 0
    });
  }
  for (const player of nextPlayers) {
    if (!player.id) continue;
    const prevAlive = previousById.get(player.id);
    if (prevAlive !== true || player.alive) continue;
    game.pushMultiplayerNotification(`${player.handle} died`);
  }
}

function synthesizeEnemyDamageFloatingTexts(game, previousById, { skip = false } = {}) {
  if (skip || typeof game?.spawnFloatingText !== "function") return;
  for (const enemy of Array.isArray(game.enemies) ? game.enemies : []) {
    if (!enemy || enemy.id == null) continue;
    const prev = previousById.get(enemy.id);
    if (!prev || !Number.isFinite(prev.hp) || !Number.isFinite(enemy.hp)) continue;
    const damage = prev.hp - enemy.hp;
    if (!(damage >= 0.5)) continue;
    const textValue = Math.max(1, Math.round(damage));
    const x = Number.isFinite(enemy.x) ? enemy.x : prev.x;
    const y = Number.isFinite(enemy.y) ? enemy.y : prev.y;
    const size = Number.isFinite(enemy.size) ? enemy.size : prev.size;
    game.spawnFloatingText(x, y - (size || 20) * 0.65, `-${textValue}`, "#e85c5c");
    enemy.hpBarTimer = Math.max(Number.isFinite(enemy.hpBarTimer) ? enemy.hpBarTimer : 0, game.config?.enemy?.hpBarDuration || 0.9);
  }
}

export function applyMetaStateToGame(game, state) {
  if (!state || typeof state !== "object") return;
  const isActiveMultiplayer = !!game?.networkEnabled && state.roomPhase === "active" && Number.isFinite(state.activePlayerCount) && state.activePlayerCount > 1;
  const isLocalPauseOwner =
    !!game?.networkEnabled &&
    typeof game?.networkLocalPlayerId === "string" &&
    typeof state.pauseOwnerId === "string" &&
    game.networkLocalPlayerId === state.pauseOwnerId;
  if (typeof state.roomPhase === "string") game.networkRoomPhase = state.roomPhase;
  if (hasOwn(state, "roomOwnerId")) game.networkRoomOwnerId = typeof state.roomOwnerId === "string" ? state.roomOwnerId : null;
  if (hasOwn(state, "pauseOwnerId")) game.networkPauseOwnerId = typeof state.pauseOwnerId === "string" ? state.pauseOwnerId : null;
  if (Number.isFinite(state.time)) game.time = state.time;
  if (Number.isFinite(state.floor)) game.floor = state.floor;
  if (typeof game.setBiomeKey === "function" && typeof state.biomeKey === "string") game.setBiomeKey(state.biomeKey);
  if (!isActiveMultiplayer && Number.isFinite(state.level)) game.level = state.level;
  if (!isActiveMultiplayer && Number.isFinite(state.score)) game.score = state.score;
  if (!isActiveMultiplayer && Number.isFinite(state.gold)) game.gold = state.gold;
  if (!isActiveMultiplayer && Number.isFinite(state.experience)) game.experience = state.experience;
  if (!isActiveMultiplayer && Number.isFinite(state.expToNextLevel)) game.expToNextLevel = state.expToNextLevel;
  if (Number.isFinite(state.activePlayerCount)) game.activePlayerCount = state.activePlayerCount;
  if (!isActiveMultiplayer && Number.isFinite(state.skillPoints)) game.skillPoints = state.skillPoints;
  if (hasOwn(state, "hasKey")) game.hasKey = !!state.hasKey;
  if (hasOwn(state, "gameOver")) game.gameOver = !!state.gameOver;
  if (hasOwn(state, "gameOverTitle")) game.gameOverTitle = typeof state.gameOverTitle === "string" && state.gameOverTitle ? state.gameOverTitle : "GAME OVER";
  if (hasOwn(state, "paused")) game.paused = !!state.paused;
  if (hasOwn(state, "shopOpen")) {
    if (!isActiveMultiplayer || isLocalPauseOwner) game.shopOpen = !!state.shopOpen;
  }
  if (hasOwn(state, "skillTreeOpen")) {
    if (!isActiveMultiplayer || isLocalPauseOwner) game.skillTreeOpen = !!state.skillTreeOpen;
  }
  if (hasOwn(state, "statsPanelOpen")) {
    if (!isActiveMultiplayer) game.statsPanelOpen = !!state.statsPanelOpen;
  }
  if ((!isActiveMultiplayer) && (state.statsPanelView === "run" || state.statsPanelView === "character")) game.statsPanelView = state.statsPanelView;
  if (!isActiveMultiplayer && Number.isFinite(state.warriorMomentumTimer)) game.warriorMomentumTimer = state.warriorMomentumTimer;
  if (!isActiveMultiplayer && Number.isFinite(state.warriorRageActiveTimer)) game.warriorRageActiveTimer = state.warriorRageActiveTimer;
  if (!isActiveMultiplayer && Number.isFinite(state.warriorRageCooldownTimer)) game.warriorRageCooldownTimer = state.warriorRageCooldownTimer;
  if (!isActiveMultiplayer && Number.isFinite(state.warriorRageVictoryRushPool)) game.warriorRageVictoryRushPool = state.warriorRageVictoryRushPool;
  if (!isActiveMultiplayer && Number.isFinite(state.warriorRageVictoryRushTimer)) game.warriorRageVictoryRushTimer = state.warriorRageVictoryRushTimer;
  if (state.floorBoss && typeof state.floorBoss === "object") game.floorBoss = syncFloorBossState(game.floorBoss, state.floorBoss, game);
  if (state.runStats && typeof state.runStats === "object") game.runStats = syncNamedObject(game.runStats, state.runStats);
  if (state.finalResults && typeof state.finalResults === "object") {
    game.networkFinalResults = {
      teamOutcome: typeof state.finalResults.teamOutcome === "string" ? state.finalResults.teamOutcome : "Defeat",
      totalParticipants: Number.isFinite(state.finalResults.totalParticipants) ? state.finalResults.totalParticipants : 0,
      players: Array.isArray(state.finalResults.players) ? state.finalResults.players.map((player) => ({ ...player })) : []
    };
  }
  if (state.portal && typeof state.portal === "object") game.portal = { ...state.portal };
  if (state.musicTrack && typeof state.musicTrack === "object") game.musicTrack = { ...state.musicTrack };
  if (!isActiveMultiplayer && state.skills && typeof state.skills === "object") game.skills = syncNamedObject(game.skills, state.skills);
  if (!isActiveMultiplayer && state.rangerTalents && typeof state.rangerTalents === "object") {
    game.rangerTalents = syncNamedObject(game.rangerTalents, state.rangerTalents);
    if (game.player) game.player.rangerTalents = game.rangerTalents;
  }
  if (!isActiveMultiplayer && state.warriorTalents && typeof state.warriorTalents === "object") {
    game.warriorTalents = syncNamedObject(game.warriorTalents, state.warriorTalents);
    if (game.player) game.player.warriorTalents = game.warriorTalents;
  }
  if (!isActiveMultiplayer && state.necromancerTalents && typeof state.necromancerTalents === "object") {
    game.necromancerTalents = syncNamedObject(game.necromancerTalents, state.necromancerTalents);
    if (game.player) game.player.necromancerTalents = game.necromancerTalents;
  }
  if (!isActiveMultiplayer && state.rangerRuntime && typeof state.rangerRuntime === "object") {
    game.rangerRuntime = syncNamedObject(game.rangerRuntime, state.rangerRuntime);
    if (game.player) game.player.rangerRuntime = game.rangerRuntime;
  }
  if (!isActiveMultiplayer && state.warriorRuntime && typeof state.warriorRuntime === "object") {
    game.warriorRuntime = syncNamedObject(game.warriorRuntime, state.warriorRuntime);
    if (game.player) game.player.warriorRuntime = game.warriorRuntime;
  }
  if (!isActiveMultiplayer && state.necromancerRuntime && typeof state.necromancerRuntime === "object") {
    game.necromancerRuntime = syncNamedObject(game.necromancerRuntime, state.necromancerRuntime);
    if (game.player) game.player.necromancerRuntime = game.necromancerRuntime;
  }
  if (!isActiveMultiplayer && state.upgrades && typeof state.upgrades === "object") game.upgrades = syncNamedObject(game.upgrades, state.upgrades);
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
    if (typeof snapshotPlayer.classType === "string" && game.config?.classes?.[snapshotPlayer.classType]) {
      game.classType = snapshotPlayer.classType;
      game.classSpec = game.config.classes[snapshotPlayer.classType];
    }
  }
  syncRemotePlayers(game, state, localPlayerId, 0.72);
  queuePlayerDeathNotifications(game, previousAliveById, snapshotPlayer, game.remotePlayers);
  if (typeof game.updateSpectateTarget === "function") game.updateSpectateTarget();

  if (state.door && typeof state.door === "object") game.door = { ...state.door };
  if (state.pickup && typeof state.pickup === "object") game.pickup = { ...state.pickup };
  if (state.portal && typeof state.portal === "object") game.portal = { ...state.portal };
  const snapAlpha = isNetworkController ? 0.72 : 0.62;
  const previousEnemyStateById = captureEnemyStateById(game.enemies);
  const reconcileProjectileSpawn = (p, type) => {
    if (!p || !controller || !isNetworkController) return p;
    if (!netPredictedProjectiles || typeof netPredictedProjectiles.get !== "function") return p;
    if (typeof p.ownerId === "string" && localPlayerId && p.ownerId !== localPlayerId) return p;
    const recordAuthoritativeShot = (matched = null, rejected = false) => {
      if (typeof game?.recordPlayerShotTelemetry !== "function") return;
      game.recordPlayerShotTelemetry({
        source: rejected ? "authoritativeProjectileRejected" : "authoritativeProjectile",
        projectileType: type,
        playerX: Number.isFinite(game.player?.x) ? game.player.x : 0,
        playerY: Number.isFinite(game.player?.y) ? game.player.y : 0,
        authoritativeX: Number.isFinite(p.x) ? p.x : null,
        authoritativeY: Number.isFinite(p.y) ? p.y : null,
        authoritativeAngle: Number.isFinite(p.angle) ? p.angle : null,
        intendedAngle: matched && Number.isFinite(matched.angle) ? matched.angle : (Number.isFinite(p.angle) ? p.angle : null),
        predictedX: matched && Number.isFinite(matched.x) ? matched.x : null,
        predictedY: matched && Number.isFinite(matched.y) ? matched.y : null,
        spawnSeq: Number.isFinite(p.spawnSeq) ? Math.floor(p.spawnSeq) : 0,
        rejected
      });
    };
    const seq = Number.isFinite(p.spawnSeq) ? Math.floor(p.spawnSeq) : 0;
    if (seq <= 0) return p;
    const bucket = netPredictedProjectiles.get(seq);
    if (!Array.isArray(bucket) || bucket.length === 0) return p;
    let bestIdx = -1;
    let bestScore = Infinity;
    let bestPosDistSq = Infinity;
    for (let i = 0; i < bucket.length; i++) {
      const candidate = bucket[i];
      if (!candidate || candidate.type !== type) continue;
      const dx = (Number.isFinite(candidate.x) ? candidate.x : 0) - (Number.isFinite(p.x) ? p.x : 0);
      const dy = (Number.isFinite(candidate.y) ? candidate.y : 0) - (Number.isFinite(p.y) ? p.y : 0);
      const d2 = dx * dx + dy * dy;
      let score = d2;
      if (Number.isFinite(candidate.angle) && Number.isFinite(p.angle)) {
        let angleDiff = candidate.angle - p.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const anglePenalty = Math.abs(angleDiff) * 180;
        score += anglePenalty * anglePenalty;
      }
      if (score < bestScore) {
        bestScore = score;
        bestPosDistSq = d2;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return p;
    const maxPosError = type === "fireArrow" ? 56 : 48;
    const maxPosErrorSq = maxPosError * maxPosError;
    if (bestPosDistSq > maxPosErrorSq) {
      const rejectedMatch = bucket[bestIdx];
      game.networkPerf.projectileReconcileRejects = (game.networkPerf.projectileReconcileRejects || 0) + 1;
      bucket.splice(bestIdx, 1);
      if (bucket.length === 0) netPredictedProjectiles.delete(seq);
      recordAuthoritativeShot(rejectedMatch, true);
      return p;
    }
    const matched = bucket.splice(bestIdx, 1)[0];
    if (bucket.length === 0) netPredictedProjectiles.delete(seq);
    recordAuthoritativeShot(matched, false);
    const blend = Number.isFinite(p.life) && p.life > 0.85 ? 0.86 : 0.62;
    const leadSeconds = Math.max(0, Math.min(0.06, frameGapMs / 1000));
    const predictedAngle = Number.isFinite(matched.angle) ? matched.angle : p.angle;
    const predictedDriftX = Number.isFinite(matched.vx) ? matched.vx * leadSeconds : 0;
    const predictedDriftY = Number.isFinite(matched.vy) ? matched.vy * leadSeconds : 0;
    const serverLeadX = Number.isFinite(p.vx) ? p.vx * leadSeconds : 0;
    const serverLeadY = Number.isFinite(p.vy) ? p.vy * leadSeconds : 0;
    return {
      ...p,
      x: (matched.x + predictedDriftX) * blend + (p.x + serverLeadX) * (1 - blend),
      y: (matched.y + predictedDriftY) * blend + (p.y + serverLeadY) * (1 - blend),
      angle: Number.isFinite(predictedAngle) ? predictedAngle : p.angle
    };
  };
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
