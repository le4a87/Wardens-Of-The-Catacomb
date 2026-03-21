import { vecLength, directionIndexFromVector } from "../utils.js";
import { resolveCombatAndDrops } from "./stepCombatResolution.js";

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
  if (typeof game.updateNavigationField === "function") game.updateNavigationField();
  if (typeof game.updateFloorBossTrigger === "function") game.updateFloorBossTrigger();
  if (typeof game.syncFloorBossFeedback === "function") game.syncFloorBossFeedback();
  if (game.floorBoss?.speechExpiresAt && game.time >= game.floorBoss.speechExpiresAt) {
    game.floorBoss.speechText = "";
    game.floorBoss.speechExpiresAt = null;
  }
  if (typeof game.getRemainingFloorBossTimer === "function") {
    const bossTimerRemaining = game.getRemainingFloorBossTimer();
    if (bossTimerRemaining !== null && bossTimerRemaining <= 0 && !game.gameOver) {
      game.applyPlayerDamage(Math.max(999999, game.player.health + 999999));
      return;
    }
  }
  game.player.speed = game.getPlayerMoveSpeed();
  game.player.fireCooldown = Math.max(0, game.player.fireCooldown - dt);
  game.player.fireArrowCooldown = Math.max(0, game.player.fireArrowCooldown - dt);
  game.player.deathBoltCooldown = Math.max(0, (Number.isFinite(game.player.deathBoltCooldown) ? game.player.deathBoltCooldown : 0) - dt);
  game.player.hitCooldown = Math.max(0, game.player.hitCooldown - dt);
  game.player.hpBarTimer = Math.max(0, game.player.hpBarTimer - dt);
  game.player.knockbackTimer = Math.max(0, (Number.isFinite(game.player.knockbackTimer) ? game.player.knockbackTimer : 0) - dt);
  game.warriorMomentumTimer = Math.max(0, game.warriorMomentumTimer - dt);
  game.warriorRageActiveTimer = Math.max(0, (Number.isFinite(game.warriorRageActiveTimer) ? game.warriorRageActiveTimer : 0) - dt);
  game.warriorRageCooldownTimer = Math.max(0, (Number.isFinite(game.warriorRageCooldownTimer) ? game.warriorRageCooldownTimer : 0) - dt);
  game.warriorRageVictoryRushTimer = Math.max(0, (Number.isFinite(game.warriorRageVictoryRushTimer) ? game.warriorRageVictoryRushTimer : 0) - dt);
  game.passiveRegenTimer = Math.max(-4, (Number.isFinite(game.passiveRegenTimer) ? game.passiveRegenTimer : 2) - dt);
  game.player.animTime += dt;
  for (const ft of game.floatingTexts) {
    ft.life -= dt;
    ft.y -= ft.vy * dt;
  }
  game.floatingTexts = game.floatingTexts.filter((ft) => ft.life > 0);

  if (
    (game.warriorRageVictoryRushPool || 0) > 0 &&
    (game.warriorRageVictoryRushTimer || 0) > 0 &&
    game.player.health > 0
  ) {
    const timer = Math.max(dt, game.warriorRageVictoryRushTimer);
    const healAmount = Math.min(game.warriorRageVictoryRushPool, (game.warriorRageVictoryRushPool / timer) * dt);
    game.warriorRageVictoryRushPool = Math.max(0, game.warriorRageVictoryRushPool - healAmount);
    game.applyPlayerHealing(healAmount, { suppressText: true });
  } else if ((game.warriorRageVictoryRushTimer || 0) <= 0) {
    game.warriorRageVictoryRushPool = 0;
  }

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
  if ((game.player.knockbackTimer || 0) > 0) {
    game.moveWithCollision(game.player, (game.player.knockbackVx || 0) * dt, (game.player.knockbackVy || 0) * dt);
  } else if (mx || my) {
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

  if (controls.hasAim) {
    const hasAimDir = Number.isFinite(controls.aimDirX) && Number.isFinite(controls.aimDirY);
    if (hasAimDir) {
      const aimLen = vecLength(controls.aimDirX, controls.aimDirY);
      if (aimLen > 0.001) {
        game.player.dirX = controls.aimDirX / aimLen;
        game.player.dirY = controls.aimDirY / aimLen;
        game.player.facing = directionIndexFromVector(game.player.dirX, game.player.dirY);
      }
    } else if (Number.isFinite(controls.aimX) && Number.isFinite(controls.aimY)) {
      const aimDx = controls.aimX - game.player.x;
      const aimDy = controls.aimY - game.player.y;
      const aimLen = vecLength(aimDx, aimDy);
      if (aimLen > 1) {
        game.player.dirX = aimDx / aimLen;
        game.player.dirY = aimDy / aimLen;
        game.player.facing = directionIndexFromVector(game.player.dirX, game.player.dirY);
      }
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
    if (!controls.firePrimaryQueued && controls.firePrimaryHeld && controls.hasAim) {
      game.fire(game.player.dirX, game.player.dirY);
    }
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
      const boss = bossRequest.bossType === "minotaur"
        ? game.spawnMinotaur(point.x, point.y)
        : bossRequest.variant === "leprechaun"
        ? game.spawnLeprechaunBoss(point.x, point.y)
        : game.spawnNecromancer(point.x, point.y);
      game.enemies.push(boss);
      if (typeof game.markFloorBossActive === "function") game.markFloorBossActive();
      if (bossRequest.variant === "leprechaun" && game.floorBoss) {
        game.floorBoss.potX = null;
        game.floorBoss.potY = null;
      }
      if (typeof game.spawnFloatingText === "function") {
        const bossLabel =
          bossRequest.variant === "leprechaun"
            ? "Leprechaun Escapes"
            : `${bossRequest.bossName || "Boss"} Stirs`;
        const bossColor = bossRequest.variant === "leprechaun" ? "#a2f06e" : "#d49dff";
        game.spawnFloatingText(game.player.x, game.player.y - 96, bossLabel, bossColor, 1.5, 18);
      }
    }
  }
  game.enemySpawnTimer -= dt;
  let spawnIterations = 0;
  const activeEnemyCap = typeof game.getActiveEnemyCap === "function" ? game.getActiveEnemyCap() : game.config.enemy.maxCount;
  const floorBossActive = typeof game.isFloorBossActive === "function" ? game.isFloorBossActive() : false;
  while (!floorBossActive && game.enemySpawnTimer <= 0 && game.enemies.length < activeEnemyCap && spawnIterations < 6) {
    const packSize = game.getEnemyPackSize();
    for (let i = 0; i < packSize && game.enemies.length < activeEnemyCap; i++) {
      const point = game.randomEnemySpawnPoint();
      if (!point) continue;
      const activeGoblins = game.enemies.filter((enemy) => enemy.type === "goblin").length;
      const activePrisoners = game.enemies.filter((enemy) => enemy.type === "prisoner").length;
      const activeMummies = game.enemies.filter((enemy) => enemy.type === "mummy").length;
      const activeRatArchers = game.enemies.filter((enemy) => enemy.type === "rat_archer").length;
      const prisonerMinFloor = Number.isFinite(game.config.enemy.prisonerMinFloor) ? game.config.enemy.prisonerMinFloor : 2;
      const skeletonMinFloor = Number.isFinite(game.config.enemy.skeletonWarriorMinFloor) ? game.config.enemy.skeletonWarriorMinFloor : 4;
      const spawnSkeleton = game.floor >= skeletonMinFloor && Math.random() < (game.config.enemy.skeletonWarriorSpawnChance || 0.25);
      const mummyMinFloor = Number.isFinite(game.config.enemy.mummyMinFloor) ? game.config.enemy.mummyMinFloor : 4;
      const spawnMummy =
        game.floor >= mummyMinFloor &&
        activeMummies < game.config.enemy.maxActiveMummies &&
        Math.random() < (game.config.enemy.mummySpawnChance || 0.08);
      const ratArcherMinFloor = Number.isFinite(game.config.enemy.ratArcherMinFloor) ? game.config.enemy.ratArcherMinFloor : 3;
      if (
        game.floor >= prisonerMinFloor &&
        activePrisoners < game.config.enemy.maxActivePrisoners &&
        Math.random() < game.config.enemy.prisonerSpawnChance
      ) {
        game.enemies.push(game.spawnPrisoner(point.x, point.y));
      } else if (
        game.floor >= ratArcherMinFloor &&
        activeRatArchers < game.config.enemy.maxActiveRatArchers &&
        Math.random() < game.config.enemy.ratArcherSpawnChance
      ) {
        game.enemies.push(game.spawnRatArcher(point.x, point.y));
      } else if (spawnMummy) {
        game.enemies.push(game.spawnMummy(point.x, point.y));
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
    if (floorBossActive) break;
    if (game.enemies.length >= activeEnemyCap || armorActivations >= 4) break;
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
    const alwaysActiveBoss = !!enemy?.isFloorBoss && (typeof game.isFloorBossActive !== "function" || game.isFloorBossActive());
    if (!alwaysActiveBoss && !isActive(enemy, 72)) continue;
    activeEnemies.push(enemy);
    if (typeof game.updateEnemyTactics === "function") game.updateEnemyTactics(enemy, dt, enemySpeedScale);
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

  resolveCombatAndDrops({
    game,
    dt,
    activeEnemies,
    activeBreakables,
    playerEnemyRadius,
    isActive,
    segmentRectHit,
    skeletonIgnoresArrow
  });

  if (typeof game.isPlayerAtPortal === "function" && game.isPlayerAtPortal()) {
    if (typeof game.markFloorBossCompleted === "function") game.markFloorBossCompleted();
    if (game.portal) game.portal.active = false;
    game.advanceToNextFloor();
    return;
  }

}
