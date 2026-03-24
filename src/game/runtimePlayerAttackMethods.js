import { vecLength } from "../utils.js";

export const runtimePlayerAttackMethods = {
  fire(dx, dy) {
    if (this.isNecromancerClass()) return;
    if (this.player.fireCooldown > 0) return;
    this.player.fireCooldown = this.getPlayerFireCooldown();
    if (!this.classSpec.usesRanged) {
      this.performMeleeAttack(dx, dy);
      return;
    }
    const origin = this.getBowMuzzleOrigin(dx, dy);
    const baseAngle = Math.atan2(origin.dirY, origin.dirX);
    const volleyAngles = this.getMultiarrowAngles(baseAngle);
    const count = volleyAngles.length;
    const releaseTailOffset = 7;
    const damageMultipliers = this.getMultiarrowArrowDamageMultipliers();
    const baseDamage = this.rollPrimaryDamage();
    if (typeof this.recordClassSpecificStat === "function") this.recordClassSpecificStat("ranger", "shotsFired", count);
    if (typeof this.recordPlayerShotTelemetry === "function") {
      const liveAimX = Number.isFinite(this.input?.mouse?.worldX) ? this.input.mouse.worldX : null;
      const liveAimY = Number.isFinite(this.input?.mouse?.worldY) ? this.input.mouse.worldY : null;
      this.recordPlayerShotTelemetry({
        source: "primary",
        playerX: this.player.x,
        playerY: this.player.y,
        moving: !!this.player.moving,
        aimX: liveAimX,
        aimY: liveAimY,
        intendedAngle: baseAngle,
        volleyAngles: volleyAngles.map((angle) => Number(angle.toFixed(6))),
        multishotCount: count,
        projectileSpeed: this.getProjectileSpeed(),
        fireCooldown: this.player.fireCooldown
      });
    }
    for (let i = 0; i < count; i++) {
      const a = volleyAngles[i];
      const speed = this.getProjectileSpeed();
      this.bullets.push({
        x: origin.x + Math.cos(a) * releaseTailOffset,
        y: origin.y + Math.sin(a) * releaseTailOffset,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        angle: a,
        life: 1.1,
        size: 6,
        damage: baseDamage,
        damageMult: damageMultipliers[i] || damageMultipliers[damageMultipliers.length - 1] || 1,
        hitTargets: new Set(),
        ownerId: this.player.id || null
      });
    }
  },

  performMeleeAttack(dx, dy) {
    const range = this.classSpec.meleeRange || 42;
    const hitPadding = Number.isFinite(this.classSpec.meleeHitPadding) ? Math.max(0, this.classSpec.meleeHitPadding) : 0;
    const arcDeg = this.classSpec.meleeArcDeg || 95;
    const arc = (arcDeg * Math.PI) / 180;
    let angle = Math.atan2(dy, dx);
    const halfArc = arc * 0.5;
    let snapTarget = null;
    let bestSnapScore = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies || []) {
      if (!enemy || (enemy.hp || 0) <= 0 || this.isEnemyFriendlyToPlayer(enemy)) continue;
      const ex = enemy.x - this.player.x;
      const ey = enemy.y - this.player.y;
      const dist = vecLength(ex, ey);
      const effectiveRange = range + hitPadding + (enemy.size || 20) * 0.55;
      if (dist > effectiveRange + 14) continue;
      const enemyAngle = Math.atan2(ey, ex);
      let diff = enemyAngle - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > halfArc + 0.38) continue;
      const score = Math.abs(diff) * 100 + dist;
      if (score < bestSnapScore) {
        bestSnapScore = score;
        snapTarget = enemy;
      }
    }
    if (snapTarget) angle = Math.atan2(snapTarget.y - this.player.y, snapTarget.x - this.player.x);
    let executeProc = false;
    this.meleeSwings.push({
      x: this.player.x,
      y: this.player.y,
      angle,
      arc,
      range,
      executeProc: false,
      life: this.config.effects.meleeSwingLife,
      maxLife: this.config.effects.meleeSwingLife,
      ownerId: this.player.id || null
    });
    for (const enemy of this.enemies) {
      const ex = enemy.x - this.player.x;
      const ey = enemy.y - this.player.y;
      const dist = vecLength(ex, ey);
      if (dist > range + hitPadding + enemy.size * 0.45) continue;
      const enemyAngle = Math.atan2(ey, ex);
      let diff = enemyAngle - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) {
        const hpBefore = Number.isFinite(enemy.hp) ? enemy.hp : 0;
        this.applyEnemyDamage(enemy, this.rollPrimaryDamage(), "melee", this.player.id || null);
        const threshold = this.getWarriorExecuteThreshold();
        const chance = this.getWarriorExecuteChance();
        const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
        if (!enemy.isBoss && chance > 0 && enemy.hp > 0 && hpRatio > 0 && hpRatio <= threshold && Math.random() < chance) {
          enemy.hp = 0;
          enemy.pendingExecuteKill = true;
          executeProc = true;
        }
        if (hpBefore > 0 && enemy.hp <= 0 && this.warriorRageActiveTimer > 0 && (!this.isEnemyFriendlyToPlayer || !this.isEnemyFriendlyToPlayer(enemy))) {
          const victoryRushHeal = this.getWarriorRageVictoryRushHeal();
          if (victoryRushHeal > 0) {
            this.warriorRageVictoryRushPool = Math.min(this.getWarriorRageVictoryRushPoolCap(), this.warriorRageVictoryRushPool + victoryRushHeal);
            this.warriorRageVictoryRushTimer += this.getWarriorRageVictoryRushHotDuration();
            this.spawnFloatingText(this.player.x, this.player.y - 32, "Victory Rush", "#ffb3b3", 0.8, 13);
          }
        }
      }
    }
    for (const br of this.breakables || []) {
      const ex = br.x - this.player.x;
      const ey = br.y - this.player.y;
      const dist = vecLength(ex, ey);
      if (dist > range + br.size * 0.45) continue;
      const brAngle = Math.atan2(ey, ex);
      let diff = brAngle - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) br.hp = 0;
    }
    if (executeProc && this.meleeSwings.length > 0) {
      const swing = this.meleeSwings[this.meleeSwings.length - 1];
      swing.executeProc = true;
      swing.life += 0.5;
      swing.maxLife += 0.5;
    }
  },

  fireFireArrow(dx, dy) {
    if (this.isNecromancerClass()) {
      this.fireDeathBolt(dx, dy);
      return;
    }
    if (!this.classSpec.usesRanged) {
      this.activateWarriorRage();
      return;
    }
    if (!this.isFireArrowUnlocked() || this.player.fireArrowCooldown > 0) return;
    this.player.fireArrowCooldown = this.config.fireArrow.cooldown;
    if (typeof this.recordClassSpecificStat === "function") this.recordClassSpecificStat("ranger", "shotsFired", 1);
    const origin = this.getBowMuzzleOrigin(dx, dy);
    const releaseTailOffset = 8;
    this.fireArrows.push({
      x: origin.x + origin.dirX * releaseTailOffset,
      y: origin.y + origin.dirY * releaseTailOffset,
      vx: origin.dirX * this.config.fireArrow.speed,
      vy: origin.dirY * this.config.fireArrow.speed,
      angle: Math.atan2(origin.dirY, origin.dirX),
      life: this.config.fireArrow.life,
      size: 8,
      ownerId: this.player.id || null,
      impactDamage: this.getFireArrowImpactDamage(),
      blastRadius: this.getFireArrowBlastRadius(),
      lingerDuration: this.config.fireArrow.lingerDuration,
      lingerDps: this.getFireArrowLingerDps()
    });
  },

  triggerFireExplosion(x, y, source = null) {
    const sourceState = source && typeof source === "object" ? source : {};
    const blastRadius = Number.isFinite(sourceState.blastRadius) ? sourceState.blastRadius : this.getFireArrowBlastRadius();
    const impactDamage = Number.isFinite(sourceState.impactDamage) ? sourceState.impactDamage : this.getFireArrowImpactDamage();
    const lingerDuration = Number.isFinite(sourceState.lingerDuration) ? sourceState.lingerDuration : this.config.fireArrow.lingerDuration;
    const lingerDps = Number.isFinite(sourceState.lingerDps) ? sourceState.lingerDps : this.getFireArrowLingerDps();
    const ownerId = typeof sourceState.ownerId === "string" && sourceState.ownerId ? sourceState.ownerId : (this.player.id || null);
    for (const enemy of this.enemies) {
      if (this.isEnemyFriendlyToPlayer(enemy)) continue;
      if (vecLength(x - enemy.x, y - enemy.y) <= blastRadius + enemy.size * 0.3) this.applyEnemyDamage(enemy, impactDamage, "fire", ownerId);
    }
    this.fireZones.push({ x, y, radius: blastRadius * 0.9, life: lingerDuration, zoneType: "fire", ownerId, dps: lingerDps });
  },

  fireDeathBolt(dx, dy) {
    if (!this.isNecromancerClass()) return false;
    if ((this.skills.deathBolt.points || 0) <= 0 || this.player.deathBoltCooldown > 0) return false;
    const hpCost = Math.max(1, this.player.maxHealth * (this.config.deathBolt?.hpCostPct || 0.05));
    if (this.player.health <= hpCost) return false;
    const origin = this.getBowMuzzleOrigin(dx, dy);
    this.player.health = Math.max(1, this.player.health - hpCost);
    this.markPlayerHealthBarVisible();
    this.player.deathBoltCooldown = this.config.deathBolt?.cooldown || 10;
    this.bullets.push({
      x: origin.x,
      y: origin.y,
      vx: origin.dirX * (this.config.deathBolt?.speed || 165),
      vy: origin.dirY * (this.config.deathBolt?.speed || 165),
      angle: Math.atan2(origin.dirY, origin.dirX),
      life: this.config.deathBolt?.life || 1.6,
      size: 10,
      projectileType: "deathBolt",
      ownerId: this.player.id || null,
      deathBoltDamage: this.getDeathBoltBaseDamage(),
      deathBoltHealAmount: this.getDeathBoltHealAmount(),
      deathBoltPetDamageMultiplier: this.getDeathBoltPetDamageMultiplier(),
      deathBoltRadius: this.getDeathBoltRadius(),
      pulseInterval: this.config.deathBolt?.pulseInterval || 1,
      visualLife: this.config.deathBolt?.visualLife || 5
    });
    return true;
  },

  triggerDeathBoltExplosion(x, y, source = null) {
    const sourceState = source && typeof source === "object" ? source : {};
    const radius = Number.isFinite(sourceState.deathBoltRadius) ? sourceState.deathBoltRadius : this.getDeathBoltRadius();
    const pulseInterval = Number.isFinite(sourceState.pulseInterval) ? sourceState.pulseInterval : (this.config.deathBolt?.pulseInterval || 1);
    const visualLife = Number.isFinite(sourceState.visualLife) ? sourceState.visualLife : (this.config.deathBolt?.visualLife || 5);
    this.applyDeathBoltPulse(x, y, sourceState);
    this.fireZones.push({
      x,
      y,
      radius,
      life: visualLife,
      pulseTimer: pulseInterval,
      zoneType: "deathBolt",
      ownerId: typeof sourceState.ownerId === "string" && sourceState.ownerId ? sourceState.ownerId : (this.player.id || null),
      deathBoltDamage: Number.isFinite(sourceState.deathBoltDamage) ? sourceState.deathBoltDamage : this.getDeathBoltBaseDamage(),
      deathBoltHealAmount: Number.isFinite(sourceState.deathBoltHealAmount) ? sourceState.deathBoltHealAmount : this.getDeathBoltHealAmount(),
      deathBoltPetDamageMultiplier: Number.isFinite(sourceState.deathBoltPetDamageMultiplier) ? sourceState.deathBoltPetDamageMultiplier : this.getDeathBoltPetDamageMultiplier()
    });
  },

  applyDeathBoltPulse(x, y, source = null) {
    const sourceState = source && typeof source === "object" ? source : {};
    const radius = Number.isFinite(sourceState.deathBoltRadius) ? sourceState.deathBoltRadius : this.getDeathBoltRadius();
    const damage = Number.isFinite(sourceState.deathBoltDamage) ? sourceState.deathBoltDamage : this.getDeathBoltBaseDamage();
    const healAmount = Number.isFinite(sourceState.deathBoltHealAmount) ? sourceState.deathBoltHealAmount : this.getDeathBoltHealAmount();
    const petDamageMultiplier = Number.isFinite(sourceState.deathBoltPetDamageMultiplier) ? sourceState.deathBoltPetDamageMultiplier : this.getDeathBoltPetDamageMultiplier();
    const ownerId = typeof sourceState.ownerId === "string" && sourceState.ownerId ? sourceState.ownerId : (this.player.id || null);
    for (const enemy of this.enemies || []) {
      if (!enemy || (enemy.hp || 0) <= 0) continue;
      if (vecLength(enemy.x - x, enemy.y - y) > radius + (enemy.size || 20) * 0.35) continue;
      if (this.isControlledUndead(enemy)) {
        this.healControlledUndead(enemy, healAmount);
        if (petDamageMultiplier > 1) {
          enemy.damageBuffMultiplier = petDamageMultiplier;
          enemy.damageBuffTimer = Math.max(Number.isFinite(enemy.damageBuffTimer) ? enemy.damageBuffTimer : 0, (this.config.deathBolt?.pulseInterval || 1) + 0.15);
        }
      } else {
        this.applyEnemyDamage(enemy, damage, "death", ownerId);
      }
    }
  },

  triggerExplodingDeath(sourceEnemy) {
    const points = Number.isFinite(sourceEnemy?.controllerExplodingDeathPoints)
      ? sourceEnemy.controllerExplodingDeathPoints
      : (this.skills.explodingDeath.points || 0);
    const ownerId = typeof sourceEnemy?.controllerPlayerId === "string" && sourceEnemy.controllerPlayerId
      ? sourceEnemy.controllerPlayerId
      : (this.player.id || null);
    if (!sourceEnemy || !this.isControlledUndead(sourceEnemy) || points < 3) return;
    const radius = this.getExplodingDeathRadius();
    const damage = this.getDeathExplosionDamage(points);
    for (const enemy of this.enemies || []) {
      if (!enemy || enemy === sourceEnemy || (enemy.hp || 0) <= 0 || this.isEnemyFriendlyToPlayer(enemy)) continue;
      if (vecLength(enemy.x - sourceEnemy.x, enemy.y - sourceEnemy.y) <= radius + (enemy.size || 20) * 0.35) this.applyEnemyDamage(enemy, damage, "death", ownerId);
    }
    this.fireZones.push({ x: sourceEnemy.x, y: sourceEnemy.y, radius, life: this.config.deathBolt?.visualLife || 0.35, zoneType: "deathBurst" });
  }
};
