function shallowPlayerState(simPlayer) {
  return {
    x: simPlayer.x,
    y: simPlayer.y,
    size: simPlayer.size,
    health: simPlayer.health,
    maxHealth: simPlayer.maxHealth,
    hpBarTimer: simPlayer.hpBarTimer || 0,
    level: simPlayer.level,
    score: simPlayer.score,
    gold: simPlayer.gold,
    experience: simPlayer.experience,
    expToNextLevel: simPlayer.expToNextLevel,
    skillPoints: simPlayer.skillPoints,
    levelWeaponDamageBonus: simPlayer.levelWeaponDamageBonus,
    skills: simPlayer.skills,
    rangerTalents: simPlayer.rangerTalents,
    warriorTalents: simPlayer.warriorTalents,
    necromancerTalents: simPlayer.necromancerTalents,
    rangerRuntime: simPlayer.rangerRuntime,
    warriorRuntime: simPlayer.warriorRuntime,
    necromancerRuntime: simPlayer.necromancerRuntime,
    consumableRuntime: simPlayer.consumableRuntime,
    consumables: simPlayer.consumables,
    upgrades: simPlayer.upgrades,
    dirX: simPlayer.dirX,
    dirY: simPlayer.dirY,
    facing: simPlayer.facing,
    classType: simPlayer.classType
  };
}

function shallowActivePlayerState(player) {
  return {
    id: player.id,
    handle: player.handle,
    classType: player.classType,
    x: player.x,
    y: player.y,
    size: player.size,
    health: player.health,
    maxHealth: player.maxHealth,
    hpBarTimer: player.hpBarTimer || 0,
    level: player.level,
    score: player.score,
    gold: player.gold,
    experience: player.experience,
    expToNextLevel: player.expToNextLevel,
    skillPoints: player.skillPoints,
    levelWeaponDamageBonus: player.levelWeaponDamageBonus,
    fireCooldown: player.fireCooldown,
    fireArrowCooldown: player.fireArrowCooldown,
    deathBoltCooldown: player.deathBoltCooldown,
    warriorMomentumTimer: player.warriorMomentumTimer,
    warriorRageActiveTimer: player.warriorRageActiveTimer,
    warriorRageCooldownTimer: player.warriorRageCooldownTimer,
    warriorRageVictoryRushPool: player.warriorRageVictoryRushPool,
    warriorRageVictoryRushTimer: player.warriorRageVictoryRushTimer,
    necromancerBeam: player.necromancerBeam
      ? {
          active: !!player.necromancerBeam.active,
          targetId: typeof player.necromancerBeam.targetId === "string" ? player.necromancerBeam.targetId : null,
          targetX: Number.isFinite(player.necromancerBeam.targetX) ? player.necromancerBeam.targetX : 0,
          targetY: Number.isFinite(player.necromancerBeam.targetY) ? player.necromancerBeam.targetY : 0,
          progress: Number.isFinite(player.necromancerBeam.progress) ? player.necromancerBeam.progress : 0
        }
      : null,
    skills: player.skills,
    rangerTalents: player.rangerTalents,
    warriorTalents: player.warriorTalents,
    necromancerTalents: player.necromancerTalents,
    upgrades: player.upgrades,
    consumableRuntime: player.consumableRuntime,
    consumables: player.consumables,
    rangerRuntime: player.rangerRuntime,
    warriorRuntime: player.warriorRuntime,
    necromancerRuntime: player.necromancerRuntime,
    dirX: player.dirX,
    dirY: player.dirY,
    facing: player.facing,
    moving: !!player.moving,
    alive: player.alive !== false,
    color: player.color
  };
}

function resolveControlledEnemyColor(room, enemy) {
  const ownerId = typeof enemy?.controllerPlayerId === "string" && enemy.controllerPlayerId ? enemy.controllerPlayerId : null;
  if (!ownerId || !room) return null;
  const players = typeof room.getSimulationPlayerEntities === "function"
    ? room.getSimulationPlayerEntities()
    : typeof room.getActivePlayerStates === "function"
    ? room.getActivePlayerStates()
    : [];
  for (const player of players) {
    if (!player || player.id !== ownerId) continue;
    return typeof player.color === "string" && player.color ? player.color : null;
  }
  return null;
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
    hpBarTimer: e.hpBarTimer || 0,
    shotWindupTimer: e.shotWindupTimer || 0,
    collapsed: !!e.collapsed,
    collapseTimer: e.collapseTimer || 0,
    goldEaten: e.goldEaten || 0,
    variant: typeof e.variant === "string" ? e.variant : null,
    damageMin: e.damageMin,
    damageMax: e.damageMax
  };
  if (e.isControlledUndead) base.isControlledUndead = true;
  if (typeof e.controllerPlayerId === "string" && e.controllerPlayerId) base.controllerPlayerId = e.controllerPlayerId;
  if (Number.isFinite(e.curseTimer) && e.curseTimer > 0) base.curseTimer = e.curseTimer;
  if (Number.isFinite(e.rotTimer) && e.rotTimer > 0) base.rotTimer = e.rotTimer;
  if (Number.isFinite(e.rotDps) && e.rotDps > 0) base.rotDps = e.rotDps;
  const controlledColor = resolveControlledEnemyColor(room, e);
  if (controlledColor) base.controlledColor = controlledColor;
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
  const players = typeof sim.getLivingPlayerEntities === "function" ? sim.getLivingPlayerEntities() : [sim.player];
  const activePlayers = Array.isArray(players) && players.length > 0 ? players.filter((player) => !!player) : [sim.player];
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const player of activePlayers) {
    const px = Number.isFinite(player?.x) ? player.x : (sim.player?.x || 0);
    const py = Number.isFinite(player?.y) ? player.y : (sim.player?.y || 0);
    const camX = Math.max(0, Math.min((sim.worldWidth || playW) - playW, px - playW / 2));
    const camY = Math.max(0, Math.min((sim.worldHeight || viewH) - viewH, py - viewH / 2));
    left = Math.min(left, camX - pad);
    top = Math.min(top, camY - pad);
    right = Math.max(right, camX + playW + pad);
    bottom = Math.max(bottom, camY + viewH + pad);
  }
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
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
  return { left, top, right, bottom };
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
  const finalResults =
    source?.finalResults && typeof source.finalResults === "object"
      ? {
          teamOutcome: typeof source.finalResults.teamOutcome === "string" ? source.finalResults.teamOutcome : "Defeat",
          totalParticipants: Number.isFinite(source.finalResults.totalParticipants) ? source.finalResults.totalParticipants : 0,
          players: Array.isArray(source.finalResults.players) ? source.finalResults.players.map((player) => ({ ...player })) : []
        }
      : null;
  return {
    roomPhase: typeof source?.phase === "string" ? source.phase : "active",
    roomOwnerId: typeof source?.roomOwnerId === "string" ? source.roomOwnerId : null,
    pauseOwnerId: typeof source?.pauseOwnerId === "string" ? source.pauseOwnerId : null,
    floor: sim.floor,
    biomeKey: sim.biomeKey,
    level: sim.level,
    score: sim.score,
    gold: sim.gold,
    experience: sim.experience,
    expToNextLevel: sim.expToNextLevel,
    activePlayerCount: sim.activePlayerCount,
    skillPoints: sim.skillPoints,
    hasKey: sim.hasKey,
    gameOver: sim.gameOver,
    gameOverTitle: typeof sim.gameOverTitle === "string" && sim.gameOverTitle ? sim.gameOverTitle : "GAME OVER",
    paused: sim.paused,
    shopOpen: sim.shopOpen,
    skillTreeOpen: sim.skillTreeOpen,
    statsPanelOpen: sim.statsPanelOpen,
    statsPanelView: sim.statsPanelView,
    warriorMomentumTimer: sim.warriorMomentumTimer || 0,
    warriorRageActiveTimer: sim.warriorRageActiveTimer || 0,
    warriorRageCooldownTimer: sim.warriorRageCooldownTimer || 0,
    warriorRageVictoryRushPool: sim.warriorRageVictoryRushPool || 0,
    warriorRageVictoryRushTimer: sim.warriorRageVictoryRushTimer || 0,
    floorBoss,
    runStats: sim.runStats,
    finalResults,
    portal: sim.portal ? { ...sim.portal } : null,
    musicTrack,
    skills: sim.skills,
    rangerTalents: sim.rangerTalents,
    warriorTalents: sim.warriorTalents,
    rangerRuntime: sim.rangerRuntime,
    warriorRuntime: sim.warriorRuntime,
    upgrades: sim.upgrades,
    consumables: sim.consumables,
    shopStock: sim.shopStock
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
  const activePlayers = typeof room.getActivePlayerStates === "function" ? room.getActivePlayerStates() : [];
  const primaryPlayer =
    (typeof room.syncPrimaryActivePlayerFromSim === "function" ? room.syncPrimaryActivePlayerFromSim() : null) ||
    activePlayers[0] ||
    sim.player;
  return {
    mapSignature: typeof sim.getMapSignature === "function" ? sim.getMapSignature() : `${sim.biomeKey}:${sim.floor}:${sim.mapWidth}x${sim.mapHeight}`,
    time: sim.time,
    floor: sim.floor,
    biomeKey: sim.biomeKey,
    floorBoss,
    player: shallowPlayerState(primaryPlayer),
    players: activePlayers.map((player) => shallowActivePlayerState(player)),
    door: { ...sim.door },
    pickup: { ...sim.pickup },
    portal: sim.portal ? { ...sim.portal } : null,
    enemies: activeEnemies.map((e) => serializeEnemy(room, e)),
    drops: activeDrops.map((d) => serializeDrop(room, d)),
    breakables: activeBreakables.map((b) => serializeBreakable(room, b)),
    wallTraps: activeWallTraps.map((t) => serializeWallTrap(room, t)),
    bullets: activeBullets.map((b) => serializeBullet(room, b, "bullet", "b")),
    fireArrows: activeFireArrows.map((a) => serializeBullet(room, a, "fireArrow", "fa")),
    fireZones: activeFireZones.map((z) => ({
      id: getStableId(room, "fireZone", "fz", z),
      x: z.x,
      y: z.y,
      radius: z.radius,
      life: z.life,
      zoneType: typeof z.zoneType === "string" ? z.zoneType : "fire"
    })),
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
