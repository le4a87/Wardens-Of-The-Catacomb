import {
  updateGhost,
  updateGoblin,
  updateMummy,
  updateMimic,
  updatePrisoner,
  updateRatArcher,
  updateSkeletonWarrior,
  updateNecromancer,
  updateMinotaur,
  updateLeprechaunBoss
} from "./enemyAi.js";

const DEFAULT_TACTIC_KEY_BY_TYPE = {
  ghost: "ghost",
  goblin: "goblin",
  armor: "armor",
  mimic: "mimic",
  prisoner: "prisoner",
  rat_archer: "rat_archer",
  skeleton_warrior: "skeleton_warrior",
  necromancer: "necromancer",
  skeleton: "skeleton",
  mummy: "mummy",
  minotaur: "minotaur",
  leprechaun: "leprechaun"
};

function updateGenericTactic(game, enemy, dt, speedScale) {
  if (typeof game.updateGenericEnemy === "function") {
    game.updateGenericEnemy(enemy, dt, speedScale);
    return;
  }
  if (typeof game.moveEnemyTowardPlayer === "function") game.moveEnemyTowardPlayer(enemy, speedScale, dt);
}

const TACTIC_DEFINITIONS = {
  ghost: {
    key: "ghost",
    label: "Orbit And Siphon",
    update: updateGhost
  },
  goblin: {
    key: "goblin",
    label: "Greed Escalation",
    update: updateGoblin
  },
  armor: {
    key: "armor",
    label: "Direct Pressure",
    update: updateGenericTactic
  },
  mimic: {
    key: "mimic",
    label: "Ambush Predator",
    update: updateMimic
  },
  prisoner: {
    key: "prisoner",
    label: "Deflecting Bruiser",
    update: updatePrisoner
  },
  rat_archer: {
    key: "rat_archer",
    label: "Ranged Spacing",
    update: updateRatArcher
  },
  skeleton_warrior: {
    key: "skeleton_warrior",
    label: "Collapse And Reanimate",
    update: updateSkeletonWarrior
  },
  necromancer: {
    key: "necromancer",
    label: "Summoner Boss",
    update: updateNecromancer
  },
  skeleton: {
    key: "skeleton",
    label: "Direct Pressure",
    update: updateGenericTactic
  },
  mummy: {
    key: "mummy",
    label: "Aura Bruiser",
    update: updateMummy
  },
  minotaur: {
    key: "minotaur",
    label: "Rush Bruiser",
    update: updateMinotaur
  },
  leprechaun: {
    key: "leprechaun",
    label: "Trickster Boss",
    update: updateLeprechaunBoss
  }
};

export function getEnemyTacticKey(enemy) {
  if (!enemy) return "ghost";
  return enemy.tacticKey || DEFAULT_TACTIC_KEY_BY_TYPE[enemy.type] || enemy.type || "ghost";
}

export function getEnemyTacticDefinition(enemy) {
  const key = getEnemyTacticKey(enemy);
  return TACTIC_DEFINITIONS[key] || TACTIC_DEFINITIONS.ghost;
}

export function ensureEnemyTacticsState(enemy) {
  if (!enemy) return null;
  const key = getEnemyTacticKey(enemy);
  if (enemy.tacticKey !== key) enemy.tacticKey = key;
  if (!enemy.tactics || enemy.tactics.key !== key) {
    enemy.tactics = {
      key,
      phase: "default",
      phaseTime: 0,
      memory: {}
    };
  }
  return enemy.tactics;
}

export function setEnemyTacticPhase(enemy, phase) {
  const tactics = ensureEnemyTacticsState(enemy);
  if (!tactics) return null;
  const nextPhase = phase || "default";
  if (tactics.phase !== nextPhase) {
    tactics.phase = nextPhase;
    tactics.phaseTime = 0;
  }
  return tactics;
}

export function updateEnemyTactics(game, enemy, dt, speedScale) {
  const tactics = ensureEnemyTacticsState(enemy);
  if (tactics) tactics.phaseTime += Math.max(0, Number.isFinite(dt) ? dt : 0);
  const definition = getEnemyTacticDefinition(enemy);
  definition.update(game, enemy, dt, speedScale);
  return definition;
}
