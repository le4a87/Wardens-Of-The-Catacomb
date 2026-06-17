import { getRangerSelectedPath } from "../rangerTalentTree.js";
import { getWarriorDoctrine } from "../warriorTalentTree.js";

function getTileSize(game) {
  return Number.isFinite(game?.config?.map?.tile) ? game.config.map.tile : 32;
}

function getLightingConfig(game) {
  return game?.config?.lighting && typeof game.config.lighting === "object" ? game.config.lighting : {};
}

function isTorchPlacementTile(tile) {
  return tile !== "#" && tile !== "D" && tile !== "K" && tile !== "P" && tile !== "?";
}

function isNearWall(game, x, y) {
  return (
    game.map[y - 1]?.[x] === "#" ||
    game.map[y + 1]?.[x] === "#" ||
    game.map[y]?.[x - 1] === "#" ||
    game.map[y]?.[x + 1] === "#"
  );
}

function distanceBetween(ax, ay, bx, by) {
  return Math.hypot((ax || 0) - (bx || 0), (ay || 0) - (by || 0));
}

function isWithinDistance(ax, ay, bx, by, distance) {
  const dx = (ax || 0) - (bx || 0);
  const dy = (ay || 0) - (by || 0);
  return dx * dx + dy * dy <= distance * distance;
}

function getLanternMaxFuel(cfg) {
  return Number.isFinite(cfg.lanternMaxFuel) ? Math.max(0, cfg.lanternMaxFuel) : 1;
}

function clampLanternFuel(value, cfg) {
  const maxFuel = getLanternMaxFuel(cfg);
  return Math.max(0, Math.min(maxFuel, Number.isFinite(value) ? value : 0));
}

function ensureLanternFuel(game, player) {
  const cfg = getLightingConfig(game);
  if (!player) return 0;
  if (!Number.isFinite(player.lanternFuel)) {
    player.lanternFuel = clampLanternFuel(cfg.lanternInitialFuel, cfg);
  } else {
    player.lanternFuel = clampLanternFuel(player.lanternFuel, cfg);
  }
  return player.lanternFuel;
}

export function addLanternFuel(game, player, amount) {
  const cfg = getLightingConfig(game);
  if (!player || !Number.isFinite(amount) || amount <= 0) return 0;
  const before = ensureLanternFuel(game, player);
  player.lanternFuel = clampLanternFuel(before + amount, cfg);
  return player.lanternFuel - before;
}

function getRangerFireArrowLightRadius(game, arrow) {
  const cfg = getLightingConfig(game);
  if (!arrow || (arrow.life ?? 0) <= 0) return 0;
  if (Number.isFinite(arrow.lightRadius)) return Math.max(0, arrow.lightRadius);
  const tile = getTileSize(game);
  const radiusTiles = Number.isFinite(cfg.fireArrowProjectileRadiusTiles) ? cfg.fireArrowProjectileRadiusTiles : 2.25;
  return Math.max(0, radiusTiles * tile);
}

function getRangerFireZoneLightRadius(game, zone) {
  const cfg = getLightingConfig(game);
  if (!zone || (zone.life ?? 0) <= 0) return 0;
  if (zone.zoneType !== "fire" && zone.zoneType !== "pinningFire") return 0;
  if (Number.isFinite(zone.lightRadius)) return Math.max(0, zone.lightRadius);
  const tile = getTileSize(game);
  const multiplier = Number.isFinite(cfg.fireZoneRadiusMultiplier) ? Math.max(0, cfg.fireZoneRadiusMultiplier) : 1.35;
  const minRadiusTiles = Number.isFinite(cfg.fireZoneMinRadiusTiles) ? Math.max(0, cfg.fireZoneMinRadiusTiles) : 1.5;
  const baseRadius = Number.isFinite(zone.radius) ? Math.max(0, zone.radius) * multiplier : 0;
  return Math.max(baseRadius, minRadiusTiles * tile);
}

function getBurningEnemyLightRadius(game, enemy) {
  const cfg = getLightingConfig(game);
  if (!enemy || (enemy.hp ?? 0) <= 0 || (enemy.burningTimer || 0) <= 0) return 0;
  if (Number.isFinite(enemy.burningLightRadius)) return Math.max(0, enemy.burningLightRadius);
  const tile = getTileSize(game);
  const radiusTiles = Number.isFinite(cfg.burningEnemyRadiusTiles) ? cfg.burningEnemyRadiusTiles : 3.25;
  return Math.max(0, radiusTiles * tile);
}

function getFireLightOptions(game) {
  const cfg = getLightingConfig(game);
  return {
    lightDecay: Number.isFinite(cfg.fireLightFalloffDecay) ? Math.max(0.5, cfg.fireLightFalloffDecay) : 1.45,
    brightRadiusRatio: Number.isFinite(cfg.fireLightBrightRadiusRatio) ? Math.max(0.05, Math.min(0.95, cfg.fireLightBrightRadiusRatio)) : 0.42,
    dimRadiusRatio: Number.isFinite(cfg.fireLightDimRadiusRatio) ? Math.max(0.05, Math.min(1, cfg.fireLightDimRadiusRatio)) : 0.94
  };
}

function getFlashLightOptions(game) {
  const cfg = getLightingConfig(game);
  return {
    lightDecay: Number.isFinite(cfg.flashLightFalloffDecay) ? Math.max(0.5, cfg.flashLightFalloffDecay) : 1.05,
    brightRadiusRatio: Number.isFinite(cfg.flashLightBrightRadiusRatio) ? Math.max(0.05, Math.min(0.95, cfg.flashLightBrightRadiusRatio)) : 0.62,
    dimRadiusRatio: Number.isFinite(cfg.flashLightDimRadiusRatio) ? Math.max(0.05, Math.min(1, cfg.flashLightDimRadiusRatio)) : 0.98
  };
}

function getBeastMasterDarkVisionRadius(game, player) {
  if (!player || player.classType !== "archer") return 0;
  const pathSource = player === game?.player ? game : player;
  if (getRangerSelectedPath(pathSource) !== "beastMasterPath") return 0;
  const cfg = getLightingConfig(game);
  const tile = getTileSize(game);
  const radiusTiles = Number.isFinite(cfg.beastMasterDarkVisionTiles) ? Math.max(0, cfg.beastMasterDarkVisionTiles) : 1;
  return radiusTiles * tile;
}

function getProjectileLightRadius(projectile) {
  if (!projectile || (projectile.life ?? 0) <= 0) return 0;
  if (Number.isFinite(projectile.lightRadius)) return Math.max(0, projectile.lightRadius);
  return 0;
}

function getZoneLightRadius(zone) {
  if (!zone || (zone.life ?? 0) <= 0) return 0;
  if (Number.isFinite(zone.lightRadius)) return Math.max(0, zone.lightRadius);
  if (zone.zoneType === "arcaneChain" && zone.damageType === "lightning") return 32 * 1.6;
  return 0;
}

function getZoneLightOptions(game, zone) {
  if (zone?.zoneType === "arcaneChain" && zone.damageType === "lightning") {
    return {
      lightDecay: 1.35,
      brightRadiusRatio: 0.24,
      dimRadiusRatio: 0.95
    };
  }
  if (zone?.zoneType === "stormcallerFlash") {
    const cfg = getLightingConfig(game);
    return {
      lightDecay: Number.isFinite(cfg.stormcallerFlashLightFalloffDecay) ? Math.max(0.1, cfg.stormcallerFlashLightFalloffDecay) : 0.65,
      brightRadiusRatio: Number.isFinite(cfg.stormcallerFlashLightBrightRadiusRatio) ? Math.max(0.05, Math.min(0.95, cfg.stormcallerFlashLightBrightRadiusRatio)) : 0.18,
      dimRadiusRatio: Number.isFinite(cfg.stormcallerFlashLightDimRadiusRatio) ? Math.max(0.05, Math.min(1, cfg.stormcallerFlashLightDimRadiusRatio)) : 1
    };
  }
  return getFlashLightOptions(game);
}

function getPortalLightRadius(game) {
  const cfg = getLightingConfig(game);
  const tile = getTileSize(game);
  const radiusTiles = Number.isFinite(cfg.portalRadiusTiles) ? Math.max(0, cfg.portalRadiusTiles) : 3;
  return radiusTiles * tile;
}

function getPortalLightOptions(game) {
  const cfg = getLightingConfig(game);
  return {
    lightIntensity: Number.isFinite(cfg.portalLightPower) ? Math.max(0, cfg.portalLightPower) : 0.35,
    lightDecay: Number.isFinite(cfg.portalLightFalloffDecay) ? Math.max(0.1, cfg.portalLightFalloffDecay) : 0.75,
    brightRadiusRatio: Number.isFinite(cfg.portalLightBrightRadiusRatio) ? Math.max(0.05, Math.min(0.95, cfg.portalLightBrightRadiusRatio)) : 0.2,
    dimRadiusRatio: Number.isFinite(cfg.portalLightDimRadiusRatio) ? Math.max(0.05, Math.min(1, cfg.portalLightDimRadiusRatio)) : 1
  };
}

function getOwlDeliveryLightOptions() {
  return {
    lightIntensity: 0.28,
    lightDecay: 0.85,
    brightRadiusRatio: 0.18,
    dimRadiusRatio: 1
  };
}

function decayLanternFuel(game, players, dt) {
  const cfg = getLightingConfig(game);
  const decay = Number.isFinite(cfg.lanternFuelDecayPerSecond) ? Math.max(0, cfg.lanternFuelDecayPerSecond) : 0;
  if (decay <= 0 || dt <= 0) return;
  for (const player of players) {
    if (!player) continue;
    const doctrineSource = player === game?.player ? game : player;
    const decayMultiplier = player.classType === "fighter" && getWarriorDoctrine(doctrineSource) === "gladiator"
      ? (Number.isFinite(cfg.gladiatorLanternDecayMultiplier) ? Math.max(0, cfg.gladiatorLanternDecayMultiplier) : 0.9)
      : 1;
    player.lanternFuel = clampLanternFuel(ensureLanternFuel(game, player) - decay * decayMultiplier * dt, cfg);
  }
}

export function placeTorches(game) {
  const cfg = getLightingConfig(game);
  if (!game || cfg.enabled === false || !Array.isArray(game.map) || game.map.length === 0) return [];
  const tile = getTileSize(game);
  const mapH = game.map.length;
  const mapW = game.map[0]?.length || 0;
  const candidates = [];
  const reserved = [game.player, game.door, game.pickup, game.portal, ...(game.treasureChests || [])].filter(Boolean);
  const minReservedDistance = tile * 2.5;
  const minPlayerDistance = tile * 6;

  for (let y = 2; y < mapH - 2; y++) {
    for (let x = 2; x < mapW - 2; x++) {
      const mapTile = game.map[y]?.[x];
      if (!isTorchPlacementTile(mapTile)) continue;
      if (typeof game.isWalkableTile === "function" && !game.isWalkableTile(x, y)) continue;
      if (!isNearWall(game, x, y)) continue;
      const wx = x * tile + tile * 0.5;
      const wy = y * tile + tile * 0.5;
      if (game.player && distanceBetween(wx, wy, game.player.x, game.player.y) < minPlayerDistance) continue;
      if (reserved.some((obj) => Number.isFinite(obj.x) && Number.isFinite(obj.y) && distanceBetween(wx, wy, obj.x, obj.y) < minReservedDistance)) continue;
      candidates.push({ x: wx, y: wy });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const countFactor = Number.isFinite(cfg.torchCountFactor) ? Math.max(1, cfg.torchCountFactor) : 180;
  const maxTorches = Number.isFinite(cfg.maxTorches) ? Math.max(0, Math.floor(cfg.maxTorches)) : 80;
  const target = Math.min(maxTorches, Math.max(0, Math.floor((mapW * mapH) / countFactor)));
  const radiusTiles = Number.isFinite(cfg.torchRadiusTiles) ? cfg.torchRadiusTiles : 4.5;
  const lightRadius = Math.max(0, radiusTiles * tile);
  const size = Math.max(10, tile * 0.5);
  game.lightSources = [];
  for (let i = 0; i < Math.min(target, candidates.length); i++) {
    const c = candidates[i];
    game.lightSources.push({
      id: `torch-${game.floor || 1}-${i}`,
      type: "torch",
      x: c.x,
      y: c.y,
      size,
      lit: true,
      lightRadius,
      snuffCooldown: 0
    });
  }
  return game.lightSources;
}

export function getPlayerLightRadius(game, player = game?.player) {
  const cfg = getLightingConfig(game);
  const tile = getTileSize(game);
  if (cfg.enabled === false || !player) return 0;
  if (Number.isFinite(player.lightRadius)) return Math.max(0, player.lightRadius);
  const baseTiles = Number.isFinite(cfg.playerBaseRadiusTiles) ? Math.max(0, cfg.playerBaseRadiusTiles) : 0;
  const fuelRadiusTiles = Number.isFinite(cfg.playerFuelRadiusTiles) ? Math.max(0, cfg.playerFuelRadiusTiles) : 0;
  const maxFuel = getLanternMaxFuel(cfg);
  const fuelRatio = maxFuel > 0 ? ensureLanternFuel(game, player) / maxFuel : 0;
  const perLevelTiles = Number.isFinite(cfg.playerRadiusPerLevelTiles) ? cfg.playerRadiusPerLevelTiles : 0;
  const level = Number.isFinite(player.level) ? player.level : Number.isFinite(game?.level) ? game.level : 1;
  const itemBonusTiles = Number.isFinite(player.lightRadiusBonusTiles) ? player.lightRadiusBonusTiles : 0;
  const fullFuelRadiusTiles = baseTiles + fuelRadiusTiles + perLevelTiles * Math.max(0, level - 1) + itemBonusTiles;
  const radiusTiles = fullFuelRadiusTiles * fuelRatio;
  const darkvisionTiles = player === game?.player && (game?.consumables?.effects?.darkvisionPotion?.timer || 0) > 0 ? 10 : 0;
  const darkvisionRadius = darkvisionTiles * tile;
  return Math.max(darkvisionRadius, Math.max(0, radiusTiles * tile + getBeastMasterDarkVisionRadius(game, player)));
}

export function getEnemyLightRadius(game, enemy) {
  const cfg = getLightingConfig(game);
  if (cfg.enabled === false || !enemy || (enemy.hp || 0) <= 0) return 0;
  if (Number.isFinite(enemy.lightRadius)) return Math.max(0, enemy.lightRadius);
  return 0;
}

export function getActiveLightSources(game) {
  const cfg = getLightingConfig(game);
  if (cfg.enabled === false || !game) return [];
  const sources = [];
  const addSource = (source, sourceType, radius, options = null) => {
    if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.y) || !Number.isFinite(radius) || radius <= 0) return;
    sources.push({
      id: source.id || null,
      sourceType,
      x: source.x,
      y: source.y,
      radius,
      entityType: source.type || source.zoneType || null,
      lightIntensity: Number.isFinite(source.lightIntensity) ? Math.max(0, source.lightIntensity) : 1,
      ...(options && typeof options === "object" ? options : {})
    });
  };

  const players = typeof game.getLivingPlayerEntities === "function" ? game.getLivingPlayerEntities() : [game.player];
  for (const player of Array.isArray(players) ? players : []) {
    addSource(player, "player", getPlayerLightRadius(game, player));
  }

  for (const light of Array.isArray(game.lightSources) ? game.lightSources : []) {
    if (!light || light.lit === false) continue;
    const radius = Number.isFinite(light.lightRadius) ? light.lightRadius : 0;
    addSource(light, light.type || "light", radius);
  }

  if (game.portal?.active) {
    addSource({ ...game.portal, type: "exitPortal" }, "exitPortal", getPortalLightRadius(game), getPortalLightOptions(game));
  }

  const flame = game.flameOfTheFallen;
  if (flame?.active) {
    addSource({ id: "flame-of-the-fallen", type: "flameOfTheFallen", x: flame.x, y: flame.y }, "flameOfTheFallen", getTileSize(game) * 6, getFireLightOptions(game));
  }

  const owl = game.owlDelivery?.active;
  if (owl && owl.state !== "portal") {
    const x = Number.isFinite(owl.displayX) ? owl.displayX : owl.x;
    const y = Number.isFinite(owl.displayY) ? owl.displayY : owl.y;
    addSource({ id: owl.id || "veronica", type: "veronica", x, y }, "veronica", getTileSize(game) * 2, getOwlDeliveryLightOptions());
  }

  for (const arrow of Array.isArray(game.fireArrows) ? game.fireArrows : []) {
    addSource(arrow, "rangerFireArrow", getRangerFireArrowLightRadius(game, arrow), getFireLightOptions(game));
  }

  for (const projectile of Array.isArray(game.bullets) ? game.bullets : []) {
    addSource(projectile, projectile.projectileType || "projectile", getProjectileLightRadius(projectile), getFlashLightOptions(game));
  }

  for (const zone of Array.isArray(game.fireZones) ? game.fireZones : []) {
    addSource(zone, "rangerFireZone", getRangerFireZoneLightRadius(game, zone), getFireLightOptions(game));
    addSource(zone, zone.zoneType || "zone", getZoneLightRadius(zone), getZoneLightOptions(game, zone));
    if (zone.zoneType === "arcaneChain" && Number.isFinite(zone.targetX) && Number.isFinite(zone.targetY)) {
      addSource(
        { id: zone.id ? `${zone.id}:target` : null, type: zone.zoneType, x: zone.targetX, y: zone.targetY },
        zone.zoneType,
        getZoneLightRadius(zone),
        getFlashLightOptions(game)
      );
    }
  }

  for (const enemy of Array.isArray(game.enemies) ? game.enemies : []) {
    addSource(enemy, "enemy", getEnemyLightRadius(game, enemy), enemy?.type === "flaming_sphere" ? getFireLightOptions(game) : null);
    addSource(enemy, "burningEnemy", getBurningEnemyLightRadius(game, enemy), getFireLightOptions(game));
  }

  const wispState = game.spectatorWispRenderState && typeof game.spectatorWispRenderState === "object" ? game.spectatorWispRenderState : null;
  if (wispState) {
    const tile = getTileSize(game);
    for (const [id, wisp] of Object.entries(wispState)) {
      if (!wisp || !Number.isFinite(wisp.x) || !Number.isFinite(wisp.y) || !Number.isFinite(wisp.alpha) || wisp.alpha <= 0.01) continue;
      addSource(
        {
          id: `spectatorWisp:${id}`,
          type: "spectatorWisp",
          x: wisp.x,
          y: wisp.y,
          lightIntensity: 0.1 * Math.max(0, Math.min(1, wisp.alpha))
        },
        "spectatorWisp",
        tile * 2.4,
        { lightDecay: 3.8, brightRadiusRatio: 0.22, dimRadiusRatio: 0.72 }
      );
    }
  }

  return sources;
}

export function updateLightingInteractions(game, dt = 0) {
  const cfg = getLightingConfig(game);
  if (!game || cfg.enabled === false) return;
  const tile = getTileSize(game);
  const touchDistance = (Number.isFinite(cfg.touchDistanceTiles) ? Math.max(0, cfg.touchDistanceTiles) : 0.75) * tile;
  const elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const players = typeof game.getLivingPlayerEntities === "function" ? game.getLivingPlayerEntities() : [game.player];
  const livingPlayers = (Array.isArray(players) ? players : []).filter((player) => player && (player.health ?? 1) > 0);
  for (const player of livingPlayers) ensureLanternFuel(game, player);
  decayLanternFuel(game, livingPlayers, elapsed);
  tickHolyCandles(game, livingPlayers, elapsed);
  if (!Array.isArray(game.lightSources) || game.lightSources.length === 0) return;
  const interval = Math.max(0, Number.isFinite(cfg.interactionInterval) ? cfg.interactionInterval : 0.25);
  const state = game._lightingInteractionState && typeof game._lightingInteractionState === "object"
    ? game._lightingInteractionState
    : { timer: 0, elapsed: 0, sourceRef: null };
  state.elapsed += elapsed;
  const sourceChanged = state.sourceRef !== game.lightSources;
  const hasRelightCandidate = game.lightSources.some((light) => {
    if (!light || light.type !== "torch" || light.lit !== false) return false;
    const torchRadius = Math.max(0, Number.isFinite(light.size) ? light.size * 0.5 : tile * 0.25);
    return livingPlayers.some((player) => {
      const playerRadius = Number.isFinite(player.size) ? Math.max(0, player.size * 0.5) : 0;
      return isWithinDistance(player.x, player.y, light.x, light.y, touchDistance + torchRadius + playerRadius);
    });
  });
  state.sourceRef = game.lightSources;
  if (!sourceChanged && !hasRelightCandidate && state.timer > 0) {
    state.timer = Math.max(0, state.timer - elapsed);
    game._lightingInteractionState = state;
    return;
  }
  const interactionElapsed = Math.max(elapsed, state.elapsed);
  state.elapsed = 0;
  state.timer = interval;
  game._lightingInteractionState = state;
  const snuffCooldown = Number.isFinite(cfg.torchSnuffCooldown) ? Math.max(0, cfg.torchSnuffCooldown) : 1;
  const snuffers = (Array.isArray(game.enemies) ? game.enemies : []).filter((enemy) =>
    enemy &&
    enemy.snuffsTorches === true &&
    (enemy.hp ?? 1) > 0 &&
    !(enemy.type === "skeleton_warrior" && enemy.collapsed)
  );

  for (const light of game.lightSources) {
    if (!light || light.type !== "torch") continue;
    light.snuffCooldown = Math.max(0, (Number.isFinite(light.snuffCooldown) ? light.snuffCooldown : 0) - interactionElapsed);
    const torchRadius = Math.max(0, Number.isFinite(light.size) ? light.size * 0.5 : tile * 0.25);
    if (light.lit !== false && light.snuffCooldown <= 0) {
      const touchedBySnuffer = snuffers.some((enemy) => {
        const enemyRadius = Number.isFinite(enemy.size) ? Math.max(0, enemy.size * 0.5) : 0;
        return isWithinDistance(enemy.x, enemy.y, light.x, light.y, touchDistance + torchRadius + enemyRadius);
      });
      if (touchedBySnuffer) {
        light.lit = false;
        light.snuffCooldown = snuffCooldown;
        if (typeof game.spawnFloatingText === "function") {
          game.spawnFloatingText(light.x, light.y - tile * 0.45, "Snuffed", "#9ba7bd", 0.7, 13);
        }
        continue;
      }
    }
    if (light.lit !== false && light.snuffCooldown <= 0) {
      const collectingPlayer = livingPlayers.find((player) => {
        const playerRadius = Number.isFinite(player.size) ? Math.max(0, player.size * 0.5) : 0;
        return isWithinDistance(player.x, player.y, light.x, light.y, touchDistance + torchRadius + playerRadius);
      });
      if (collectingPlayer) {
        const gained = addLanternFuel(game, collectingPlayer, cfg.lanternFuelPerTorch);
        light.collected = true;
        light.lit = false;
        if (typeof game.spawnFloatingText === "function") {
          const label = gained > 0 ? "Lantern +" : "Lantern Full";
          game.spawnFloatingText(light.x, light.y - tile * 0.45, label, "#ffd978", 0.75, 13);
        }
        continue;
      }
    }
    if (light.lit !== false) continue;
    const touchedByPlayer = livingPlayers.some((player) => {
      const playerRadius = Number.isFinite(player.size) ? Math.max(0, player.size * 0.5) : 0;
      return isWithinDistance(player.x, player.y, light.x, light.y, touchDistance + torchRadius + playerRadius);
    });
    if (!touchedByPlayer) continue;
    light.lit = true;
    light.snuffCooldown = 0;
    if (typeof game.spawnFloatingText === "function") {
      game.spawnFloatingText(light.x, light.y - tile * 0.45, "Relit", "#ffd978", 0.7, 13);
    }
  }
  game.lightSources = game.lightSources.filter((light) => !light?.collected && (light.type !== "holyCandle" || (light.life || 0) > 0));
}

function tickHolyCandles(game, livingPlayers, dt) {
  if (!Array.isArray(game.lightSources) || game.lightSources.length === 0 || dt <= 0) return;
  for (const light of game.lightSources) {
    if (!light || light.type !== "holyCandle") continue;
    light.life = Math.max(0, (Number.isFinite(light.life) ? light.life : 10) - dt);
    light.healTick = (Number.isFinite(light.healTick) ? light.healTick : 1) - dt;
    if (light.life <= 0 || light.healTick > 0) continue;
    light.healTick += 1;
    const radius = Number.isFinite(light.lightRadius) ? light.lightRadius : getTileSize(game) * 3;
    for (const player of livingPlayers) {
      if (!player || distanceBetween(player.x, player.y, light.x, light.y) > radius) continue;
      const amount = (Number.isFinite(player.maxHealth) ? player.maxHealth : 0) * (Number.isFinite(light.healPctPerSecond) ? light.healPctPerSecond : 0.05);
      if (typeof game.applyHealingToPlayerEntity === "function") game.applyHealingToPlayerEntity(player, amount, { suppressText: true });
      else if (player === game.player && typeof game.applyPlayerHealing === "function") game.applyPlayerHealing(amount, { suppressText: true });
    }
  }
}
