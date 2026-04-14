import { DEFAULT_BIOME_KEY, getBiomeDefinition } from "../biomes.js";
import { createNecromancerBeamState, createNecromancerRuntimeState, createPlayerState, createRangerRuntimeState, createRunStats, createSkillState, createUpgradeState, createWarriorRuntimeState } from "./runtimeBaseStateFactories.js";
import { createRangerTalentState } from "./rangerTalentTree.js";
import { createWarriorTalentState } from "./warriorTalentTree.js";
import { createNecromancerTalentState } from "./necromancerTalentTree.js";
import { createConsumableInventoryState, rollConsumableShopStock } from "./consumables.js";

export function initializeRuntimeBaseState(game, { classType, classSpec, config }) {
  game.debugBossOverride = "auto";
  game.floor = 1;
  game.biomeKey = DEFAULT_BIOME_KEY;
  game.biome = getBiomeDefinition(game.biomeKey);
  game.mapWidth = config.map.width;
  game.mapHeight = config.map.height;
  game.map = [];
  game.worldWidth = 0;
  game.worldHeight = 0;

  game.score = 0;
  game.gold = 0;
  game.experience = 0;
  game.level = 1;
  game.expToNextLevel = config.progression.baseXpToLevel;
  game.hasKey = false;
  game.gameOver = false;
  game.gameOverTitle = "GAME OVER";
  game.deathTransitionDuration = 12;
  game.deathTransition = {
    active: false,
    elapsed: 0,
    returnTriggered: false
  };
  game.paused = false;
  game.shopOpen = false;
  game.skillTreeOpen = false;
  game.time = 0;
  game.skillPoints = 0;
  game.statsPanelOpen = false;
  game.statsPanelView = "run";
  game.statsPanelPausedGame = false;
  game.activePlayerCount = 1;
  game.remotePlayers = [];
  game.spectateTargetId = null;
  game.passiveRegenTimer = 2;
  game.levelWeaponDamageBonus = 0;
  game.floorBoss = game.createFloorBossState(game.floor);
  game.lastFloorBossFeedbackPhase = null;
  game.feedbackAudioContext = null;
  game.bullets = [];
  game.fireArrows = [];
  game.fireZones = [];
  game.meleeSwings = [];
  game.drops = [];
  game.enemies = [];
  game.armorStands = [];
  game.breakables = [];
  game.wallTraps = [];
  game.enemySpawnTimer = config.enemy.spawnIntervalStart;
  game.explored = [];
  game.navDistance = [];
  game.navPlayerTile = { x: -1, y: -1 };
  game.uiRects = {};
  game.uiScroll = { skillTree: 0, shop: 0 };
  game.floatingTexts = [];
  game.recentPlayerShots = [];
  game.skills = createSkillState();
  game.rangerTalents = createRangerTalentState();
  game.warriorTalents = createWarriorTalentState();
  game.necromancerTalents = createNecromancerTalentState();
  game.rangerRuntime = createRangerRuntimeState();
  game.warriorRuntime = createWarriorRuntimeState();
  game.necromancerRuntime = createNecromancerRuntimeState();
  game.runStats = createRunStats();
  game.warriorMomentumTimer = 0;
  game.warriorRageActiveTimer = 0;
  game.warriorRageCooldownTimer = 0;
  game.warriorRageVictoryRushPool = 0;
  game.warriorRageVictoryRushTimer = 0;
  game.necromancerBeam = createNecromancerBeamState();
  game.upgrades = createUpgradeState();
  game.shopOrder = [];
  game.consumables = createConsumableInventoryState();
  game.shopStock = rollConsumableShopStock(game.floor, 5);

  game.player = createPlayerState(classType, classSpec, config.player.maxHealth);
  game.player.rangerTalents = game.rangerTalents;
  game.player.warriorTalents = game.warriorTalents;
  game.player.necromancerTalents = game.necromancerTalents;
  game.player.warriorRuntime = game.warriorRuntime;
  game.player.rangerRuntime = game.rangerRuntime;
  game.player.necromancerRuntime = game.necromancerRuntime;
  game.door = { x: 0, y: 0, open: false };
  game.pickup = { x: 0, y: 0, taken: false };
  game.portal = { x: 0, y: 0, active: false };
}
