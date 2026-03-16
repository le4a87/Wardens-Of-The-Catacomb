import { Game } from "../src/Game.js";
import { GameSim } from "../src/sim/GameSim.js";
import { stepGame } from "../src/game/gameStep.js";
import { serializeState } from "./net/stateSerialization.js";
import { buildJoinKeyframeState } from "./net/deltaProtocol.js";
import { applySnapshotToGame } from "../src/net/clientStateSync.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeRoom(sim) {
  return {
    sim,
    idCounters: {
      enemy: 1,
      drop: 1,
      bullet: 1,
      fireArrow: 1,
      fireZone: 1,
      meleeSwing: 1,
      armorStand: 1,
      floatingText: 1,
      breakable: 1
    },
    idMaps: {
      enemy: new WeakMap(),
      drop: new WeakMap(),
      bullet: new WeakMap(),
      fireArrow: new WeakMap(),
      fireZone: new WeakMap(),
      meleeSwing: new WeakMap(),
      armorStand: new WeakMap(),
      floatingText: new WeakMap(),
      breakable: new WeakMap()
    }
  };
}

function killFloorBoss(game) {
  const boss = game.enemies.find((enemy) => enemy.type === "necromancer" && enemy.isFloorBoss);
  assert(boss, "expected floor boss to exist");
  boss.hp = 0;
  stepGame(game, 0.016, { processUi: false });
}

function validateTriggerLevels() {
  const floors = [];
  for (const floor of [1, 2, 3]) {
    const game = new GameSim({ classType: "archer", viewportWidth: 960, viewportHeight: 640 });
    while (game.floor < floor) game.advanceToNextFloor();
    const triggerLevel = game.getFloorBossTriggerLevel();
    assert(triggerLevel === floor * 5, `floor ${floor} trigger expected ${floor * 5}, got ${triggerLevel}`);
    game.level = triggerLevel - 1;
    assert(game.updateFloorBossTrigger() === false, `floor ${floor} triggered early`);
    game.level = triggerLevel;
    assert(game.updateFloorBossTrigger() === true, `floor ${floor} did not trigger on threshold`);
    assert(game.floorBoss.phase === "queued", `floor ${floor} phase expected queued, got ${game.floorBoss.phase}`);
    floors.push({ floor, triggerLevel });
  }
  return floors;
}

function validateLocalProgression() {
  const game = new GameSim({ classType: "archer", viewportWidth: 960, viewportHeight: 640 });
  const startingFloor = game.floor;

  game.player.x = game.door.x;
  game.player.y = game.door.y;
  stepGame(game, 0.016, { processUi: false });
  assert(game.floor === startingFloor, "legacy door advanced floor before boss defeat");
  assert(!game.portal.active, "portal active before boss defeat");

  game.level = game.getFloorBossTriggerLevel();
  assert(game.updateFloorBossTrigger() === true, "boss did not queue locally");
  const boss = game.spawnNecromancer(game.player.x + 96, game.player.y);
  game.enemies.push(boss);
  game.markFloorBossActive();
  killFloorBoss(game);
  assert(game.portal.active, "portal did not spawn after local boss defeat");
  assert(game.floorBoss.phase === "portal", `expected portal phase, got ${game.floorBoss.phase}`);

  game.player.x = game.portal.x;
  game.player.y = game.portal.y;
  stepGame(game, 0.016, { processUi: false });
  assert(game.floor === startingFloor + 1, "portal did not advance local floor");
  assert(game.floorBoss.floor === game.floor, "floor boss state did not reset with new floor");
  assert(game.portal.active === false, "portal remained active after floor transition");

  return {
    startingFloor,
    nextFloor: game.floor
  };
}

function validateNetworkReconciliation() {
  const sim = new GameSim({ classType: "archer", viewportWidth: 960, viewportHeight: 640 });
  sim.level = sim.getFloorBossTriggerLevel();
  assert(sim.updateFloorBossTrigger() === true, "network sim boss did not queue");
  const boss = sim.spawnNecromancer(sim.player.x + 96, sim.player.y);
  sim.enemies.push(boss);
  sim.markFloorBossActive();

  const room = makeRoom(sim);
  const client = new Game(null, { headless: true });
  const joinState = buildJoinKeyframeState(serializeState(room));
  applySnapshotToGame({ game: client, state: joinState, controller: false });
  assert(client.floorBoss?.phase === "active", `join phase expected active, got ${client.floorBoss?.phase}`);
  assert(client.enemies.some((enemy) => enemy.type === "necromancer" && enemy.isFloorBoss), "joining client missed boss");

  killFloorBoss(sim);
  applySnapshotToGame({ game: client, state: serializeState(room), controller: false });
  assert(client.portal?.active, "joining client missed portal activation");
  assert(client.floorBoss?.phase === "portal", `client phase expected portal, got ${client.floorBoss?.phase}`);

  sim.player.x = sim.portal.x;
  sim.player.y = sim.portal.y;
  stepGame(sim, 0.016, { processUi: false });
  applySnapshotToGame({ game: client, state: serializeState(room), controller: false });
  assert(client.floor === 2, `client floor expected 2 after portal transition, got ${client.floor}`);
  assert(client.floorBoss?.floor === 2, `client floorBoss floor expected 2, got ${client.floorBoss?.floor}`);

  return {
    joinPhase: joinState.floorBoss.phase,
    transitionedFloor: client.floor
  };
}

function validateRegressionSurface() {
  const game = new GameSim({ classType: "fighter", viewportWidth: 960, viewportHeight: 640 });
  assert(Array.isArray(game.map) && game.map.length > 0, "map generation failed");
  assert(Array.isArray(game.breakables), "breakables missing");
  assert(Array.isArray(game.armorStands), "armor stands missing");
  const spawnPoint = game.randomEnemySpawnPoint();
  assert(spawnPoint && Number.isFinite(spawnPoint.x) && Number.isFinite(spawnPoint.y), "enemy spawn point unavailable");
  const ghost = game.spawnGhost(spawnPoint.x, spawnPoint.y);
  game.enemies.push(ghost);
  stepGame(game, 0.016, { processUi: false });
  assert(game.enemies.length >= 1, "enemy update regression");

  return {
    map: `${game.mapWidth}x${game.mapHeight}`,
    breakables: game.breakables.length,
    armorStands: game.armorStands.length
  };
}

function main() {
  const results = {
    triggerLevels: validateTriggerLevels(),
    localProgression: validateLocalProgression(),
    networkReconciliation: validateNetworkReconciliation(),
    regressionSurface: validateRegressionSurface()
  };
  console.log(JSON.stringify(results, null, 2));
}

main();
