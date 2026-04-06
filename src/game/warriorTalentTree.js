const WARRIOR_ROW_REQUIREMENTS = {
  0: 0,
  1: 1,
  2: 3,
  3: 8,
  4: 14
};

const WARRIOR_LANE_ORDER = {
  vanguard: 0,
  executioner: 1,
  berserker: 2
};

const WARRIOR_TALENT_DEFS = [
  {
    key: "rageActive",
    label: "Rage",
    row: 0,
    lane: "core",
    maxRanks: 1,
    icon: "RG",
    color: "#d36a62",
    description: [
      "Unlocks the warrior right-click skill.",
      "Enter a short combat commitment window.",
      "Half incoming damage from physical, melee, and arrow damage while active."
    ]
  },
  {
    key: "ironGuard",
    label: "Sanctified Steel",
    row: 1,
    lane: "vanguard",
    maxRanks: 3,
    icon: "SS",
    color: "#d8c77e",
    description: [
      "Rank 1: +4% defense.",
      "Rank 2: +4% defense, +8 max health.",
      "Rank 3: +4% defense, +8 max health, +6% damage against undead."
    ]
  },
  {
    key: "heavyHand",
    label: "Heavy Hand",
    row: 1,
    lane: "executioner",
    maxRanks: 3,
    icon: "HH",
    color: "#d99a72",
    description: [
      "Rank 1: +4% melee damage.",
      "Rank 2: +4% melee damage, +10% cleave arc.",
      "Rank 3: +4% damage against enemies above 70% health."
    ]
  },
  {
    key: "bloodheat",
    label: "Bloodheat",
    row: 1,
    lane: "berserker",
    maxRanks: 3,
    icon: "BH",
    color: "#de7868",
    description: [
      "Rank 1: +5% attack speed.",
      "Rank 2: +5% attack speed, +5% move speed while Rage is active.",
      "Rank 3: +5% attack speed, +5% passive move speed."
    ]
  },
  {
    key: "guardedAdvance",
    label: "Consecrated Rage",
    row: 2,
    lane: "vanguard",
    maxRanks: 1,
    icon: "CR",
    color: "#ead692",
    description: [
      "While raging, create a consecrated area where Rage was activated.",
      "Consecrated area radius: 4 tiles before Purging Light.",
      "Consecrated area deals holy damage over time, stronger against undead, and increases healing received within it.",
      "While standing in it, gain 5% damage reduction."
    ]
  },
  {
    key: "cleaveDiscipline",
    label: "Cleave Discipline",
    row: 2,
    lane: "executioner",
    maxRanks: 1,
    icon: "CD",
    color: "#ebb089",
    description: [
      "The first attack after Rage activates is a guaranteed critical hit.",
      "Rage increases critical damage by 20%.",
      "While raging, cleave width is increased by 10%."
    ]
  },
  {
    key: "rageMastery",
    label: "Rage Mastery",
    row: 2,
    lane: "berserker",
    maxRanks: 1,
    icon: "RM",
    color: "#f08a78",
    description: [
      "Rage increases attack speed by 25%.",
      "Rage increases movement speed by 10%.",
      "Rage lasts 15% longer."
    ]
  },
  {
    key: "unbroken",
    label: "Purging Light",
    row: 3,
    lane: "vanguard",
    maxRanks: 3,
    icon: "PL",
    color: "#f2e6b8",
    description: [
      "Rank 1: +15% consecrated area radius.",
      "Rank 2: +15% consecrated area holy damage.",
      "Rank 3: Undead inside the consecrated area take 20% more damage.",
      "Rage still grants Second Wind, healing 25% max health over 10 seconds.",
      "Nearby allies still gain 10% max health over 10 seconds when Rage is triggered."
    ]
  },
  {
    key: "executionersReach",
    label: "Executioner's Reach",
    row: 3,
    lane: "executioner",
    maxRanks: 3,
    icon: "ER",
    color: "#f0c39b",
    description: [
      "Each rank adds +10% chance to instantly kill enemies when damage leaves them under 30% health.",
      "While raging, attack range is +10% longer."
    ]
  },
  {
    key: "battleFrenzy",
    label: "Battle Frenzy",
    row: 3,
    lane: "berserker",
    maxRanks: 3,
    icon: "BF",
    color: "#f2a08f",
    description: [
      "Rank 1: While raging, kills grant Battle Frenzy for 3s: +10% move speed and +5% damage. 10s internal cooldown.",
      "Rank 2: While under Battle Frenzy, gain another +10% move speed and +5% damage.",
      "Rank 3: While under Battle Frenzy, gain another +10% move speed and +5% damage.",
      "Kills during Rage also feed a shared Victory Rush-style heal-over-time pool."
    ]
  },
  {
    key: "judgmentWave",
    label: "Judgment Wave",
    row: 4,
    lane: "vanguard",
    maxRanks: 1,
    icon: "JW",
    color: "#fff0bd",
    description: [
      "Cleave attacks have a chance to release a holy wave in the swing arc.",
      "Holy wave travels forward, damaging enemies it passes through.",
      "Holy wave weakens undead defenses, causing them to take more damage."
    ]
  },
  {
    key: "butchersPath",
    label: "Butcher's Path",
    row: 4,
    lane: "executioner",
    maxRanks: 1,
    icon: "BP",
    color: "#ffd2a9",
    description: [
      "After executing an enemy, your next hit is a guaranteed critical.",
      "While raging, your execution chance is doubled.",
      "After executing an enemy, your next cleave gains +20% width and +20% damage."
    ]
  },
  {
    key: "redTempest",
    label: "Red Tempest",
    row: 4,
    lane: "berserker",
    maxRanks: 1,
    icon: "RT",
    color: "#ffc0b3",
    description: [
      "While raging, gain +20% movement speed.",
      "When Rage activates, gain temporary hitpoints equal to 25% of max health.",
      "For the first 5 seconds of Rage, attacks use a 360-degree arc."
    ]
  }
];

const DEF_BY_KEY = Object.fromEntries(WARRIOR_TALENT_DEFS.map((def) => [def.key, def]));

export function createWarriorTalentState() {
  return Object.fromEntries(
    WARRIOR_TALENT_DEFS.map((def) => [
      def.key,
      {
        key: def.key,
        points: 0,
        maxPoints: def.maxRanks
      }
    ])
  );
}

export function cloneWarriorTalentState(source = null) {
  const next = createWarriorTalentState();
  if (!source || typeof source !== "object") return next;
  for (const [key, node] of Object.entries(next)) {
    const raw = source[key] || (key === "judgmentWave" ? source.stonewall : null);
    if (!raw || typeof raw !== "object") continue;
    if (Number.isFinite(raw.points)) node.points = Math.max(0, Math.min(node.maxPoints, Math.floor(raw.points)));
  }
  return next;
}

export function getWarriorTalentDefs() {
  return WARRIOR_TALENT_DEFS.map((def) => ({ ...def }));
}

export function getWarriorTalentDef(key) {
  return DEF_BY_KEY[key] ? { ...DEF_BY_KEY[key] } : null;
}

export function isWarriorTalentGame(game) {
  return !!game && typeof game.isWarriorClass === "function" && game.isWarriorClass();
}

export function getWarriorTalentPoints(game, key) {
  const points = game?.warriorTalents?.[key]?.points;
  return Number.isFinite(points) ? Math.max(0, points) : 0;
}

export function getWarriorUtilityKeys() {
  return ["moveSpeed", "attackSpeed", "damage", "defense"];
}

export function getWarriorUtilityLevel(game, key) {
  const level = game?.upgrades?.[key]?.level;
  return Number.isFinite(level) ? Math.max(0, Math.min(4, Math.floor(level))) : 0;
}

export function getWarriorSpentSkillPoints(game) {
  let total = 0;
  for (const key of getWarriorUtilityKeys()) total += getWarriorUtilityLevel(game, key);
  for (const def of WARRIOR_TALENT_DEFS) total += getWarriorTalentPoints(game, def.key);
  return total;
}

export function getWarriorAvailableSkillPoints(game) {
  return Number.isFinite(game?.skillPoints) ? Math.max(0, game.skillPoints) : 0;
}

export function getWarriorRowRequirement(row) {
  return Number.isFinite(WARRIOR_ROW_REQUIREMENTS[row]) ? WARRIOR_ROW_REQUIREMENTS[row] : 0;
}

export function isWarriorRowAccessible(game, row) {
  return getWarriorSpentSkillPoints(game) >= getWarriorRowRequirement(row);
}

function getWarriorPreviousRowOptions(def) {
  if (!def || def.row <= 1) return [];
  const currentLaneIndex = Number.isFinite(WARRIOR_LANE_ORDER[def.lane]) ? WARRIOR_LANE_ORDER[def.lane] : 0;
  return WARRIOR_TALENT_DEFS.filter((entry) => {
    if (!entry || entry.row !== def.row - 1) return false;
    if (def.row === 4) return entry.lane === def.lane;
    const previousLaneIndex = Number.isFinite(WARRIOR_LANE_ORDER[entry.lane]) ? WARRIOR_LANE_ORDER[entry.lane] : 0;
    return Math.abs(previousLaneIndex - currentLaneIndex) <= 1;
  }).map((entry) => entry.key);
}

export function getWarriorSelectedCapstones(game) {
  return ["butchersPath", "judgmentWave", "redTempest"].reduce((sum, key) => sum + (getWarriorTalentPoints(game, key) > 0 ? 1 : 0), 0);
}

export function getWarriorUnlockRequirementText(game, def) {
  if (!def) return "";
  if (def.row === 0) return "Available immediately.";
  if (def.row === 1) {
    if (getWarriorTalentPoints(game, "rageActive") > 0) return "Available now.";
    return "Requires Rage first.";
  }
  const previousRowOptions = getWarriorPreviousRowOptions(def);
  if (def.row === 4) {
    const capstonesSpent = getWarriorSelectedCapstones(game);
    const neededTotal = capstonesSpent <= 0 ? 14 : 20;
    if (previousRowOptions.length > 0 && !previousRowOptions.some((key) => getWarriorTalentPoints(game, key) > 0)) {
      const labels = previousRowOptions.map((key) => getWarriorTalentDef(key)?.label || key).join(" or ");
      return `Requires ${labels} first.`;
    }
    if (getWarriorSpentSkillPoints(game) < neededTotal) return `Requires ${neededTotal} total points spent.`;
    if (capstonesSpent >= 2) return "Capstone limit reached.";
    return capstonesSpent <= 0 ? "Select your first capstone." : "Select your second capstone.";
  }
  if (previousRowOptions.length > 0 && !previousRowOptions.some((key) => getWarriorTalentPoints(game, key) > 0)) {
    const labels = previousRowOptions.map((key) => getWarriorTalentDef(key)?.label || key).join(" or ");
    return `Requires ${labels} first.`;
  }
  return `Requires ${getWarriorRowRequirement(def.row)} total skill points spent.`;
}

export function canSpendWarriorNode(game, key) {
  if (!isWarriorTalentGame(game) || getWarriorAvailableSkillPoints(game) <= 0) return false;
  const def = DEF_BY_KEY[key];
  if (!def) return false;
  const node = game?.warriorTalents?.[key];
  if (!node || node.points >= node.maxPoints) return false;
  if (def.row === 0) return true;
  if (getWarriorTalentPoints(game, "rageActive") <= 0) return false;
  if (!isWarriorRowAccessible(game, def.row)) return false;
  const previousRowOptions = getWarriorPreviousRowOptions(def);
  if (previousRowOptions.length > 0 && !previousRowOptions.some((nodeKey) => getWarriorTalentPoints(game, nodeKey) > 0)) return false;
  if (def.row === 4) {
    const capstonesSpent = getWarriorSelectedCapstones(game);
    const neededTotal = capstonesSpent <= 0 ? 14 : 20;
    if (getWarriorSpentSkillPoints(game) < neededTotal) return false;
    if (capstonesSpent >= 2) return false;
  }
  return true;
}

export function canSpendWarriorUtility(game, key) {
  if (!isWarriorTalentGame(game) || getWarriorAvailableSkillPoints(game) <= 0) return false;
  if (getWarriorSpentSkillPoints(game) <= 0 && getWarriorTalentPoints(game, "rageActive") <= 0) return false;
  const upgrade = game?.upgrades?.[key];
  return !!upgrade && Number.isFinite(upgrade.level) && upgrade.level < 4;
}

export function spendWarriorNode(game, key) {
  if (!canSpendWarriorNode(game, key)) return false;
  const node = game.warriorTalents[key];
  node.points += 1;
  game.skillPoints -= 1;
  return true;
}

export function spendWarriorUtility(game, key) {
  if (!canSpendWarriorUtility(game, key)) return false;
  game.upgrades[key].level += 1;
  game.skillPoints -= 1;
  return true;
}

export function formatWarriorLaneLabel(lane) {
  if (lane === "vanguard") return "Crusader";
  if (lane === "executioner") return "Executioner";
  if (lane === "berserker") return "Berserker";
  return "Core";
}

export function getWarriorTooltip(game, entry) {
  if (!entry) return null;
  if (entry.kind === "utility") {
    const labelMap = {
      moveSpeed: "Move Speed Training",
      attackSpeed: "Attack Speed Training",
      damage: "Damage Training",
      defense: "Defense Training"
    };
    const bodyMap = {
      moveSpeed: ["Spend 1 SP for +5% move speed.", "Warrior utility node. Counts toward row unlocks."],
      attackSpeed: ["Spend 1 SP for +6% attack speed.", "Warrior utility node. Counts toward row unlocks."],
      damage: ["Spend 1 SP for +8% damage.", "Warrior utility node. Counts toward row unlocks."],
      defense: ["Spend 1 SP for +1.5 flat defense.", "Warrior utility node. Counts toward row unlocks."]
    };
    return {
      title: labelMap[entry.key] || entry.key,
      lines: bodyMap[entry.key] || [],
      requirement: entry.locked ? "Requires at least 1 available skill point." : ""
    };
  }
  const def = DEF_BY_KEY[entry.key];
  if (!def) return null;
  return {
    title: def.label,
    lines: def.description.slice(),
    requirement: entry.locked ? getWarriorUnlockRequirementText(game, def) : ""
  };
}

export function getWarriorIronGuardMaxHealthBonusPct(game) {
  return 0;
}

export function getWarriorIronGuardMaxHealthFlat(game) {
  const rank = getWarriorTalentPoints(game, "ironGuard");
  return rank >= 2 ? 8 : 0;
}

export function getWarriorIronGuardDefenseBonusPct(game) {
  return getWarriorTalentPoints(game, "ironGuard") >= 1 ? 0.04 : 0;
}

export function getWarriorPassiveRegenBonusPct(game) {
  return 0;
}

export function getWarriorCrusaderUndeadDamageBonus(game, enemy = null) {
  if (getWarriorTalentPoints(game, "ironGuard") < 3) return 0;
  if (!enemy) return 0;
  return enemy?.type === "ghost" || enemy?.type === "skeleton_warrior" || enemy?.type === "skeleton" || enemy?.type === "necromancer" || enemy?.type === "mummy"
    ? 0.06
    : 0;
}

export function getWarriorHeavyHandDamageBonus(game, enemy = null) {
  const rank = getWarriorTalentPoints(game, "heavyHand");
  let bonus = 0;
  if (rank >= 1) bonus += 0.04;
  if (rank >= 2) bonus += 0.04;
  if (
    rank >= 3 &&
    enemy &&
    Number.isFinite(enemy.hp) &&
    Number.isFinite(enemy.maxHp) &&
    enemy.maxHp > 0 &&
    enemy.hp / enemy.maxHp > 0.7
  ) {
    bonus += 0.04;
  }
  return bonus;
}

export function getWarriorHeavyHandCleaveArcBonus(game) {
  return getWarriorTalentPoints(game, "heavyHand") >= 2 ? 0.1 : 0;
}

export function getWarriorHeavyHandRangeBonus() {
  return 0;
}

export function getWarriorBloodheatAttackSpeedBonus(game) {
  return getWarriorTalentPoints(game, "bloodheat") * 0.05;
}

export function getWarriorBloodheatMoveSpeedBonus(game) {
  return getWarriorTalentPoints(game, "bloodheat") >= 3 ? 0.05 : 0;
}

export function getWarriorBloodheatRageLifeLeechBonus(game) {
  return 0;
}

export function getWarriorBloodheatRageMoveSpeedBonus(game) {
  return getWarriorTalentPoints(game, "bloodheat") >= 2 ? 0.05 : 0;
}

export function hasWarriorGuardedAdvance(game) {
  return getWarriorTalentPoints(game, "guardedAdvance") > 0;
}

export function getWarriorGuardedAdvanceMeleeDefenseBonusPct(game) {
  return 0;
}

export function getWarriorGuardedAdvanceRetaliationDamage(game) {
  return 0;
}

export function getWarriorGuardedAdvanceCounterChance(game) {
  return 0;
}

export function getWarriorGuardedAdvanceIgnoreHitChance(game) {
  return 0;
}

export function getWarriorGuardedAdvanceAllyFlatReduction(game, damageType = "physical") {
  return 0;
}

export function getWarriorGuardedAdvanceMissileReflectChance(game, entity = null) {
  return 0;
}

export function hasWarriorReflectShare(game, entity = null) {
  return false;
}

export function hasWarriorCleaveDiscipline(game) {
  return getWarriorTalentPoints(game, "cleaveDiscipline") > 0;
}

export function getWarriorRageMasteryAttackSpeedBonus(game) {
  return hasWarriorRageMastery(game) ? 0.25 : 0;
}

export function getWarriorRageMasteryMoveSpeedBonus(game) {
  return hasWarriorRageMastery(game) ? 0.10 : 0;
}

export function hasWarriorRageMastery(game) {
  return getWarriorTalentPoints(game, "rageMastery") > 0;
}

export function getWarriorExecutionerRageRangeBonus(game) {
  return getWarriorTalentPoints(game, "executionersReach") > 0 ? 0.1 : 0;
}

export function getWarriorExecutionerMultiHitBonus() {
  return 0;
}

export function getWarriorExecutionerExecuteBonus() {
  return 0;
}

export function getWarriorExecutionerExecuteChance(game) {
  return getWarriorTalentPoints(game, "executionersReach") * 0.1;
}

export function getWarriorBattleFrenzyDuration() {
  return 3;
}

export function getWarriorBattleFrenzyAttackSpeedBonus() {
  return 0;
}

export function getWarriorBattleFrenzyMoveSpeedBonus(game) {
  return getWarriorTalentPoints(game, "battleFrenzy") * 0.1;
}

export function getWarriorBattleFrenzyDamageBonus(game) {
  return getWarriorTalentPoints(game, "battleFrenzy") * 0.05;
}

export function getWarriorBattleFrenzyLifeLeechBonus() {
  return 0;
}

export function getWarriorUnbrokenLifeLeechBonus(game, healthRatio = 1) {
  return 0;
}

export function getWarriorUnbrokenDamageReduction(game, healthRatio = 1) {
  return 0;
}

export function hasWarriorUnbrokenCheatDeath(game) {
  return false;
}

export function getWarriorSecondWindHealPct(game) {
  return getWarriorTalentPoints(game, "unbroken") > 0 ? 0.25 : 0;
}

export function getWarriorSecondWindAllyHealPct(game) {
  return getWarriorTalentPoints(game, "unbroken") > 0 ? 0.1 : 0;
}

export function isWarriorPassiveRageActive(game) {
  return false;
}

export function isWarriorRaging(game) {
  const activeTimer = Number.isFinite(game?.warriorRageActiveTimer) ? game.warriorRageActiveTimer : 0;
  return activeTimer > 0 || isWarriorPassiveRageActive(game);
}

export function hasWarriorStonewall(game) {
  return getWarriorTalentPoints(game, "judgmentWave") > 0;
}

export function hasWarriorButchersPath(game) {
  return getWarriorTalentPoints(game, "butchersPath") > 0;
}

export function hasWarriorRedTempest(game) {
  return getWarriorTalentPoints(game, "redTempest") > 0;
}

export function getWarriorStonewallLifeLeechBonus(game) {
  return 0;
}

export function getWarriorStonewallAllyDefenseAuraPct(game) {
  return 0;
}

export function hasWarriorCrusaderInvestment(game) {
  return getWarriorTalentPoints(game, "ironGuard") > 0 ||
    getWarriorTalentPoints(game, "guardedAdvance") > 0 ||
    getWarriorTalentPoints(game, "unbroken") > 0 ||
    getWarriorTalentPoints(game, "judgmentWave") > 0;
}

export function getWarriorConsecratedRadiusTiles(game) {
  let radius = 3;
  if (getWarriorTalentPoints(game, "unbroken") >= 1) radius *= 1.15;
  return radius;
}

export function getWarriorConsecratedDps(game) {
  let dps = 9;
  if (getWarriorTalentPoints(game, "unbroken") >= 2) dps *= 1.15;
  return dps;
}

export function getWarriorConsecratedUndeadMultiplier(game) {
  return 1.5;
}

export function getWarriorConsecratedHealingMultiplier(game) {
  return hasWarriorGuardedAdvance(game) ? 1.25 : 1;
}

export function getWarriorConsecratedDamageReductionPct(game) {
  return hasWarriorGuardedAdvance(game) ? 0.05 : 0;
}

export function getWarriorConsecratedShredPct(game) {
  return getWarriorTalentPoints(game, "unbroken") >= 3 ? 0.2 : 0;
}

export function hasWarriorJudgmentWave(game) {
  return hasWarriorStonewall(game);
}

export function getWarriorJudgmentWaveChance(game) {
  return hasWarriorStonewall(game) ? 0.25 : 0;
}

export function getWarriorJudgmentWaveDamageMultiplier(game) {
  return hasWarriorStonewall(game) ? 0.7 : 0;
}

export function getWarriorJudgmentWaveShredPct(game) {
  return hasWarriorStonewall(game) ? 0.2 : 0;
}

export function getWarriorRedTempestMoveSpeedBonus(game) {
  return hasWarriorRedTempest(game) ? 0.2 : 0;
}

export function getWarriorRedTempestTempHpPct(game) {
  return hasWarriorRedTempest(game) ? 0.25 : 0;
}

export function getWarriorRedTempestFullArcDuration(game) {
  return hasWarriorRedTempest(game) ? 5 : 0;
}

export function getWarriorExecutionerRageCleaveWidthBonus(game) {
  return hasWarriorCleaveDiscipline(game) ? 0.10 : 0;
}

export function getWarriorButchersPathNextHitDamageBonus(game) {
  return hasWarriorButchersPath(game) ? 0.2 : 0;
}

export function getWarriorButchersPathNextHitArcBonus(game) {
  return hasWarriorButchersPath(game) ? 0.2 : 0;
}

export function getWarriorSkillPointGainForLevel(level, classType) {
  if (classType !== "fighter") return 1;
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  if (safeLevel < 2) return 0;
  if (safeLevel === 2) return 2;
  if (safeLevel <= 11) return 1;
  return safeLevel % 2 === 0 ? 1 : 0;
}
