export const ACTIVE_CONSUMABLE_SLOT_CAP = 5;
export const PASSIVE_CONSUMABLE_SLOT_CAP = 3;
export const ACTIVE_CONSUMABLE_COOLDOWN = 2;

export const CONSUMABLE_DEFS = {
  regenerationPotion: {
    key: "regenerationPotion",
    name: "Regeneration Potion",
    type: "Active",
    rarity: "Common",
    triggerCondition: "N/A",
    cooldown: "Default",
    unlockFloor: 1,
    price: 100,
    maxStack: 3,
    maxInventory: 2,
    effect: "The player regenerates 20% of health over 10s"
  },
  speedPotion: {
    key: "speedPotion",
    name: "Speed Potion",
    type: "Active",
    rarity: "Common",
    triggerCondition: "N/A",
    cooldown: "Default",
    unlockFloor: 1,
    price: 100,
    maxStack: 3,
    maxInventory: 2,
    effect: "The player gains +20% movement speed for 10s"
  },
  frostOil: {
    key: "frostOil",
    name: "Frost Oil",
    type: "Active",
    rarity: "Common",
    triggerCondition: "N/A",
    cooldown: "Default",
    unlockFloor: 1,
    price: 50,
    maxStack: 3,
    maxInventory: 2,
    effect: "For the next 5s, attacks deal +2 cold damage and enemies struck are slowed by 15% for 3s"
  },
  fireOil: {
    key: "fireOil",
    name: "Fire Oil",
    type: "Active",
    rarity: "Common",
    triggerCondition: "N/A",
    cooldown: "Default",
    unlockFloor: 1,
    price: 50,
    maxStack: 3,
    maxInventory: 2,
    effect: "For the next 5s, attacks deal +2 fire damage and enemies struck burn for 2s"
  },
  spikeGrowth: {
    key: "spikeGrowth",
    name: "Spike Growth",
    type: "Active",
    rarity: "Common",
    triggerCondition: "N/A",
    cooldown: "Default",
    unlockFloor: 1,
    price: 50,
    maxStack: 3,
    maxInventory: 2,
    effect: "For 5s after activation, enemies that attack the player take +3 retaliatory damage"
  },
  shield: {
    key: "shield",
    name: "Shield",
    type: "Active",
    rarity: "Common",
    triggerCondition: "N/A",
    cooldown: "Default",
    unlockFloor: 1,
    price: 3,
    maxStack: 2,
    maxInventory: 2,
    effect: "Gain 10 temporary HP"
  },
  angelRing: {
    key: "angelRing",
    name: "Angel Ring",
    type: "Passive",
    rarity: "Rare",
    triggerCondition: "When the player would hit 0 HP",
    cooldown: "Default",
    unlockFloor: 1,
    price: 2000,
    maxStack: 1,
    maxInventory: 1,
    effect: "Heal the player for 20% HP immediately"
  },
  monkeyPaw: {
    key: "monkeyPaw",
    name: "Monkey Paw",
    type: "Passive",
    rarity: "Legendary",
    triggerCondition: "On moving to the next floor",
    cooldown: "Default",
    unlockFloor: 1,
    price: 1000,
    maxStack: 1,
    maxInventory: 1,
    effect: "Remove all consumables, fully heal the player, and immediately grant a level"
  }
};

export function getConsumableDefinition(key) {
  return CONSUMABLE_DEFS[key] || null;
}

export function getConsumableCatalog() {
  return Object.values(CONSUMABLE_DEFS);
}

export function createConsumableEffectState() {
  return {
    regenerationPotion: { timer: 0, total: 0, healPool: 0 },
    speedPotion: { timer: 0 },
    frostOil: { timer: 0 },
    fireOil: { timer: 0 },
    spikeGrowth: { timer: 0 }
  };
}

export function createConsumableInventoryState() {
  return {
    activeSlots: [],
    passiveSlots: [],
    sharedCooldown: 0,
    message: "",
    messageTimer: 0,
    effects: createConsumableEffectState()
  };
}

export function cloneConsumableSlots(slots) {
  return (Array.isArray(slots) ? slots : []).map((slot) => ({
    key: slot?.key || "",
    count: Number.isFinite(slot?.count) ? Math.max(0, Math.floor(slot.count)) : 0,
    cooldownRemaining: Number.isFinite(slot?.cooldownRemaining) ? Math.max(0, slot.cooldownRemaining) : 0
  })).filter((slot) => slot.key && slot.count > 0);
}

export function cloneConsumableInventoryState(source) {
  const next = createConsumableInventoryState();
  next.activeSlots = cloneConsumableSlots(source?.activeSlots);
  next.passiveSlots = cloneConsumableSlots(source?.passiveSlots);
  next.sharedCooldown = Number.isFinite(source?.sharedCooldown) ? Math.max(0, source.sharedCooldown) : 0;
  next.message = typeof source?.message === "string" ? source.message : "";
  next.messageTimer = Number.isFinite(source?.messageTimer) ? Math.max(0, source.messageTimer) : 0;
  next.effects = createConsumableEffectState();
  const effectKeys = Object.keys(next.effects);
  for (const key of effectKeys) {
    const src = source?.effects?.[key];
    const dst = next.effects[key];
    for (const field of Object.keys(dst)) {
      dst[field] = Number.isFinite(src?.[field]) ? Math.max(0, src[field]) : 0;
    }
  }
  return next;
}

export function createConsumableShopEntry(key, stock) {
  return {
    key,
    stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0
  };
}

function getEligibleConsumables(floor, rarity, excludeKeys = new Set()) {
  return getConsumableCatalog().filter((item) =>
    item.rarity === rarity &&
    item.unlockFloor <= floor &&
    !excludeKeys.has(item.key)
  );
}

function rollRarity() {
  const rareUpgrade = Math.random() < 0.2;
  if (!rareUpgrade) return "Common";
  const legendaryUpgrade = Math.random() < 0.2;
  return legendaryUpgrade ? "Legendary" : "Rare";
}

function chooseUniqueConsumable(floor, desiredRarity, chosenKeys) {
  const fallbackOrder =
    desiredRarity === "Legendary"
      ? ["Legendary", "Rare", "Common"]
      : desiredRarity === "Rare"
      ? ["Rare", "Common"]
      : ["Common"];
  for (const rarity of fallbackOrder) {
    const pool = getEligibleConsumables(floor, rarity, chosenKeys);
    if (pool.length <= 0) continue;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }
  const anyRemaining = getConsumableCatalog().filter((item) => item.unlockFloor <= floor && !chosenKeys.has(item.key));
  if (anyRemaining.length <= 0) return null;
  return anyRemaining[Math.floor(Math.random() * anyRemaining.length)] || null;
}

export function rollConsumableShopStock(floor, entryCount = 5) {
  const chosenKeys = new Set();
  const stock = [];
  const attempts = Math.max(entryCount * 4, 12);
  for (let i = 0; i < attempts && stock.length < entryCount; i++) {
    const desired = rollRarity();
    const item = chooseUniqueConsumable(floor, desired, chosenKeys);
    if (!item) break;
    chosenKeys.add(item.key);
    stock.push(createConsumableShopEntry(item.key, item.maxInventory));
  }
  return stock;
}

export function getConsumablePriceForFloor(def, floor) {
  const base = Number.isFinite(def?.price) ? def.price : 0;
  const scale = 1 + Math.max(0, floor - 1) * 0.15;
  return Math.max(1, Math.floor(base * scale));
}

