import { getRangerDodgeChance, getRangerSkillPointGainForLevel, hasFoxstep } from "./rangerTalentTree.js";
import {
  getWarriorBattleFrenzyDuration,
  getWarriorConsecratedDamageReductionPct,
  getWarriorConsecratedHealingMultiplier,
  getWarriorGuardedAdvanceCounterChance,
  getWarriorGuardedAdvanceMeleeDefenseBonusPct,
  getWarriorGuardedAdvanceMissileReflectChance,
  getWarriorBloodheatRageMoveSpeedBonus,
  getWarriorIronGuardMaxHealthBonusPct,
  getWarriorPassiveRegenBonusPct,
  getWarriorRageMasteryMoveSpeedBonus,
  getWarriorRedTempestMoveSpeedBonus,
  getWarriorSkillPointGainForLevel,
  getWarriorUnbrokenDamageReduction,
  hasWarriorReflectShare,
  hasWarriorUnbrokenCheatDeath,
  isWarriorRaging,
  isWarriorTalentGame
} from "./warriorTalentTree.js";
import { getNecromancerRotTouchedRetaliationDamage, getNecromancerSkillPointGainForLevel, getNecromancerVigorMoveSpeedBonusPct } from "./necromancerTalentTree.js";

export const runtimeBaseSupportMethods = {
  getActivePlayerEntities() {
    if (Array.isArray(this.networkActivePlayers) && this.networkActivePlayers.length > 0) {
      return this.networkActivePlayers.filter((player) => !!player);
    }
    const local = this.player ? [this.player] : [];
    const remotes = Array.isArray(this.remotePlayers) ? this.remotePlayers.filter((player) => !!player) : [];
    return [...local, ...remotes];
  },

  getLivingPlayerEntities() {
    return this.getActivePlayerEntities().filter((player) => (Number.isFinite(player?.health) ? player.health > 0 : player?.alive !== false));
  },

  isPlayerEntity(entity) {
    return !!entity && (entity === this.player || this.getActivePlayerEntities().includes(entity));
  },

  isPrimaryPlayerEntity(entity) {
    return !!entity && entity === this.player;
  },

  isLivingPlayerEntity(entity) {
    return !!entity && (Number.isFinite(entity?.health) ? entity.health > 0 : entity?.alive !== false);
  },

  getCrusaderConsecratedZoneForEntity(entity) {
    if (!entity || !Array.isArray(this.fireZones)) return null;
    const entityRadius = (entity.size || this.player?.size || 22) * 0.4;
    for (const zone of this.fireZones) {
      if (!zone || zone.zoneType !== "crusaderAura" || (zone.life || 0) <= 0) continue;
      if (Math.hypot((zone.x || 0) - (entity.x || 0), (zone.y || 0) - (entity.y || 0)) <= (zone.radius || 0) + entityRadius) return zone;
    }
    return null;
  },

  getNearestPlayerEntity(x, y, maxRange = Infinity) {
    const players = this.getLivingPlayerEntities();
    let best = players[0] || this.player;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const player of players) {
      const dx = (player?.x || 0) - x;
      const dy = (player?.y || 0) - y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRange || dist >= bestDist) continue;
      best = player;
      bestDist = dist;
    }
    return best || this.player;
  },

  getPlayerEntityById(id) {
    if (!id) return null;
    return this.getActivePlayerEntities().find((player) => player && player.id === id) || null;
  },

  getControllingPlayerEntityForEnemy(enemy) {
    const ownerId = typeof enemy?.controllerPlayerId === "string" && enemy.controllerPlayerId ? enemy.controllerPlayerId : null;
    if (!ownerId) return this.player;
    return this.getPlayerEntityById(ownerId) || this.player;
  },

  isEnemyTargetedByAnyNecromancerBeam(enemy) {
    if (!enemy) return false;
    const localBeam = this.necromancerBeam;
    if (localBeam?.active && localBeam.targetEnemy === enemy) return true;
    for (const player of this.getActivePlayerEntities()) {
      if (!player || player === this.player) continue;
      const beam = player.necromancerBeam;
      if (!beam?.active) continue;
      if (beam.targetId && enemy.id && beam.targetId === enemy.id) return true;
    }
    return false;
  },

  getSpectateTargetEntity() {
    const targetId = typeof this.spectateTargetId === "string" ? this.spectateTargetId : null;
    if (targetId) {
      const exact = this.getLivingPlayerEntities().find((player) => player && player.id === targetId && player !== this.player);
      if (exact) return exact;
    }
    return this.getLivingPlayerEntities().find((player) => player && player !== this.player) || null;
  },

  getAvailableSpectateTargets() {
    return this.getLivingPlayerEntities().filter((player) => !!player && player !== this.player);
  },

  setSpectateTargetById(id) {
    if (this.player.health > 0 || this.gameOver) return null;
    if (typeof id !== "string" || !id) {
      this.spectateTargetId = null;
      return this.updateSpectateTarget();
    }
    const target = this.getAvailableSpectateTargets().find((player) => player.id === id) || null;
    if (!target) return this.updateSpectateTarget();
    this.spectateTargetId = target.id;
    return target;
  },

  cycleSpectateTarget(direction = 1) {
    if (this.player.health > 0 || this.gameOver) return null;
    const targets = this.getAvailableSpectateTargets();
    if (targets.length === 0) {
      this.spectateTargetId = null;
      return null;
    }
    if (targets.length === 1) {
      this.spectateTargetId = targets[0].id;
      return targets[0];
    }
    const currentIndex = targets.findIndex((player) => player.id === this.spectateTargetId);
    const step = direction < 0 ? -1 : 1;
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (startIndex + step + targets.length) % targets.length;
    this.spectateTargetId = targets[nextIndex].id;
    return targets[nextIndex];
  },

  updateSpectateTarget() {
    if (this.player.health > 0 || this.gameOver) {
      this.spectateTargetId = null;
      return null;
    }
    const target = this.getSpectateTargetEntity();
    this.spectateTargetId = target?.id || null;
    return target;
  },

  getPlayerClassSpec(entity = this.player) {
    const classType = entity?.classType || this.classType;
    return this.config?.classes?.[classType] || this.classSpec || this.config?.classes?.archer || {};
  },

  getPlayerSkillPointsFor(entity, skillKey) {
    if (!skillKey) return 0;
    if (this.isPrimaryPlayerEntity(entity)) {
      return Number.isFinite(this.skills?.[skillKey]?.points) ? this.skills[skillKey].points : 0;
    }
    return Number.isFinite(entity?.skills?.[skillKey]?.points) ? entity.skills[skillKey].points : 0;
  },

  getPlayerUpgradeLevelFor(entity, upgradeKey) {
    if (!upgradeKey) return 0;
    if (this.isPrimaryPlayerEntity(entity)) {
      return Number.isFinite(this.upgrades?.[upgradeKey]?.level) ? this.upgrades[upgradeKey].level : 0;
    }
    return Number.isFinite(entity?.upgrades?.[upgradeKey]?.level) ? entity.upgrades[upgradeKey].level : 0;
  },

  getPlayerMoveSpeedFor(entity = this.player) {
    const classSpec = this.getPlayerClassSpec(entity);
    const level = this.getPlayerProgressField(entity, "level", 1);
    const levelBonus = Number.isFinite(classSpec.levelMoveSpeedGain)
      ? Math.max(0, classSpec.levelMoveSpeedGain) * Math.max(0, level - 1)
      : 0;
    const moveSpeedLevel = this.getPlayerUpgradeLevelFor(entity, "moveSpeed");
    let moveBonus = moveSpeedLevel * 0.05;
    if (entity?.classType === "fighter") {
      const momentumTimer = this.isPrimaryPlayerEntity(entity)
        ? (Number.isFinite(this.warriorMomentumTimer) ? this.warriorMomentumTimer : 0)
        : (Number.isFinite(entity?.warriorMomentumTimer) ? entity.warriorMomentumTimer : 0);
      const nearbyThreat = (this.enemies || []).some((enemy) =>
        enemy &&
        (enemy.hp || 0) > 0 &&
        !this.isEnemyFriendlyToPlayer(enemy) &&
        Math.hypot((enemy.x || 0) - (entity.x || 0), (enemy.y || 0) - (entity.y || 0)) <= (this.config?.map?.tile || 32) * 5
      );
      if (nearbyThreat || momentumTimer > 0 || isWarriorRaging(entity)) {
        moveBonus += (entity?.warriorTalents?.bloodheat?.points || 0) >= 3 ? 0.05 : 0;
      }
      if (momentumTimer > 0) moveBonus += 0.1 * Math.max(0, entity?.warriorTalents?.battleFrenzy?.points || 0);
      if (isWarriorRaging(entity)) {
        moveBonus += entity === this.player ? getWarriorBloodheatRageMoveSpeedBonus(this) : ((entity?.warriorTalents?.bloodheat?.points || 0) >= 2 ? 0.05 : 0);
        moveBonus += entity === this.player ? getWarriorRageMasteryMoveSpeedBonus(this) : ((entity?.warriorTalents?.rageMastery?.points || 0) > 0 ? 0.15 : 0);
        moveBonus += entity === this.player ? getWarriorRedTempestMoveSpeedBonus(this) : ((entity?.warriorTalents?.redTempest?.points || 0) > 0 ? 0.2 : 0);
      }
    }
    if (entity?.classType === "necromancer") {
      moveBonus += entity === this.player
        ? getNecromancerVigorMoveSpeedBonusPct(this)
        : ((entity?.necromancerRuntime?.vigorTimer || 0) > 0 ? 0.25 : 0);
    }
    return (classSpec.baseMoveSpeed + levelBonus) * (1 + moveBonus);
  },

  getPlayerProgressField(entity, key, fallback = 0) {
    if (this.isPrimaryPlayerEntity(entity)) {
      return Number.isFinite(this[key]) ? this[key] : fallback;
    }
    return Number.isFinite(entity?.[key]) ? entity[key] : fallback;
  },

  setPlayerProgressField(entity, key, value) {
    if (this.isPrimaryPlayerEntity(entity)) this[key] = value;
    else if (entity) entity[key] = value;
  },

  getPlayerEnemyCollisionRadiusFor(entity = this.player) {
    const size = Number.isFinite(entity?.size) ? entity.size : (this.player?.size || 20);
    return Math.max(4, size * 0.5);
  },

  tickActivePlayerEntities(dt) {
    for (const player of this.getActivePlayerEntities()) {
      player.fireCooldown = Math.max(0, (Number.isFinite(player.fireCooldown) ? player.fireCooldown : 0) - dt);
      player.fireArrowCooldown = Math.max(0, (Number.isFinite(player.fireArrowCooldown) ? player.fireArrowCooldown : 0) - dt);
      player.deathBoltCooldown = Math.max(0, (Number.isFinite(player.deathBoltCooldown) ? player.deathBoltCooldown : 0) - dt);
      player.hitCooldown = Math.max(0, (Number.isFinite(player.hitCooldown) ? player.hitCooldown : 0) - dt);
      player.hpBarTimer = Math.max(0, (Number.isFinite(player.hpBarTimer) ? player.hpBarTimer : 0) - dt);
      player.animTime = (Number.isFinite(player.animTime) ? player.animTime : 0) + dt;
      player.alive = Number.isFinite(player.health) ? player.health > 0 : player.alive !== false;
      player.consumableRuntime = player.consumableRuntime && typeof player.consumableRuntime === "object" ? player.consumableRuntime : { tempHp: 0 };
      player.consumableRuntime.tempHp = Math.max(0, Number.isFinite(player.consumableRuntime.tempHp) ? player.consumableRuntime.tempHp : 0);
      player.rangerRuntime = player.rangerRuntime && typeof player.rangerRuntime === "object" ? player.rangerRuntime : {};
      player.rangerRuntime.foxstepCooldown = Math.max(0, (Number.isFinite(player.rangerRuntime.foxstepCooldown) ? player.rangerRuntime.foxstepCooldown : 0) - dt);
      player.rangerRuntime.foxstepActiveTimer = Math.max(0, (Number.isFinite(player.rangerRuntime.foxstepActiveTimer) ? player.rangerRuntime.foxstepActiveTimer : 0) - dt);
      player.rangerRuntime.foxstepHealTickTimer = Math.max(0, (Number.isFinite(player.rangerRuntime.foxstepHealTickTimer) ? player.rangerRuntime.foxstepHealTickTimer : 0) - dt);
      if ((player.rangerRuntime.foxstepActiveTimer || 0) > 0 && (player.rangerRuntime.foxstepHealPool || 0) > 0 && player.alive) {
        while ((player.rangerRuntime.foxstepHealTickTimer || 0) <= 0 && (player.rangerRuntime.foxstepHealPool || 0) > 0) {
          player.rangerRuntime.foxstepHealTickTimer += 0.25;
          const healAmount = Math.min(player.rangerRuntime.foxstepHealPool, Math.max(1, (player.maxHealth || 1) * 0.0084));
          player.rangerRuntime.foxstepHealPool = Math.max(0, player.rangerRuntime.foxstepHealPool - healAmount);
          if (this.isPrimaryPlayerEntity(player)) this.applyPlayerHealing(healAmount, { suppressText: true });
          else player.health = Math.min(player.maxHealth || player.health || 0, (player.health || 0) + healAmount);
        }
      } else if ((player.rangerRuntime.foxstepActiveTimer || 0) <= 0) {
        player.rangerRuntime.foxstepHealPool = 0;
      }
      player.warriorRuntime = player.warriorRuntime && typeof player.warriorRuntime === "object" ? player.warriorRuntime : {};
      player.warriorRuntime.secondWindTimer = Math.max(0, (Number.isFinite(player.warriorRuntime.secondWindTimer) ? player.warriorRuntime.secondWindTimer : 0) - dt);
      player.warriorRuntime.battleFrenzyCooldownTimer = Math.max(0, (Number.isFinite(player.warriorRuntime.battleFrenzyCooldownTimer) ? player.warriorRuntime.battleFrenzyCooldownTimer : 0) - dt);
      player.warriorRuntime.tempHpTimer = Math.max(0, (Number.isFinite(player.warriorRuntime.tempHpTimer) ? player.warriorRuntime.tempHpTimer : 0) - dt);
      player.warriorRuntime.rageArcTimer = Math.max(0, (Number.isFinite(player.warriorRuntime.rageArcTimer) ? player.warriorRuntime.rageArcTimer : 0) - dt);
      player.warriorRuntime.cheatDeathCooldown = Math.max(0, (Number.isFinite(player.warriorRuntime.cheatDeathCooldown) ? player.warriorRuntime.cheatDeathCooldown : 0) - dt);
      if ((player.warriorRuntime.tempHpTimer || 0) <= 0) player.warriorRuntime.tempHp = 0;
      if ((player.warriorRuntime.secondWindTimer || 0) > 0 && (player.warriorRuntime.secondWindPool || 0) > 0 && player.alive) {
        const timer = Math.max(dt, player.warriorRuntime.secondWindTimer);
        const healAmount = Math.min(player.warriorRuntime.secondWindPool, (player.warriorRuntime.secondWindPool / timer) * dt);
        player.warriorRuntime.secondWindPool = Math.max(0, player.warriorRuntime.secondWindPool - healAmount);
        if (this.isPrimaryPlayerEntity(player)) this.applyPlayerHealing(healAmount, { suppressText: true });
        else player.health = Math.min(player.maxHealth || player.health || 0, (player.health || 0) + healAmount);
      } else if ((player.warriorRuntime.secondWindTimer || 0) <= 0) {
        player.warriorRuntime.secondWindPool = 0;
      }
      player.necromancerRuntime = player.necromancerRuntime && typeof player.necromancerRuntime === "object" ? player.necromancerRuntime : {};
      player.necromancerRuntime.vigorTimer = Math.max(0, (Number.isFinite(player.necromancerRuntime.vigorTimer) ? player.necromancerRuntime.vigorTimer : 0) - dt);
      player.necromancerRuntime.vigorBeamTimer = Math.max(0, (Number.isFinite(player.necromancerRuntime.vigorBeamTimer) ? player.necromancerRuntime.vigorBeamTimer : 0) - dt);
      if ((player.necromancerRuntime.vigorTimer || 0) > 0 && (player.necromancerRuntime.vigorHealPool || 0) > 0 && player.alive) {
        const timer = Math.max(dt, player.necromancerRuntime.vigorTimer);
        const healAmount = Math.min(player.necromancerRuntime.vigorHealPool, (player.necromancerRuntime.vigorHealPool / timer) * dt);
        player.necromancerRuntime.vigorHealPool = Math.max(0, player.necromancerRuntime.vigorHealPool - healAmount);
        if (this.isPrimaryPlayerEntity(player)) this.applyPlayerHealing(healAmount, { suppressText: true });
        else player.health = Math.min(player.maxHealth || player.health || 0, (player.health || 0) + healAmount);
      } else if ((player.necromancerRuntime.vigorTimer || 0) <= 0) {
        player.necromancerRuntime.vigorHealPool = 0;
      }
      player.necromancerRuntime.tempHp = Math.max(0, Number.isFinite(player.necromancerRuntime.tempHp) ? player.necromancerRuntime.tempHp : 0);
      if (!this.isPrimaryPlayerEntity(player)) {
        player.warriorMomentumTimer = Math.max(0, (Number.isFinite(player.warriorMomentumTimer) ? player.warriorMomentumTimer : 0) - dt);
        player.warriorRageActiveTimer = Math.max(0, (Number.isFinite(player.warriorRageActiveTimer) ? player.warriorRageActiveTimer : 0) - dt);
        player.warriorRageCooldownTimer = Math.max(0, (Number.isFinite(player.warriorRageCooldownTimer) ? player.warriorRageCooldownTimer : 0) - dt);
        player.warriorRageVictoryRushTimer = Math.max(0, (Number.isFinite(player.warriorRageVictoryRushTimer) ? player.warriorRageVictoryRushTimer : 0) - dt);
        if ((player.warriorRageVictoryRushPool || 0) > 0 && (player.warriorRageVictoryRushTimer || 0) > 0 && player.alive) {
          const timer = Math.max(dt, player.warriorRageVictoryRushTimer);
          const healAmount = Math.min(player.warriorRageVictoryRushPool, (player.warriorRageVictoryRushPool / timer) * dt);
          player.warriorRageVictoryRushPool = Math.max(0, player.warriorRageVictoryRushPool - healAmount);
          player.health = Math.min(player.maxHealth || player.health || 0, (player.health || 0) + healAmount);
        } else if ((player.warriorRageVictoryRushTimer || 0) <= 0) {
          player.warriorRageVictoryRushPool = 0;
        }
        player.speed = this.getPlayerMoveSpeedFor(player);
      }
    }
  },

  markPlayerEntityHealthBarVisible(entity = this.player) {
    if (!entity) return;
    entity.hpBarTimer = this.config.player.hpBarDuration;
  },

  getDamageTakenForPlayerEntity(entity, amount, damageType = "physical") {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const rangerDodgeChance = entity === this.player
      ? getRangerDodgeChance(this)
      : ((entity?.rangerTalents?.fleetstep?.points || 0) > 0 ? 0.15 : 0);
    if (entity?.classType === "archer" && Math.random() < rangerDodgeChance) return 0;
    if (entity?.classType === "archer" && (entity?.rangerRuntime?.foxstepActiveTimer || 0) > 0) return amount * 0.5;
    if (entity?.classType === "fighter") {
      const consecratedZone = this.getCrusaderConsecratedZoneForEntity(entity);
      if (consecratedZone) amount *= 1 - (entity === this.player ? getWarriorConsecratedDamageReductionPct(this) : ((entity?.warriorTalents?.guardedAdvance?.points || 0) > 0 ? 0.05 : 0));
      const hpRatio = Number.isFinite(entity?.maxHealth) && entity.maxHealth > 0 ? (entity.health || 0) / entity.maxHealth : 1;
      const lowHealthReduction = entity === this.player
        ? getWarriorUnbrokenDamageReduction(this, hpRatio)
        : getWarriorUnbrokenDamageReduction(entity, hpRatio);
      if (lowHealthReduction > 0) amount *= 1 - lowHealthReduction;
      if (damageType === "melee" || damageType === "physical") {
        const meleeReduction = entity === this.player
          ? getWarriorGuardedAdvanceMeleeDefenseBonusPct(this)
          : getWarriorGuardedAdvanceMeleeDefenseBonusPct(entity);
        if (meleeReduction > 0) amount *= 1 - meleeReduction;
      }
    }
    if (this.isPrimaryPlayerEntity(entity) && typeof this.getPlayerDamageTaken === "function") {
      return this.getPlayerDamageTaken(amount, damageType);
    }
    return amount;
  },

  getSkillPointGainForLevel(level, classType = this.classType) {
    if (classType === "fighter") return getWarriorSkillPointGainForLevel(level, classType);
    if (classType === "necromancer") return getNecromancerSkillPointGainForLevel(level, classType);
    return getRangerSkillPointGainForLevel(level, classType);
  },

  recordDamageDealtByPlayerEntity(entity, amount) {
    if (!Number.isFinite(amount) || amount <= 0 || !this.isLivingPlayerEntity(entity)) return;
    if (this.isPrimaryPlayerEntity(entity)) {
      if (typeof this.recordRunDamageDealt === "function") this.recordRunDamageDealt(amount);
    } else if (entity) {
      entity.damageDealt = (Number.isFinite(entity.damageDealt) ? entity.damageDealt : 0) + amount;
    }
  },

  recordKillByPlayerEntity(entity, enemy) {
    if (!this.isLivingPlayerEntity(entity)) return;
    if (this.isPrimaryPlayerEntity(entity)) {
      if (typeof this.recordEnemyKill === "function") this.recordEnemyKill(enemy);
      return;
    }
    if (!entity) return;
    entity.kills = (Number.isFinite(entity.kills) ? entity.kills : 0) + 1;
  },

  awardScoreToPlayerEntity(entity, amount) {
    if (!Number.isFinite(amount) || amount <= 0 || !this.isLivingPlayerEntity(entity)) return;
    const current = this.getPlayerProgressField(entity, "score", 0);
    this.setPlayerProgressField(entity, "score", current + amount);
  },

  awardGoldToPlayerEntity(entity, amount, { spawnText = true } = {}) {
    if (!Number.isFinite(amount) || amount <= 0 || !this.isLivingPlayerEntity(entity)) return;
    const currentGold = this.getPlayerProgressField(entity, "gold", 0);
    this.setPlayerProgressField(entity, "gold", currentGold + amount);
    this.awardScoreToPlayerEntity(entity, amount);
    if (this.isPrimaryPlayerEntity(entity) && typeof this.recordRunGoldEarned === "function") this.recordRunGoldEarned(amount);
    else entity.goldEarned = (Number.isFinite(entity.goldEarned) ? entity.goldEarned : 0) + amount;
    if (spawnText) this.spawnFloatingText(entity.x, entity.y - 30, `+${amount}g`, "#f2d76b", 0.75, 14);
  },

  gainExperienceForPlayerEntity(entity, amount) {
    if (!this.isLivingPlayerEntity(entity) || !Number.isFinite(amount) || amount <= 0) return;
    if (this.isPrimaryPlayerEntity(entity)) {
      this.gainExperience(amount);
      return;
    }
    if (typeof this.isFloorBossActive === "function" && this.isFloorBossActive()) return;
    const classSpec = this.getPlayerClassSpec(entity);
    entity.experience = (Number.isFinite(entity.experience) ? entity.experience : 0) + amount;
    entity.expToNextLevel = Number.isFinite(entity.expToNextLevel) ? entity.expToNextLevel : this.config.progression.baseXpToLevel;
    entity.level = Number.isFinite(entity.level) ? entity.level : 1;
    entity.skillPoints = Number.isFinite(entity.skillPoints) ? entity.skillPoints : 0;
    entity.levelWeaponDamageBonus = Number.isFinite(entity.levelWeaponDamageBonus) ? entity.levelWeaponDamageBonus : 0;
    while (entity.experience >= entity.expToNextLevel) {
      entity.experience -= entity.expToNextLevel;
      entity.level += 1;
      entity.skillPoints += this.getSkillPointGainForLevel(entity.level, entity.classType);
      const hpGain = Number.isFinite(classSpec.levelHpGain) ? classSpec.levelHpGain : 10;
      let adjustedHpGain = hpGain;
      if (entity.classType === "archer") adjustedHpGain = hpGain * (1 + ((entity?.rangerTalents?.fleetstep?.points || 0) > 0 ? 0.06 : 0));
      else if (entity.classType === "fighter") adjustedHpGain = hpGain * (1 + getWarriorIronGuardMaxHealthBonusPct(entity));
      entity.maxHealth = (Number.isFinite(entity.maxHealth) ? entity.maxHealth : 0) + adjustedHpGain;
      entity.health = Math.min(entity.maxHealth, (Number.isFinite(entity.health) ? entity.health : 0) + adjustedHpGain);
      const baseMin = Number.isFinite(classSpec.primaryDamageMin)
        ? classSpec.primaryDamageMin
        : Number.isFinite(classSpec.primaryDamage)
        ? classSpec.primaryDamage
        : 1;
      const baseMax = Number.isFinite(classSpec.primaryDamageMax)
        ? classSpec.primaryDamageMax
        : Number.isFinite(classSpec.primaryDamage)
        ? classSpec.primaryDamage
        : baseMin;
      const baseAvg = (Math.min(baseMin, baseMax) + Math.max(baseMin, baseMax)) * 0.5;
      const dmgPct = Number.isFinite(classSpec.levelWeaponDamagePct) ? classSpec.levelWeaponDamagePct : 0.05;
      entity.levelWeaponDamageBonus += Math.max(1, baseAvg * Math.max(0, dmgPct));
      entity.expToNextLevel = Math.floor(entity.expToNextLevel * this.config.progression.xpLevelScaling);
      this.spawnFloatingText(entity.x, entity.y - 30, `Level ${entity.level}!`, "#9be18a", 1.0, 15);
    }
  },

  triggerWarriorMomentumOnKillForPlayerEntity(entity) {
    if (!this.isLivingPlayerEntity(entity)) return;
    if (this.isPrimaryPlayerEntity(entity)) {
      if (typeof this.triggerWarriorMomentumOnKill === "function") this.triggerWarriorMomentumOnKill();
      return;
    }
    const classSpec = this.getPlayerClassSpec(entity);
    if (classSpec?.usesRanged) return;
    const points = entity?.classType === "fighter"
      ? Math.max(0, entity?.warriorTalents?.battleFrenzy?.points || 0)
      : this.getPlayerSkillPointsFor(entity, "warriorMomentum");
    if (points <= 0) return;
    const wasInactive = (entity.warriorMomentumTimer || 0) <= 0;
    if (entity?.classType === "fighter") {
      entity.warriorRuntime = entity.warriorRuntime && typeof entity.warriorRuntime === "object" ? entity.warriorRuntime : {};
      if ((entity.warriorRuntime.battleFrenzyCooldownTimer || 0) > 0) return;
      entity.warriorMomentumTimer = getWarriorBattleFrenzyDuration();
      entity.warriorRuntime.battleFrenzyCooldownTimer = 10;
    } else {
      entity.warriorMomentumTimer = Math.max(entity.warriorMomentumTimer || 0, 0.85 + 0.9 * Math.log1p(1.2 * Math.max(0, points)));
    }
    if (wasInactive) entity.speed = this.getPlayerMoveSpeedFor(entity);
  },

  tryReflectMissileForPlayerEntity(entity, projectile, ownerEntity = null) {
    if (!entity || !projectile || entity.classType !== "fighter") return false;
    const reflectChance = entity === this.player
      ? getWarriorGuardedAdvanceMissileReflectChance(this, this.player)
      : getWarriorGuardedAdvanceMissileReflectChance(entity, entity);
    if (reflectChance <= 0 || Math.random() >= reflectChance) return false;
    const reflectOwner = ownerEntity || entity;
    const sourceX = Number.isFinite(projectile.x) ? projectile.x : (entity.x || 0);
    const sourceY = Number.isFinite(projectile.y) ? projectile.y : (entity.y || 0);
    const targetX = Number.isFinite(projectile.ownerX) ? projectile.ownerX : sourceX - (Number.isFinite(projectile.vx) ? projectile.vx : 0);
    const targetY = Number.isFinite(projectile.ownerY) ? projectile.ownerY : sourceY - (Number.isFinite(projectile.vy) ? projectile.vy : 0);
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.hypot(dx, dy) || 1;
    const speed = Math.max(180, Math.hypot(Number.isFinite(projectile.vx) ? projectile.vx : 0, Number.isFinite(projectile.vy) ? projectile.vy : 0));
    projectile.vx = (dx / len) * speed;
    projectile.vy = (dy / len) * speed;
    projectile.faction = "player";
    projectile.projectileType = "bullet";
    projectile.ownerId = reflectOwner?.id || this.player?.id || null;
    projectile.hitTargets = new Set();
    projectile.remainingRicochets = 0;
    const reflectMult = entity === this.player
      ? (this.warriorTalents?.judgmentWave?.points || this.warriorTalents?.stonewall?.points || 0) > 0 ? 1.5 : 1
      : (entity?.warriorTalents?.judgmentWave?.points || entity?.warriorTalents?.stonewall?.points || 0) > 0 ? 1.5 : 1;
    const rawDamage = Number.isFinite(projectile.damage) ? projectile.damage : this.rollEnemyContactDamage({ damageMin: projectile.damageMin, damageMax: projectile.damageMax });
    projectile.damage = rawDamage * reflectMult;
    this.spawnFloatingText(entity.x, entity.y - 28, "Reflect", "#b7d8ff", 0.9, 14);
    return true;
  },

  getWarriorMissileProtectorForPlayerEntity(entity) {
    if (!entity || entity.classType !== "fighter") return entity;
    if (entity === this.player) return entity;
    const players = this.getLivingPlayerEntities();
    const tile = this.config?.map?.tile || 32;
    for (const other of players) {
      if (!other || other === entity || other.classType !== "fighter") continue;
      const share = other === this.player ? hasWarriorReflectShare(this, this.player) : hasWarriorReflectShare(other, other);
      if (!share) continue;
      if (Math.hypot((other.x || 0) - (entity.x || 0), (other.y || 0) - (entity.y || 0)) <= tile) return other;
    }
    return entity;
  },

  handlePlayerEntityDeath(entity) {
    if (!entity) return;
    entity.alive = false;
    const entityId = typeof entity.id === "string" && entity.id ? entity.id : null;
    if (entityId) {
      for (const enemy of this.enemies || []) {
        if (!enemy || !this.isControlledUndead(enemy)) continue;
        if (enemy.controllerPlayerId !== entityId) continue;
        enemy.hp = 0;
        enemy.collapsed = false;
        enemy.collapseTimer = 0;
        enemy.reanimateTimer = 0;
        enemy.reviveAtEnd = false;
        enemy.reanimating = false;
      }
    }
    const othersAlive = this.getLivingPlayerEntities().some((player) => player !== entity);
    if (this.isPrimaryPlayerEntity(entity)) {
      this.shopOpen = false;
      this.skillTreeOpen = false;
      this.statsPanelPausedGame = false;
    }
    if (!othersAlive) {
      this.triggerGameOver();
      return;
    }
    if (this.isPrimaryPlayerEntity(entity)) this.updateSpectateTarget();
  },

  applyHealingToPlayerEntity(entity, amount, options = {}) {
    if (!entity || amount <= 0) return;
    const consecratedZone = this.getCrusaderConsecratedZoneForEntity(entity);
    if (consecratedZone) {
      const zoneBoost = Number.isFinite(consecratedZone.healingMultiplier) ? consecratedZone.healingMultiplier : getWarriorConsecratedHealingMultiplier(this);
      amount *= Math.max(1, zoneBoost);
    }
    const before = Number.isFinite(entity.health) ? entity.health : 0;
    entity.health = Math.min(Number.isFinite(entity.maxHealth) ? entity.maxHealth : before, before + amount);
    entity.alive = entity.health > 0;
    if (entity.health <= before) return;
    const healed = entity.health - before;
    if (this.isPrimaryPlayerEntity(entity) && typeof this.recordRunHealingReceived === "function") this.recordRunHealingReceived(healed);
    this.markPlayerEntityHealthBarVisible(entity);
    if (!options.suppressText) {
      this.spawnFloatingText(
        entity.x,
        entity.y - 26,
        `+${Math.max(1, Math.round(healed))}`,
        typeof this.getHealingTextColor === "function" ? this.getHealingTextColor() : "#79e59a",
        0.8,
        14
      );
    }
  },

  applyDamageToPlayerEntity(entity, amount, damageType = "physical", source = null) {
    if (!entity || amount <= 0) return;
    entity.warriorRuntime = entity.warriorRuntime && typeof entity.warriorRuntime === "object" ? entity.warriorRuntime : {};
    entity.necromancerRuntime = entity.necromancerRuntime && typeof entity.necromancerRuntime === "object" ? entity.necromancerRuntime : {};
    entity.consumableRuntime = entity.consumableRuntime && typeof entity.consumableRuntime === "object" ? entity.consumableRuntime : { tempHp: 0 };
    if ((entity.consumableRuntime.tempHp || 0) > 0) {
      const absorbed = Math.min(entity.consumableRuntime.tempHp, amount);
      entity.consumableRuntime.tempHp = Math.max(0, entity.consumableRuntime.tempHp - absorbed);
      amount = Math.max(0, amount - absorbed);
      if (amount <= 0) {
        this.spawnFloatingText(entity.x, entity.y - 18, "Blocked", "#d9d1ff", 0.65, 13);
        return;
      }
    }
    if ((entity.warriorRuntime.tempHp || 0) > 0) {
      const absorbed = Math.min(entity.warriorRuntime.tempHp, amount);
      entity.warriorRuntime.tempHp = Math.max(0, entity.warriorRuntime.tempHp - absorbed);
      amount = Math.max(0, amount - absorbed);
      if (amount <= 0) {
        this.spawnFloatingText(entity.x, entity.y - 18, "Blocked", "#d9d1ff", 0.65, 13);
        return;
      }
    }
    if ((entity.necromancerRuntime.tempHp || 0) > 0) {
      const absorbed = Math.min(entity.necromancerRuntime.tempHp, amount);
      entity.necromancerRuntime.tempHp = Math.max(0, entity.necromancerRuntime.tempHp - absorbed);
      amount = Math.max(0, amount - absorbed);
      if (amount <= 0) {
        this.spawnFloatingText(entity.x, entity.y - 18, "Blocked", "#d9d1ff", 0.65, 13);
        return;
      }
    }
    const healthBeforeDamage = Number.isFinite(entity.health) ? entity.health : 0;
    if (this.isPrimaryPlayerEntity(entity) && amount >= healthBeforeDamage && typeof this.applyPassiveConsumableEvent === "function") {
      const passivePayload = { amount, damageType, source, preventDeath: false };
      this.applyPassiveConsumableEvent("lethalDamage", passivePayload);
      if (passivePayload.preventDeath) {
        entity.alive = true;
        this.markPlayerEntityHealthBarVisible(entity);
        return;
      }
    }
    if (this.isPrimaryPlayerEntity(entity) && typeof this.recordRunDamageTaken === "function") this.recordRunDamageTaken(amount);
    this.spawnFloatingText(
      entity.x,
      entity.y - 18,
      `-${Math.round(amount)}`,
      typeof this.getDamageTextColor === "function" ? this.getDamageTextColor(damageType) : "#ef6d6d"
    );
    entity.health = Math.max(0, (Number.isFinite(entity.health) ? entity.health : 0) - amount);
    entity.alive = entity.health > 0;
    this.markPlayerEntityHealthBarVisible(entity);
    const entityHasFoxstep = entity === this.player ? hasFoxstep(this) : (entity?.rangerTalents?.foxstep?.points || 0) > 0;
    if (entity.classType === "archer" && entityHasFoxstep) {
      entity.rangerRuntime = entity.rangerRuntime && typeof entity.rangerRuntime === "object" ? entity.rangerRuntime : {};
      const runtime = entity.rangerRuntime;
      const hpRatio = (Number.isFinite(entity.maxHealth) && entity.maxHealth > 0) ? entity.health / entity.maxHealth : 1;
      if ((runtime.foxstepCooldown || 0) <= 0 && (runtime.foxstepActiveTimer || 0) <= 0 && hpRatio <= 0.5) {
        runtime.foxstepCooldown = 90;
        runtime.foxstepActiveTimer = 15;
        runtime.foxstepHealPool = Math.max(1, entity.maxHealth * 0.5);
        runtime.foxstepHealTickTimer = 0.25;
        this.spawnFloatingText(entity.x, entity.y - 36, "Foxstep", "#d8ffe5", 1.0, 16);
      }
    }
    if (entity.classType === "fighter" && (damageType === "melee" || damageType === "physical")) {
      const counterChance = entity === this.player
        ? getWarriorGuardedAdvanceCounterChance(this)
        : getWarriorGuardedAdvanceCounterChance(entity);
      if (counterChance > 0 && Math.random() < counterChance) {
        const target = (this.enemies || []).find((enemy) =>
          enemy &&
          (enemy.hp || 0) > 0 &&
          !this.isEnemyFriendlyToPlayer(enemy) &&
          Math.hypot((enemy.x || 0) - (entity.x || 0), (enemy.y || 0) - (entity.y || 0)) <= ((enemy.size || 20) + (entity.size || 22)) * 0.8
        );
        if (target) this.applyEnemyDamage(target, Math.max(1, amount), "melee", entity.id || null);
      }
    }
    if (this.isPrimaryPlayerEntity(entity) && (this.consumables?.effects?.spikeGrowth?.timer || 0) > 0) {
      const target = (this.enemies || []).find((enemy) =>
        enemy &&
        (enemy.hp || 0) > 0 &&
        !this.isEnemyFriendlyToPlayer(enemy) &&
        Math.hypot((enemy.x || 0) - (entity.x || 0), (enemy.y || 0) - (entity.y || 0)) <= ((enemy.size || 20) + (entity.size || 22)) * 0.9
      );
      if (target) this.applyEnemyDamage(target, 3, "physical", entity.id || null);
    }
    if (entity.classType === "necromancer") {
      const retaliationDamage = entity === this.player ? getNecromancerRotTouchedRetaliationDamage(this) : ((entity?.necromancerTalents?.rotTouched?.points || 0) > 0 ? 5 : 0);
      if (retaliationDamage > 0) {
        const target = (this.enemies || []).find((enemy) =>
          enemy &&
          (enemy.hp || 0) > 0 &&
          !this.isEnemyFriendlyToPlayer(enemy) &&
          Math.hypot((enemy.x || 0) - (entity.x || 0), (enemy.y || 0) - (entity.y || 0)) <= ((enemy.size || 20) + (entity.size || 22)) * 0.9
        );
        if (target) this.applyEnemyDamage(target, retaliationDamage, "poison", entity.id || null);
      }
    }
    if (entity.classType === "fighter" && entity.health <= 0) {
      const canCheatDeath = entity === this.player
        ? hasWarriorUnbrokenCheatDeath(this)
        : false;
      if (canCheatDeath && (entity.warriorRuntime.cheatDeathCooldown || 0) <= 0) {
        entity.warriorRuntime.cheatDeathCooldown = 60;
        entity.health = 1;
        entity.alive = true;
        entity.warriorRuntime.tempHp = Math.max(entity.warriorRuntime.tempHp || 0, 999999);
        entity.warriorRuntime.tempHpTimer = 5;
        this.spawnFloatingText(entity.x, entity.y - 36, "Unbroken", "#f4efe3", 1.0, 16);
        return;
      }
    }
    if (entity.health <= 0) {
      if (source?.bossVariant === "sonya") this.gameOverTitle = "Haley Wins";
      this.handlePlayerEntityDeath(entity);
    }
  },

  ensureRunStats() {
    if (!this.runStats || typeof this.runStats !== "object") {
      this.runStats = {
        totalKills: 0,
        bossKills: 0,
        floorsCleared: 0,
        damageDealt: 0,
        damageTaken: 0,
        healingReceived: 0,
        goldEarned: 0,
        goldSpent: 0,
        killsByEnemyType: {},
        killsByFloor: {},
        classSpecific: {
          ranger: { shotsFired: 0, fireArrowKills: 0 },
          warrior: { executeKills: 0, frenzies: 0 },
          necromancer: { undeadCharmed: 0, undeadHealing: 0 }
        }
      };
    }
    if (!this.runStats.killsByEnemyType || typeof this.runStats.killsByEnemyType !== "object") this.runStats.killsByEnemyType = {};
    if (!this.runStats.killsByFloor || typeof this.runStats.killsByFloor !== "object") this.runStats.killsByFloor = {};
    if (!this.runStats.classSpecific || typeof this.runStats.classSpecific !== "object") this.runStats.classSpecific = {};
    if (!this.runStats.classSpecific.ranger || typeof this.runStats.classSpecific.ranger !== "object") {
      this.runStats.classSpecific.ranger = { shotsFired: 0, fireArrowKills: 0 };
    }
    if (!this.runStats.classSpecific.warrior || typeof this.runStats.classSpecific.warrior !== "object") {
      this.runStats.classSpecific.warrior = { executeKills: 0, frenzies: 0 };
    }
    if (!this.runStats.classSpecific.necromancer || typeof this.runStats.classSpecific.necromancer !== "object") {
      this.runStats.classSpecific.necromancer = { undeadCharmed: 0, undeadHealing: 0 };
    }
    const floorKey = `${Math.max(1, Math.floor(Number.isFinite(this.floor) ? this.floor : 1))}`;
    if (!Number.isFinite(this.runStats.killsByFloor[floorKey])) this.runStats.killsByFloor[floorKey] = 0;
    if (!Number.isFinite(this.runStats.totalKills)) this.runStats.totalKills = 0;
    if (!Number.isFinite(this.runStats.bossKills)) this.runStats.bossKills = 0;
    if (!Number.isFinite(this.runStats.floorsCleared)) this.runStats.floorsCleared = 0;
    if (!Number.isFinite(this.runStats.damageDealt)) this.runStats.damageDealt = 0;
    if (!Number.isFinite(this.runStats.damageTaken)) this.runStats.damageTaken = 0;
    if (!Number.isFinite(this.runStats.healingReceived)) this.runStats.healingReceived = 0;
    if (!Number.isFinite(this.runStats.goldEarned)) this.runStats.goldEarned = 0;
    if (!Number.isFinite(this.runStats.goldSpent)) this.runStats.goldSpent = 0;
    return this.runStats;
  },

  recordEnemyKill(enemy) {
    const stats = this.ensureRunStats();
    const enemyType = typeof enemy?.type === "string" && enemy.type.length > 0 ? enemy.type : "unknown";
    const floorKey = `${Math.max(1, Math.floor(Number.isFinite(this.floor) ? this.floor : 1))}`;
    stats.totalKills += 1;
    stats.killsByEnemyType[enemyType] = (stats.killsByEnemyType[enemyType] || 0) + 1;
    stats.killsByFloor[floorKey] = (stats.killsByFloor[floorKey] || 0) + 1;
  },

  recordClassSpecificStat(classKey, statKey, amount = 1) {
    const stats = this.ensureRunStats();
    if (!stats.classSpecific[classKey] || typeof stats.classSpecific[classKey] !== "object") return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    stats.classSpecific[classKey][statKey] = (stats.classSpecific[classKey][statKey] || 0) + amount;
  },

  recordRunDamageDealt(amount) {
    const stats = this.ensureRunStats();
    if (!Number.isFinite(amount) || amount <= 0) return;
    stats.damageDealt += amount;
  },

  recordRunDamageTaken(amount) {
    const stats = this.ensureRunStats();
    if (!Number.isFinite(amount) || amount <= 0) return;
    stats.damageTaken += amount;
  },

  recordRunHealingReceived(amount) {
    const stats = this.ensureRunStats();
    if (!Number.isFinite(amount) || amount <= 0) return;
    stats.healingReceived += amount;
  },

  recordRunGoldEarned(amount) {
    const stats = this.ensureRunStats();
    if (!Number.isFinite(amount) || amount <= 0) return;
    stats.goldEarned += amount;
  },

  recordRunGoldSpent(amount) {
    const stats = this.ensureRunStats();
    if (!Number.isFinite(amount) || amount <= 0) return;
    stats.goldSpent += amount;
  },

  recordRunBossKill() {
    const stats = this.ensureRunStats();
    stats.bossKills += 1;
  },

  recordRunFloorCleared() {
    const stats = this.ensureRunStats();
    stats.floorsCleared += 1;
  },

  getMapGrowthFactorForFloor(targetFloor) {
    const progression = this.config?.progression || {};
    const safeFloor = Number.isFinite(targetFloor) ? Math.max(2, Math.floor(targetFloor)) : 2;
    const byFloor = progression.mapGrowthFactorByFloor && typeof progression.mapGrowthFactorByFloor === "object"
      ? progression.mapGrowthFactorByFloor
      : null;
    const floorSpecific = byFloor ? Number(byFloor[safeFloor]) : NaN;
    if (Number.isFinite(floorSpecific) && floorSpecific > 1) return floorSpecific;
    const fallback = Number(progression.mapGrowthFactorDefault);
    if (Number.isFinite(fallback) && fallback > 1) return fallback;
    const legacy = Number(progression.mapGrowthFactorPerFloor);
    if (Number.isFinite(legacy) && legacy > 1) return legacy;
    return 1.05;
  },

  getMapSizeForFloor(targetFloor) {
    const safeFloor = Number.isFinite(targetFloor) ? Math.max(1, Math.floor(targetFloor)) : 1;
    let nextWidth = Number.isFinite(this.config?.map?.width) ? this.config.map.width : this.mapWidth;
    let nextHeight = Number.isFinite(this.config?.map?.height) ? this.config.map.height : this.mapHeight;
    for (let floor = 2; floor <= safeFloor; floor++) {
      const growth = this.getMapGrowthFactorForFloor(floor);
      nextWidth = Math.max(nextWidth + 1, Math.floor(nextWidth * growth));
      nextHeight = Math.max(nextHeight + 1, Math.floor(nextHeight * growth));
    }
    return {
      width: nextWidth,
      height: nextHeight
    };
  },

  shouldShowPlayerHealthBar() {
    const ratio = this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 0;
    return this.player.hpBarTimer > 0 || ratio <= this.config.player.lowHealthThreshold;
  },

  markPlayerHealthBarVisible() {
    this.player.hpBarTimer = this.config.player.hpBarDuration;
  },

  applyPlayerHealing(amount, options = {}) {
    this.applyHealingToPlayerEntity(this.player, amount, options);
  },

  getHealthPickupAmount() {
    const pct = Number.isFinite(this.config?.drops?.healthRestorePct) ? this.config.drops.healthRestorePct : 0.25;
    return Math.max(1, Math.round(this.player.maxHealth * Math.max(0, pct)));
  },

  applyPlayerDamage(amount) {
    this.applyDamageToPlayerEntity(this.player, amount, "physical");
  },

  triggerGameOver() {
    if (this.deathTransition.active) return;
    this.gameOver = true;
    this.paused = false;
    this.shopOpen = false;
    this.skillTreeOpen = false;
    this.statsPanelOpen = false;
    this.statsPanelPausedGame = false;
    this.deathTransition.active = true;
    this.deathTransition.elapsed = 0;
    this.deathTransition.returnTriggered = false;
    if (typeof this.onGameOverChanged === "function") this.onGameOverChanged(true, this);
  },

  updateDeathTransition(dt) {
    if (!this.deathTransition.active) return false;
    if (this.statsPanelOpen) return true;
    this.deathTransition.elapsed = Math.min(
      this.deathTransitionDuration,
      this.deathTransition.elapsed + Math.max(0, Number.isFinite(dt) ? dt : 0)
    );
    if (!this.deathTransition.returnTriggered && this.deathTransition.elapsed >= this.deathTransitionDuration) {
      this.deathTransition.returnTriggered = true;
      if (typeof this.onReturnToMenu === "function") this.onReturnToMenu();
    }
    return true;
  },

  getDeathTransitionProgress() {
    if (!this.deathTransition.active || this.deathTransitionDuration <= 0) return 0;
    return Math.max(0, Math.min(1, this.deathTransition.elapsed / this.deathTransitionDuration));
  },

  spawnFloatingText(x, y, text, color, life = 0.75, size = 14) {
    this.floatingTexts.push({ x, y, text, color, life, maxLife: life, vy: 22, size });
  },

  recordPlayerShotTelemetry(entry = {}) {
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.recentPlayerShots.push({
      atMs: Math.round(nowMs),
      classType: this.classType,
      floor: this.floor,
      ...entry
    });
    if (this.recentPlayerShots.length > 24) {
      this.recentPlayerShots.splice(0, this.recentPlayerShots.length - 24);
    }
  }
};
