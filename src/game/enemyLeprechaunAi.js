import { vecLength } from "../utils.js";

function moveEntityTowardPoint(game, entity, targetX, targetY, speed, dt, minDistance = 0) {
  if (!entity || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return 0;
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const dist = vecLength(dx, dy) || 1;
  if (dist <= minDistance) return dist;
  const step = Math.max(0, speed) * Math.max(0, dt);
  const moveStep = Math.min(step, dist - minDistance);
  game.moveWithCollision(entity, (dx / dist) * moveStep, (dy / dist) * moveStep);
  return dist;
}

function dropLeprechaunGoldPile(game, enemy) {
  const remaining = Math.max(0, (game.config.enemy.leprechaunGoldDropTotal || 1000) - (enemy.goldDropped || 0));
  if (remaining <= 0) return false;
  const min = Math.max(1, game.config.enemy.leprechaunGoldPileMin || 10);
  const max = Math.max(min, game.config.enemy.leprechaunGoldPileMax || 35);
  const duration = Math.max(1, game.config.enemy.leprechaunGoldDropMinDuration || 10);
  const cooldown = Math.max(0.05, game.config.enemy.leprechaunGoldDropCooldown || 0.1);
  const timeRemaining = Math.max(0, duration - (enemy.fleeElapsed || 0));
  const dropsLeft = Math.max(1, Math.ceil(timeRemaining / cooldown) + 1);
  const guided = Math.round(remaining / dropsLeft);
  const amount = Math.min(remaining, Math.max(min, Math.min(max, guided || min)));
  const scatter = enemy.size * 0.45;
  game.drops.push({
    type: "gold",
    x: enemy.x + (Math.random() - 0.5) * scatter,
    y: enemy.y + (Math.random() - 0.5) * scatter,
    size: 9,
    amount,
    life: game.config.drops.life + 24
  });
  enemy.goldDropped = (enemy.goldDropped || 0) + amount;
  return true;
}

function spawnLuckyCharmVolley(game, enemy) {
  const count = Math.max(1, Math.floor(game.config.enemy.leprechaunCharmVolleyCount || 5));
  const spreadRad = ((game.config.enemy.leprechaunCharmSpreadDeg || 28) * Math.PI) / 180;
  const baseAngle = Math.atan2(enemy.dirY || 0, enemy.dirX || 1);
  const speed = game.config.enemy.leprechaunCharmProjectileSpeed || 300;
  const life = game.config.enemy.leprechaunCharmProjectileLife || 2.2;
  const damage = game.config.enemy.leprechaunCharmProjectileDamage || 18;
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const offset = (t - 0.5) * spreadRad;
    const angle = baseAngle + offset;
    game.bullets.push({
      x: enemy.x + Math.cos(angle) * enemy.size * 0.7,
      y: enemy.y + Math.sin(angle) * enemy.size * 0.7,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      life,
      size: 10,
      projectileType: "luckyCharm",
      faction: "enemy",
      damage,
      damageType: "magic"
    });
  }
}

function applyLeprechaunPunch(game, enemy) {
  const dx = game.player.x - enemy.x;
  const dy = game.player.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  const range = (game.config.enemy.leprechaunPunchRangeTiles || 2.2) * (game.config.map?.tile || 32);
  if (dist > range + game.getPlayerEnemyCollisionRadius()) return false;
  if (game.player.hitCooldown > 0) return false;
  game.player.hitCooldown = 1.0;
  const rawDamage = game.rollEnemyContactDamage({
    damageMin: game.config.enemy.leprechaunPunchDamageMin,
    damageMax: game.config.enemy.leprechaunPunchDamageMax
  });
  const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
  const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
  game.applyPlayerDamage(game.getWarriorRageDamageTaken(reducedByDefense));
  if (typeof game.applyPlayerKnockback === "function" && (enemy.punchKnockbackCooldown || 0) <= 0) {
    game.applyPlayerKnockback(
      (game.config.enemy.leprechaunPunchKnockbackTiles || 20) * (game.config.map?.tile || 32),
      dx / dist,
      dy / dist
    );
    enemy.punchKnockbackCooldown = game.config.enemy.leprechaunPunchKnockbackCooldown || 15;
  }
  return true;
}

export function updateLeprechaunBoss(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const toPlayerX = game.player.x - enemy.x;
  const toPlayerY = game.player.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  enemy.dirX = toPlayerX / playerDist;
  enemy.dirY = toPlayerY / playerDist;
  enemy.goldDropCooldown = Math.max(0, (enemy.goldDropCooldown || 0) - dt);
  enemy.charmCooldown = Math.max(0, (enemy.charmCooldown || 0) - dt);
  enemy.punchCooldown = Math.max(0, (enemy.punchCooldown || 0) - dt);
  enemy.punchKnockbackCooldown = Math.max(0, (enemy.punchKnockbackCooldown || 0) - dt);
  enemy.punchWindup = Math.max(0, (enemy.punchWindup || 0) - dt);
  enemy.speechCooldown = Math.max(0, (enemy.speechCooldown || 0) - dt);

  if (enemy.phase === "intro") {
    enemy.invincible = true;
    enemy.speed = game.config.enemy.leprechaunIntroSpeed || game.config.enemy.leprechaunFleeSpeed;
    if (typeof game.moveEnemyTowardTargetPoint === "function") {
      game.moveEnemyTowardTargetPoint(enemy, game.player.x, game.player.y, speedScale, dt, (game.config.enemy.leprechaunIntroApproachTiles || 3) * tile);
    } else {
      moveEntityTowardPoint(game, enemy, game.player.x, game.player.y, enemy.speed * (speedScale || 1), dt, (game.config.enemy.leprechaunIntroApproachTiles || 3) * tile);
    }
    if (playerDist <= (game.config.enemy.leprechaunIntroApproachTiles || 3) * tile) {
      enemy.phase = "flee";
      if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("flee");
      if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("Catch me if ye can!", enemy.x, enemy.y, 1.8);
    }
    return;
  }

  if (enemy.phase === "flee") {
    enemy.invincible = true;
    enemy.speed = game.config.enemy.leprechaunFleeSpeed;
    enemy.fleeElapsed = (enemy.fleeElapsed || 0) + dt;
    moveEntityTowardPoint(game, enemy, enemy.x - toPlayerX, enemy.y - toPlayerY, enemy.speed * (speedScale || 1), dt);
    if (enemy.goldDropCooldown <= 0) {
      if (dropLeprechaunGoldPile(game, enemy)) enemy.goldDropCooldown = game.config.enemy.leprechaunGoldDropCooldown || 0.1;
      if ((enemy.goldDropped || 0) >= (game.config.enemy.leprechaunGoldDropTotal || 1000) && (enemy.fleeElapsed || 0) >= (game.config.enemy.leprechaunGoldDropMinDuration || 10)) {
        enemy.phase = "to_pot";
        enemy.potSpawned = true;
        if (game.floorBoss) {
          game.floorBoss.potX = enemy.potX;
          game.floorBoss.potY = enemy.potY;
        }
        if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("to_pot");
        if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("The pot awaits, if ye dare!", enemy.x, enemy.y, 2.1);
      }
    }
    return;
  }

  if (enemy.phase === "to_pot") {
    enemy.invincible = true;
    enemy.speed = game.config.enemy.leprechaunRunToPotSpeed;
    if (typeof game.moveEnemyTowardTargetPoint === "function") game.moveEnemyTowardTargetPoint(enemy, enemy.potX, enemy.potY, 1, dt, tile * 0.4, true);
    else moveEntityTowardPoint(game, enemy, enemy.potX, enemy.potY, enemy.speed, dt, tile * 0.4);
    if (vecLength(enemy.potX - enemy.x, enemy.potY - enemy.y) <= tile * 0.8) {
      enemy.phase = "waiting";
      if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("waiting");
    }
    return;
  }

  if (enemy.phase === "waiting") {
    enemy.invincible = true;
    if (playerDist <= (game.config.enemy.leprechaunTransformRangeTiles || 8) * tile) {
      enemy.phase = "enraged";
      enemy.invincible = false;
      enemy.size = 46;
      enemy.speed = game.config.enemy.leprechaunEnragedSpeed;
      enemy.hp = enemy.maxHp;
      enemy.hpBarTimer = 9999;
      if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("enraged");
      if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("Now ye face the gold's true guardian!", enemy.x, enemy.y, 2.6);
    }
    return;
  }

  enemy.invincible = false;
  enemy.speed = game.config.enemy.leprechaunEnragedSpeed;
  if (enemy.speechCooldown <= 0 && typeof game.maybeQueueRandomLeprechaunSpeech === "function") {
    if (game.maybeQueueRandomLeprechaunSpeech(enemy)) enemy.speechCooldown = 4 + Math.random() * 3.5;
  }
  if ((enemy.punchWindup || 0) > 0) {
    if (!enemy.punchApplied && enemy.punchWindup <= (game.config.enemy.leprechaunPunchWindup || 0.32) * 0.45) {
      enemy.punchApplied = true;
      applyLeprechaunPunch(game, enemy);
    }
    return;
  }
  const punchRange = (game.config.enemy.leprechaunPunchRangeTiles || 2.2) * tile;
  if (playerDist <= punchRange && enemy.punchCooldown <= 0) {
    enemy.punchCooldown = game.config.enemy.leprechaunPunchCooldown || 2.2;
    enemy.punchWindup = game.config.enemy.leprechaunPunchWindup || 0.32;
    enemy.punchApplied = false;
    if (typeof game.queueFloorBossSpeech === "function") game.queueFloorBossSpeech("Taste me lucky left hook!", enemy.x, enemy.y, 1.9);
    return;
  }
  if (enemy.charmCooldown <= 0) {
    spawnLuckyCharmVolley(game, enemy);
    enemy.charmCooldown = game.config.enemy.leprechaunCharmCooldown || 1.2;
    return;
  }
  moveEntityTowardPoint(game, enemy, game.player.x, game.player.y, enemy.speed, dt, Math.max(12, punchRange * 0.4));
}
