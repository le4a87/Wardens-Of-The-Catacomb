export function syncNamedObject(target, source) {
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

export function syncFloorBossState(target, source, game) {
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

export function captureEnemyStateById(enemies) {
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

export function findSnapshotLocalPlayer(state, localPlayerId) {
  const snapshotPlayers = Array.isArray(state?.players) ? state.players : [];
  if (localPlayerId) {
    const exact = snapshotPlayers.find((player) => player && player.id === localPlayerId);
    if (exact) return exact;
  }
  if (state?.player && typeof state.player === "object") return state.player;
  return snapshotPlayers[0] && typeof snapshotPlayers[0] === "object" ? snapshotPlayers[0] : null;
}

export function getPredictionPressure(game) {
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

export function syncRemotePlayers(game, state, localPlayerId, positionAlpha, syncByIdLerp) {
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

export function queuePlayerDeathNotifications(game, previousById, snapshotPlayer, remotes) {
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

export function synthesizeEnemyDamageFloatingTexts(game, previousById, { skip = false } = {}) {
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
  if (!isActiveMultiplayer && Number.isFinite(state.refundCount)) game.refundCount = state.refundCount;
  if (hasOwn(state, "hasKey")) game.hasKey = !!state.hasKey;
  if (hasOwn(state, "gameOver")) game.gameOver = !!state.gameOver;
  if (hasOwn(state, "gameOverTitle")) game.gameOverTitle = typeof state.gameOverTitle === "string" && state.gameOverTitle ? state.gameOverTitle : "GAME OVER";
  if (hasOwn(state, "paused")) game.paused = !!state.paused;
  if (hasOwn(state, "shopOpen") && (!isActiveMultiplayer || isLocalPauseOwner)) game.shopOpen = !!state.shopOpen;
  if (hasOwn(state, "skillTreeOpen") && (!isActiveMultiplayer || isLocalPauseOwner)) game.skillTreeOpen = !!state.skillTreeOpen;
  if (hasOwn(state, "statsPanelOpen") && !isActiveMultiplayer) game.statsPanelOpen = !!state.statsPanelOpen;
  if (!isActiveMultiplayer && (state.statsPanelView === "run" || state.statsPanelView === "character")) game.statsPanelView = state.statsPanelView;
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
  if (!isActiveMultiplayer && state.upgrades && typeof state.upgrades === "object") game.upgrades = syncNamedObject(game.upgrades, state.upgrades);
}

export function createProjectileSpawnReconciler({
  controller,
  isNetworkController,
  localPlayerId,
  netPredictedProjectiles,
  game,
  frameGapMs
}) {
  return (projectile, type) => {
    if (!projectile || !controller || !isNetworkController) return projectile;
    if (!netPredictedProjectiles || typeof netPredictedProjectiles.get !== "function") return projectile;
    if (typeof projectile.ownerId === "string" && localPlayerId && projectile.ownerId !== localPlayerId) return projectile;
    const recordAuthoritativeShot = (matched = null, rejected = false) => {
      if (typeof game?.recordPlayerShotTelemetry !== "function") return;
      game.recordPlayerShotTelemetry({
        source: rejected ? "authoritativeProjectileRejected" : "authoritativeProjectile",
        projectileType: type,
        playerX: Number.isFinite(game.player?.x) ? game.player.x : 0,
        playerY: Number.isFinite(game.player?.y) ? game.player.y : 0,
        authoritativeX: Number.isFinite(projectile.x) ? projectile.x : null,
        authoritativeY: Number.isFinite(projectile.y) ? projectile.y : null,
        authoritativeAngle: Number.isFinite(projectile.angle) ? projectile.angle : null,
        intendedAngle: matched && Number.isFinite(matched.angle) ? matched.angle : (Number.isFinite(projectile.angle) ? projectile.angle : null),
        predictedX: matched && Number.isFinite(matched.x) ? matched.x : null,
        predictedY: matched && Number.isFinite(matched.y) ? matched.y : null,
        spawnSeq: Number.isFinite(projectile.spawnSeq) ? Math.floor(projectile.spawnSeq) : 0,
        rejected
      });
    };
    const seq = Number.isFinite(projectile.spawnSeq) ? Math.floor(projectile.spawnSeq) : 0;
    if (seq <= 0) return projectile;
    const bucket = netPredictedProjectiles.get(seq);
    if (!Array.isArray(bucket) || bucket.length === 0) return projectile;
    let bestIdx = -1;
    let bestScore = Infinity;
    let bestPosDistSq = Infinity;
    for (let i = 0; i < bucket.length; i++) {
      const candidate = bucket[i];
      if (!candidate || candidate.type !== type) continue;
      const dx = (Number.isFinite(candidate.x) ? candidate.x : 0) - (Number.isFinite(projectile.x) ? projectile.x : 0);
      const dy = (Number.isFinite(candidate.y) ? candidate.y : 0) - (Number.isFinite(projectile.y) ? projectile.y : 0);
      const d2 = dx * dx + dy * dy;
      let score = d2;
      if (Number.isFinite(candidate.angle) && Number.isFinite(projectile.angle)) {
        let angleDiff = candidate.angle - projectile.angle;
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
    if (bestIdx < 0) return projectile;
    const maxPosError = type === "fireArrow" ? 56 : 48;
    if (bestPosDistSq > maxPosError * maxPosError) {
      const rejectedMatch = bucket[bestIdx];
      game.networkPerf.projectileReconcileRejects = (game.networkPerf.projectileReconcileRejects || 0) + 1;
      bucket.splice(bestIdx, 1);
      if (bucket.length === 0) netPredictedProjectiles.delete(seq);
      recordAuthoritativeShot(rejectedMatch, true);
      return projectile;
    }
    const matched = bucket.splice(bestIdx, 1)[0];
    if (bucket.length === 0) netPredictedProjectiles.delete(seq);
    recordAuthoritativeShot(matched, false);
    const blend = Number.isFinite(projectile.life) && projectile.life > 0.85 ? 0.86 : 0.62;
    const leadSeconds = Math.max(0, Math.min(0.06, frameGapMs / 1000));
    const predictedAngle = Number.isFinite(matched.angle) ? matched.angle : projectile.angle;
    const predictedDriftX = Number.isFinite(matched.vx) ? matched.vx * leadSeconds : 0;
    const predictedDriftY = Number.isFinite(matched.vy) ? matched.vy * leadSeconds : 0;
    const serverLeadX = Number.isFinite(projectile.vx) ? projectile.vx * leadSeconds : 0;
    const serverLeadY = Number.isFinite(projectile.vy) ? projectile.vy * leadSeconds : 0;
    return {
      ...projectile,
      x: (matched.x + predictedDriftX) * blend + (projectile.x + serverLeadX) * (1 - blend),
      y: (matched.y + predictedDriftY) * blend + (projectile.y + serverLeadY) * (1 - blend),
      angle: Number.isFinite(predictedAngle) ? predictedAngle : projectile.angle
    };
  };
}
