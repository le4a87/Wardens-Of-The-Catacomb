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
    const resisted = Math.max(1, Math.round(safeDamage * (1 - resistancePct)));
    const reducedByDefense = Math.max(1, Math.round(resisted - this.getDefenseFlatReduction()));
    return this.getWarriorRageDamageTaken(reducedByDefense);
  },

  getPlayerFireCooldown() {
    const levelAttackBonusPct = Number.isFinite(this.classSpec.levelAttackSpeedPct)
      ? Math.max(0, this.classSpec.levelAttackSpeedPct) * Math.max(0, this.level - 1)
      : 0;
    const attackMultiplier = this.getAttackSpeedMultiplier() * (1 + levelAttackBonusPct);
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
    const scaledMinBase = (minBase + rageBaseBonus) * safeMult;
    const scaledMaxBase = (maxBase + rageBaseBonus) * safeMult;
    return {
      min: scaledMinBase + flatBonus,
      max: scaledMaxBase + flatBonus
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
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    const bonus = 18 * Math.log1p(1.35 * p);
    return this.config.fireArrow.baseBlastRadius + bonus;
  },

  getFireArrowImpactDamage(points = this.skills.fireArrow.points) {
    const p = Number.isFinite(points) ? points : 0;
    const mult = 1 + 0.8 * Math.log1p(1.25 * Math.max(0, p));
    const base = Number.isFinite(this.config.fireArrow.impactDamage) ? this.config.fireArrow.impactDamage : 3.2;
    return base * mult;
  },

  getFireArrowLingerDps(points = this.skills.fireArrow.points) {
    const p = Number.isFinite(points) ? points : 0;
    const mult = 1 + 0.7 * Math.log1p(1.2 * Math.max(0, p));
    const base = Number.isFinite(this.config.fireArrow.lingerDps) ? this.config.fireArrow.lingerDps : 3.6;
    return base * mult;
  },

  getPiercingChance(points = this.skills.piercingStrike.points) {
    const p = Number.isFinite(points) ? points : 0;
    const maxChance = 0.65;
    const scaled = Math.log1p(1.2 * Math.max(0, p)) / Math.log1p(1.2 * this.skills.piercingStrike.maxPoints);
    return maxChance * Math.max(0, Math.min(1, scaled));
  },

  getMultiarrowCount(points = this.skills.multiarrow.points) {
    const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
    const maxPoints = Number.isFinite(this.skills?.multiarrow?.maxPoints) ? this.skills.multiarrow.maxPoints : 8;
    const clamped = Math.min(maxPoints, p);
    return 1 + clamped;
  },

  getMultiarrowDamageMultiplier(points = this.skills.multiarrow.points) {
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
    return this.skills.fireArrow.points > 0;
  },

  getWarriorMomentumDuration(points = this.skills.warriorMomentum.points) {
    const p = Number.isFinite(points) ? points : 0;
    return 0.85 + 0.9 * Math.log1p(1.2 * Math.max(0, p));
  },

  getWarriorMomentumMoveBonus(points = this.skills.warriorMomentum.points) {
    const p = Number.isFinite(points) ? points : 0;
    return 0.2 + 0.33 * Math.log1p(1.3 * Math.max(0, p));
  },

  getWarriorMomentumMultiplier() {
    if (this.classSpec.usesRanged) return 1;
    if (this.warriorMomentumTimer <= 0) return 1;
    return 1 + this.getWarriorMomentumMoveBonus();
  },

  getWarriorRageDuration() {
    const c = this.config.warriorRage || {};
    return Number.isFinite(c.duration) ? c.duration : 10;
  },

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
  },

  getWarriorRageBaseDamageBonus(points = this.skills.warriorRage.points) {
    if (this.classSpec.usesRanged) return 0;
    const c = this.config.warriorRage || {};
    const baseBonus = Number.isFinite(c.baseDamageBonus) ? c.baseDamageBonus : 0.3;
    const perPoint = Number.isFinite(c.baseDamageBonusPerPoint) ? c.baseDamageBonusPerPoint : 0.14;
    const p = Math.max(0, Number.isFinite(points) ? points : 0);
    return baseBonus + perPoint * Math.log1p(1.2 * p);
  },

  getActiveWarriorRageBaseDamageBonus() {
    if (this.classSpec.usesRanged || this.warriorRageActiveTimer <= 0) return 0;
    return this.getWarriorRageBaseDamageBonus();
  },

  getWarriorRageDamageTaken(rawDamage) {
    if (this.classSpec.usesRanged || this.warriorRageActiveTimer <= 0) return rawDamage;
    const safe = Number.isFinite(rawDamage) ? rawDamage : 0;
    return Math.floor(Math.max(0, safe) * 0.5);
  },

  getWarriorRageVictoryRushPerKillPct(points = this.skills.warriorRage.points) {
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
    if (this.classSpec.usesRanged || this.warriorRageActiveTimer <= 0) return 0;
    return Math.max(1, Math.round(this.player.maxHealth * this.getWarriorRageVictoryRushPerKillPct(points)));
  },

  getWarriorRageVictoryRushPoolCap() {
    const c = this.config.warriorRage || {};
    const capPct = Number.isFinite(c.victoryRushPoolCapPct) ? Math.max(0, c.victoryRushPoolCapPct) : 0.2;
    return Math.max(1, this.player.maxHealth * capPct);
  },

  getWarriorRageVictoryRushHotDuration() {
    const c = this.config.warriorRage || {};
    return Number.isFinite(c.victoryRushHotDuration) ? Math.max(0.5, c.victoryRushHotDuration) : 15;
  },

  getWarriorExecuteChance(points = this.skills.warriorExecute.points) {
    if (this.classSpec.usesRanged) return 0;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    if (p <= 0) return 0;
    const maxPoints = Number.isFinite(this.skills?.warriorExecute?.maxPoints) ? this.skills.warriorExecute.maxPoints : 8;
    const span = Math.max(1, maxPoints - 1);
    const norm = span > 0 ? Math.log1p(1.2 * (p - 1)) / Math.log1p(1.2 * span) : 1;
    return 0.10 + 0.20 * Math.max(0, Math.min(1, norm));
  },

  getWarriorExecuteThreshold(points = this.skills.warriorExecute.points) {
    if (this.classSpec.usesRanged) return 0;
    const p = Number.isFinite(points) ? Math.max(0, points) : 0;
    if (p <= 0) return 0;
    const maxPoints = Number.isFinite(this.skills?.warriorExecute?.maxPoints) ? this.skills.warriorExecute.maxPoints : 8;
    const span = Math.max(1, maxPoints - 1);
    const norm = span > 0 ? Math.log1p(1.2 * (p - 1)) / Math.log1p(1.2 * span) : 1;
    return 0.05 + 0.15 * Math.max(0, Math.min(1, norm));
  },

  isWarriorRageUnlocked() {
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
    return true;
  },

  triggerWarriorMomentumOnKill() {
    if (this.classSpec.usesRanged) return;
    if ((this.skills.warriorMomentum.points || 0) <= 0) return;
    this.warriorMomentumTimer = Math.max(this.warriorMomentumTimer, this.getWarriorMomentumDuration());
  },

  spendSkillPoint(skillKey) {
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
