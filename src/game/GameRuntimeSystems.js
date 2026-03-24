import { vecLength } from "../utils.js";
import {
  isGoldDrop as isGoldDropEntity,
  findNearestGoldDrop as findNearestGoldDropEntity,
  applyGoblinGrowth as applyGoblinGrowthEntity,
  updateGoblin as updateGoblinEntity,
  updateMimic as updateMimicEntity,
  updatePrisoner as updatePrisonerEntity,
  updateRatArcher as updateRatArcherEntity,
  updateSkeletonWarrior as updateSkeletonWarriorEntity,
  updateNecromancer as updateNecromancerEntity,
  updateMinotaur as updateMinotaurEntity,
  getEnemyTacticKey as getEnemyTacticKeyEntity,
  getEnemyTacticDefinition as getEnemyTacticDefinitionEntity,
  ensureEnemyTacticsState as ensureEnemyTacticsStateEntity,
  setEnemyTacticPhase as setEnemyTacticPhaseEntity,
  updateEnemyTactics as updateEnemyTacticsEntity,
  updateLeprechaunBoss as updateLeprechaunBossEntity,
  xpFromEnemy as xpFromEnemyEntity,
  maybeSpawnDrop as maybeSpawnDropEntity,
  dropTreasureBag as dropTreasureBagEntity,
  dropArmorLoot as dropArmorLootEntity,
  dropNecromancerLoot as dropNecromancerLootEntity,
  dropMinotaurLoot as dropMinotaurLootEntity,
  dropLeprechaunLoot as dropLeprechaunLootEntity
} from "./enemySystems.js";
import { GameRuntimeWorld } from "./GameRuntimeWorld.js";
import { runtimePlayerAttackMethods } from "./runtimePlayerAttackMethods.js";
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
      this.moveEnemyTowardTargetPoint(enemy, target.x, target.y, appliedScale, dt, minDistance, true);
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
    const cfg = typeof this.getWallTrapConfig === "function" ? this.getWallTrapConfig() : this.config?.traps?.wall || {};
    if (cfg.trapType === "poison") {
      this.firePoisonTrap(trap, cfg);
      return;
    }
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

  firePoisonTrap(trap, cfg = null) {
    if (!trap) return;
    const trapCfg = cfg || (typeof this.getWallTrapConfig === "function" ? this.getWallTrapConfig() : this.config?.traps?.wall || {});
    const tile = this.config?.map?.tile || 32;
    const sightTiles = Number.isFinite(trapCfg.sightRangeTiles) ? Math.max(1, trapCfg.sightRangeTiles) : 7;
    const spacingTiles = Number.isFinite(trapCfg.acidSpacingTiles) ? Math.max(0.4, trapCfg.acidSpacingTiles) : 0.9;
    const spacing = tile * spacingTiles;
    const maxSegments = Number.isFinite(trapCfg.acidMaxSegments) ? Math.max(1, Math.floor(trapCfg.acidMaxSegments)) : Math.max(1, Math.floor(sightTiles / spacingTiles));
    const radius = Number.isFinite(trapCfg.acidRadius) ? Math.max(8, trapCfg.acidRadius) : 12;
    const duration = Number.isFinite(trapCfg.acidDuration) ? Math.max(0.5, trapCfg.acidDuration) : 5;
    const startOffset = tile * 0.7;
    trap.spotted = true;
    for (let index = 0; index < maxSegments; index++) {
      const distance = startOffset + spacing * index;
      const x = trap.x + trap.dirX * distance;
      const y = trap.y + trap.dirY * distance;
      if (this.isWallAt(x, y, false)) break;
      this.fireZones.push({
        x,
        y,
        radius,
        life: duration,
        zoneType: "acid",
        damageMultiplier: Number.isFinite(trapCfg.acidDamageMultiplier) ? Math.max(0, trapCfg.acidDamageMultiplier) : 0.2,
        damageMin: Number.isFinite(this.config.enemy?.armorDamageMin) ? this.config.enemy.armorDamageMin : 20,
        damageMax: Number.isFinite(this.config.enemy?.armorDamageMax) ? this.config.enemy.armorDamageMax : 32,
        touches: new WeakSet(),
        touchingPlayer: false
      });
    }
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

  updatePrisoner(enemy, dt, speedScale) {
    updatePrisonerEntity(this, enemy, dt, speedScale);
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

  updateLeprechaunBoss(enemy, dt, speedScale) {
    updateLeprechaunBossEntity(this, enemy, dt, speedScale);
  }

  xpFromEnemy(enemy) {
    return xpFromEnemyEntity(this, enemy);
  }

  gainExperience(amount) {
    if (typeof this.isFloorBossActive === "function" && this.isFloorBossActive()) return;
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
  
  dropNecromancerLoot(x, y) {
    dropNecromancerLootEntity(this, x, y);
  }

  dropMinotaurLoot(x, y) {
    dropMinotaurLootEntity(this, x, y);
  }

  dropLeprechaunLoot(x, y) {
    dropLeprechaunLootEntity(this, x, y);
  }
}

Object.assign(GameRuntimeSystems.prototype, runtimePlayerCombatMethods);
Object.assign(GameRuntimeSystems.prototype, runtimePlayerAttackMethods);
