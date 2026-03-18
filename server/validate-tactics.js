import { GameSim } from "../src/sim/GameSim.js";
import { stepGame } from "../src/game/gameStep.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeSim(classType = "archer") {
  return new GameSim({ classType, viewportWidth: 960, viewportHeight: 640 });
}

function validateGhostSiphon() {
  const game = makeSim("fighter");
  const tile = game.config.map.tile;
  const ghost = game.spawnGhost(game.player.x + tile * 1.1, game.player.y);
  ghost.siphonTickTimer = 0;
  game.enemies.push(ghost);
  const healthBefore = game.player.health;
  game.updateEnemyTactics(ghost, 0.25, 1);
  assert(ghost.siphoning === true, "ghost did not enter siphon state");
  assert(game.player.health < healthBefore, "ghost siphon did not damage player");
  assert(game.fireZones.some((zone) => zone.zoneType === "ghostSiphon"), "ghost siphon did not emit visual stream");
  return {
    playerHealthBefore: healthBefore,
    playerHealthAfter: game.player.health
  };
}

function validateGoblinPhases() {
  const game = makeSim("archer");
  const tile = game.config.map.tile;
  const goblin = game.spawnTreasureGoblin(game.player.x + tile * 1.5, game.player.y + tile * 0.5);
  game.enemies.push(goblin);
  game.drops.push({
    type: "gold",
    x: goblin.x + tile * 0.4,
    y: goblin.y,
    size: 12,
    amount: 12,
    life: 30
  });
  game.updateEnemyTactics(goblin, 0.16, 1);
  assert(goblin.growthStage === "feeding", `goblin expected feeding, got ${goblin.growthStage}`);
  goblin.goldEaten = game.config.enemy.goblinStrongGoldThreshold;
  game.drops = [];
  game.updateEnemyTactics(goblin, 0.16, 1);
  assert(goblin.growthStage === "enraged", `goblin expected enraged, got ${goblin.growthStage}`);
  goblin.goldEaten = 0;
  game.player.x = goblin.x + tile * 1.2;
  game.player.y = goblin.y;
  game.updateEnemyTactics(goblin, 0.16, 1);
  assert(goblin.growthStage === "scared", `goblin expected scared, got ${goblin.growthStage}`);
  return {
    feeding: "feeding",
    enraged: "enraged",
    scared: goblin.growthStage
  };
}

function validateRatArcherSpacing() {
  const game = makeSim("archer");
  const tile = game.config.map.tile;
  const rat = game.spawnRatArcher(game.player.x + tile * 3, game.player.y);
  game.enemies.push(rat);
  game.updateEnemyTactics(rat, 0.16, 1);
  assert(rat.rangeStage === "retreat", `rat archer expected retreat, got ${rat.rangeStage}`);
  rat.x = game.player.x + tile * 7.4;
  rat.y = game.player.y;
  rat.coverTargetX = rat.x;
  rat.coverTargetY = rat.y;
  rat.repositionTimer = 0;
  rat.burstCooldownTimer = 0;
  rat.shotIntervalTimer = 0;
  game.updateEnemyTactics(rat, 0.16, 1);
  assert(rat.rangeStage === "hold", `rat archer expected hold, got ${rat.rangeStage}`);
  return {
    closeRange: "retreat",
    preferredRange: rat.rangeStage
  };
}

function validateSkeletonReanimation() {
  const game = makeSim("fighter");
  const skeleton = game.spawnSkeletonWarrior(game.player.x + 72, game.player.y);
  skeleton.collapsed = true;
  skeleton.reviveAtEnd = true;
  skeleton.collapseTimer = 0;
  skeleton.reanimating = false;
  skeleton.reanimateTimer = 0;
  game.enemies.push(skeleton);
  game.updateEnemyTactics(skeleton, 0.01, 1);
  assert(skeleton.reanimating === true, "skeleton did not start reanimating");
  const windup = Math.max(0.2, game.config.enemy.skeletonWarriorReanimateWindup || 1.2);
  game.updateEnemyTactics(skeleton, windup + 0.05, 1);
  assert(skeleton.collapsed === false, "skeleton did not stand back up");
  assert(skeleton.hp > 0, "skeleton revived without hp");
  return {
    revivedHp: skeleton.hp
  };
}

function validateMummyAura() {
  const game = makeSim("fighter");
  const tile = game.config.map.tile;
  const mummy = game.spawnMummy(game.player.x + tile, game.player.y);
  game.enemies.push(mummy);
  const healthBefore = game.player.health;
  stepGame(game, 0.5, { processUi: false });
  assert(mummy.auraPulseTimer > 0, "mummy aura did not pulse");
  assert(game.player.health < healthBefore, "mummy aura did not damage player");
  return {
    playerHealthBefore: healthBefore,
    playerHealthAfter: game.player.health
  };
}

function main() {
  const results = {
    ghostSiphon: validateGhostSiphon(),
    goblinPhases: validateGoblinPhases(),
    ratArcherSpacing: validateRatArcherSpacing(),
    skeletonReanimation: validateSkeletonReanimation(),
    mummyAura: validateMummyAura()
  };
  console.log(JSON.stringify(results, null, 2));
}

main();
