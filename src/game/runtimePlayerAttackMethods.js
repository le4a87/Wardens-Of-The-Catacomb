import { vecLength } from "../utils.js";
import {
  getRangerFireArrowProjectileSizeBonus,
  getRangerArrowBonusAgainstEnemy,
  getRangerCritChance,
  getRangerCritMultiplier,
  getRangerIgniteChance,
  getRangerPinningShotLengthTiles,
  hasFireMastery,
  hasPinningShot,
  hasTrickShot,
  shouldSpreadWildfire
} from "./rangerTalentTree.js";
import {
  getWarriorButchersPathNextHitArcBonus,
  getWarriorButchersPathNextHitDamageBonus,
  getWarriorBattleFrenzyDamageBonus,
  getWarriorCrusaderUndeadDamageBonus,
  getWarriorExecutionerRageCleaveWidthBonus,
  getWarriorExecutionerRageRangeBonus,
  getWarriorHeavyHandCleaveArcBonus,
  getWarriorHeavyHandDamageBonus,
  getWarriorJudgmentWaveChance,
  getWarriorJudgmentWaveDamageMultiplier,
  getWarriorJudgmentWaveShredPct,
  hasWarriorButchersPath,
  hasWarriorCleaveDiscipline,
  hasWarriorJudgmentWave,
  isWarriorRaging,
  isWarriorTalentGame
} from "./warriorTalentTree.js";
import {
  getNecromancerDeathBoltCooldownReduction,
  getNecromancerDeathBoltZoneDurationMultiplier,
  getNecromancerCurseDuration,
  getNecromancerDeathBoltGhostSpawnChance,
  getNecromancerDeathBoltMasteryTempHpOnKill,
  getNecromancerTempHpCap,
  getNecromancerExplodingDeathDamage,
  getNecromancerExplodingDeathRadiusTiles,
  getNecromancerRotDps,
  getNecromancerRotDuration,
  hasNecromancerBlightstorm,
  hasNecromancerCurse,
  hasNecromancerDeathBolt,
  hasNecromancerExplodingDeath,
  hasNecromancerPlaguecraftDeathBurst,
  hasNecromancerPlaguecraftRot,
  isNecromancerTalentGame
} from "./necromancerTalentTree.js";
import { spawnGhost } from "./enemySpawnFactories.js";

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
    const critChance = getRangerCritChance(this);
    const critMultiplier = getRangerCritMultiplier();
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
        critMultiplier: Math.random() < critChance ? critMultiplier : 1,
        remainingRicochets: hasTrickShot(this) ? 2 : 0,
        linebreakerHits: 0,
        hitTargets: new Set(),
        ownerId: this.player.id || null
      });
    }
  },

  performMeleeAttack(dx, dy) {
    let range = this.classSpec.meleeRange || 42;
    const hitPadding = Number.isFinite(this.classSpec.meleeHitPadding) ? Math.max(0, this.classSpec.meleeHitPadding) : 0;
    let arcDeg = this.classSpec.meleeArcDeg || 95;
    const raging = isWarriorTalentGame(this) ? isWarriorRaging(this) : (this.warriorRageActiveTimer || 0) > 0;
    if (isWarriorTalentGame(this)) {
      range *= 1 + getWarriorExecutionerRageRangeBonus(this) * (raging ? 1 : 0);
      arcDeg *= 1 + getWarriorHeavyHandCleaveArcBonus(this);
      if (raging) arcDeg *= 1 + getWarriorExecutionerRageCleaveWidthBonus(this);
      this.warriorRuntime = this.warriorRuntime && typeof this.warriorRuntime === "object"
        ? this.warriorRuntime
        : (this.player?.warriorRuntime && typeof this.player.warriorRuntime === "object" ? this.player.warriorRuntime : {});
      if (this.player) this.player.warriorRuntime = this.warriorRuntime;
      if ((this.warriorRuntime.rageArcTimer || 0) > 0) arcDeg = 360;
      else if (this.warriorRuntime.butcherEmpowerReady) arcDeg *= 1 + getWarriorButchersPathNextHitArcBonus(this);
    }
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
    let consumedButcherEmpower = false;
    const guaranteedCrit = !!(this.warriorRuntime?.rageCritReady || this.warriorRuntime?.butcherCritReady);
    const critMultiplier = guaranteedCrit ? (raging && hasWarriorCleaveDiscipline(this) ? 2.2 : 2) : 1;
    if (isWarriorTalentGame(this)) {
      this.warriorRuntime.rageCritReady = false;
      this.warriorRuntime.butcherCritReady = false;
    }
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
    let enemiesHit = 0;
    let firstEnemyHit = false;
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
        let damage = this.rollPrimaryDamage();
        if (isWarriorTalentGame(this)) {
          damage *= 1 + getWarriorHeavyHandDamageBonus(this, enemy);
          damage *= 1 + getWarriorCrusaderUndeadDamageBonus(this, enemy);
          if ((this.warriorMomentumTimer || 0) > 0) damage *= 1 + getWarriorBattleFrenzyDamageBonus(this);
          if (this.warriorRuntime?.butcherEmpowerReady) {
            damage *= 1 + getWarriorButchersPathNextHitDamageBonus(this);
            consumedButcherEmpower = true;
          }
          damage *= critMultiplier;
        }
        this.applyEnemyDamage(enemy, damage, "melee", this.player.id || null);
        if (typeof this.applyConsumableOnHitEffects === "function") this.applyConsumableOnHitEffects(enemy, this.player.id || null);
        enemiesHit += 1;
        firstEnemyHit = true;
        const threshold = this.getWarriorExecuteThreshold();
        const chance = this.getWarriorExecuteChance();
        const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
        if (!enemy.isBoss && chance > 0 && enemy.hp > 0 && hpRatio > 0 && hpRatio <= threshold && Math.random() < chance) {
          enemy.hp = 0;
          enemy.pendingExecuteKill = true;
          executeProc = true;
          if (isWarriorTalentGame(this) && hasWarriorButchersPath(this)) {
            this.warriorRuntime.butcherCritReady = true;
            this.warriorRuntime.butcherEmpowerReady = true;
          }
        }
        if (isWarriorTalentGame(this) && hpBefore > 0 && enemy.hp <= 0 && raging && (!this.isEnemyFriendlyToPlayer || !this.isEnemyFriendlyToPlayer(enemy))) {
          if ((this.warriorTalents?.battleFrenzy?.points || 0) > 0) {
            const victoryRushHeal = this.getWarriorRageVictoryRushHeal();
            if (victoryRushHeal > 0) {
              this.warriorRageVictoryRushPool = Math.min(this.getWarriorRageVictoryRushPoolCap(), (this.warriorRageVictoryRushPool || 0) + victoryRushHeal);
              this.warriorRageVictoryRushTimer = this.getWarriorRageVictoryRushHotDuration();
              this.spawnFloatingText(this.player.x, this.player.y - 32, "Victory Rush", "#ffb3b3", 0.8, 13);
            }
          }
          if ((this.warriorTalents?.rageMastery?.points || 0) > 0) {
            this.warriorRageActiveTimer = Math.min(this.getWarriorRageDuration(), (this.warriorRageActiveTimer || 0) + 0.1);
          }
        }
      }
    }
    if (consumedButcherEmpower && this.warriorRuntime?.butcherEmpowerReady) this.warriorRuntime.butcherEmpowerReady = false;
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
    if (isWarriorTalentGame(this) && hasWarriorJudgmentWave(this) && Math.random() < getWarriorJudgmentWaveChance(this)) {
      const tile = this.config?.map?.tile || 32;
      const life = 0.9;
      const speed = (tile * 10) / life;
      this.bullets.push({
        x: this.player.x + Math.cos(angle) * (range * 0.45),
        y: this.player.y + Math.sin(angle) * (range * 0.45),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle,
        life,
        size: 28,
        faction: "player",
        projectileType: "holyWave",
        damage: this.rollPrimaryDamage() * getWarriorJudgmentWaveDamageMultiplier(this),
        damageType: "holy",
        hitTargets: new Set(),
        ownerId: this.player.id || null,
        undeadDefenseShredPct: getWarriorJudgmentWaveShredPct(this),
        waveArc: arc
      });
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
    this.player.fireArrowCooldown = this.getRangerFireArrowCooldown();
    if (typeof this.recordClassSpecificStat === "function") this.recordClassSpecificStat("ranger", "shotsFired", 1);
    const origin = this.getBowMuzzleOrigin(dx, dy);
    const releaseTailOffset = 8;
    const speed = this.config.fireArrow.speed;
    const life = this.config.fireArrow.life;
    const maxTravelDistance = speed * life;
    const clickedX = Number.isFinite(this.input?.mouse?.worldX) ? this.input.mouse.worldX : (origin.x + origin.dirX * maxTravelDistance);
    const clickedY = Number.isFinite(this.input?.mouse?.worldY) ? this.input.mouse.worldY : (origin.y + origin.dirY * maxTravelDistance);
    const detonateDistance = Math.min(maxTravelDistance, vecLength(clickedX - origin.x, clickedY - origin.y) || maxTravelDistance);
    this.fireArrows.push({
      x: origin.x + origin.dirX * releaseTailOffset,
      y: origin.y + origin.dirY * releaseTailOffset,
      vx: origin.dirX * speed,
      vy: origin.dirY * speed,
      angle: Math.atan2(origin.dirY, origin.dirX),
      life,
      size: 8 + getRangerFireArrowProjectileSizeBonus(this),
      ownerId: this.player.id || null,
      impactDamage: this.getFireArrowImpactDamage(),
      blastRadius: this.getFireArrowBlastRadius(),
      lingerDuration: this.config.fireArrow.lingerDuration * this.getRangerFireArrowDurationMultiplier(),
      lingerDps: this.getFireArrowLingerDps(),
      pinningShot: hasPinningShot(this),
      detonateX: hasFireMastery(this) ? origin.x + origin.dirX * detonateDistance : null,
      detonateY: hasFireMastery(this) ? origin.y + origin.dirY * detonateDistance : null
    });
  },

  triggerFireExplosion(x, y, source = null) {
    const sourceState = source && typeof source === "object" ? source : {};
    const blastRadius = Number.isFinite(sourceState.blastRadius) ? sourceState.blastRadius : this.getFireArrowBlastRadius();
    const impactDamage = Number.isFinite(sourceState.impactDamage) ? sourceState.impactDamage : this.getFireArrowImpactDamage();
    const lingerDuration = Number.isFinite(sourceState.lingerDuration) ? sourceState.lingerDuration : this.config.fireArrow.lingerDuration;
    const lingerDps = Number.isFinite(sourceState.lingerDps) ? sourceState.lingerDps : this.getFireArrowLingerDps();
    const ownerId = typeof sourceState.ownerId === "string" && sourceState.ownerId ? sourceState.ownerId : (this.player.id || null);
    if (sourceState.pinningShot) {
      const tile = this.config.map?.tile || 32;
      const angle = Number.isFinite(sourceState.angle) ? sourceState.angle : 0;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const lineLength = tile * getRangerPinningShotLengthTiles(this);
      const zoneRadius = Math.max(10, tile * 0.42);
      const segmentSpacing = tile;
      for (const enemy of this.enemies) {
        if (this.isEnemyFriendlyToPlayer(enemy)) continue;
        const relX = (enemy.x || 0) - x;
        const relY = (enemy.y || 0) - y;
        const along = relX * dirX + relY * dirY;
        const lateral = Math.abs(relX * -dirY + relY * dirX);
        if (along < 0 || along > lineLength) continue;
        if (lateral > zoneRadius + (enemy.size || 20) * 0.4) continue;
        enemy.pinningSlowTimer = Math.max(enemy.pinningSlowTimer || 0, 1.75);
        enemy.pinningSlowPct = Math.max(enemy.pinningSlowPct || 0, 0.25);
        this.applyEnemyDamage(enemy, impactDamage, "fire", ownerId);
      }
      for (let dist = 0; dist <= lineLength; dist += segmentSpacing) {
        this.fireZones.push({
          x: x + dirX * dist,
          y: y + dirY * dist,
          radius: zoneRadius,
          life: lingerDuration,
          zoneType: "pinningFire",
          ownerId,
          dps: lingerDps
        });
      }
      return;
    }
    for (const enemy of this.enemies) {
      if (this.isEnemyFriendlyToPlayer(enemy)) continue;
      if (vecLength(x - enemy.x, y - enemy.y) <= blastRadius + enemy.size * 0.3) this.applyEnemyDamage(enemy, impactDamage, "fire", ownerId);
    }
    this.fireZones.push({ x, y, radius: blastRadius * 0.9, life: lingerDuration, zoneType: "fire", ownerId, dps: lingerDps });
  },

  applyRangerOnHitEffects(enemy, x, y) {
    if (!(this.isArcherClass && this.isArcherClass()) || !enemy) return;
    if (Math.random() < getRangerIgniteChance(this)) {
      enemy.burningTimer = Math.max(enemy.burningTimer || 0, 2.2);
      enemy.burningDps = Math.max(enemy.burningDps || 0, Math.max(1, this.getFireArrowLingerDps() * 0.35));
    }
    if (shouldSpreadWildfire(this) && (enemy.burningTimer || 0) > 0) {
      for (const other of this.enemies || []) {
        if (!other || other === enemy || this.isEnemyFriendlyToPlayer(other)) continue;
        if (vecLength((other.x || 0) - enemy.x, (other.y || 0) - enemy.y) > (this.config.map?.tile || 32) * 1.35) continue;
        if (Math.random() >= 0.25) continue;
        other.burningTimer = Math.max(other.burningTimer || 0, 1.4);
        other.burningDps = Math.max(other.burningDps || 0, Math.max(1, this.getFireArrowLingerDps() * 0.25));
      }
    }
  },

  getRangerArrowDamageAgainst(enemy, projectile) {
    const projectileDamage = Number.isFinite(projectile?.damage) ? projectile.damage : this.rollPrimaryDamage();
    const damageMult = Number.isFinite(projectile?.damageMult) ? projectile.damageMult : 1;
    const critMult = Number.isFinite(projectile?.critMultiplier) ? projectile.critMultiplier : 1;
    const linebreakerMult = 1 + this.getRangerLinebreakerDamageBonus(projectile?.linebreakerHits || 0);
    const pinningLineMult = projectile?.passedPinningFire ? 1.1 : 1;
    return projectileDamage * damageMult * critMult * linebreakerMult * pinningLineMult * getRangerArrowBonusAgainstEnemy(this, enemy);
  },

  fireDeathBolt(dx, dy) {
    if (!this.isNecromancerClass()) return false;
    if ((isNecromancerTalentGame(this) ? !hasNecromancerDeathBolt(this) : (this.skills.deathBolt.points || 0) <= 0) || this.player.deathBoltCooldown > 0) return false;
    const hpCost = Math.max(1, this.player.maxHealth * (this.config.deathBolt?.hpCostPct || 0.05));
    if (this.player.health <= hpCost) return false;
    const origin = this.getBowMuzzleOrigin(dx, dy);
    const speed = this.config.deathBolt?.speed || 165;
    const life = this.config.deathBolt?.life || 1.6;
    const maxTravelDistance = speed * life;
    const clickedX = Number.isFinite(this.input?.mouse?.worldX) ? this.input.mouse.worldX : (origin.x + origin.dirX * maxTravelDistance);
    const clickedY = Number.isFinite(this.input?.mouse?.worldY) ? this.input.mouse.worldY : (origin.y + origin.dirY * maxTravelDistance);
    const toClickX = clickedX - origin.x;
    const toClickY = clickedY - origin.y;
    const clickDistance = vecLength(toClickX, toClickY);
    const travelDistance = Math.min(maxTravelDistance, clickDistance || maxTravelDistance);
    const detonateX = origin.x + origin.dirX * travelDistance;
    const detonateY = origin.y + origin.dirY * travelDistance;
    this.player.health = Math.max(1, this.player.health - hpCost);
    this.markPlayerHealthBarVisible();
    this.player.deathBoltCooldown = Math.max(0.5, (this.config.deathBolt?.cooldown || 10) - (isNecromancerTalentGame(this) ? getNecromancerDeathBoltCooldownReduction(this) : 0));
    const baseAngles = hasNecromancerBlightstorm(this) ? [-0.24, 0, 0.24] : [0];
    const forwardAngle = Math.atan2(origin.dirY, origin.dirX);
    for (const angleOffset of baseAngles) {
      const angle = forwardAngle + angleOffset;
      const targetX = origin.x + Math.cos(angle) * travelDistance;
      const targetY = origin.y + Math.sin(angle) * travelDistance;
      this.bullets.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle,
        life,
        size: 10,
        projectileType: "deathBolt",
        ownerId: this.player.id || null,
        detonateX: targetX,
        detonateY: targetY,
        deathBoltDamage: this.getDeathBoltBaseDamage(),
        deathBoltHealAmount: this.getDeathBoltHealAmount(),
        deathBoltPetDamageMultiplier: this.getDeathBoltPetDamageMultiplier(),
        deathBoltRadius: this.getDeathBoltRadius(),
        pulseInterval: this.config.deathBolt?.pulseInterval || 1,
        visualLife: (this.config.deathBolt?.visualLife || 5) * (isNecromancerTalentGame(this) ? getNecromancerDeathBoltZoneDurationMultiplier(this) : 1)
      });
    }
    if (isNecromancerTalentGame(this) && this.necromancerRuntime && Number.isFinite(this.necromancerRuntime.harvesterBonusPct)) {
      this.necromancerRuntime.harvesterBonusPct = 0;
    }
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
    const deathBoltDamageType = isNecromancerTalentGame(this) && hasNecromancerCurse(this) ? "poison" : "death";
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
        this.applyEnemyDamage(enemy, damage, deathBoltDamageType, ownerId);
        if (isNecromancerTalentGame(this) && hasNecromancerCurse(this)) {
          enemy.curseTimer = Math.max(enemy.curseTimer || 0, getNecromancerCurseDuration(this));
        }
        if ((enemy.hp || 0) <= 0 && isNecromancerTalentGame(this)) {
          const spawnChance = getNecromancerDeathBoltGhostSpawnChance(this);
          if (spawnChance > 0 && this.canControlMoreUndead() && Math.random() < spawnChance) {
            const ghost = spawnGhost(this, enemy.x, enemy.y);
            if (ghost && this.markUndeadAsControlled(ghost)) {
              this.enemies.push(ghost);
              ghost.hp = ghost.maxHp;
              if (typeof this.spawnFloatingText === "function") {
                this.spawnFloatingText(enemy.x, enemy.y - 30, "Raised", "#b6d9ff", 0.85, 13);
              }
            }
          }
          const tempHpGain = getNecromancerDeathBoltMasteryTempHpOnKill(this);
          if (tempHpGain > 0) {
            const runtime = this.necromancerRuntime || (this.necromancerRuntime = {});
            const cap = getNecromancerTempHpCap(this);
            runtime.tempHp = Math.min(cap, Math.max(0, Number.isFinite(runtime.tempHp) ? runtime.tempHp : 0) + tempHpGain);
            if (typeof this.markPlayerHealthBarVisible === "function") this.markPlayerHealthBarVisible();
            if (tempHpGain > 0 && typeof this.spawnFloatingText === "function") {
              this.spawnFloatingText(this.player.x, this.player.y - 34, `+${tempHpGain} THP`, "#9edcff", 0.7, 13);
            }
          }
        }
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
    if (!sourceEnemy || !this.isControlledUndead(sourceEnemy)) return;
    if (isNecromancerTalentGame(this) && !hasNecromancerExplodingDeath(this) && !hasNecromancerPlaguecraftDeathBurst(this)) return;
    if (!isNecromancerTalentGame(this) && points < 3) return;
    const radius = isNecromancerTalentGame(this)
      ? getNecromancerExplodingDeathRadiusTiles() * this.config.map.tile
      : this.getExplodingDeathRadius();
    const damage = isNecromancerTalentGame(this) ? getNecromancerExplodingDeathDamage() : this.getDeathExplosionDamage(points);
    for (const enemy of this.enemies || []) {
      if (!enemy || enemy === sourceEnemy || (enemy.hp || 0) <= 0 || this.isEnemyFriendlyToPlayer(enemy)) continue;
      if (vecLength(enemy.x - sourceEnemy.x, enemy.y - sourceEnemy.y) <= radius + (enemy.size || 20) * 0.35) {
        this.applyEnemyDamage(enemy, damage, "death", ownerId);
        if (isNecromancerTalentGame(this) && hasNecromancerPlaguecraftDeathBurst(this)) {
          enemy.rotTimer = Math.max(enemy.rotTimer || 0, getNecromancerRotDuration());
          enemy.rotDps = Math.max(enemy.rotDps || 0, getNecromancerRotDps(this));
        }
      }
    }
    this.fireZones.push({ x: sourceEnemy.x, y: sourceEnemy.y, radius, life: 0.12, zoneType: "deathBurst" });
    if (isNecromancerTalentGame(this) && hasNecromancerExplodingDeath(this)) {
      const runtime = this.necromancerRuntime || (this.necromancerRuntime = {});
      const wasInactive = (runtime.vigorTimer || 0) <= 0;
      runtime.vigorTimer = Math.max(runtime.vigorTimer || 0, 5);
      runtime.vigorBeamTimer = Math.max(runtime.vigorBeamTimer || 0, 2);
      runtime.vigorTotalDuration = 5;
      runtime.vigorHealPool = Math.max(runtime.vigorHealPool || 0, this.player.maxHealth * 0.15);
      if (wasInactive && typeof this.spawnFloatingText === "function") {
        this.spawnFloatingText(this.player.x, this.player.y - 36, "Vigor of Life", "#d7b8ff", 0.95, 15);
      }
    }
  }
};
