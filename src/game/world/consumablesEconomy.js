import {
  ACTIVE_CONSUMABLE_COOLDOWN,
  ACTIVE_CONSUMABLE_SLOT_CAP,
  PASSIVE_CONSUMABLE_SLOT_CAP,
  cloneConsumableSlots,
  getConsumableDefinition,
  getConsumablePriceForFloor,
  rollConsumableShopStock
} from "../consumables.js";

const DEFAULT_CONSUMABLE_EFFECTS = () => ({
  regenerationPotion: { timer: 0, total: 0, healPool: 0 },
  speedPotion: { timer: 0 },
  frostOil: { timer: 0 },
  fireOil: { timer: 0 },
  spikeGrowth: { timer: 0 }
});

export function ensureShopStock(game) {
  if (!Array.isArray(game.shopStock) || game.shopStock.length <= 0) {
    game.shopStock = rollConsumableShopStock(Math.max(1, Math.floor(game.floor || 1)), 5);
  }
  return game.shopStock;
}

function ensureConsumableState(game) {
  if (!game.consumables || typeof game.consumables !== "object") {
    game.consumables = {
      activeSlots: [],
      passiveSlots: [],
      sharedCooldown: 0,
      message: "",
      messageTimer: 0,
      effects: DEFAULT_CONSUMABLE_EFFECTS()
    };
  }
  if (!Array.isArray(game.consumables.activeSlots)) game.consumables.activeSlots = [];
  if (!Array.isArray(game.consumables.passiveSlots)) game.consumables.passiveSlots = [];
  if (!game.consumables.effects || typeof game.consumables.effects !== "object") {
    game.consumables.effects = DEFAULT_CONSUMABLE_EFFECTS();
  }
  return game.consumables;
}

export function pushConsumableMessage(game, text) {
  const consumables = ensureConsumableState(game);
  consumables.message = typeof text === "string" ? text : "";
  consumables.messageTimer = consumables.message ? 2.25 : 0;
}

export function getConsumableSlots(game, type) {
  const consumables = ensureConsumableState(game);
  return type === "Passive" ? consumables.passiveSlots : consumables.activeSlots;
}

export function getConsumableSlot(game, key, type = null) {
  const def = type ? { type } : getConsumableDefinition(key);
  if (!def) return null;
  const slots = getConsumableSlots(game, def.type);
  return slots.find((slot) => slot?.key === key) || null;
}

export function getConsumableOwnedCount(game, key) {
  const def = getConsumableDefinition(key);
  const slot = getConsumableSlot(game, key, def?.type);
  return Number.isFinite(slot?.count) ? slot.count : 0;
}

export function canAcquireConsumableType(game, def) {
  const slots = getConsumableSlots(game, def.type);
  const cap = def.type === "Passive" ? PASSIVE_CONSUMABLE_SLOT_CAP : ACTIVE_CONSUMABLE_SLOT_CAP;
  return slots.length < cap;
}

export function getShopFailureReason(game, key) {
  const def = getConsumableDefinition(key);
  if (!def) return "Out of stock";
  ensureShopStock(game);
  const entry = game.shopStock.find((item) => item?.key === key);
  if (!entry || entry.stock <= 0) return "Out of stock";
  const ownedCount = getConsumableOwnedCount(game, key);
  if (ownedCount >= def.maxStack) return "At max stack";
  const existing = getConsumableSlot(game, key, def.type);
  if (!existing && !canAcquireConsumableType(game, def)) {
    return def.type === "Passive" ? "No passive slot available" : "No active slot available";
  }
  const price = getConsumablePriceForFloor(def, game.floor);
  if ((game.gold || 0) < price) return "Not enough gold";
  return "";
}

export function canBuyShopItem(game, key) {
  return !getShopFailureReason(game, key);
}

function addConsumableCharge(game, def) {
  const slots = getConsumableSlots(game, def.type);
  let slot = slots.find((entry) => entry?.key === def.key);
  if (!slot) {
    slot = {
      key: def.key,
      count: 0,
      cooldownRemaining: 0
    };
    slots.push(slot);
  }
  slot.count = Math.min(def.maxStack, (slot.count || 0) + 1);
  return slot;
}

export function buyShopItem(game, key) {
  const def = getConsumableDefinition(key);
  if (!def) return false;
  const failure = getShopFailureReason(game, key);
  if (failure) {
    pushConsumableMessage(game, failure);
    return false;
  }
  const price = getConsumablePriceForFloor(def, game.floor);
  game.gold -= price;
  if (typeof game.recordRunGoldSpent === "function") game.recordRunGoldSpent(price);
  const entry = game.shopStock.find((item) => item?.key === key);
  if (entry) entry.stock = Math.max(0, (entry.stock || 0) - 1);
  addConsumableCharge(game, def);
  pushConsumableMessage(game, `${def.name} purchased`);
  return true;
}

function consumeSlotCharge(game, slot, type) {
  if (!slot) return;
  slot.count = Math.max(0, (slot.count || 0) - 1);
  if (slot.count > 0) return;
  const slots = getConsumableSlots(game, type);
  const index = slots.indexOf(slot);
  if (index >= 0) slots.splice(index, 1);
}

function showConsumableConsumedText(game, def) {
  if (!def || typeof game?.spawnFloatingText !== "function") return;
  const x = Number.isFinite(game.player?.x) ? game.player.x : 0;
  const y = Number.isFinite(game.player?.y) ? game.player.y - 42 : -42;
  game.spawnFloatingText(x, y, def.name, "#d7e4ff", 0.9, 14);
}

function getConsumableTempHp(game) {
  return Math.max(0, Number.isFinite(game.player?.consumableRuntime?.tempHp) ? game.player.consumableRuntime.tempHp : 0);
}

function setConsumableTempHp(game, amount) {
  if (!game.player.consumableRuntime || typeof game.player.consumableRuntime !== "object") {
    game.player.consumableRuntime = { tempHp: 0 };
  }
  game.player.consumableRuntime.tempHp = Math.max(0, Number.isFinite(amount) ? amount : 0);
}

function canUseConsumable(game, def) {
  if (!def) return false;
  if (def.key === "regenerationPotion") return (game.player?.health || 0) < (game.player?.maxHealth || 0);
  return true;
}

function activateConsumableEffect(game, def) {
  const effects = ensureConsumableState(game).effects;
  switch (def.key) {
    case "regenerationPotion":
      effects.regenerationPotion.timer = 10;
      effects.regenerationPotion.total = 10;
      effects.regenerationPotion.healPool = Math.max(1, (game.player?.maxHealth || 1) * 0.2);
      return true;
    case "speedPotion":
      effects.speedPotion.timer = 10;
      return true;
    case "frostOil":
      effects.frostOil.timer = 5;
      return true;
    case "fireOil":
      effects.fireOil.timer = 5;
      return true;
    case "spikeGrowth":
      effects.spikeGrowth.timer = 5;
      return true;
    case "shield":
      setConsumableTempHp(game, getConsumableTempHp(game) + 10);
      return true;
    default:
      return false;
  }
}

export function useConsumableSlot(game, slotIndex) {
  const consumables = ensureConsumableState(game);
  const index = Math.max(0, Math.floor(slotIndex));
  const slot = consumables.activeSlots[index];
  if (!slot || (slot.count || 0) <= 0) return false;
  if ((consumables.sharedCooldown || 0) > 0) {
    pushConsumableMessage(game, "Consumables on cooldown");
    return false;
  }
  const def = getConsumableDefinition(slot.key);
  if (!def || def.type !== "Active") return false;
  if (!canUseConsumable(game, def)) {
    pushConsumableMessage(game, "Cannot use now");
    return false;
  }
  const activated = activateConsumableEffect(game, def);
  if (!activated) return false;
  consumeSlotCharge(game, slot, "Active");
  showConsumableConsumedText(game, def);
  consumables.sharedCooldown = ACTIVE_CONSUMABLE_COOLDOWN;
  pushConsumableMessage(game, `${def.name} used`);
  return true;
}

export function tickConsumables(game, dt) {
  const consumables = ensureConsumableState(game);
  consumables.sharedCooldown = Math.max(0, (consumables.sharedCooldown || 0) - dt);
  consumables.messageTimer = Math.max(0, (consumables.messageTimer || 0) - dt);
  if ((consumables.messageTimer || 0) <= 0) consumables.message = "";
  for (const slot of consumables.passiveSlots) {
    slot.cooldownRemaining = Math.max(0, (slot.cooldownRemaining || 0) - dt);
  }
  const effects = consumables.effects;
  for (const key of Object.keys(effects)) {
    const effect = effects[key];
    if (!effect || typeof effect !== "object") continue;
    if (Number.isFinite(effect.timer)) effect.timer = Math.max(0, effect.timer - dt);
  }
  const regen = effects.regenerationPotion;
  if ((regen?.timer || 0) > 0 && (regen?.healPool || 0) > 0 && (game.player?.health || 0) > 0) {
    const duration = Math.max(dt, regen.total || 10);
    const healAmount = Math.min(regen.healPool, (regen.healPool / duration) * dt);
    regen.healPool = Math.max(0, regen.healPool - healAmount);
    if (healAmount > 0 && typeof game.applyPlayerHealing === "function") {
      game.applyPlayerHealing(healAmount, { suppressText: true });
    }
  } else if ((regen?.timer || 0) <= 0) {
    regen.healPool = 0;
  }
}

export function applyConsumableOnHitEffects(game, enemy, ownerId = null) {
  const effects = ensureConsumableState(game).effects;
  if ((effects.fireOil?.timer || 0) > 0) {
    enemy.burningTimer = Math.max(enemy.burningTimer || 0, 2);
    enemy.burningDps = Math.max(enemy.burningDps || 0, 1.5);
    enemy.lastDamageOwnerId = ownerId || enemy.lastDamageOwnerId || null;
  }
  if ((effects.frostOil?.timer || 0) > 0) {
    enemy.slowPct = Math.max(enemy.slowPct || 0, 0.15);
    enemy.slowTimer = Math.max(enemy.slowTimer || 0, 3);
  }
}

export function getConsumableBonusDamage(game) {
  const effects = ensureConsumableState(game).effects;
  let bonus = 0;
  if ((effects.fireOil?.timer || 0) > 0) bonus += 2;
  if ((effects.frostOil?.timer || 0) > 0) bonus += 2;
  return bonus;
}

export function applyPassiveConsumableEvent(game, eventKey, payload = {}) {
  const consumables = ensureConsumableState(game);
  const slots = cloneConsumableSlots(consumables.passiveSlots);
  let changed = false;
  for (const clonedSlot of slots) {
    const liveSlot = consumables.passiveSlots.find((entry) => entry?.key === clonedSlot.key) || null;
    if (!liveSlot || (liveSlot.count || 0) <= 0 || (liveSlot.cooldownRemaining || 0) > 0) continue;
    const def = getConsumableDefinition(liveSlot.key);
    if (!def) continue;
    if (eventKey === "lethalDamage" && def.key === "angelRing") {
      if (typeof game.applyPlayerHealing === "function") game.applyPlayerHealing((game.player?.maxHealth || 0) * 0.2, { suppressText: true });
      if (payload && typeof payload === "object") payload.preventDeath = true;
      consumeSlotCharge(game, liveSlot, "Passive");
      showConsumableConsumedText(game, def);
      changed = true;
      continue;
    }
    if (eventKey === "floorAdvance" && def.key === "monkeyPaw") {
      game.player.health = game.player.maxHealth;
      if (typeof game.gainExperience === "function") game.gainExperience(game.expToNextLevel);
      showConsumableConsumedText(game, def);
      consumables.activeSlots = [];
      consumables.passiveSlots = [];
      consumables.sharedCooldown = 0;
      pushConsumableMessage(game, "Monkey Paw triggered");
      changed = true;
      break;
    }
  }
  return changed;
}

export function refillShopForFloor(game) {
  game.shopStock = rollConsumableShopStock(Math.max(1, Math.floor(game.floor || 1)), 5);
}
