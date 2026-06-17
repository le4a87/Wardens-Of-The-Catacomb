import { createActivePlayerSnapshot, createPlayerSnapshot } from "../../src/net/playerSnapshotSchema.js";
import { serializeTreasureChest } from "./treasureChestSerialization.js";

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
  if (!room.idMaps || typeof room.idMaps !== "object") room.idMaps = {};
  if (!room.idCounters || typeof room.idCounters !== "object") room.idCounters = {};
  if (!room.idMaps[domain]) room.idMaps[domain] = new WeakMap();
  if (!Number.isFinite(room.idCounters[domain])) room.idCounters[domain] = 1;
  const map = room.idMaps[domain];
  if (map.has(obj)) return map.get(obj);
  const id = `${prefix}_${room.idCounters[domain]++}`;
  map.set(obj, id);
  return id;
}

function copyFiniteFields(payload, source, fields) {
  for (const field of fields) {
    if (Number.isFinite(source?.[field])) payload[field] = source[field];
  }
}

function copyStringFields(payload, source, fields) {
  for (const field of fields) {
    if (typeof source?.[field] === "string" && source[field]) payload[field] = source[field];
  }
}

function copyBooleanFields(payload, source, fields) {
  for (const field of fields) {
    if (typeof source?.[field] === "boolean") payload[field] = source[field];
  }
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
  if (Number.isFinite(b.lightRadius)) payload.lightRadius = b.lightRadius;
  if (Number.isFinite(b.lightIntensity)) payload.lightIntensity = b.lightIntensity;
  if (typeof b.projectileType === "string" && b.projectileType !== "bullet") payload.projectileType = b.projectileType;
  copyStringFields(payload, b, ["damageType"]);
  copyFiniteFields(payload, b, ["critMultiplier", "visualLife", "deathBoltRadius"]);
  return payload;
}

function serializeFireZone(room, z) {
  const payload = {
    id: getStableId(room, "fireZone", "fz", z),
    x: z.x,
    y: z.y,
    targetX: z.targetX,
    targetY: z.targetY,
    radius: z.radius,
    lightRadius: z.lightRadius,
    lightIntensity: z.lightIntensity,
    life: z.life,
    totalLife: z.totalLife,
    zoneType: typeof z.zoneType === "string" ? z.zoneType : "fire",
    damageType: typeof z.damageType === "string" ? z.damageType : ""
  };
  copyStringFields(payload, z, ["doctrine", "ownerId"]);
  copyFiniteFields(payload, z, ["size", "strikeAt", "visualLife"]);
  copyBooleanFields(payload, z, ["followOwner"]);
  return payload;
}

function serializeMeleeSwing(room, s) {
  const payload = {
    id: getStableId(room, "meleeSwing", "ms", s),
    x: s.x,
    y: s.y,
    angle: s.angle,
    arc: s.arc,
    range: s.range,
    life: s.life
  };
  copyStringFields(payload, s, ["style", "modifier", "doctrine", "ownerId"]);
  copyFiniteFields(payload, s, ["maxLife"]);
  copyBooleanFields(payload, s, ["executeProc"]);
  return payload;
}

function serializeFloatingTextEvent(event) {
  if (!event || typeof event !== "object" || typeof event.id !== "string" || !event.id) return null;
  const x = Number.isFinite(event.x) ? event.x : null;
  const y = Number.isFinite(event.y) ? event.y : null;
  if (x === null || y === null) return null;
  return {
    id: event.id,
    x,
    y,
    text: String(event.text ?? ""),
    color: typeof event.color === "string" && event.color ? event.color : "#ffffff",
    life: Number.isFinite(event.life) ? event.life : 0.75,
    size: Number.isFinite(event.size) ? event.size : 14,
    vy: Number.isFinite(event.vy) ? event.vy : 22
  };
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
    corpseTimer: e.corpseTimer || 0,
    goldEaten: e.goldEaten || 0,
    variant: typeof e.variant === "string" ? e.variant : null,
    damageMin: e.damageMin,
    damageMax: e.damageMax
  };
  if (e.isControlledUndead) base.isControlledUndead = true;
  if (e.deathProcessed) base.deathProcessed = true;
  if (typeof e.controllerPlayerId === "string" && e.controllerPlayerId) base.controllerPlayerId = e.controllerPlayerId;
  if (Number.isFinite(e.curseTimer) && e.curseTimer > 0) base.curseTimer = e.curseTimer;
  if (Number.isFinite(e.rotTimer) && e.rotTimer > 0) base.rotTimer = e.rotTimer;
  if (Number.isFinite(e.rotDps) && e.rotDps > 0) base.rotDps = e.rotDps;
  if (Number.isFinite(e.burningTimer) && e.burningTimer > 0) base.burningTimer = e.burningTimer;
  if (Number.isFinite(e.burningDps) && e.burningDps > 0) base.burningDps = e.burningDps;
  if (Number.isFinite(e.slowTimer) && e.slowTimer > 0) base.slowTimer = e.slowTimer;
  if (Number.isFinite(e.slowPct) && e.slowPct > 0) base.slowPct = e.slowPct;
  if (Number.isFinite(e.poisonSlowTimer) && e.poisonSlowTimer > 0) base.poisonSlowTimer = e.poisonSlowTimer;
  if (Number.isFinite(e.confusionTimer) && e.confusionTimer > 0) base.confusionTimer = e.confusionTimer;
  if (Number.isFinite(e.confusionImmunityTimer) && e.confusionImmunityTimer > 0) base.confusionImmunityTimer = e.confusionImmunityTimer;
  if (Number.isFinite(e.weakenedTimer) && e.weakenedTimer > 0) base.weakenedTimer = e.weakenedTimer;
  if (Number.isFinite(e.bleedTimer) && e.bleedTimer > 0) base.bleedTimer = e.bleedTimer;
  if (Number.isFinite(e.bleedDps) && e.bleedDps > 0) base.bleedDps = e.bleedDps;
  if (Number.isFinite(e.rangerMarkedTimer) && e.rangerMarkedTimer > 0) base.rangerMarkedTimer = e.rangerMarkedTimer;
  if (typeof e.rangerMarkedBy === "string" && e.rangerMarkedBy) base.rangerMarkedBy = e.rangerMarkedBy;
  if (Number.isFinite(e.tempMageCharmTimer) && e.tempMageCharmTimer > 0) base.tempMageCharmTimer = e.tempMageCharmTimer;
  if (e.dieWhenCharmEnds) base.dieWhenCharmEnds = true;
  if (Number.isFinite(e.burningLightRadius) && e.burningLightRadius > 0) base.burningLightRadius = e.burningLightRadius;
  if (Number.isFinite(e.lightRadius) && e.lightRadius > 0) base.lightRadius = e.lightRadius;
  if (Number.isFinite(e.lightIntensity) && e.lightIntensity > 0) base.lightIntensity = e.lightIntensity;
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
    case "mimic":
      base.dormant = !!e.dormant;
      base.revealed = !!e.revealed;
      base.tongueDirX = e.tongueDirX;
      base.tongueDirY = e.tongueDirY;
      base.tongueLength = e.tongueLength || 0;
      break;
    default:
      break;
  }
  return base;
}

function isFloatingTextNearEnemy(text, enemies) {
  const x = Number.isFinite(text?.x) ? text.x : null;
  const y = Number.isFinite(text?.y) ? text.y : null;
  if (x === null || y === null) return false;
  for (const enemy of Array.isArray(enemies) ? enemies : []) {
    if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) continue;
    const radius = (Number.isFinite(enemy.size) ? enemy.size : 20) + 30;
    if (Math.hypot(enemy.x - x, enemy.y - y) <= radius) return true;
  }
  return false;
}

function serializeFloatingText(room, text, activeEnemies) {
  if (!text || typeof text !== "object" || typeof text.text !== "string" || !text.text) return null;
  if (!Number.isFinite(text.x) || !Number.isFinite(text.y)) return null;
  const isDamageText = text.text.startsWith("-");
  if (isDamageText && isFloatingTextNearEnemy(text, activeEnemies)) return null;
  const id = typeof text.id === "string" && text.id ? text.id : getStableId(room, "floatingText", "ft", text);
  return {
    id,
    x: text.x,
    y: text.y,
    text: text.text,
    color: typeof text.color === "string" && text.color ? text.color : "#ffffff",
    life: Number.isFinite(text.life) ? text.life : 0.75,
    maxLife: Number.isFinite(text.maxLife) ? text.maxLife : Number.isFinite(text.life) ? text.life : 0.75,
    size: Number.isFinite(text.size) ? text.size : 14
  };
}

function serializeDrop(room, d) {
  const payload = {
    id: getStableId(room, "drop", "d", d),
    type: d.type,
    x: d.x,
    y: d.y,
    size: d.size,
    amount: d.amount,
    life: d.life
  };
  copyStringFields(payload, d, ["key", "playerId", "name"]);
  copyFiniteFields(payload, d, ["quantity"]);
  return payload;
}

function serializeOwlDelivery(source) {
  if (!source || typeof source !== "object") return null;
  const active = source.active && typeof source.active === "object"
    ? {
        id: "ticklecorn",
        name: "Veronica",
        x: source.active.x,
        y: source.active.y,
        displayX: source.active.displayX,
        displayY: source.active.displayY,
        destX: source.active.destX,
        destY: source.active.destY,
        hp: source.active.hp,
        maxHp: source.active.maxHp,
        size: source.active.size,
        state: source.active.state,
        waitTimer: source.active.waitTimer,
        portalTimer: source.active.portalTimer,
        slainTimer: source.active.slainTimer,
        portalSlain: !!source.active.portalSlain,
        arrivalNotified: !!source.active.arrivalNotified,
        underAttackTimer: source.active.underAttackTimer,
        orders: Array.isArray(source.active.orders)
          ? source.active.orders.map((order) => ({
              id: order.id,
              playerId: order.playerId,
              key: order.key,
              quantity: order.quantity,
              purchasedAt: order.purchasedAt
            }))
          : [],
        trail: Array.isArray(source.active.trail)
          ? source.active.trail.slice(-48).map((mote) => ({
              x: mote.x,
              y: mote.y,
              vx: mote.vx,
              vy: mote.vy,
              radius: mote.radius,
              sparkle: !!mote.sparkle,
              phase: mote.phase,
              life: mote.life,
              maxLife: mote.maxLife
            }))
          : []
      }
    : null;
  return {
    active,
    pendingCount: Array.isArray(source.pendingOrders) ? source.pendingOrders.length : 0,
    nextDispatchAt: source.nextDispatchAt,
    audioEvents: Array.isArray(source.audioEvents)
      ? source.audioEvents.slice(-12).map((event) => ({ id: event.id, kind: event.kind, at: event.at }))
      : [],
    notificationEvents: Array.isArray(source.notificationEvents)
      ? source.notificationEvents.slice(-12).map((event) => ({ id: event.id, text: event.text, at: event.at }))
      : [],
    lastMarker: source.lastMarker ? { ...source.lastMarker } : null
  };
}

function serializeFlameOfTheFallen(source) {
  if (!source || typeof source !== "object") return null;
  return { active: !!source.active, state: source.state || (source.active ? "charging" : ""), x: source.x, y: source.y, radius: source.radius, timer: source.timer, maxTimer: source.maxTimer, souls: source.souls, requiredSouls: source.requiredSouls, pulseTimer: source.pulseTimer, visualTimer: source.visualTimer, linkedPlayerIds: Array.isArray(source.linkedPlayerIds) ? source.linkedPlayerIds.slice(0, 8) : [] };
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

export function serializeLightSource(room, light) {
  return {
    id: getStableId(room, "lightSource", "ls", light),
    type: typeof light?.type === "string" ? light.type : "light",
    x: light.x,
    y: light.y,
    size: light.size,
    lit: light.lit !== false,
    lightRadius: light.lightRadius,
    snuffCooldown: Number.isFinite(light.snuffCooldown) ? light.snuffCooldown : 0
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
    refundCount: sim.refundCount,
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
    necromancerTalents: sim.necromancerTalents,
    rangerRuntime: sim.rangerRuntime,
    warriorRuntime: sim.warriorRuntime,
    necromancerRuntime: sim.necromancerRuntime,
    upgrades: sim.upgrades,
    consumables: sim.consumables,
    shopStock: sim.shopStock,
    shopRotationEvents: sim.shopRotationEvents || []
  };
}

export function serializeState(room) {
  const sim = room.sim;
  const activeBounds = makeActiveBounds(sim, 8);
  const floorBoss = sim.floorBoss && typeof sim.floorBoss === "object" ? { ...sim.floorBoss } : null;
  const activeEnemies = sim.enemies.filter((e) => isInsideBounds(e, activeBounds, 56));
  const activeDrops = sim.drops.filter((d) => isInsideBounds(d, activeBounds, 40));
  const activeTreasureChests = (sim.treasureChests || []).filter((chest) => chest?.discovered || isInsideBounds(chest, activeBounds, 48));
  const activeBreakables = (sim.breakables || []).filter((b) => isInsideBounds(b, activeBounds, 48));
  const activeWallTraps = (sim.wallTraps || []).filter((t) => isInsideBounds(t, activeBounds, 48));
  const activeBullets = sim.bullets.filter((b) => isInsideBounds(b, activeBounds, 128));
  const activeFireArrows = sim.fireArrows.filter((a) => isInsideBounds(a, activeBounds, 144));
  const activeFireZones = sim.fireZones.filter((z) => isInsideBounds(z, activeBounds, Math.max(Number.isFinite(z.radius) ? z.radius : 0, Number.isFinite(z.lightRadius) ? z.lightRadius : 0) + 28));
  const activeMeleeSwings = sim.meleeSwings.filter((s) => isInsideBounds(s, activeBounds, (Number.isFinite(s.range) ? s.range : 0) + 24));
  const floatingTexts = (Array.isArray(sim.networkFloatingTextEvents) ? sim.networkFloatingTextEvents : [])
    .map((event) => serializeFloatingTextEvent(event))
    .filter(Boolean);
  const activePlayers = typeof room.getActivePlayerStates === "function" ? room.getActivePlayerStates() : [];
  const primaryPlayer = (typeof room.syncPrimaryActivePlayerFromSim === "function" ? room.syncPrimaryActivePlayerFromSim() : null) || activePlayers[0] || sim.player;
  return {
    mapSignature: typeof sim.getMapSignature === "function" ? sim.getMapSignature() : `${sim.biomeKey}:${sim.floor}:${sim.mapWidth}x${sim.mapHeight}`,
    time: sim.time,
    floor: sim.floor,
    biomeKey: sim.biomeKey,
    floorBoss,
    player: createPlayerSnapshot(primaryPlayer),
    players: activePlayers.map((player) => createActivePlayerSnapshot(player)),
    door: { ...sim.door },
    pickup: { ...sim.pickup },
    portal: sim.portal ? { ...sim.portal } : null,
    owlDelivery: serializeOwlDelivery(sim.owlDelivery),
    flameOfTheFallen: serializeFlameOfTheFallen(sim.flameOfTheFallen),
    shopStock: sim.shopStock || [],
    shopRotationEvents: sim.shopRotationEvents || [],
    enemies: activeEnemies.map((e) => serializeEnemy(room, e)),
    drops: activeDrops.map((d) => serializeDrop(room, d)),
    treasureChests: activeTreasureChests.map((chest) => serializeTreasureChest(getStableId, room, chest)),
    lightSources: (sim.lightSources || []).map((light) => serializeLightSource(room, light)),
    breakables: activeBreakables.map((b) => serializeBreakable(room, b)),
    wallTraps: activeWallTraps.map((t) => serializeWallTrap(room, t)),
    bullets: activeBullets.map((b) => serializeBullet(room, b, "bullet", "b")),
    fireArrows: activeFireArrows.map((a) => serializeBullet(room, a, "fireArrow", "fa")),
    fireZones: activeFireZones.map((z) => serializeFireZone(room, z)),
    meleeSwings: activeMeleeSwings.map((s) => serializeMeleeSwing(room, s)),
    floatingTexts
  };
}
