import { applyMetaStateToGame, applyNetworkFloatingTextEvents, captureEnemyStateById, capturePlayerProgressById, createProjectileSpawnReconciler, findSnapshotLocalPlayer, getPredictionPressure, queuePlayerDeathNotifications, syncFloorBossState, syncNamedObject, syncRemotePlayers, synthesizeDespawnDamageFloatingTexts, synthesizeEnemyDamageFloatingTexts, synthesizePlayerProgressionFloatingTexts } from "./clientSnapshotHelpers.js";
import {
  ensureNetworkPerf,
  isPostLoadCorrectionActive,
  applyServerStateAnomalies,
  recordCorrection,
  recordNetworkFlightEvent,
  recordPostLoadCorrection,
  recordSuspiciousNetworkState
} from "./clientCorrectionMetrics.js";
import { applyPlayerSnapshotToGameState } from "./playerSnapshotSchema.js";
import { applyPredictedTeleportAction } from "./teleportPrediction.js";
import { resolveSkillPointPopupPendingSpend } from "../game/skillPointPopup.js";
import { applyOwlDeliveryNotifications } from "./owlDeliveryNotifications.js";
import { applyShopRotationSnapshot } from "./shopRotationNotifications.js";
export { applyMetaStateToGame, resetNetworkFloatingTextEventCache } from "./clientSnapshotHelpers.js";

function normalizeMapRow(row) {
  return typeof row === "string" ? Array.from(row) : Array.isArray(row) ? row.slice() : [];
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
  game.lightSources = syncByIdLerp(game.lightSources, payload.lightSources, 1);
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
  game.lightSources = syncByIdLerp(game.lightSources, payload.lightSources, 1);
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
      const prevTeleportSeq = Number.isFinite(dst.teleportSeq) ? dst.teleportSeq : null;
      const nextTeleportSeq = Number.isFinite(srcItem?.teleportSeq) ? srcItem.teleportSeq : null;
      Object.assign(dst, srcItem);
      const teleportSnap = nextTeleportSeq !== null && nextTeleportSeq !== prevTeleportSeq;
      if (!teleportSnap && sx !== null && sy !== null && prevX !== null && prevY !== null && positionAlpha < 1) {
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

function applyDeltaCollection(target, delta, { keyframe = false, positionAlpha = 1, decorate, mapSpawn, keepExisting } = {}) {
  if (!Array.isArray(target)) target = [];
  const d = delta && typeof delta === "object" ? delta : null;
  if (!d) return target;
  const existing = new Map();
  for (const item of target) {
    if (item && item.id != null && (typeof keepExisting !== "function" || keepExisting(item))) existing.set(item.id, item);
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
  applyShopRotationSnapshot(game, state);
  applyServerStateAnomalies(game, state.serverStateAnomalies);
  const previousAliveById = new Map();
  if (game?.player?.id) previousAliveById.set(game.player.id, (game.player.alive !== false) && (game.player.health || 0) > 0);
  for (const player of Array.isArray(game?.remotePlayers) ? game.remotePlayers : []) {
    if (player?.id) previousAliveById.set(player.id, (player.alive !== false) && (player.health || 0) > 0);
  }
  const previousProgressById = capturePlayerProgressById(game);
  ensureNetworkPerf(game);
  game.networkPerf.appliedSnapshotCount += 1;
  const isInitialControllerSync = !!controller && ackSeq <= 0 && !!state?.delta?.keyframe;
  const snapshotLocalPlayer = findSnapshotLocalPlayer(state, localPlayerId);
  const snapshotPlayer = snapshotLocalPlayer || state.player;

  if (snapshotPlayer && typeof snapshotPlayer === "object") {
    const beforeFlightX = Number.isFinite(game.player?.x) ? game.player.x : null;
    const beforeFlightY = Number.isFinite(game.player?.y) ? game.player.y : null;
    const serverFlightX = Number.isFinite(snapshotPlayer.x) ? snapshotPlayer.x : null;
    const serverFlightY = Number.isFinite(snapshotPlayer.y) ? snapshotPlayer.y : null;
    let flightCorrectionKind = "none";
    let flightCorrectionPx = serverFlightX !== null && serverFlightY !== null && beforeFlightX !== null && beforeFlightY !== null
      ? Math.hypot(serverFlightX - beforeFlightX, serverFlightY - beforeFlightY)
      : 0;
    let flightAppliedPx = 0;
    let flightPendingDepth = Array.isArray(netPendingInputs) ? netPendingInputs.length : 0;
    let flightPostLoadActive = false;
    const snapshotPlayerAlive = snapshotPlayer.alive !== false && (!Number.isFinite(snapshotPlayer.health) || snapshotPlayer.health > 0);
    const reconcileAsController = !!controller && !!isNetworkController && snapshotPlayerAlive;
    if (!reconcileAsController) {
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
          applyPredictedTeleportAction(game, entry, probe);
        }
        correctedX = probe.x;
        correctedY = probe.y;
      }

      const dx = correctedX - game.player.x;
      const dy = correctedY - game.player.y;
      const errorSq = dx * dx + dy * dy;
      const errorDist = Math.sqrt(errorSq);
      const teleportSnap = Number.isFinite(snapshotPlayer.teleportSeq) && snapshotPlayer.teleportSeq !== game.player.teleportSeq;
      const jitterMs = Number.isFinite(snapshotJitterMs) ? Math.max(0, snapshotJitterMs) : 0;
      const frameGap = Number.isFinite(frameGapMs) ? Math.max(0, frameGapMs) : 16.67;
      const pendingDepth = Array.isArray(netPendingInputs) ? netPendingInputs.length : 0;
      flightPendingDepth = pendingDepth;
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
      const postLoadCorrectionActive = isPostLoadCorrectionActive(game, { controller, ackSeq, isInitialControllerSync });
      flightPostLoadActive = postLoadCorrectionActive;
      if (postLoadCorrectionActive) {
        game.networkPerf.postLoadLastCorrectionPx = errorDist;
        if (errorDist > (game.networkPerf.postLoadMaxCorrectionPx || 0)) {
          game.networkPerf.postLoadMaxCorrectionPx = errorDist;
        }
      }
      game.networkPerf.lastCorrectionPx = errorDist;
      if (errorDist > game.networkPerf.maxCorrectionPx) game.networkPerf.maxCorrectionPx = errorDist;
      flightCorrectionPx = errorDist;
      if (isInitialControllerSync || teleportSnap || localPlayerBlocked || errorDist > hardSnapDist) {
        flightCorrectionKind = teleportSnap ? "teleportSnap" : localPlayerBlocked ? "blockedHardSnap" : "hardSnap";
        flightAppliedPx = errorDist;
        game.networkPerf.hardSnapCount += 1;
        if (postLoadCorrectionActive) game.networkPerf.postLoadHardSnapCount += 1;
        if (localPlayerBlocked) game.networkPerf.blockedSnapCount += 1;
        if (postLoadCorrectionActive && localPlayerBlocked) game.networkPerf.postLoadBlockedSnapCount += 1;
        recordCorrection(game, flightCorrectionKind, errorDist, {
          ackSeq,
          pendingInputs: netPendingInputs,
          extra: {
            correctedX: Math.round(correctedX),
            correctedY: Math.round(correctedY)
          }
        });
        recordPostLoadCorrection(game, postLoadCorrectionActive, flightCorrectionKind, errorDist, {
          ackSeq,
          pendingDepth,
          extra: {
            correctedX: Math.round(correctedX),
            correctedY: Math.round(correctedY)
          }
        });
        game.player.x = correctedX;
        game.player.y = correctedY;
      } else if (ackSeq > 0 && errorDist > softSnapDist) {
        flightCorrectionKind = "softCorrection";
        game.networkPerf.softCorrectionCount += 1;
        if (postLoadCorrectionActive) game.networkPerf.postLoadSoftCorrectionCount += 1;
        recordCorrection(game, "softCorrection", errorDist, { ackSeq, pendingInputs: netPendingInputs });
        recordPostLoadCorrection(game, postLoadCorrectionActive, "softCorrection", errorDist, { ackSeq, pendingDepth });
        const denom = Math.max(1, hardSnapDist - softSnapDist);
        const errorNorm = Math.max(0, Math.min(1, (errorDist - softSnapDist) / denom));
        const jitterDamping = Math.max(0.5, 1 - jitterMs / 26);
        const baseBlend = 0.07;
        const maxBlend = 0.24;
        const blend = (baseBlend + (maxBlend - baseBlend) * errorNorm) * jitterDamping;
        const maxStep = Math.max(settleDist, errorDist * 0.34);
        const step = Math.min(maxStep, errorDist * blend);
        flightAppliedPx = step;
        if (errorDist > 0.0001) {
          const inv = 1 / errorDist;
          game.player.x += dx * inv * step;
          game.player.y += dy * inv * step;
        }
      } else if (ackSeq > 0 && errorDist > settleDist) {
        flightCorrectionKind = "settleCorrection";
        flightAppliedPx = errorDist * 0.05;
        game.networkPerf.settleCorrectionCount += 1;
        if (postLoadCorrectionActive) game.networkPerf.postLoadSettleCorrectionCount += 1;
        recordCorrection(game, "settleCorrection", errorDist, { ackSeq, pendingInputs: netPendingInputs });
        recordPostLoadCorrection(game, postLoadCorrectionActive, "settleCorrection", errorDist, { ackSeq, pendingDepth });
        game.player.x += dx * 0.05;
        game.player.y += dy * 0.05;
      }
    }
    applyPlayerSnapshotToGameState(game, snapshotPlayer, { isNetworkController, syncNamedObject });
    if ((game.networkPerf.appliedSnapshotCount || 0) === 1 && game.skillPointPopup && Number.isFinite(game.skillPoints)) {
      game.skillPointPopup.lastSkillPoints = Math.max(0, Math.floor(game.skillPoints));
    }
    const actionAckSeq = localPlayerId && state.lastActionSeqByPlayer && typeof state.lastActionSeqByPlayer === "object"
      ? state.lastActionSeqByPlayer[localPlayerId]
      : NaN;
    resolveSkillPointPopupPendingSpend(game, { acknowledgedActionSeq: actionAckSeq });
    recordNetworkFlightEvent(game, "snapshotApply", {
      snapshotCount: game.networkPerf.appliedSnapshotCount || 0,
      controller: !!controller,
      localController: !!isNetworkController,
      initialSync: isInitialControllerSync,
      postLoadActive: flightPostLoadActive,
      keyframe: !!state?.delta?.keyframe,
      ackSeq: Number.isFinite(ackSeq) ? ackSeq : 0,
      pendingInputs: flightPendingDepth,
      jitterMs: Number.isFinite(snapshotJitterMs) ? Math.round(snapshotJitterMs) : 0,
      frameGapMs: Number.isFinite(frameGapMs) ? Math.round(frameGapMs) : 0,
      correctionKind: flightCorrectionKind,
      correctionPx: Math.round(flightCorrectionPx),
      appliedPx: Math.round(flightAppliedPx),
      beforeX: beforeFlightX === null ? null : Math.round(beforeFlightX),
      beforeY: beforeFlightY === null ? null : Math.round(beforeFlightY),
      serverX: serverFlightX === null ? null : Math.round(serverFlightX),
      serverY: serverFlightY === null ? null : Math.round(serverFlightY),
      afterX: Number.isFinite(game.player?.x) ? Math.round(game.player.x) : null,
      afterY: Number.isFinite(game.player?.y) ? Math.round(game.player.y) : null
    });
  }
  syncRemotePlayers(game, state, localPlayerId, 0.72, syncByIdLerp);
  applyNetworkFloatingTextEvents(game, state.floatingTexts);
  queuePlayerDeathNotifications(game, previousAliveById, snapshotPlayer, game.remotePlayers);
  synthesizePlayerProgressionFloatingTexts(game, previousProgressById, snapshotPlayer, game.remotePlayers);
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
    const enemyDespawns = Array.isArray(state.delta.enemies?.despawn) ? state.delta.enemies.despawn.slice() : [];
    game.enemies = applyDeltaCollection(game.enemies, state.delta.enemies, { keyframe, positionAlpha: snapAlpha });
    game.drops = applyDeltaCollection(game.drops, state.delta.drops, { keyframe, positionAlpha: snapAlpha });
    game.treasureChests = applyDeltaCollection(game.treasureChests, state.delta.treasureChests, { keyframe, positionAlpha: 1 });
    game.lightSources = applyDeltaCollection(game.lightSources, state.delta.lightSources, { keyframe, positionAlpha: 1 });
    game.breakables = applyDeltaCollection(game.breakables, state.delta.breakables, { keyframe, positionAlpha: 1 });
    game.wallTraps = applyDeltaCollection(game.wallTraps, state.delta.wallTraps, { keyframe, positionAlpha: 1 });
    game.bullets = applyDeltaCollection(game.bullets, state.delta.bullets, {
      keyframe,
      positionAlpha: 1,
      keepExisting: (projectile) => !projectile?.predicted,
      mapSpawn: (p) => reconcileProjectileSpawn(p, "bullet")
    });
    game.fireArrows = applyDeltaCollection(game.fireArrows, state.delta.fireArrows, {
      keyframe,
      positionAlpha: 1,
      keepExisting: (projectile) => !projectile?.predicted,
      mapSpawn: (p) => reconcileProjectileSpawn(p, "fireArrow")
    });
    game.fireZones = applyDeltaCollection(game.fireZones, state.delta.fireZones, { keyframe, positionAlpha: 1 });
    game.meleeSwings = applyDeltaCollection(game.meleeSwings, state.delta.meleeSwings, { keyframe, positionAlpha: 1 });
    const bossCleanupPhase = state.floorBoss && ["defeated", "portal", "completed"].includes(state.floorBoss.phase);
    synthesizeDespawnDamageFloatingTexts(game, previousEnemyStateById, enemyDespawns, { skip: keyframe || bossCleanupPhase });
    synthesizeEnemyDamageFloatingTexts(game, previousEnemyStateById, { skip: false });
    recordSuspiciousNetworkState(game, { keyframe, ackSeq });
  } else {
    game.armorStands = syncByIdLerp(game.armorStands, state.armorStands, 1);
    game.enemies = syncByIdLerp(game.enemies, state.enemies, snapAlpha);
    game.drops = syncByIdLerp(game.drops, state.drops, snapAlpha);
    game.treasureChests = syncByIdLerp(game.treasureChests, state.treasureChests, 1);
    game.lightSources = syncByIdLerp(game.lightSources, state.lightSources, 1);
    game.breakables = syncByIdLerp(game.breakables, state.breakables, 1);
    game.wallTraps = syncByIdLerp(game.wallTraps, state.wallTraps, 1);
    game.bullets = syncByIdLerp(game.bullets, (state.bullets || []).map((p) => reconcileProjectileSpawn(p, "bullet")), 1);
    game.fireArrows = syncByIdLerp(game.fireArrows, (state.fireArrows || []).map((p) => reconcileProjectileSpawn(p, "fireArrow")), 1);
    game.fireZones = syncByIdLerp(game.fireZones, state.fireZones, 1);
    game.meleeSwings = syncByIdLerp(game.meleeSwings, state.meleeSwings, 1);
    synthesizeEnemyDamageFloatingTexts(game, previousEnemyStateById, { skip: false });
    recordSuspiciousNetworkState(game, { keyframe: false, ackSeq });
  }
  if (Object.prototype.hasOwnProperty.call(state, "owlDelivery")) {
    applyOwlDeliveryNotifications(game, state.owlDelivery);
    game.owlDelivery = state.owlDelivery || null;
  }
  if (Object.prototype.hasOwnProperty.call(state, "flameOfTheFallen")) game.flameOfTheFallen = state.flameOfTheFallen || null;

  return { netPendingInputs, netLastAckSeq };
}
