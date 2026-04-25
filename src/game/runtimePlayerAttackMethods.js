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
  getWarriorDoctrine,
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
  getWarriorStanceLabel,
  getWarriorStanceModifier,
  getWarriorSwapCooldown,
  getWarriorWeaponForm,
  hasWarriorButchersPath,
  hasWarriorBattleFrenzy,
  hasWarriorParagon,
  hasWarriorCleaveDiscipline,
  hasWarriorJudgmentWave,
  hasWarriorRavager,
  hasWarriorSpellknight,
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

function getWarriorWeaponProfile(style) {
  switch (style) {
    case "longspear":
      return { style, weaponLabel: "Longspear", range: 76, arcDeg: 40, damageMult: 1.08, cooldownMult: 1.12, knockback: 11, bonusStagger: 0.18 };
    case "warWhip":
      return { style, weaponLabel: "War Whip", range: 60, arcDeg: 86, damageMult: 0.88, cooldownMult: 0.9, knockback: 8, slowOnHit: 0.12 };
    case "twinHatchets":
      return { style, weaponLabel: "Twin Hatchets", range: 38, arcDeg: 70, damageMult: 0.8, cooldownMult: 0.66, knockback: 9 };
    default:
      return { style: "broadswing", weaponLabel: "Broadswing", range: 44, arcDeg: 125, damageMult: 1, cooldownMult: 1, knockback: 12 };
  }
}

function getModifierDisplayLabel(modifier) {
  if (!modifier) return "Balanced";
  return `${modifier[0].toUpperCase()}${modifier.slice(1)}`;
}

export const runtimePlayerAttackMethods = {
  ensureWarriorRuntimeState() {
    this.warriorRuntime = this.warriorRuntime && typeof this.warriorRuntime === "object"
      ? this.warriorRuntime
      : (this.player?.warriorRuntime && typeof this.player.warriorRuntime === "object" ? this.player.warriorRuntime : {});
    if (this.player) this.player.warriorRuntime = this.warriorRuntime;
    if (typeof this.warriorRuntime.activeAttackMode !== "string") this.warriorRuntime.activeAttackMode = "primary";
    this.warriorRuntime.attackSwapCooldownTimer = Number.isFinite(this.warriorRuntime.attackSwapCooldownTimer) ? this.warriorRuntime.attackSwapCooldownTimer : 0;
    return this.warriorRuntime;
  },

  getCurrentWarriorAttackMode() {
    const runtime = this.ensureWarriorRuntimeState();
    return runtime.activeAttackMode === "secondary" ? "secondary" : "primary";
  },

  getCurrentWarriorStanceSlot() {
    return this.getCurrentWarriorAttackMode() === "secondary" ? "B" : "A";
  },

  toggleWarriorAttackMode() {
    if (!(this.isWarriorClass && this.isWarriorClass())) return false;
    const runtime = this.ensureWarriorRuntimeState();
    if ((runtime.attackSwapCooldownTimer || 0) > 0) return false;
    runtime.activeAttackMode = runtime.activeAttackMode === "secondary" ? "primary" : "secondary";
    runtime.attackSwapCooldownTimer = getWarriorSwapCooldown(this);
    if (getWarriorDoctrine(this) === "gladiator") {
      runtime.gladiatorSwapTimer = 1.6;
      runtime.gladiatorSwapMode = runtime.activeAttackMode;
      if (hasWarriorJudgmentWave(this)) this.gainWarriorShockReleaseCharges(1);
    }
    if (hasWarriorParagon(this)) {
      runtime.paragonPrimaryReady = runtime.activeAttackMode === "primary";
      runtime.paragonSecondaryReady = runtime.activeAttackMode === "secondary";
    }
    if (typeof this.spawnFloatingText === "function") {
      const label = this.getWarriorModeDisplayName(runtime.activeAttackMode);
      this.spawnFloatingText(this.player.x, this.player.y - 30, label, "#f4efe3", 0.55, 13);
    }
    return true;
  },

  getWarriorModeDisplayName(mode = null) {
    const stance = mode === "secondary" ? "B" : mode === "primary" ? "A" : this.getCurrentWarriorStanceSlot();
    return getWarriorStanceLabel(this, stance);
  },

  getWarriorWeaponProfile() {
    return getWarriorWeaponProfile(getWarriorWeaponForm(this));
  },

  getWarriorShockReleaseThreshold() {
    return getWarriorDoctrine(this) === "gladiator" ? 4 : 5;
  },

  clearWarriorMarks(ownerId = this.player?.id || null) {
    if (!ownerId) return;
    for (const enemy of this.enemies || []) {
      if (!enemy || enemy.arcaneMarkOwnerId !== ownerId) continue;
      enemy.arcaneMarkTimer = 0;
      enemy.arcaneMarkOwnerId = null;
    }
  },

  getWarriorMarkedEnemy(ownerId = this.player?.id || null) {
    if (!ownerId) return null;
    for (const enemy of this.enemies || []) {
      if (!enemy || (enemy.hp || 0) <= 0) continue;
      if ((enemy.arcaneMarkTimer || 0) > 0 && enemy.arcaneMarkOwnerId === ownerId) return enemy;
    }
    return null;
  },

  applyWarriorMark(enemy, duration = 5) {
    if (!enemy || (enemy.hp || 0) <= 0) return false;
    const ownerId = this.player?.id || null;
    if (!ownerId) return false;
    this.clearWarriorMarks(ownerId);
    enemy.arcaneMarkTimer = Math.max(enemy.arcaneMarkTimer || 0, duration);
    enemy.arcaneMarkOwnerId = ownerId;
    return true;
  },

  refreshWarriorMark(enemy, duration = 5) {
    const ownerId = this.player?.id || null;
    if (!enemy || !ownerId || enemy.arcaneMarkOwnerId !== ownerId) return false;
    enemy.arcaneMarkTimer = Math.max(enemy.arcaneMarkTimer || 0, duration);
    return true;
  },

  markHighestHpEnemy(candidates = [], duration = 5, anchorX = this.player?.x || 0, anchorY = this.player?.y || 0) {
    let best = null;
    let bestHp = -Infinity;
    let bestCenterDist = Number.POSITIVE_INFINITY;
    let bestPlayerDist = Number.POSITIVE_INFINITY;
    for (const enemy of candidates) {
      if (!enemy || (enemy.hp || 0) <= 0 || this.isEnemyFriendlyToPlayer(enemy)) continue;
      const totalHp = Number.isFinite(enemy.maxHp) && enemy.maxHp > 0 ? enemy.maxHp : (enemy.hp || 0);
      const centerDist = Math.hypot((enemy.x || 0) - anchorX, (enemy.y || 0) - anchorY);
      const playerDist = Math.hypot((enemy.x || 0) - (this.player?.x || 0), (enemy.y || 0) - (this.player?.y || 0));
      if (
        totalHp > bestHp ||
        (totalHp === bestHp && centerDist < bestCenterDist) ||
        (totalHp === bestHp && centerDist === bestCenterDist && playerDist < bestPlayerDist)
      ) {
        best = enemy;
        bestHp = totalHp;
        bestCenterDist = centerDist;
        bestPlayerDist = playerDist;
      }
    }
    if (!best) return null;
    this.applyWarriorMark(best, duration);
    return best;
  },

  gainWarriorShockReleaseCharges(amount = 0) {
    if (!hasWarriorJudgmentWave(this)) return 0;
    const runtime = this.ensureWarriorRuntimeState();
    const threshold = this.getWarriorShockReleaseThreshold();
    const gain = Math.max(0, Math.floor(amount));
    if (gain <= 0) return runtime.shockReleaseCharges || 0;
    runtime.shockReleaseCharges = Math.min(threshold, (runtime.shockReleaseCharges || 0) + gain);
    runtime.shockReleaseComboTimer = 2;
    if ((runtime.shockReleaseCharges || 0) >= threshold) runtime.shockReleaseReady = true;
    return runtime.shockReleaseCharges || 0;
  },

  triggerWarriorShockRelease(angle, range, attackProfile = null) {
    if (!hasWarriorJudgmentWave(this)) return false;
    const profile = attackProfile || this.getWarriorAttackProfile();
    const tile = this.config?.map?.tile || 32;
    const life = 0.9;
    const doctrine = getWarriorDoctrine(this);
    const waveTiles = doctrine === "eldritch" ? 11 : doctrine === "paladin" ? 8 : 5;
    const speed = (tile * waveTiles) / life;
    const damageType = doctrine === "eldritch" ? "arcane" : doctrine === "paladin" ? "holy" : "physical";
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
      damage: this.rollPrimaryDamage() * (getWarriorJudgmentWaveDamageMultiplier(this) + Math.max(0, profile?.waveDamageBonus || 0)),
      damageType,
      hitTargets: new Set(),
      ownerId: this.player.id || null,
      undeadDefenseShredPct: damageType === "holy" ? getWarriorJudgmentWaveShredPct(this) : 0,
      waveArc: Number.isFinite(profile?.arcDeg) ? (profile.arcDeg * Math.PI) / 180 : 0,
      markOnHit: doctrine === "paladin",
      markDuration: doctrine === "paladin" ? 5 : 0,
      shockKnockback: doctrine === "gladiator" ? 30 : 0,
      shockStun: doctrine === "gladiator" ? 0.5 : 0
    });
    const runtime = this.ensureWarriorRuntimeState();
    runtime.shockReleaseCharges = 0;
    runtime.shockReleaseComboTimer = 0;
    runtime.shockReleaseReady = false;
    return true;
  },

  getWarriorAttackProfile(mode = null) {
    const activeMode = mode || this.getCurrentWarriorAttackMode();
    const stance = activeMode === "secondary" ? "B" : "A";
    const modifier = getWarriorStanceModifier(this, stance);
    const doctrine = getWarriorDoctrine(this);
    const base = { ...this.getWarriorWeaponProfile() };
    const profile = {
      ...base,
      mode: activeMode,
      stance,
      modifier,
      modifierLabel: getModifierDisplayLabel(modifier),
      label: `${base.weaponLabel} / ${getModifierDisplayLabel(modifier)}`,
      arcaneBonus: 0,
      holyBonus: 0,
      blockWindow: 0,
      executeBonus: 0,
      markDuration: 0,
      waveChanceBonus: 0,
      waveDamageBonus: 0,
      surgeDuration: 0,
      moveStepTiles: 0,
      moveStepDir: "",
      slowOnHit: base.slowOnHit || 0,
      bonusStagger: base.bonusStagger || 0,
      hitWidthBonus: 0
    };

    switch (modifier) {
      case "cleaving":
        profile.arcDeg *= profile.style === "longspear" ? 1.5 : profile.style === "warWhip" ? 1.4 : 1.25;
        profile.range *= profile.style === "warWhip" ? 1.06 : profile.style === "twinHatchets" ? 1.14 : 1.02;
        profile.damageMult *= 0.92;
        profile.knockback += 2;
        break;
      case "focused":
        profile.arcDeg *= profile.style === "broadswing" ? 0.68 : profile.style === "warWhip" ? 0.74 : 0.8;
        profile.range *= profile.style === "longspear" ? 1.08 : 1;
        profile.damageMult *= 1.33;
        profile.cooldownMult *= 1.08;
        profile.knockback += 3;
        profile.bonusStagger += 0.12;
        profile.executeBonus += 0.2;
        break;
      case "swift":
        profile.arcDeg *= profile.style === "twinHatchets" ? 1.08 : 0.96;
        profile.damageMult *= 0.68;
        profile.cooldownMult *= 0.72;
        break;
      case "heavy":
        profile.arcDeg *= profile.style === "warWhip" ? 0.92 : 1.05;
        profile.range *= profile.style === "longspear" ? 1.06 : 1;
        profile.damageMult *= 1.28;
        profile.cooldownMult *= 1.22;
        profile.knockback += 10;
        profile.bonusStagger += 0.16;
        break;
      case "guarded":
        profile.damageMult *= 0.88;
        profile.cooldownMult *= 1.04;
        profile.blockWindow += 0.55;
        profile.knockback += 2;
        profile.arcDeg *= 1.02;
        profile.bonusStagger += 0.08;
        break;
      case "marked":
        profile.markDuration = 5;
        profile.range *= 1.1;
        if (profile.style === "warWhip") profile.slowOnHit = Math.max(profile.slowOnHit || 0, 0.14);
        break;
      default:
        break;
    }

    switch (doctrine) {
      case "paladin":
        profile.holyBonus += 0.14;
        if (modifier === "guarded") {
          profile.blockWindow += 0.45;
          profile.waveChanceBonus += 0.08;
        }
        if (modifier === "focused") profile.executeBonus += 0.08;
        break;
      case "berserker":
        profile.cooldownMult *= 0.94;
        if (modifier === "swift") profile.damageMult *= 1.06;
        if (modifier === "heavy") profile.knockback += 4;
        break;
      case "gladiator":
        profile.damageMult *= 1.04;
        profile.bonusStagger += 0.04;
        break;
      case "eldritch":
        profile.arcaneBonus += 0.16;
        profile.surgeDuration = Math.max(profile.surgeDuration, 1.2);
        if (modifier === "guarded") profile.blockWindow += 0.3;
        if (modifier === "focused") profile.executeBonus += 0.08;
        break;
      default:
        break;
    }

    const runtime = this.ensureWarriorRuntimeState();
    const hasGladiatorSwapBonus = doctrine === "gladiator" && (runtime.gladiatorSwapTimer || 0) > 0 && runtime.gladiatorSwapMode === activeMode;
    if (hasGladiatorSwapBonus) {
      switch (modifier) {
        case "cleaving":
          profile.range *= 1.08;
          profile.arcDeg *= 1.08;
          break;
        case "focused":
          profile.damageMult *= 1.1;
          profile.executeBonus += 0.08;
          break;
        case "swift":
          profile.cooldownMult *= 0.9;
          break;
        case "heavy":
          profile.knockback += 4;
          profile.bonusStagger += 0.08;
          break;
        case "guarded":
          profile.blockWindow += 0.25;
          break;
        case "marked":
          profile.markDuration = Math.max(profile.markDuration || 0, 5);
          break;
        default:
          profile.damageMult *= 1.06;
          break;
      }
    }

    return profile;
  },

  getWarriorPrimaryProfile() {
    return this.getWarriorAttackProfile("primary");
  },

  getWarriorSecondaryProfile() {
    return this.getWarriorAttackProfile("secondary");
  },

  fire(dx, dy) {
    if (this.isNecromancerClass()) return;
    if (this.player.fireCooldown > 0) return;
    if (isWarriorTalentGame(this) && !this.classSpec.usesRanged) {
      const profile = this.getWarriorAttackProfile();
      this.player.fireCooldown = this.getPlayerFireCooldown() * (profile.cooldownMult || 1);
      this.performMeleeAttack(dx, dy, profile);
      return;
    }
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

  performMeleeAttack(dx, dy, profile = null) {
    const attackProfile = profile || (isWarriorTalentGame(this) ? this.getWarriorAttackProfile() : null);
    if ((attackProfile?.moveStepTiles || 0) > 0) {
      const len = Math.hypot(dx, dy) || 1;
      const dir = attackProfile.moveStepDir === "back" ? -1 : 1;
      const tile = this.config?.map?.tile || 32;
      this.moveWithCollisionSubsteps(this.player, (dx / len) * tile * attackProfile.moveStepTiles * dir, (dy / len) * tile * attackProfile.moveStepTiles * dir);
    }
    let range = Number.isFinite(attackProfile?.range) ? attackProfile.range : (this.classSpec.meleeRange || 42);
    const hitPadding = Number.isFinite(this.classSpec.meleeHitPadding) ? Math.max(0, this.classSpec.meleeHitPadding) : 0;
    let arcDeg = Number.isFinite(attackProfile?.arcDeg) ? attackProfile.arcDeg : (this.classSpec.meleeArcDeg || 95);
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
      if (getWarriorDoctrine(this) === "gladiator" && (this.warriorRuntime.gladiatorSwapTimer || 0) > 0 && this.warriorRuntime.gladiatorSwapMode === (attackProfile?.mode || this.getCurrentWarriorAttackMode())) {
        this.warriorRuntime.gladiatorSwapTimer = 0;
        this.warriorRuntime.gladiatorSwapMode = "";
      }
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
    let hitAnyEnemy = false;
    let markedKill = false;
    const ownerId = this.player?.id || null;
    const currentlyMarkedEnemy = this.getWarriorMarkedEnemy(ownerId);
    const markedHits = [];
    let markedTargetKilled = false;
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
      style: attackProfile?.style || "broadswing",
      label: attackProfile?.label || "Strike",
      modifier: attackProfile?.modifier || "",
      stance: attackProfile?.stance || "",
      doctrine: isWarriorTalentGame(this) ? getWarriorDoctrine(this) : "",
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
        const wasMarked = (enemy.arcaneMarkTimer || 0) > 0 && enemy.arcaneMarkOwnerId === ownerId;
        let damage = this.rollPrimaryDamage() * (Number.isFinite(attackProfile?.damageMult) ? attackProfile.damageMult : 1);
        if (isWarriorTalentGame(this)) {
          damage *= 1 + getWarriorHeavyHandDamageBonus(this, enemy);
          damage *= 1 + getWarriorCrusaderUndeadDamageBonus(this, enemy);
          if ((this.warriorMomentumTimer || 0) > 0) damage *= 1 + getWarriorBattleFrenzyDamageBonus(this);
          if (this.warriorRuntime?.butcherEmpowerReady) {
            damage *= 1 + getWarriorButchersPathNextHitDamageBonus(this);
            consumedButcherEmpower = true;
          }
          if (attackProfile?.style === "twinHatchets") {
            this.warriorRuntime.cleaveCounter = (this.warriorRuntime.cleaveCounter || 0) + 1;
            if (this.warriorRuntime.cleaveCounter % 3 === 0) damage *= 1.25;
          }
          if (attackProfile?.style === "warWhip") {
            enemy.slowTimer = Math.max(enemy.slowTimer || 0, 1.2);
            enemy.slowPct = Math.max(enemy.slowPct || 0, attackProfile.slowOnHit || 0);
          }
          if (attackProfile?.style === "longspear") {
            enemy.pendingBonusStagger = Math.max(enemy.pendingBonusStagger || 0, attackProfile.bonusStagger || 0);
          }
          if (wasMarked) {
            damage += 3;
            const doctrine = getWarriorDoctrine(this);
            if (doctrine === "berserker") damage += 3;
            if (doctrine === "gladiator" && Math.random() < 0.1) damage *= 2;
          }
          if (hasWarriorSpellknight(this)) damage += this.rollPrimaryDamage() * 0.15;
          if (hasWarriorParagon(this) && this.warriorRuntime?.paragonPrimaryReady) {
            damage *= 1.18;
            this.warriorRuntime.paragonPrimaryReady = false;
          }
          if (hasWarriorParagon(this) && this.warriorRuntime?.paragonSecondaryReady) {
            damage *= 1.1;
            enemy.hitCooldown = Math.max(enemy.hitCooldown || 0, 0.15);
            this.warriorRuntime.paragonSecondaryReady = false;
          }
          if (hasWarriorRavager(this)) {
            const missingRatio = this.player?.maxHealth > 0 ? 1 - ((this.player?.health || 0) / this.player.maxHealth) : 0;
            damage *= 1 + 0.15 * Math.max(0, Math.min(1, missingRatio));
          }
          if (attackProfile?.stance === "B") damage *= 1 + (attackProfile.executeBonus || 0) * 0.3;
          damage *= critMultiplier;
        }
        this.applyEnemyDamage(enemy, damage, "melee", this.player.id || null);
        const warCircle = typeof this.getCrusaderConsecratedZoneForEntity === "function" ? this.getCrusaderConsecratedZoneForEntity(this.player) : null;
        if (warCircle?.zoneType === "warCircle" && warCircle.doctrine === "berserker" && damage > 0 && typeof this.applyHealingToPlayerEntity === "function") {
          this.applyHealingToPlayerEntity(this.player, damage * 0.06, { suppressText: true });
        }
        if ((attackProfile?.knockback || 0) > 0) {
          const knockbackScale = enemy.isBoss ? 0.35 : 1;
          enemy.vx = (enemy.vx || 0) + Math.cos(angle) * attackProfile.knockback * knockbackScale;
          enemy.vy = (enemy.vy || 0) + Math.sin(angle) * attackProfile.knockback * knockbackScale;
        }
        if ((attackProfile?.holyBonus || 0) > 0) {
          this.applyEnemyDamage(enemy, this.rollPrimaryDamage() * attackProfile.holyBonus, "holy", this.player.id || null);
        }
        if ((attackProfile?.arcaneBonus || 0) > 0) {
          this.applyEnemyDamage(enemy, this.rollPrimaryDamage() * attackProfile.arcaneBonus, "arcane", this.player.id || null);
        }
        if (wasMarked && getWarriorDoctrine(this) === "paladin") {
          this.applyEnemyDamage(enemy, 2, "holy", this.player.id || null);
        }
        if (wasMarked && getWarriorDoctrine(this) === "eldritch") {
          this.applyEnemyDamage(enemy, 2, "arcane", this.player.id || null);
        }
        if ((attackProfile?.surgeDuration || 0) > 0 && getWarriorDoctrine(this) === "eldritch") {
          this.warriorRuntime.eldritchSurgeTimer = Math.max(this.warriorRuntime.eldritchSurgeTimer || 0, attackProfile.surgeDuration);
        }
        if (typeof this.applyConsumableOnHitEffects === "function") this.applyConsumableOnHitEffects(enemy, this.player.id || null);
        enemiesHit += 1;
        hitAnyEnemy = true;
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
        if ((attackProfile?.slowOnHit || 0) > 0) {
          enemy.slowTimer = Math.max(enemy.slowTimer || 0, 1.2);
          enemy.slowPct = Math.max(enemy.slowPct || 0, attackProfile.slowOnHit || 0);
        }
        if ((attackProfile?.bonusStagger || 0) > 0) {
          enemy.pendingBonusStagger = Math.max(enemy.pendingBonusStagger || 0, attackProfile.bonusStagger || 0);
          enemy.hitCooldown = Math.max(enemy.hitCooldown || 0, Math.min(0.38, attackProfile.bonusStagger * 1.2));
        }
        if ((attackProfile?.blockWindow || 0) > 0) {
          this.player.blockBonusTimer = Math.max(this.player.blockBonusTimer || 0, attackProfile.blockWindow || 0);
          if (getWarriorDoctrine(this) === "eldritch" && (this.warriorRuntime.eldritchWardCooldownTimer || 0) <= 0) {
            this.warriorRuntime.eldritchWardHp = Math.max(this.warriorRuntime.eldritchWardHp || 0, Math.round((this.player.maxHealth || 0) * 0.12));
            this.warriorRuntime.eldritchWardCooldownTimer = 2;
          }
        }
        if ((attackProfile?.markDuration || 0) > 0) markedHits.push(enemy);
        if (wasMarked) this.refreshWarriorMark(enemy, 5);
        if ((attackProfile?.executeBonus || 0) > 0) {
          const executeHpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
          if (executeHpRatio <= 0.35 && enemy.hp > 0) {
            this.applyEnemyDamage(enemy, this.rollPrimaryDamage() * attackProfile.executeBonus, "melee", this.player.id || null);
          }
        }
        if (wasMarked && getWarriorDoctrine(this) === "eldritch" && (this.warriorRuntime.eldritchMarkedSparkTimer || 0) <= 0) {
          const tile = this.config?.map?.tile || 32;
          let chainTarget = null;
          let bestDist = Number.POSITIVE_INFINITY;
          for (const other of this.enemies || []) {
            if (!other || other === enemy || (other.hp || 0) <= 0 || this.isEnemyFriendlyToPlayer(other)) continue;
            const dist = vecLength((other.x || 0) - (enemy.x || 0), (other.y || 0) - (enemy.y || 0));
            if (dist > tile * 2.6 || dist >= bestDist) continue;
            chainTarget = other;
            bestDist = dist;
          }
          if (chainTarget) {
            this.applyEnemyDamage(chainTarget, 2, "arcane", this.player.id || null);
            this.fireZones.push({
              x: enemy.x,
              y: enemy.y,
              targetX: chainTarget.x,
              targetY: chainTarget.y,
              zoneType: "arcaneChain",
              life: 0.18,
              totalLife: 0.18
            });
          }
          this.warriorRuntime.eldritchMarkedSparkTimer = 0.5;
        }
        if (isWarriorTalentGame(this) && hpBefore > 0 && enemy.hp <= 0 && raging && (!this.isEnemyFriendlyToPlayer || !this.isEnemyFriendlyToPlayer(enemy))) {
          if (hasWarriorBattleFrenzy(this)) {
            const victoryRushHeal = this.getWarriorRageVictoryRushHeal();
            if (victoryRushHeal > 0) {
              this.warriorRageVictoryRushPool = Math.min(this.getWarriorRageVictoryRushPoolCap(), (this.warriorRageVictoryRushPool || 0) + victoryRushHeal);
              this.warriorRageVictoryRushTimer = this.getWarriorRageVictoryRushHotDuration();
              this.spawnFloatingText(this.player.x, this.player.y - 32, "Victory Rush", "#ffb3b3", 0.8, 13);
            }
          }
          if (getWarriorDoctrine(this) === "berserker") {
            this.warriorRageActiveTimer = Math.min(this.getWarriorRageDuration(), (this.warriorRageActiveTimer || 0) + 0.1);
          }
        }
        if (hpBefore > 0 && enemy.hp <= 0 && wasMarked) {
          markedKill = true;
          if (currentlyMarkedEnemy === enemy) markedTargetKilled = true;
        }
        if (wasMarked && getWarriorDoctrine(this) === "gladiator") {
          this.warriorRuntime.gladiatorSwapTimer = Math.min(1.6, Math.max(this.warriorRuntime.gladiatorSwapTimer || 0, 0.6) + 0.22);
          this.warriorRuntime.gladiatorSwapMode = attackProfile?.mode || this.getCurrentWarriorAttackMode();
        }
      }
    }
    if (markedHits.length > 0) this.markHighestHpEnemy(markedHits, attackProfile?.markDuration || 5, this.player.x + Math.cos(angle) * range * 0.5, this.player.y + Math.sin(angle) * range * 0.5);
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
    if (isWarriorTalentGame(this) && hasWarriorJudgmentWave(this) && hitAnyEnemy) {
      const runtime = this.ensureWarriorRuntimeState();
      if (runtime.shockReleaseReady) {
        this.triggerWarriorShockRelease(angle, range, attackProfile);
      } else {
        let chargesEarned = 1;
        if (attackProfile?.modifier === "heavy" && Math.random() < 0.2) chargesEarned += 1;
        if (getWarriorDoctrine(this) === "paladin" && raging && Math.random() < 0.1) chargesEarned += 1;
        if (getWarriorDoctrine(this) === "eldritch" && markedKill && Math.random() < 0.1) chargesEarned += 1;
        if (getWarriorDoctrine(this) === "berserker") {
          const hpRatio = this.player?.maxHealth > 0 ? (this.player.health || 0) / this.player.maxHealth : 1;
          if (hpRatio <= 0.25) chargesEarned *= 2;
        }
        this.gainWarriorShockReleaseCharges(chargesEarned);
      }
    }
    if (markedTargetKilled && getWarriorDoctrine(this) === "berserker" && (this.warriorRuntime.berserkerMarkedFrenzyCooldown || 0) <= 0) {
      this.warriorMomentumTimer = Math.max(this.warriorMomentumTimer || 0, Math.max(0, (this.warriorMomentumTimer || 0)) + 2);
      this.warriorRuntime.berserkerMarkedFrenzyCooldown = 10;
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
