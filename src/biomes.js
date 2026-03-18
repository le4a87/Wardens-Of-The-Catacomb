import { createCastleMap, createSewerMap } from "./mapGenerator.js";

const CATACOMB_COLORS = {
  floorBase: "#141821",
  floorInsetA: "#1b202b",
  floorInsetB: "#191e28",
  floorStroke: "#202634",
  wallOuter: "#262a37",
  wallInner: "#2f3445",
  wallBands: "#3a4054",
  wallAccent: "#4f2230",
  wallAccentMetal: "#d7a54c",
  doorFrame: "#3b2b1d",
  doorInner: "#6b4a2e",
  doorClosed: "#8f5a39",
  doorClosedMark: "#b47a4c",
  doorOpenGlowInner: "rgba(132, 255, 188, 0.7)",
  doorOpenGlowOuter: "rgba(65, 149, 109, 0)",
  doorOpenFill: "#4f9f6f",
  breakableShadow: "rgba(0, 0, 0, 0.3)",
  crateFill: "#7d5634",
  crateStroke: "#a57a4f",
  boxFill: "#6d4b2e",
  boxStroke: "#8f6a43",
  boxBand: "#b38b5f",
  trapBase: "#4b1714",
  trapFill: "#c43e34",
  trapStroke: "#ff9d82"
};

const SEWER_COLORS = {
  floorBase: "#b9bcbc",
  floorInsetA: "#c9cccc",
  floorInsetB: "#a9adad",
  floorStroke: "#7c8585",
  wallOuter: "#303335",
  wallInner: "#3b4042",
  wallBands: "#4a4f51",
  wallAccent: "#5b7d46",
  wallAccentMetal: "#7aa862",
  wallMoss: "#5f8a48",
  wallMossDark: "#3f5f2f",
  sewerWater: "#447b6f",
  sewerWaterDark: "#29554c",
  sewerFoam: "rgba(198, 239, 224, 0.32)",
  sewerPool: "#4e8c7e",
  sewerPoolDark: "#325a52",
  grateFrame: "#4d5356",
  grateBars: "#2f3437",
  rivulet: "#5f9689",
  breakableShadow: "rgba(0, 0, 0, 0.24)",
  crateFill: "#735235",
  crateStroke: "#98724e",
  trashcanBody: "#78868a",
  trashcanLid: "#95a3a7",
  trashcanRim: "#495459",
  trapBase: "#315a27",
  trapFill: "#58ab42",
  trapStroke: "#bdf58e",
  acidGlow: "rgba(116, 226, 76, 0.28)",
  acidCore: "#7be14e",
  acidEdge: "#325f22"
};

export const BIOMES = {
  catacomb: {
    key: "catacomb",
    label: "Catacomb",
    description: "The current crypt layout with stone corridors, arrow traps, and wooden breakables.",
    mapGenerator: createCastleMap,
    colors: CATACOMB_COLORS,
    traps: {
      wall: {
        minCount: 5,
        maxCount: 12,
        sightRangeTiles: 8,
        detectRangeTiles: 12,
        detectForwardChance: 0.5,
        initialArmDelay: 5,
        resetMin: 10,
        resetMax: 30,
        projectileSpeed: 520,
        projectileLife: 1.6,
        projectileSize: 10
      }
    },
    breakables: {
      spawnChance: 0.018,
      maxCount: 160,
      minDistanceFromPlayerTiles: 5,
      dropGoldRate: 0.04,
      dropHealthRate: 0.02,
      goldMin: 2,
      goldMax: 9,
      types: ["crate", "box"],
      mimicSourceTypes: ["box"],
      allowedTiles: [".", "P", "D", "K"]
    },
    specialRules: {}
  },
  sewer: {
    key: "sewer",
    label: "Sewer",
    description: "Three flooded sewer halls with dry offshoot rooms, grates, moss, and hidden gelatinous cube pools.",
    mapGenerator: createSewerMap,
    colors: SEWER_COLORS,
    traps: {
      wall: {
        trapType: "poison",
        minCount: 4,
        maxCount: 10,
        sightRangeTiles: 7,
        detectRangeTiles: 12,
        detectForwardChance: 0.45,
        initialArmDelay: 5,
        resetMin: 11,
        resetMax: 24,
        acidDuration: 5,
        acidRadius: 12,
        acidSpacingTiles: 0.9,
        acidMaxSegments: 8
      }
    },
    breakables: {
      spawnChance: 0.02,
      maxCount: 140,
      minDistanceFromPlayerTiles: 5,
      dropGoldRate: 0.04,
      dropHealthRate: 0.02,
      goldMin: 2,
      goldMax: 9,
      types: ["trashcan", "crate"],
      mimicSourceTypes: ["crate"],
      allowedTiles: [".", "g", "r", "P", "D", "K"]
    },
    specialRules: {
      ratArcherSpawnMultiplier: 3,
      ratArcherCapBonus: 5,
      armorStandVariant: "sewer_pool",
      animatedArmorVariant: "gel_cube",
      armorStandPlacementTiles: ["o"],
      armorStandSize: 24
    }
  }
};

export const DEFAULT_BIOME_KEY = "catacomb";

function mergeObjects(base, override) {
  if (!override || typeof override !== "object") return { ...(base || {}) };
  const merged = { ...(base || {}) };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      merged[key] = mergeObjects(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export function getBiomeDefinition(key) {
  if (typeof key === "string" && BIOMES[key]) return BIOMES[key];
  return BIOMES[DEFAULT_BIOME_KEY];
}

export function getBiomeKey(key) {
  return getBiomeDefinition(key).key;
}

export function mergeBiomeSection(base, biomeSection) {
  return mergeObjects(base, biomeSection);
}
