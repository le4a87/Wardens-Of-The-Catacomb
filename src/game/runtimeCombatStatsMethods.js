import {
  canSpendRangerNode,
  canSpendRangerUtility,
  getRangerCritChance,
  getRangerCritMultiplier,
  getRangerDamageBonus,
  getRangerDanceAttackSpeedBonus,
  getRangerDanceDefenseBonus,
  getRangerFireArrowDurationMultiplier,
  getRangerFireDamageBonus,
  getRangerFireArrowImpactMultiplier,
  getRangerFireRadiusBonus,
  getRangerLinebreakerDamagePerHit,
  getRangerMaxHealthBonusPct,
  getRangerMoveSpeedBonus,
  getRangerMultishotBonus,
  getRangerProjectileSpeedBonus,
  getRangerStationaryPierceBonus,
  getRangerTalentPoints,
  getRangerVolleyCooldownReduction,
  hasFireMastery,
  hasPinningShot,
  spendRangerNode,
  spendRangerUtility
} from "./rangerTalentTree.js";
import {
  canSpendWarriorNode,
  canSpendWarriorUtility,
  getWarriorBattleFrenzyDamageBonus,
  getWarriorBattleFrenzyDuration,
  getWarriorBattleFrenzyMoveSpeedBonus,
  getWarriorBloodheatAttackSpeedBonus,
  getWarriorBloodheatMoveSpeedBonus,
  getWarriorBloodheatRageMoveSpeedBonus,
  getWarriorConsecratedDps,
  getWarriorConsecratedHealingMultiplier,
  getWarriorConsecratedRadiusTiles,
  getWarriorConsecratedShredPct,
  getWarriorConsecratedUndeadMultiplier,
  getWarriorCrusaderUndeadDamageBonus,
  getWarriorExecutionerExecuteChance,
  getWarriorExecutionerRageRangeBonus,
  getWarriorHeavyHandDamageBonus,
  getWarriorIronGuardMaxHealthFlat,
  getWarriorPassiveRegenBonusPct,
  getWarriorRageMasteryAttackSpeedBonus,
  getWarriorRageMasteryMoveSpeedBonus,
  getWarriorRedTempestMoveSpeedBonus,
  getWarriorRedTempestTempHpPct,
  getWarriorSecondWindAllyHealPct,
  getWarriorSecondWindHealPct,
  getWarriorTalentPoints,
  hasWarriorCleaveDiscipline,
  hasWarriorButchersPath,
  hasWarriorGuardedAdvance,
  hasWarriorRageMastery,
  hasWarriorRedTempest,
  isWarriorRaging,
  isWarriorTalentGame,
  spendWarriorNode,
  spendWarriorUtility
} from "./warriorTalentTree.js";
import {
  canSpendNecromancerNode,
  canSpendNecromancerUtility,
  getNecromancerVigorDefenseBonusPct,
  isNecromancerTalentGame,
  spendNecromancerNode,
  spendNecromancerUtility
} from "./necromancerTalentTree.js";

export const runtimeCombatStatsMethods = {
  getPlayerResistancePct(damageType = "physical") {
    const normalized = typeof damageType === "string" ? damageType.toLowerCase() : "physical";
    const resistances = this.classSpec?.baseResistances || {};
    const direct = Number.isFinite(resistances[normalized]) ? resistances[normalized] : null;
    if (direct != null) return Math.max(0, Math.min(0.9, direct));
    if ((normalized === "necrotic" || normalized === "death") && Number.isFinite(resistances.unholy)) {
      return Math.max(0, Math.min(0.9, resistances.unholy));
    }
    return 0;
  },

  getPlayerDamageTaken(rawDamage, damageType = "physical") {
    const safeDamage = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
    const resistancePct = this.getPlayerResistancePct(damageType);
    let resisted = Math.max(1, Math.round(safeDamage * (1 - resistancePct)));
    if (isNecromancerTalentGame(this)) {
      resisted = Math.max(1, Math.round(resisted * (1 - getNecromancerVigorDefenseBonusPct(this))));
    }
    const reducedByDefense = Math.max(1, Math.round(resisted - this.getDefenseFlatReduction()));
    return this.getWarriorRageDamageTaken(reducedByDefense, damageType);
  },

  getPlayerFireCooldown() {
    const levelAttackBonusPct = Number.isFinite(this.classSpec.levelAttackSpeedPct)
      ? Math.max(0, this.classSpec.levelAttackSpeedPct) * Math.max(0, this.level - 1)
      : 0;
    let attackMultiplier = this.getAttackSpeedMultiplier() * (1 + levelAttackBonusPct);
    if (isWarriorTalentGame(this) && isWarriorRaging(this)) {
      attackMultiplier *= 1 + getWarriorRageMasteryAttackSpeedBonus(this);
    }
    return Math.max(this.classSpec.minAttackCooldown, this.classSpec.baseAttackCooldown / attackMultiplier);
  },

  getAttackSpeed() {
    return 1 / this.getPlayerFireCooldown();
  },

  getPrimaryDamage() {
    const range = this.getPrimaryDamageRange();
    return (range.min + range.max) * 0.5;
  },

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
    const consumableBonus = typeof this.getConsumableBonusDamage === "function" ? this.getConsumableBonusDamage() : 0;
    const scaledMinBase = (minBase + rageBaseBonus) * safeMult;
    const scaledMaxBase = (maxBase + rageBaseBonus) * safeMult;
    return {
      min: scaledMinBase + flatBonus + consumableBonus,
      max: scaledMaxBase + flatBonus + consumableBonus
    };
  },

  rollPrimaryDamage() {
    const range = this.getPrimaryDamageRange();
    return this.rollRange(range.min, range.max);
  },

  getLifeLeechPercent() {
    const base = Number.isFinite(this.classSpec.baseLifeLeech) ? this.classSpec.baseLifeLeech : 0;
    const levelGain = Number.isFinite(this.classSpec.levelLifeLeechGain) ? Math.max(0, this.classSpec.levelLifeLeechGain) * Math.max(0, this.level - 1) : 0;
    return Math.max(0, base + levelGain);
  },

  getProjectileSpeed() {
    const speed = this.classSpec.projectileSpeed;
    const baseSpeed = Number.isFinite(speed) && speed > 0 ? speed : this.config.player.projectileSpeed;
    if (this.isArcherClass && this.isArcherClass()) {
      return baseSpeed * (1 + getRangerProjectileSpeedBonus(this));
    }
    if (Number.isFinite(speed) && speed > 0) return speed;
    return this.config.player.projectileSpeed;
  },

  getBowMuzzleOrigin(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const ax = dx / len;
    const ay = dy / len;
    const px = -ay;
    const py = ax;
    const walkPhase = this.player.moving ? this.player.animTime * this.config.player.animationSpeed * 0.1 : 0;
    const chestYOffset = Math.sin(walkPhase * Math.PI * 2) * 0.9;
    return {
      x: this.player.x + ax * 14 + px * 0.8,
      y: this.player.y - 8 + chestYOffset + ay * 14 + py * 0.8,
      dirX: ax,
      dirY: ay
    };
  },

  getFireArrowBlastRadius(points = this.skills.fireArrow.points) {
    if (this.isArcherClass && this.isArcherClass()) {
      const base = this.config.fireArrow.baseBlastRadius;
      return base * (1 + getRangerFireRadiusBonus(this));
    }
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const bonus = 18 * Math.log1p(1.35 * p);
    return this.config.fireArrow.baseBlastRadius + bonus;
  },

  getFireArrowImpactDamage(points = this.skills.fireArrow.points) {
    if (this.isArcherClass && this.isArcherClass()) {
      const base = Number.isFinite(this.config.fireArrow.impactDamage) ? this.config.fireArrow.impactDamage : 3.2;
      return base * getRangerFireArrowImpactMultiplier(this);
    }
    const p = Number.isFinite(points) ? points : 0;
    const mult = 1 + 0.8 * Math.log1p(1.25 * Math.max(0, p));
    const base = Number.isFinite(this.config.fireArrow.impactDamage) ? this.config.fireArrow.impactDamage : 3.2;
    return base * mult;
  },

  getFireArrowLingerDps(points = this.skills.fireArrow.points) {
    if (this.isArcherClass && this.isArcherClass()) {
      const base = Number.isFinite(this.config.fireArrow.lingerDps) ? this.config.fireArrow.lingerDps : 3.6;
      return base * (1 + getRangerFireDamageBonus(this));
    }
    const p = Number.isFinite(points) ? points : 0;
    const mult = 1 + 0.7 * Math.log1p(1.2 * Math.max(0, p));
    const base = Number.isFinite(this.config.fireArrow.lingerDps) ? this.config.fireArrow.lingerDps : 3.6;
    return base * mult;
  },

  getPiercingChance(points = this.skills.piercingStrike.points) {
    if (this.isArcherClass && this.isArcherClass()) {
      let chance = 0;
      if (!this.player?.moving) chance += getRangerStationaryPierceBonus(this);
      return Math.max(0, Math.min(0.95, chance));
    }
    const p = Number.isFinite(points) ? points : 0;
    const maxChance = 0.65;
    const scaled = Math.log1p(1.2 * Math.max(0, p)) / Math.log1p(1.2 * this.skills.piercingStrike.maxPoints);
    return maxChance * Math.max(0, Math.min(1, scaled));
  },

  getMultiarrowCount(points = this.skills.multiarrow.points) {
    if (this.isArcherClass && this.isArcherClass()) {
      return 1 + getRangerMultishotBonus(this);
    }
    const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    const maxPoints = Number.isFinite(this.skills?.multiarrow?.maxPoints) ? this.skills.multiarrow.maxPoints : 8;
    const clamped = Math.min(maxPoints, p);
    return 1 + clamped;
  },

  getMultiarrowDamageMultiplier(points = this.skills.multiarrow.points) {
    if (this.isArcherClass && this.isArcherClass()) {
      return 1 + getRangerMultishotBonus(this) * 0.06;
    }
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const maxPoints = Number.isFinite(this.skills?.multiarrow?.maxPoints) ? this.skills.multiarrow.maxPoints : 8;
    const norm = Math.log1p(1.35 * p) / Math.log1p(1.35 * Math.max(1, maxPoints));
    const bonus = 0.18 * Math.max(0, Math.min(1, norm));
    return 1 + bonus;
  },

  getMultiarrowArrowDamageMultipliers(points = this.skills.multiarrow.points) {
    const count = this.getMultiarrowCount(points);
    const volleyMultiplier = this.getMultiarrowDamageMultiplier(points);
    if (count <= 1) return [volleyMultiplier];

    const center = (count - 1) * 0.5;
    const rawWeights = [];
    for (let i = 0; i < count; i++) {
      const distanceFromCenter = Math.abs(i - center);
      const normalizedDistance = center > 0 ? distanceFromCenter / center : 0;
      const weight = 0.28 + 1.05 * Math.pow(Math.max(0, 1 - normalizedDistance), 1.35);
      rawWeights.push(weight);
    }
    const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0) || 1;
    return rawWeights.map((weight) => volleyMultiplier * (weight / totalWeight));
  },

  getMultiarrowSpreadDeg(points = this.skills.multiarrow.points) {
    if (this.isArcherClass && this.isArcherClass()) {
      const count = this.getMultiarrowCount(points);
      if (count <= 1) return 0;
      return 10 + (count - 2) * 4;
    }
    const count = this.getMultiarrowCount(points);
    if (count <= 1) return 0;
    const p = Number.isFinite(points) ? points : 0;
    return 8 + 6.2 * Math.log1p(1.1 * Math.max(0, p));
  },

  getMultiarrowAngles(baseAngle, points = this.skills.multiarrow.points) {
    const safeBaseAngle = Number.isFinite(baseAngle) ? baseAngle : 0;
    const count = this.getMultiarrowCount(points);
    if (count <= 1) return [safeBaseAngle];
    const spreadDeg = this.getMultiarrowSpreadDeg(points);
    const spreadRad = (spreadDeg * Math.PI) / 180;
    const angles = [];
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      const offset = count <= 1 ? 0 : (t - 0.5) * spreadRad;
      angles.push(safeBaseAngle + offset);
    }
    return angles;
  },

  isFireArrowUnlocked() {
    if (this.isArcherClass && this.isArcherClass()) {
      return getRangerTalentPoints(this, "fireArrowActive") > 0;
    }
    return this.skills.fireArrow.points > 0;
  },

  getRangerCritChance() {
    return this.isArcherClass && this.isArcherClass() ? getRangerCritChance(this) : 0;
  },

  getRangerCritMultiplier() {
    return getRangerCritMultiplier();
  },

  getRangerLinebreakerDamageBonus(hitCount = 0) {
    if (!(this.isArcherClass && this.isArcherClass())) return 0;
    const count = Number.isFinite(hitCount) ? Math.max(0, hitCount) : 0;
    return count * getRangerLinebreakerDamagePerHit(this);
  },

  getRangerFireArrowCooldown() {
    const base = Number.isFinite(this.config.fireArrow?.cooldown) ? this.config.fireArrow.cooldown : 2;
    if (!(this.isArcherClass && this.isArcherClass())) return base;
    return Math.max(0.2, base - getRangerVolleyCooldownReduction(this));
  },

  getRangerFireArrowDurationMultiplier() {
    return this.isArcherClass && this.isArcherClass() ? getRangerFireArrowDurationMultiplier(this) : 1;
  },

  hasRangerPinningShot() {
    return this.isArcherClass && this.isArcherClass() ? hasPinningShot(this) : false;
  },

  hasRangerFireMastery() {
    return this.isArcherClass && this.isArcherClass() ? hasFireMastery(this) : false;
  },

  getWarriorMomentumDuration(points = this.skills.warriorMomentum.points) {
    if (isWarriorTalentGame(this)) return getWarriorBattleFrenzyDuration();
    const p = Number.isFinite(points) ? points : 0;
    return 0.85 + 0.9 * Math.log1p(1.2 * Math.max(0, p));
  },

  getWarriorMomentumMoveBonus(points = this.skills.warriorMomentum.points) {
    if (isWarriorTalentGame(this)) return getWarriorBattleFrenzyMoveSpeedBonus(this);
    const p = Number.isFinite(points) ? points : 0;
    return 0.2 + 0.33 * Math.log1p(1.3 * Math.max(0, p));
  },

  getWarriorMomentumMultiplier() {
    if (this.classSpec.usesRanged) return 1;
    let bonus = 0;
    const nearbyThreat = (this.enemies || []).some((enemy) =>
      enemy &&
      (enemy.hp || 0) > 0 &&
      !this.isEnemyFriendlyToPlayer(enemy) &&
      Math.hypot((enemy.x || 0) - (this.player?.x || 0), (enemy.y || 0) - (this.player?.y || 0)) <= (this.config?.map?.tile || 32) * 5
    );
    if (nearbyThreat || isWarriorRaging(this) || (this.warriorMomentumTimer || 0) > 0) {
      bonus += getWarriorBloodheatMoveSpeedBonus(this);
    }
    if ((this.warriorMomentumTimer || 0) > 0) bonus += this.getWarriorMomentumMoveBonus();
    if (isWarriorRaging(this)) {
      bonus += getWarriorBloodheatRageMoveSpeedBonus(this);
      bonus += getWarriorRageMasteryMoveSpeedBonus(this);
      bonus += getWarriorRedTempestMoveSpeedBonus(this);
    }
    return 1 + bonus;
  },

  getWarriorRageDuration() {
    const c = this.config.warriorRage || {};
    const base = Number.isFinite(c.duration) ? c.duration : 10;
    if (isWarriorTalentGame(this) && hasWarriorRageMastery(this)) return base * 1.15;
    return base;
  },

  getWarriorRageCooldown(points = this.skills.warriorRage.points) {
    if (isWarriorTalentGame(this)) {
      const c = this.config.warriorRage || {};
      return Number.isFinite(c.cooldown) ? c.cooldown : 20;
    }
    const c = this.config.warriorRage || {};
    const base = Number.isFinite(c.cooldown) ? c.cooldown : 20;
    const maxReduction = Number.isFinite(c.maxCooldownReductionPct) ? c.maxCooldownReductionPct : 0.4;
    const maxPoints = Number.isFinite(this.skills?.warriorRage?.maxPoints) ? this.skills.warriorRage.maxPoints : 8;
    const p = Math.max(0, Number.isFinite(points) ? points : 0);
    const denom = Math.log1p(1.25 * Math.max(1, maxPoints));
    const norm = denom > 0 ? Math.log1p(1.25 * p) / denom : 0;
    const reduction = Math.max(0, Math.min(1, maxReduction * norm));
    return base * (1 - reduction);
  },

  getWarriorRageBaseDamageBonus(points = this.skills.warriorRage.points) {
    if (this.classSpec.usesRanged) return 0;
    if (isWarriorTalentGame(this)) {
      return 0.3;
    }
    const c = this.config.warriorRage || {};
    const baseBonus = Number.isFinite(c.baseDamageBonus) ? c.baseDamageBonus : 0.3;
    const perPoint = Number.isFinite(c.baseDamageBonusPerPoint) ? c.baseDamageBonusPerPoint : 0.14;
    const p = Math.max(0, Number.isFinite(points) ? points : 0);
    return baseBonus + perPoint * Math.log1p(1.2 * p);
  },

  getActiveWarriorRageBaseDamageBonus() {
    if (this.classSpec.usesRanged || !isWarriorRaging(this)) return 0;
    return this.getWarriorRageBaseDamageBonus();
  },

  getWarriorRageDamageTaken(rawDamage, damageType = "physical") {
    if (this.classSpec.usesRanged || !isWarriorRaging(this)) return rawDamage;
    const safe = Number.isFinite(rawDamage) ? rawDamage : 0;
    if (isWarriorTalentGame(this)) {
      const normalized = typeof damageType === "string" ? damageType.toLowerCase() : "physical";
      const physicalLike = normalized === "physical" || normalized === "melee" || normalized === "arrow";
      if (!physicalLike) return safe;
      return Math.floor(Math.max(0, safe) * 0.5);
    }
    return Math.floor(Math.max(0, safe) * 0.5);
  },

  getWarriorRageVictoryRushPerKillPct(points = this.skills.warriorRage.points) {
    if (isWarriorTalentGame(this)) {
      const rank = getWarriorTalentPoints(this, "battleFrenzy");
      if (rank <= 0) return 0;
      return rank * 0.01;
    }
    if (this.classSpec.usesRanged) return 0;
    const c = this.config.warriorRage || {};
    const p = Math.max(0, Number.isFinite(points) ? points : 0);
    if (p <= 0) return 0;
    const minPct = Number.isFinite(c.victoryRushPerKillMinPct) ? Math.max(0, c.victoryRushPerKillMinPct) : 0.01;
    const maxPct = Number.isFinite(c.victoryRushPerKillMaxPct) ? Math.max(minPct, c.victoryRushPerKillMaxPct) : 0.03;
    const maxPoints = Number.isFinite(this.skills?.warriorRage?.maxPoints) ? this.skills.warriorRage.maxPoints : 8;
    const denom = Math.log1p(1.2 * Math.max(1, maxPoints));
    const norm = denom > 0 ? Math.log1p(1.2 * p) / denom : 0;
    return minPct + (maxPct - minPct) * Math.max(0, Math.min(1, norm));
  },

  getWarriorRageVictoryRushHeal(points = this.skills.warriorRage.points) {
    if (this.classSpec.usesRanged) return 0;
    if (isWarriorTalentGame(this)) {
      if (!isWarriorRaging(this)) return 0;
    } else if (this.warriorRageActiveTimer <= 0) {
      return 0;
    }
    return Math.max(1, Math.round(this.player.maxHealth * this.getWarriorRageVictoryRushPerKillPct(points)));
  },

  getWarriorRageVictoryRushPoolCap() {
    if (isWarriorTalentGame(this)) {
      const rank = getWarriorTalentPoints(this, "battleFrenzy");
      if (rank <= 0) return 0;
      return Math.max(1, this.player.maxHealth * (0.05 * rank));
    }
    const c = this.config.warriorRage || {};
    const capPct = Number.isFinite(c.victoryRushPoolCapPct) ? Math.max(0, c.victoryRushPoolCapPct) : 0.2;
    return Math.max(1, this.player.maxHealth * capPct);
  },

  getWarriorRageVictoryRushHotDuration() {
    if (isWarriorTalentGame(this)) return 4;
    const c = this.config.warriorRage || {};
    return Number.isFinite(c.victoryRushHotDuration) ? Math.max(0.5, c.victoryRushHotDuration) : 15;
  },

  getWarriorExecuteChance(points = this.skills.warriorExecute.points) {
    if (isWarriorTalentGame(this)) {
      let chance = getWarriorExecutionerExecuteChance(this);
      if (isWarriorRaging(this) && hasWarriorButchersPath(this)) chance *= 2;
      return Math.max(0, Math.min(1, chance));
    }
    if (this.classSpec.usesRanged) return 0;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    if (p <= 0) return 0;
    const maxPoints = Number.isFinite(this.skills?.warriorExecute?.maxPoints) ? this.skills.warriorExecute.maxPoints : 8;
    const span = Math.max(1, maxPoints - 1);
    const norm = span > 0 ? Math.log1p(1.2 * (p - 1)) / Math.log1p(1.2 * span) : 1;
    return 0.10 + 0.20 * Math.max(0, Math.min(1, norm));
  },

  getWarriorExecuteThreshold(points = this.skills.warriorExecute.points) {
    if (isWarriorTalentGame(this)) return 0.3;
    if (this.classSpec.usesRanged) return 0;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    if (p <= 0) return 0;
    const maxPoints = Number.isFinite(this.skills?.warriorExecute?.maxPoints) ? this.skills.warriorExecute.maxPoints : 8;
    const span = Math.max(1, maxPoints - 1);
    const norm = span > 0 ? Math.log1p(1.2 * (p - 1)) / Math.log1p(1.2 * span) : 1;
    return 0.05 + 0.15 * Math.max(0, Math.min(1, norm));
  },

  isWarriorRageUnlocked() {
    if (isWarriorTalentGame(this)) return getWarriorTalentPoints(this, "rageActive") > 0;
    return !this.classSpec.usesRanged && (this.skills?.warriorRage?.points || 0) > 0;
  },

  canActivateWarriorRage() {
    if (!this.isWarriorRageUnlocked()) return false;
    if (this.warriorRageActiveTimer > 0) return false;
    return this.warriorRageCooldownTimer <= 0;
  },

  activateWarriorRage() {
    if (!this.canActivateWarriorRage()) return false;
    this.warriorRageActiveTimer = this.getWarriorRageDuration();
    this.warriorRageCooldownTimer = this.getWarriorRageCooldown();
    this.warriorRuntime = this.warriorRuntime && typeof this.warriorRuntime === "object"
      ? this.warriorRuntime
      : (this.player?.warriorRuntime && typeof this.player.warriorRuntime === "object" ? this.player.warriorRuntime : {});
    if (this.player) this.player.warriorRuntime = this.warriorRuntime;
    this.warriorRuntime.rageCritReady = hasWarriorCleaveDiscipline(this);
    this.warriorRuntime.cleaveCounter = 0;
    this.warriorRuntime.rageArcTimer = 0;
    const secondWindPct = getWarriorSecondWindHealPct(this);
    if (secondWindPct > 0) {
      this.warriorRuntime.secondWindPool = Math.max(1, this.player.maxHealth * secondWindPct);
      this.warriorRuntime.secondWindTimer = 10;
      this.warriorRuntime.secondWindTotalDuration = 10;
    }
    const allyPct = getWarriorSecondWindAllyHealPct(this);
    if (allyPct > 0 && typeof this.getActivePlayerEntities === "function") {
      for (const ally of this.getActivePlayerEntities()) {
        if (!ally || ally === this.player || (ally.health || 0) <= 0) continue;
        ally.warriorRuntime = ally.warriorRuntime && typeof ally.warriorRuntime === "object" ? ally.warriorRuntime : {};
        ally.warriorRuntime.secondWindPool = Math.max(1, (ally.maxHealth || 1) * allyPct);
        ally.warriorRuntime.secondWindTimer = 10;
        ally.warriorRuntime.secondWindTotalDuration = 10;
      }
    }
    const tempHpPct = getWarriorRedTempestTempHpPct(this);
    if (tempHpPct > 0) {
      this.warriorRuntime.tempHp = Math.max(0, Math.round(this.player.maxHealth * tempHpPct));
      this.warriorRuntime.tempHpTimer = this.warriorRageActiveTimer;
      this.warriorRuntime.rageArcTimer = hasWarriorRedTempest(this) ? 5 : 0;
    }
    if (isWarriorTalentGame(this) && hasWarriorGuardedAdvance(this)) {
      const tile = this.config?.map?.tile || 32;
      this.fireZones.push({
        x: this.player.x,
        y: this.player.y,
        radius: tile * getWarriorConsecratedRadiusTiles(this),
        life: this.warriorRageActiveTimer,
        totalLife: this.warriorRageActiveTimer,
        zoneType: "crusaderAura",
        ownerId: this.player.id || null,
        dps: getWarriorConsecratedDps(this),
        undeadDamageMultiplier: getWarriorConsecratedUndeadMultiplier(this),
        healingMultiplier: getWarriorConsecratedHealingMultiplier(this),
        defenseShredPct: getWarriorConsecratedShredPct(this),
        tickInterval: 0.3,
        tickTimer: 0.05
      });
      this.spawnFloatingText(this.player.x, this.player.y - 36, "Consecrated Ground", "#f5cf6f", 0.9, 15);
    }
    return true;
  },

  triggerWarriorMomentumOnKill() {
    if (this.classSpec.usesRanged) return;
    if (isWarriorTalentGame(this)) {
      if (getWarriorTalentPoints(this, "battleFrenzy") <= 0) return;
      this.warriorRuntime = this.warriorRuntime && typeof this.warriorRuntime === "object" ? this.warriorRuntime : {};
      if ((this.warriorRuntime.battleFrenzyCooldownTimer || 0) > 0) return;
      const wasInactive = (this.warriorMomentumTimer || 0) <= 0;
      this.warriorMomentumTimer = this.getWarriorMomentumDuration();
      this.warriorRuntime.battleFrenzyCooldownTimer = 10;
      if (wasInactive && typeof this.recordClassSpecificStat === "function") this.recordClassSpecificStat("warrior", "frenzies", 1);
      return;
    }
    if ((this.skills.warriorMomentum.points || 0) <= 0) return;
    const wasInactive = (this.warriorMomentumTimer || 0) <= 0;
    this.warriorMomentumTimer = Math.max(this.warriorMomentumTimer, this.getWarriorMomentumDuration());
    if (wasInactive && typeof this.recordClassSpecificStat === "function") this.recordClassSpecificStat("warrior", "frenzies", 1);
  },

  spendSkillPoint(skillKey) {
    if (this.isArcherClass && this.isArcherClass()) {
      if (spendRangerUtility(this, skillKey)) {
        if (skillKey === "defense") this.spawnFloatingText(this.player.x, this.player.y - 26, "Defense training improved", "#b7e38a", 0.85, 14);
        else this.spawnFloatingText(this.player.x, this.player.y - 26, "Training improved", "#b7e38a", 0.85, 14);
        return true;
      }
      if (!canSpendRangerNode(this, skillKey) && !canSpendRangerUtility(this, skillKey)) return false;
      if (spendRangerNode(this, skillKey)) {
        if (skillKey === "fleetstep") {
          const hpGain = Math.max(1, this.player.maxHealth * 0.06);
          this.player.maxHealth += hpGain;
          this.player.health = Math.min(this.player.maxHealth, this.player.health + hpGain);
          this.markPlayerHealthBarVisible();
        }
        if (skillKey === "fireArrowActive") {
          this.spawnFloatingText(this.player.x, this.player.y - 26, "Fire Arrow Unlocked!", "#f6b36a", 1.0, 15);
        } else {
          this.spawnFloatingText(this.player.x, this.player.y - 26, "Talent improved", "#9fd9ff", 0.85, 14);
        }
        return true;
      }
      return false;
    }
    if (isNecromancerTalentGame(this)) {
      if (spendNecromancerUtility(this, skillKey)) {
        this.spawnFloatingText(this.player.x, this.player.y - 26, "Training improved", "#b7e38a", 0.85, 14);
        return true;
      }
      if (!canSpendNecromancerNode(this, skillKey) && !canSpendNecromancerUtility(this, skillKey)) return false;
      if (spendNecromancerNode(this, skillKey)) {
        if (skillKey === "deathBoltActive") this.spawnFloatingText(this.player.x, this.player.y - 26, "Death Bolt Unlocked!", "#c4a0ff", 1.0, 15);
        else this.spawnFloatingText(this.player.x, this.player.y - 26, "Talent improved", "#c4a0ff", 0.85, 14);
        return true;
      }
      return false;
    }
    if (isWarriorTalentGame(this)) {
      if (spendWarriorUtility(this, skillKey)) {
        this.spawnFloatingText(this.player.x, this.player.y - 26, "Training improved", "#b7e38a", 0.85, 14);
        return true;
      }
      if (!canSpendWarriorNode(this, skillKey) && !canSpendWarriorUtility(this, skillKey)) return false;
      if (spendWarriorNode(this, skillKey)) {
        if (skillKey === "ironGuard") {
          const hpGain = 8;
          this.player.maxHealth += hpGain;
          this.player.health = Math.min(this.player.maxHealth, this.player.health + hpGain);
          this.markPlayerHealthBarVisible();
        }
        if (skillKey === "rageActive") this.spawnFloatingText(this.player.x, this.player.y - 26, "Rage Unlocked!", "#ff9d8e", 1.0, 15);
        else this.spawnFloatingText(this.player.x, this.player.y - 26, "Talent improved", "#ffcf9b", 0.85, 14);
        return true;
      }
      return false;
    }
    const skill = this.skills[skillKey];
    if (!skill) return false;
    if (this.skillPoints <= 0) return false;
    if (skill.points >= skill.maxPoints) return false;
    if (!this.classSpec.usesRanged && (skillKey === "fireArrow" || skillKey === "piercingStrike" || skillKey === "multiarrow")) {
      return false;
    }
    if (this.classSpec.usesRanged && (skillKey === "warriorMomentum" || skillKey === "warriorRage" || skillKey === "warriorExecute")) {
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
    if (skillKey === "warriorExecute") {
      this.spawnFloatingText(this.player.x, this.player.y - 26, "Execute improved", "#ff6d6d", 0.85, 14);
    }
    return true;
  }
};
