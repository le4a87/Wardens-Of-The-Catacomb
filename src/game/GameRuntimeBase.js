import { CONFIG } from "../config.js";
import { clamp, directionIndexFromVector } from "../utils.js";
import { createCastleMap } from "../mapGenerator.js";
import { InputController } from "../InputController.js";
import { Renderer } from "../Renderer.js";
import { runtimeBaseDifficultyMethods } from "./runtimeBaseDifficultyMethods.js";

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
    this.paused = false;
    this.shopOpen = false;
    this.skillTreeOpen = false;
    this.time = 0;
    this.skillPoints = 0;
    this.statsPanelOpen = false;
    this.passiveRegenTimer = 2;
    this.levelWeaponDamageBonus = 0;

    this.bullets = [];
    this.fireArrows = [];
    this.fireZones = [];
    this.meleeSwings = [];
    this.drops = [];
    this.enemies = [];
    this.armorStands = [];
    this.breakables = [];
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
    if (this.player.health <= 0) this.gameOver = true;
  }

  spawnFloatingText(x, y, text, color, life = 0.75, size = 14) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life,
      maxLife: life,
      vy: 22,
      size
    });
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
    this.enemySpawnTimer = this.config.enemy.spawnIntervalStart;
    this.warriorMomentumTimer = 0;
    this.warriorRageActiveTimer = 0;
    this.warriorRageCooldownTimer = 0;
    this.navDistance = Array.from({ length: this.map.length }, () => Array(this.map[0].length).fill(-1));
    this.navPlayerTile = { x: -1, y: -1 };
    this.hasKey = false;
    this.door = { x: 0, y: 0, open: false };
    this.pickup = { x: 0, y: 0, taken: false };
    this.parseMap();
    this.placeArmorStands();
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
    // Explicitly preserve progression stats between floors.
    this.gold = persisted.gold;
    this.skillPoints = persisted.skillPoints;
    this.player.maxHealth = persisted.maxHealth;
    this.player.health = Math.min(this.player.maxHealth, persisted.health);
  }

  getCamera() {
    const viewportWidth = this.getPlayAreaWidth();
    return {
      x: clamp(this.player.x - viewportWidth / 2, 0, this.worldWidth - viewportWidth),
      y: clamp(this.player.y - this.canvas.height / 2, 0, this.worldHeight - this.canvas.height)
    };
  }

  getPlayerMoveSpeed() {
    const base = this.classSpec.baseMoveSpeed;
    return base * this.getMoveSpeedMultiplier() * this.getWarriorMomentumMultiplier();
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

  getPlayerFireCooldown() {
    return Math.max(this.classSpec.minAttackCooldown, this.classSpec.baseAttackCooldown / this.getAttackSpeedMultiplier());
  }

  getAttackSpeed() {
    return 1 / this.getPlayerFireCooldown();
  }

  getPrimaryDamage() {
    const range = this.getPrimaryDamageRange();
    return (range.min + range.max) * 0.5;
  }

  getPrimaryDamageRange() {
    const baseMin = Number.isFinite(this.classSpec.primaryDamageMin)
      ? this.classSpec.primaryDamageMin
      : Number.isFinite(this.classSpec.primaryDamage)
      ? this.classSpec.primaryDamage
      : 1;
    const baseMax = Number.isFinite(this.classSpec.primaryDamageMax)
      ? this.classSpec.primaryDamageMax
      : Number.isFinite(this.classSpec.primaryDamage)
      ? this.classSpec.primaryDamage
      : baseMin;
    const minBase = Math.min(baseMin, baseMax);
    const maxBase = Math.max(baseMin, baseMax);
    const rageBaseBonus = this.getActiveWarriorRageBaseDamageBonus();
    const mult = this.getDamageMultiplier();
    const safeMult = Number.isFinite(mult) ? Math.max(0, mult) : 1;
    const flatBonus = Number.isFinite(this.levelWeaponDamageBonus) ? Math.max(0, this.levelWeaponDamageBonus) : 0;
    const scaledMinBase = (minBase + rageBaseBonus) * safeMult;
    const scaledMaxBase = (maxBase + rageBaseBonus) * safeMult;
    return {
      min: scaledMinBase + flatBonus,
      max: scaledMaxBase + flatBonus
    };
  }

  rollPrimaryDamage() {
    const range = this.getPrimaryDamageRange();
    return this.rollRange(range.min, range.max);
  }

  getLifeLeechPercent() {
    const base = Number.isFinite(this.classSpec.baseLifeLeech) ? this.classSpec.baseLifeLeech : 0;
    return Math.max(0, base);
  }

  getProjectileSpeed() {
    const speed = this.classSpec.projectileSpeed;
    if (Number.isFinite(speed) && speed > 0) return speed;
    return this.config.player.projectileSpeed;
  }

  getBowMuzzleOrigin(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const ax = dx / len;
    const ay = dy / len;
    const px = -ay;
    const py = ax;
    // Match the rendered bow grip position in drawPlayerAimingRig so arrows originate visually from the bow center.
    const walkPhase = this.player.moving ? this.player.animTime * this.config.player.animationSpeed * 0.1 : 0;
    const chestYOffset = Math.sin(walkPhase * Math.PI * 2) * 0.9;
    return {
      x: this.player.x + ax * 14 + px * 0.8,
      y: this.player.y - 8 + chestYOffset + ay * 14 + py * 0.8,
      dirX: ax,
      dirY: ay
    };
  }

  getFireArrowBlastRadius(points = this.skills.fireArrow.points) {
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const bonus = 18 * Math.log1p(1.35 * p);
    return this.config.fireArrow.baseBlastRadius + bonus;
  }

  getFireArrowImpactDamage(points = this.skills.fireArrow.points) {
    const p = Number.isFinite(points) ? points : 0;
    const mult = 1 + 0.8 * Math.log1p(1.25 * Math.max(0, p));
    const base = Number.isFinite(this.config.fireArrow.impactDamage) ? this.config.fireArrow.impactDamage : 3.2;
    return base * mult;
  }

  getFireArrowLingerDps(points = this.skills.fireArrow.points) {
    const p = Number.isFinite(points) ? points : 0;
    const mult = 1 + 0.7 * Math.log1p(1.2 * Math.max(0, p));
    const base = Number.isFinite(this.config.fireArrow.lingerDps) ? this.config.fireArrow.lingerDps : 3.6;
    return base * mult;
  }

  getPiercingChance(points = this.skills.piercingStrike.points) {
    const p = Number.isFinite(points) ? points : 0;
    const maxChance = 0.65;
    const scaled = Math.log1p(1.2 * Math.max(0, p)) / Math.log1p(1.2 * this.skills.piercingStrike.maxPoints);
    return maxChance * Math.max(0, Math.min(1, scaled));
  }

  getMultiarrowCount(points = this.skills.multiarrow.points) {
    const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    const maxPoints = Number.isFinite(this.skills?.multiarrow?.maxPoints) ? this.skills.multiarrow.maxPoints : 8;
    const clamped = Math.min(maxPoints, p);
    // 1 arrow base +1 per point purchased.
    return 1 + clamped;
  }

  getMultiarrowDamageMultiplier(points = this.skills.multiarrow.points) {
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const maxPoints = Number.isFinite(this.skills?.multiarrow?.maxPoints) ? this.skills.multiarrow.maxPoints : 8;
    // Modest bonus with diminishing returns (logarithmic curve), maxing near +18%.
    const norm = Math.log1p(1.35 * p) / Math.log1p(1.35 * Math.max(1, maxPoints));
    const bonus = 0.18 * Math.max(0, Math.min(1, norm));
    return 1 + bonus;
  }

  getMultiarrowSpreadDeg(points = this.skills.multiarrow.points) {
    const count = this.getMultiarrowCount(points);
    if (count <= 1) return 0;
    const p = Number.isFinite(points) ? points : 0;
    return 8 + 6.2 * Math.log1p(1.1 * Math.max(0, p));
  }

  isFireArrowUnlocked() {
    return this.skills.fireArrow.points > 0;
  }

  getWarriorMomentumDuration(points = this.skills.warriorMomentum.points) {
    const p = Number.isFinite(points) ? points : 0;
    return 0.85 + 0.9 * Math.log1p(1.2 * Math.max(0, p));
  }

  getWarriorMomentumMoveBonus(points = this.skills.warriorMomentum.points) {
    const p = Number.isFinite(points) ? points : 0;
    return 0.2 + 0.33 * Math.log1p(1.3 * Math.max(0, p));
  }

  getWarriorMomentumMultiplier() {
    if (this.classSpec.usesRanged) return 1;
    if (this.warriorMomentumTimer <= 0) return 1;
    return 1 + this.getWarriorMomentumMoveBonus();
  }

  getWarriorRageDuration() {
    const c = this.config.warriorRage || {};
    return Number.isFinite(c.duration) ? c.duration : 10;
  }

  getWarriorRageCooldown(points = this.skills.warriorRage.points) {
    const c = this.config.warriorRage || {};
    const base = Number.isFinite(c.cooldown) ? c.cooldown : 20;
    const maxReduction = Number.isFinite(c.maxCooldownReductionPct) ? c.maxCooldownReductionPct : 0.4;
    const maxPoints = Number.isFinite(this.skills?.warriorRage?.maxPoints) ? this.skills.warriorRage.maxPoints : 8;
    const p = Math.max(0, Number.isFinite(points) ? points : 0);
    const denom = Math.log1p(1.25 * Math.max(1, maxPoints));
    const norm = denom > 0 ? Math.log1p(1.25 * p) / denom : 0;
    const reduction = Math.max(0, Math.min(1, maxReduction * norm));
    return base * (1 - reduction);
  }

  getWarriorRageBaseDamageBonus(points = this.skills.warriorRage.points) {
    if (this.classSpec.usesRanged) return 0;
    const c = this.config.warriorRage || {};
    const baseBonus = Number.isFinite(c.baseDamageBonus) ? c.baseDamageBonus : 0.3;
    const perPoint = Number.isFinite(c.baseDamageBonusPerPoint) ? c.baseDamageBonusPerPoint : 0.14;
    const p = Math.max(0, Number.isFinite(points) ? points : 0);
    const scaled = Math.log1p(1.2 * p);
    return baseBonus + perPoint * scaled;
  }

  getActiveWarriorRageBaseDamageBonus() {
    if (this.classSpec.usesRanged || this.warriorRageActiveTimer <= 0) return 0;
    return this.getWarriorRageBaseDamageBonus();
  }

  getWarriorRageDamageTaken(rawDamage) {
    if (this.classSpec.usesRanged || this.warriorRageActiveTimer <= 0) return rawDamage;
    const safe = Number.isFinite(rawDamage) ? rawDamage : 0;
    return Math.floor(Math.max(0, safe) * 0.5);
  }

  isWarriorRageUnlocked() {
    return !this.classSpec.usesRanged && (this.skills?.warriorRage?.points || 0) > 0;
  }

  canActivateWarriorRage() {
    if (!this.isWarriorRageUnlocked()) return false;
    if (this.warriorRageActiveTimer > 0) return false;
    return this.warriorRageCooldownTimer <= 0;
  }

  activateWarriorRage() {
    if (!this.canActivateWarriorRage()) return false;
    this.warriorRageActiveTimer = this.getWarriorRageDuration();
    this.warriorRageCooldownTimer = this.getWarriorRageCooldown();
    return true;
  }

  triggerWarriorMomentumOnKill() {
    if (this.classSpec.usesRanged) return;
    if ((this.skills.warriorMomentum.points || 0) <= 0) return;
    this.warriorMomentumTimer = Math.max(this.warriorMomentumTimer, this.getWarriorMomentumDuration());
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
    // Slight padding makes "touching the door" feel reliable.
    return dx * dx + dy * dy <= (pr + 4) * (pr + 4);
  }

  spendSkillPoint(skillKey) {
    const skill = this.skills[skillKey];
    if (!skill) return false;
    if (this.skillPoints <= 0) return false;
    if (skill.points >= skill.maxPoints) return false;
    if (!this.classSpec.usesRanged && (skillKey === "fireArrow" || skillKey === "piercingStrike" || skillKey === "multiarrow")) {
      return false;
    }
    if (this.classSpec.usesRanged && (skillKey === "warriorMomentum" || skillKey === "warriorRage")) {
      return false;
    }
    skill.points += 1;
    this.skillPoints -= 1;
    if (skillKey === "fireArrow" && skill.points === 1) {
      this.spawnFloatingText(this.player.x, this.player.y - 26, "Fire Arrow Unlocked!", "#f6b36a", 1.0, 15);
    }
    if (skillKey === "piercingStrike") {
      this.spawnFloatingText(this.player.x, this.player.y - 26, "Piercing chance increased", "#a7d8ff", 0.85, 14);
    }
    if (skillKey === "multiarrow") {
      this.spawnFloatingText(this.player.x, this.player.y - 26, "Multiarrow improved", "#c3f4a3", 0.85, 14);
    }
    if (skillKey === "warriorMomentum") {
      this.spawnFloatingText(this.player.x, this.player.y - 26, "Frenzy improved", "#ffd089", 0.85, 14);
    }
    if (skillKey === "warriorRage") {
      this.spawnFloatingText(this.player.x, this.player.y - 26, "Rage improved", "#ff8a8a", 0.85, 14);
    }
    return true;
  }

}

Object.assign(GameRuntimeBase.prototype, runtimeBaseDifficultyMethods);
