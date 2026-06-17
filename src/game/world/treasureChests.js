import {
  ACTIVE_CONSUMABLE_SLOT_CAP,
  PASSIVE_CONSUMABLE_SLOT_CAP,
  getConsumableCatalog
} from "../consumables.js";
import { vecLength } from "../../utils.js";

const CHEST_SIZE = 28;

function getConfig(game) {
  return game.config?.treasure || {};
}

function getPlayerCollectionState(game, player, key) {
  if (typeof game.isPrimaryPlayerEntity === "function" && game.isPrimaryPlayerEntity(player)) return game[key];
  return player?.[key];
}

function setPlayerCollectionState(game, player, key, value) {
  if (typeof game.setPlayerProgressField === "function") {
    game.setPlayerProgressField(player, key, value);
    return;
  }
  if (player === game.player) game[key] = value;
  else if (player) player[key] = value;
}

function getPlayerInventory(game, player) {
  if (typeof game.isPrimaryPlayerEntity === "function" && game.isPrimaryPlayerEntity(player)) return game.consumables;
  return player?.consumables;
}

function getPlayerUpgrades(game, player) {
  if (typeof game.isPrimaryPlayerEntity === "function" && game.isPrimaryPlayerEntity(player)) return game.upgrades;
  return player?.upgrades;
}

function addConsumableToPlayer(game, player, def) {
  const inventory = getPlayerInventory(game, player);
  if (!def || !inventory || typeof inventory !== "object") return false;
  const slotKey = def.type === "Passive" ? "passiveSlots" : "activeSlots";
  if (!Array.isArray(inventory[slotKey])) inventory[slotKey] = [];
  const slots = inventory[slotKey];
  const slotCap = def.type === "Passive" ? PASSIVE_CONSUMABLE_SLOT_CAP : ACTIVE_CONSUMABLE_SLOT_CAP;
  let slot = slots.find((entry) => entry?.key === def.key) || null;
  if (!slot) {
    if (slots.length >= slotCap) return false;
    slot = { key: def.key, count: 0, cooldownRemaining: 0 };
    slots.push(slot);
  }
  if ((slot.count || 0) >= def.maxStack) return false;
  slot.count = Math.min(def.maxStack, (slot.count || 0) + 1);
  return true;
}

function rollChestConsumable(game, player) {
  const catalog = getConsumableCatalog().filter((def) => def.unlockFloor <= Math.max(1, game.floor || 1));
  for (let attempts = 0; attempts < Math.max(6, catalog.length * 2); attempts++) {
    const def = catalog[Math.floor(Math.random() * catalog.length)] || null;
    if (addConsumableToPlayer(game, player, def)) return def;
  }
  return null;
}

function grantChestUpgrade(game, player) {
  const upgrades = getPlayerUpgrades(game, player);
  const available = Object.values(upgrades || {}).filter((upgrade) =>
    upgrade && Number.isFinite(upgrade.level) && Number.isFinite(upgrade.maxLevel) && upgrade.level < upgrade.maxLevel
  );
  const upgrade = available[Math.floor(Math.random() * available.length)] || null;
  if (!upgrade) return null;
  upgrade.level += 1;
  return upgrade;
}

function addChestGold(game, chest) {
  const cfg = getConfig(game);
  const min = Number.isFinite(cfg.goldMin) ? Math.floor(cfg.goldMin) : 38;
  const max = Number.isFinite(cfg.goldMax) ? Math.floor(cfg.goldMax) : 74;
  const base = Math.min(min, max) + Math.floor(Math.random() * (Math.abs(max - min) + 1));
  game.drops.push({
    type: "gold_bag",
    x: chest.x,
    y: chest.y + 7,
    size: 18,
    amount: Math.max(1, Math.floor(base * (game.getGoldDropAmountMultiplier ? game.getGoldDropAmountMultiplier() : 1))),
    life: game.config.drops.life + 8
  });
}

function addChestPotion(game, chest) {
  const amount = typeof game.getHealthPickupAmount === "function" ? game.getHealthPickupAmount() : 1;
  game.drops.push({
    type: "health",
    x: chest.x - 13,
    y: chest.y - 8,
    size: 12,
    amount,
    life: game.config.drops.life + 4
  });
}

function openChest(game, chest, player) {
  const keys = Math.max(0, Math.floor(getPlayerCollectionState(game, player, "treasureKeys") || 0));
  if (keys <= 0) return false;
  setPlayerCollectionState(game, player, "treasureKeys", keys - 1);
  chest.opened = true;
  chest.openedAt = Number.isFinite(game.time) ? game.time : 0;
  addChestGold(game, chest);
  addChestPotion(game, chest);
  const consumable = rollChestConsumable(game, player);
  const upgrade = grantChestUpgrade(game, player);
  if (typeof game.spawnFloatingText === "function") {
    game.spawnFloatingText(chest.x, chest.y - 30, "Treasure Opened", "#f0cf72", 1.0, 15);
    if (consumable) game.spawnFloatingText(player.x, player.y - 42, consumable.name, "#d7e4ff", 0.9, 13);
    if (upgrade) game.spawnFloatingText(player.x, player.y - 58, `${upgrade.label} Gear`, "#9be18a", 0.95, 13);
  }
  if (!consumable && typeof game.awardGoldToPlayerEntity === "function") game.awardGoldToPlayerEntity(player, 20);
  return true;
}

function isReserved(game, x, y, tile) {
  const reserved = [game.player, game.door, game.pickup, game.portal].filter(Boolean);
  if (reserved.some((entry) => vecLength((entry.x || 0) - x, (entry.y || 0) - y) < tile * 2.5)) return true;
  if ((game.breakables || []).some((entry) => vecLength(entry.x - x, entry.y - y) < tile * 1.2)) return true;
  if ((game.armorStands || []).some((entry) => vecLength(entry.x - x, entry.y - y) < tile * 1.2)) return true;
  return (game.treasureChests || []).some((entry) => vecLength(entry.x - x, entry.y - y) < tile * 4);
}

function isChestInPlayerExploreRadius(game, chest, player) {
  const tile = game.config.map.tile;
  const radius = Number.isFinite(game.config.map.exploreRadiusTiles) ? game.config.map.exploreRadiusTiles : 4;
  const chestTileX = Math.floor(chest.x / tile);
  const chestTileY = Math.floor(chest.y / tile);
  const playerTileX = Math.floor((player?.x || 0) / tile);
  const playerTileY = Math.floor((player?.y || 0) / tile);
  return vecLength(chestTileX - playerTileX, chestTileY - playerTileY) <= radius + 0.25;
}

export function placeTreasureChests(game) {
  const cfg = getConfig(game);
  const tile = game.config.map.tile;
  const floorArea = (game.map?.length || 0) * (game.map?.[0]?.length || 0);
  const minCount = Number.isFinite(cfg.minChests) ? Math.max(0, Math.floor(cfg.minChests)) : 1;
  const maxCount = Number.isFinite(cfg.maxChests) ? Math.max(minCount, Math.floor(cfg.maxChests)) : 3;
  const factor = Number.isFinite(cfg.chestCountFactor) ? Math.max(1, cfg.chestCountFactor) : 4200;
  const target = Math.min(maxCount, Math.max(minCount, Math.round(floorArea / factor)));
  const minPlayerDistance = (Number.isFinite(cfg.minPlacementDistanceFromPlayerTiles) ? cfg.minPlacementDistanceFromPlayerTiles : 7) * tile;
  let attempts = Math.max(120, target * 160);
  while ((game.treasureChests || []).length < target && attempts-- > 0) {
    const tx = 2 + Math.floor(Math.random() * Math.max(1, (game.map?.[0]?.length || 4) - 4));
    const ty = 2 + Math.floor(Math.random() * Math.max(1, (game.map?.length || 4) - 4));
    if (game.map?.[ty]?.[tx] !== ".") continue;
    const x = tx * tile + tile * 0.5;
    const y = ty * tile + tile * 0.5;
    if (vecLength((game.player?.x || 0) - x, (game.player?.y || 0) - y) < minPlayerDistance) continue;
    if (isReserved(game, x, y, tile)) continue;
    game.treasureChests.push({ type: "treasure_chest", x, y, size: CHEST_SIZE, opened: false, discovered: false, lockTextTimer: 0 });
  }
  return game.treasureChests.length;
}

export function maybeSpawnTreasureKeyDrop(game, x, y) {
  const cfg = getConfig(game);
  const rate = Number.isFinite(cfg.keyDropRate) ? Math.max(0, cfg.keyDropRate) : 0;
  const maxDrops = Number.isFinite(cfg.keyMaxDropsPerFloor) ? Math.max(0, Math.floor(cfg.keyMaxDropsPerFloor)) : 3;
  if (rate <= 0 || (game.treasureKeyDropsThisFloor || 0) >= maxDrops || Math.random() >= rate) return false;
  game.treasureKeyDropsThisFloor = (game.treasureKeyDropsThisFloor || 0) + 1;
  game.drops.push({
    type: "treasure_key",
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    size: 14,
    amount: 1,
    life: game.config.drops.life + 10
  });
  return true;
}

export function collectTreasureKey(game, player, drop) {
  const amount = Math.max(1, Math.floor(drop?.amount || 1));
  const keys = Math.max(0, Math.floor(getPlayerCollectionState(game, player, "treasureKeys") || 0));
  setPlayerCollectionState(game, player, "treasureKeys", keys + amount);
  if (typeof game.spawnFloatingText === "function") {
    game.spawnFloatingText(player.x, player.y - 34, amount === 1 ? "Chest Key" : `Chest Keys +${amount}`, "#f0cf72", 0.9, 14);
  }
}

export function updateTreasureChests(game, dt = 0) {
  const players = typeof game.getLivingPlayerEntities === "function" ? game.getLivingPlayerEntities() : [game.player];
  for (const chest of game.treasureChests || []) {
    chest.lockTextTimer = Math.max(0, (chest.lockTextTimer || 0) - dt);
    if (!chest.discovered) chest.discovered = players.some((player) => player && isChestInPlayerExploreRadius(game, chest, player));
    if (chest.opened) continue;
    for (const player of players) {
      if (!player) continue;
      const radius = (chest.size || CHEST_SIZE) * 0.5 + (typeof game.getPickupRadius === "function" ? game.getPickupRadius() : 18);
      if (vecLength((player.x || 0) - chest.x, (player.y || 0) - chest.y) > radius) continue;
      if (openChest(game, chest, player)) break;
      if ((chest.lockTextTimer || 0) <= 0 && typeof game.spawnFloatingText === "function") {
        game.spawnFloatingText(chest.x, chest.y - 28, "Chest Key Needed", "#bcc7d9", 0.75, 13);
        chest.lockTextTimer = 1.2;
      }
      break;
    }
  }
}
