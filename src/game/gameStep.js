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

  if (controls.firePrimaryQueued) game.fire(game.player.dirX, game.player.dirY);
  if (controls.firePrimaryHeld && controls.hasAim) game.fire(game.player.dirX, game.player.dirY);
  if (controls.fireAltQueued) game.fireFireArrow(game.player.dirX, game.player.dirY);

  const activeBounds = game.getActiveBounds ? game.getActiveBounds(8) : null;
  const isActive = (obj, extra = 0) => {
    if (!activeBounds || !obj) return true;
    const r = (Number.isFinite(obj.size) ? obj.size * 0.5 : 0) + extra;
    return game.isInsideBounds(obj.x, obj.y, r, activeBounds);
  };

  const enemySpeedScale = game.getEnemySpeedScale();
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
      const ratArcherMinLevel = Number.isFinite(game.config.enemy.ratArcherMinLevel) ? game.config.enemy.ratArcherMinLevel : 1;
      if (
        game.level >= ratArcherMinLevel &&
        activeRatArchers < game.config.enemy.maxActiveRatArchers &&
        Math.random() < game.config.enemy.ratArcherSpawnChance
      ) {
        game.enemies.push(game.spawnRatArcher(point.x, point.y));
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
    if (!isActive(enemy, 72)) continue;
    activeEnemies.push(enemy);
    if (enemy.type === "goblin") game.updateGoblin(enemy, dt, enemySpeedScale);
    else if (enemy.type === "mimic") game.updateMimic(enemy, dt, enemySpeedScale);
    else if (enemy.type === "rat_archer") game.updateRatArcher(enemy, dt, enemySpeedScale);
    else if (enemy.type === "necromancer") game.updateNecromancer(enemy, dt, enemySpeedScale);
    else game.moveEnemyTowardPlayer(enemy, enemySpeedScale, dt);
  }
  for (const br of game.breakables || []) {
    if (!isActive(br, 64)) continue;
    activeBreakables.push(br);
  }
  for (const enemy of activeEnemies) {
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
        if (vecLength(b.x - enemy.x, b.y - enemy.y) < (enemy.size + b.size) * 0.5) {
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
      if (b.hitTargets.has(enemy)) continue;
      if (vecLength(b.x - enemy.x, b.y - enemy.y) < (enemy.size + b.size) * 0.5) {
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
      if (vecLength(arrow.x - enemy.x, arrow.y - enemy.y) < (enemy.size + arrow.size) * 0.5) {
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
    for (const br of activeBreakables) {
      if (vecLength(zone.x - br.x, zone.y - br.y) < zone.radius + br.size * 0.32) br.hp = 0;
    }
    for (const enemy of activeEnemies) {
      if (vecLength(zone.x - enemy.x, zone.y - enemy.y) < zone.radius + enemy.size * 0.35) {
        game.applyEnemyDamage(enemy, game.getFireArrowLingerDps() * dt, "fire");
      }
    }
  }

  let removeBossSummons = false;
  game.enemies = game.enemies.filter((enemy) => {
    if (enemy.hp <= 0) {
      game.triggerWarriorMomentumOnKill();
      if (enemy.type === "goblin") game.score += 30 + enemy.goldEaten;
      else if (enemy.type === "armor") game.score += 40;
      else if (enemy.type === "mimic") game.score += 35;
      else if (enemy.type === "rat_archer") game.score += 16;
      else if (enemy.type === "necromancer") game.score += 250;
      else if (enemy.type === "skeleton") game.score += 12;
      else game.score += 10;
      game.gainExperience(game.xpFromEnemy(enemy));
      if (enemy.type === "goblin") game.dropTreasureBag(enemy.x, enemy.y, enemy.goldEaten);
      else if (enemy.type === "armor") game.dropArmorLoot(enemy.x, enemy.y);
      else if (enemy.type === "mimic") game.dropTreasureBag(enemy.x, enemy.y, 24);
      else if (enemy.type === "rat_archer") game.maybeSpawnDrop(enemy.x, enemy.y);
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

  if (typeof game.isPlayerAtPortal === "function" && game.isPlayerAtPortal()) {
    if (typeof game.markFloorBossCompleted === "function") game.markFloorBossCompleted();
    if (game.portal) game.portal.active = false;
    game.advanceToNextFloor();
    return;
  }

  if (game.player.hitCooldown <= 0) {
    for (const enemy of activeEnemies) {
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
