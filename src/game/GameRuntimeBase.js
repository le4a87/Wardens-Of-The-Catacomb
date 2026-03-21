import { CONFIG } from "../config.js";
import { clamp } from "../utils.js";
import { createCastleMap } from "../mapGenerator.js";
import { InputController } from "../InputController.js";
import { Renderer } from "../Renderer.js";
import { runtimeBasePlacementMethods } from "./runtimeBasePlacementMethods.js";
import { runtimeBaseSupportMethods } from "./runtimeBaseSupportMethods.js";
import { runtimeBaseDifficultyMethods } from "./runtimeBaseDifficultyMethods.js";
import { runtimeCombatStatsMethods } from "./runtimeCombatStatsMethods.js";
import { runtimeFloorBossMethods } from "./runtimeFloorBossMethods.js";
import { createNecromancerBeamState, createPlayerState, createSkillState, createUpgradeState } from "./runtimeBaseStateFactories.js";

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
    this.activePlayerCount = 1;
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
    this.recentPlayerShots = [];
    this.skills = createSkillState();
    this.warriorMomentumTimer = 0;
    this.warriorRageActiveTimer = 0;
    this.warriorRageCooldownTimer = 0;
    this.warriorRageVictoryRushPool = 0;
    this.warriorRageVictoryRushTimer = 0;
    this.necromancerBeam = createNecromancerBeamState();
    this.upgrades = createUpgradeState();
    this.shopOrder = ["moveSpeed", "attackSpeed", "damage", "defense"];

    this.player = createPlayerState(this.classType, this.classSpec, this.config.player.maxHealth);

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

  applyPlayerHealing(amount, options = {}) {
    if (amount <= 0) return;
    const suppressText = !!options.suppressText;
    const before = this.player.health;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
    if (this.player.health > before) {
      const healed = this.player.health - before;
      this.markPlayerHealthBarVisible();
      if (!suppressText) {
        this.spawnFloatingText(this.player.x, this.player.y - 26, `+${Math.max(1, Math.round(healed))}`, "#79e59a", 0.8, 14);
      }
    }
  }

  getHealthPickupAmount() {
    const pct = Number.isFinite(this.config?.drops?.healthRestorePct) ? this.config.drops.healthRestorePct : 0.25;
    return Math.max(1, Math.round(this.player.maxHealth * Math.max(0, pct)));
  }

  applyPlayerDamage(amount) {
    if (amount <= 0) return;
    this.spawnFloatingText(this.player.x, this.player.y - 18, `-${Math.round(amount)}`, "#ef6d6d");
    this.player.health = Math.max(0, this.player.health - amount);
    this.markPlayerHealthBarVisible();
    if (this.player.health <= 0) this.triggerGameOver();
  }

  applyPlayerKnockback(distance, dirX, dirY) {
    if (!Number.isFinite(distance) || distance <= 0) return;
    const len = clamp(Math.hypot(dirX || 0, dirY || 0), 0, Number.POSITIVE_INFINITY) || 1;
    const nx = (dirX || 0) / len;
    const ny = (dirY || 0) / len;
    const duration = Math.max(0.08, Number.isFinite(this.config?.enemy?.leprechaunPunchKnockbackDuration) ? this.config.enemy.leprechaunPunchKnockbackDuration : 0.28);
    this.player.knockbackVx = (distance / duration) * nx;
    this.player.knockbackVy = (distance / duration) * ny;
    this.player.knockbackTimer = duration;
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
    this.recentPlayerShots = [];
    this.warriorMomentumTimer = 0;
    this.warriorRageActiveTimer = 0;
    this.warriorRageCooldownTimer = 0;
    this.warriorRageVictoryRushPool = 0;
    this.warriorRageVictoryRushTimer = 0;
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
    const nextMapSize = this.getMapSizeForFloor(this.floor);
    const nextWidth = nextMapSize.width;
    const nextHeight = nextMapSize.height;
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

  getMinimumLevelForFloorStart(floor = this.floor) {
    const safeFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    if (safeFloor <= 1) return 1;
    return this.getFloorBossTriggerLevel(safeFloor - 1);
  }

  applyDebugStartingFloor(floor = 1) {
    const safeFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    const targetLevel = this.getMinimumLevelForFloorStart(safeFloor);
    this.floor = safeFloor;
    this.level = 1;
    this.experience = 0;
    this.expToNextLevel = this.config.progression.baseXpToLevel;
    this.skillPoints = 0;
    this.gold = 0;
    this.score = 0;
    this.levelWeaponDamageBonus = 0;
    this.player.maxHealth = Number.isFinite(this.classSpec.baseMaxHealth) ? this.classSpec.baseMaxHealth : this.config.player.maxHealth;
    this.player.health = this.player.maxHealth;
    this.player.fireCooldown = 0;
    this.player.fireArrowCooldown = 0;
    this.player.deathBoltCooldown = 0;
    this.player.hitCooldown = 0;
    this.player.hpBarTimer = 0;
    while (this.level < targetLevel) {
      this.gainExperience(this.expToNextLevel);
    }
    this.experience = 0;
    this.floatingTexts = [];

    const nextMapSize = this.getMapSizeForFloor(safeFloor);
    this.generateFloor(nextMapSize.width, nextMapSize.height);
    this.syncFloorBossState();
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
    const levelBonus = Number.isFinite(this.classSpec.levelMoveSpeedGain) ? Math.max(0, this.classSpec.levelMoveSpeedGain) * Math.max(0, this.level - 1) : 0;
    return (this.classSpec.baseMoveSpeed + levelBonus) * this.getMoveSpeedMultiplier() * this.getWarriorMomentumMultiplier();
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
    const skillDuration = base - (base - min) * Math.max(0, Math.min(1, norm));
    const levelReductionPct = Number.isFinite(this.classSpec.levelCharmTimeReductionPct)
      ? Math.max(0, this.classSpec.levelCharmTimeReductionPct) * Math.max(0, this.level - 1)
      : 0;
    return Math.max(min, skillDuration * Math.max(0.35, 1 - levelReductionPct));
  }

  getControlledUndeadCount() {
    return (this.enemies || []).filter((enemy) => this.isControlledUndead(enemy) && (enemy.hp || 0) > 0).length;
  }

  getControlledUndeadBoost(points = this.skills.explodingDeath.points) {
    const perRank = Number.isFinite(this.config.necromancer?.petBuffPerRank) ? this.config.necromancer.petBuffPerRank : 0.2;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const levelBoost = Number.isFinite(this.classSpec.levelControlPowerPct)
      ? Math.max(0, this.classSpec.levelControlPowerPct) * Math.max(0, this.level - 1)
      : 0;
    return (1 + perRank * p) * (1 + levelBoost);
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

}

Object.assign(GameRuntimeBase.prototype, runtimeBasePlacementMethods);
Object.assign(GameRuntimeBase.prototype, runtimeBaseSupportMethods);
Object.assign(GameRuntimeBase.prototype, runtimeBaseDifficultyMethods);
Object.assign(GameRuntimeBase.prototype, runtimeFloorBossMethods);
Object.assign(GameRuntimeBase.prototype, runtimeCombatStatsMethods);
