import { vecLength } from "../utils.js";
import {
  isGoldDrop as isGoldDropEntity,
  findNearestGoldDrop as findNearestGoldDropEntity,
  applyGoblinGrowth as applyGoblinGrowthEntity,
  updateGoblin as updateGoblinEntity,
  updateMimic as updateMimicEntity,
  updateRatArcher as updateRatArcherEntity,
  updateSkeletonWarrior as updateSkeletonWarriorEntity,
  updateNecromancer as updateNecromancerEntity,
  updateMinotaur as updateMinotaurEntity,
  getEnemyTacticKey as getEnemyTacticKeyEntity,
  getEnemyTacticDefinition as getEnemyTacticDefinitionEntity,
  ensureEnemyTacticsState as ensureEnemyTacticsStateEntity,
  setEnemyTacticPhase as setEnemyTacticPhaseEntity,
  updateEnemyTactics as updateEnemyTacticsEntity
} from "./enemySystems.js";
import { GameRuntimeWorld } from "./GameRuntimeWorld.js";
import { runtimePlayerCombatMethods } from "./runtimePlayerCombatMethods.js";

export class GameRuntimeSystems extends GameRuntimeWorld {
  getControlledUndeadFormationPoint(enemy) {
    const allies = (this.enemies || []).filter((entry) => this.isControlledUndead(entry) && (entry.hp || 0) > 0 && !(entry.type === "skeleton_warrior" && entry.collapsed));
    const index = allies.indexOf(enemy);
    const count = Math.max(1, allies.length);
    const slot = index >= 0 ? index : 0;
    const moveDx = (this.player.x || 0) - (this.player.lastX || this.player.x || 0);
    const moveDy = (this.player.y || 0) - (this.player.lastY || this.player.y || 0);
    const moveLen = vecLength(moveDx, moveDy);
    if (moveLen > 0.2) {
      this.player.formationDirX = moveDx / moveLen;
      this.player.formationDirY = moveDy / moveLen;
    }
    const dirX = Number.isFinite(this.player.formationDirX) ? this.player.formationDirX : 0;
    const dirY = Number.isFinite(this.player.formationDirY) ? this.player.formationDirY : 1;
    const backX = -dirX;
    const backY = -dirY;
    const sideX = -backY;
    const sideY = backX;
    const spread = Math.min(Math.PI * 0.95, Math.PI * (0.45 + count * 0.12));
    const t = count <= 1 ? 0.5 : slot / (count - 1);
    const angle = -spread * 0.5 + spread * t;
    const ring = 44 + Math.floor(slot / 5) * 22;
    const offsetX = backX * Math.cos(angle) - sideX * Math.sin(angle);
    const offsetY = backY * Math.cos(angle) - sideY * Math.sin(angle);
    return {
      x: this.player.x + offsetX * ring,
      y: this.player.y + offsetY * ring
    };
  }

  getEnemyTargetPoint(sourceEnemy) {
    if (!sourceEnemy) return this.player;
    const leash = (this.config.necromancer?.aggroRangeTiles || 6.5) * this.config.map.tile;
    let best = this.player;
    let bestDist = Number.POSITIVE_INFINITY;
    const sourceFriendly = this.isEnemyFriendlyToPlayer(sourceEnemy);
    const hasLineOfSight = (x0, y0, x1, y1) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = vecLength(dx, dy);
      if (dist <= 1) return true;
      const tile = this.config?.map?.tile || 32;
      const step = Math.max(8, tile * 0.35);
      const steps = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const sx = x0 + dx * t;
        const sy = y0 + dy * t;
        if (this.isWallAt(sx, sy, false)) return false;
      }
      return true;
    };
    for (const enemy of this.enemies || []) {
      if (!enemy || enemy === sourceEnemy || (enemy.hp || 0) <= 0) continue;
      if (sourceFriendly && this.necromancerBeam?.active && this.necromancerBeam.targetEnemy === enemy) continue;
      if (sourceFriendly && enemy.type === "mimic" && enemy.dormant) continue;
      if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
      const enemyFriendly = this.isEnemyFriendlyToPlayer(enemy);
      if (enemyFriendly === sourceFriendly) continue;
      if (sourceFriendly && !hasLineOfSight(sourceEnemy.x, sourceEnemy.y, enemy.x, enemy.y)) continue;
      const dist = vecLength(enemy.x - sourceEnemy.x, enemy.y - sourceEnemy.y);
      if (dist < bestDist && (sourceFriendly || dist <= leash)) {
        best = enemy;
        bestDist = dist;
      }
    }
    if (!sourceFriendly) {
      const playerDist = vecLength(this.player.x - sourceEnemy.x, this.player.y - sourceEnemy.y);
      if (playerDist <= bestDist || best === this.player) return this.player;
    }
    return best;
  }

  moveEnemyTowardTarget(enemy, target, speedScale, dt, minDistance = 0) {
    if (!enemy || !target) return;
    const appliedScale = this.isEnemyFriendlyToPlayer(enemy) ? 1 : (Number.isFinite(speedScale) ? speedScale : 1);
    if (typeof this.moveEnemyTowardTargetPoint === "function") {
      this.moveEnemyTowardTargetPoint(enemy, target, appliedScale, dt, minDistance);
    }
  }

  updateGenericEnemy(enemy, dt, speedScale) {
    const target = this.getEnemyTargetPoint(enemy);
    if (this.isEnemyFriendlyToPlayer(enemy)) {
      enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, this.getPlayerMoveSpeed() * 1.1);
      const aggro = (this.config.necromancer?.aggroRangeTiles || 6.5) * this.config.map.tile;
      const follow = (this.config.necromancer?.followDistanceTiles || 2.2) * this.config.map.tile;
      if (target !== this.player && vecLength(target.x - enemy.x, target.y - enemy.y) <= aggro) {
        this.moveEnemyTowardTarget(enemy, target, speedScale, dt, 6);
      } else {
        const anchor = this.getControlledUndeadFormationPoint(enemy);
        const distToAnchor = vecLength(anchor.x - enemy.x, anchor.y - enemy.y);
        if (distToAnchor > follow * 0.35) this.moveEnemyTowardTarget(enemy, anchor, speedScale, dt, 4);
      }
      return;
    }
    this.moveEnemyTowardTarget(
      enemy,
      target,
      speedScale,
      dt,
      target === this.player ? this.getPlayerEnemyCollisionRadius() + enemy.size * 0.5 : 6
    );
  }

  fireWallTrap(trap) {
    if (!trap) return;
    const cfg = this.config?.traps?.wall || {};
    const tile = this.config?.map?.tile || 32;
    const speed = Number.isFinite(cfg.projectileSpeed) ? cfg.projectileSpeed : 520;
    const life = Number.isFinite(cfg.projectileLife) ? cfg.projectileLife : 1.6;
    const size = Number.isFinite(cfg.projectileSize) ? cfg.projectileSize : 7;
    const damageRange = this.getWallTrapDamageRange();
    const muzzleOffset = Math.max(tile * 0.5 + 4, (Number.isFinite(trap.size) ? trap.size : 18) * 0.6);
    trap.spotted = true;
    this.bullets.push({
      x: trap.x + trap.dirX * muzzleOffset,
      y: trap.y + trap.dirY * muzzleOffset,
      vx: trap.dirX * speed,
      vy: trap.dirY * speed,
      angle: Math.atan2(trap.dirY, trap.dirX),
      life,
      size,
      projectileType: "trapArrow",
      damageMin: damageRange.min,
      damageMax: damageRange.max
    });
    trap.cooldown = this.getWallTrapResetTime();
  }

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

  updateRatArcher(enemy, dt, speedScale) {
    updateRatArcherEntity(this, enemy, dt, speedScale);
  }

  updateSkeletonWarrior(enemy, dt, speedScale) {
    updateSkeletonWarriorEntity(this, enemy, dt, speedScale);
  }

  updateNecromancer(enemy, dt, speedScale) {
    updateNecromancerEntity(this, enemy, dt, speedScale);
  }

  updateMinotaur(enemy, dt, speedScale) {
    updateMinotaurEntity(this, enemy, dt, speedScale);
  }

  getEnemyTacticKey(enemy) {
    return getEnemyTacticKeyEntity(enemy);
  }

  getEnemyTacticDefinition(enemy) {
    return getEnemyTacticDefinitionEntity(enemy);
  }

  ensureEnemyTacticsState(enemy) {
    return ensureEnemyTacticsStateEntity(enemy);
  }

  setEnemyTacticPhase(enemy, phase) {
    return setEnemyTacticPhaseEntity(enemy, phase);
  }

  updateEnemyTactics(enemy, dt, speedScale) {
    return updateEnemyTacticsEntity(this, enemy, dt, speedScale);
  }

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
    // Arrow sprite tail sits ~7px behind its local origin; push spawn forward so tail aligns with bow center.
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
      const a = volleyAngles[i];
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
        damageMult: damageMultipliers[i] || damageMultipliers[damageMultipliers.length - 1] || 1,
        hitTargets: new Set()
      });
    }
  }

  performMeleeAttack(dx, dy) {
    const range = this.classSpec.meleeRange || 42;
    const hitPadding = Number.isFinite(this.classSpec.meleeHitPadding) ? Math.max(0, this.classSpec.meleeHitPadding) : 0;
    const arcDeg = this.classSpec.meleeArcDeg || 95;
    const arc = (arcDeg * Math.PI) / 180;
    let aimX = dx;
    let aimY = dy;
    let angle = Math.atan2(dy, dx);
    const halfArc = arc * 0.5;
    let snapTarget = null;
    let bestSnapScore = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies || []) {
      if (!enemy || (enemy.hp || 0) <= 0) continue;
      if (this.isEnemyFriendlyToPlayer(enemy)) continue;
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
    if (snapTarget) {
      aimX = snapTarget.x - this.player.x;
      aimY = snapTarget.y - this.player.y;
      angle = Math.atan2(aimY, aimX);
    }
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

  fireFireArrow(dx, dy) {
    if (this.isNecromancerClass()) {
      this.fireDeathBolt(dx, dy);
      return;
    }
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
      if (this.isEnemyFriendlyToPlayer(enemy)) continue;
      if (vecLength(x - enemy.x, y - enemy.y) <= blastRadius + enemy.size * 0.3) {
        this.applyEnemyDamage(enemy, this.getFireArrowImpactDamage(), "fire");
      }
    }
    this.fireZones.push({ x, y, radius: blastRadius * 0.9, life: this.config.fireArrow.lingerDuration, zoneType: "fire" });
  }

  fireDeathBolt(dx, dy) {
    if (!this.isNecromancerClass()) return false;
    if ((this.skills.deathBolt.points || 0) <= 0) return false;
    if (this.player.deathBoltCooldown > 0) return false;
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
      projectileType: "deathBolt"
    });
    return true;
  }

  triggerDeathBoltExplosion(x, y) {
    this.applyDeathBoltPulse(x, y);
    this.fireZones.push({
      x,
      y,
      radius: this.getDeathBoltRadius(),
      life: this.config.deathBolt?.visualLife || 5,
      pulseTimer: this.config.deathBolt?.pulseInterval || 1,
      zoneType: "deathBolt"
    });
  }

  applyDeathBoltPulse(x, y) {
    const radius = this.getDeathBoltRadius();
    const damage = this.getDeathBoltBaseDamage();
    const healAmount = this.getDeathBoltHealAmount();
    const petDamageMultiplier = this.getDeathBoltPetDamageMultiplier();
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
        this.applyEnemyDamage(enemy, damage, "death");
      }
    }
  }

  triggerExplodingDeath(sourceEnemy) {
    if (!sourceEnemy || !this.isControlledUndead(sourceEnemy) || (this.skills.explodingDeath.points || 0) < 3) return;
    const radius = this.getExplodingDeathRadius();
    const damage = this.getDeathExplosionDamage();
    for (const enemy of this.enemies || []) {
      if (!enemy || enemy === sourceEnemy || (enemy.hp || 0) <= 0) continue;
      if (this.isEnemyFriendlyToPlayer(enemy)) continue;
      if (vecLength(enemy.x - sourceEnemy.x, enemy.y - sourceEnemy.y) <= radius + (enemy.size || 20) * 0.35) {
        this.applyEnemyDamage(enemy, damage, "death");
      }
    }
    this.fireZones.push({ x: sourceEnemy.x, y: sourceEnemy.y, radius, life: this.config.deathBolt?.visualLife || 0.35, zoneType: "deathBurst" });
  }

}

Object.assign(GameRuntimeSystems.prototype, runtimePlayerCombatMethods);
