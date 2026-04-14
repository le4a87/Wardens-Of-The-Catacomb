const RANGER_ROW_REQUIREMENTS = {
  0: 0,
  1: 1,
  2: 3,
  3: 8,
  4: 14
};

const RANGER_LANE_ORDER = {
  sharpshooter: 0,
  skirmisher: 1,
  warden: 2
};

const RANGER_TALENT_DEFS = [
  {
    key: "fireArrowActive",
    label: "Fire Arrow",
    row: 0,
    lane: "core",
    maxRanks: 1,
    icon: "FA",
    color: "#d88042",
    description: [
      "Unlocks the ranger right-click skill.",
      "Launch a fire arrow that explodes on impact."
    ]
  },
  {
    key: "keenSight",
    label: "Keen Sight",
    row: 1,
    lane: "sharpshooter",
    maxRanks: 3,
    icon: "KS",
    color: "#8eb8ff",
    description: [
      "+3% projectile speed per rank.",
      "+3% ranged damage per rank.",
      "+4% crit chance per rank."
    ]
  },
  {
    key: "multiShotArrow",
    label: "Multi-Shot Arrow",
    row: 1,
    lane: "skirmisher",
    maxRanks: 3,
    icon: "MS",
    color: "#78dcb6",
    description: [
      "+1 extra arrow per rank.",
      "+25% trap perception per rank.",
      "+25% hidden-monster perception per rank.",
      "Perception gameplay is scaffolded for now."
    ]
  },
  {
    key: "kindling",
    label: "Kindling",
    row: 1,
    lane: "warden",
    maxRanks: 3,
    icon: "KI",
    color: "#ff9b52",
    description: [
      "+10% ignite chance per rank.",
      "+6% fire arrow radius per rank."
    ]
  },
  {
    key: "pinningShot",
    label: "Pinning Shot",
    row: 2,
    lane: "sharpshooter",
    maxRanks: 1,
    icon: "PS",
    color: "#88b4ff",
    description: [
      "Fire Arrow replaces its circle with a 4-tile burning line.",
      "The line starts at detonation and extends forward in the shot direction.",
      "Enemies in the line are slowed by 25%.",
      "Arrows that pass through the line deal 10% more damage."
    ]
  },
  {
    key: "fleetstep",
    label: "Fleetstep",
    row: 2,
    lane: "skirmisher",
    maxRanks: 1,
    icon: "FS",
    color: "#7ad39f",
    description: [
      "+12% move speed.",
      "+6% max health.",
      "+15% dodge. Dodge gameplay is scaffolded for now."
    ]
  },
  {
    key: "fireMastery",
    label: "Fire Mastery",
    row: 2,
    lane: "warden",
    maxRanks: 1,
    icon: "FM",
    color: "#ffba5d",
    description: [
      "Fire Arrow detonates at the clicked point, like Death Bolt.",
      "Without Pinning Shot it remains a circle.",
      "With Pinning Shot you place the start of the line.",
      "Fire Arrow ground effects last twice as long.",
      "+10% Fire Arrow impact damage."
    ]
  },
  {
    key: "linebreaker",
    label: "Linebreaker",
    row: 3,
    lane: "sharpshooter",
    maxRanks: 3,
    icon: "LB",
    color: "#aac7ff",
    description: [
      "While stationary, gain +25% pierce chance per rank.",
      "Arrows gain +10% damage per enemy already struck per rank."
    ]
  },
  {
    key: "danceOfThorns",
    label: "Dance of Thorns",
    row: 3,
    lane: "skirmisher",
    maxRanks: 3,
    icon: "DT",
    color: "#8ee1c6",
    description: [
      "After 6s of continuous movement, gain the Dance of Thorns buff.",
      "Rank 1: +6% attack speed.",
      "Rank 2: +5% defense and 10 retaliatory damage on hit.",
      "Rank 3: +8% damage."
    ]
  },
  {
    key: "volleycraft",
    label: "Volleycraft",
    row: 3,
    lane: "warden",
    maxRanks: 3,
    icon: "VC",
    color: "#ffc36e",
    description: [
      "-1.0s Fire Arrow cooldown per rank.",
      "+8% fire damage per rank.",
      "+10% Fire Arrow damage per rank.",
      "Increase Fire Arrow projectile size per rank."
    ]
  },
  {
    key: "trickShot",
    label: "Trick Shot",
    row: 4,
    lane: "sharpshooter",
    maxRanks: 1,
    icon: "TS",
    color: "#d6e4ff",
    description: [
      "Basic arrows can ricochet off walls twice if they have not hit an enemy yet."
    ]
  },
  {
    key: "foxstep",
    label: "Foxstep",
    row: 4,
    lane: "skirmisher",
    maxRanks: 1,
    icon: "FX",
    color: "#b7f4dc",
    description: [
      "Passive sustain capstone.",
      "Below 50% HP, halve incoming damage and heal 50% max HP over 15s.",
      "Triggers at most once every 90s."
    ]
  },
  {
    key: "wildfire",
    label: "Wildfire",
    row: 4,
    lane: "warden",
    maxRanks: 1,
    icon: "WV",
    color: "#ffd18d",
    description: [
      "Without Pinning Shot, Fire Arrow radius is increased by 50%.",
      "With Pinning Shot, the line grows from 4 tiles to 8 tiles.",
      "+20% fire damage.",
      "Burning enemies take 15% more arrow damage.",
      "Burning enemies can spread fire to nearby enemies."
    ]
  }
];

const DEF_BY_KEY = Object.fromEntries(RANGER_TALENT_DEFS.map((def) => [def.key, def]));

export function createRangerTalentState() {
  return Object.fromEntries(
    RANGER_TALENT_DEFS.map((def) => [
      def.key,
      {
        key: def.key,
        points: 0,
        maxPoints: def.maxRanks
      }
    ])
  );
}

export function cloneRangerTalentState(source = null) {
  const next = createRangerTalentState();
  if (!source || typeof source !== "object") return next;
  for (const [key, node] of Object.entries(next)) {
    const raw = source[key];
    if (!raw || typeof raw !== "object") continue;
    if (Number.isFinite(raw.points)) node.points = Math.max(0, Math.min(node.maxPoints, Math.floor(raw.points)));
  }
  return next;
}

export function getRangerTalentDefs() {
  return RANGER_TALENT_DEFS.map((def) => ({ ...def }));
}

export function getRangerTalentDef(key) {
  return DEF_BY_KEY[key] ? { ...DEF_BY_KEY[key] } : null;
}

export function isRangerTalentGame(game) {
  return !!game && typeof game.isArcherClass === "function" && game.isArcherClass();
}

export function getRangerTalentPoints(game, key) {
  const points = game?.rangerTalents?.[key]?.points;
  return Number.isFinite(points) ? Math.max(0, points) : 0;
}

export function getRangerUtilityKeys() {
  return ["moveSpeed", "attackSpeed", "damage", "defense"];
}

export function getRangerUtilityLevel(game, key) {
  const level = game?.upgrades?.[key]?.level;
  return Number.isFinite(level) ? Math.max(0, Math.min(4, Math.floor(level))) : 0;
}

export function getRangerSpentSkillPoints(game) {
  let total = 0;
  for (const key of getRangerUtilityKeys()) total += getRangerUtilityLevel(game, key);
  for (const def of RANGER_TALENT_DEFS) total += getRangerTalentPoints(game, def.key);
  return total;
}

export function getRangerAvailableSkillPoints(game) {
  return Number.isFinite(game?.skillPoints) ? Math.max(0, game.skillPoints) : 0;
}

export function getRangerRowRequirement(row) {
  return Number.isFinite(RANGER_ROW_REQUIREMENTS[row]) ? RANGER_ROW_REQUIREMENTS[row] : 0;
}

export function isRangerRowAccessible(game, row) {
  return getRangerSpentSkillPoints(game) >= getRangerRowRequirement(row);
}

export function getRangerLaneSpent(game, lane) {
  let total = 0;
  for (const def of RANGER_TALENT_DEFS) {
    if (def.lane !== lane) continue;
    total += getRangerTalentPoints(game, def.key);
  }
  return total;
}

export function getRangerUnlockRequirementText(game, def) {
  if (!def) return "";
  if (def.row === 0) return "Available immediately.";
  if (def.row === 1) {
    if (getRangerTalentPoints(game, "fireArrowActive") > 0) return "Available now.";
    return "Requires Fire Arrow first.";
  }
  const previousRowOptions = getRangerPreviousRowOptions(def);
  if (def.row === 4) {
    const capstonesSpent = getRangerSelectedCapstones(game);
    const neededTotal = capstonesSpent <= 0 ? 14 : 20;
    if (previousRowOptions.length > 0 && !previousRowOptions.some((key) => getRangerTalentPoints(game, key) > 0)) {
      const labels = previousRowOptions.map((key) => getRangerTalentDef(key)?.label || key).join(" or ");
      return `Requires ${labels} first.`;
    }
    if (getRangerSpentSkillPoints(game) < neededTotal) return `Requires ${neededTotal} total points spent.`;
    if (capstonesSpent >= 2) return "Capstone limit reached.";
    return capstonesSpent <= 0 ? "Select your first capstone." : "Select your second capstone.";
  }
  if (previousRowOptions.length > 0 && !previousRowOptions.some((key) => getRangerTalentPoints(game, key) > 0)) {
    const labels = previousRowOptions.map((key) => getRangerTalentDef(key)?.label || key).join(" or ");
    return `Requires ${labels} first.`;
  }
  return `Requires ${getRangerRowRequirement(def.row)} total skill points spent.`;
}

export function getRangerSelectedCapstones(game) {
  return ["trickShot", "foxstep", "wildfire"].reduce((sum, key) => sum + (getRangerTalentPoints(game, key) > 0 ? 1 : 0), 0);
}

export function canSpendRangerNode(game, key) {
  if (!isRangerTalentGame(game) || getRangerAvailableSkillPoints(game) <= 0) return false;
  const def = DEF_BY_KEY[key];
  if (!def) return false;
  const node = game?.rangerTalents?.[key];
  if (!node || node.points >= node.maxPoints) return false;
  if (def.row === 0) return true;
  if (getRangerTalentPoints(game, "fireArrowActive") <= 0) return false;
  if (!isRangerRowAccessible(game, def.row)) return false;
  const previousRowOptions = getRangerPreviousRowOptions(def);
  if (previousRowOptions.length > 0 && !previousRowOptions.some((nodeKey) => getRangerTalentPoints(game, nodeKey) > 0)) return false;
  if (def.row === 4) {
    const capstonesSpent = getRangerSelectedCapstones(game);
    const neededTotal = capstonesSpent <= 0 ? 14 : 20;
    if (getRangerSpentSkillPoints(game) < neededTotal) return false;
    if (capstonesSpent >= 2) return false;
  }
  return true;
}

function getRangerPreviousRowOptions(def) {
  if (!def || def.row <= 1) return [];
  const currentLaneIndex = Number.isFinite(RANGER_LANE_ORDER[def.lane]) ? RANGER_LANE_ORDER[def.lane] : 0;
  return RANGER_TALENT_DEFS.filter((entry) => {
    if (!entry || entry.row !== def.row - 1) return false;
    if (def.row === 4) return entry.lane === def.lane;
    const previousLaneIndex = Number.isFinite(RANGER_LANE_ORDER[entry.lane]) ? RANGER_LANE_ORDER[entry.lane] : 0;
    return Math.abs(previousLaneIndex - currentLaneIndex) <= 1;
  }).map((entry) => entry.key);
}

export function canSpendRangerUtility(game, key) {
  if (!isRangerTalentGame(game) || getRangerAvailableSkillPoints(game) <= 0) return false;
  if (getRangerSpentSkillPoints(game) <= 0 && getRangerTalentPoints(game, "fireArrowActive") <= 0) return false;
  const upgrade = game?.upgrades?.[key];
  return !!upgrade && Number.isFinite(upgrade.level) && upgrade.level < 4;
}

export function spendRangerNode(game, key) {
  if (!canSpendRangerNode(game, key)) return false;
  const node = game.rangerTalents[key];
  node.points += 1;
  game.skillPoints -= 1;
  return true;
}

export function spendRangerUtility(game, key) {
  if (!canSpendRangerUtility(game, key)) return false;
  game.upgrades[key].level += 1;
  game.skillPoints -= 1;
  return true;
}

export function formatLaneLabel(lane) {
  if (lane === "sharpshooter") return "Sharpshooter";
  if (lane === "skirmisher") return "Skirmisher";
  if (lane === "warden") return "Warden";
  return "Core";
}

export function getRangerTooltip(game, entry) {
  if (!entry) return null;
  if (entry.kind === "utility") {
    const labelMap = {
      moveSpeed: "Move Speed Training",
      attackSpeed: "Attack Speed Training",
      damage: "Damage Training",
      defense: "Defense Training"
    };
    const bodyMap = {
      moveSpeed: ["Spend 1 SP for +5% move speed.", "Ranger utility node. Counts toward row unlocks."],
      attackSpeed: ["Spend 1 SP for +6% attack speed.", "Ranger utility node. Counts toward row unlocks."],
      damage: ["Spend 1 SP for +8% damage.", "Ranger utility node. Counts toward row unlocks."],
      defense: ["Spend 1 SP for +1.5 flat defense.", "Ranger utility node. Counts toward row unlocks."]
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
    requirement: entry.locked ? getRangerUnlockRequirementText(game, def) : ""
  };
}

export function getRangerCritChance(game) {
  return getRangerTalentPoints(game, "keenSight") * 0.04;
}

export function getRangerCritMultiplier() {
  return 1.5;
}

export function getRangerProjectileSpeedBonus(game) {
  return getRangerTalentPoints(game, "keenSight") * 0.03;
}

export function getRangerDamageBonus(game) {
  let total = getRangerTalentPoints(game, "keenSight") * 0.03;
  if (hasDanceOfThornsBuff(game)) total += getRangerTalentPoints(game, "danceOfThorns") >= 3 ? 0.08 : 0;
  return total;
}

export function getRangerMoveSpeedBonus(game) {
  return getRangerTalentPoints(game, "fleetstep") > 0 ? 0.12 : 0;
}

export function getRangerMaxHealthBonusPct(game) {
  return getRangerTalentPoints(game, "fleetstep") > 0 ? 0.06 : 0;
}

export function getRangerDodgeChance(game) {
  return getRangerTalentPoints(game, "fleetstep") > 0 ? 0.15 : 0;
}

export function getRangerIgniteChance(game) {
  return getRangerTalentPoints(game, "kindling") * 0.1;
}

export function getRangerFireDamageBonus(game) {
  let bonus = getRangerTalentPoints(game, "volleycraft") * 0.08;
  if (getRangerTalentPoints(game, "wildfire") > 0) bonus += 0.2;
  return bonus;
}

export function getRangerFireRadiusBonus(game) {
  let bonus = getRangerTalentPoints(game, "kindling") * 0.06;
  if (getRangerTalentPoints(game, "wildfire") > 0 && getRangerTalentPoints(game, "pinningShot") <= 0) bonus += 0.5;
  return bonus;
}

export function getRangerPinningShotLengthTiles(game) {
  return getRangerTalentPoints(game, "wildfire") > 0 ? 8 : 4;
}

export function hasPinningShot(game) {
  return getRangerTalentPoints(game, "pinningShot") > 0;
}

export function hasFireMastery(game) {
  return getRangerTalentPoints(game, "fireMastery") > 0;
}

export function hasTrickShot(game) {
  return getRangerTalentPoints(game, "trickShot") > 0;
}

export function hasFoxstep(game) {
  return getRangerTalentPoints(game, "foxstep") > 0;
}

export function hasWildfireVolley(game) {
  return getRangerTalentPoints(game, "wildfire") > 0;
}

export function getRangerMultishotBonus(game) {
  return getRangerTalentPoints(game, "multiShotArrow");
}

export function getRangerVolleyCooldownReduction(game) {
  return getRangerTalentPoints(game, "volleycraft") * 1;
}

export function getRangerFireArrowProjectileSizeBonus(game) {
  return getRangerTalentPoints(game, "volleycraft") * 1.5;
}

export function getRangerFireArrowDamageBonus(game) {
  return getRangerTalentPoints(game, "volleycraft") * 0.1;
}

export function getRangerStationaryPierceBonus(game) {
  return getRangerTalentPoints(game, "linebreaker") * 0.25;
}

export function getRangerLinebreakerDamagePerHit(game) {
  return getRangerTalentPoints(game, "linebreaker") * 0.1;
}

export function hasDanceOfThornsBuff(game) {
  return (Number.isFinite(game?.rangerDanceOfThornsTimer) ? game.rangerDanceOfThornsTimer : 0) > 0;
}

export function getRangerDanceAttackSpeedBonus(game) {
  return hasDanceOfThornsBuff(game) && getRangerTalentPoints(game, "danceOfThorns") >= 1 ? 0.06 : 0;
}

export function getRangerDanceDefenseBonus(game) {
  return hasDanceOfThornsBuff(game) && getRangerTalentPoints(game, "danceOfThorns") >= 2 ? 0.05 : 0;
}

export function getRangerFireArrowDurationMultiplier(game) {
  return hasFireMastery(game) ? 2 : 1;
}

export function getRangerFireArrowImpactMultiplier(game) {
  let mult = 1 + getRangerFireDamageBonus(game) + getRangerFireArrowDamageBonus(game);
  if (hasFireMastery(game)) mult += 0.1;
  return mult;
}

export function shouldSpreadWildfire(game) {
  return hasWildfireVolley(game);
}

export function isEnemyBurning(game, enemy) {
  if (!game || !enemy) return false;
  if ((enemy.burningTimer || 0) > 0) return true;
  for (const zone of game.fireZones || []) {
    if (!zone || zone.life <= 0) continue;
    if (zone.zoneType && zone.zoneType !== "fire" && zone.zoneType !== "pinningFire") continue;
    const radius = Number.isFinite(zone.radius) ? zone.radius : 0;
    const dx = (enemy.x || 0) - (zone.x || 0);
    const dy = (enemy.y || 0) - (zone.y || 0);
    if (Math.hypot(dx, dy) <= radius + (enemy.size || 20) * 0.3) return true;
  }
  return false;
}

export function getRangerArrowBonusAgainstEnemy(game, enemy) {
  if (!isEnemyBurning(game, enemy)) return 1;
  return hasWildfireVolley(game) ? 1.15 : 1;
}

export function getRangerSkillPointGainForLevel(level, classType) {
  if (classType !== "archer") return 1;
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  if (safeLevel < 2) return 0;
  if (safeLevel === 2) return 2;
  if (safeLevel <= 11) return 1;
  return safeLevel % 2 === 0 ? 1 : 0;
}
