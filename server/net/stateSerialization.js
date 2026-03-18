function shallowPlayerState(simPlayer) {
  return {
    x: simPlayer.x,
    y: simPlayer.y,
    size: simPlayer.size,
    health: simPlayer.health,
    maxHealth: simPlayer.maxHealth,
    dirX: simPlayer.dirX,
    dirY: simPlayer.dirY,
    facing: simPlayer.facing,
    classType: simPlayer.classType
  };
}

export function getStableId(room, domain, prefix, obj) {
  if (!obj || typeof obj !== "object") return `${prefix}_0`;
  const map = room.idMaps[domain];
  if (map.has(obj)) return map.get(obj);
  const id = `${prefix}_${room.idCounters[domain]++}`;
  map.set(obj, id);
  return id;
}

function serializeBullet(room, b, domain = "bullet", prefix = "b") {
  const payload = {
    id: getStableId(room, domain, prefix, b),
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    angle: b.angle,
    life: b.life,
    size: b.size
  };
  if (Number.isFinite(b.spawnSeq) && b.spawnSeq > 0) payload.spawnSeq = Math.floor(b.spawnSeq);
  if (typeof b.ownerId === "string" && b.ownerId) payload.ownerId = b.ownerId;
  if (typeof b.kind === "string" && b.kind !== "arrow") payload.kind = b.kind;
  if (typeof b.faction === "string" && b.faction !== "player") payload.faction = b.faction;
  if (Number.isFinite(b.damage)) payload.damage = b.damage;
  if (typeof b.projectileType === "string" && b.projectileType !== "bullet") payload.projectileType = b.projectileType;
  return payload;
}

function serializeEnemy(room, e) {
  const base = {
    id: getStableId(room, "enemy", "e", e),
    type: e.type,
    isFloorBoss: !!e.isFloorBoss,
    x: e.x,
    y: e.y,
    size: e.size,
    hp: e.hp,
    maxHp: e.maxHp,
    hpBarTimer: e.hpBarTimer || 0
  };
  switch (e.type) {
    case "rat_archer":
      base.dirX = e.dirX;
      base.dirY = e.dirY;
      base.shotWindupTimer = e.shotWindupTimer || 0;
      break;
    case "skeleton_warrior":
      base.dirX = e.dirX;
      base.dirY = e.dirY;
      base.collapsed = !!e.collapsed;
      base.collapseTimer = e.collapseTimer || 0;
      break;
    case "treasure_goblin":
      base.goldEaten = e.goldEaten || 0;
      break;
    default:
      break;
  }
  return base;
}

function serializeDrop(room, d) {
  return {
    id: getStableId(room, "drop", "d", d),
    type: d.type,
    x: d.x,
    y: d.y,
    size: d.size,
    amount: d.amount,
    life: d.life
  };
}

function serializeBreakable(room, b) {
  return {
    id: getStableId(room, "breakable", "br", b),
    type: b.type,
    x: b.x,
    y: b.y,
    size: b.size,
    hp: b.hp
  };
}

function serializeWallTrap(room, trap) {
  return {
    id: getStableId(room, "wallTrap", "wt", trap),
    x: trap.x,
    y: trap.y,
    size: trap.size,
    dirX: trap.dirX,
    dirY: trap.dirY,
    spotted: !!trap.spotted,
    cooldown: trap.cooldown || 0
  };
}

function makeActiveBounds(sim, padTiles = 10) {
  const tile = sim.config?.map?.tile || 32;
  const pad = Math.max(0, padTiles) * tile;
  const playW = typeof sim.getPlayAreaWidth === "function" ? sim.getPlayAreaWidth() : 960;
  const viewH = Number.isFinite(sim?.canvas?.height) ? sim.canvas.height : 640;
  const cam =
    typeof sim.getCamera === "function"
      ? sim.getCamera()
      : {
          x: Math.max(0, (sim.player?.x || 0) - playW / 2),
          y: Math.max(0, (sim.player?.y || 0) - viewH / 2)
        };
  return {
    left: cam.x - pad,
    top: cam.y - pad,
    right: cam.x + playW + pad,
    bottom: cam.y + viewH + pad
  };
}

function isInsideBounds(obj, bounds, extra = 0) {
  if (!obj || !bounds) return false;
  const x = Number.isFinite(obj.x) ? obj.x : 0;
  const y = Number.isFinite(obj.y) ? obj.y : 0;
  const size = Number.isFinite(obj.size) ? obj.size : 0;
  const r = Math.max(0, size * 0.5 + extra);
  return x + r >= bounds.left && x - r <= bounds.right && y + r >= bounds.top && y - r <= bounds.bottom;
}

export function serializeMetaState(source) {
  const sim = source && source.sim ? source.sim : source;
  const musicTrack = source && source.currentMusicTrack ? { ...source.currentMusicTrack } : sim && sim.musicTrack ? { ...sim.musicTrack } : null;
  const floorBoss = sim.floorBoss && typeof sim.floorBoss === "object" ? { ...sim.floorBoss } : null;
  return {
    floor: sim.floor,
    level: sim.level,
    score: sim.score,
    gold: sim.gold,
    experience: sim.experience,
    expToNextLevel: sim.expToNextLevel,
    activePlayerCount: sim.activePlayerCount,
    skillPoints: sim.skillPoints,
    hasKey: sim.hasKey,
    gameOver: sim.gameOver,
    paused: sim.paused,
    shopOpen: sim.shopOpen,
    skillTreeOpen: sim.skillTreeOpen,
    statsPanelOpen: sim.statsPanelOpen,
    warriorMomentumTimer: sim.warriorMomentumTimer || 0,
    warriorRageActiveTimer: sim.warriorRageActiveTimer || 0,
    warriorRageCooldownTimer: sim.warriorRageCooldownTimer || 0,
    warriorRageVictoryRushPool: sim.warriorRageVictoryRushPool || 0,
    warriorRageVictoryRushTimer: sim.warriorRageVictoryRushTimer || 0,
    floorBoss,
    portal: sim.portal ? { ...sim.portal } : null,
    musicTrack,
    skills: sim.skills,
    upgrades: sim.upgrades
  };
}

export function serializeState(room) {
  const sim = room.sim;
  const activeBounds = makeActiveBounds(sim, 8);
  const floorBoss =
    sim.floorBoss && typeof sim.floorBoss === "object"
      ? { ...sim.floorBoss }
      : null;
  const activeEnemies = sim.enemies.filter((e) => isInsideBounds(e, activeBounds, 56));
  const activeDrops = sim.drops.filter((d) => isInsideBounds(d, activeBounds, 40));
  const activeBreakables = (sim.breakables || []).filter((b) => isInsideBounds(b, activeBounds, 48));
  const activeWallTraps = (sim.wallTraps || []).filter((t) => isInsideBounds(t, activeBounds, 48));
  const activeBullets = sim.bullets.filter((b) => isInsideBounds(b, activeBounds, 128));
  const activeFireArrows = sim.fireArrows.filter((a) => isInsideBounds(a, activeBounds, 144));
  const activeFireZones = sim.fireZones.filter((z) => isInsideBounds(z, activeBounds, (Number.isFinite(z.radius) ? z.radius : 0) + 28));
  const activeMeleeSwings = sim.meleeSwings.filter((s) => isInsideBounds(s, activeBounds, (Number.isFinite(s.range) ? s.range : 0) + 24));
  return {
    mapSignature: `${sim.floor}:${sim.mapWidth}x${sim.mapHeight}`,
    time: sim.time,
    floor: sim.floor,
    floorBoss,
    player: shallowPlayerState(sim.player),
    door: { ...sim.door },
    pickup: { ...sim.pickup },
    portal: sim.portal ? { ...sim.portal } : null,
    enemies: activeEnemies.map((e) => serializeEnemy(room, e)),
    drops: activeDrops.map((d) => serializeDrop(room, d)),
    breakables: activeBreakables.map((b) => serializeBreakable(room, b)),
    wallTraps: activeWallTraps.map((t) => serializeWallTrap(room, t)),
    bullets: activeBullets.map((b) => serializeBullet(room, b, "bullet", "b")),
    fireArrows: activeFireArrows.map((a) => serializeBullet(room, a, "fireArrow", "fa")),
    fireZones: activeFireZones.map((z) => ({ id: getStableId(room, "fireZone", "fz", z), x: z.x, y: z.y, radius: z.radius, life: z.life })),
    meleeSwings: activeMeleeSwings.map((s) => ({
      id: getStableId(room, "meleeSwing", "ms", s),
      x: s.x,
      y: s.y,
      angle: s.angle,
      arc: s.arc,
      range: s.range,
      life: s.life
    }))
  };
}
