import { vecLength } from "../utils.js";

function hasLineOfSight(game, x0, y0, x1, y1) {
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
}

export function spawnGhost(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.ghostHpMin, game.config.enemy.ghostHpMax);
  return {
    type: "ghost",
    x,
    y,
    size: 20,
    speed: 85 + Math.random() * 35,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.ghostDamageMin,
    damageMax: game.config.enemy.ghostDamageMax
  };
}

export function spawnTreasureGoblin(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.goblinHpMin, game.config.enemy.goblinHpMax);
  return {
    type: "goblin",
    x,
    y,
    size: 16,
    speed: 95,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.goblinDamageMin,
    damageMax: game.config.enemy.goblinDamageMax,
    goldEaten: 0,
    aggression: 0.12,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 0.5 + Math.random() * 0.8
  };
}

export function spawnAnimatedArmor(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.armorHpMin, game.config.enemy.armorHpMax);
  return {
    type: "armor",
    x,
    y,
    size: 24,
    speed: game.config.enemy.armorSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.armorDamageMin,
    damageMax: game.config.enemy.armorDamageMax
  };
}

export function spawnMimic(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.mimicHpMin, game.config.enemy.mimicHpMax);
  return {
    type: "mimic",
    x,
    y,
    homeX: x,
    homeY: y,
    size: 20,
    speed: game.config.enemy.mimicSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.mimicDamageMin,
    damageMax: game.config.enemy.mimicDamageMax,
    dormant: true,
    revealed: false,
    tongueCooldown: 0,
    tongueTimer: 0,
    tongueDirX: 1,
    tongueDirY: 0,
    tongueLength: 0
  };
}

export function spawnNecromancer(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.necromancerHpMin, game.config.enemy.necromancerHpMax);
  return {
    type: "necromancer",
    x,
    y,
    size: 28,
    speed: game.config.enemy.necromancerSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 9999,
    damageMin: game.config.enemy.necromancerDamageMin,
    damageMax: game.config.enemy.necromancerDamageMax,
    isFloorBoss: true,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 1.1 + Math.random() * 1.2,
    summonCooldown: 0,
    castCooldown: 0
  };
}

export function spawnSkeleton(game, x, y, options = {}) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.skeletonHpMin, game.config.enemy.skeletonHpMax);
  return {
    type: "skeleton",
    x,
    y,
    size: 18,
    speed: game.config.enemy.skeletonSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.skeletonDamageMin,
    damageMax: game.config.enemy.skeletonDamageMax,
    summonedByNecromancer: !!options.summonedByNecromancer,
    summonerBoss: !!options.summonerBoss,
    summonLife: Number.isFinite(options.summonLife) ? options.summonLife : null
  };
}

function countSummonedSkeletons(game, enemy) {
  return (game.enemies || []).filter((other) => other && other.type === "skeleton" && other.summonerBoss && other.hp > 0).length;
}

function findSkeletonSummonPoint(game, enemy, angle, distance) {
  const tile = game.config?.map?.tile || 32;
  for (let attempt = 0; attempt < 4; attempt++) {
    const dist = distance + attempt * (tile * 0.35);
    const x = enemy.x + Math.cos(angle) * dist;
    const y = enemy.y + Math.sin(angle) * dist;
    if (!game.isWallAt(x, y, true)) return { x, y };
  }
  return null;
}

export function isGoldDrop(drop) {
  return drop.type === "gold" || drop.type === "gold_bag";
}

export function findNearestGoldDrop(game, x, y) {
  let nearest = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const drop of game.drops) {
    if (!isGoldDrop(drop) || drop.life <= 0) continue;
    const d = vecLength(drop.x - x, drop.y - y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = drop;
    }
  }
  return nearest;
}

export function applyGoblinGrowth(game, goblin, goldAmount) {
  goblin.goldEaten += goldAmount;
  goblin.maxHp = Math.min(48, 2 + Math.floor(goblin.goldEaten * 0.7));
  goblin.hp = Math.min(goblin.maxHp, goblin.hp + 1 + Math.floor(goldAmount * 0.3));
  goblin.speed = Math.min(210, 95 + goblin.goldEaten * 1.5);
  const baseMin = Number.isFinite(goblin.damageMin) ? goblin.damageMin : game.config.enemy.goblinDamageMin;
  const baseMax = Number.isFinite(goblin.damageMax) ? goblin.damageMax : game.config.enemy.goblinDamageMax;
  const growth = Math.floor(goblin.goldEaten / 8);
  goblin.damageMin = Math.min(28, baseMin + growth);
  goblin.damageMax = Math.min(36, baseMax + growth * 2);
  goblin.size = Math.min(30, 16 + Math.floor(goblin.goldEaten / 5));
  goblin.aggression = Math.min(1, 0.12 + goblin.goldEaten / 60);
}

export function updateGoblin(game, enemy, dt, speedScale) {
  const isStrong = enemy.goldEaten >= game.config.enemy.goblinStrongGoldThreshold;
  const toPlayerX = game.player.x - enemy.x;
  const toPlayerY = game.player.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const awayPlayerX = -toPlayerX / playerDist;
  const awayPlayerY = -toPlayerY / playerDist;
  const targetGold = findNearestGoldDrop(game, enemy.x, enemy.y);

  if (targetGold) {
    const toGoldX = targetGold.x - enemy.x;
    const toGoldY = targetGold.y - enemy.y;
    const goldLen = vecLength(toGoldX, toGoldY) || 1;
    let dirX = toGoldX / goldLen;
    let dirY = toGoldY / goldLen;
    if (!isStrong && playerDist < game.config.enemy.goblinFearRadius) {
      dirX = dirX * 0.75 + awayPlayerX * 0.25;
      dirY = dirY * 0.75 + awayPlayerY * 0.25;
    }
    const dirLen = vecLength(dirX, dirY) || 1;
    game.moveWithCollision(enemy, (dirX / dirLen) * enemy.speed * speedScale * dt, (dirY / dirLen) * enemy.speed * speedScale * dt);
    if (goldLen < enemy.size * 0.45 + targetGold.size * 0.75) {
      targetGold.life = 0;
      applyGoblinGrowth(game, enemy, targetGold.amount);
    }
    return;
  }

  if (!isStrong && playerDist < game.config.enemy.goblinFearRadius * 1.2) {
    game.moveWithCollision(enemy, awayPlayerX * enemy.speed * speedScale * dt, awayPlayerY * enemy.speed * speedScale * dt);
    enemy.wanderAngle = Math.atan2(awayPlayerY, awayPlayerX);
    return;
  }

  enemy.wanderTimer -= dt;
  if (enemy.wanderTimer <= 0) {
    enemy.wanderTimer = 0.6 + Math.random() * 1.2;
    enemy.wanderAngle += (Math.random() - 0.5) * 1.8;
  }

  const pursueX = toPlayerX / playerDist;
  const pursueY = toPlayerY / playerDist;
  const wanderX = Math.cos(enemy.wanderAngle);
  const wanderY = Math.sin(enemy.wanderAngle);
  const vx = wanderX * (1 - enemy.aggression) + pursueX * enemy.aggression;
  const vy = wanderY * (1 - enemy.aggression) + pursueY * enemy.aggression;
  const len = vecLength(vx, vy) || 1;
  game.moveWithCollision(enemy, (vx / len) * enemy.speed * speedScale * dt, (vy / len) * enemy.speed * speedScale * dt);
  enemy.wanderAngle = Math.atan2(vy, vx);
}

export function updateMimic(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const wakeRadius = (game.config.enemy.mimicWakeRadiusTiles || 3) * tile;
  const tongueRange = (game.config.enemy.mimicTongueRangeTiles || 2) * tile;
  const tongueCooldownMax = game.config.enemy.mimicTongueCooldown || 1.35;
  const tongueWindup = game.config.enemy.mimicTongueWindup || 0.18;
  const toPlayerX = game.player.x - enemy.x;
  const toPlayerY = game.player.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const seesPlayer = hasLineOfSight(game, enemy.x, enemy.y, game.player.x, game.player.y);

  enemy.tongueCooldown = Math.max(0, (enemy.tongueCooldown || 0) - dt);
  enemy.tongueTimer = Math.max(0, (enemy.tongueTimer || 0) - dt);

  if (enemy.dormant) {
    enemy.tongueLength = 0;
    if (seesPlayer && playerDist <= wakeRadius) {
      enemy.dormant = false;
      enemy.revealed = true;
    }
    return;
  }

  if (!seesPlayer) {
    const dx = enemy.homeX - enemy.x;
    const dy = enemy.homeY - enemy.y;
    const homeDist = vecLength(dx, dy);
    enemy.tongueLength = 0;
    if (homeDist <= 4) {
      enemy.x = enemy.homeX;
      enemy.y = enemy.homeY;
      enemy.dormant = true;
      enemy.revealed = false;
      enemy.tongueCooldown = 0;
      return;
    }
    const len = homeDist || 1;
    game.moveWithCollision(enemy, (dx / len) * enemy.speed * speedScale * dt, (dy / len) * enemy.speed * speedScale * dt);
    return;
  }

  enemy.revealed = true;
  enemy.tongueDirX = toPlayerX / playerDist;
  enemy.tongueDirY = toPlayerY / playerDist;

  if (playerDist <= tongueRange && enemy.tongueCooldown <= 0) {
    enemy.tongueCooldown = tongueCooldownMax;
    enemy.tongueTimer = tongueWindup;
    enemy.tongueLength = Math.min(tongueRange, playerDist);
    if (game.player.hitCooldown <= 0) {
      game.player.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      const reducedByDefense = Math.max(1, Math.round(scaledEnemyDamage - game.getDefenseFlatReduction()));
      const damageTaken = game.getWarriorRageDamageTaken(reducedByDefense);
      game.applyPlayerDamage(damageTaken);
    }
    return;
  }

  if (enemy.tongueTimer > 0) {
    enemy.tongueLength = Math.min(tongueRange, playerDist);
    return;
  }

  enemy.tongueLength = 0;
  if (playerDist > tongueRange * 0.72) game.moveEnemyTowardPlayer(enemy, speedScale, dt);
}

export function updateNecromancer(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const preferredRange = (game.config.enemy.necromancerPreferredRangeTiles || 5) * tile;
  const retreatRange = (game.config.enemy.necromancerRetreatRangeTiles || 3) * tile;
  const castCooldownMax = Math.max(0.3, game.config.enemy.necromancerCastCooldown || 2.2);
  const summonCooldownMax = Math.max(0.8, game.config.enemy.necromancerSummonCooldown || 5.5);
  const summonCap = Math.max(1, Math.floor(game.config.enemy.necromancerSummonCap || 5));
  const summonCount = Math.max(1, Math.floor(game.config.enemy.necromancerSummonCount || 2));
  const toPlayerX = game.player.x - enemy.x;
  const toPlayerY = game.player.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const dirX = toPlayerX / playerDist;
  const dirY = toPlayerY / playerDist;
  const perpX = -dirY;
  const perpY = dirX;
  const moveStep = enemy.speed * (Number.isFinite(speedScale) ? speedScale : 1) * Math.max(0, dt);

  enemy.strafeTimer = Math.max(0, (enemy.strafeTimer || 0) - dt);
  enemy.castCooldown = Math.max(0, (enemy.castCooldown || 0) - dt);
  enemy.summonCooldown = Math.max(0, (enemy.summonCooldown || 0) - dt);
  if (enemy.strafeTimer <= 0) {
    enemy.strafeTimer = 0.8 + Math.random() * 1.4;
    enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }

  if (playerDist < retreatRange) {
    game.moveWithCollision(enemy, -dirX * moveStep, -dirY * moveStep);
    return;
  }

  if (playerDist > preferredRange || !hasLineOfSight(game, enemy.x, enemy.y, game.player.x, game.player.y)) {
    game.moveEnemyTowardPlayer(enemy, speedScale * 0.92, dt);
    return;
  }

  if (enemy.summonCooldown <= 0 && countSummonedSkeletons(game, enemy) < summonCap) {
    const activeCount = countSummonedSkeletons(game, enemy);
    const budget = Math.max(0, summonCap - activeCount);
    const toSpawn = Math.min(summonCount, budget);
    const baseAngle = Math.atan2(dirY, dirX) + Math.PI * 0.5;
    const radius = enemy.size + tile * 0.65;
    let spawned = 0;
    for (let i = 0; i < toSpawn; i++) {
      const offset = (i - (toSpawn - 1) * 0.5) * 0.85;
      const point = findSkeletonSummonPoint(game, enemy, baseAngle + offset, radius);
      if (!point) continue;
      game.enemies.push(
        spawnSkeleton(game, point.x, point.y, {
          summonedByNecromancer: true,
          summonerBoss: true
        })
      );
      spawned += 1;
    }
    if (spawned > 0) {
      enemy.summonCooldown = summonCooldownMax;
      game.spawnFloatingText(enemy.x, enemy.y - enemy.size - 10, `Raise Dead`, "#cfc1ff", 1.1, 14);
    }
  }

  if (enemy.castCooldown <= 0) {
    const baseAngle = Math.atan2(dirY, dirX);
    const spread = ((game.config.enemy.necromancerProjectileSpreadDeg || 16) * Math.PI) / 180;
    const speed = game.config.enemy.necromancerProjectileSpeed || 230;
    const size = game.config.enemy.necromancerProjectileSize || 12;
    const damage = game.config.enemy.necromancerProjectileDamage || 16;
    const life = game.config.enemy.necromancerProjectileLife || 2.8;
    const originDistance = enemy.size * 0.75;
    for (const offset of [-spread, 0, spread]) {
      const angle = baseAngle + offset;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      game.bullets.push({
        x: enemy.x + Math.cos(angle) * originDistance,
        y: enemy.y + Math.sin(angle) * originDistance,
        vx,
        vy,
        angle,
        life,
        size,
        kind: "necroticBolt",
        faction: "enemy",
        damage,
        damageType: "necrotic"
      });
    }
    enemy.castCooldown = castCooldownMax;
    enemy.hpBarTimer = Math.max(enemy.hpBarTimer || 0, game.config.enemy.hpBarDuration);
  }

  const strafeScale = playerDist > preferredRange * 0.7 ? 0.9 : 0.55;
  game.moveWithCollision(enemy, perpX * enemy.strafeDir * moveStep * strafeScale, perpY * enemy.strafeDir * moveStep * strafeScale);
}

export function xpFromEnemy(game, enemy) {
  const baseXp =
    enemy.type === "necromancer"
      ? 90
      : enemy.type === "skeleton"
      ? 10
      : enemy.type === "armor"
      ? 24
      : enemy.type === "mimic"
      ? 18
      : enemy.type === "goblin"
      ? 12 + Math.floor(enemy.goldEaten * 0.6)
      : 6;
  const level = Number.isFinite(game?.level) ? Math.max(1, game.level) : 1;
  const floor = Number.isFinite(game?.floor) ? Math.max(1, game.floor) : 1;
  const ratio = level / floor;

  let mult = 1;
  if (ratio < 1) {
    mult = 0.7 + 0.3 * ratio;
  } else if (ratio <= 3) {
    // Peak in the 1x-3x band, centered around ~2x.
    mult = 1 + 0.18 * (1 - Math.abs(ratio - 2));
  } else if (ratio < 5) {
    // Steep falloff beyond 3x floor level.
    mult = 1 - 0.45 * (ratio - 3);
  } else {
    mult = 0.05;
  }

  const xp = Math.floor(baseXp * Math.max(0, mult));
  return xp;
}

export function maybeSpawnDrop(game, x, y) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  if (Math.random() < game.getGoldDropRate()) {
    const base = game.config.drops.goldMin + Math.floor(Math.random() * (game.config.drops.goldMax - game.config.drops.goldMin + 1));
    game.drops.push({
      type: "gold",
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      size: 10,
      amount: Math.max(1, Math.floor(base * amountMult)),
      life: game.config.drops.life
    });
  }
  if (Math.random() < game.config.drops.rateHealth) {
    game.drops.push({
      type: "health",
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      size: 12,
      amount: game.config.drops.healthRestore,
      life: game.config.drops.life
    });
  }
}

export function dropTreasureBag(game, x, y, goldEaten) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  const bonus = Math.floor((goldEaten / 100) * game.config.drops.treasureBagBonusGold);
  const baseAmount = game.config.drops.treasureBagBaseGold + bonus + Math.floor(Math.random() * 16);
  game.drops.push({
    type: "gold_bag",
    x,
    y,
    size: 16,
    amount: Math.max(1, Math.floor(baseAmount * amountMult)),
    life: game.config.drops.life + 6
  });
}

export function dropArmorLoot(game, x, y) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  const baseAmount = 35 + Math.floor(Math.random() * 36);
  game.drops.push({
    type: "gold_bag",
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    size: 18,
    amount: Math.max(1, Math.floor(baseAmount * amountMult)),
    life: game.config.drops.life + 8
  });
  if (Math.random() < game.config.drops.rateHealth * 1.4) {
    game.drops.push({
      type: "health",
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      size: 12,
      amount: game.config.drops.healthRestore,
      life: game.config.drops.life
    });
  }
}

export function dropNecromancerLoot(game, x, y) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  const c = game.config.enemy;
  const baseAmount =
    Math.min(c.necromancerRewardGoldMin, c.necromancerRewardGoldMax) +
    Math.floor(Math.random() * (Math.abs(c.necromancerRewardGoldMax - c.necromancerRewardGoldMin) + 1));
  game.drops.push({
    type: "gold_bag",
    x,
    y,
    size: 20,
    amount: Math.max(1, Math.floor(baseAmount * amountMult)),
    life: game.config.drops.life + 10
  });
  game.drops.push({
    type: "health",
    x: x + 16,
    y: y - 10,
    size: 12,
    amount: game.config.drops.healthRestore,
    life: game.config.drops.life + 4
  });
}
