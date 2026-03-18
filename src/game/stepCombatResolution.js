import { vecLength } from "../utils.js";

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
    for (const br of activeBreakables) {
      if ((br.hp || 0) <= 0) continue;
      const half = (br.size || 20) * 0.5 + (a.size || 8) * 0.5;
      if (segmentRectHit(prevX, prevY, a.x, a.y, br.x - half, br.y - half, br.x + half, br.y + half)) {
        br.hp = 0;
        game.triggerFireExplosion(a.x, a.y);
        a.life = 0;
        break;
      }
    }
  }
  for (const d of game.drops) d.life -= dt;
  for (const z of game.fireZones) z.life -= dt;
  for (const s of game.meleeSwings) s.life -= dt;

  for (const bullet of game.bullets) {
    if (bullet.projectileType === "deathBolt" && bullet.life > 0 && game.isWallAt(bullet.x, bullet.y, false)) {
      game.triggerDeathBoltExplosion(bullet.x, bullet.y);
      bullet.life = 0;
    }
  }
  game.bullets = game.bullets.filter((b) => !game.isWallAt(b.x, b.y, false) && b.life > 0);
  for (const arrow of game.fireArrows) {
    if (arrow.life <= 0 || game.isWallAt(arrow.x, arrow.y, false)) {
      game.triggerFireExplosion(arrow.x, arrow.y);
      arrow.life = 0;
    }
  }
  game.fireArrows = game.fireArrows.filter((arrow) => arrow.life > 0);
  game.drops = game.drops.filter((drop) => drop.life > 0);
  game.fireZones = game.fireZones.filter((zone) => zone.life > 0);
  game.meleeSwings = game.meleeSwings.filter((s) => s.life > 0);

  for (const b of game.bullets) {
    if (b.life <= 0) continue;
    if (b.projectileType === "ratArrow") {
      let ratArrowHit = false;
      for (const enemy of activeEnemies) {
        if (!game.isEnemyFriendlyToPlayer || !game.isEnemyFriendlyToPlayer(enemy)) continue;
        if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
        if (vecLength(b.x - enemy.x, b.y - enemy.y) <= (enemy.size + b.size) * 0.5) {
          const rawDamage = game.rollEnemyContactDamage({ damageMin: b.damageMin, damageMax: b.damageMax });
          game.applyEnemyDamage(enemy, rawDamage * game.getEnemyDamageScale(), "arrow");
          b.life = 0;
          ratArrowHit = true;
          break;
        }
      }
      if (ratArrowHit) continue;
      if (vecLength(b.x - game.player.x, b.y - game.player.y) <= playerEnemyRadius + b.size * 0.5) {
        const rawDamage = game.rollEnemyContactDamage({ damageMin: b.damageMin, damageMax: b.damageMax });
        const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
        const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
        const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
        game.applyPlayerDamage(damageTaken);
        b.life = 0;
      }
      continue;
    }
    if (b.projectileType === "deathBolt") {
      let hit = false;
      for (const br of activeBreakables) {
        if (vecLength(b.x - br.x, b.y - br.y) < (br.size + b.size) * 0.45) {
          br.hp = 0;
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const enemy of activeEnemies) {
          if (vecLength(b.x - enemy.x, b.y - enemy.y) < (enemy.size + b.size) * 0.5) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        game.triggerDeathBoltExplosion(b.x, b.y);
        b.life = 0;
      }
      continue;
    }
    if (b.projectileType === "trapArrow") {
      for (const br of activeBreakables) {
        if (vecLength(b.x - br.x, b.y - br.y) < (br.size + b.size) * 0.45) {
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      if (vecLength(b.x - game.player.x, b.y - game.player.y) <= playerEnemyRadius + b.size * 0.5) {
        const rawDamage = typeof game.rollWallTrapDamage === "function"
          ? game.rollWallTrapDamage()
          : game.rollEnemyContactDamage({ damageMin: b.damageMin, damageMax: b.damageMax });
        const scaledTrapDamage = rawDamage * game.getEnemyDamageScale();
        const reducedByDefense = Math.max(1, Math.round(scaledTrapDamage - game.getDefenseFlatReduction()));
        const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
        game.applyPlayerDamage(damageTaken);
        b.life = 0;
        continue;
      }
      for (const enemy of activeEnemies) {
        if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
        if (vecLength(b.x - enemy.x, b.y - enemy.y) < (enemy.size + b.size) * 0.5) {
          if (skeletonIgnoresArrow(enemy)) continue;
          const rawDamage = typeof game.rollWallTrapDamage === "function"
            ? game.rollWallTrapDamage()
            : game.rollEnemyContactDamage({ damageMin: b.damageMin, damageMax: b.damageMax });
          game.applyEnemyDamage(enemy, rawDamage * game.getEnemyDamageScale(), "arrow");
          b.life = 0;
          break;
        }
      }
      continue;
    }
    if (!b.hitTargets) b.hitTargets = new Set();
    if (b.faction === "enemy") {
      for (const enemy of activeEnemies) {
        if (!game.isEnemyFriendlyToPlayer || !game.isEnemyFriendlyToPlayer(enemy)) continue;
        if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
        if (vecLength(b.x - enemy.x, b.y - enemy.y) < (enemy.size + b.size) * 0.5) {
          const rawDamage = Number.isFinite(b.damage) ? b.damage : game.config.enemy.necromancerProjectileDamage || 16;
          game.applyEnemyDamage(enemy, rawDamage * game.getEnemyDamageScale(), b.damageType || "necrotic");
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      if (vecLength(b.x - game.player.x, b.y - game.player.y) < (game.player.size + b.size) * 0.5) {
        const rawDamage = Number.isFinite(b.damage) ? b.damage : game.config.enemy.necromancerProjectileDamage || 16;
        const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
        const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
        const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
        game.applyPlayerDamage(damageTaken);
        b.life = 0;
      }
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
        const dmgMult = Number.isFinite(b.damageMult) ? b.damageMult : 1;
        game.applyEnemyDamage(enemy, game.rollPrimaryDamage() * Math.max(0.01, dmgMult), "arrow");
        b.hitTargets.add(enemy);
        if (Math.random() >= game.getPiercingChance()) b.life = 0;
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
      game.triggerFireExplosion(arrow.x, arrow.y);
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
      game.triggerFireExplosion(arrow.x, arrow.y);
      arrow.life = 0;
    }
  }
  game.fireArrows = game.fireArrows.filter((arrow) => arrow.life > 0);

  for (const zone of game.fireZones) {
    if (!isActive(zone, zone.radius || 0)) continue;
    if (zone.zoneType === "deathBolt") {
      zone.pulseTimer = Math.max(-4, (Number.isFinite(zone.pulseTimer) ? zone.pulseTimer : (game.config.deathBolt?.pulseInterval || 1)) - dt);
      while (zone.life > 0 && zone.pulseTimer <= 0) {
        if (typeof game.applyDeathBoltPulse === "function") game.applyDeathBoltPulse(zone.x, zone.y);
        zone.pulseTimer += game.config.deathBolt?.pulseInterval || 1;
      }
      continue;
    }
    if (zone.zoneType && zone.zoneType !== "fire") continue;
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
        game.applyEnemyDamage(enemy, game.getFireArrowLingerDps() * dt, "fire");
      }
    }
  }

  for (const enemy of activeEnemies) {
    enemy.contactAttackCooldown = Math.max(0, (enemy.contactAttackCooldown || 0) - dt);
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
      if ((friendly.contactAttackCooldown || 0) <= 0) {
        game.applyEnemyDamage(hostile, game.rollEnemyContactDamage(friendly) * game.getEnemyDamageScale(), "physical");
        friendly.contactAttackCooldown = 0.55;
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
    if (vecLength(enemy.x - game.player.x, enemy.y - game.player.y) > maxPetDistance) enemy.hp = 0;
  }

  let removeBossSummons = false;
  game.enemies = game.enemies.filter((enemy) => {
    if (enemy.type === "skeleton_warrior" && enemy.collapsed && enemy.collapseTimer > 0) return true;
    if (enemy.hp <= 0) {
      const wasFriendly = game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy);
      if (wasFriendly && typeof game.triggerExplodingDeath === "function") game.triggerExplodingDeath(enemy);
      if (wasFriendly) return false;
      game.triggerWarriorMomentumOnKill();
      if (enemy.type === "goblin") game.score += 30 + enemy.goldEaten;
      else if (enemy.type === "armor") game.score += 40;
      else if (enemy.type === "mimic") game.score += 35;
      else if (enemy.type === "prisoner") game.score += 22;
      else if (enemy.type === "rat_archer") game.score += 16;
      else if (enemy.type === "skeleton_warrior") game.score += 10;
      else if (enemy.type === "necromancer") game.score += 250;
      else if (enemy.type === "leprechaun") game.score += 500;
      else if (enemy.type === "skeleton") game.score += 12;
      else game.score += 10;
      game.gainExperience(game.xpFromEnemy(enemy));
      if (enemy.type === "goblin") game.dropTreasureBag(enemy.x, enemy.y, enemy.goldEaten);
      else if (enemy.type === "armor") game.dropArmorLoot(enemy.x, enemy.y);
      else if (enemy.type === "mimic") game.dropTreasureBag(enemy.x, enemy.y, 24);
      else if (enemy.type === "prisoner" || enemy.type === "rat_archer" || enemy.type === "skeleton_warrior" || enemy.type === "skeleton") game.maybeSpawnDrop(enemy.x, enemy.y);
      else if (enemy.type === "necromancer" || enemy.type === "leprechaun") {
        if (typeof game.markFloorBossDefeated === "function") game.markFloorBossDefeated();
        removeBossSummons = true;
        if (typeof game.spawnExitPortal === "function") game.spawnExitPortal(enemy.x, enemy.y);
        if (enemy.type === "leprechaun") game.dropLeprechaunLoot(enemy.x, enemy.y);
        else game.dropNecromancerLoot(enemy.x, enemy.y);
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
    if (vecLength(game.player.x - drop.x, game.player.y - drop.y) < game.getPickupRadius()) {
      if (drop.type === "health") game.applyPlayerHealing(drop.amount);
      else if (game.isGoldDrop(drop)) {
        const amount = Math.max(1, Math.floor(drop.amount * game.getGoldFindMultiplier()));
        game.gold += amount;
        game.score += amount;
        game.spawnFloatingText(game.player.x, game.player.y - 30, `+${amount}g`, "#f2d76b", 0.75, 14);
      }
      drop.life = 0;
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
    affectsEntity(game.player);
    for (const enemy of game.enemies) affectsEntity(enemy);
  }

  if (game.player.hitCooldown <= 0) {
    for (const enemy of activeEnemies) {
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
      if (enemy.type === "leprechaun" && enemy.phase !== "enraged") continue;
      if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
      if (vecLength(game.player.x - enemy.x, game.player.y - enemy.y) <= enemy.size * 0.5 + playerEnemyRadius) {
        game.player.hitCooldown = 1.0;
        const rawDamage = game.rollEnemyContactDamage(enemy);
        const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
        const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
        const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
        game.applyPlayerDamage(damageTaken);
        break;
      }
    }
  }
}
