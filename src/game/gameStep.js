import { vecLength, directionIndexFromVector } from "../utils.js";

export function stepGame(game, dt, controls = {}) {
  if (typeof game.updateDeathTransition === "function" && game.updateDeathTransition(dt)) return;

  const segmentRectHit = (x0, y0, x1, y1, left, top, right, bottom) => {
    // Liang-Barsky clipping against AABB.
    const dx = x1 - x0;
    const dy = y1 - y0;
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    return (
      clip(-dx, x0 - left) &&
      clip(dx, right - x0) &&
      clip(-dy, y0 - top) &&
      clip(dy, bottom - y0) &&
      t0 <= t1
    );
  };
  const beamHasLineOfSight = (x0, y0, x1, y1) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = vecLength(dx, dy);
    if (dist <= 1) return true;
    const tile = game.config?.map?.tile || 32;
    const step = Math.max(8, tile * 0.35);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x0 + dx * t;
      const sy = y0 + dy * t;
      if (game.isWallAt(sx, sy, false)) return false;
    }
    return true;
  };
  if (controls.processUi !== false && typeof game.handleUiClicks === "function") {
    game.handleUiClicks();
  }
  if (typeof game.isActive === "function" && !game.isActive()) return;

  game.time += dt;
  if (typeof game.updateFloorBossTrigger === "function") game.updateFloorBossTrigger();
  if (typeof game.syncFloorBossFeedback === "function") game.syncFloorBossFeedback();
  game.player.speed = game.getPlayerMoveSpeed();
  game.player.fireCooldown = Math.max(0, game.player.fireCooldown - dt);
  game.player.fireArrowCooldown = Math.max(0, game.player.fireArrowCooldown - dt);
  game.player.deathBoltCooldown = Math.max(0, (Number.isFinite(game.player.deathBoltCooldown) ? game.player.deathBoltCooldown : 0) - dt);
  game.player.hitCooldown = Math.max(0, game.player.hitCooldown - dt);
  game.player.hpBarTimer = Math.max(0, game.player.hpBarTimer - dt);
  game.warriorMomentumTimer = Math.max(0, game.warriorMomentumTimer - dt);
  game.warriorRageActiveTimer = Math.max(0, (Number.isFinite(game.warriorRageActiveTimer) ? game.warriorRageActiveTimer : 0) - dt);
  game.warriorRageCooldownTimer = Math.max(0, (Number.isFinite(game.warriorRageCooldownTimer) ? game.warriorRageCooldownTimer : 0) - dt);
  game.passiveRegenTimer = Math.max(-4, (Number.isFinite(game.passiveRegenTimer) ? game.passiveRegenTimer : 2) - dt);
  game.player.animTime += dt;
  for (const ft of game.floatingTexts) {
    ft.life -= dt;
    ft.y -= ft.vy * dt;
  }
  game.floatingTexts = game.floatingTexts.filter((ft) => ft.life > 0);

  while (game.passiveRegenTimer <= 0) {
    game.passiveRegenTimer += 2;
    const regenPct = Number.isFinite(game.classSpec.passiveRegenPct) ? Math.max(0, game.classSpec.passiveRegenPct) : 0;
    if (regenPct <= 0 || game.player.health <= 0 || game.player.health >= game.player.maxHealth) continue;
    const healAmount = Math.max(1, Math.floor(game.player.maxHealth * regenPct));
    game.applyPlayerHealing(healAmount);
  }

  const mx = Number.isFinite(controls.moveX) ? controls.moveX : 0;
  const my = Number.isFinite(controls.moveY) ? controls.moveY : 0;
  game.player.lastX = game.player.x;
  game.player.lastY = game.player.y;
  if (mx || my) {
    const len = vecLength(mx, my) || 1;
    game.moveWithCollision(game.player, (mx / len) * game.player.speed * dt, (my / len) * game.player.speed * dt);
  }
  game.player.moving = !!(mx || my);
  game.revealAroundPlayer();

  const trapCfg = game.config?.traps?.wall || {};
  const moveLen = vecLength(mx, my) || 1;
  const moveDirX = mx ? mx / moveLen : 0;
  const moveDirY = my ? my / moveLen : 0;
  const trapSightRange = (Number.isFinite(trapCfg.sightRangeTiles) ? trapCfg.sightRangeTiles : 5) * game.config.map.tile;
  const trapDetectRange = (Number.isFinite(trapCfg.detectRangeTiles) ? trapCfg.detectRangeTiles : 10) * game.config.map.tile;
  const trapDetectBaseChance = Number.isFinite(trapCfg.detectForwardChance) ? trapCfg.detectForwardChance : 0.3;
  const playerEnemyRadius = typeof game.getPlayerEnemyCollisionRadius === "function"
    ? game.getPlayerEnemyCollisionRadius()
    : game.player.size * 0.5;
  const isPlayerInTrapLane = (trap) => {
    if (!trap) return false;
    const trapOriginX = trap.x + trap.dirX * game.config.map.tile * 0.5;
    const trapOriginY = trap.y + trap.dirY * game.config.map.tile * 0.5;
    const dx = game.player.x - trapOriginX;
    const dy = game.player.y - trapOriginY;
    const forward = dx * trap.dirX + dy * trap.dirY;
    if (forward <= 0 || forward > trapSightRange) return false;
    const side = Math.abs(dx * -trap.dirY + dy * trap.dirX);
    if (side > playerEnemyRadius + game.config.map.tile * 0.18) return false;
    const samples = Math.max(1, Math.ceil(forward / Math.max(8, game.config.map.tile * 0.35)));
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const sx = trapOriginX + dx * t;
      const sy = trapOriginY + dy * t;
      if (game.isWallAt(sx, sy, false)) return false;
    }
    return true;
  };
  for (const trap of game.wallTraps || []) {
    trap.cooldown = Math.max(0, (Number.isFinite(trap.cooldown) ? trap.cooldown : 0) - dt);
    if (!trap.spotted && !trap.detectionChecked) {
      if (vecLength(game.player.x - trap.x, game.player.y - trap.y) <= trapDetectRange) {
        trap.detectionChecked = true;
        const moveDot = (mx || my) ? moveDirX * trap.dirX + moveDirY * trap.dirY : -1;
        const baseChance = trapDetectBaseChance * Math.max(0, Math.min(1, (moveDot + 1) * 0.5));
        const bonusChance = typeof game.getTrapDetectionBonus === "function" ? game.getTrapDetectionBonus() : 0;
        const spotChance = Math.max(0, Math.min(1, baseChance + Math.max(0, bonusChance)));
        if (Math.random() < spotChance) trap.spotted = true;
      }
    }
    if (trap.cooldown <= 0 && isPlayerInTrapLane(trap) && typeof game.fireWallTrap === "function") {
      game.fireWallTrap(trap);
    }
  }

  if (controls.hasAim && Number.isFinite(controls.aimX) && Number.isFinite(controls.aimY)) {
    const aimDx = controls.aimX - game.player.x;
    const aimDy = controls.aimY - game.player.y;
    const aimLen = vecLength(aimDx, aimDy);
    if (aimLen > 1) {
      game.player.dirX = aimDx / aimLen;
      game.player.dirY = aimDy / aimLen;
      game.player.facing = directionIndexFromVector(game.player.dirX, game.player.dirY);
    }
  }

  if (game.isNecromancerClass && game.isNecromancerClass()) {
    const beam = game.necromancerBeam || (game.necromancerBeam = {
      active: false,
      targetId: null,
      targetX: 0,
      targetY: 0,
      progress: 0,
      healTickTimer: 0,
      targetEnemy: null
    });
    const beamRange = (game.config.necromancer?.controlRangeTiles || 10) * game.config.map.tile;
    const beamWidth = Number.isFinite(game.config.necromancer?.beamWidth) ? game.config.necromancer.beamWidth : 11;
    const held = !!controls.firePrimaryHeld && !!controls.hasAim;
    if (!beam.failLatch) beam.failLatch = false;
    beam.active = held;
    beam.targetId = null;
    beam.targetEnemy = null;
    beam.targetX = controls.aimX;
    beam.targetY = controls.aimY;
    if (held) {
      const aimLen = vecLength(controls.aimX - game.player.x, controls.aimY - game.player.y);
      const hitBreakable = (() => {
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const br of game.breakables || []) {
          if (!br || (br.hp || 0) <= 0) continue;
          const beamDist = vecLength(br.x - game.player.x, br.y - game.player.y);
          if (beamDist > beamRange) continue;
          if (!beamHasLineOfSight(game.player.x, game.player.y, br.x, br.y)) continue;
          const lineDist = Math.abs((controls.aimY - game.player.y) * br.x - (controls.aimX - game.player.x) * br.y + controls.aimX * game.player.y - controls.aimY * game.player.x) /
            Math.max(1, aimLen);
          if (lineDist > beamWidth + (br.size || 20) * 0.35) continue;
          const distToAim = vecLength(br.x - controls.aimX, br.y - controls.aimY);
          if (distToAim < bestDist) {
            best = br;
            bestDist = distToAim;
          }
        }
        return best;
      })();
      if (hitBreakable) {
        beam.targetX = hitBreakable.x;
        beam.targetY = hitBreakable.y;
        beam.progress = 0;
        beam.healTickTimer = 0;
        hitBreakable.hp = 0;
        beam.failLatch = false;
      }
      const invalidTarget = (() => {
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const enemy of game.enemies) {
          if (!enemy || (enemy.hp || 0) <= 0) continue;
          if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
          const beamDist = vecLength(enemy.x - game.player.x, enemy.y - game.player.y);
          if (beamDist > beamRange) continue;
          if (!beamHasLineOfSight(game.player.x, game.player.y, enemy.x, enemy.y)) continue;
          const lineDist = Math.abs((controls.aimY - game.player.y) * enemy.x - (controls.aimX - game.player.x) * enemy.y + controls.aimX * game.player.y - controls.aimY * game.player.x) /
            Math.max(1, aimLen);
          if (lineDist > beamWidth) continue;
          const distToAim = vecLength(enemy.x - controls.aimX, enemy.y - controls.aimY);
          if (distToAim < bestDist) {
            best = enemy;
            bestDist = distToAim;
          }
        }
        return best;
      })();
      if (!hitBreakable && invalidTarget && (!game.isUndeadEnemy(invalidTarget) || (!game.isControlledUndead(invalidTarget) && !game.canControlMoreUndead()))) {
        beam.active = false;
        beam.progress = 0;
        beam.healTickTimer = 0;
        if (!beam.failLatch) {
          game.spawnFloatingText(controls.aimX, controls.aimY - 10, "Fail!", "#ef5b5b", 0.7, 15);
          beam.failLatch = true;
        }
      } else {
        beam.failLatch = false;
      }
    } else {
      beam.failLatch = false;
    }
    if (beam.active) {
      let bestTarget = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const enemy of game.enemies) {
        if (!game.isUndeadEnemy(enemy) || (enemy.hp || 0) <= 0) continue;
        if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
        const beamDist = vecLength(enemy.x - game.player.x, enemy.y - game.player.y);
        if (beamDist > beamRange) continue;
        if (!beamHasLineOfSight(game.player.x, game.player.y, enemy.x, enemy.y)) continue;
        const lineDist = Math.abs((controls.aimY - game.player.y) * enemy.x - (controls.aimX - game.player.x) * enemy.y + controls.aimX * game.player.y - controls.aimY * game.player.x) /
          Math.max(1, vecLength(controls.aimX - game.player.x, controls.aimY - game.player.y));
        if (lineDist > beamWidth) continue;
        const distToAim = vecLength(enemy.x - controls.aimX, enemy.y - controls.aimY);
        if (distToAim < bestDist) {
          bestDist = distToAim;
          bestTarget = enemy;
        }
      }
      if (bestTarget) {
        beam.targetId = bestTarget.id || null;
        beam.targetEnemy = bestTarget;
        beam.targetX = bestTarget.x;
        beam.targetY = bestTarget.y;
        if (game.isControlledUndead(bestTarget)) {
          beam.progress = 0;
          beam.healTickTimer = (beam.healTickTimer || 0) + dt;
          const healPeriod = game.config.necromancer?.healTickSeconds || 0.2;
          while (beam.healTickTimer >= healPeriod) {
            beam.healTickTimer -= healPeriod;
            game.healControlledUndead(bestTarget, game.getNecroticBeamHealAmount());
          }
        } else {
          beam.healTickTimer = 0;
          beam.progress += dt;
          if (beam.progress >= game.getNecromancerCharmDuration()) {
            if (game.markUndeadAsControlled(bestTarget)) {
              beam.progress = 0;
              game.spawnFloatingText(bestTarget.x, bestTarget.y - bestTarget.size * 0.7, "Charmed", "#8eb8ff", 0.9, 14);
            }
          }
        }
      } else {
        beam.progress = 0;
        beam.healTickTimer = 0;
      }
    } else {
      beam.progress = 0;
      beam.healTickTimer = 0;
    }
  } else {
    if (controls.firePrimaryQueued) game.fire(game.player.dirX, game.player.dirY);
    if (controls.firePrimaryHeld && controls.hasAim) game.fire(game.player.dirX, game.player.dirY);
  }
  if (controls.fireAltQueued) game.fireFireArrow(game.player.dirX, game.player.dirY);

  const activeBounds = game.getActiveBounds ? game.getActiveBounds(8) : null;
  const isActive = (obj, extra = 0) => {
    if (!activeBounds || !obj) return true;
    const r = (Number.isFinite(obj.size) ? obj.size * 0.5 : 0) + extra;
    return game.isInsideBounds(obj.x, obj.y, r, activeBounds);
  };

  const enemySpeedScale = game.getEnemySpeedScale();
  const skeletonIgnoresArrow = (enemy) =>
    enemy?.type === "skeleton_warrior" &&
    !enemy.collapsed &&
    Math.random() < (game.config.enemy.skeletonWarriorArrowIgnoreChance || 0.3);
  if (typeof game.consumeFloorBossSpawnRequest === "function") {
    const bossRequest = game.consumeFloorBossSpawnRequest();
    if (bossRequest) {
      const point = game.randomEnemySpawnPoint() || { x: game.door.x || game.player.x, y: game.door.y || game.player.y };
      const boss = game.spawnNecromancer(point.x, point.y);
      game.enemies.push(boss);
      if (typeof game.markFloorBossActive === "function") game.markFloorBossActive();
      if (typeof game.spawnFloatingText === "function") {
        game.spawnFloatingText(game.player.x, game.player.y - 96, `Necromancer Stirs`, "#d49dff", 1.5, 18);
      }
    }
  }
  game.enemySpawnTimer -= dt;
  let spawnIterations = 0;
  while (game.enemySpawnTimer <= 0 && game.enemies.length < game.config.enemy.maxCount && spawnIterations < 6) {
    const packSize = game.getEnemyPackSize();
    for (let i = 0; i < packSize && game.enemies.length < game.config.enemy.maxCount; i++) {
      const point = game.randomEnemySpawnPoint();
      if (!point) continue;
      const activeGoblins = game.enemies.filter((enemy) => enemy.type === "goblin").length;
      const activeRatArchers = game.enemies.filter((enemy) => enemy.type === "rat_archer").length;
      const skeletonMinFloor = Number.isFinite(game.config.enemy.skeletonWarriorMinFloor) ? game.config.enemy.skeletonWarriorMinFloor : 4;
      const spawnSkeleton = game.floor >= skeletonMinFloor && Math.random() < (game.config.enemy.skeletonWarriorSpawnChance || 0.25);
      const ratArcherMinFloor = Number.isFinite(game.config.enemy.ratArcherMinFloor) ? game.config.enemy.ratArcherMinFloor : 3;
      if (
        game.floor >= ratArcherMinFloor &&
        activeRatArchers < game.config.enemy.maxActiveRatArchers &&
        Math.random() < game.config.enemy.ratArcherSpawnChance
      ) {
        game.enemies.push(game.spawnRatArcher(point.x, point.y));
      } else if (spawnSkeleton) {
        game.enemies.push(game.spawnSkeletonWarrior(point.x, point.y));
      } else if (activeGoblins < game.config.enemy.maxActiveGoblins && Math.random() < game.config.enemy.goblinSpawnChance) {
        game.enemies.push(game.spawnTreasureGoblin(point.x, point.y));
      } else {
        game.enemies.push(game.spawnGhost(point.x, point.y));
      }
    }
    const nextInterval = game.getEnemySpawnInterval();
    game.enemySpawnTimer += Math.max(0.1, Number.isFinite(nextInterval) ? nextInterval : 0.8);
    spawnIterations += 1;
  }

  let armorActivations = 0;
  for (const stand of game.armorStands) {
    if (!stand.animated || stand.activated) continue;
    if (game.enemies.length >= game.config.enemy.maxCount || armorActivations >= 4) break;
    if (vecLength(game.player.x - stand.x, game.player.y - stand.y) < game.config.enemy.armorWakeRadius) {
      stand.activated = true;
      game.enemies.push(game.spawnAnimatedArmor(stand.x, stand.y));
      armorActivations += 1;
    }
  }

  const activeEnemies = [];
  const activeBreakables = [];
  for (const enemy of game.enemies) {
    enemy.lastX = enemy.x;
    enemy.lastY = enemy.y;
    enemy.hpBarTimer = Math.max(0, (enemy.hpBarTimer || 0) - dt);
    enemy.damageTextTimer = Math.max(0, (enemy.damageTextTimer || 0) - dt);
    enemy.damageBuffTimer = Math.max(0, (enemy.damageBuffTimer || 0) - dt);
    if (!isActive(enemy, 72)) continue;
    activeEnemies.push(enemy);
    if (enemy.type === "goblin") game.updateGoblin(enemy, dt, enemySpeedScale);
    else if (enemy.type === "mimic") game.updateMimic(enemy, dt, enemySpeedScale);
    else if (enemy.type === "rat_archer") game.updateRatArcher(enemy, dt, enemySpeedScale);
    else if (enemy.type === "skeleton_warrior") game.updateSkeletonWarrior(enemy, dt, enemySpeedScale);
    else if (enemy.type === "necromancer") game.updateNecromancer(enemy, dt, enemySpeedScale);
    else if (typeof game.updateGenericEnemy === "function") game.updateGenericEnemy(enemy, dt, enemySpeedScale);
    else game.moveEnemyTowardPlayer(enemy, enemySpeedScale, dt);
  }
  for (const br of game.breakables || []) {
    if (!isActive(br, 64)) continue;
    activeBreakables.push(br);
  }
  for (const enemy of activeEnemies) {
    if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
    if (enemy.type === "skeleton_warrior" && enemy.collapsed) continue;
    if (typeof game.separateEnemyFromPlayer === "function") game.separateEnemyFromPlayer(enemy);
  }

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
    if (vecLength(enemy.x - game.player.x, enemy.y - game.player.y) > maxPetDistance) {
      enemy.hp = 0;
    }
  }

  let removeBossSummons = false;
  game.enemies = game.enemies.filter((enemy) => {
    if (enemy.type === "skeleton_warrior" && enemy.collapsed && enemy.collapseTimer > 0) {
      return true;
    }
    if (enemy.hp <= 0) {
      const wasFriendly = game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy);
      if (wasFriendly && typeof game.triggerExplodingDeath === "function") game.triggerExplodingDeath(enemy);
      if (wasFriendly) return false;
      game.triggerWarriorMomentumOnKill();
      if (enemy.type === "goblin") game.score += 30 + enemy.goldEaten;
      else if (enemy.type === "armor") game.score += 40;
      else if (enemy.type === "mimic") game.score += 35;
      else if (enemy.type === "rat_archer") game.score += 16;
      else if (enemy.type === "skeleton_warrior") game.score += 10;
      else if (enemy.type === "necromancer") game.score += 250;
      else if (enemy.type === "skeleton") game.score += 12;
      else game.score += 10;
      game.gainExperience(game.xpFromEnemy(enemy));
      if (enemy.type === "goblin") game.dropTreasureBag(enemy.x, enemy.y, enemy.goldEaten);
      else if (enemy.type === "armor") game.dropArmorLoot(enemy.x, enemy.y);
      else if (enemy.type === "mimic") game.dropTreasureBag(enemy.x, enemy.y, 24);
      else if (enemy.type === "rat_archer") game.maybeSpawnDrop(enemy.x, enemy.y);
      else if (enemy.type === "skeleton_warrior") game.maybeSpawnDrop(enemy.x, enemy.y);
      else if (enemy.type === "necromancer") {
        if (typeof game.markFloorBossDefeated === "function") game.markFloorBossDefeated();
        removeBossSummons = true;
        if (typeof game.spawnExitPortal === "function") game.spawnExitPortal(enemy.x, enemy.y);
        game.dropNecromancerLoot(enemy.x, enemy.y);
        game.spawnFloatingText(enemy.x, enemy.y - 42, "Boss Defeated", "#f2bf7b", 1.5, 18);
        game.spawnFloatingText(enemy.x, enemy.y - 62, "Portal Open", "#90f0ff", 1.5, 18);
      }
      else if (enemy.type === "skeleton") game.maybeSpawnDrop(enemy.x, enemy.y);
      else game.maybeSpawnDrop(enemy.x, enemy.y);
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

  if (typeof game.isPlayerAtPortal === "function" && game.isPlayerAtPortal()) {
    if (typeof game.markFloorBossCompleted === "function") game.markFloorBossCompleted();
    if (game.portal) game.portal.active = false;
    game.advanceToNextFloor();
    return;
  }

  if (game.player.hitCooldown <= 0) {
    for (const enemy of activeEnemies) {
      if (game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy)) continue;
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
