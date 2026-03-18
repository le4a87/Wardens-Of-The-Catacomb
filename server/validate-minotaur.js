import { GameSim } from "../src/sim/GameSim.js";
import { stepGame } from "../src/game/gameStep.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeMinotaurBossSim() {
  const game = new GameSim({ classType: "fighter", viewportWidth: 960, viewportHeight: 640 });
  while (game.floor < 2) game.advanceToNextFloor();
  game.level = game.getFloorBossTriggerLevel();
  assert(game.updateFloorBossTrigger() === true, "minotaur boss did not queue on even floor");
  const boss = game.spawnMinotaur(game.player.x + 160, game.player.y);
  game.enemies.push(boss);
  game.markFloorBossActive();
  return { game, boss };
}

function validateBossSelection() {
  const { game } = makeMinotaurBossSim();
  assert(game.floorBoss?.bossType === "minotaur", `expected minotaur boss type, got ${game.floorBoss?.bossType}`);
  return {
    floor: game.floor,
    bossType: game.floorBoss.bossType
  };
}

function validateChargeTrigger() {
  const { game, boss } = makeMinotaurBossSim();
  boss.chargeCooldown = 0;
  boss.stompCooldown = 999;
  game.updateEnemyTactics(boss, 0.016, 1);
  assert(boss.chargeWindupTimer > 0, "minotaur did not enter charge windup");
  return {
    chargeWindupTimer: boss.chargeWindupTimer
  };
}

function validateChargeShove() {
  const { game, boss } = makeMinotaurBossSim();
  const anchor = game.findNearestSafePoint(game.worldWidth * 0.5, game.worldHeight * 0.5, 12);
  game.player.x = anchor.x;
  game.player.y = anchor.y;
  boss.chargeTimer = 0.3;
  boss.chargeWindupTimer = 0;
  boss.chargeDirX = 1;
  boss.chargeDirY = 0;
  boss.chargeImpactCooldown = 0;
  boss.x = game.player.x - ((boss.size || 34) * 0.45 + 2);
  boss.y = game.player.y;
  const playerXBefore = game.player.x;
  const playerHpBefore = game.player.health;
  game.updateEnemyTactics(boss, 0.016, 1);
  assert(game.player.x > playerXBefore || game.player.y !== anchor.y, "minotaur charge did not shove player");
  assert(game.player.health < playerHpBefore, "minotaur charge did not damage player");
  return {
    playerXBefore,
    playerXAfter: game.player.x,
    playerYAfter: game.player.y,
    playerHpBefore,
    playerHpAfter: game.player.health
  };
}

function validateStompFallback() {
  const { game, boss } = makeMinotaurBossSim();
  game.player.x = boss.x + 18;
  game.player.y = boss.y;
  boss.stompCooldown = 0;
  boss.chargeCooldown = 0;
  boss.chargeTimer = 0;
  boss.chargeWindupTimer = 0;
  const playerHpBefore = game.player.health;
  game.updateEnemyTactics(boss, 0.016, 1);
  assert(boss.stompCooldown > 0, "minotaur did not use stomp in close range");
  assert(game.player.health < playerHpBefore, "minotaur stomp did not damage player");
  return {
    stompCooldown: boss.stompCooldown
  };
}

function validateBossMarkerRegression() {
  const { game, boss } = makeMinotaurBossSim();
  assert(game.getActiveFloorBossEnemy() === boss, "active floor boss lookup did not return minotaur");
  const detail = game.getFloorObjectiveDetail();
  assert(/Minotaur|tiles|Avoid charges/.test(detail), "objective detail lost minotaur guidance");
  stepGame(game, 0.016, { processUi: false });
  return {
    objectiveDetail: detail
  };
}

function main() {
  const results = {
    bossSelection: validateBossSelection(),
    chargeTrigger: validateChargeTrigger(),
    chargeShove: validateChargeShove(),
    stompFallback: validateStompFallback(),
    bossMarkerRegression: validateBossMarkerRegression()
  };
  console.log(JSON.stringify(results, null, 2));
}

main();
