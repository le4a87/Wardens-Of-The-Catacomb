import { DEFAULT_BIOME_KEY, getBiomeDefinition, getBiomeKey, mergeBiomeSection } from "../biomes.js";
import { createNecromancerBeamState } from "./runtimeBaseStateFactories.js";
import { createWarriorRuntimeState } from "./runtimeBaseStateFactories.js";

export const runtimeBaseBiomeMethods = {
  resolveFloorBiomeKey(floor = this.floor) {
    const cycle = this.config?.map?.biomeCycle;
    if (Array.isArray(cycle) && cycle.length > 0) {
      const floorIndex = Number.isFinite(floor) ? Math.max(0, Math.floor(floor) - 1) : 0;
      return getBiomeKey(cycle[floorIndex % cycle.length]);
    }
    const configured = this.config?.map?.defaultBiomeKey;
    const fallback = Number.isFinite(floor) ? this.biomeKey : DEFAULT_BIOME_KEY;
    return getBiomeKey(typeof configured === "string" ? configured : fallback);
  },

  setBiomeKey(biomeKey) {
    this.biomeKey = getBiomeKey(biomeKey);
    this.biome = getBiomeDefinition(this.biomeKey);
    return this.biome;
  },

  getCurrentBiome() {
    return this.biome || this.setBiomeKey(this.biomeKey);
  },

  getBiomeAppearance() {
    return this.getCurrentBiome()?.colors || {};
  },

  getCurrentBiomeRules() {
    return this.getCurrentBiome()?.specialRules || {};
  },

  getWallTrapConfig() {
    return mergeBiomeSection(this.config?.traps?.wall || {}, this.getCurrentBiome()?.traps?.wall);
  },

  getBreakablesConfig() {
    return mergeBiomeSection(this.config?.breakables || {}, this.getCurrentBiome()?.breakables);
  },

  getBreakableSpawnTypes() {
    const types = this.getBreakablesConfig()?.types;
    return Array.isArray(types) && types.length > 0 ? types : ["crate", "box"];
  },

  getBreakableMimicSourceTypes() {
    const types = this.getBreakablesConfig()?.mimicSourceTypes;
    return Array.isArray(types) && types.length > 0 ? types : ["box"];
  },

  isBreakablePlacementTile(tile) {
    const allowed = this.getBreakablesConfig()?.allowedTiles;
    if (Array.isArray(allowed) && allowed.length > 0) return allowed.includes(tile);
    return tile === "." || tile === "P" || tile === "D" || tile === "K";
  },

  getRatArcherSpawnChance() {
    const base = Number.isFinite(this.config?.enemy?.ratArcherSpawnChance) ? this.config.enemy.ratArcherSpawnChance : 0;
    const mult = Number.isFinite(this.getCurrentBiomeRules()?.ratArcherSpawnMultiplier) ? this.getCurrentBiomeRules().ratArcherSpawnMultiplier : 1;
    return Math.max(0, base * Math.max(0, mult));
  },

  getMaxActiveRatArchers() {
    const base = Number.isFinite(this.config?.enemy?.maxActiveRatArchers) ? this.config.enemy.maxActiveRatArchers : 0;
    const bonus = Number.isFinite(this.getCurrentBiomeRules()?.ratArcherCapBonus) ? this.getCurrentBiomeRules().ratArcherCapBonus : 0;
    return Math.max(0, base + Math.max(0, Math.floor(bonus)));
  },

  getArmorStandVariant() {
    return this.getCurrentBiomeRules()?.armorStandVariant || null;
  },

  getAnimatedArmorVariant() {
    return this.getCurrentBiomeRules()?.animatedArmorVariant || this.getArmorStandVariant();
  },

  getArmorStandPlacementTiles() {
    const tiles = this.getCurrentBiomeRules()?.armorStandPlacementTiles;
    return Array.isArray(tiles) && tiles.length > 0 ? tiles : null;
  },

  getArmorWakeRadius() {
    const tileSize = this.config?.map?.tile || 32;
    const biomeRadiusTiles = this.getCurrentBiomeRules()?.armorWakeRadiusTiles;
    if (Number.isFinite(biomeRadiusTiles) && biomeRadiusTiles > 0) return biomeRadiusTiles * tileSize;
    return Number.isFinite(this.config?.enemy?.armorWakeRadius) ? this.config.enemy.armorWakeRadius : 260;
  },

  getMapSignature() {
    return `${this.biomeKey}:${this.floor}:${this.mapWidth}x${this.mapHeight}`;
  },

  generateFloor(width, height) {
    this.setBiomeKey(this.resolveFloorBiomeKey(this.floor));
    this.mapWidth = width;
    this.mapHeight = height;
    const biome = this.getCurrentBiome();
    const mapGenerator = typeof biome?.mapGenerator === "function" ? biome.mapGenerator : getBiomeDefinition(DEFAULT_BIOME_KEY).mapGenerator;
    this.map = mapGenerator(width, height, { floor: this.floor, biomeKey: this.biomeKey, biome, game: this });
    this.worldWidth = this.map[0].length * this.config.map.tile;
    this.worldHeight = this.map.length * this.config.map.tile;
    this.explored = Array.from({ length: this.map.length }, () => Array(this.map[0].length).fill(false));
    this.bullets = [];
    this.fireArrows = [];
    this.fireZones = [];
    this.meleeSwings = [];
    this.drops = [];
    this.enemies = [];
    this.armorStands = [];
    this.breakables = [];
    this.wallTraps = [];
    this.enemySpawnTimer = this.config.enemy.spawnIntervalStart;
    this.recentPlayerShots = [];
    this.warriorMomentumTimer = 0;
    this.warriorRageActiveTimer = 0;
    this.warriorRageCooldownTimer = 0;
    this.warriorRageVictoryRushPool = 0;
    this.warriorRageVictoryRushTimer = 0;
    this.warriorRuntime = createWarriorRuntimeState();
    if (this.player) this.player.warriorRuntime = this.warriorRuntime;
    this.necromancerBeam = createNecromancerBeamState();
    this.navDistance = Array.from({ length: this.map.length }, () => Array(this.map[0].length).fill(-1));
    this.navPlayerTile = { x: -1, y: -1 };
    this.hasKey = false;
    this.door = { x: 0, y: 0, open: true };
    this.pickup = { x: 0, y: 0, taken: true };
    this.portal = { x: 0, y: 0, active: false };
    this.floorBoss = this.createFloorBossState(this.floor);
    this.parseMap();
    this.placeArmorStands();
    this.placeWallTraps();
    this.placeBreakables();
    this.ensurePlayerSafePosition(12);
  },

  getMapTileAtWorld(x, y) {
    const tileSize = this.config?.map?.tile || 32;
    const tx = Math.floor(x / tileSize);
    const ty = Math.floor(y / tileSize);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return "#";
    if (ty < 0 || tx < 0 || ty >= this.map.length || tx >= this.map[0].length) return "#";
    return this.map[ty]?.[tx] || "#";
  },

  getPlayerTerrainMoveMultiplier() {
    const tile = this.getMapTileAtWorld(this.player.x, this.player.y);
    if (this.biomeKey === "sewer" && tile === "~") return 0.8;
    return 1;
  }
};
