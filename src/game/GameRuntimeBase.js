import { CONFIG } from "../config.js";
import { clamp } from "../utils.js";
import { InputController } from "../InputController.js";
import { Renderer } from "../Renderer.js";
import { runtimeBaseBiomeMethods } from "./runtimeBaseBiomeMethods.js";
import { runtimeBasePlacementMethods } from "./runtimeBasePlacementMethods.js";
import { runtimeBaseSupportMethods } from "./runtimeBaseSupportMethods.js";
import { runtimeBaseDevStartMethods } from "./runtimeBaseDevStartMethods.js";
import { runtimeBaseDifficultyMethods } from "./runtimeBaseDifficultyMethods.js";
import { runtimeCombatStatsMethods } from "./runtimeCombatStatsMethods.js";
import { runtimeFloorBossMethods } from "./runtimeFloorBossMethods.js";
import { createRunStats } from "./runtimeBaseStateFactories.js";
import { initializeRuntimeBaseState } from "./runtimeBaseStateInit.js";
import {
  getNecromancerBlackCandleDamageBonus,
  getNecromancerBaseCharmDurationForLevel,
  getNecromancerBeamHealingMultiplier,
  getNecromancerBoneWardDamageBonus,
  getNecromancerBoneWardDamageReduction,
  getNecromancerBoneWardReflectChance,
  getNecromancerControlCapBonus,
  getNecromancerControlledUndeadAttackSpeedBonusPct,
  getNecromancerControlledUndeadDamageBonusPct,
  getNecromancerControlledUndeadDefenseBonusPct,
  getNecromancerControlledUndeadHealthBonusPct,
  getNecromancerDeathBoltCooldownReduction,
  getNecromancerDeathBoltDamageMultiplier,
  getNecromancerDeathBoltExplosionDamageMultiplier,
  getNecromancerDeathBoltRadiusMultiplier,
  getNecromancerDeathBoltZoneDurationMultiplier,
  getNecromancerTalentPoints,
  getNecromancerGhostLifeSteal,
  isNecromancerTalentGame
} from "./necromancerTalentTree.js";

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
    initializeRuntimeBaseState(this, {
      classType: this.classType,
      classSpec: this.classSpec,
      config: this.config
    });

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

  getDamageTextColor(damageType = "physical") {
    const type = typeof damageType === "string" ? damageType.toLowerCase() : "physical";
    if (type === "fire") return "#ff9a3c";
    if (type === "acid") return "#4fe44a";
    if (type === "poison") return "#b7d94c";
    if (type === "holy") return "#f0d56f";
    if (type === "necrotic" || type === "death" || type === "unholy") return "#b38dff";
    if (type === "arrow") return "#ff7676";
    if (type === "melee" || type === "physical") return "#ef5f5f";
    if (type === "sonic") return "#8edbff";
    if (type === "lightning") return "#f7ee74";
    return "#ef5f5f";
  }

  getHealingTextColor() {
    return "#79e59a";
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
        this.spawnFloatingText(this.player.x, this.player.y - 26, `+${Math.max(1, Math.round(healed))}`, this.getHealingTextColor(), 0.8, 14);
      }
    }
  }

  getHealthPickupAmount() {
    const pct = Number.isFinite(this.config?.drops?.healthRestorePct) ? this.config.drops.healthRestorePct : 0.25;
    return Math.max(1, Math.round(this.player.maxHealth * Math.max(0, pct)));
  }

  applyPlayerDamage(amount) {
    if (amount <= 0) return;
    this.spawnFloatingText(this.player.x, this.player.y - 18, `-${Math.round(amount)}`, this.getDamageTextColor("physical"));
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
    this.shopOpen = false; this.skillTreeOpen = false;
    this.statsPanelOpen = false; this.statsPanelPausedGame = false;
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

  advanceToNextFloor() {
    if (typeof this.recordRunFloorCleared === "function") this.recordRunFloorCleared();
    if (typeof this.applyPassiveConsumableEvent === "function") this.applyPassiveConsumableEvent("floorAdvance");
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
    if (typeof this.refillShopForFloor === "function") this.refillShopForFloor();
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
    this.gold = this.estimateDebugStartingGoldForFloor(safeFloor);
    this.score = 0;
    this.runStats = createRunStats();
    this.levelWeaponDamageBonus = 0;
    this.player.maxHealth = Number.isFinite(this.classSpec.baseMaxHealth) ? this.classSpec.baseMaxHealth : this.config.player.maxHealth;
    this.player.health = this.player.maxHealth;
    this.player.fireCooldown = 0;
    this.player.fireArrowCooldown = 0;
    this.player.deathBoltCooldown = 0;
    this.player.hitCooldown = 0;
    this.player.hpBarTimer = 0;
    if (this.consumables && typeof this.consumables === "object") {
      this.consumables.activeSlots = [];
      this.consumables.passiveSlots = [];
      this.consumables.sharedCooldown = 0;
      this.consumables.message = "";
      this.consumables.messageTimer = 0;
    }
    while (this.level < targetLevel) {
      this.gainExperience(this.expToNextLevel);
    }
    this.experience = 0;
    this.floatingTexts = [];

    const nextMapSize = this.getMapSizeForFloor(safeFloor);
    this.generateFloor(nextMapSize.width, nextMapSize.height);
    if (typeof this.refillShopForFloor === "function") this.refillShopForFloor();
    this.syncFloorBossState();
    if (typeof this.onFloorChanged === "function") this.onFloorChanged(this.floor, this);
  }

  getCamera() {
    const cameraTarget =
      typeof this.getSpectateTargetEntity === "function" && this.player.health <= 0 && !this.gameOver
        ? this.getSpectateTargetEntity() || this.player
        : this.player;
    const viewportWidth = this.getPlayAreaWidth();
    return {
      x: clamp(cameraTarget.x - viewportWidth / 2, 0, this.worldWidth - viewportWidth),
      y: clamp(cameraTarget.y - this.canvas.height / 2, 0, this.worldHeight - this.canvas.height)
    };
  }

  getPlayerMoveSpeed() {
    const levelBonus = Number.isFinite(this.classSpec.levelMoveSpeedGain) ? Math.max(0, this.classSpec.levelMoveSpeedGain) * Math.max(0, this.level - 1) : 0;
    return (this.classSpec.baseMoveSpeed + levelBonus) *
      this.getMoveSpeedMultiplier() *
      this.getWarriorMomentumMultiplier() *
      this.getPlayerTerrainMoveMultiplier();
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
    return enemy?.type === "ghost" || enemy?.type === "skeleton_warrior" || enemy?.type === "skeleton";
  }

  isControlledUndead(enemy) {
    return !!enemy?.isControlledUndead;
  }

  getControlledUndeadOwnerId(enemy) {
    return typeof enemy?.controllerPlayerId === "string" && enemy.controllerPlayerId ? enemy.controllerPlayerId : null;
  }

  getControlledUndeadOwnerEntity(enemy) {
    const ownerId = this.getControlledUndeadOwnerId(enemy);
    if (!ownerId || typeof this.getPlayerEntityById !== "function") return this.player;
    return this.getPlayerEntityById(ownerId) || this.player;
  }

  isEnemyFriendlyToPlayer(enemy) {
    return this.isControlledUndead(enemy);
  }

  isEnemyHostileToPlayer(enemy) {
    return !!enemy && !this.isEnemyFriendlyToPlayer(enemy);
  }

  getNecromancerControlCap(points = this.skills.undeadMastery.points) {
    if (isNecromancerTalentGame(this)) {
      const base = Number.isFinite(this.config.necromancer?.baseControlCap) ? this.config.necromancer.baseControlCap : 1;
      return Math.min(8, base + getNecromancerControlCapBonus(this));
    }
    const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    const base = Number.isFinite(this.config.necromancer?.baseControlCap) ? this.config.necromancer.baseControlCap : 1;
    return Math.min(5, base + p);
  }

  getNecromancerControlCapForPlayer(playerEntity = this.player) {
    if (isNecromancerTalentGame(this)) {
      if (this.isPrimaryPlayerEntity && this.isPrimaryPlayerEntity(playerEntity)) return this.getNecromancerControlCap();
      const base = Number.isFinite(this.config.necromancer?.baseControlCap) ? this.config.necromancer.baseControlCap : 1;
      const bonus = Number.isFinite(playerEntity?.necromancerTalents?.controlMastery?.points) ? playerEntity.necromancerTalents.controlMastery.points : 0;
      return Math.min(8, base + bonus);
    }
    const points = this.isPrimaryPlayerEntity && this.isPrimaryPlayerEntity(playerEntity)
      ? this.skills.undeadMastery.points
      : (Number.isFinite(playerEntity?.skills?.undeadMastery?.points) ? playerEntity.skills.undeadMastery.points : 0);
    return this.getNecromancerControlCap(points);
  }

  getNecromancerCharmDuration(points = this.skills.undeadMastery.points) {
    if (isNecromancerTalentGame(this)) {
      return getNecromancerBaseCharmDurationForLevel(this.level);
    }
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

  getNecromancerCharmDurationForPlayer(playerEntity = this.player) {
    if (isNecromancerTalentGame(this)) {
      const level = Number.isFinite(playerEntity?.level) ? playerEntity.level : this.level;
      return getNecromancerBaseCharmDurationForLevel(level);
    }
    const points = this.isPrimaryPlayerEntity && this.isPrimaryPlayerEntity(playerEntity)
      ? this.skills.undeadMastery.points
      : (Number.isFinite(playerEntity?.skills?.undeadMastery?.points) ? playerEntity.skills.undeadMastery.points : 0);
    if (!(playerEntity && playerEntity !== this.player)) return this.getNecromancerCharmDuration(points);
    const classSpec = this.getPlayerClassSpec(playerEntity);
    const maxPoints = Number.isFinite(playerEntity?.skills?.undeadMastery?.maxPoints) ? playerEntity.skills.undeadMastery.maxPoints : 4;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const base = Number.isFinite(this.config.necromancer?.charmDuration) ? this.config.necromancer.charmDuration : 2;
    const min = Number.isFinite(this.config.necromancer?.minCharmDuration) ? this.config.necromancer.minCharmDuration : 0.5;
    const denom = Math.log1p(1.2 * Math.max(1, maxPoints));
    const norm = denom > 0 ? Math.log1p(1.2 * Math.min(maxPoints, p)) / denom : 1;
    const skillDuration = base - (base - min) * Math.max(0, Math.min(1, norm));
    const levelReductionPct = Number.isFinite(classSpec.levelCharmTimeReductionPct)
      ? Math.max(0, classSpec.levelCharmTimeReductionPct) * Math.max(0, (Number.isFinite(playerEntity.level) ? playerEntity.level : 1) - 1)
      : 0;
    return Math.max(min, skillDuration * Math.max(0.35, 1 - levelReductionPct));
  }

  getControlledUndeadCount(playerEntity = null) {
    const ownerId =
      typeof playerEntity === "string"
        ? playerEntity
        : (playerEntity && typeof playerEntity.id === "string" ? playerEntity.id : null);
    return (this.enemies || []).filter((enemy) => {
      if (!this.isControlledUndead(enemy) || (enemy.hp || 0) <= 0) return false;
      if (!ownerId) return true;
      return this.getControlledUndeadOwnerId(enemy) === ownerId;
    }).length;
  }

  getControlledUndeadBoost(points = this.skills.explodingDeath.points) {
    if (isNecromancerTalentGame(this)) {
      return 2;
    }
    const perRank = Number.isFinite(this.config.necromancer?.petBuffPerRank) ? this.config.necromancer.petBuffPerRank : 0.2;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const levelBoost = Number.isFinite(this.classSpec.levelControlPowerPct)
      ? Math.max(0, this.classSpec.levelControlPowerPct) * Math.max(0, this.level - 1)
      : 0;
    return (1 + perRank * p) * (1 + levelBoost);
  }

  getControlledUndeadBoostForPlayer(playerEntity = this.player) {
    const points = this.isPrimaryPlayerEntity && this.isPrimaryPlayerEntity(playerEntity)
      ? this.skills.explodingDeath.points
      : (Number.isFinite(playerEntity?.skills?.explodingDeath?.points) ? playerEntity.skills.explodingDeath.points : 0);
    if (!(playerEntity && playerEntity !== this.player)) return this.getControlledUndeadBoost(points);
    const classSpec = this.getPlayerClassSpec(playerEntity);
    const perRank = Number.isFinite(this.config.necromancer?.petBuffPerRank) ? this.config.necromancer.petBuffPerRank : 0.2;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const levelBoost = Number.isFinite(classSpec.levelControlPowerPct)
      ? Math.max(0, classSpec.levelControlPowerPct) * Math.max(0, (Number.isFinite(playerEntity.level) ? playerEntity.level : 1) - 1)
      : 0;
    return (1 + perRank * p) * (1 + levelBoost);
  }

  getControlledUndeadDefenseMultiplier(points = this.skills.explodingDeath.points) {
    if (isNecromancerTalentGame(this)) {
      const baselineBonus = 0.5;
      return 1 / Math.max(0.1, 1 + baselineBonus + getNecromancerControlledUndeadDefenseBonusPct(this) + getNecromancerBoneWardDamageReduction(this));
    }
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    return 1.5 + (0.2 * p);
  }

  getControlledUndeadDefenseMultiplierForPlayer(playerEntity = this.player) {
    const points = this.isPrimaryPlayerEntity && this.isPrimaryPlayerEntity(playerEntity)
      ? this.skills.explodingDeath.points
      : (Number.isFinite(playerEntity?.skills?.explodingDeath?.points) ? playerEntity.skills.explodingDeath.points : 0);
    return this.getControlledUndeadDefenseMultiplier(points);
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
    if (isNecromancerTalentGame(this)) {
      const base = this.getFireArrowImpactDamage(0) * 1.1 * this.getOverallAttackModifier();
      return base * getNecromancerDeathBoltDamageMultiplier(this);
    }
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    return this.getFireArrowImpactDamage(p) * 1.1 * this.getOverallAttackModifier();
  }

  getDeathBoltHealAmount(points = this.skills.deathBolt.points) {
    if (isNecromancerTalentGame(this)) {
      return this.getDeathBoltBaseDamage(points) * 0.25;
    }
    return this.getDeathBoltBaseDamage(points) * 0.25;
  }

  getNecroticBeamHealAmount(points = this.skills.explodingDeath.points) {
    if (isNecromancerTalentGame(this)) {
      const base = (Number.isFinite(this.config.necromancer?.healAmount) ? this.config.necromancer.healAmount : 3) * this.getOverallAttackModifier();
      return base * getNecromancerBeamHealingMultiplier(this);
    }
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const base = (Number.isFinite(this.config.necromancer?.healAmount) ? this.config.necromancer.healAmount : 3) * this.getOverallAttackModifier();
    return base * (1 + 0.15 * p);
  }

  getDeathBoltPetDamageMultiplier(points = this.skills.deathBolt.points) {
    if (isNecromancerTalentGame(this)) {
      return 1;
    }
    const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    if (p < 5) return 1;
    if (p < 7) return 1.5;
    return 2;
  }

  getDeathExplosionDamage(points = this.skills.explodingDeath.points) {
    if (isNecromancerTalentGame(this)) {
      return 5 * getNecromancerDeathBoltExplosionDamageMultiplier(this);
    }
    const p = Number.isFinite(points) ? Math.max(0, points - 2) : 0;
    if (p <= 0) return 0;
    const base = ((this.config.enemy.skeletonWarriorDamageMin || 10) + (this.config.enemy.skeletonWarriorDamageMax || 16)) * 0.5;
    return base * (1 + 0.45 * Math.log1p(1.15 * p));
  }

  getDeathBoltRadius(points = this.skills.deathBolt.points) {
    if (isNecromancerTalentGame(this)) {
      const tile = this.config.map.tile;
      const baseTiles = Number.isFinite(this.config.deathBolt?.impactRadiusTiles) ? this.config.deathBolt.impactRadiusTiles : 2;
      return baseTiles * tile * getNecromancerDeathBoltRadiusMultiplier(this);
    }
    const tile = this.config.map.tile;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const maxPoints = Number.isFinite(this.skills?.deathBolt?.maxPoints) ? this.skills.deathBolt.maxPoints : 8;
    const norm = Math.log1p(1.2 * p) / Math.log1p(1.2 * Math.max(1, maxPoints));
    const baseTiles = Number.isFinite(this.config.deathBolt?.impactRadiusTiles) ? this.config.deathBolt.impactRadiusTiles : 2;
    const bonusTiles = 1.25 * Math.max(0, Math.min(1, norm));
    return (baseTiles + bonusTiles) * tile;
  }

  getExplodingDeathRadius() {
    const tile = this.config.map.tile;
    return (Number.isFinite(this.config.explodingDeath?.radiusTiles) ? this.config.explodingDeath.radiusTiles : 3) * tile;
  }

  canControlMoreUndead(playerEntity = this.player) {
    return this.getControlledUndeadCount(playerEntity) < this.getNecromancerControlCapForPlayer(playerEntity);
  }

  applyControlledUndeadBonuses(enemy, playerEntity = null) {
    if (!enemy || !this.isControlledUndead(enemy)) return enemy;
    const owner = playerEntity || this.getControlledUndeadOwnerEntity(enemy);
    if (isNecromancerTalentGame(this)) {
      const baselineBoost = 2.4;
      const baselineDefenseBonus = 0.5;
      const healthBonus = owner === this.player
        ? getNecromancerControlledUndeadHealthBonusPct(this)
        : ((owner?.necromancerTalents?.coldCommand?.points || 0) * 0.15);
      const defenseBonus = owner === this.player
        ? getNecromancerControlledUndeadDefenseBonusPct(this)
        : ((owner?.necromancerTalents?.coldCommand?.points || 0) * 0.1);
      const damageBonus = owner === this.player
        ? getNecromancerControlledUndeadDamageBonusPct(this)
        : ((owner?.necromancerTalents?.coldCommand?.points || 0) * 0.1);
      const attackSpeedBonus = owner === this.player
        ? getNecromancerControlledUndeadAttackSpeedBonusPct(this)
        : ((owner?.necromancerTalents?.coldCommand?.points || 0) * 0.1);
      const baseMaxHp = Number.isFinite(enemy.baseMaxHp) ? enemy.baseMaxHp : enemy.maxHp;
      const baseSpeed = Number.isFinite(enemy.baseSpeed) ? enemy.baseSpeed : enemy.speed;
      const baseMin = Number.isFinite(enemy.baseDamageMin) ? enemy.baseDamageMin : enemy.damageMin;
      const baseMax = Number.isFinite(enemy.baseDamageMax) ? enemy.baseDamageMax : enemy.damageMax;
      enemy.baseMaxHp = baseMaxHp;
      enemy.baseSpeed = baseSpeed;
      enemy.baseDamageMin = baseMin;
      enemy.baseDamageMax = baseMax;
      enemy.maxHp = Math.max(1, baseMaxHp * baselineBoost * (1 + healthBonus));
      enemy.hp = enemy.maxHp;
      enemy.speed = Math.max(baseSpeed * 1.08, (typeof this.getPlayerMoveSpeedFor === "function" ? this.getPlayerMoveSpeedFor(owner) : this.getPlayerMoveSpeed()) * 1.02);
      enemy.damageMin = baseMin * 1.2 * (1 + damageBonus);
      enemy.damageMax = baseMax * 1.2 * (1 + damageBonus);
      enemy.controlledDefenseMultiplier = Math.max(
        0.1,
        1 + baselineDefenseBonus + defenseBonus + (owner === this.player ? getNecromancerBoneWardDamageReduction(this) : ((owner?.necromancerTalents?.boneWard?.points || 0) >= 1 ? 0.1 : 0))
      );
      enemy.controlledAttackSpeedBonusPct = attackSpeedBonus;
      enemy.controlledDamageBonusPct = owner === this.player
        ? getNecromancerBoneWardDamageBonus(this, enemy, owner)
        : ((owner?.necromancerTalents?.boneWard?.points || 0) >= 1 && Math.hypot((enemy.x || 0) - (owner?.x || 0), (enemy.y || 0) - (owner?.y || 0)) <= (this.config.map.tile * 2) ? 0.1 : 0);
      enemy.controlledReflectChance = owner === this.player
        ? getNecromancerBoneWardReflectChance(this, enemy, owner)
        : ((owner?.necromancerTalents?.boneWard?.points || 0) >= 1 && Math.hypot((enemy.x || 0) - (owner?.x || 0), (enemy.y || 0) - (owner?.y || 0)) <= this.config.map.tile * 2 ? 0.15 : 0);
      enemy.lifeStealPct = owner === this.player ? getNecromancerGhostLifeSteal(this) : ((owner?.necromancerTalents?.legionMaster?.points || 0) > 0 ? 0.002 : 0);
      return enemy;
    }
    const boost = this.getControlledUndeadBoostForPlayer(owner);
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
    enemy.speed = Math.max(baseSpeed * boost, (typeof this.getPlayerMoveSpeedFor === "function" ? this.getPlayerMoveSpeedFor(owner) : this.getPlayerMoveSpeed()) * 1.1);
    enemy.damageMin = baseMin * 1.3 * boost;
    enemy.damageMax = baseMax * 1.3 * boost;
    enemy.controlledDefenseMultiplier = this.getControlledUndeadDefenseMultiplierForPlayer(owner);
    return enemy;
  }

  markUndeadAsControlled(enemy, playerEntity = this.player) {
    if (!enemy || !this.isUndeadEnemy(enemy)) return false;
    if (this.isControlledUndead(enemy)) return true;
    if (!this.canControlMoreUndead(playerEntity)) return false;
    enemy.isControlledUndead = true;
    enemy.controllerPlayerId = typeof playerEntity?.id === "string" && playerEntity.id ? playerEntity.id : null;
    enemy.controllerNecromancerTalents = playerEntity?.necromancerTalents || null;
    enemy.controllerExplodingDeathPoints = this.isPrimaryPlayerEntity && this.isPrimaryPlayerEntity(playerEntity)
      ? (this.skills.explodingDeath.points || 0)
      : (Number.isFinite(playerEntity?.skills?.explodingDeath?.points) ? playerEntity.skills.explodingDeath.points : 0);
    enemy.summonedByPlayer = true;
    enemy.controlledAt = this.time;
    enemy.hpBarTimer = this.config.enemy.hpBarDuration;
    enemy.contactAttackCooldown = 0;
    this.applyControlledUndeadBonuses(enemy, playerEntity);
    if (typeof this.recordClassSpecificStat === "function") this.recordClassSpecificStat("necromancer", "undeadCharmed", 1);
    return true;
  }

  healControlledUndead(enemy, amount) {
    if (!enemy || !this.isControlledUndead(enemy) || !Number.isFinite(amount) || amount <= 0) return;
    const before = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
    if (enemy.hp > before) {
      if (typeof this.recordClassSpecificStat === "function") this.recordClassSpecificStat("necromancer", "undeadHealing", enemy.hp - before);
      enemy.hpBarTimer = this.config.enemy.hpBarDuration;
      this.spawnFloatingText(enemy.x, enemy.y - enemy.size * 0.7, `+${Math.max(1, Math.round(enemy.hp - before))}`, "#89b7ff", 0.8, 13);
    }
  }
}

Object.assign(GameRuntimeBase.prototype, runtimeBasePlacementMethods);
Object.assign(GameRuntimeBase.prototype, runtimeBaseBiomeMethods);
Object.assign(GameRuntimeBase.prototype, runtimeBaseSupportMethods);
Object.assign(GameRuntimeBase.prototype, runtimeBaseDevStartMethods);
Object.assign(GameRuntimeBase.prototype, runtimeBaseDifficultyMethods);
Object.assign(GameRuntimeBase.prototype, runtimeFloorBossMethods);
Object.assign(GameRuntimeBase.prototype, runtimeCombatStatsMethods);
