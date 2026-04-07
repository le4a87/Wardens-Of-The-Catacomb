const NECROMANCER_ROW_REQUIREMENTS = {
  0: 0,
  1: 1,
  2: 3,
  3: 8,
  4: 14
};

const NECROMANCER_LANE_ORDER = {
  reaper: 0,
  gravekeeper: 1,
  plaguebinder: 2
};

const NECROMANCER_TALENT_DEFS = [
  {
    key: "deathBoltActive",
    label: "Death Bolt",
    row: 0,
    lane: "core",
    maxRanks: 1,
    icon: "DB",
    color: "#9c82ff",
    description: [
      "Unlocks the necromancer right-click skill.",
      "Launch a necrotic projectile that explodes and pulses."
    ]
  },
  {
    key: "blackCandle",
    label: "Black Candle",
    row: 1,
    lane: "reaper",
    maxRanks: 3,
    icon: "BC",
    color: "#bb99ff",
    description: [
      "+5% Death Bolt damage per rank.",
      "+5% Death Bolt explosion damage per rank.",
      "+15% necrotic beam damage per rank.",
      "+10% necrotic beam damage against cursed targets."
    ]
  },
  {
    key: "controlMastery",
    label: "Control Mastery",
    row: 1,
    lane: "gravekeeper",
    maxRanks: 3,
    icon: "CM",
    color: "#88bcff",
    description: [
      "Rank 1-3: +1 control cap and +15% necrotic beam healing per rank."
    ]
  },
  {
    key: "hexcraft",
    label: "Hexcraft",
    row: 1,
    lane: "plaguebinder",
    maxRanks: 3,
    icon: "HX",
    color: "#a6e67f",
    description: [
      "Death Bolt applies Curse on hit.",
      "Death Bolt deals poison damage.",
      "Curse: -25% attack speed, -25% defense, +25% poison vulnerability.",
      "Higher ranks extend duration and improve cursed-target payoff."
    ]
  },
  {
    key: "deathBoltMastery",
    label: "Death Mastery",
    row: 2,
    lane: "reaper",
    maxRanks: 3,
    icon: "DM",
    color: "#d2bcff",
    description: [
      "Rank 1-3: +10% Death Bolt damage and -1.0s Death Bolt cooldown per rank.",
      "+15% necrotic beam pulse rate per rank.",
      "Death Bolt and necrotic beam kills grant 1 temporary hp, up to 20% of your max health."
    ]
  },
  {
    key: "coldCommand",
    label: "Cold Command",
    row: 2,
    lane: "gravekeeper",
    maxRanks: 3,
    icon: "CC",
    color: "#aad3ff",
    description: [
      "Rank 1-3: +15% controlled undead health, +10% defense, +10% damage, and +10% attack speed per rank.",
      "Death Bolt kills have +10% controlled ghost spawn chance per rank if slots are available."
    ]
  },
  {
    key: "plaguecraft",
    label: "Plaguecraft",
    row: 2,
    lane: "plaguebinder",
    maxRanks: 3,
    icon: "PC",
    color: "#8fd86b",
    description: [
      "Rank 1: controlled undead attacks apply Rot.",
      "Rot: poison damage over time and -25% movement speed.",
      "Rank 2: controlled undead deaths apply Rot in a 1-tile burst.",
      "Rank 3: non-undead enemies with Curse or Rot have a 10% chance to rise again as controlled skeletons."
    ]
  },
  {
    key: "explodingDeath",
    label: "Exploding Death",
    row: 3,
    lane: "reaper",
    maxRanks: 1,
    icon: "ED",
    color: "#eadbff",
    description: [
      "Controlled undead deaths explode for necrotic damage.",
      "Their deaths also grant Vigor of Life: +15% defense, +25% move speed, and healing over time."
    ]
  },
  {
    key: "boneWard",
    label: "Bone Ward",
    row: 3,
    lane: "gravekeeper",
    maxRanks: 1,
    icon: "BW",
    color: "#d4ebff",
    description: [
      "Controlled undead take 10% less damage.",
      "Controlled undead within 2 tiles gain +10% damage.",
      "Controlled undead within 2 tiles have a 15% projectile reflect chance."
    ]
  },
  {
    key: "rotTouched",
    label: "Rot Touched",
    row: 3,
    lane: "plaguebinder",
    maxRanks: 1,
    icon: "RT",
    color: "#c7f0a0",
    description: [
      "+20% Death Bolt area duration.",
      "+10% Death Bolt area radius.",
      "Enemies that hit you take 5 poison damage."
    ]
  },
  {
    key: "harvester",
    label: "Harvester",
    row: 4,
    lane: "reaper",
    maxRanks: 1,
    icon: "HV",
    color: "#f3eaff",
    description: [
      "Gain a 1-tile necrotic aura.",
      "Enemies that die within the aura have a 40% chance to rise as controlled ghosts if slots are available.",
      "Death Bolt cooldown reduced by 20%.",
      "Each kill increases the next Death Bolt damage by 5%, up to 50%."
    ]
  },
  {
    key: "legionMaster",
    label: "Legion Master",
    row: 4,
    lane: "gravekeeper",
    maxRanks: 1,
    icon: "LM",
    color: "#eff8ff",
    description: [
      "Skeletal warriors gain a 5-tile arrow attack.",
      "Ghost life steal is increased by 0.2%.",
      "Death Bolt kills gain +50% controlled ghost spawn chance if slots are available."
    ]
  },
  {
    key: "blightstorm",
    label: "Blightstorm",
    row: 4,
    lane: "plaguebinder",
    maxRanks: 1,
    icon: "BS",
    color: "#e6f7bf",
    description: [
      "Death Bolt fires 3 bolts in a wide cone.",
      "Necrotic beam applies Curse to damaged enemies.",
      "Controlled undead deaths create a 2-tile plague burst."
    ]
  }
];

const DEF_BY_KEY = Object.fromEntries(NECROMANCER_TALENT_DEFS.map((def) => [def.key, def]));

export function createNecromancerTalentState() {
  return Object.fromEntries(
    NECROMANCER_TALENT_DEFS.map((def) => [
      def.key,
      {
        key: def.key,
        points: 0,
        maxPoints: def.maxRanks
      }
    ])
  );
}

export function cloneNecromancerTalentState(source = null) {
  const next = createNecromancerTalentState();
  if (!source || typeof source !== "object") return next;
  for (const [key, node] of Object.entries(next)) {
    const raw = source[key];
    if (!raw || typeof raw !== "object") continue;
    if (Number.isFinite(raw.points)) node.points = Math.max(0, Math.min(node.maxPoints, Math.floor(raw.points)));
  }
  return next;
}

export function getNecromancerTalentDefs() {
  return NECROMANCER_TALENT_DEFS.map((def) => ({ ...def }));
}

export function getNecromancerTalentDef(key) {
  return DEF_BY_KEY[key] ? { ...DEF_BY_KEY[key] } : null;
}

export function isNecromancerTalentGame(game) {
  return !!game && typeof game.isNecromancerClass === "function" && game.isNecromancerClass();
}

export function getNecromancerTalentPoints(game, key) {
  const points = game?.necromancerTalents?.[key]?.points;
  return Number.isFinite(points) ? Math.max(0, points) : 0;
}

export function getNecromancerUtilityKeys() {
  return ["moveSpeed", "attackSpeed", "damage", "defense"];
}

export function getNecromancerUtilityLevel(game, key) {
  const level = game?.upgrades?.[key]?.level;
  return Number.isFinite(level) ? Math.max(0, Math.min(4, Math.floor(level))) : 0;
}

export function getNecromancerSpentSkillPoints(game) {
  let total = 0;
  for (const key of getNecromancerUtilityKeys()) total += getNecromancerUtilityLevel(game, key);
  for (const def of NECROMANCER_TALENT_DEFS) total += getNecromancerTalentPoints(game, def.key);
  return total;
}

export function getNecromancerAvailableSkillPoints(game) {
  return Number.isFinite(game?.skillPoints) ? Math.max(0, game.skillPoints) : 0;
}

export function isNecromancerRowAccessible(game, row) {
  return getNecromancerSpentSkillPoints(game) >= (NECROMANCER_ROW_REQUIREMENTS[row] || 0);
}

function getNecromancerPreviousRowOptions(def) {
  if (!def || def.row <= 1) return [];
  const currentLaneIndex = Number.isFinite(NECROMANCER_LANE_ORDER[def.lane]) ? NECROMANCER_LANE_ORDER[def.lane] : 0;
  return NECROMANCER_TALENT_DEFS.filter((entry) => {
    if (!entry || entry.row !== def.row - 1) return false;
    if (def.row === 4) return entry.lane === def.lane;
    const previousLaneIndex = Number.isFinite(NECROMANCER_LANE_ORDER[entry.lane]) ? NECROMANCER_LANE_ORDER[entry.lane] : 0;
    return Math.abs(previousLaneIndex - currentLaneIndex) <= 1;
  }).map((entry) => entry.key);
}

export function getNecromancerSelectedCapstones(game) {
  return ["harvester", "legionMaster", "blightstorm"].reduce((sum, key) => sum + (getNecromancerTalentPoints(game, key) > 0 ? 1 : 0), 0);
}

export function getNecromancerUnlockRequirementText(game, def) {
  if (!def) return "";
  if (def.row === 0) return "Available immediately.";
  if (def.row === 1) {
    if (getNecromancerTalentPoints(game, "deathBoltActive") > 0) return "Available now.";
    return "Requires Death Bolt first.";
  }
  const previousRowOptions = getNecromancerPreviousRowOptions(def);
  if (def.row === 4) {
    const capstonesSpent = getNecromancerSelectedCapstones(game);
    const neededTotal = capstonesSpent <= 0 ? 14 : 20;
    if (previousRowOptions.length > 0 && !previousRowOptions.some((key) => getNecromancerTalentPoints(game, key) > 0)) {
      const labels = previousRowOptions.map((key) => getNecromancerTalentDef(key)?.label || key).join(" or ");
      return `Requires ${labels} first.`;
    }
    if (getNecromancerSpentSkillPoints(game) < neededTotal) return `Requires ${neededTotal} total points spent.`;
    if (capstonesSpent >= 2) return "Capstone limit reached.";
    return capstonesSpent <= 0 ? "Select your first capstone." : "Select your second capstone.";
  }
  if (previousRowOptions.length > 0 && !previousRowOptions.some((key) => getNecromancerTalentPoints(game, key) > 0)) {
    const labels = previousRowOptions.map((key) => getNecromancerTalentDef(key)?.label || key).join(" or ");
    return `Requires ${labels} first.`;
  }
  return `Requires ${NECROMANCER_ROW_REQUIREMENTS[def.row] || 0} total skill points spent.`;
}

export function canSpendNecromancerNode(game, key) {
  if (!isNecromancerTalentGame(game) || getNecromancerAvailableSkillPoints(game) <= 0) return false;
  const def = DEF_BY_KEY[key];
  if (!def) return false;
  const node = game?.necromancerTalents?.[key];
  if (!node || node.points >= node.maxPoints) return false;
  if (def.row === 0) return true;
  if (getNecromancerTalentPoints(game, "deathBoltActive") <= 0) return false;
  if (!isNecromancerRowAccessible(game, def.row)) return false;
  const previousRowOptions = getNecromancerPreviousRowOptions(def);
  if (previousRowOptions.length > 0 && !previousRowOptions.some((nodeKey) => getNecromancerTalentPoints(game, nodeKey) > 0)) return false;
  if (def.row === 4) {
    const capstonesSpent = getNecromancerSelectedCapstones(game);
    const neededTotal = capstonesSpent <= 0 ? 14 : 20;
    if (getNecromancerSpentSkillPoints(game) < neededTotal) return false;
    if (capstonesSpent >= 2) return false;
  }
  return true;
}

export function canSpendNecromancerUtility(game, key) {
  if (!isNecromancerTalentGame(game) || getNecromancerAvailableSkillPoints(game) <= 0) return false;
  if (getNecromancerSpentSkillPoints(game) <= 0 && getNecromancerTalentPoints(game, "deathBoltActive") <= 0) return false;
  const upgrade = game?.upgrades?.[key];
  return !!upgrade && Number.isFinite(upgrade.level) && upgrade.level < 4;
}

export function spendNecromancerNode(game, key) {
  if (!canSpendNecromancerNode(game, key)) return false;
  const node = game.necromancerTalents[key];
  node.points += 1;
  game.skillPoints -= 1;
  return true;
}

export function spendNecromancerUtility(game, key) {
  if (!canSpendNecromancerUtility(game, key)) return false;
  game.upgrades[key].level += 1;
  game.skillPoints -= 1;
  return true;
}

export function formatNecromancerLaneLabel(lane) {
  if (lane === "reaper") return "Reaper";
  if (lane === "gravekeeper") return "Gravekeeper";
  if (lane === "plaguebinder") return "Plaguebinder";
  return "Core";
}

export function getNecromancerTooltip(game, entry) {
  if (!entry) return null;
  if (entry.kind === "utility") {
    const labelMap = {
      moveSpeed: "Move Speed Training",
      attackSpeed: "Attack Speed Training",
      damage: "Damage Training",
      defense: "Defense Training"
    };
    const bodyMap = {
      moveSpeed: ["Spend 1 SP for +5% move speed.", "Necromancer utility node. Counts toward row unlocks."],
      attackSpeed: ["Spend 1 SP for +6% attack speed.", "Necromancer utility node. Counts toward row unlocks."],
      damage: ["Spend 1 SP for +8% damage.", "Necromancer utility node. Counts toward row unlocks."],
      defense: ["Spend 1 SP for +1.5 flat defense.", "Necromancer utility node. Counts toward row unlocks."]
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
    requirement: entry.locked ? getNecromancerUnlockRequirementText(game, def) : ""
  };
}

export function hasNecromancerDeathBolt(game) {
  return getNecromancerTalentPoints(game, "deathBoltActive") > 0;
}

export function getNecromancerSkillPointGainForLevel(level, classType) {
  if (classType !== "necromancer") return 1;
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  if (safeLevel < 2) return 0;
  if (safeLevel === 2) return 2;
  if (safeLevel <= 11) return 1;
  return safeLevel % 2 === 0 ? 1 : 0;
}

export function getNecromancerBlackCandleDamageBonus(game) {
  return getNecromancerTalentPoints(game, "blackCandle") * 0.05;
}

export function getNecromancerBeamDamageMultiplier(game) {
  return 1 + getNecromancerTalentPoints(game, "blackCandle") * 0.15;
}

export function getNecromancerColdCommandRanks(game) {
  return getNecromancerTalentPoints(game, "coldCommand");
}

export function getNecromancerControlledUndeadHealthBonusPct(game) {
  return getNecromancerColdCommandRanks(game) * 0.15;
}

export function getNecromancerControlledUndeadDefenseBonusPct(game) {
  return getNecromancerColdCommandRanks(game) * 0.1;
}

export function getNecromancerControlledUndeadDamageBonusPct(game) {
  return getNecromancerColdCommandRanks(game) * 0.1;
}

export function getNecromancerControlledUndeadAttackSpeedBonusPct(game) {
  return getNecromancerColdCommandRanks(game) * 0.1;
}

export function getNecromancerBaseCharmDurationForLevel(level) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const start = 1.5;
  const minimum = 0.33;
  if (safeLevel >= 10) return minimum;
  const t = Math.max(0, Math.min(1, (safeLevel - 1) / 9));
  const eased = t * t * (3 - 2 * t);
  return start + (minimum - start) * eased;
}

export function getNecromancerDeathBoltCooldownReduction(game) {
  let reduction = getNecromancerTalentPoints(game, "deathBoltMastery");
  if (getNecromancerTalentPoints(game, "harvester") > 0) reduction += 0.2 * (game?.config?.deathBolt?.cooldown || 10);
  return reduction;
}

export function getNecromancerDeathBoltDamageMultiplier(game) {
  let mult = 1 + getNecromancerBlackCandleDamageBonus(game);
  mult += getNecromancerTalentPoints(game, "deathBoltMastery") * 0.1;
  const bonusPct = game?.necromancerRuntime?.harvesterBonusPct || 0;
  return mult * (1 + bonusPct);
}

export function getNecromancerDeathBoltExplosionDamageMultiplier(game) {
  return 1 + getNecromancerBlackCandleDamageBonus(game);
}

export function getNecromancerDeathBoltZoneDurationMultiplier(game) {
  return 1 + (getNecromancerTalentPoints(game, "rotTouched") > 0 ? 0.2 : 0);
}

export function getNecromancerDeathBoltRadiusMultiplier(game) {
  let mult = 1 + (getNecromancerTalentPoints(game, "rotTouched") > 0 ? 0.1 : 0);
  if (getNecromancerTalentPoints(game, "hexcraft") >= 3) mult += 0.15;
  return mult;
}

export function getNecromancerControlCapBonus(game) {
  return getNecromancerTalentPoints(game, "controlMastery");
}

export function getNecromancerBeamHealingMultiplier(game) {
  return 1 + getNecromancerTalentPoints(game, "controlMastery") * 0.15;
}

export function getNecromancerDeathBoltGhostSpawnChance(game) {
  let chance = getNecromancerTalentPoints(game, "coldCommand") * 0.1;
  if (getNecromancerTalentPoints(game, "legionMaster") > 0) chance += 0.5;
  return Math.max(0, Math.min(1, chance));
}

export function getNecromancerDeathBoltMasteryTempHpOnKill(game) {
  return getNecromancerTalentPoints(game, "deathBoltMastery") > 0 ? 1 : 0;
}

export function getNecromancerTempHpCap(game, entity = game?.player) {
  const maxHealth = Number.isFinite(entity?.maxHealth) ? entity.maxHealth : 0;
  return Math.max(0, Math.floor(maxHealth * 0.2));
}

export function getNecromancerBeamPulseRateMultiplier(game) {
  return 1 + getNecromancerTalentPoints(game, "deathBoltMastery") * 0.15;
}


export function getNecromancerBoneWardDamageReduction(game) {
  return getNecromancerTalentPoints(game, "boneWard") >= 1 ? 0.1 : 0;
}

export function getNecromancerBoneWardDamageBonus(game, enemy, owner = game?.player) {
  if (getNecromancerTalentPoints(game, "boneWard") < 1 || !enemy || !owner) return 0;
  return Math.hypot((enemy.x || 0) - (owner.x || 0), (enemy.y || 0) - (owner.y || 0)) <= (game?.config?.map?.tile || 32) * 2 ? 0.1 : 0;
}

export function getNecromancerBoneWardReflectChance(game, enemy, owner = game?.player) {
  if (getNecromancerTalentPoints(game, "boneWard") < 1 || !enemy || !owner) return 0;
  return Math.hypot((enemy.x || 0) - (owner.x || 0), (enemy.y || 0) - (owner.y || 0)) <= (game?.config?.map?.tile || 32) * 2 ? 0.15 : 0;
}

export function hasNecromancerCurse(game) {
  return getNecromancerTalentPoints(game, "hexcraft") > 0;
}

export function getNecromancerCurseDuration(game) {
  return 3 + (getNecromancerTalentPoints(game, "hexcraft") >= 2 ? 1 : 0);
}

export function getNecromancerCurseUndeadDamageBonus(game) {
  return getNecromancerTalentPoints(game, "hexcraft") >= 2 ? 0.2 : 0;
}

export function getNecromancerRotDuration() {
  return 3;
}

export function getNecromancerRotSlowPct() {
  return 0.25;
}

export function getNecromancerRotDps(game) {
  return Math.max(1, game.getDeathBoltBaseDamage() * 0.12);
}

export function hasNecromancerExplodingDeath(game) {
  return getNecromancerTalentPoints(game, "explodingDeath") > 0;
}

export function getNecromancerExplodingDeathDamage() {
  return 5;
}

export function getNecromancerExplodingDeathRadiusTiles() {
  return 2;
}

export function getNecromancerVigorDefenseBonusPct(game) {
  return (game?.necromancerRuntime?.vigorTimer || 0) > 0 ? 0.15 : 0;
}

export function getNecromancerVigorMoveSpeedBonusPct(game) {
  return (game?.necromancerRuntime?.vigorTimer || 0) > 0 ? 0.25 : 0;
}

export function getNecromancerVigorBeamDamageMultiplier(game) {
  return (game?.necromancerRuntime?.vigorBeamTimer || 0) > 0 ? 1.35 : 1;
}

export function getNecromancerVigorHealFraction() {
  return 0.15;
}

export function hasNecromancerPlaguecraftRot(game) {
  return getNecromancerTalentPoints(game, "plaguecraft") >= 1;
}

export function hasNecromancerPlaguecraftDeathBurst(game) {
  return getNecromancerTalentPoints(game, "plaguecraft") >= 2;
}

export function getNecromancerPlaguecraftRiseChance(game) {
  return getNecromancerTalentPoints(game, "plaguecraft") >= 3 ? 0.2 : 0;
}

export function hasNecromancerHarvester(game) {
  return getNecromancerTalentPoints(game, "harvester") > 0;
}

export function hasNecromancerLegionMaster(game) {
  return getNecromancerTalentPoints(game, "legionMaster") > 0;
}

export function hasNecromancerBlightstorm(game) {
  return getNecromancerTalentPoints(game, "blightstorm") > 0;
}

export function getNecromancerBlackCandleCursedBeamBonus(game, enemy) {
  return getNecromancerTalentPoints(game, "blackCandle") > 0 && (enemy?.curseTimer || 0) > 0 ? 0.1 : 0;
}

export function getNecromancerRotTouchedRetaliationDamage(game) {
  return getNecromancerTalentPoints(game, "rotTouched") > 0 ? 5 : 0;
}

export function getNecromancerGhostLifeSteal(game) {
  return hasNecromancerLegionMaster(game) ? 0.002 : 0;
}
