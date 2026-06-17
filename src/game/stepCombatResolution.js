import { vecLength } from "../utils.js";
import { finalizeProjectilesAndTransientState, pulseMageFrozenOrb, resolveSpecialProjectileCollision } from "./stepCombatProjectileSpecials.js";
import { resolveAssassinProjectileEffects } from "./stepAssassinCombat.js";
import { resolveFireZonesAndEnemyStatus } from "./stepCombatZoneAndEnemyStatus.js";
import { getNecromancerPlaguecraftRiseChance, getNecromancerRotDps, getNecromancerRotDuration, hasNecromancerHarvester, hasNecromancerPlaguecraftRot, isNecromancerTalentGame } from "./necromancerTalentTree.js";
import { hasWarriorSpellknight } from "./warriorTalentTree.js";
import { hasRangerTalent } from "./rangerTalentTree.js";
import { spawnGhost, spawnSkeleton } from "./enemySpawnFactories.js";
import { pickupOwlItemDrop } from "./world/owlDelivery.js";
import { recordFlameOfTheFallenKill } from "./world/consumablesEconomy.js";

export function resolveCombatAndDrops({
  game,
  dt,
  activeEnemies,
  activeBreakables,
  playerEnemyRadius,
  enemyBlocksPlayerBody,
  isActive,
  segmentRectHit,
  skeletonIgnoresArrow
}) {
  const getLivingPlayers = () => (typeof game.getLivingPlayerEntities === "function" ? game.getLivingPlayerEntities() : [game.player]);
  const preserveDeathRemnant = (enemy) => {
    if (!enemy) return false;
    enemy.hp = 0;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.siphoning = false;
    enemy.deathProcessed = true;
    enemy.slowTimer = 0;
    enemy.slowPct = 0;
    const corpseDuration = enemy.isBoss || enemy.isFloorBoss ? 18 : 12;
    enemy.corpseTimer = Math.max(Number.isFinite(enemy.corpseTimer) ? enemy.corpseTimer : 0, corpseDuration);
    return true;
  };
  const blocksPlayerBody = typeof enemyBlocksPlayerBody === "function"
    ? enemyBlocksPlayerBody
    : (enemy) => {
        if (!enemy) return false;
        if (Number.isFinite(enemy.hp) && enemy.hp <= 0) return false;
        if (enemy.type === "skeleton_warrior" && enemy.collapsed) return false;
        return true;
      };
  const isDamageableEnemyTarget = (enemy) => {
    if (!enemy) return false;
    if (Number.isFinite(enemy.hp) && enemy.hp <= 0) return false;
    if (enemy.type === "skeleton_warrior" && enemy.collapsed) return false;
    return true;
  };
  const damagePlayer = (player, amount, type = "physical", source = null) => {
    if (!player || amount <= 0) return;
    const resolved = typeof game.getDamageTakenForPlayerEntity === "function" ? game.getDamageTakenForPlayerEntity(player, amount, type, source) : amount;
    if (typeof game.applyDamageToPlayerEntity === "function") game.applyDamageToPlayerEntity(player, resolved, type, source);
    else game.applyPlayerDamage(resolved);
  };
  const healPlayer = (player, amount) => {
    if (!player || amount <= 0) return;
    if (typeof game.applyHealingToPlayerEntity === "function") game.applyHealingToPlayerEntity(player, amount);
    else if (player === game.player) game.applyPlayerHealing(amount);
  };
  const getPlayerCombatContext = (playerId) => {
    const owner = typeof game.getPlayerEntityById === "function" ? game.getPlayerEntityById(playerId || null) : null;
    if (!owner || owner === game.player) return game;
    const context = Object.create(game);
    context.player = owner;
    context.classType = owner.classType || game.classType;
    context.classSpec = game.config?.classes?.[context.classType] || game.classSpec;
    context.level = Number.isFinite(owner.level) ? owner.level : game.level;
    context.levelWeaponDamageBonus = Number.isFinite(owner.levelWeaponDamageBonus) ? owner.levelWeaponDamageBonus : 0;
    context.skills = owner.skills || {};
    context.rangerTalents = owner.rangerTalents || {};
    context.rangerRuntime = owner.rangerRuntime && typeof owner.rangerRuntime === "object" ? owner.rangerRuntime : {};
    owner.rangerRuntime = context.rangerRuntime;
    context.warriorTalents = owner.warriorTalents || {};
    context.warriorRuntime = owner.warriorRuntime && typeof owner.warriorRuntime === "object" ? owner.warriorRuntime : {};
    owner.warriorRuntime = context.warriorRuntime;
    context.necromancerTalents = owner.necromancerTalents || {};
    context.necromancerRuntime = owner.necromancerRuntime && typeof owner.necromancerRuntime === "object" ? owner.necromancerRuntime : {};
    owner.necromancerRuntime = context.necromancerRuntime;
    return context;
  };
  const getProjectileOwnerContext = (projectile) => {
    if (
      !projectile ||
      typeof projectile.projectileType !== "string" ||
      (!projectile.projectileType.startsWith("ranger_") && !projectile.projectileType.startsWith("mage_"))
    ) {
      return game;
    }
    return getPlayerCombatContext(projectile.ownerId || null);
  };
  const getRewardOwner = (enemy) => {
    const ownerId = typeof enemy?.lastDamageOwnerId === "string" && enemy.lastDamageOwnerId ? enemy.lastDamageOwnerId : null;
    const owner = typeof game.getPlayerEntityById === "function" ? game.getPlayerEntityById(ownerId) : null;
    const livingPlayers = getLivingPlayers();
    const fallbackOwner = Array.isArray(livingPlayers) && livingPlayers.length > 0
      ? livingPlayers[0]
      : (typeof game.isLivingPlayerEntity === "function" ? (game.isLivingPlayerEntity(game.player) ? game.player : null) : game.player);
    const resolvedOwner = owner || fallbackOwner;
    if (!resolvedOwner) return null;
    if (typeof game.isLivingPlayerEntity === "function" && !game.isLivingPlayerEntity(resolvedOwner)) return null;
    return resolvedOwner;
  };

  for (const b of game.bullets) {
    if (!isActive(b, 180)) {
      b.life = 0;
      continue;
    }
    if (b.homing && b.faction !== "enemy") {
      let target = null;
      let best = Number.POSITIVE_INFINITY;
      const range = Number.isFinite(b.range) ? b.range : game.config.map.tile * 8;
      const originX = Number.isFinite(b.homingOriginX) ? b.homingOriginX : b.x;
      const originY = Number.isFinite(b.homingOriginY) ? b.homingOriginY : b.y;
      const dirLen = vecLength(b.homingDirX || 0, b.homingDirY || 0);
      const dirX = dirLen > 0 ? (b.homingDirX || 0) / dirLen : Math.cos(b.angle || 0);
      const dirY = dirLen > 0 ? (b.homingDirY || 0) / dirLen : Math.sin(b.angle || 0);
      const coneCos = Number.isFinite(b.homingConeCos) ? b.homingConeCos : -1;
      for (const enemy of activeEnemies) {
        if (!enemy || (enemy.hp || 0) <= 0 || (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy))) continue;
        const originDist = vecLength((enemy.x || 0) - originX, (enemy.y || 0) - originY);
        if (originDist > range) continue;
        if (coneCos > -1 && originDist > 0) {
          const dot = (((enemy.x || 0) - originX) / originDist) * dirX + (((enemy.y || 0) - originY) / originDist) * dirY;
          if (dot < coneCos) continue;
        }
        const dist = vecLength((enemy.x || 0) - (b.x || 0), (enemy.y || 0) - (b.y || 0));
        if (dist >= best) continue;
        target = enemy;
        best = dist;
      }
      if (target) {
        const speed = vecLength(b.vx || 0, b.vy || 0) || 320;
        const dx = (target.x || 0) - (b.x || 0);
        const dy = (target.y || 0) - (b.y || 0);
        const len = vecLength(dx, dy) || 1;
        b.vx = (dx / len) * speed;
        b.vy = (dy / len) * speed;
        b.angle = Math.atan2(b.vy, b.vx);
      }
    }
    const prevX = b.x;
    const prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.prevXForHit = prevX;
    b.prevYForHit = prevY;
    b.life -= dt;
    pulseMageFrozenOrb(game, b, dt);
    if (b.projectileType === "deathBolt" && Number.isFinite(b.detonateX) && Number.isFinite(b.detonateY)) {
      const remaining = vecLength((b.detonateX || 0) - b.x, (b.detonateY || 0) - b.y);
      const stepDistance = vecLength(b.x - prevX, b.y - prevY);
      if (remaining <= Math.max(b.size || 10, stepDistance)) {
        b.x = b.detonateX;
        b.y = b.detonateY;
        b.pendingDeathBoltExplosion = true;
      }
    }
    if (b.projectileType === "mage_fireball" && Number.isFinite(b.detonateX) && Number.isFinite(b.detonateY)) {
      const remaining = vecLength((b.detonateX || 0) - b.x, (b.detonateY || 0) - b.y);
      const stepDistance = vecLength(b.x - prevX, b.y - prevY);
      if (remaining <= Math.max(b.size || 10, stepDistance)) {
        b.x = b.detonateX;
        b.y = b.detonateY;
        if (typeof game.triggerMageFireballExplosion === "function") game.triggerMageFireballExplosion(b.x, b.y, b);
        b.life = 0;
      }
    }
    for (const br of activeBreakables) {
      if ((br.hp || 0) <= 0) continue;
      const half = (br.size || 20) * 0.5 + (b.size || 6) * 0.5;
      if (segmentRectHit(prevX, prevY, b.x, b.y, br.x - half, br.y - half, br.x + half, br.y + half)) {
        if (b.projectileType !== "trapArrow") br.hp = 0;
        if (b.projectileType === "mage_fireball" && typeof game.triggerMageFireballExplosion === "function") game.triggerMageFireballExplosion(b.x, b.y, b);
        b.life = 0;
        break;
      }
    }
    if (b.faction === "enemy") continue;
  }
  for (const a of game.fireArrows) {
    if (!isActive(a, 220)) {
      a.life = 0;
      continue;
    }
    const prevX = a.x;
    const prevY = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.life -= dt;
    if (Number.isFinite(a.detonateX) && Number.isFinite(a.detonateY)) {
      const remaining = vecLength((a.detonateX || 0) - a.x, (a.detonateY || 0) - a.y);
      const stepDistance = vecLength(a.x - prevX, a.y - prevY);
      if (remaining <= Math.max(a.size || 8, stepDistance)) {
        a.x = a.detonateX;
        a.y = a.detonateY;
        game.triggerFireExplosion(a.x, a.y, a);
        a.life = 0;
        continue;
      }
    }
    for (const br of activeBreakables) {
      if ((br.hp || 0) <= 0) continue;
      const half = (br.size || 20) * 0.5 + (a.size || 8) * 0.5;
      if (segmentRectHit(prevX, prevY, a.x, a.y, br.x - half, br.y - half, br.x + half, br.y + half)) {
        br.hp = 0;
        game.triggerFireExplosion(a.x, a.y, a);
        a.life = 0;
        break;
      }
    }
  }
  for (const d of game.drops) d.life -= dt;
  for (const z of game.fireZones) z.life -= dt;
  for (const s of game.meleeSwings) s.life -= dt;

  finalizeProjectilesAndTransientState(game);

  for (const b of game.bullets) {
    if (b.life <= 0) continue;
    if (b.visualOnly) continue;
    if (!b.faction || b.faction !== "enemy") {
      for (const zone of game.fireZones || []) {
        if (!zone || zone.life <= 0 || zone.zoneType !== "pinningFire") continue;
        const dx = (b.x || 0) - (zone.x || 0);
        const dy = (b.y || 0) - (zone.y || 0);
        if (Math.hypot(dx, dy) <= (zone.radius || 0) + (b.size || 6) * 0.5) {
          b.passedPinningFire = true;
          break;
        }
      }
    }
    if (resolveSpecialProjectileCollision({
      game,
      projectile: b,
      activeEnemies,
      activeBreakables,
      getLivingPlayers,
      playerEnemyRadius,
      damagePlayer,
      skeletonIgnoresArrow
    })) {
      continue;
    }
    if (!b.hitTargets) b.hitTargets = new Set();
    if (b.faction === "enemy") {
      for (const enemy of activeEnemies) {
        if (!isDamageableEnemyTarget(enemy)) continue;
        if (!game.isEnemyFriendlyToPlayer || !game.isEnemyFriendlyToPlayer(enemy)) continue;
        if (vecLength(b.x - enemy.x, b.y - enemy.y) < (enemy.size + b.size) * 0.5) {
          const rawDamage = Number.isFinite(b.damage) ? b.damage : game.config.enemy.necromancerProjectileDamage || 16;
          game.applyEnemyDamage(enemy, rawDamage * game.getEnemyDamageScale(), b.damageType || "necrotic", b.ownerId || null);
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      let reflected = false;
      for (const player of getLivingPlayers()) {
        if (vecLength(b.x - player.x, b.y - player.y) >= ((player.size || game.player.size) + b.size) * 0.5) continue;
        if (typeof game.getWarriorMissileProtectorForPlayerEntity === "function" && typeof game.tryReflectMissileForPlayerEntity === "function") {
          const protector = game.getWarriorMissileProtectorForPlayerEntity(player);
          if (protector && game.tryReflectMissileForPlayerEntity(protector, b, protector)) {
            reflected = true;
            break;
          }
        }
        const rawDamage = Number.isFinite(b.damage) ? b.damage : game.config.enemy.necromancerProjectileDamage || 16;
        const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
        damagePlayer(player, scaledEnemyDamage, b.damageType || "necrotic");
        b.life = 0;
        break;
      }
      if (reflected) continue;
      continue;
    }
    for (const br of activeBreakables) {
      if (b.hitTargets.has(br)) continue;
      if (vecLength(b.x - br.x, b.y - br.y) < (br.size + b.size) * 0.45) {
        br.hp = 0;
        b.hitTargets.add(br);
        b.life = 0;
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const enemy of activeEnemies) {
      if (!isDamageableEnemyTarget(enemy)) continue;
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
      if (b.hitTargets.has(enemy)) continue;
      const projectileHitRadius = (enemy.size + b.size) * 0.5;
      const hitPrevX = Number.isFinite(b.prevXForHit) ? b.prevXForHit : b.x;
      const hitPrevY = Number.isFinite(b.prevYForHit) ? b.prevYForHit : b.y;
      const hitDistance = b.useSegmentHit
        ? (() => {
          const sx = b.x - hitPrevX;
          const sy = b.y - hitPrevY;
          const lenSq = sx * sx + sy * sy;
          if (lenSq <= 0.001) return vecLength(b.x - enemy.x, b.y - enemy.y);
          const t = Math.max(0, Math.min(1, (((enemy.x || 0) - hitPrevX) * sx + ((enemy.y || 0) - hitPrevY) * sy) / lenSq));
          return vecLength((hitPrevX + sx * t) - enemy.x, (hitPrevY + sy * t) - enemy.y);
        })()
        : vecLength(b.x - enemy.x, b.y - enemy.y);
      if (hitDistance < projectileHitRadius) {
        if (skeletonIgnoresArrow(enemy)) {
          b.hitTargets.add(enemy);
          continue;
        }
        if (b.projectileType === "mage_fireball") {
          if (typeof game.triggerMageFireballExplosion === "function") game.triggerMageFireballExplosion(b.x, b.y, b);
          b.hitTargets.add(enemy);
          b.life = 0;
          break;
        }
        const projectileOwnerContext = getProjectileOwnerContext(b);
        const isMageProjectile = typeof b.projectileType === "string" && b.projectileType.startsWith("mage_");
        const projectileDamage = isMageProjectile
          ? (Number.isFinite(b.damage) ? b.damage : game.rollPrimaryDamage()) * Math.max(0.01, Number.isFinite(b.damageMult) ? b.damageMult : 1) * Math.max(0.01, Number.isFinite(b.critMultiplier) ? b.critMultiplier : 1)
          : b.projectileType === "holyWave"
          ? (Number.isFinite(b.damage) ? b.damage : game.rollPrimaryDamage()) * Math.max(0.01, Number.isFinite(b.damageMult) ? b.damageMult : 1)
          : typeof projectileOwnerContext.getRangerArrowDamageAgainst === "function"
          ? projectileOwnerContext.getRangerArrowDamageAgainst(enemy, b)
          : (Number.isFinite(b.damage) ? b.damage : game.rollPrimaryDamage()) * Math.max(0.01, Number.isFinite(b.damageMult) ? b.damageMult : 1);
        const damageType = typeof b.damageType === "string" && b.damageType ? b.damageType : (b.projectileType === "holyWave" ? "holy" : "arrow");
        game.applyEnemyDamage(enemy, projectileDamage, damageType, b.ownerId || null, { critical: (b.critMultiplier || 1) > 1 });
        if (b.projectileType === "holyWave") {
          if ((b.shockKnockback || 0) > 0) {
            const angle = Number.isFinite(b.angle) ? b.angle : Math.atan2((b.vy || 0), (b.vx || 1));
            const knockbackScale = enemy.isBoss ? 0.35 : 1;
            enemy.vx = (enemy.vx || 0) + Math.cos(angle) * b.shockKnockback * knockbackScale;
            enemy.vy = (enemy.vy || 0) + Math.sin(angle) * b.shockKnockback * knockbackScale;
          }
          if ((b.shockStun || 0) > 0) {
            enemy.hitCooldown = Math.max(enemy.hitCooldown || 0, b.shockStun);
          }
        }
        if (
          b.projectileType === "holyWave" &&
          damageType === "holy" &&
          typeof game.isUndeadEnemy === "function" &&
          game.isUndeadEnemy(enemy) &&
          Number.isFinite(b.undeadDefenseShredPct) &&
          b.undeadDefenseShredPct > 0
        ) {
          enemy.crusaderDefenseShredPct = Math.max(enemy.crusaderDefenseShredPct || 0, b.undeadDefenseShredPct);
          enemy.crusaderDefenseShredTimer = Math.max(enemy.crusaderDefenseShredTimer || 0, 4);
        }
        if (b.projectileType === "holyWave" && b.markOnHit && typeof game.getPlayerEntityById === "function") {
          const owner = game.getPlayerEntityById(b.ownerId || null);
          const hpValue = Number.isFinite(enemy.maxHp) && enemy.maxHp > 0 ? enemy.maxHp : (enemy.hp || 0);
          if (!b.markCandidate || hpValue > (b.markCandidateHp || -Infinity)) {
            b.markCandidate = enemy;
            b.markCandidateHp = hpValue;
            if (owner && typeof game.applyWarriorMark === "function") game.applyWarriorMark(enemy, b.markDuration || 5);
          }
        }
        if (typeof game.applyConsumableOnHitEffects === "function") {
          game.applyConsumableOnHitEffects(enemy, b.ownerId || null, {
            fireOil: !!b.consumableFireOil,
            frostOil: !!b.consumableFrostOil
          });
        }
        if (b.projectileType && String(b.projectileType).startsWith("mage_")) {
          if (b.mageCantrip && (projectileOwnerContext.necromancerTalents?.battlemage?.points || 0) > 0) {
            const owner = projectileOwnerContext.player || (typeof game.getPlayerEntityById === "function" ? game.getPlayerEntityById(b.ownerId || null) : game.player);
            const tile = game.config?.map?.tile || 32;
            if (owner && vecLength((enemy.x || 0) - owner.x, (enemy.y || 0) - owner.y) <= tile * 2) {
              game.applyEnemyDamage(enemy, projectileDamage * 0.25, b.damageType || "arcane", b.ownerId || null);
            }
          }
          if ((b.burnDuration || 0) > 0) {
            enemy.burningTimer = Math.max(enemy.burningTimer || 0, b.burnDuration);
            enemy.burningDps = Math.max(enemy.burningDps || 0, Math.max(1, projectileDamage * 0.18));
          }
          if ((b.slowDuration || 0) > 0 || b.damageType === "cold") {
            enemy.slowTimer = Math.max(enemy.slowTimer || 0, b.slowDuration || 2);
            enemy.slowPct = Math.max(enemy.slowPct || 0, 0.3);
          }
          if ((b.chainCount || 0) > 0) {
            let chainSource = enemy;
            for (let i = 0; i < b.chainCount; i++) {
              let chainTarget = null;
              let bestDist = Number.POSITIVE_INFINITY;
              for (const other of activeEnemies) {
                if (!other || other === chainSource || (other.hp || 0) <= 0 || b.hitTargets.has(other)) continue;
                if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(other)) continue;
                const dist = vecLength((other.x || 0) - (chainSource.x || 0), (other.y || 0) - (chainSource.y || 0));
                if (dist > game.config.map.tile * 2.5 || dist >= bestDist) continue;
                bestDist = dist;
                chainTarget = other;
              }
              if (!chainTarget) break;
              game.applyEnemyDamage(chainTarget, projectileDamage * 0.65, b.damageType || "lightning", b.ownerId || null);
              b.hitTargets.add(chainTarget);
              game.fireZones.push({
                x: chainSource.x,
                y: chainSource.y,
                targetX: chainTarget.x,
                targetY: chainTarget.y,
                zoneType: "arcaneChain",
                damageType: b.damageType || "lightning",
                lightRadius: (game.config?.map?.tile || 32) * 1.6,
                lightIntensity: 0.18,
                life: 0.18,
                totalLife: 0.18
              });
              chainSource = chainTarget;
            }
          }
          if ((b.shockStunChance || 0) > 0 && !(enemy.isBoss || enemy.isFloorBoss) && Math.random() < b.shockStunChance) {
            enemy.hitCooldown = Math.max(enemy.hitCooldown || 0, b.shockStunDuration || 0.2);
            enemy.stunTimer = Math.max(enemy.stunTimer || 0, b.shockStunDuration || 0.2);
          }
          if (b.wildInfusion === "burning") {
            enemy.burningTimer = Math.max(enemy.burningTimer || 0, 3);
            enemy.burningDps = Math.max(enemy.burningDps || 0, Math.max(1, projectileDamage * 0.16));
          } else if (b.wildInfusion === "poison") {
            enemy.poisonSlowTimer = Math.max(enemy.poisonSlowTimer || 0, 3);
            enemy.slowPct = Math.max(enemy.slowPct || 0, 0.2);
          } else if (b.wildInfusion === "cold") {
            enemy.slowTimer = Math.max(enemy.slowTimer || 0, 2.5);
            enemy.slowPct = Math.max(enemy.slowPct || 0, 0.3);
          }
          if (b.projectileType === "mage_chromaticOrb" && b.runicRefraction && !b.runicRefractionSpent) {
            b.runicRefractionSpent = true;
            const elements = ["fire", "cold", "lightning"].filter((element) => element !== b.damageType);
            const baseAngle = Number.isFinite(b.angle) ? b.angle : Math.atan2(b.vy || 0, b.vx || 1);
            const speed = vecLength(b.vx || 0, b.vy || 0) || 430;
            elements.slice(0, 2).forEach((element, index) => {
              const angle = baseAngle + (index === 0 ? -0.32 : 0.32);
              game.bullets.push({
                ...b,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                angle,
                damage: Math.max(1, projectileDamage * 0.55),
                size: Math.max(5, (b.size || 9) * 0.72),
                damageType: element,
                chromaticElement: element,
                runicRefraction: false,
                wildSplitClone: true,
                hitTargets: new Set([enemy])
              });
            });
          }
          if (typeof projectileOwnerContext.applyMageOnHitEffects === "function") {
            projectileOwnerContext.applyMageOnHitEffects(enemy, { status: b.wildInfusion || b.damageType || "", runesConsumed: b.runesConsumed || 0 });
          }
        }
        if (b.projectileType !== "holyWave" && typeof projectileOwnerContext.applyRangerOnHitEffects === "function") projectileOwnerContext.applyRangerOnHitEffects(enemy, b.x, b.y);
        resolveAssassinProjectileEffects({ game, projectile: b, ownerContext: projectileOwnerContext, enemy, activeEnemies, projectileDamage });
        if (Number.isFinite(b.knockback) && b.knockback > 0) {
          const len = vecLength((enemy.x || 0) - (b.x || 0), (enemy.y || 0) - (b.y || 0)) || 1;
          enemy.vx = (enemy.vx || 0) + (((enemy.x || 0) - (b.x || 0)) / len) * b.knockback;
          enemy.vy = (enemy.vy || 0) + (((enemy.y || 0) - (b.y || 0)) / len) * b.knockback;
        }
        b.hitTargets.add(enemy);
        b.linebreakerHits = (Number.isFinite(b.linebreakerHits) ? b.linebreakerHits : 0) + 1;
        if (Number.isFinite(b.maxHitsPerFrame) && b.hitTargets.size >= b.maxHitsPerFrame) {
          b.life = 0;
          break;
        }
        if (b.projectileType === "holyWave" || b.pierce) {
          // Piercing projectiles travel through enemies once per target.
        } else if (b.predatorPierce) {
          b.predatorPierce = false;
        } else if (Math.random() >= game.getPiercingChance()) {
          b.life = 0;
        }
        if (!b.pierce) break;
      }
    }
  }

  for (const arrow of game.fireArrows) {
    if (arrow.life <= 0) continue;
    let hit = false;
    for (const br of activeBreakables) {
      if (vecLength(arrow.x - br.x, arrow.y - br.y) < (br.size + arrow.size) * 0.45) {
        hit = true;
        br.hp = 0;
        break;
      }
    }
    if (hit) {
      game.triggerFireExplosion(arrow.x, arrow.y, arrow);
      arrow.life = 0;
      continue;
    }
    for (const enemy of activeEnemies) {
      if (!isDamageableEnemyTarget(enemy)) continue;
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
      if (vecLength(arrow.x - enemy.x, arrow.y - enemy.y) < (enemy.size + arrow.size) * 0.5) {
        if (skeletonIgnoresArrow(enemy)) continue;
        hit = true;
        break;
      }
    }
    if (hit) {
      game.triggerFireExplosion(arrow.x, arrow.y, arrow);
      arrow.life = 0;
    }
  }
  game.fireArrows = game.fireArrows.filter((arrow) => arrow.life > 0);

  resolveFireZonesAndEnemyStatus({
    game,
    dt,
    activeEnemies,
    activeBreakables,
    playerEnemyRadius,
    isActive,
    getLivingPlayers,
    damagePlayer
  });

  const friendlyEnemies = activeEnemies.filter((enemy) => game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy) && (enemy.hp || 0) > 0);
  for (let i = 0; i < friendlyEnemies.length; i++) {
    const a = friendlyEnemies[i];
    for (let j = i + 1; j < friendlyEnemies.length; j++) {
      const b = friendlyEnemies[j];
      const minDist = (a.size || 20) * 0.45 + (b.size || 20) * 0.45 + 8;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = vecLength(dx, dy) || 0.001;
      if (dist >= minDist) continue;
      const push = (minDist - dist) * 0.5;
      const nx = dx / dist;
      const ny = dy / dist;
      game.moveWithCollision(a, -nx * push, -ny * push);
      game.moveWithCollision(b, nx * push, ny * push);
    }
  }

  const maxPetDistance = game.config.map.tile * 30;
  for (const enemy of game.enemies) {
    if (!(game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy))) continue;
    if ((enemy.hp || 0) <= 0) continue;
    const owner = typeof game.getControllingPlayerEntityForEnemy === "function" ? game.getControllingPlayerEntityForEnemy(enemy) : game.player;
    if (!owner || (typeof game.isLivingPlayerEntity === "function" && !game.isLivingPlayerEntity(owner))) {
      enemy.hp = 0;
      continue;
    }
    if (vecLength(enemy.x - owner.x, enemy.y - owner.y) > maxPetDistance) enemy.hp = 0;
  }

  let removeBossSummons = false;
  const pendingRaisedEnemies = [];
  let suppressRemainingPostBossDrops = !!(game.floorBoss && ["defeated", "portal", "completed"].includes(game.floorBoss.phase));
  game.enemies = game.enemies.filter((enemy) => {
    if (enemy.type === "skeleton_warrior" && enemy.collapsed && ((enemy.collapseTimer > 0) || (enemy.reanimateTimer > 0))) return true;
    if (enemy.deathProcessed && enemy.hp <= 0) return (enemy.corpseTimer || 0) > 0;
    if (enemy.hp <= 0) {
      if (enemy.skipRewardsOnDeath) return false;
      const isFinalGolemBossDeath = enemy.type === "golem" &&
        enemy.isFloorBoss &&
        !(game.enemies || []).some((other) => other && other !== enemy && other.isFloorBoss && (other.hp || 0) > 0);
      const spellknightDetonationOwnerId = typeof enemy.arcaneMarkOwnerId === "string" && enemy.arcaneMarkOwnerId ? enemy.arcaneMarkOwnerId : null;
      const spellknightDetonationOwner = spellknightDetonationOwnerId && typeof game.getPlayerEntityById === "function" ? game.getPlayerEntityById(spellknightDetonationOwnerId) : null;
      const markedForSpellknight =
        !!spellknightDetonationOwner &&
        (enemy.arcaneMarkTimer || 0) > 0 &&
        enemy.arcaneMarkOwnerId === spellknightDetonationOwnerId &&
        hasWarriorSpellknight(spellknightDetonationOwner);
      const wasFriendly = game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy);
      if (wasFriendly && typeof game.triggerExplodingDeath === "function") game.triggerExplodingDeath(enemy);
      if (wasFriendly) return false;
      if (markedForSpellknight) {
        const detonationDamage = (typeof game.rollPrimaryDamage === "function" ? game.rollPrimaryDamage() : 10) * 0.7;
        const tile = game.config?.map?.tile || 32;
        for (const other of activeEnemies) {
          if (!other || other === enemy || (other.hp || 0) <= 0) continue;
          if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(other)) continue;
          if (vecLength((other.x || 0) - (enemy.x || 0), (other.y || 0) - (enemy.y || 0)) > tile * 1.8 + (other.size || 20) * 0.35) continue;
          game.applyEnemyDamage(other, detonationDamage, "arcane", spellknightDetonationOwnerId);
        }
        game.fireZones.push({
          x: enemy.x,
          y: enemy.y,
          radius: tile * 1.2,
          life: 0.2,
          totalLife: 0.2,
          zoneType: "arcaneBurst"
        });
      }
      if (
        isNecromancerTalentGame(game) &&
        !game.isUndeadEnemy(enemy) &&
        !(enemy.isBoss || enemy.isFloorBoss) &&
        ((enemy.curseTimer || 0) > 0 || (enemy.rotTimer || 0) > 0) &&
        game.canControlMoreUndead() &&
        Math.random() < getNecromancerPlaguecraftRiseChance(game)
      ) {
        const skeleton = spawnSkeleton(game, enemy.x, enemy.y);
        if (skeleton && game.markUndeadAsControlled(skeleton)) {
          pendingRaisedEnemies.push(skeleton);
          skeleton.hp = skeleton.maxHp;
        }
      }
      const rewardOwner = getRewardOwner(enemy);
      if (rewardOwner && rewardOwner.classType === "necromancer" && (rewardOwner.necromancerTalents?.lich?.points || 0) > 0) {
        const runtime =
          rewardOwner === game.player
            ? (game.necromancerRuntime || (game.necromancerRuntime = {}))
            : (rewardOwner.necromancerRuntime || (rewardOwner.necromancerRuntime = {}));
        if ((runtime.soulSpawnCooldownTimer || 0) <= 0 && Math.random() < 0.1) {
          runtime.souls = Array.isArray(runtime.souls) ? runtime.souls : [];
          runtime.souls.push({
            x: enemy.x,
            y: enemy.y,
            life: 8,
            healPct: enemy.isBoss || enemy.isFloorBoss ? 0.12 : 0.04,
            collectRadius: 22,
            ownerId: rewardOwner.id || null
          });
          runtime.soulSpawnCooldownTimer = 0.15;
          if (rewardOwner === game.player && typeof game.spawnFloatingText === "function") game.spawnFloatingText(enemy.x, enemy.y - 24, "Soul", "#c7f0a0", 0.6, 12);
        }
      }
      if (rewardOwner && rewardOwner.classType === "necromancer" && !(enemy.isBoss || enemy.isFloorBoss) && (rewardOwner.necromancerTalents?.necromancerPath?.points || 0) > 0) {
        const runtime =
          rewardOwner === game.player
            ? (game.necromancerRuntime || (game.necromancerRuntime = {}))
            : (rewardOwner.necromancerRuntime || (rewardOwner.necromancerRuntime = {}));
        const guaranteed = enemy.lastDamageType === "necrotic" || enemy.lastDamageType === "death";
        if ((runtime.necroRaiseCooldownTimer || 0) <= 0 && game.canControlMoreUndead(rewardOwner) && (guaranteed || Math.random() < 0.1)) {
          const raised = enemy.type === "ghost" ? spawnGhost(game, enemy.x, enemy.y) : {
            ...enemy,
            id: null,
            x: enemy.x,
            y: enemy.y,
            hp: Math.max(1, Number.isFinite(enemy.maxHp) ? enemy.maxHp : 12),
            maxHp: Math.max(1, Number.isFinite(enemy.maxHp) ? enemy.maxHp : 12),
            baseMaxHp: Math.max(1, Number.isFinite(enemy.baseMaxHp) ? enemy.baseMaxHp : (Number.isFinite(enemy.maxHp) ? enemy.maxHp : 12)),
            baseSpeed: Number.isFinite(enemy.baseSpeed) ? enemy.baseSpeed : enemy.speed,
            baseDamageMin: Number.isFinite(enemy.baseDamageMin) ? enemy.baseDamageMin : enemy.damageMin,
            baseDamageMax: Number.isFinite(enemy.baseDamageMax) ? enemy.baseDamageMax : enemy.damageMax,
            isBoss: false,
            isFloorBoss: false,
            skipRewardsOnDeath: true,
            raisedUndeadCopy: true,
            burningTimer: 0,
            rotTimer: 0,
            curseTimer: 0,
            confusionTimer: 0,
            weakenedTimer: 0
          };
          if (raised && game.markUndeadAsControlled(raised, rewardOwner)) {
            pendingRaisedEnemies.push(raised);
            raised.hp = raised.maxHp;
            runtime.necroRaiseCooldownTimer = 2;
            if (rewardOwner === game.player && typeof game.spawnFloatingText === "function") game.spawnFloatingText(enemy.x, enemy.y - 30, "Raised", "#b6d9ff", 0.75, 12);
          }
        }
      }
      const diedNearOwnerForHarvester =
        !!rewardOwner &&
        typeof rewardOwner.x === "number" &&
        vecLength((enemy.x || 0) - rewardOwner.x, (enemy.y || 0) - rewardOwner.y) <= (game.config.map.tile || 32);
      if (rewardOwner) {
        const ownerHasHarvester = rewardOwner === game.player
          ? hasNecromancerHarvester(game)
          : ((rewardOwner?.necromancerTalents?.harvester?.points || 0) > 0);
        if (ownerHasHarvester) {
          const runtime =
            rewardOwner === game.player
              ? (game.necromancerRuntime || (game.necromancerRuntime = {}))
              : (rewardOwner.necromancerRuntime || (rewardOwner.necromancerRuntime = {}));
          runtime.harvesterBonusPct = Math.min(0.5, (Number.isFinite(runtime.harvesterBonusPct) ? runtime.harvesterBonusPct : 0) + 0.05);
          if (rewardOwner === game.player && typeof game.spawnFloatingText === "function") {
            game.spawnFloatingText(game.player.x, game.player.y - 34, "Harvest +5%", "#cf9fff", 0.7, 13);
          }
          if (diedNearOwnerForHarvester && !(enemy.isBoss || enemy.isFloorBoss) && game.canControlMoreUndead(rewardOwner) && Math.random() < 0.4) {
            const ghost = spawnGhost(game, enemy.x, enemy.y);
            if (ghost && game.markUndeadAsControlled(ghost, rewardOwner)) {
              pendingRaisedEnemies.push(ghost);
              ghost.hp = ghost.maxHp;
              if (rewardOwner === game.player && typeof game.spawnFloatingText === "function") {
                game.spawnFloatingText(enemy.x, enemy.y - 30, "Harvested", "#d8b3ff", 0.8, 13);
              }
            }
          }
        }
      }
      if (typeof game.recordKillByPlayerEntity === "function") game.recordKillByPlayerEntity(rewardOwner, enemy);
      recordFlameOfTheFallenKill(game, enemy);
      if (rewardOwner && rewardOwner.classType === "archer") {
        const runtime = rewardOwner === game.player ? (game.rangerRuntime || (game.rangerRuntime = {})) : (rewardOwner.rangerRuntime || (rewardOwner.rangerRuntime = {}));
        const talentSource = rewardOwner === game.player ? game : rewardOwner;
        if (hasRangerTalent(talentSource, "predatorsFeast") && (runtime.predatorsFeastCooldownTimer || 0) <= 0) {
          const heal = (rewardOwner.maxHealth || 1) * 0.04;
          if (rewardOwner === game.player && typeof game.applyPlayerHealing === "function") game.applyPlayerHealing(heal);
          else rewardOwner.health = Math.min(rewardOwner.maxHealth || rewardOwner.health || 0, (rewardOwner.health || 0) + heal);
          runtime.predatorsFeastTimer = 2;
          runtime.predatorsFeastCooldownTimer = 5;
        }
        if (hasRangerTalent(talentSource, "deathChain") && !enemy.killedByDeathChain) {
          const tile = game.config?.map?.tile || 32;
          const chainTargets = [];
          for (const other of activeEnemies) {
            if (!other || other === enemy || (other.hp || 0) <= 0) continue;
            if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(other)) continue;
            const dist = vecLength((other.x || 0) - (enemy.x || 0), (other.y || 0) - (enemy.y || 0));
            if (dist > tile * 3) continue;
            chainTargets.push({ enemy: other, dist });
          }
          chainTargets.sort((a, b) => a.dist - b.dist);
          for (const entry of chainTargets.slice(0, 2)) {
            const chainDamage = (typeof game.rollPrimaryDamage === "function" ? game.rollPrimaryDamage() : 8) * (enemy.rangerMarkedBy ? 1.1 : 0.7);
            game.applyEnemyDamage(entry.enemy, chainDamage, "physical", rewardOwner.id || null);
            if ((entry.enemy.hp || 0) <= 0) entry.enemy.killedByDeathChain = true;
            if (typeof game.spawnFloatingText === "function") game.spawnFloatingText(entry.enemy.x, entry.enemy.y - entry.enemy.size, "Death Chain", "#d8b3ff", 0.75, 13);
          }
        }
      }
      if (enemy.isFloorBoss && typeof game.recordRunBossKill === "function" && (enemy.type !== "golem" || isFinalGolemBossDeath)) {
        game.recordRunBossKill();
      }
      if (enemy.lastDamageType === "fire" && typeof game.recordClassSpecificStat === "function") {
        game.recordClassSpecificStat("ranger", "fireArrowKills", 1);
      }
      if (enemy.pendingExecuteKill && typeof game.recordClassSpecificStat === "function") {
        game.recordClassSpecificStat("warrior", "executeKills", 1);
      }
      if (typeof game.triggerWarriorMomentumOnKillForPlayerEntity === "function") game.triggerWarriorMomentumOnKillForPlayerEntity(rewardOwner);
      else game.triggerWarriorMomentumOnKill();
      let rewardScore = 10;
      if (enemy.type === "goblin") rewardScore = 30 + enemy.goldEaten;
      else if (enemy.type === "armor") rewardScore = 40;
      else if (enemy.type === "mimic") rewardScore = 35;
      else if (enemy.type === "mummy") rewardScore = 22;
      else if (enemy.type === "prisoner") rewardScore = 22;
      else if (enemy.type === "rat_archer") rewardScore = 16;
      else if (enemy.type === "shardling") rewardScore = 12;
      else if (enemy.type === "skeleton_warrior") rewardScore = 10;
      else if (enemy.type === "necromancer" || enemy.type === "sonya") rewardScore = 250;
      else if (enemy.type === "leprechaun") rewardScore = 500;
      else if (enemy.type === "golem") rewardScore = isFinalGolemBossDeath ? 360 : 0;
      else if (enemy.type === "minotaur") rewardScore = 320;
      else if (enemy.type === "skeleton") rewardScore = 12;
      if (typeof game.awardScoreToPlayerEntity === "function" && rewardScore > 0) game.awardScoreToPlayerEntity(rewardOwner, rewardScore);
      const bossCleanupPhase = game.floorBoss && ["defeated", "portal", "completed"].includes(game.floorBoss.phase);
      const suppressPostBossXp = bossCleanupPhase && !enemy.isFloorBoss && !isFinalGolemBossDeath;
      if (!suppressPostBossXp && (enemy.type !== "golem" || !enemy.isFloorBoss || isFinalGolemBossDeath)) {
        if (typeof game.gainExperienceForPlayerEntity === "function") game.gainExperienceForPlayerEntity(rewardOwner, game.xpFromEnemy(enemy));
        else game.gainExperience(game.xpFromEnemy(enemy));
      }
      if (suppressRemainingPostBossDrops && !enemy.isFloorBoss) {
        // The floor is in cleanup time after a boss kill; remaining enemies still count for combat stats but do not create loot.
      } else if (enemy.type === "goblin") game.dropTreasureBag(enemy.x, enemy.y, enemy.goldEaten);
      else if (enemy.type === "armor") game.dropArmorLoot(enemy.x, enemy.y);
      else if (enemy.type === "mimic") game.dropTreasureBag(enemy.x, enemy.y, 24);
      else if (enemy.type === "mummy") game.maybeSpawnDrop(enemy.x, enemy.y);
      else if (enemy.type === "prisoner" || enemy.type === "rat_archer" || enemy.type === "skeleton_warrior" || enemy.type === "skeleton" || enemy.type === "shardling") game.maybeSpawnDrop(enemy.x, enemy.y);
      else if (enemy.type === "necromancer" || enemy.type === "sonya" || enemy.type === "leprechaun") {
        if (typeof game.markFloorBossDefeated === "function") game.markFloorBossDefeated();
        suppressRemainingPostBossDrops = true;
        removeBossSummons = true;
        if (typeof game.spawnExitPortal === "function") game.spawnExitPortal(enemy.x, enemy.y);
        if (enemy.type === "leprechaun") game.dropLeprechaunLoot(enemy.x, enemy.y);
        else game.dropNecromancerLoot(enemy.x, enemy.y);
        game.spawnFloatingText(enemy.x, enemy.y - 42, "Boss Defeated", "#f2bf7b", 1.5, 18);
        game.spawnFloatingText(enemy.x, enemy.y - 62, "Portal Open", "#90f0ff", 1.5, 18);
      } else if (enemy.type === "minotaur") {
        if (typeof game.markFloorBossDefeated === "function") game.markFloorBossDefeated();
        suppressRemainingPostBossDrops = true;
        if (typeof game.spawnExitPortal === "function") game.spawnExitPortal(enemy.x, enemy.y);
        game.dropMinotaurLoot(enemy.x, enemy.y);
        game.spawnFloatingText(enemy.x, enemy.y - 42, "Boss Defeated", "#f2bf7b", 1.5, 18);
        game.spawnFloatingText(enemy.x, enemy.y - 62, "Portal Open", "#90f0ff", 1.5, 18);
      } else if (enemy.type === "golem") {
        if (isFinalGolemBossDeath) {
          if (typeof game.markFloorBossDefeated === "function") game.markFloorBossDefeated();
          suppressRemainingPostBossDrops = true;
          if (typeof game.spawnExitPortal === "function") game.spawnExitPortal(enemy.x, enemy.y);
          game.dropGolemLoot(enemy.x, enemy.y);
          game.spawnFloatingText(enemy.x, enemy.y - 42, "Boss Defeated", "#f2bf7b", 1.5, 18);
          game.spawnFloatingText(enemy.x, enemy.y - 62, "Portal Open", "#90f0ff", 1.5, 18);
        }
      } else game.maybeSpawnDrop(enemy.x, enemy.y);
      if (preserveDeathRemnant(enemy)) return true;
      return false;
    }
    return true;
  });
  if (pendingRaisedEnemies.length > 0) game.enemies.push(...pendingRaisedEnemies);
  if (removeBossSummons) {
    game.enemies = game.enemies.filter((enemy) => !(enemy.type === "skeleton" && enemy.summonerBoss));
  }
  if (typeof game.clearHiddenEnemiesAfterFloorBossDefeat === "function") game.clearHiddenEnemiesAfterFloorBossDefeat();
  game.breakables = (game.breakables || []).filter((br) => {
    if ((br.hp || 0) <= 0) {
      game.dropBreakableLoot(br.x, br.y);
      return false;
    }
    return true;
  });

  for (const drop of game.drops) {
    if (drop.life <= 0) continue;
    for (const player of getLivingPlayers()) {
      if (vecLength(player.x - drop.x, player.y - drop.y) >= game.getPickupRadius()) continue;
      if (drop.type === "health" || drop.type === "mushroom" || drop.type === "treasure_key") {
        if (drop.type === "treasure_key" && typeof game.collectTreasureKey === "function") game.collectTreasureKey(player, drop); else healPlayer(player, drop.amount);
        if (drop.type !== "treasure_key" && player.classType === "archer" && game.rangerTalents?.forager?.points > 0) {
          player.rangerRuntime = player.rangerRuntime && typeof player.rangerRuntime === "object" ? player.rangerRuntime : {};
          player.rangerRuntime.foragerRegenTimer = Math.max(player.rangerRuntime.foragerRegenTimer || 0, 4);
          if (drop.type === "mushroom") player.rangerRuntime.mushroomSpawnTimer = 30;
        }
      } else if (game.isGoldDrop(drop)) {
        const amount = Math.max(1, Math.floor(drop.amount * game.getGoldFindMultiplier()));
        if (typeof game.awardGoldToPlayerEntity === "function") game.awardGoldToPlayerEntity(player, amount);
      } else if (drop.type === "owl_item") {
        if (!pickupOwlItemDrop(game, drop, player)) continue;
      }
      drop.life = 0;
      break;
    }
  }
  game.drops = game.drops.filter((drop) => drop.life > 0);

  const boneSlowPct = game.config.enemy.skeletonWarriorBoneSlowPct || 0;
  if (boneSlowPct > 0) {
    const affectsEntity = (entity) => {
      if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return;
      for (const enemy of game.enemies) {
        if (enemy.type !== "skeleton_warrior" || !enemy.collapsed || enemy.collapseTimer <= 0) continue;
        const slowRadius = (enemy.size || 20) * 0.6;
        if (vecLength(entity.x - enemy.x, entity.y - enemy.y) <= slowRadius) {
          entity.x = Number.isFinite(entity.lastX) ? entity.lastX + (entity.x - entity.lastX) * (1 - boneSlowPct) : entity.x;
          entity.y = Number.isFinite(entity.lastY) ? entity.lastY + (entity.y - entity.lastY) * (1 - boneSlowPct) : entity.y;
          break;
        }
      }
    };
    for (const player of getLivingPlayers()) affectsEntity(player);
    for (const enemy of game.enemies) affectsEntity(enemy);
  }

  for (const player of getLivingPlayers()) {
    if ((player.hitCooldown || 0) > 0) continue;
    const playerRadius = typeof game.getPlayerEnemyCollisionRadiusFor === "function" ? game.getPlayerEnemyCollisionRadiusFor(player) : playerEnemyRadius;
    for (const enemy of activeEnemies) {
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
      if (enemy.type === "leprechaun" && enemy.phase !== "enraged") continue;
      if (!blocksPlayerBody(enemy)) continue;
      if (vecLength(player.x - enemy.x, player.y - enemy.y) > enemy.size * 0.5 + playerRadius) continue;
      player.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      damagePlayer(player, scaledEnemyDamage, "physical");
      break;
    }
  }
}
