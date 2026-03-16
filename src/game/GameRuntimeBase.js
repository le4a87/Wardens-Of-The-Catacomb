import { CONFIG } from "../config.js";
import { clamp } from "../utils.js";
import { createCastleMap } from "../mapGenerator.js";
import { InputController } from "../InputController.js";
import { Renderer } from "../Renderer.js";
import { runtimeBaseDifficultyMethods } from "./runtimeBaseDifficultyMethods.js";
import { runtimeCombatStatsMethods } from "./runtimeCombatStatsMethods.js";
import { runtimeFloorBossMethods } from "./runtimeFloorBossMethods.js";

export class GameRuntimeBase {
  constructor(canvas, options = {}) {
    this.canvas = canvas || {
      width: Number.isFinite(options.viewportWidth) ? options.viewportWidth : 1280,
      height: Number.isFinite(options.viewportHeight) ? options.viewportHeight : 720,
      getContext() {
        return null;
      }
    };
    this.ctx = this.canvas.getContext ? this.canvas.getContext("2d") : null;
    this.config = CONFIG;
    this.classType = options.classType === "fighter" ? "fighter" : "archer";
    this.classSpec = this.config.classes[this.classType] || this.config.classes.archer;
    this.onReturnToMenu = typeof options.onReturnToMenu === "function" ? options.onReturnToMenu : null;
    this.onPauseChanged = typeof options.onPauseChanged === "function" ? options.onPauseChanged : null;
    this.onFloorChanged = typeof options.onFloorChanged === "function" ? options.onFloorChanged : null;
    this.onGameOverChanged = typeof options.onGameOverChanged === "function" ? options.onGameOverChanged : null;
    this.floor = 1;
    this.mapWidth = this.config.map.width;
    this.mapHeight = this.config.map.height;
    this.map = [];
    this.worldWidth = 0;
    this.worldHeight = 0;

    this.score = 0;
    this.gold = 0;
    this.experience = 0;
    this.level = 1;
    this.expToNextLevel = this.config.progression.baseXpToLevel;
    this.hasKey = false;
    this.gameOver = false;
    this.deathTransitionDuration = 7;
    this.deathTransition = {
      active: false,
      elapsed: 0,
      returnTriggered: false
    };
    this.paused = false;
    this.shopOpen = false;
    this.skillTreeOpen = false;
    this.time = 0;
    this.skillPoints = 0;
    this.statsPanelOpen = false;
    this.passiveRegenTimer = 2;
    this.levelWeaponDamageBonus = 0;
    this.floorBoss = this.createFloorBossState(this.floor);
    this.lastFloorBossFeedbackPhase = null;
    this.feedbackAudioContext = null;

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
    this.explored = [];
    this.navDistance = [];
    this.navPlayerTile = { x: -1, y: -1 };
    this.uiRects = {};
    this.uiScroll = { skillTree: 0, shop: 0 };
    this.floatingTexts = [];
    this.skills = {
      fireArrow: { key: "fireArrow", label: "Fire Arrow", points: 0, maxPoints: 8 },
      piercingStrike: { key: "piercingStrike", label: "Piercing Strike", points: 0, maxPoints: 8 },
      multiarrow: { key: "multiarrow", label: "Multiarrow", points: 0, maxPoints: 8 },
      warriorMomentum: { key: "warriorMomentum", label: "Frenzy", points: 0, maxPoints: 8 },
      warriorRage: { key: "warriorRage", label: "Rage", points: 0, maxPoints: 8 }
    };
    this.warriorMomentumTimer = 0;
    this.warriorRageActiveTimer = 0;
    this.warriorRageCooldownTimer = 0;
    this.upgrades = {
      moveSpeed: { key: "moveSpeed", label: "Move Speed", baseCost: 80, costScale: 1.28, level: 0, maxLevel: 20 },
      enemySpawnRate: { key: "enemySpawnRate", label: "Enemy Spawn Rate", baseCost: 60, costScale: 1.25, level: 0, maxLevel: 15 },
      goldFind: { key: "goldFind", label: "Gold Find", baseCost: 90, costScale: 1.3, level: 0, maxLevel: 20 },
      attackSpeed: { key: "attackSpeed", label: "Attack Speed", baseCost: 120, costScale: 1.32, level: 0, maxLevel: 20 },
      damage: { key: "damage", label: "Damage", baseCost: 110, costScale: 1.3, level: 0, maxLevel: 20 },
      defense: { key: "defense", label: "Defense", baseCost: 95, costScale: 1.29, level: 0, maxLevel: 16 }
    };
    this.shopOrder = ["moveSpeed", "enemySpawnRate", "goldFind", "attackSpeed", "damage", "defense"];

    this.player = {
      x: 0,
      y: 0,
      size: 22,
      speed: this.classSpec.baseMoveSpeed,
      health: Number.isFinite(this.classSpec.baseMaxHealth) ? this.classSpec.baseMaxHealth : this.config.player.maxHealth,
      maxHealth: Number.isFinite(this.classSpec.baseMaxHealth) ? this.classSpec.baseMaxHealth : this.config.player.maxHealth,
      fireCooldown: 0,
      fireArrowCooldown: 0,
      dirX: 1,
      dirY: 0,
      facing: 0,
      moving: false,
      animTime: 0,
      hitCooldown: 0,
      hpBarTimer: 0,
      classType: this.classType
    };

    this.door = { x: 0, y: 0, open: false };
    this.pickup = { x: 0, y: 0, taken: false };
    this.portal = { x: 0, y: 0, active: false };

    this.generateFloor(this.mapWidth, this.mapHeight);
    this.renderer = null;
    this.input = null;
    if (!options.headless) {
      this.renderer = new Renderer(this.canvas, this.ctx, this.config);
      this.input = new InputController(this.canvas, () => this.getCamera(), () => this.isActive());
    }
    this.last = typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  isActive() {
    return !this.gameOver && !this.shopOpen && !this.skillTreeOpen && !this.paused;
  }

  getPlayAreaWidth() {
    return this.canvas.width - this.config.hud.sidebarWidth;
  }

  shouldShowPlayerHealthBar() {
    const ratio = this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 0;
    return this.player.hpBarTimer > 0 || ratio <= this.config.player.lowHealthThreshold;
  }

  markPlayerHealthBarVisible() {
    this.player.hpBarTimer = this.config.player.hpBarDuration;
  }

  applyPlayerHealing(amount) {
    if (amount <= 0) return;
    const before = this.player.health;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
    if (this.player.health > before) {
      const healed = this.player.health - before;
      this.markPlayerHealthBarVisible();
      this.spawnFloatingText(this.player.x, this.player.y - 26, `+${Math.max(1, Math.round(healed))}`, "#79e59a", 0.8, 14);
    }
  }

  applyPlayerDamage(amount) {
    if (amount <= 0) return;
    this.spawnFloatingText(this.player.x, this.player.y - 18, `-${Math.round(amount)}`, "#ef6d6d");
    this.player.health = Math.max(0, this.player.health - amount);
    this.markPlayerHealthBarVisible();
    if (this.player.health <= 0) this.triggerGameOver();
  }

  triggerGameOver() {
    if (this.deathTransition.active) return;
    this.gameOver = true;
    this.paused = false;
    this.shopOpen = false;
    this.skillTreeOpen = false;
    this.statsPanelOpen = false;
    this.deathTransition.active = true;
    this.deathTransition.elapsed = 0;
    this.deathTransition.returnTriggered = false;
    if (typeof this.onGameOverChanged === "function") this.onGameOverChanged(true, this);
  }

  updateDeathTransition(dt) {
    if (!this.deathTransition.active) return false;
    this.deathTransition.elapsed = Math.min(
      this.deathTransitionDuration,
      this.deathTransition.elapsed + Math.max(0, Number.isFinite(dt) ? dt : 0)
    );
    if (!this.deathTransition.returnTriggered && this.deathTransition.elapsed >= this.deathTransitionDuration) {
      this.deathTransition.returnTriggered = true;
      if (typeof this.onReturnToMenu === "function") this.onReturnToMenu();
    }
    return true;
  }

  getDeathTransitionProgress() {
    if (!this.deathTransition.active || this.deathTransitionDuration <= 0) return 0;
    return Math.max(0, Math.min(1, this.deathTransition.elapsed / this.deathTransitionDuration));
  }

  spawnFloatingText(x, y, text, color, life = 0.75, size = 14) {
    this.floatingTexts.push({ x, y, text, color, life, maxLife: life, vy: 22, size });
  }

  generateFloor(width, height) {
    this.mapWidth = width;
    this.mapHeight = height;
    this.map = createCastleMap(width, height);
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
    this.warriorMomentumTimer = 0;
    this.warriorRageActiveTimer = 0;
    this.warriorRageCooldownTimer = 0;
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
  }

  advanceToNextFloor() {
    const persisted = {
      gold: this.gold,
      skillPoints: this.skillPoints,
      health: this.player.health,
      maxHealth: this.player.maxHealth
    };
    this.floor += 1;
    const growth = this.config.progression.mapGrowthFactorPerFloor;
    const nextWidth = Math.max(this.mapWidth + 1, Math.floor(this.mapWidth * growth));
    const nextHeight = Math.max(this.mapHeight + 1, Math.floor(this.mapHeight * growth));
    this.generateFloor(nextWidth, nextHeight);
    this.gold = persisted.gold;
    this.skillPoints = persisted.skillPoints;
    this.player.maxHealth = persisted.maxHealth;
    this.player.health = Math.min(this.player.maxHealth, persisted.health);
    if (typeof this.onFloorChanged === "function") this.onFloorChanged(this.floor, this);
  }

  getCamera() {
    const viewportWidth = this.getPlayAreaWidth();
    return {
      x: clamp(this.player.x - viewportWidth / 2, 0, this.worldWidth - viewportWidth),
      y: clamp(this.player.y - this.canvas.height / 2, 0, this.worldHeight - this.canvas.height)
    };
  }

  getPlayerMoveSpeed() {
    return this.classSpec.baseMoveSpeed * this.getMoveSpeedMultiplier() * this.getWarriorMomentumMultiplier();
  }

  getPlayerEnemyCollisionRadius() {
    const size = Number.isFinite(this.config.player.enemyCollisionSize)
      ? this.config.player.enemyCollisionSize
      : this.player.size;
    return Math.max(0, size) * 0.5;
  }

  getTrapDetectionBonus() {
    return 0;
  }

  getActiveBounds(padTiles = 8) {
    const cam = this.getCamera();
    const tile = this.config.map.tile;
    const pad = Math.max(0, padTiles) * tile;
    const playW = this.getPlayAreaWidth();
    return {
      left: cam.x - pad,
      top: cam.y - pad,
      right: cam.x + playW + pad,
      bottom: cam.y + this.canvas.height + pad
    };
  }

  isInsideBounds(x, y, radius = 0, bounds = null) {
    if (!bounds || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
    return x + r >= bounds.left && x - r <= bounds.right && y + r >= bounds.top && y - r <= bounds.bottom;
  }

  getPickupRadius() {
    return this.config.player.pickupRadius;
  }

  isPlayerAtDoor() {
    if (!this.door.open) return false;
    const tileHalf = this.config.map.tile / 2;
    const left = this.door.x - tileHalf;
    const right = this.door.x + tileHalf;
    const top = this.door.y - tileHalf;
    const bottom = this.door.y + tileHalf;
    const px = this.player.x;
    const py = this.player.y;
    const pr = this.player.size * 0.5;
    const closestX = Math.max(left, Math.min(px, right));
    const closestY = Math.max(top, Math.min(py, bottom));
    const dx = px - closestX;
    const dy = py - closestY;
    return dx * dx + dy * dy <= (pr + 4) * (pr + 4);
  }
}

Object.assign(GameRuntimeBase.prototype, runtimeBaseDifficultyMethods);
Object.assign(GameRuntimeBase.prototype, runtimeFloorBossMethods);
Object.assign(GameRuntimeBase.prototype, runtimeCombatStatsMethods);
