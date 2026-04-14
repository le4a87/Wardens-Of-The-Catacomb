import {
  canSpendRangerUtility,
  getRangerDanceAttackSpeedBonus,
  getRangerDanceDefenseBonus,
  getRangerDamageBonus,
  getRangerMoveSpeedBonus,
  isRangerTalentGame
} from "../rangerTalentTree.js";
import {
  canSpendWarriorUtility,
  getWarriorBloodheatAttackSpeedBonus,
  getWarriorIronGuardDefenseBonusPct,
  isWarriorTalentGame
} from "../warriorTalentTree.js";
import { isNecromancerTalentGame } from "../necromancerTalentTree.js";
import {
  ACTIVE_CONSUMABLE_SLOT_CAP,
  getConsumableDefinition,
  getConsumablePriceForFloor
} from "../consumables.js";
import {
  applyConsumableOnHitEffects,
  applyPassiveConsumableEvent,
  buyShopItem,
  getConsumableBonusDamage,
  getConsumableOwnedCount,
  getShopFailureReason,
  pushConsumableMessage,
  refillShopForFloor,
  tickConsumables,
  useConsumableSlot,
  ensureShopStock
} from "./consumablesEconomy.js";

export {
  applyConsumableOnHitEffects,
  applyPassiveConsumableEvent,
  buyShopItem,
  getConsumableBonusDamage,
  getConsumableOwnedCount,
  getShopFailureReason,
  pushConsumableMessage,
  refillShopForFloor,
  tickConsumables,
  useConsumableSlot
} from "./consumablesEconomy.js";

function isActiveMultiplayer(game) {
  return !!game?.networkEnabled && game.networkRoomPhase === "active";
}

export function getEnemySpawnInterval(game) {
  const c = game.config.enemy;
  const base = Number.isFinite(c.spawnIntervalStart) ? c.spawnIntervalStart : 2.6;
  const min = Number.isFinite(c.spawnIntervalMin) ? c.spawnIntervalMin : 0.55;
  const mult = game.getEnemySpawnRateScale();
  const denom = Number.isFinite(mult) ? mult : 1;
  return Math.max(min, base / Math.max(0.05, denom));
}

export function getMoveSpeedMultiplier(game) {
  const upgradeBonus = 1 + game.upgrades.moveSpeed.level * 0.05;
  let result = upgradeBonus;
  if (isRangerTalentGame(game)) result *= 1 + getRangerMoveSpeedBonus(game);
  if ((game.consumables?.effects?.speedPotion?.timer || 0) > 0) result *= 1.2;
  return result;
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
  const base = 1 + game.upgrades.attackSpeed.level * 0.06;
  if (isRangerTalentGame(game)) return base * (1 + getRangerDanceAttackSpeedBonus(game));
  if (isWarriorTalentGame(game)) return base * (1 + getWarriorBloodheatAttackSpeedBonus(game));
  return base;
}

export function getDamageMultiplier(game) {
  const lvl = Number.isFinite(game.upgrades.damage.level) ? game.upgrades.damage.level : 0;
  const base = 1 + lvl * 0.08;
  if (isRangerTalentGame(game)) return base * (1 + getRangerDamageBonus(game));
  return base;
}

export function getDefenseFlatReduction(game) {
  const base = Number.isFinite(game.classSpec.baseDefenseFlat) ? game.classSpec.baseDefenseFlat : 0;
  const levelBonus = Number.isFinite(game.classSpec.levelDefenseFlatGain) ? Math.max(0, game.classSpec.levelDefenseFlatGain) * Math.max(0, game.level - 1) : 0;
  const reduction = base + levelBonus + game.upgrades.defense.level * 1.5;
  if (isRangerTalentGame(game)) return reduction * (1 + getRangerDanceDefenseBonus(game));
  if (isWarriorTalentGame(game)) return reduction * (1 + getWarriorIronGuardDefenseBonusPct(game));
  return reduction;
}

export function getUpgradeCost(game, upgradeKey) {
  const upgrade = game.upgrades[upgradeKey];
  if (!upgrade) return Number.POSITIVE_INFINITY;
  if (upgrade.level >= upgrade.maxLevel) return Number.POSITIVE_INFINITY;
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScale, upgrade.level));
}

export function canBuyUpgrade(game, upgradeKey) {
  if ((isRangerTalentGame(game) || isWarriorTalentGame(game) || isNecromancerTalentGame(game)) && ["moveSpeed", "attackSpeed", "damage", "defense"].includes(upgradeKey)) return false;
  const upgrade = game.upgrades[upgradeKey];
  if (!upgrade || upgrade.level >= upgrade.maxLevel) return false;
  return game.gold >= getUpgradeCost(game, upgradeKey);
}

export function buyUpgrade(game, upgradeKey) {
  if (getConsumableDefinition(upgradeKey)) return buyShopItem(game, upgradeKey);
  if (!canBuyUpgrade(game, upgradeKey)) return false;
  const cost = getUpgradeCost(game, upgradeKey);
  game.gold -= cost;
  if (typeof game.recordRunGoldSpent === "function") game.recordRunGoldSpent(cost);
  game.upgrades[upgradeKey].level += 1;
  return true;
}

export function getShopItems(game) {
  const stock = ensureShopStock(game);
  const rarityOrder = { Common: 0, Rare: 1, Legendary: 2 };
  return stock
    .map((entry) => {
      const def = getConsumableDefinition(entry?.key);
      if (!def) return null;
      return {
        ...def,
        stock: Number.isFinite(entry?.stock) ? Math.max(0, Math.floor(entry.stock)) : 0,
        priceForFloor: getConsumablePriceForFloor(def, Math.max(1, Math.floor(game?.floor || 1)))
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const rarityDelta = (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99);
      if (rarityDelta !== 0) return rarityDelta;
      const priceDelta = (a.priceForFloor || 0) - (b.priceForFloor || 0);
      if (priceDelta !== 0) return priceDelta;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

export function toggleShop(game, open) {
  if (game.gameOver || (Number.isFinite(game?.player?.health) && game.player.health <= 0)) return;
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
  if (game.gameOver || (Number.isFinite(game?.player?.health) && game.player.health <= 0)) return;
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

export function toggleStatsPanel(game, open) {
  const nextOpen = typeof open === "boolean" ? open : !game.statsPanelOpen;
  if (nextOpen === game.statsPanelOpen) return;
  if (isActiveMultiplayer(game)) {
    game.statsPanelOpen = nextOpen;
    game.statsPanelPausedGame = false;
    if (nextOpen) {
      game.shopOpen = false;
      game.skillTreeOpen = false;
    }
    if (game.input) {
      game.input.mouse.leftDown = false;
      game.input.mouse.leftQueued = false;
    }
    return;
  }
  if (nextOpen) {
    game.statsPanelPausedGame = !game.paused && !game.gameOver;
    game.statsPanelOpen = true;
    if (!game.gameOver) {
      game.paused = true;
      game.shopOpen = false;
      game.skillTreeOpen = false;
    }
  } else {
    game.statsPanelOpen = false;
    if (game.statsPanelPausedGame) game.paused = false;
    game.statsPanelPausedGame = false;
  }
  if (typeof game.onPauseChanged === "function") game.onPauseChanged(game.paused, game);
  if (game.input) {
    game.input.mouse.leftDown = false;
    game.input.mouse.leftQueued = false;
  }
}

export function setStatsPanelView(game, view) {
  if (view !== "run" && view !== "character") return false;
  game.statsPanelView = view;
  return true;
}

export function pointInRect(_game, x, y, rect) {
  if (!rect) return false;
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

export function handleUiClicks(game) {
  if (!game.input) return;
  const playerAlive = !(Number.isFinite(game?.player?.health) && game.player.health <= 0);
  if (playerAlive && !game.gameOver && !game.shopOpen && !game.skillTreeOpen) {
    for (let i = 0; i < ACTIVE_CONSUMABLE_SLOT_CAP; i++) {
      if (game.input.consumeKeyQueued(`${i + 1}`) && typeof game.useConsumableSlot === "function") {
        game.useConsumableSlot(i);
      }
    }
  }
  const wheelDelta = game.input.consumeWheelDelta ? game.input.consumeWheelDelta() : 0;
  if (playerAlive && wheelDelta !== 0 && (game.skillTreeOpen || game.shopOpen)) {
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
      if (game.statsPanelOpen && typeof game.onDeathStatsBackToLeaderboard === "function") game.onDeathStatsBackToLeaderboard();
      else if (game.onReturnToMenu) game.onReturnToMenu();
    } else if (game.shopOpen) toggleShop(game, false);
    else if (game.skillTreeOpen) toggleSkillTree(game, false);
    else if (game.statsPanelOpen) toggleStatsPanel(game, false);
    else {
      game.paused = !game.paused;
      if (typeof game.onPauseChanged === "function") game.onPauseChanged(game.paused, game);
    }
  }
  if (playerAlive && game.input.consumeKeyQueued("b") && !game.gameOver) {
    toggleShop(game);
  }
  if (playerAlive && game.input.consumeKeyQueued("k") && !game.gameOver) {
    toggleSkillTree(game);
  }
  if (game.input.consumeKeyQueued("c") && !game.gameOver) {
    toggleStatsPanel(game);
  }
  const clicks = game.input.consumeUiLeftClicks();
  if (clicks.length === 0) return;

  for (const click of clicks) {
    if (pointInRect(game, click.x, click.y, game.uiRects.shopButton)) {
      if (!playerAlive) continue;
      toggleShop(game);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.skillTreeButton)) {
      if (!playerAlive) continue;
      toggleSkillTree(game);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.statsButton)) {
      if (game.gameOver && game.statsPanelOpen && typeof game.onDeathStatsBackToLeaderboard === "function") game.onDeathStatsBackToLeaderboard();
      else toggleStatsPanel(game);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.gameOverLeaderboardButton)) {
      if (typeof game.onDeathStatsBackToLeaderboard === "function") game.onDeathStatsBackToLeaderboard();
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.gameOverMenuButton)) {
      if (game.onReturnToMenu) game.onReturnToMenu();
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.statsClose)) {
      if (game.gameOver && typeof game.onDeathStatsBackToLeaderboard === "function") game.onDeathStatsBackToLeaderboard();
      else toggleStatsPanel(game, false);
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.statsRunTab)) {
      setStatsPanelView(game, "run");
      continue;
    }
    if (pointInRect(game, click.x, click.y, game.uiRects.statsCharacterTab)) {
      setStatsPanelView(game, "character");
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
    if (!playerAlive) continue;
    const skillNodeRects = Array.isArray(game.uiRects.skillTreeNodes) ? game.uiRects.skillTreeNodes : [];
    let handledSkillNode = false;
    for (const node of skillNodeRects) {
      if (!pointInRect(game, click.x, click.y, node.rect)) continue;
      game.spendSkillPoint(node.key);
      handledSkillNode = true;
      break;
    }
    if (handledSkillNode) continue;
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
        buyShopItem(game, item.key);
        break;
      }
    }
  }
}

