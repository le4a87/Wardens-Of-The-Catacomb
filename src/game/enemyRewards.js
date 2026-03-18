export function isGoldDrop(drop) {
  return drop.type === "gold" || drop.type === "gold_bag";
}

export function findNearestGoldDrop(game, x, y) {
  let nearest = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const drop of game.drops) {
    if (!isGoldDrop(drop) || drop.life <= 0) continue;
    const d = Math.hypot(drop.x - x, drop.y - y);
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
  const strongThreshold = Number.isFinite(game?.config?.enemy?.goblinStrongGoldThreshold)
    ? game.config.enemy.goblinStrongGoldThreshold
    : 20;
  goblin.growthStage = goblin.goldEaten >= strongThreshold ? "enraged" : "feeding";
}

export function xpFromEnemy(game, enemy) {
  const baseXp =
    enemy.type === "leprechaun"
      ? 140
      : enemy.type === "necromancer"
      ? 90
      : enemy.type === "minotaur"
      ? 120
      : enemy.type === "skeleton"
      ? 10
      : enemy.type === "prisoner"
      ? 14
      : enemy.type === "rat_archer"
      ? 10
      : enemy.type === "skeleton_warrior"
      ? 8
      : enemy.type === "armor"
      ? 24
      : enemy.type === "mimic"
      ? 18
      : enemy.type === "mummy"
      ? 16
      : enemy.type === "goblin"
      ? 12 + Math.floor(enemy.goldEaten * 0.6)
      : 6;
  const level = Number.isFinite(game?.level) ? Math.max(1, Math.floor(game.level)) : 1;
  const rewardTable = Array.isArray(game?.config?.progression?.xpRewardMultiplierByLevel)
    ? game.config.progression.xpRewardMultiplierByLevel
    : null;
  const tableIndex = Math.max(0, level - 1);
  const levelMultiplier = rewardTable && rewardTable.length > 0
    ? rewardTable[Math.min(tableIndex, rewardTable.length - 1)]
    : 1;
  return Math.max(1, Math.floor(baseXp * Math.max(0.01, levelMultiplier)));
}

export function maybeSpawnDrop(game, x, y) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  const healthAmount = typeof game.getHealthPickupAmount === "function" ? game.getHealthPickupAmount() : 1;
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
  if (Math.random() < game.getHealthDropRate()) {
    game.drops.push({
      type: "health",
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      size: 12,
      amount: healthAmount,
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
  const healthAmount = typeof game.getHealthPickupAmount === "function" ? game.getHealthPickupAmount() : 1;
  const baseAmount = 35 + Math.floor(Math.random() * 36);
  game.drops.push({
    type: "gold_bag",
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    size: 18,
    amount: Math.max(1, Math.floor(baseAmount * amountMult)),
    life: game.config.drops.life + 8
  });
  if (Math.random() < Math.min(0.45, game.getHealthDropRate() * 1.4)) {
    game.drops.push({
      type: "health",
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      size: 12,
      amount: healthAmount,
      life: game.config.drops.life
    });
  }
}

export function dropNecromancerLoot(game, x, y) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  const healthAmount = typeof game.getHealthPickupAmount === "function" ? game.getHealthPickupAmount() : 1;
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
    amount: healthAmount,
    life: game.config.drops.life + 4
  });
}

export function dropMinotaurLoot(game, x, y) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  const healthAmount = typeof game.getHealthPickupAmount === "function" ? game.getHealthPickupAmount() : 1;
  const c = game.config.enemy;
  const baseAmount =
    Math.min(c.minotaurRewardGoldMin, c.minotaurRewardGoldMax) +
    Math.floor(Math.random() * (Math.abs(c.minotaurRewardGoldMax - c.minotaurRewardGoldMin) + 1));
  game.drops.push({
    type: "gold_bag",
    x,
    y,
    size: 22,
    amount: Math.max(1, Math.floor(baseAmount * amountMult)),
    life: game.config.drops.life + 10
  });
  game.drops.push({
    type: "health",
    x: x - 16,
    y: y - 8,
    size: 12,
    amount: healthAmount,
    life: game.config.drops.life + 4
  });
}

export function dropLeprechaunLoot(game, x, y) {
  const amountMult = game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1;
  const c = game.config.enemy;
  const baseAmount =
    Math.min(c.leprechaunRewardGoldMin, c.leprechaunRewardGoldMax) +
    Math.floor(Math.random() * (Math.abs(c.leprechaunRewardGoldMax - c.leprechaunRewardGoldMin) + 1));
  game.drops.push({
    type: "gold_bag",
    x,
    y,
    size: 24,
    amount: Math.max(1, Math.floor(baseAmount * amountMult)),
    life: game.config.drops.life + 16
  });
  for (let i = 0; i < 6; i++) {
    game.drops.push({
      type: "gold",
      x: x + (Math.random() - 0.5) * 34,
      y: y + (Math.random() - 0.5) * 30,
      size: 10,
      amount: 20 + Math.floor(Math.random() * 24),
      life: game.config.drops.life + 10
    });
  }
}
