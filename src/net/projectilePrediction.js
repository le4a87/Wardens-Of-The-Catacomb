export function enqueuePredictedProjectile(store, seq, type, x, y, nowMs = performance.now(), angle = NaN) {
  if (!(store instanceof Map)) return;
  if (!Number.isFinite(seq) || seq <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const key = Math.floor(seq);
  if (!store.has(key)) store.set(key, []);
  store.get(key).push({ seq: key, type, x, y, angle, createdAt: nowMs, vx: 0, vy: 0, size: type === "fireArrow" ? 8 : 6 });
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
      projectileSpeed: typeof game.getProjectileSpeed === "function" ? game.getProjectileSpeed() : 0,
      fireCooldown: typeof game.getPlayerFireCooldown === "function" ? game.getPlayerFireCooldown() : 0,
      seq
    });
  }
  for (const a of volleyAngles) {
    const speed = typeof game.getProjectileSpeed === "function" ? game.getProjectileSpeed() : 0;
    const spawnX = origin.x + Math.cos(a) * 7;
    const spawnY = origin.y + Math.sin(a) * 7;
    enqueuePredictedProjectile(store, seq, "bullet", spawnX, spawnY, nowMs, a);
    const bucket = store.get(Math.floor(seq));
    if (Array.isArray(bucket) && bucket.length > 0) {
      const predicted = bucket[bucket.length - 1];
      predicted.vx = Math.cos(a) * speed;
      predicted.vy = Math.sin(a) * speed;
      predicted.size = 6;
    }
  }
}

export function prunePredictedProjectiles(store, nowMs = performance.now(), ttlMs = 220) {
  if (!(store instanceof Map)) return;
  for (const [seq, list] of store.entries()) {
    const next = list.filter((p) => nowMs - p.createdAt <= ttlMs);
    if (next.length === 0) store.delete(seq);
    else if (next.length !== list.length) store.set(seq, next);
  }
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

  const primaryCdSec = typeof game.getPlayerFireCooldown === "function" ? game.getPlayerFireCooldown() : 0.25;
  const primaryCadenceMs = Math.max(40, (Number.isFinite(primaryCdSec) ? primaryCdSec : 0.25) * 1000);

  if (input.firePrimaryQueued) {
    if (usesRanged) enqueuePredictedPrimarySpread(game, store, input.seq, dirX, dirY, nowMs);
    else enqueuePredictedMeleeSwing(game, dirX, dirY, nowMs, input.seq);
    nextHeldPrimaryPredictAtMs = nowMs + primaryCadenceMs;
  } else if (input.firePrimaryHeld && input.hasAim) {
    if (nextHeldPrimaryPredictAtMs <= 0) nextHeldPrimaryPredictAtMs = nowMs;
    let predictedBursts = 0;
    while (nowMs + 2 >= nextHeldPrimaryPredictAtMs && predictedBursts < 2) {
      if (usesRanged) enqueuePredictedPrimarySpread(game, store, input.seq, dirX, dirY, nowMs);
      else enqueuePredictedMeleeSwing(game, dirX, dirY, nowMs, input.seq);
      nextHeldPrimaryPredictAtMs += primaryCadenceMs;
      predictedBursts += 1;
    }
    if (nextHeldPrimaryPredictAtMs < nowMs - primaryCadenceMs) {
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
