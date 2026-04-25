const WARRIOR_TIER_LEVELS = {
  1: 2,
  2: 3,
  3: 4,
  4: 6,
  5: 8,
  6: 10
};

const WARRIOR_TIER_PICK_LIMITS = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 2,
  6: 1
};

const WEAPON_KEYS = ["broadswing", "longspear", "warWhip", "twinHatchets"];
const STANCE_MODIFIER_KEYS = ["cleaving", "focused", "swift", "heavy", "guarded", "marked"];
const DOCTRINE_KEYS = ["paladinDoctrine", "berserkerDoctrine", "gladiatorDoctrine", "eldritchDoctrine"];
const EXTRA_KEYS = ["consecratedGround", "cleaveDiscipline", "executionersReach", "battleFrenzy", "shockRelease", "butchersPath", "redTempest", "secondWind"];
const CAPSTONE_KEYS = ["bastion", "ravager", "paragon", "spellknight"];

const WARRIOR_TALENT_DEFS = [
  {
    key: "broadswing",
    label: "Broadswing",
    tier: 1,
    family: "Weapon",
    icon: "BW",
    color: "#d7a06a",
    description: [
      "Wide sweeping weapon form.",
      "Balanced crowd clear and stable front-line control."
    ]
  },
  {
    key: "longspear",
    label: "Longspear",
    tier: 1,
    family: "Weapon",
    icon: "LS",
    color: "#c8c39a",
    description: [
      "Long-reaching thrust weapon form.",
      "Best spacing and disciplined lane control."
    ]
  },
  {
    key: "warWhip",
    label: "War Whip",
    tier: 1,
    family: "Weapon",
    icon: "WW",
    color: "#9b8fd4",
    description: [
      "Mid-range lash weapon form.",
      "Fast control-oriented strikes with setup potential."
    ]
  },
  {
    key: "twinHatchets",
    label: "Twin Hatchets",
    tier: 1,
    family: "Weapon",
    icon: "TH",
    color: "#d86f5e",
    description: [
      "Rapid close-range weapon form.",
      "Highest tempo and strongest aggression curve."
    ]
  },
  {
    key: "stanceACleaving",
    label: "Cleaving Form",
    tier: 2,
    family: "Stance A",
    icon: "CL",
    color: "#dfb57f",
    description: [
      "Stance A gains roughly 25% wider coverage.",
      "Trades some first-target damage for clear horde pressure."
    ]
  },
  {
    key: "stanceAFocused",
    label: "Focused Form",
    tier: 2,
    family: "Stance A",
    icon: "FC",
    color: "#f0c39b",
    description: [
      "Stance A narrows and hits about 33% harder.",
      "Adds stronger impact and low-health finishing pressure."
    ]
  },
  {
    key: "stanceASwift",
    label: "Swift Form",
    tier: 2,
    family: "Stance A",
    icon: "SW",
    color: "#b5e0b9",
    description: [
      "Stance A attacks much faster with reduced single-target DPS.",
      "Lower per-hit damage, better tempo and easier uptime."
    ]
  },
  {
    key: "stanceAHeavy",
    label: "Heavy Form",
    tier: 2,
    family: "Stance A",
    icon: "HV",
    color: "#d48b72",
    description: [
      "Stance A attacks slower but hits about 25% harder.",
      "Adds meaningful knockback and short hit-stun on impact."
    ]
  },
  {
    key: "stanceAGuarded",
    label: "Guarded Form",
    tier: 2,
    family: "Stance A",
    icon: "GD",
    color: "#ced8bf",
    description: [
      "Stance A becomes safer and more stable.",
      "Lower offense, but grants guard windows and better trading."
    ]
  },
  {
    key: "stanceAMarked",
    label: "Marked Form",
    tier: 2,
    family: "Stance A",
    icon: "MK",
    color: "#aab7c9",
    description: [
      "Stance A applies a setup mark on hit.",
      "Marks are generic at base and doctrines convert them into payoffs."
    ]
  },
  {
    key: "stanceBCleaving",
    label: "Cleaving Form",
    tier: 3,
    family: "Stance B",
    icon: "CL",
    color: "#dfb57f",
    description: [
      "Stance B gains roughly 25% wider coverage.",
      "Trades some first-target damage for clear horde pressure."
    ]
  },
  {
    key: "stanceBFocused",
    label: "Focused Form",
    tier: 3,
    family: "Stance B",
    icon: "FC",
    color: "#f0c39b",
    description: [
      "Stance B narrows and hits about 33% harder.",
      "Adds stronger impact and low-health finishing pressure."
    ]
  },
  {
    key: "stanceBSwift",
    label: "Swift Form",
    tier: 3,
    family: "Stance B",
    icon: "SW",
    color: "#b5e0b9",
    description: [
      "Stance B attacks much faster with reduced single-target DPS.",
      "Lower per-hit damage, better tempo and easier uptime."
    ]
  },
  {
    key: "stanceBHeavy",
    label: "Heavy Form",
    tier: 3,
    family: "Stance B",
    icon: "HV",
    color: "#d48b72",
    description: [
      "Stance B attacks slower but hits about 25% harder.",
      "Adds meaningful knockback and short hit-stun on impact."
    ]
  },
  {
    key: "stanceBGuarded",
    label: "Guarded Form",
    tier: 3,
    family: "Stance B",
    icon: "GD",
    color: "#ced8bf",
    description: [
      "Stance B becomes safer and more stable.",
      "Lower offense, but grants guard windows and better trading."
    ]
  },
  {
    key: "stanceBMarked",
    label: "Marked Form",
    tier: 3,
    family: "Stance B",
    icon: "MK",
    color: "#aab7c9",
    description: [
      "Stance B applies a setup mark on hit.",
      "Marks are generic at base and doctrines convert them into payoffs."
    ]
  },
  {
    key: "paladinDoctrine",
    label: "Paladin Doctrine",
    tier: 4,
    family: "Doctrine",
    icon: "PD",
    color: "#edd98f",
    description: [
      "Class skill becomes Sanctify.",
      "Holy defense, support, and zone-control doctrine."
    ]
  },
  {
    key: "berserkerDoctrine",
    label: "Berserker Doctrine",
    tier: 4,
    family: "Doctrine",
    icon: "BD",
    color: "#ef7f67",
    description: [
      "Class skill becomes Bloodhowl.",
      "Speed, leech, and aggression doctrine."
    ]
  },
  {
    key: "gladiatorDoctrine",
    label: "Gladiator Doctrine",
    tier: 4,
    family: "Doctrine",
    icon: "GD",
    color: "#d8b37b",
    description: [
      "Class skill becomes Arena Command.",
      "Balanced weapon-mastery and tempo doctrine."
    ]
  },
  {
    key: "eldritchDoctrine",
    label: "Eldritch Doctrine",
    tier: 4,
    family: "Doctrine",
    icon: "ED",
    color: "#8ea4ff",
    description: [
      "Class skill becomes Arcane Armament.",
      "Pure arcane melee hybrid doctrine."
    ]
  },
  {
    key: "consecratedGround",
    label: "War Circle",
    tier: 5,
    family: "Extras",
    icon: "CG",
    color: "#f0d58d",
    description: [
      "Class skill creates a doctrine-flavored combat field.",
      "The field gains holy, arcane, brutal, or tactical behavior based on doctrine."
    ]
  },
  {
    key: "cleaveDiscipline",
    label: "Cleave Discipline",
    tier: 5,
    family: "Extras",
    icon: "CD",
    color: "#e8c18d",
    description: [
      "After using your class skill, the next attack crits.",
      "During the skill window, your swings gain visibly wider coverage."
    ]
  },
  {
    key: "executionersReach",
    label: "Executioner's Reach",
    tier: 5,
    family: "Extras",
    icon: "ER",
    color: "#d8b494",
    description: [
      "During your class skill, melee range increases.",
      "Low-health enemies are easier to execute."
    ]
  },
  {
    key: "battleFrenzy",
    label: "Battle Frenzy",
    tier: 5,
    family: "Extras",
    icon: "BF",
    color: "#e27f65",
    description: [
      "Kills during your class skill trigger a frenzy burst.",
      "Frenzy adds movement, damage, and delayed healing."
    ]
  },
  {
    key: "shockRelease",
    label: "Shock Release",
    tier: 5,
    family: "Extras",
    icon: "SR",
    color: "#d9d1bb",
    description: [
      "Primary attacks can release a forward strike wave.",
      "The base wave is physical; doctrines recolor and empower it."
    ]
  },
  {
    key: "butchersPath",
    label: "Butcher's Path",
    tier: 5,
    family: "Extras",
    icon: "BP",
    color: "#d37a66",
    description: [
      "Executing an enemy empowers your next hit.",
      "The next swing crits, grows larger, and hits much harder."
    ]
  },
  {
    key: "redTempest",
    label: "Tempest",
    tier: 5,
    family: "Extras",
    icon: "RT",
    color: "#da6d5f",
    description: [
      "The first few seconds of class skill radiate doctrine-flavored AOE damage.",
      "Also grants temporary HP and a short, high-impact power window."
    ]
  },
  {
    key: "secondWind",
    label: "Second Wind",
    tier: 5,
    family: "Extras",
    icon: "SW",
    color: "#b2d8a7",
    description: [
      "Using your class skill starts a heal-over-time effect.",
      "Nearby allies receive a smaller version."
    ]
  },
  {
    key: "bastion",
    label: "Bastion",
    tier: 6,
    family: "Capstone",
    icon: "BA",
    color: "#f3ddb0",
    description: [
      "Defense and protection capstone.",
      "Enhances holy and guarded front-line play."
    ]
  },
  {
    key: "ravager",
    label: "Ravager",
    tier: 6,
    family: "Capstone",
    icon: "RV",
    color: "#f08d77",
    description: [
      "Aggression capstone.",
      "Missing health increases attack speed, move speed, and damage."
    ]
  },
  {
    key: "paragon",
    label: "Paragon",
    tier: 6,
    family: "Capstone",
    icon: "PG",
    color: "#e0c692",
    description: [
      "Technical mastery capstone.",
      "Rewards swapping and makes both stances stronger."
    ]
  },
  {
    key: "spellknight",
    label: "Spellknight",
    tier: 6,
    family: "Capstone",
    icon: "SK",
    color: "#a7b7ff",
    description: [
      "Arcane melee capstone.",
      "Adds echo damage, bursts, and arcane blade waves."
    ]
  }
];

const DEF_BY_KEY = Object.fromEntries(WARRIOR_TALENT_DEFS.map((def) => [def.key, def]));

function getTierKeys(tier) {
  return WARRIOR_TALENT_DEFS.filter((def) => def.tier === tier).map((def) => def.key);
}

function getTierSelections(game, tier) {
  return getTierKeys(tier).filter((key) => getWarriorTalentPoints(game, key) > 0);
}

function hasRequiredPreviousTier(game, tier) {
  if (tier <= 1) return true;
  return getTierSelections(game, tier - 1).length > 0;
}

function getTierLabel(tier) {
  if (tier === 1) return "Weapon";
  if (tier === 2) return "Stance A";
  if (tier === 3) return "Stance B";
  if (tier === 4) return "Doctrine";
  if (tier === 5) return "Extras";
  if (tier === 6) return "Capstone";
  return "Warrior";
}

function getSelectedStanceKey(game, stance) {
  const prefix = stance === "B" ? "stanceB" : "stanceA";
  const selected = STANCE_MODIFIER_KEYS.find((modifier) => getWarriorTalentPoints(game, `${prefix}${modifier[0].toUpperCase()}${modifier.slice(1)}`) > 0);
  return selected || "";
}

function modifierLabel(modifier) {
  if (!modifier) return "Balanced";
  return `${modifier[0].toUpperCase()}${modifier.slice(1)}`;
}

function wouldDuplicateStanceModifier(game, key) {
  const match = /^stance([AB])([A-Z].+)$/.exec(key);
  if (!match) return false;
  const nextModifier = match[2].charAt(0).toLowerCase() + match[2].slice(1);
  const otherStance = match[1] === "A" ? "B" : "A";
  return getSelectedStanceKey(game, otherStance) === nextModifier;
}

export function createWarriorTalentState() {
  return Object.fromEntries(
    WARRIOR_TALENT_DEFS.map((def) => [
      def.key,
      {
        key: def.key,
        points: 0,
        maxPoints: 1
      }
    ])
  );
}

export function cloneWarriorTalentState(source = null) {
  const next = createWarriorTalentState();
  if (!source || typeof source !== "object") return next;
  for (const [key, node] of Object.entries(next)) {
    const raw = source[key];
    if (!raw || typeof raw !== "object") continue;
    if (Number.isFinite(raw.points)) node.points = Math.max(0, Math.min(node.maxPoints, Math.floor(raw.points)));
  }
  return next;
}

export function getWarriorTalentDefs() {
  return WARRIOR_TALENT_DEFS.map((def) => ({ ...def, row: def.tier - 1, lane: def.family.toLowerCase() }));
}

export function getWarriorTalentDef(key) {
  return DEF_BY_KEY[key] ? { ...DEF_BY_KEY[key], row: DEF_BY_KEY[key].tier - 1, lane: DEF_BY_KEY[key].family.toLowerCase() } : null;
}

export function isWarriorTalentGame(game) {
  return !!game && typeof game.isWarriorClass === "function" && game.isWarriorClass();
}

export function getWarriorTalentPoints(game, key) {
  const points = game?.warriorTalents?.[key]?.points;
  return Number.isFinite(points) ? Math.max(0, points) : 0;
}

export function getWarriorAvailableSkillPoints(game) {
  return Number.isFinite(game?.skillPoints) ? Math.max(0, game.skillPoints) : 0;
}

export function getWarriorSpentSkillPoints(game) {
  let total = 0;
  for (const def of WARRIOR_TALENT_DEFS) total += getWarriorTalentPoints(game, def.key);
  return total;
}

export function getWarriorRowRequirement(row) {
  const tier = Math.max(1, Math.min(6, Math.floor(row) + 1));
  return WARRIOR_TIER_LEVELS[tier] || 99;
}

export function isWarriorRowAccessible(game, row) {
  const tier = Math.max(1, Math.min(6, Math.floor(row) + 1));
  const level = Number.isFinite(game?.level) ? Math.max(1, Math.floor(game.level)) : 1;
  return level >= getWarriorRowRequirement(row) && hasRequiredPreviousTier(game, tier);
}

export function getWarriorUnlockRequirementText(game, def) {
  if (!def) return "";
  const level = Number.isFinite(game?.level) ? Math.max(1, Math.floor(game.level)) : 1;
  if (level < (WARRIOR_TIER_LEVELS[def.tier] || 99)) return `Requires level ${WARRIOR_TIER_LEVELS[def.tier]}.`;
  if (!hasRequiredPreviousTier(game, def.tier)) return `Requires a Tier ${def.tier - 1} pick first.`;
  if (wouldDuplicateStanceModifier(game, def.key)) return "Cannot pick the same stance modifier twice.";
  const selected = getTierSelections(game, def.tier);
  if (selected.length >= (WARRIOR_TIER_PICK_LIMITS[def.tier] || 0) && !selected.includes(def.key)) return `${getTierLabel(def.tier)} choice already made.`;
  return "";
}

export function canSpendWarriorNode(game, key) {
  if (!isWarriorTalentGame(game) || getWarriorAvailableSkillPoints(game) <= 0) return false;
  const def = DEF_BY_KEY[key];
  if (!def) return false;
  const node = game?.warriorTalents?.[key];
  if (!node || node.points >= node.maxPoints) return false;
  const level = Number.isFinite(game?.level) ? Math.max(1, Math.floor(game.level)) : 1;
  if (level < (WARRIOR_TIER_LEVELS[def.tier] || 99)) return false;
  if (!hasRequiredPreviousTier(game, def.tier)) return false;
  if (wouldDuplicateStanceModifier(game, key)) return false;
  const selected = getTierSelections(game, def.tier);
  if (selected.length >= (WARRIOR_TIER_PICK_LIMITS[def.tier] || 0) && !selected.includes(key)) return false;
  return true;
}

export function canSpendWarriorUtility() {
  return false;
}

export function spendWarriorNode(game, key) {
  if (!canSpendWarriorNode(game, key)) return false;
  game.warriorTalents[key].points = 1;
  game.skillPoints -= 1;
  return true;
}

export function spendWarriorUtility() {
  return false;
}

export function formatWarriorLaneLabel(lane) {
  if (lane === "weapon") return "Weapon Form";
  if (lane === "stance a") return "Stance A";
  if (lane === "stance b") return "Stance B";
  if (lane === "doctrine") return "Class Skill";
  if (lane === "extras") return "Extra Modifier";
  if (lane === "capstone") return "Capstone";
  return "Warrior";
}

export function getWarriorTooltip(game, entry) {
  if (!entry || entry.kind === "utility") return null;
  const def = DEF_BY_KEY[entry.key];
  if (!def) return null;
  return {
    title: def.label,
    lines: def.description.slice(),
    requirement: entry.locked ? getWarriorUnlockRequirementText(game, def) : ""
  };
}

export function getWarriorWeaponForm(game) {
  return WEAPON_KEYS.find((key) => getWarriorTalentPoints(game, key) > 0) || "broadswing";
}

export function getWarriorPrimaryStyle(game) {
  return getWarriorWeaponForm(game);
}

export function getWarriorStanceModifier(game, stance = "A") {
  return getSelectedStanceKey(game, stance);
}

export function getWarriorStanceLabel(game, stance = "A") {
  return modifierLabel(getWarriorStanceModifier(game, stance));
}

export function getWarriorSecondaryStyle(game) {
  return getWarriorStanceModifier(game, "B");
}

export function getWarriorDoctrine(game) {
  if (getWarriorTalentPoints(game, "paladinDoctrine") > 0) return "paladin";
  if (getWarriorTalentPoints(game, "berserkerDoctrine") > 0) return "berserker";
  if (getWarriorTalentPoints(game, "gladiatorDoctrine") > 0) return "gladiator";
  if (getWarriorTalentPoints(game, "eldritchDoctrine") > 0) return "eldritch";
  return "battlecry";
}

export function getWarriorCapstone(game) {
  if (getWarriorTalentPoints(game, "bastion") > 0) return "bastion";
  if (getWarriorTalentPoints(game, "ravager") > 0) return "ravager";
  if (getWarriorTalentPoints(game, "paragon") > 0) return "paragon";
  if (getWarriorTalentPoints(game, "spellknight") > 0) return "spellknight";
  return "";
}

export function getWarriorClassSkillName(game) {
  switch (getWarriorDoctrine(game)) {
    case "paladin":
      return "Sanctify";
    case "berserker":
      return "Bloodhowl";
    case "gladiator":
      return "Arena Command";
    case "eldritch":
      return "Arcane Armament";
    default:
      return "Battle Cry";
  }
}

export function getWarriorClassSkillColor(game) {
  switch (getWarriorDoctrine(game)) {
    case "paladin":
      return "#e7d184";
    case "berserker":
      return "#dd6e62";
    case "gladiator":
      return "#d5ab73";
    case "eldritch":
      return "#8aa2ff";
    default:
      return "#d14f4f";
  }
}

export function getWarriorClassSkillCooldown(game) {
  return getWarriorDoctrine(game) === "gladiator" ? 9 : 10;
}

export function getWarriorClassSkillDuration(game) {
  switch (getWarriorDoctrine(game)) {
    case "paladin":
      return 3.5;
    case "berserker":
    case "eldritch":
      return 4;
    default:
      return 3;
  }
}

export function getWarriorSwapCooldown() {
  return 2;
}

export function hasWarriorCleaveDiscipline(game) {
  return getWarriorTalentPoints(game, "cleaveDiscipline") > 0;
}

export function hasWarriorExecutionersReach(game) {
  return getWarriorTalentPoints(game, "executionersReach") > 0;
}

export function hasWarriorBattleFrenzy(game) {
  return getWarriorTalentPoints(game, "battleFrenzy") > 0;
}

export function hasWarriorJudgmentWave(game) {
  return getWarriorTalentPoints(game, "shockRelease") > 0;
}

export function hasWarriorShockRelease(game) {
  return hasWarriorJudgmentWave(game);
}

export function hasWarriorButchersPath(game) {
  return getWarriorTalentPoints(game, "butchersPath") > 0;
}

export function hasWarriorRedTempest(game) {
  return getWarriorTalentPoints(game, "redTempest") > 0;
}

export function hasWarriorSecondWind(game) {
  return getWarriorTalentPoints(game, "secondWind") > 0;
}

export function hasWarriorConsecratedGround(game) {
  return getWarriorTalentPoints(game, "consecratedGround") > 0;
}

export function hasWarriorBastion(game) {
  return getWarriorCapstone(game) === "bastion";
}

export function hasWarriorRavager(game) {
  return getWarriorCapstone(game) === "ravager";
}

export function hasWarriorParagon(game) {
  return getWarriorCapstone(game) === "paragon";
}

export function hasWarriorSpellknight(game) {
  return getWarriorCapstone(game) === "spellknight";
}

export function isWarriorRaging(game) {
  const activeTimer = Number.isFinite(game?.warriorRageActiveTimer) ? game.warriorRageActiveTimer : 0;
  return activeTimer > 0;
}

export function getWarriorBattleFrenzyDuration() {
  return 3;
}

export function getWarriorBattleFrenzyMoveSpeedBonus(game) {
  return hasWarriorBattleFrenzy(game) ? 0.16 : 0;
}

export function getWarriorBattleFrenzyDamageBonus(game) {
  return hasWarriorBattleFrenzy(game) ? 0.1 : 0;
}

export function getWarriorSecondWindHealPct(game) {
  return hasWarriorSecondWind(game) ? 0.22 : 0;
}

export function getWarriorSecondWindAllyHealPct(game) {
  return hasWarriorSecondWind(game) ? 0.08 : 0;
}

export function getWarriorConsecratedRadiusTiles(game) {
  return hasWarriorConsecratedGround(game) ? 3.5 : 0;
}

export function getWarriorConsecratedDps(game) {
  return hasWarriorConsecratedGround(game) ? 10 : 0;
}

export function getWarriorConsecratedUndeadMultiplier(game) {
  return hasWarriorConsecratedGround(game) ? 1.5 : 1;
}

export function getWarriorConsecratedHealingMultiplier(game) {
  return hasWarriorSecondWind(game) ? 1.25 : 1;
}

export function getWarriorConsecratedDamageReductionPct(game) {
  return hasWarriorConsecratedGround(game) || hasWarriorBastion(game) ? 0.08 : 0;
}

export function getWarriorConsecratedShredPct(game) {
  return hasWarriorJudgmentWave(game) ? 0.2 : 0;
}

export function getWarriorJudgmentWaveChance(game) {
  return hasWarriorJudgmentWave(game) ? 0.18 : 0;
}

export function getWarriorJudgmentWaveDamageMultiplier(game) {
  return hasWarriorJudgmentWave(game) ? 0.65 : 0;
}

export function getWarriorJudgmentWaveShredPct(game) {
  return hasWarriorJudgmentWave(game) ? 0.2 : 0;
}

export function getWarriorExecutionerExecuteChance(game) {
  return hasWarriorExecutionersReach(game) ? 0.14 : 0;
}

export function getWarriorExecutionerRageRangeBonus(game) {
  return hasWarriorExecutionersReach(game) ? 0.2 : 0;
}

export function getWarriorExecutionerRageCleaveWidthBonus(game) {
  return hasWarriorCleaveDiscipline(game) ? 0.2 : 0;
}

export function getWarriorButchersPathNextHitDamageBonus(game) {
  return hasWarriorButchersPath(game) ? 0.35 : 0;
}

export function getWarriorButchersPathNextHitArcBonus(game) {
  return hasWarriorButchersPath(game) ? 0.25 : 0;
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

export function getWarriorRageMasteryAttackSpeedBonus(game) {
  return getWarriorDoctrine(game) === "berserker" ? 0.2 : 0;
}

export function getWarriorRageMasteryMoveSpeedBonus(game) {
  return getWarriorDoctrine(game) === "berserker" ? 0.1 : 0;
}

export function hasWarriorRageMastery(game) {
  return getWarriorDoctrine(game) === "berserker";
}

export function getWarriorBloodheatAttackSpeedBonus(game) {
  return getWarriorStanceModifier(game, "A") === "swift" || getWarriorStanceModifier(game, "B") === "swift" ? 0.08 : 0;
}

export function getWarriorBloodheatMoveSpeedBonus(game) {
  return getWarriorDoctrine(game) === "berserker" ? 0.05 : 0;
}

export function getWarriorBloodheatRageMoveSpeedBonus(game) {
  return getWarriorDoctrine(game) === "berserker" ? 0.1 : 0;
}

export function getWarriorCrusaderUndeadDamageBonus(game, enemy = null) {
  if ((getWarriorDoctrine(game) !== "paladin" && !hasWarriorJudgmentWave(game) && !hasWarriorConsecratedGround(game)) || !enemy) return 0;
  return enemy?.type === "ghost" || enemy?.type === "skeleton_warrior" || enemy?.type === "skeleton" || enemy?.type === "necromancer" || enemy?.type === "mummy"
    ? 0.08
    : 0;
}

export function getWarriorHeavyHandDamageBonus() {
  return 0;
}

export function getWarriorHeavyHandCleaveArcBonus() {
  return 0;
}

export function getWarriorIronGuardMaxHealthBonusPct() {
  return 0;
}

export function getWarriorIronGuardMaxHealthFlat() {
  return 0;
}

export function getWarriorIronGuardDefenseBonusPct() {
  return 0;
}

export function getWarriorPassiveRegenBonusPct() {
  return 0;
}

export function hasWarriorGuardedAdvance(game) {
  return hasWarriorConsecratedGround(game);
}

export function getWarriorGuardedAdvanceMeleeDefenseBonusPct(game) {
  return hasWarriorBastion(game) ? 0.12 : 0;
}

export function getWarriorGuardedAdvanceRetaliationDamage() {
  return 0;
}

export function getWarriorGuardedAdvanceCounterChance() {
  return 0;
}

export function getWarriorGuardedAdvanceIgnoreHitChance() {
  return 0;
}

export function getWarriorGuardedAdvanceAllyFlatReduction() {
  return 0;
}

export function getWarriorGuardedAdvanceMissileReflectChance() {
  return 0;
}

export function hasWarriorReflectShare() {
  return false;
}

export function getWarriorBattleFrenzyAttackSpeedBonus() {
  return 0;
}

export function getWarriorBattleFrenzyLifeLeechBonus() {
  return 0;
}

export function getWarriorUnbrokenLifeLeechBonus() {
  return 0;
}

export function getWarriorUnbrokenDamageReduction() {
  return 0;
}

export function hasWarriorUnbrokenCheatDeath() {
  return false;
}

export function isWarriorPassiveRageActive() {
  return false;
}

export function hasWarriorStonewall(game) {
  return hasWarriorJudgmentWave(game);
}

export function getWarriorStonewallLifeLeechBonus() {
  return 0;
}

export function getWarriorStonewallAllyDefenseAuraPct(game) {
  return hasWarriorBastion(game) ? 0.1 : 0;
}

export function hasWarriorCrusaderInvestment(game) {
  return getWarriorDoctrine(game) === "paladin" || hasWarriorJudgmentWave(game);
}

export function hasWarriorEldritchInvestment(game) {
  return getWarriorDoctrine(game) === "eldritch" || hasWarriorSpellknight(game);
}

export function getWarriorSkillPointGainForLevel(level, classType) {
  if (classType !== "fighter") return 1;
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  if (safeLevel < 2) return 0;
  if (safeLevel === 2) return 2;
  if (safeLevel <= 11) return 1;
  return safeLevel % 2 === 0 ? 1 : 0;
}
