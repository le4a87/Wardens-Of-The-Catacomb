import { Game } from "../src/Game.js";
import { stepGame } from "../src/game/gameStep.js";
import { createPlayerSnapshot } from "../src/net/playerSnapshotSchema.js";
import { serializeState } from "./net/stateSerialization.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countUpgradeLevels(game) {
  return Object.values(game.upgrades || {}).reduce((sum, upgrade) => sum + (upgrade.level || 0), 0);
}

function countUpgradeLevelsForPlayer(player) {
  return Object.values(player?.upgrades || {}).reduce((sum, upgrade) => sum + (upgrade.level || 0), 0);
}

function countConsumablesForPlayer(player) {
  const inventory = player?.consumables || {};
  return (inventory.activeSlots || []).length + (inventory.passiveSlots || []).length;
}

function createSerializationRoom(sim) {
  return {
    sim,
    idMaps: {},
    idCounters: {},
    getActivePlayerStates() {
      return [];
    },
    syncPrimaryActivePlayerFromSim() {
      return null;
    }
  };
}

function main() {
  const game = new Game(null, { headless: true });
  assert(Array.isArray(game.treasureChests), "treasure chest state should be initialized");
  assert(game.treasureChests.length >= game.config.treasure.minChests, "floor generation should place treasure chests");
  assert(game.treasureChests.every((chest) => chest.type === "treasure_chest" && chest.opened === false && chest.discovered === false), "floor chests should start closed and undiscovered");

  const chest = {
    type: "treasure_chest",
    x: game.player.x,
    y: game.player.y,
    size: 28,
    opened: false,
    lockTextTimer: 0
  };
  game.treasureChests = [chest];
  game.treasureKeys = 0;
  stepGame(game, 0.016, { processUi: false });
  assert(chest.opened === false, "locked chest should not open without a chest key");
  assert(chest.discovered === true, "a chest within exploration range should become discovered");
  assert(game.floatingTexts.some((text) => text.text === "Chest Key Needed"), "locked chest should show key feedback");

  game.drops = [{
    type: "treasure_key",
    x: game.player.x,
    y: game.player.y,
    size: 14,
    amount: 1,
    life: 5
  }];
  stepGame(game, 0.016, { processUi: false });
  assert(game.treasureKeys === 1, "treasure key pickup should increment separate chest key inventory");

  const upgradeLevelsBefore = countUpgradeLevels(game);
  game.updateTreasureChests(0.016);
  assert(chest.opened === true, "chest should open when a player with a chest key touches it");
  assert(game.treasureKeys === 0, "opening a chest should spend one chest key");
  assert(game.drops.some((drop) => drop.type === "gold_bag"), "opened chest should drop gold");
  assert(game.drops.some((drop) => drop.type === "health"), "opened chest should drop a potion pickup");
  assert(countUpgradeLevels(game) === upgradeLevelsBefore + 1, "opened chest should grant one free gear upgrade");
  assert(
    (game.consumables.activeSlots || []).length + (game.consumables.passiveSlots || []).length > 0,
    "opened chest should grant an inventory item"
  );

  game.treasureKeys = 2;
  const playerSnapshot = createPlayerSnapshot({ ...game.player, treasureKeys: game.treasureKeys });
  assert(playerSnapshot.treasureKeys === 2, "player snapshots should carry chest key inventory");
  const networkState = serializeState(createSerializationRoom(game));
  assert(networkState.treasureChests.length === 1 && networkState.treasureChests[0].opened === true && networkState.treasureChests[0].discovered === true, "network state should serialize discovered opened chests");

  const teammateChest = {
    type: "treasure_chest",
    x: game.player.x + game.config.map.tile * 24,
    y: game.player.y,
    size: 28,
    opened: false,
    discovered: false,
    lockTextTimer: 0
  };
  game.treasureChests = [teammateChest];
  game.remotePlayers = [{
    x: teammateChest.x,
    y: teammateChest.y,
    health: 10,
    alive: true
  }];
  game.updateTreasureChests(0.016);
  assert(teammateChest.discovered === true, "a teammate should share treasure chest discovery");
  game.remotePlayers = [];
  const discoveredState = serializeState(createSerializationRoom(game));
  assert(discoveredState.treasureChests.length === 1 && discoveredState.treasureChests[0].discovered === true, "discovered chests should stay serialized outside local active bounds");

  const remotePlayer = {
    id: "remote-owner",
    x: game.player.x + game.config.map.tile * 2,
    y: game.player.y,
    health: 10,
    alive: true,
    treasureKeys: 1,
    consumables: { activeSlots: [], passiveSlots: [], effects: {} },
    upgrades: Object.fromEntries(
      Object.entries(game.upgrades || {}).map(([key, upgrade]) => [key, { ...upgrade, level: 0 }])
    )
  };
  const remoteChest = {
    type: "treasure_chest",
    x: remotePlayer.x,
    y: remotePlayer.y,
    size: 28,
    opened: false,
    discovered: true,
    lockTextTimer: 0
  };
  game.treasureChests = [remoteChest];
  game.treasureKeys = 2;
  game.consumables = { activeSlots: [], passiveSlots: [], effects: {} };
  for (const upgrade of Object.values(game.upgrades || {})) upgrade.level = 0;
  game.remotePlayers = [remotePlayer];
  game.updateTreasureChests(0.016);
  assert(remoteChest.opened === true, "remote player should be able to open a treasure chest");
  assert(remotePlayer.treasureKeys === 0, "remote chest open should spend the remote player's key");
  assert(game.treasureKeys === 2, "remote chest open should not spend the primary player's key");
  assert(countConsumablesForPlayer(remotePlayer) > 0, "remote chest open should grant the remote player's inventory item");
  assert(countConsumablesForPlayer(game) === 0, "remote chest open should not mutate the primary player's inventory");
  assert(countUpgradeLevelsForPlayer(remotePlayer) === 1, "remote chest open should grant the remote player's gear upgrade");
  assert(countUpgradeLevels(game) === 0, "remote chest open should not mutate primary player upgrades");

  const remoteKeyCollector = {
    x: game.player.x + game.config.map.tile * 3,
    y: game.player.y,
    health: 10,
    alive: true,
    treasureKeys: 0
  };
  game.remotePlayers = [remoteKeyCollector];
  game.treasureKeys = 3;
  game.drops = [{
    type: "treasure_key",
    x: remoteKeyCollector.x,
    y: remoteKeyCollector.y,
    size: 14,
    amount: 1,
    life: 5
  }];
  stepGame(game, 0.016, { processUi: false });
  assert(remoteKeyCollector.treasureKeys === 1, "remote key pickup should increment remote chest key inventory");
  assert(game.treasureKeys === 3, "remote key pickup should not mutate primary player chest keys");
  assert(game.drops.every((drop) => drop.type !== "treasure_key" || drop.life <= 0), "remote key pickup should consume the key drop");

  console.log("Treasure chest validation passed.");
}

main();
