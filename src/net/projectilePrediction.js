export function enqueuePredictedProjectile(store, seq, type, x, y, nowMs = performance.now()) {
  if (!(store instanceof Map)) return;
  if (!Number.isFinite(seq) || seq <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const key = Math.floor(seq);
  if (!store.has(key)) store.set(key, []);
  store.get(key).push({ type, x, y, createdAt: nowMs });
}

function enqueuePredictedPrimarySpread(game, store, seq, dirX, dirY, nowMs) {
  if (!game || typeof game.getBowMuzzleOrigin !== "function" || !(store instanceof Map)) return;
  const origin = game.getBowMuzzleOrigin(dirX, dirY);
  const baseAngle = Math.atan2(origin.dirY, origin.dirX);
  const count = typeof game.getMultiarrowCount === "function" ? game.getMultiarrowCount() : 1;
  const spreadDeg = typeof game.getMultiarrowSpreadDeg === "function" ? game.getMultiarrowSpreadDeg() : 0;
  const spreadRad = (spreadDeg * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : i / (count - 1);
    const offset = count <= 1 ? 0 : (t - 0.5) * spreadRad;
    const a = baseAngle + offset;
    enqueuePredictedProjectile(store, seq, "bullet", origin.x + Math.cos(a) * 7, origin.y + Math.sin(a) * 7, nowMs);
  }
}

export function prunePredictedProjectiles(store, nowMs = performance.now(), ttlMs = 1200) {
  if (!(store instanceof Map)) return;
  for (const [seq, list] of store.entries()) {
    const next = list.filter((p) => nowMs - p.createdAt <= ttlMs);
    if (next.length === 0) store.delete(seq);
    else if (next.length !== list.length) store.set(seq, next);
  }
}

export function predictProjectileSpawn(game, input, nowMs, isNetworkController, store, nextHeldPrimaryPredictAtMs) {
  if (!game || !isNetworkController) return nextHeldPrimaryPredictAtMs;
  if (typeof game.getBowMuzzleOrigin !== "function") return nextHeldPrimaryPredictAtMs;
  const rawX = input.hasAim ? input.aimX - game.player.x : game.player.dirX;
  const rawY = input.hasAim ? input.aimY - game.player.y : game.player.dirY;
  const len = Math.hypot(rawX, rawY) || 1;
  const dirX = rawX / len;
  const dirY = rawY / len;

  const primaryCdSec = typeof game.getPlayerFireCooldown === "function" ? game.getPlayerFireCooldown() : 0.25;
  const primaryCadenceMs = Math.max(40, (Number.isFinite(primaryCdSec) ? primaryCdSec : 0.25) * 1000);

  if (input.firePrimaryQueued) {
    enqueuePredictedPrimarySpread(game, store, input.seq, dirX, dirY, nowMs);
    nextHeldPrimaryPredictAtMs = nowMs + primaryCadenceMs;
  } else if (input.firePrimaryHeld && input.hasAim) {
    if (nextHeldPrimaryPredictAtMs <= 0) nextHeldPrimaryPredictAtMs = nowMs;
    let predictedBursts = 0;
    while (nowMs + 2 >= nextHeldPrimaryPredictAtMs && predictedBursts < 2) {
      enqueuePredictedPrimarySpread(game, store, input.seq, dirX, dirY, nowMs);
      nextHeldPrimaryPredictAtMs += primaryCadenceMs;
      predictedBursts += 1;
    }
    if (nextHeldPrimaryPredictAtMs < nowMs - primaryCadenceMs) {
      nextHeldPrimaryPredictAtMs = nowMs + primaryCadenceMs;
    }
  } else {
    nextHeldPrimaryPredictAtMs = 0;
  }
  if (input.fireAltQueued) {
    const origin = game.getBowMuzzleOrigin(dirX, dirY);
    enqueuePredictedProjectile(store, input.seq, "fireArrow", origin.x + origin.dirX * 8, origin.y + origin.dirY * 8, nowMs);
  }
  return nextHeldPrimaryPredictAtMs;
}
