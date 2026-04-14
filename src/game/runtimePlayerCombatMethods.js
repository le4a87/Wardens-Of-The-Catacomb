import { vecLength } from "../utils.js";
import {
  dropArmorLoot as dropArmorLootEntity,
  dropMinotaurLoot as dropMinotaurLootEntity,
  dropNecromancerLoot as dropNecromancerLootEntity,
  dropTreasureBag as dropTreasureBagEntity,
  maybeSpawnDrop as maybeSpawnDropEntity,
  xpFromEnemy as xpFromEnemyEntity
} from "./enemySystems.js";
import { getRangerTalentPoints } from "./rangerTalentTree.js";

export const runtimePlayerCombatMethods = {
  xpFromEnemy(enemy) {
    return xpFromEnemyEntity(this, enemy);
  },

  gainExperience(amount) {
    if (typeof this.isFloorBossActive === "function" && this.isFloorBossActive()) return;
    this.experience += amount;
    while (this.experience >= this.expToNextLevel) {
      this.experience -= this.expToNextLevel;
      this.level += 1;
      this.skillPoints += this.getSkillPointGainForLevel(this.level, this.classType);
      const hpGain = Number.isFinite(this.classSpec.levelHpGain) ? this.classSpec.levelHpGain : 10;
      const adjustedHpGain = this.classType === "archer"
        ? hpGain * (1 + (getRangerTalentPoints(this, "fleetstep") > 0 ? 0.06 : 0))
        : hpGain;
      this.player.maxHealth += adjustedHpGain;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + adjustedHpGain);
      this.markPlayerHealthBarVisible();
      this.spawnFloatingText(this.player.x, this.player.y - 46, `+${adjustedHpGain.toFixed(1)} Max HP`, "#ff9f9f", 0.95, 14);
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
      const baseAvg = (Math.min(baseMin, baseMax) + Math.max(baseMin, baseMax)) * 0.5;
      const dmgPct = Number.isFinite(this.classSpec.levelWeaponDamagePct) ? this.classSpec.levelWeaponDamagePct : 0.05;
      const dmgGain = Math.max(1, baseAvg * Math.max(0, dmgPct));
      this.levelWeaponDamageBonus += dmgGain;
      this.spawnFloatingText(this.player.x, this.player.y - 62, `+${dmgGain.toFixed(1)} Weapon Dmg`, "#f3d18b", 0.95, 13);
      this.expToNextLevel = Math.floor(this.expToNextLevel * this.config.progression.xpLevelScaling);
      this.spawnFloatingText(
        this.player.x,
        this.player.y - 30,
        `Level ${this.level}! +${this.getSkillPointGainForLevel(this.level, this.classType)} SP`,
        "#9be18a",
        1.2,
        16
      );
      if (this.updateFloorBossTrigger()) {
        const target = this.floorBoss?.triggerLevel || this.getFloorBossTriggerLevel();
        this.spawnFloatingText(this.player.x, this.player.y - 80, `Boss Ready: Lv ${target}`, "#c78bff", 1.4, 16);
      }
    }
  },

  maybeSpawnDrop(x, y) {
    maybeSpawnDropEntity(this, x, y);
  },

  dropTreasureBag(x, y, goldEaten) {
    dropTreasureBagEntity(this, x, y, goldEaten);
  },

  dropArmorLoot(x, y) {
    dropArmorLootEntity(this, x, y);
  },

  dropNecromancerLoot(x, y) {
    dropNecromancerLootEntity(this, x, y);
  },

  dropMinotaurLoot(x, y) {
    dropMinotaurLootEntity(this, x, y);
  },

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
      const angle = volleyAngles[i];
      const speed = this.getProjectileSpeed();
      this.bullets.push({
        x: origin.x + Math.cos(angle) * releaseTailOffset,
        y: origin.y + Math.sin(angle) * releaseTailOffset,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle,
        life: 1.1,
        size: 6,
        damageMult: damageMultipliers[i] || damageMultipliers[damageMultipliers.length - 1] || 1,
        hitTargets: new Set()
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
      maxLife: this.config.effects.meleeSwingLife
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
        this.applyEnemyDamage(enemy, this.rollPrimaryDamage(), "melee");
        const threshold = this.getWarriorExecuteThreshold();
        const chance = this.getWarriorExecuteChance();
        const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
        if (!enemy.isBoss && chance > 0 && enemy.hp > 0 && hpRatio > 0 && hpRatio <= threshold && Math.random() < chance) {
          enemy.hp = 0;
          executeProc = true;
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
  }
};
