import { getRangerCurrentWeaponModeStats, getRangerSelectedWeapon } from "../game/rangerTalentTree.js";

const PREDICTIVE_RANGED_PROJECTILES_ENABLED = true;
const PREDICTIVE_MELEE_SWINGS_ENABLED = false;

function removeRenderedPredictedProjectile(game, renderId) {
  if (!game || typeof renderId !== "string" || !renderId) return;
  for (const collection of [game.bullets, game.fireArrows, game.meleeSwings]) {
    if (!Array.isArray(collection)) continue;
    const index = collection.findIndex((entry) => entry?.predicted && entry.predictedRenderId === renderId);
    if (index >= 0) collection.splice(index, 1);
  }
}

export function enqueuePredictedProjectile(store, seq, type, x, y, nowMs = performance.now(), angle = NaN) {
  if (!(store instanceof Map)) return null;
  if (!Number.isFinite(seq) || seq <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const key = Math.floor(seq);
  if (!store.has(key)) store.set(key, []);
  const bucket = store.get(key);
  const predicted = {
    seq: key,
    type,
    x,
    y,
    angle,
    createdAt: nowMs,
    vx: 0,
    vy: 0,
    size: type === "fireArrow" ? 8 : 6,
    renderId: `net-predicted-${type}-${key}-${bucket.length}`
  };
  bucket.push(predicted);
  return predicted;
}

function enqueuePredictedMeleeSwing(game, dirX, dirY, nowMs, seq) {
  if (!game || !game.player || !Array.isArray(game.meleeSwings)) return;
  const range = game.classSpec?.meleeRange || 42;
  const arcDeg = game.classSpec?.meleeArcDeg || 95;
  const arc = (arcDeg * Math.PI) / 180;
  const angle = Math.atan2(dirY, dirX);
  game.meleeSwings.push({
    x: game.player.x,
    y: game.player.y,
    angle,
    arc,
    range,
    executeProc: false,
    life: game.config?.effects?.meleeSwingLife || 0.17,
    maxLife: game.config?.effects?.meleeSwingLife || 0.17,
    predicted: true,
    seq,
    createdAt: nowMs
  });
  if (typeof game.recordPlayerShotTelemetry === "function") {
    game.recordPlayerShotTelemetry({
      source: "predictedMelee",
      playerX: game.player?.x || 0,
      playerY: game.player?.y || 0,
      moving: !!game.player?.moving,
      aimX: Number.isFinite(game.input?.mouse?.worldX) ? game.input.mouse.worldX : null,
      aimY: Number.isFinite(game.input?.mouse?.worldY) ? game.input.mouse.worldY : null,
      intendedAngle: angle,
      volleyAngles: [Number(angle.toFixed(6))],
      multishotCount: 1,
      projectileSpeed: 0,
      fireCooldown: typeof game.getPlayerFireCooldown === "function" ? game.getPlayerFireCooldown() : 0,
      seq
    });
  }
}

function enqueuePredictedPrimarySpread(game, store, seq, dirX, dirY, nowMs) {
  if (!game || typeof game.getBowMuzzleOrigin !== "function" || !(store instanceof Map)) return;
  const origin = game.getBowMuzzleOrigin(dirX, dirY);
  const baseAngle = Math.atan2(origin.dirY, origin.dirX);
  const rangerModeStats = game.isArcherClass?.() ? getRangerCurrentWeaponModeStats(game) : null;
  const projectileSpeed = Number.isFinite(rangerModeStats?.projectileSpeed)
    ? rangerModeStats.projectileSpeed
    : (typeof game.getProjectileSpeed === "function" ? game.getProjectileSpeed() : 0);
  const projectileLife = Number.isFinite(rangerModeStats?.life) ? rangerModeStats.life : 1.1;
  const projectileSize = Number.isFinite(rangerModeStats?.size) ? rangerModeStats.size : 6;
  const projectileType = game.isArcherClass?.() ? `ranger_${getRangerSelectedWeapon(game) || "longbow"}` : "bullet";
  const volleyAngles =
    typeof game.getMultiarrowAngles === "function"
      ? game.getMultiarrowAngles(baseAngle)
      : [baseAngle];
  if (typeof game.recordPlayerShotTelemetry === "function") {
    game.recordPlayerShotTelemetry({
      source: "predictedPrimary",
      playerX: game.player?.x || 0,
      playerY: game.player?.y || 0,
      moving: !!game.player?.moving,
      aimX: Number.isFinite(game.input?.mouse?.worldX) ? game.input.mouse.worldX : null,
      aimY: Number.isFinite(game.input?.mouse?.worldY) ? game.input.mouse.worldY : null,
      intendedAngle: baseAngle,
      volleyAngles: volleyAngles.map((angle) => Number(angle.toFixed(6))),
      multishotCount: volleyAngles.length,
      projectileSpeed,
      fireCooldown: typeof game.getPlayerFireCooldown === "function" ? game.getPlayerFireCooldown() : 0,
      seq
    });
  }
  for (const a of volleyAngles) {
    const spawnX = origin.x + Math.cos(a) * 7;
    const spawnY = origin.y + Math.sin(a) * 7;
    const predicted = enqueuePredictedProjectile(store, seq, "bullet", spawnX, spawnY, nowMs, a);
    if (predicted) {
      predicted.vx = Math.cos(a) * projectileSpeed;
      predicted.vy = Math.sin(a) * projectileSpeed;
      predicted.size = projectileSize;
      predicted.life = projectileLife;
      predicted.projectileType = projectileType;
      predicted.ownerId = game.networkLocalPlayerId || game.player?.id || null;
      if (Array.isArray(game.bullets)) {
        game.bullets.push({
          id: predicted.renderId,
          predicted: true,
          predictedRenderId: predicted.renderId,
          x: predicted.x,
          y: predicted.y,
          vx: predicted.vx,
          vy: predicted.vy,
          angle: a,
          life: projectileLife,
          size: projectileSize,
          projectileType: predicted.projectileType,
          ownerId: predicted.ownerId,
          spawnSeq: Math.floor(seq),
          hitTargets: new Set()
        });
      }
    }
  }
}

export function prunePredictedProjectiles(store, nowMs = performance.now(), ttlMs = 220, game = null, renderTtlMs = ttlMs) {
  if (!(store instanceof Map)) return;
  for (const [seq, list] of store.entries()) {
    const next = list.filter((p) => nowMs - p.createdAt <= ttlMs);
    if (game) {
      for (const entry of list) {
        if (!next.includes(entry) || nowMs - entry.createdAt > renderTtlMs) {
          entry.renderExpired = true;
          removeRenderedPredictedProjectile(game, entry.renderId);
        }
      }
    }
    if (next.length === 0) store.delete(seq);
    else if (next.length !== list.length) store.set(seq, next);
  }
}

export function updatePredictedProjectiles(game, store, dt) {
  if (!game || !(store instanceof Map) || !Number.isFinite(dt) || dt <= 0) return;
  const rendered = new Map();
  for (const collection of [game.bullets, game.fireArrows]) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      if (entry?.predicted && typeof entry.predictedRenderId === "string") rendered.set(entry.predictedRenderId, entry);
    }
  }
  for (const list of store.values()) {
    if (!Array.isArray(list)) continue;
    for (const predicted of list) {
      if (!predicted || typeof predicted.renderId !== "string") continue;
      predicted.x += (Number.isFinite(predicted.vx) ? predicted.vx : 0) * dt;
      predicted.y += (Number.isFinite(predicted.vy) ? predicted.vy : 0) * dt;
      if (Number.isFinite(predicted.life)) predicted.life = Math.max(0, predicted.life - dt);
      const render = rendered.get(predicted.renderId);
      if (!render) {
        if (predicted.renderExpired) continue;
        if (predicted.type === "bullet" && Array.isArray(game.bullets)) {
          game.bullets.push({
            id: predicted.renderId,
            predicted: true,
            predictedRenderId: predicted.renderId,
            x: predicted.x,
            y: predicted.y,
            vx: Number.isFinite(predicted.vx) ? predicted.vx : 0,
            vy: Number.isFinite(predicted.vy) ? predicted.vy : 0,
            angle: predicted.angle,
            life: Number.isFinite(predicted.life) ? predicted.life : 0.2,
            size: Number.isFinite(predicted.size) ? predicted.size : 6,
            projectileType: predicted.projectileType || "bullet",
            ownerId: predicted.ownerId || game.networkLocalPlayerId || game.player?.id || null,
            spawnSeq: predicted.seq,
            hitTargets: new Set()
          });
        }
        continue;
      }
      render.x = predicted.x;
      render.y = predicted.y;
      if (Number.isFinite(predicted.life)) render.life = predicted.life;
    }
  }
}

export function updateNetworkProjectilePresentation(game, dt) {
  if (!game || !Number.isFinite(dt) || dt <= 0) return;
  for (const collection of [game.bullets, game.fireArrows]) {
    if (!Array.isArray(collection)) continue;
    for (const projectile of collection) {
      if (!projectile || projectile.predicted) continue;
      const vx = Number.isFinite(projectile.vx) ? projectile.vx : 0;
      const vy = Number.isFinite(projectile.vy) ? projectile.vy : 0;
      if (vx === 0 && vy === 0) continue;
      projectile.x += vx * dt;
      projectile.y += vy * dt;
      if (Number.isFinite(projectile.life)) projectile.life = Math.max(0, projectile.life - dt);
    }
    for (let i = collection.length - 1; i >= 0; i -= 1) {
      const projectile = collection[i];
      if (projectile?.predicted) continue;
      if (Number.isFinite(projectile?.life) && projectile.life <= 0) collection.splice(i, 1);
    }
  }
}

export function discardPredictedProjectile(game, predicted) {
  if (!predicted) return;
  removeRenderedPredictedProjectile(game, predicted.renderId);
}

export function predictProjectileSpawn(game, input, nowMs, isNetworkController, store, nextHeldPrimaryPredictAtMs) {
  if (!game || !isNetworkController) return nextHeldPrimaryPredictAtMs;
  const rawX =
    input.hasAim && Number.isFinite(input.aimDirX)
      ? input.aimDirX
      : input.hasAim
      ? input.aimX - game.player.x
      : game.player.dirX;
  const rawY =
    input.hasAim && Number.isFinite(input.aimDirY)
      ? input.aimDirY
      : input.hasAim
      ? input.aimY - game.player.y
      : game.player.dirY;
  const len = Math.hypot(rawX, rawY) || 1;
  const dirX = rawX / len;
  const dirY = rawY / len;
  const usesRanged = !!game.classSpec?.usesRanged;
  if (usesRanged && typeof game.getBowMuzzleOrigin !== "function") return nextHeldPrimaryPredictAtMs;
  if (usesRanged && !PREDICTIVE_RANGED_PROJECTILES_ENABLED) return 0;
  if (!usesRanged && !PREDICTIVE_MELEE_SWINGS_ENABLED) return 0;

  const primaryCdSec = typeof game.getPlayerFireCooldown === "function" ? game.getPlayerFireCooldown() : 0.25;
  const primaryCadenceMs = Math.max(40, (Number.isFinite(primaryCdSec) ? primaryCdSec : 0.25) * 1000);

  if (input.firePrimaryQueued) {
    if (usesRanged) enqueuePredictedPrimarySpread(game, store, input.seq, dirX, dirY, nowMs);
    else enqueuePredictedMeleeSwing(game, dirX, dirY, nowMs, input.seq);
    nextHeldPrimaryPredictAtMs = nowMs + primaryCadenceMs;
  } else if (input.firePrimaryHeld && input.hasAim) {
    if (nextHeldPrimaryPredictAtMs <= 0) nextHeldPrimaryPredictAtMs = nowMs;
    if (nowMs + 2 >= nextHeldPrimaryPredictAtMs) {
      if (usesRanged) enqueuePredictedPrimarySpread(game, store, input.seq, dirX, dirY, nowMs);
      else enqueuePredictedMeleeSwing(game, dirX, dirY, nowMs, input.seq);
      nextHeldPrimaryPredictAtMs = nowMs + primaryCadenceMs;
    }
  } else {
    nextHeldPrimaryPredictAtMs = 0;
  }
  if (usesRanged && input.fireAltQueued) {
    const origin = game.getBowMuzzleOrigin(dirX, dirY);
    enqueuePredictedProjectile(
      store,
      input.seq,
      "fireArrow",
      origin.x + origin.dirX * 8,
      origin.y + origin.dirY * 8,
      nowMs,
      Math.atan2(origin.dirY, origin.dirX)
    );
    const bucket = store.get(Math.floor(input.seq));
    if (Array.isArray(bucket) && bucket.length > 0) {
      const predicted = bucket[bucket.length - 1];
      predicted.vx = origin.dirX * (game.config?.fireArrow?.speed || 0);
      predicted.vy = origin.dirY * (game.config?.fireArrow?.speed || 0);
      predicted.size = 8;
    }
  }
  return nextHeldPrimaryPredictAtMs;
}
