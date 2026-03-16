import { vecLength } from "../utils.js";
import {
  isGoldDrop as isGoldDropEntity,
  findNearestGoldDrop as findNearestGoldDropEntity,
  applyGoblinGrowth as applyGoblinGrowthEntity,
  updateGoblin as updateGoblinEntity,
  updateMimic as updateMimicEntity,
  updateNecromancer as updateNecromancerEntity,
  xpFromEnemy as xpFromEnemyEntity,
  maybeSpawnDrop as maybeSpawnDropEntity,
  dropTreasureBag as dropTreasureBagEntity,
  dropArmorLoot as dropArmorLootEntity,
  dropNecromancerLoot as dropNecromancerLootEntity
} from "./enemySystems.js";
import { GameRuntimeWorld } from "./GameRuntimeWorld.js";

export class GameRuntimeSystems extends GameRuntimeWorld {
  isGoldDrop(drop) {
    return isGoldDropEntity(drop);
  }

  findNearestGoldDrop(x, y) {
    return findNearestGoldDropEntity(this, x, y);
  }

  applyGoblinGrowth(goblin, goldAmount) {
    applyGoblinGrowthEntity(this, goblin, goldAmount);
  }

  updateGoblin(enemy, dt, speedScale) {
    updateGoblinEntity(this, enemy, dt, speedScale);
  }

  updateMimic(enemy, dt, speedScale) {
    updateMimicEntity(this, enemy, dt, speedScale);
  }

  updateNecromancer(enemy, dt, speedScale) {
    updateNecromancerEntity(this, enemy, dt, speedScale);
  }

  xpFromEnemy(enemy) {
    return xpFromEnemyEntity(this, enemy);
  }

  gainExperience(amount) {
    this.experience += amount;
    while (this.experience >= this.expToNextLevel) {
      this.experience -= this.expToNextLevel;
      this.level += 1;
      this.skillPoints += 1;
      const hpGain = Number.isFinite(this.classSpec.levelHpGain) ? this.classSpec.levelHpGain : 10;
      this.player.maxHealth += hpGain;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + hpGain);
      this.markPlayerHealthBarVisible();
      this.spawnFloatingText(this.player.x, this.player.y - 46, `+${hpGain} Max HP`, "#ff9f9f", 0.95, 14);
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
      this.spawnFloatingText(this.player.x, this.player.y - 30, `Level ${this.level}! +1 SP`, "#9be18a", 1.2, 16);
      if (this.updateFloorBossTrigger()) {
        const target = this.floorBoss?.triggerLevel || this.getFloorBossTriggerLevel();
        this.spawnFloatingText(this.player.x, this.player.y - 80, `Boss Ready: Lv ${target}`, "#c78bff", 1.4, 16);
      }
    }
  }

  maybeSpawnDrop(x, y) {
    maybeSpawnDropEntity(this, x, y);
  }

  dropTreasureBag(x, y, goldEaten) {
    dropTreasureBagEntity(this, x, y, goldEaten);
  }

  dropArmorLoot(x, y) {
    dropArmorLootEntity(this, x, y);
  }

  dropNecromancerLoot(x, y) {
    dropNecromancerLootEntity(this, x, y);
  }

  fire(dx, dy) {
    if (this.player.fireCooldown > 0) return;
    this.player.fireCooldown = this.getPlayerFireCooldown();
    if (!this.classSpec.usesRanged) {
      this.performMeleeAttack(dx, dy);
      return;
    }
    const origin = this.getBowMuzzleOrigin(dx, dy);
    const baseAngle = Math.atan2(origin.dirY, origin.dirX);
    const count = this.getMultiarrowCount();
    const spreadDeg = this.getMultiarrowSpreadDeg();
    const spreadRad = (spreadDeg * Math.PI) / 180;
    // Arrow sprite tail sits ~7px behind its local origin; push spawn forward so tail aligns with bow center.
    const releaseTailOffset = 7;
    const damageMult = this.getMultiarrowDamageMultiplier();

    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0 : i / (count - 1);
      const offset = count <= 1 ? 0 : (t - 0.5) * spreadRad;
      const a = baseAngle + offset;
      const speed = this.getProjectileSpeed();
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      this.bullets.push({
        x: origin.x + Math.cos(a) * releaseTailOffset,
        y: origin.y + Math.sin(a) * releaseTailOffset,
        vx,
        vy,
        angle: a,
        life: 1.1,
        size: 6,
        damageMult,
        hitTargets: new Set()
      });
    }
  }

  performMeleeAttack(dx, dy) {
    const range = this.classSpec.meleeRange || 42;
    const arcDeg = this.classSpec.meleeArcDeg || 95;
    const arc = (arcDeg * Math.PI) / 180;
    const angle = Math.atan2(dy, dx);
    this.meleeSwings.push({
      x: this.player.x,
      y: this.player.y,
      angle,
      arc,
      range,
      life: this.config.effects.meleeSwingLife,
      maxLife: this.config.effects.meleeSwingLife
    });

    const halfArc = arc * 0.5;
    for (const enemy of this.enemies) {
      const ex = enemy.x - this.player.x;
      const ey = enemy.y - this.player.y;
      const dist = vecLength(ex, ey);
      if (dist > range + enemy.size * 0.45) continue;
      const enemyAngle = Math.atan2(ey, ex);
      let diff = enemyAngle - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) this.applyEnemyDamage(enemy, this.rollPrimaryDamage(), "melee");
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
  }

  fireFireArrow(dx, dy) {
    if (!this.classSpec.usesRanged) {
      this.activateWarriorRage();
      return;
    }
    if (!this.isFireArrowUnlocked()) return;
    if (this.player.fireArrowCooldown > 0) return;
    this.player.fireArrowCooldown = this.config.fireArrow.cooldown;
    const origin = this.getBowMuzzleOrigin(dx, dy);
    const releaseTailOffset = 8;
    this.fireArrows.push({
      x: origin.x + origin.dirX * releaseTailOffset,
      y: origin.y + origin.dirY * releaseTailOffset,
      vx: origin.dirX * this.config.fireArrow.speed,
      vy: origin.dirY * this.config.fireArrow.speed,
      angle: Math.atan2(origin.dirY, origin.dirX),
      life: this.config.fireArrow.life,
      size: 8
    });
  }

  triggerFireExplosion(x, y) {
    const blastRadius = this.getFireArrowBlastRadius();
    for (const enemy of this.enemies) {
      if (vecLength(x - enemy.x, y - enemy.y) <= blastRadius + enemy.size * 0.3) {
        this.applyEnemyDamage(enemy, this.getFireArrowImpactDamage(), "fire");
      }
    }
    this.fireZones.push({ x, y, radius: blastRadius * 0.9, life: this.config.fireArrow.lingerDuration });
  }

}
