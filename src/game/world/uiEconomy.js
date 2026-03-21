export function getEnemySpawnInterval(game) {
  const c = game.config.enemy;
  const base = Number.isFinite(c.spawnIntervalStart) ? c.spawnIntervalStart : 2.6;
  const min = Number.isFinite(c.spawnIntervalMin) ? c.spawnIntervalMin : 0.55;
  const mult = game.getEnemySpawnRateScale();
  const denom = Number.isFinite(mult) ? mult : 1;
  return Math.max(min, base / Math.max(0.05, denom));
}

export function getMoveSpeedMultiplier(game) {
  return 1 + game.upgrades.moveSpeed.level * 0.05;
}

export function getGoldFindMultiplier(game) {
  const levelScale = 1 + Math.max(0, game.level - 1) * 0.05;
  const floorScale = 1 + Math.max(0, game.floor - 1) * 0.08;
  return levelScale * floorScale;
}

export function getGoldDropRate(game) {
  const base = game.config.drops.rateGold;
  const levelBonus = (game.level - 1) * 0.008;
  const floorBonus = (game.floor - 1) * 0.012;
  return Math.min(0.7, base + levelBonus + floorBonus);
}

export function getHealthDropRate(game) {
  const base = Number.isFinite(game.config.drops.rateHealth) ? game.config.drops.rateHealth : 0.05;
  const levelBonus = Math.max(0, game.level - 1) * 0.004;
  const floorBonus = Math.max(0, game.floor - 1) * 0.008;
  return Math.min(0.28, base + levelBonus + floorBonus);
}

export function getGoldDropAmountMultiplier(game) {
  const levelScale = 1 + (game.level - 1) * 0.09;
  const floorScale = 1 + (game.floor - 1) * 0.12;
  return levelScale * floorScale;
}

export function getAttackSpeedMultiplier(game) {
  return 1 + game.upgrades.attackSpeed.level * 0.06;
}

export function getDamageMultiplier(game) {
  const lvl = Number.isFinite(game.upgrades.damage.level) ? game.upgrades.damage.level : 0;
  return 1 + lvl * 0.08;
}

export function getDefenseFlatReduction(game) {
  const base = Number.isFinite(game.classSpec.baseDefenseFlat) ? game.classSpec.baseDefenseFlat : 0;
  const levelBonus = Number.isFinite(game.classSpec.levelDefenseFlatGain) ? Math.max(0, game.classSpec.levelDefenseFlatGain) * Math.max(0, game.level - 1) : 0;
  return base + levelBonus + game.upgrades.defense.level * 1.5;
}

export function getUpgradeCost(game, upgradeKey) {
  const upgrade = game.upgrades[upgradeKey];
  if (!upgrade) return Number.POSITIVE_INFINITY;
  if (upgrade.level >= upgrade.maxLevel) return Number.POSITIVE_INFINITY;
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScale, upgrade.level));
}

export function canBuyUpgrade(game, upgradeKey) {
  const upgrade = game.upgrades[upgradeKey];
  if (!upgrade || upgrade.level >= upgrade.maxLevel) return false;
  return game.gold >= getUpgradeCost(game, upgradeKey);
}

export function buyUpgrade(game, upgradeKey) {
  if (!canBuyUpgrade(game, upgradeKey)) return false;
  const cost = getUpgradeCost(game, upgradeKey);
  game.gold -= cost;
  game.upgrades[upgradeKey].level += 1;
  return true;
}

export function toggleShop(game, open) {
  if (game.gameOver) return;
  game.shopOpen = typeof open === "boolean" ? open : !game.shopOpen;
  if (game.shopOpen) game.paused = false;
  if (typeof game.onPauseChanged === "function") game.onPauseChanged(game.paused, game);
  if (game.shopOpen) game.skillTreeOpen = false;
  if (game.shopOpen) game.statsPanelOpen = false;
  if (game.shopOpen && game.input) {
    game.input.mouse.leftDown = false;
    game.input.mouse.leftQueued = false;
  }
}

export function toggleSkillTree(game, open) {
  if (game.gameOver) return;
  game.skillTreeOpen = typeof open === "boolean" ? open : !game.skillTreeOpen;
  if (game.skillTreeOpen) game.paused = false;
  if (typeof game.onPauseChanged === "function") game.onPauseChanged(game.paused, game);
  if (game.skillTreeOpen) game.shopOpen = false;
  if (game.skillTreeOpen) game.statsPanelOpen = false;
  if (game.skillTreeOpen && game.input) {
    game.input.mouse.leftDown = false;
    game.input.mouse.leftQueued = false;
  }
}

export function pointInRect(_game, x, y, rect) {
  if (!rect) return false;
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

export function handleUiClicks(game) {
  if (!game.input) return;
  const wheelDelta = game.input.consumeWheelDelta ? game.input.consumeWheelDelta() : 0;
  if (wheelDelta !== 0 && (game.skillTreeOpen || game.shopOpen)) {
    const target = game.skillTreeOpen
      ? { area: game.uiRects.skillTreeScrollArea, max: game.uiRects.skillTreeScrollMax, key: "skillTree" }
      : { area: game.uiRects.shopScrollArea, max: game.uiRects.shopScrollMax, key: "shop" };
    const max = Number.isFinite(target.max) ? target.max : 0;
    const step = Math.sign(wheelDelta) * Math.max(36, Math.abs(wheelDelta));
    const next = (game.uiScroll?.[target.key] || 0) + step;
    game.uiScroll[target.key] = Math.max(0, Math.min(max, next));
  }
  if (game.input.consumeKeyQueued("escape")) {
    if (game.gameOver) {
      if (game.onReturnToMenu) game.onReturnToMenu();
    } else if (game.shopOpen) toggleShop(game, false);
    else if (game.skillTreeOpen) toggleSkillTree(game, false);
    else {
      game.paused = !game.paused;
      if (typeof game.onPauseChanged === "function") game.onPauseChanged(game.paused, game);
    }
  }
  const clicks = game.input.consumeUiLeftClicks();
  if (clicks.length === 0) return;

  for (const click of clicks) {
    if (pointInRect(game, click.x, click.y, game.uiRects.shopButton)) {
      toggleShop(game);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillTreeButton)) {
      toggleSkillTree(game);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.statsButton)) {
      game.statsPanelOpen = !game.statsPanelOpen;
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.statsClose)) {
      game.statsPanelOpen = false;
      continue;
    }
    if (!game.shopOpen && !game.skillTreeOpen) continue;
    if (pointInRect(game, click.x, click.y, game.uiRects.shopClose)) {
      toggleShop(game, false);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillTreeClose)) {
      toggleSkillTree(game, false);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillFireArrowNode)) {
      game.spendSkillPoint("fireArrow");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillPiercingNode)) {
      game.spendSkillPoint("piercingStrike");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillMultiarrowNode)) {
      game.spendSkillPoint("multiarrow");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillWarriorMomentumNode)) {
      game.spendSkillPoint("warriorMomentum");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillWarriorRageNode)) {
      game.spendSkillPoint("warriorRage");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillWarriorExecuteNode)) {
      game.spendSkillPoint("warriorExecute");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillUndeadMasteryNode)) {
      game.spendSkillPoint("undeadMastery");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillDeathBoltNode)) {
      game.spendSkillPoint("deathBolt");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillExplodingDeathNode)) {
      game.spendSkillPoint("explodingDeath");
      continue;
    }
    const itemRects = game.uiRects.shopItems || [];
    for (const item of itemRects) {
      if (pointInRect(game, click.x, click.y, item.rect)) {
        buyUpgrade(game, item.key);
        break;
      }
    }
  }
}

