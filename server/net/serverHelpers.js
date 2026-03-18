function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(lo, Math.min(hi, v));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normClassType(value) {
  return value === "fighter" || value === "warrior" ? "fighter" : value === "necromancer" ? "necromancer" : "archer";
}

export function makeDefaultInput() {
  return {
    seq: 0,
    moveX: 0,
    moveY: 0,
    hasAim: false,
    aimX: 0,
    aimY: 0,
    firePrimaryQueued: false,
    firePrimaryHeld: false,
    fireAltQueued: false
  };
}

export function sanitizeInput(raw, previous) {
  const next = { ...previous };
  if (raw && typeof raw === "object") {
    next.seq = Number.isFinite(raw.seq) ? Math.max(0, Math.floor(raw.seq)) : next.seq;
    next.moveX = clamp(raw.moveX, -1, 1);
    next.moveY = clamp(raw.moveY, -1, 1);
    next.hasAim = !!raw.hasAim;
    next.aimX = Number.isFinite(raw.aimX) ? raw.aimX : next.aimX;
    next.aimY = Number.isFinite(raw.aimY) ? raw.aimY : next.aimY;
    next.firePrimaryQueued = !!raw.firePrimaryQueued;
    next.firePrimaryHeld = !!raw.firePrimaryHeld;
    next.fireAltQueued = !!raw.fireAltQueued;
  }
  return next;
}

export function safeSend(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
