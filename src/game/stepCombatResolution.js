import { vecLength } from "../utils.js";
import { finalizeProjectilesAndTransientState, resolveSpecialProjectileCollision } from "./stepCombatProjectileSpecials.js";
import { getNecromancerPlaguecraftRiseChance, getNecromancerRotDps, getNecromancerRotDuration, hasNecromancerHarvester, hasNecromancerPlaguecraftRot, isNecromancerTalentGame } from "./necromancerTalentTree.js";
import { spawnGhost, spawnSkeleton } from "./enemySpawnFactories.js";

export function resolveCombatAndDrops({
  game,
  dt,
  activeEnemies,
  activeBreakables,
  playerEnemyRadius,
  isActive,
  segmentRectHit,
  skeletonIgnoresArrow
}) {
  const getLivingPlayers = () => (typeof game.getLivingPlayerEntities === "function" ? game.getLivingPlayerEntities() : [game.player]);
  const damagePlayer = (player, amount, type = "physical") => {
    if (!player || amount <= 0) return;
    const resolved = typeof game.getDamageTakenForPlayerEntity === "function" ? game.getDamageTakenForPlayerEntity(player, amount, type) : amount;
    if (typeof game.applyDamageToPlayerEntity === "function") game.applyDamageToPlayerEntity(player, resolved, type);
    else game.applyPlayerDamage(resolved);
  };
  const healPlayer = (player, amount) => {
    if (!player || amount <= 0) return;
    if (typeof game.applyHealingToPlayerEntity === "function") game.applyHealingToPlayerEntity(player, amount);
    else if (player === game.player) game.applyPlayerHealing(amount);
  };
  const getRewardOwner = (enemy) => {
    const ownerId = typeof enemy?.lastDamageOwnerId === "string" && enemy.lastDamageOwnerId ? enemy.lastDamageOwnerId : null;
    const owner = typeof game.getPlayerEntityById === "function" ? game.getPlayerEntityById(ownerId) : null;
    const fallbackOwner = typeof game.isLivingPlayerEntity === "function"
      ? (game.isLivingPlayerEntity(game.player) ? game.player : null)
      : game.player;
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
    const prevX = b.x;
    const prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.projectileType === "deathBolt" && Number.isFinite(b.detonateX) && Number.isFinite(b.detonateY)) {
      const remaining = vecLength((b.detonateX || 0) - b.x, (b.detonateY || 0) - b.y);
      const stepDistance = vecLength(b.x - prevX, b.y - prevY);
      if (remaining <= Math.max(b.size || 10, stepDistance)) {
        b.x = b.detonateX;
        b.y = b.detonateY;
        b.pendingDeathBoltExplosion = true;
      }
    }
    for (const br of activeBreakables) {
      if ((br.hp || 0) <= 0) continue;
      const half = (br.size || 20) * 0.5 + (b.size || 6) * 0.5;
      if (segmentRectHit(prevX, prevY, b.x, b.y, br.x - half, br.y - half, br.x + half, br.y + half)) {
        if (b.projectileType !== "trapArrow") br.hp = 0;
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
        if (!game.isEnemyFriendlyToPlayer || !game.isEnemyFriendlyToPlayer(enemy)) continue;
        if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
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
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
      if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
      if (b.hitTargets.has(enemy)) continue;
      if (vecLength(b.x - enemy.x, b.y - enemy.y) < (enemy.size + b.size) * 0.5) {
        if (skeletonIgnoresArrow(enemy)) {
          b.hitTargets.add(enemy);
          continue;
        }
        const projectileDamage = typeof game.getRangerArrowDamageAgainst === "function"
          ? game.getRangerArrowDamageAgainst(enemy, b)
          : (Number.isFinite(b.damage) ? b.damage : game.rollPrimaryDamage()) * Math.max(0.01, Number.isFinite(b.damageMult) ? b.damageMult : 1);
        const damageType = b.projectileType === "holyWave" ? "holy" : "arrow";
        game.applyEnemyDamage(enemy, projectileDamage, damageType, b.ownerId || null);
        if (
          b.projectileType === "holyWave" &&
          typeof game.isUndeadEnemy === "function" &&
          game.isUndeadEnemy(enemy) &&
          Number.isFinite(b.undeadDefenseShredPct) &&
          b.undeadDefenseShredPct > 0
        ) {
          enemy.crusaderDefenseShredPct = Math.max(enemy.crusaderDefenseShredPct || 0, b.undeadDefenseShredPct);
          enemy.crusaderDefenseShredTimer = Math.max(enemy.crusaderDefenseShredTimer || 0, 4);
        }
        if (typeof game.applyConsumableOnHitEffects === "function") game.applyConsumableOnHitEffects(enemy, b.ownerId || null);
        if (b.projectileType !== "holyWave" && typeof game.applyRangerOnHitEffects === "function") game.applyRangerOnHitEffects(enemy, b.x, b.y);
        b.hitTargets.add(enemy);
        b.linebreakerHits = (Number.isFinite(b.linebreakerHits) ? b.linebreakerHits : 0) + 1;
        if (b.projectileType === "holyWave") {
          // Holy waves travel through enemies once per target.
        } else if (Math.random() >= game.getPiercingChance()) {
          b.life = 0;
        }
        break;
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
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
      if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
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

  for (const zone of game.fireZones) {
    if (!isActive(zone, zone.radius || 0)) continue;
    if (zone.zoneType === "deathBolt") {
      zone.pulseTimer = Math.max(-4, (Number.isFinite(zone.pulseTimer) ? zone.pulseTimer : (game.config.deathBolt?.pulseInterval || 1)) - dt);
      while (zone.life > 0 && zone.pulseTimer <= 0) {
        if (typeof game.applyDeathBoltPulse === "function") game.applyDeathBoltPulse(zone.x, zone.y, zone);
        zone.pulseTimer += game.config.deathBolt?.pulseInterval || 1;
      }
      continue;
    }
    if (zone.zoneType === "acid") {
      const touchDamage = () => {
        const multiplier = Number.isFinite(zone.damageMultiplier) ? Math.max(0, zone.damageMultiplier) : 0.2;
        const rawDamage = typeof game.rollWallTrapDamage === "function"
          ? game.rollWallTrapDamage()
          : game.rollEnemyContactDamage({ damageMin: zone.damageMin, damageMax: zone.damageMax });
        return rawDamage * game.getEnemyDamageScale() * multiplier;
      };
      const touchingPlayer = vecLength(zone.x - game.player.x, zone.y - game.player.y) < zone.radius + playerEnemyRadius * 0.8;
      if (touchingPlayer && !zone.touchingPlayer) {
        const reducedByDefense = Math.max(1, Math.round(touchDamage() - game.getDefenseFlatReduction()));
        game.applyPlayerDamage(game.getWarriorRageDamageTaken(reducedByDefense));
      }
      zone.touchingPlayer = touchingPlayer;
      if (!zone.touches || typeof zone.touches.add !== "function") zone.touches = new WeakSet();
      for (const enemy of activeEnemies) {
        if (!(game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy))) continue;
        if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
        const touching = vecLength(zone.x - enemy.x, zone.y - enemy.y) < zone.radius + enemy.size * 0.35;
        if (touching) {
          if (!zone.touches.has(enemy)) {
            game.applyEnemyDamage(enemy, touchDamage(), "acid");
            zone.touches.add(enemy);
          }
        } else {
          zone.touches.delete(enemy);
        }
      }
      continue;
    }
    if (zone.zoneType === "sonyaFire") {
      const tickInterval = Math.max(0.12, zone.tickInterval || 0.35);
      zone.tickTimer = Math.max(-2, (Number.isFinite(zone.tickTimer) ? zone.tickTimer : tickInterval) - dt);
      for (const br of activeBreakables) {
        if (vecLength(zone.x - br.x, zone.y - br.y) < zone.radius + br.size * 0.32) br.hp = 0;
      }
      while (zone.life > 0 && zone.tickTimer <= 0) {
        const pulseDamage = (zone.dps || game.config.enemy.sonyaFirePatchDps || 14) * tickInterval * game.getEnemyDamageScale();
        for (const player of getLivingPlayers()) {
          const playerRadius = typeof game.getPlayerEnemyCollisionRadiusFor === "function" ? game.getPlayerEnemyCollisionRadiusFor(player) : playerEnemyRadius;
          if (vecLength(zone.x - player.x, zone.y - player.y) >= zone.radius + playerRadius * 0.8) continue;
          damagePlayer(player, pulseDamage, "fire");
          if (player.health <= 0 && zone.ownerId === "sonya") game.gameOverTitle = "Haley Wins";
        }
        for (const enemy of activeEnemies) {
          if (!(game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy))) continue;
          if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
          if (vecLength(zone.x - enemy.x, zone.y - enemy.y) < zone.radius + enemy.size * 0.35) {
            game.applyEnemyDamage(enemy, pulseDamage, "fire", zone.ownerId || null);
          }
        }
        zone.tickTimer += tickInterval;
      }
      continue;
    }
    if (zone.zoneType === "crusaderAura") {
      const tickInterval = Math.max(0.15, zone.tickInterval || 0.3);
      zone.tickTimer = Math.max(-2, (Number.isFinite(zone.tickTimer) ? zone.tickTimer : tickInterval) - dt);
      while (zone.life > 0 && zone.tickTimer <= 0) {
        const baseDps = Number.isFinite(zone.dps) ? zone.dps : 10;
        const pulseDamageBase = baseDps * tickInterval;
        const undeadMult = Number.isFinite(zone.undeadDamageMultiplier) ? zone.undeadDamageMultiplier : 1.5;
        const shredPct = Number.isFinite(zone.defenseShredPct) ? zone.defenseShredPct : 0;
        for (const enemy of activeEnemies) {
          if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
          if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
          if (vecLength(zone.x - enemy.x, zone.y - enemy.y) >= zone.radius + enemy.size * 0.35) continue;
          const isUndead = typeof game.isUndeadEnemy === "function" && game.isUndeadEnemy(enemy);
          const pulseDamage = pulseDamageBase * (isUndead ? undeadMult : 1);
          game.applyEnemyDamage(enemy, pulseDamage, "holy", zone.ownerId || null);
          if (isUndead && shredPct > 0) {
            enemy.crusaderDefenseShredPct = Math.max(enemy.crusaderDefenseShredPct || 0, shredPct);
            enemy.crusaderDefenseShredTimer = Math.max(enemy.crusaderDefenseShredTimer || 0, tickInterval + 0.2);
          }
        }
        zone.tickTimer += tickInterval;
      }
      continue;
    }
    if (zone.zoneType && zone.zoneType !== "fire" && zone.zoneType !== "pinningFire") continue;
    for (const br of activeBreakables) {
      if (vecLength(zone.x - br.x, zone.y - br.y) < zone.radius + br.size * 0.32) br.hp = 0;
    }
    for (const enemy of activeEnemies) {
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
      if (enemy.type === "skeleton_warrior" && enemy.collapsed) {
        if (vecLength(zone.x - enemy.x, zone.y - enemy.y) < zone.radius + enemy.size * 0.35) {
          enemy.reviveAtEnd = false;
          enemy.collapseTimer = 0;
          enemy.hp = 0;
        }
        continue;
      }
      if (vecLength(zone.x - enemy.x, zone.y - enemy.y) < zone.radius + enemy.size * 0.35) {
        const lingerDps = Number.isFinite(zone.dps) ? zone.dps : game.getFireArrowLingerDps();
        enemy.burningTimer = Math.max(enemy.burningTimer || 0, 0.25);
        enemy.burningDps = Math.max(enemy.burningDps || 0, lingerDps);
        game.applyEnemyDamage(enemy, lingerDps * dt, "fire", zone.ownerId || null);
      }
    }
  }

  for (const enemy of activeEnemies) {
    if (!enemy || (enemy.hp || 0) <= 0) continue;
    enemy.crusaderDefenseShredTimer = Math.max(0, (Number.isFinite(enemy.crusaderDefenseShredTimer) ? enemy.crusaderDefenseShredTimer : 0) - dt);
    if ((enemy.crusaderDefenseShredTimer || 0) <= 0) enemy.crusaderDefenseShredPct = 0;
    enemy.slowTimer = Math.max(0, (Number.isFinite(enemy.slowTimer) ? enemy.slowTimer : 0) - dt);
    if ((enemy.slowTimer || 0) <= 0) enemy.slowPct = 0;
    enemy.curseTimer = Math.max(0, (Number.isFinite(enemy.curseTimer) ? enemy.curseTimer : 0) - dt);
    enemy.rotTimer = Math.max(0, (Number.isFinite(enemy.rotTimer) ? enemy.rotTimer : 0) - dt);
    if ((enemy.rotTimer || 0) <= 0) enemy.rotDps = 0;
    if ((enemy.burningTimer || 0) > 0 && Number.isFinite(enemy.burningDps) && enemy.burningDps > 0) {
      game.applyEnemyDamage(enemy, enemy.burningDps * dt, "fire", enemy.lastDamageOwnerId || null);
    }
    if ((enemy.rotTimer || 0) > 0 && Number.isFinite(enemy.rotDps) && enemy.rotDps > 0) {
      game.applyEnemyDamage(enemy, enemy.rotDps * dt, "poison", enemy.lastDamageOwnerId || null);
    }
  }

  for (const enemy of activeEnemies) {
    enemy.contactAttackCooldown = Math.max(0, (enemy.contactAttackCooldown || 0) - dt);
    if (enemy.type === "mummy") enemy.auraPulseTimer = Math.max(0, (enemy.auraPulseTimer || 0) - dt);
  }
  for (const enemy of activeEnemies) {
    if (enemy.type !== "mummy" || (enemy.hp || 0) <= 0) continue;
    const auraRange = (game.config.enemy.mummyAuraRangeTiles || 1.8) * game.config.map.tile;
    const auraDps = game.config.enemy.mummyAuraDps || 8;
    let affected = false;
      if (!(game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy))) {
      for (const player of getLivingPlayers()) {
        const playerRadius = typeof game.getPlayerEnemyCollisionRadiusFor === "function" ? game.getPlayerEnemyCollisionRadiusFor(player) : playerEnemyRadius;
        if (vecLength(enemy.x - player.x, enemy.y - player.y) > auraRange + playerRadius) continue;
        const rawDamage = auraDps * dt * game.getEnemyDamageScale();
        damagePlayer(player, rawDamage, "poison");
        affected = true;
      }
      for (const ally of activeEnemies) {
        if (!(game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(ally))) continue;
        if (ally.type === "skeleton_warrior" && ally.collapsed) continue;
        if (vecLength(enemy.x - ally.x, enemy.y - ally.y) <= auraRange + (ally.size || 20) * 0.4) {
          game.applyEnemyDamage(ally, auraDps * dt * game.getEnemyDamageScale(), "poison");
          affected = true;
        }
      }
    }
    if (affected && enemy.auraPulseTimer <= 0) {
      enemy.hpBarTimer = Math.max(enemy.hpBarTimer || 0, game.config.enemy.hpBarDuration);
      enemy.auraPulseTimer = 0.45;
    }
  }
  for (let i = 0; i < activeEnemies.length; i++) {
    const a = activeEnemies[i];
    if ((a.hp || 0) <= 0 || (a.type === "skeleton_warrior" && a.collapsed)) continue;
    for (let j = i + 1; j < activeEnemies.length; j++) {
      const b = activeEnemies[j];
      if ((b.hp || 0) <= 0 || (b.type === "skeleton_warrior" && b.collapsed)) continue;
      const aFriendly = game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(a);
      const bFriendly = game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(b);
      if (aFriendly === bFriendly) continue;
      if ((aFriendly && game.necromancerBeam?.active && game.necromancerBeam.targetEnemy === b) || (bFriendly && game.necromancerBeam?.active && game.necromancerBeam.targetEnemy === a)) {
        continue;
      }
      const minDist = (a.size || 20) * 0.5 + (b.size || 20) * 0.5 + 6;
      if (vecLength(a.x - b.x, a.y - b.y) > minDist) continue;
      const friendly = aFriendly ? a : b;
      const hostile = aFriendly ? b : a;
      const friendlyOwnerId =
        typeof friendly?.controllerPlayerId === "string" && friendly.controllerPlayerId ? friendly.controllerPlayerId : null;
      if ((friendly.contactAttackCooldown || 0) <= 0) {
        const hostileHpBefore = Number.isFinite(hostile.hp) ? hostile.hp : 0;
        game.applyEnemyDamage(hostile, game.rollEnemyContactDamage(friendly) * game.getEnemyDamageScale(), "physical", friendlyOwnerId);
        if (isNecromancerTalentGame(game) && hasNecromancerPlaguecraftRot(game)) {
          hostile.rotTimer = Math.max(hostile.rotTimer || 0, getNecromancerRotDuration());
          hostile.rotDps = Math.max(hostile.rotDps || 0, getNecromancerRotDps(game));
        }
        const dealt = Math.max(0, hostileHpBefore - Math.max(0, hostile.hp || 0));
        if ((friendly.lifeStealPct || 0) > 0 && dealt > 0) {
          friendly.hp = Math.min(friendly.maxHp || friendly.hp, (friendly.hp || 0) + dealt * friendly.lifeStealPct);
        }
        friendly.contactAttackCooldown = 0.55 / Math.max(0.4, 1 + (friendly.controlledAttackSpeedBonusPct || 0));
      }
      if ((hostile.contactAttackCooldown || 0) <= 0) {
        game.applyEnemyDamage(friendly, game.rollEnemyContactDamage(hostile) * game.getEnemyDamageScale(), "physical");
        hostile.contactAttackCooldown = 0.55;
      }
    }
  }

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
  game.enemies = game.enemies.filter((enemy) => {
    if (enemy.type === "skeleton_warrior" && enemy.collapsed && ((enemy.collapseTimer > 0) || (enemy.reanimateTimer > 0))) return true;
    if (enemy.hp <= 0) {
      const wasFriendly = game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy);
      if (wasFriendly && typeof game.triggerExplodingDeath === "function") game.triggerExplodingDeath(enemy);
      if (wasFriendly) return false;
      if (
        isNecromancerTalentGame(game) &&
        !game.isUndeadEnemy(enemy) &&
        ((enemy.curseTimer || 0) > 0 || (enemy.rotTimer || 0) > 0) &&
        game.canControlMoreUndead() &&
        Math.random() < getNecromancerPlaguecraftRiseChance(game)
      ) {
        const skeleton = spawnSkeleton(game, enemy.x, enemy.y);
        if (skeleton && game.markUndeadAsControlled(skeleton)) {
          game.enemies.push(skeleton);
          skeleton.hp = skeleton.maxHp;
        }
      }
      const rewardOwner = getRewardOwner(enemy);
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
          if (diedNearOwnerForHarvester && game.canControlMoreUndead(rewardOwner) && Math.random() < 0.4) {
            const ghost = spawnGhost(game, enemy.x, enemy.y);
            if (ghost && game.markUndeadAsControlled(ghost, rewardOwner)) {
              game.enemies.push(ghost);
              ghost.hp = ghost.maxHp;
              if (rewardOwner === game.player && typeof game.spawnFloatingText === "function") {
                game.spawnFloatingText(enemy.x, enemy.y - 30, "Harvested", "#d8b3ff", 0.8, 13);
              }
            }
          }
        }
      }
      if (typeof game.recordKillByPlayerEntity === "function") game.recordKillByPlayerEntity(rewardOwner, enemy);
      if (enemy.isFloorBoss && typeof game.recordRunBossKill === "function") game.recordRunBossKill();
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
      else if (enemy.type === "skeleton_warrior") rewardScore = 10;
      else if (enemy.type === "necromancer" || enemy.type === "sonya") rewardScore = 250;
      else if (enemy.type === "leprechaun") rewardScore = 500;
      else if (enemy.type === "minotaur") rewardScore = 320;
      else if (enemy.type === "skeleton") rewardScore = 12;
      if (typeof game.awardScoreToPlayerEntity === "function") game.awardScoreToPlayerEntity(rewardOwner, rewardScore);
      if (typeof game.gainExperienceForPlayerEntity === "function") game.gainExperienceForPlayerEntity(rewardOwner, game.xpFromEnemy(enemy));
      else game.gainExperience(game.xpFromEnemy(enemy));
      if (enemy.type === "goblin") game.dropTreasureBag(enemy.x, enemy.y, enemy.goldEaten);
      else if (enemy.type === "armor") game.dropArmorLoot(enemy.x, enemy.y);
      else if (enemy.type === "mimic") game.dropTreasureBag(enemy.x, enemy.y, 24);
      else if (enemy.type === "mummy") game.maybeSpawnDrop(enemy.x, enemy.y);
      else if (enemy.type === "prisoner" || enemy.type === "rat_archer" || enemy.type === "skeleton_warrior" || enemy.type === "skeleton") game.maybeSpawnDrop(enemy.x, enemy.y);
      else if (enemy.type === "necromancer" || enemy.type === "sonya" || enemy.type === "leprechaun") {
        if (typeof game.markFloorBossDefeated === "function") game.markFloorBossDefeated();
        removeBossSummons = true;
        if (typeof game.spawnExitPortal === "function") game.spawnExitPortal(enemy.x, enemy.y);
        if (enemy.type === "leprechaun") game.dropLeprechaunLoot(enemy.x, enemy.y);
        else game.dropNecromancerLoot(enemy.x, enemy.y);
        game.spawnFloatingText(enemy.x, enemy.y - 42, "Boss Defeated", "#f2bf7b", 1.5, 18);
        game.spawnFloatingText(enemy.x, enemy.y - 62, "Portal Open", "#90f0ff", 1.5, 18);
      } else if (enemy.type === "minotaur") {
        if (typeof game.markFloorBossDefeated === "function") game.markFloorBossDefeated();
        if (typeof game.spawnExitPortal === "function") game.spawnExitPortal(enemy.x, enemy.y);
        game.dropMinotaurLoot(enemy.x, enemy.y);
        game.spawnFloatingText(enemy.x, enemy.y - 42, "Boss Defeated", "#f2bf7b", 1.5, 18);
        game.spawnFloatingText(enemy.x, enemy.y - 62, "Portal Open", "#90f0ff", 1.5, 18);
      } else game.maybeSpawnDrop(enemy.x, enemy.y);
      return false;
    }
    return true;
  });
  if (removeBossSummons) {
    game.enemies = game.enemies.filter((enemy) => !(enemy.type === "skeleton" && enemy.summonerBoss));
  }
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
      if (drop.type === "health") {
        healPlayer(player, drop.amount);
      } else if (game.isGoldDrop(drop)) {
        const amount = Math.max(1, Math.floor(drop.amount * game.getGoldFindMultiplier()));
        if (typeof game.awardGoldToPlayerEntity === "function") game.awardGoldToPlayerEntity(player, amount);
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
      if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
      if (vecLength(player.x - enemy.x, player.y - enemy.y) > enemy.size * 0.5 + playerRadius) continue;
      player.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      damagePlayer(player, scaledEnemyDamage, "physical");
      break;
    }
  }
}
