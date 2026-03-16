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
    this.classType =
      options.classType === "fighter" || options.classType === "necromancer"
        ? options.classType
        : "archer";
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
      warriorRage: { key: "warriorRage", label: "Rage", points: 0, maxPoints: 8 },
      warriorExecute: { key: "warriorExecute", label: "Execute", points: 0, maxPoints: 8 },
      undeadMastery: { key: "undeadMastery", label: "Control Mastery", points: 0, maxPoints: 4 },
      deathBolt: { key: "deathBolt", label: "Death Bolt", points: 0, maxPoints: 8 },
      explodingDeath: { key: "explodingDeath", label: "Augment Death", points: 0, maxPoints: 8 }
    };
    this.warriorMomentumTimer = 0;
    this.warriorRageActiveTimer = 0;
    this.warriorRageCooldownTimer = 0;
    this.necromancerBeam = {
      active: false,
      targetId: null,
      targetX: 0,
      targetY: 0,
      progress: 0,
      healTickTimer: 0
    };
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
      deathBoltCooldown: 0,
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
    this.necromancerBeam = {
      active: false,
      targetId: null,
      targetX: 0,
      targetY: 0,
      progress: 0,
      healTickTimer: 0
    };
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
    const controlledUndead = (this.enemies || [])
      .filter((enemy) => enemy?.isControlledUndead && (enemy.hp || 0) > 0 && !(enemy.type === "skeleton_warrior" && enemy.collapsed))
      .map((enemy) => ({ ...enemy }));
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
    if (controlledUndead.length > 0) {
      const tile = this.config.map.tile;
      controlledUndead.forEach((enemy, index) => {
        const ring = 1 + Math.floor(index / 4);
        const angle = (index / Math.max(1, controlledUndead.length)) * Math.PI * 2;
        const spawn = this.findNearestSafePoint(
          this.player.x + Math.cos(angle) * ring * tile * 1.1,
          this.player.y + Math.sin(angle) * ring * tile * 1.1,
          10
        );
        enemy.x = spawn.x;
        enemy.y = spawn.y;
        enemy.lastX = enemy.x;
        enemy.lastY = enemy.y;
        enemy.collapsed = false;
        enemy.collapseTimer = 0;
        enemy.reviveAtEnd = false;
      });
      this.enemies.push(...controlledUndead);
    }
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

  isArcherClass() {
    return this.classType === "archer";
  }

  isWarriorClass() {
    return this.classType === "fighter";
  }

  isNecromancerClass() {
    return this.classType === "necromancer";
  }

  isUndeadEnemy(enemy) {
    return enemy?.type === "ghost" || enemy?.type === "skeleton_warrior";
  }

  isControlledUndead(enemy) {
    return !!enemy?.isControlledUndead;
  }

  isEnemyFriendlyToPlayer(enemy) {
    return this.isControlledUndead(enemy);
  }

  isEnemyHostileToPlayer(enemy) {
    return !!enemy && !this.isEnemyFriendlyToPlayer(enemy);
  }

  getNecromancerControlCap(points = this.skills.undeadMastery.points) {
    const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    const base = Number.isFinite(this.config.necromancer?.baseControlCap) ? this.config.necromancer.baseControlCap : 1;
    return Math.min(5, base + p);
  }

  getNecromancerCharmDuration(points = this.skills.undeadMastery.points) {
    const maxPoints = Number.isFinite(this.skills?.undeadMastery?.maxPoints) ? this.skills.undeadMastery.maxPoints : 4;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const base = Number.isFinite(this.config.necromancer?.charmDuration) ? this.config.necromancer.charmDuration : 2;
    const min = Number.isFinite(this.config.necromancer?.minCharmDuration) ? this.config.necromancer.minCharmDuration : 0.5;
    const denom = Math.log1p(1.2 * Math.max(1, maxPoints));
    const norm = denom > 0 ? Math.log1p(1.2 * Math.min(maxPoints, p)) / denom : 1;
    return base - (base - min) * Math.max(0, Math.min(1, norm));
  }

  getControlledUndeadCount() {
    return (this.enemies || []).filter((enemy) => this.isControlledUndead(enemy) && (enemy.hp || 0) > 0).length;
  }

  getControlledUndeadBoost(points = this.skills.explodingDeath.points) {
    const perRank = Number.isFinite(this.config.necromancer?.petBuffPerRank) ? this.config.necromancer.petBuffPerRank : 0.2;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    return 1 + perRank * p;
  }

  getControlledUndeadDefenseMultiplier(points = this.skills.explodingDeath.points) {
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    return 1.5 + (0.2 * p);
  }

  getOverallAttackModifier() {
    const classBase =
      Number.isFinite(this.classSpec.primaryDamageMin) &&
      Number.isFinite(this.classSpec.primaryDamageMax) &&
      (this.classSpec.primaryDamageMin > 0 || this.classSpec.primaryDamageMax > 0)
        ? (Math.abs(this.classSpec.primaryDamageMin) + Math.abs(this.classSpec.primaryDamageMax)) * 0.5
        : (Number.isFinite(this.config.fireArrow?.impactDamage) ? this.config.fireArrow.impactDamage : 3.2);
    const baseRef = Math.max(0.1, classBase);
    return ((baseRef * this.getDamageMultiplier()) + Math.max(0, this.levelWeaponDamageBonus || 0)) / baseRef;
  }

  getDeathBoltBaseDamage(points = this.skills.deathBolt.points) {
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    return this.getFireArrowImpactDamage(p) * 1.1 * this.getOverallAttackModifier();
  }

  getDeathBoltHealAmount(points = this.skills.deathBolt.points) {
    return this.getDeathBoltBaseDamage(points) * 0.25;
  }

  getNecroticBeamHealAmount(points = this.skills.explodingDeath.points) {
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const base = (Number.isFinite(this.config.necromancer?.healAmount) ? this.config.necromancer.healAmount : 3) * this.getOverallAttackModifier();
    return base * (1 + 0.15 * p);
  }

  getDeathBoltPetDamageMultiplier(points = this.skills.deathBolt.points) {
    const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    if (p < 5) return 1;
    if (p < 7) return 1.5;
    return 2;
  }

  getDeathExplosionDamage(points = this.skills.explodingDeath.points) {
    const p = Number.isFinite(points) ? Math.max(0, points - 2) : 0;
    if (p <= 0) return 0;
    const base = ((this.config.enemy.skeletonWarriorDamageMin || 10) + (this.config.enemy.skeletonWarriorDamageMax || 16)) * 0.5;
    return base * (1 + 0.45 * Math.log1p(1.15 * p));
  }

  getDeathBoltRadius() {
    const tile = this.config.map.tile;
    return (Number.isFinite(this.config.deathBolt?.impactRadiusTiles) ? this.config.deathBolt.impactRadiusTiles : 2) * tile;
  }

  getExplodingDeathRadius() {
    const tile = this.config.map.tile;
    return (Number.isFinite(this.config.explodingDeath?.radiusTiles) ? this.config.explodingDeath.radiusTiles : 3) * tile;
  }

  canControlMoreUndead() {
    return this.getControlledUndeadCount() < this.getNecromancerControlCap();
  }

  applyControlledUndeadBonuses(enemy) {
    if (!enemy || !this.isControlledUndead(enemy)) return enemy;
    const boost = this.getControlledUndeadBoost();
    const baseMaxHp = Number.isFinite(enemy.baseMaxHp) ? enemy.baseMaxHp : enemy.maxHp;
    const baseSpeed = Number.isFinite(enemy.baseSpeed) ? enemy.baseSpeed : enemy.speed;
    const baseMin = Number.isFinite(enemy.baseDamageMin) ? enemy.baseDamageMin : enemy.damageMin;
    const baseMax = Number.isFinite(enemy.baseDamageMax) ? enemy.baseDamageMax : enemy.damageMax;
    enemy.baseMaxHp = baseMaxHp;
    enemy.baseSpeed = baseSpeed;
    enemy.baseDamageMin = baseMin;
    enemy.baseDamageMax = baseMax;
    enemy.maxHp = Math.max(1, baseMaxHp * 3 * boost);
    enemy.hp = Math.min(enemy.maxHp, Number.isFinite(enemy.hp * 3) ? enemy.hp * 3 : enemy.maxHp);
    enemy.speed = Math.max(baseSpeed * boost, this.getPlayerMoveSpeed() * 1.1);
    enemy.damageMin = baseMin * 1.3 * boost;
    enemy.damageMax = baseMax * 1.3 * boost;
    enemy.controlledDefenseMultiplier = this.getControlledUndeadDefenseMultiplier();
    return enemy;
  }

  markUndeadAsControlled(enemy) {
    if (!enemy || !this.isUndeadEnemy(enemy)) return false;
    if (this.isControlledUndead(enemy)) return true;
    if (!this.canControlMoreUndead()) return false;
    enemy.isControlledUndead = true;
    enemy.summonedByPlayer = true;
    enemy.controlledAt = this.time;
    enemy.hpBarTimer = this.config.enemy.hpBarDuration;
    enemy.contactAttackCooldown = 0;
    this.applyControlledUndeadBonuses(enemy);
    return true;
  }

  healControlledUndead(enemy, amount) {
    if (!enemy || !this.isControlledUndead(enemy) || !Number.isFinite(amount) || amount <= 0) return;
    const before = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
    if (enemy.hp > before) {
      enemy.hpBarTimer = this.config.enemy.hpBarDuration;
      this.spawnFloatingText(enemy.x, enemy.y - enemy.size * 0.7, `+${Math.max(1, Math.round(enemy.hp - before))}`, "#89b7ff", 0.8, 13);
    }
  }

  findNearestSafePoint(x, y, maxRadiusTiles = 8) {
    const tile = this.config.map.tile;
    const tx = Math.floor(x / tile);
    const ty = Math.floor(y / tile);
    const isSafe = (cx, cy) => {
      const px = cx * tile + tile * 0.5;
      const py = cy * tile + tile * 0.5;
      if (typeof this.isWalkableTile === "function") return this.isWalkableTile(cx, cy);
      if (typeof this.isWallAt === "function") {
        const r = Math.max(4, tile * 0.3);
        return !this.isWallAt(px - r, py - r, true) && !this.isWallAt(px + r, py - r, true) &&
          !this.isWallAt(px - r, py + r, true) && !this.isWallAt(px + r, py + r, true);
      }
      return true;
    };
    if (isSafe(tx, ty)) return { x: tx * tile + tile * 0.5, y: ty * tile + tile * 0.5 };
    for (let radius = 1; radius <= maxRadiusTiles; radius++) {
      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          if (Math.abs(ox) !== radius && Math.abs(oy) !== radius) continue;
          const cx = tx + ox;
          const cy = ty + oy;
          if (!isSafe(cx, cy)) continue;
          return { x: cx * tile + tile * 0.5, y: cy * tile + tile * 0.5 };
        }
      }
    }
    return { x: this.player.x, y: this.player.y };
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
