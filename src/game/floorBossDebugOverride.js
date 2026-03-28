export const FLOOR_BOSS_OVERRIDE_AUTO = "auto";

export const FLOOR_BOSS_OVERRIDE_OPTIONS = [
  { value: FLOOR_BOSS_OVERRIDE_AUTO, label: "Auto", hint: "Use the normal boss rules and seasonal chance." },
  { value: "necromancer", label: "Necromancer", hint: "Odd floors only." },
  { value: "minotaur", label: "Minotaur", hint: "Even floors only." },
  { value: "sonya", label: "Sonya", hint: "Floor 1 only." },
  { value: "leprechaun", label: "Leprechaun", hint: "Floor 1 only." }
];

const FLOOR_BOSS_OVERRIDE_STORAGE_KEY = "wardens.devBossOverride";

export function normalizeFloorBossOverride(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return FLOOR_BOSS_OVERRIDE_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : FLOOR_BOSS_OVERRIDE_AUTO;
}

export function isFloorBossVariantAllowedOnFloor(variant, floor = 1) {
  const safeFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
  const normalized = normalizeFloorBossOverride(variant);
  if (normalized === FLOOR_BOSS_OVERRIDE_AUTO) return true;
  if (normalized === "minotaur") return safeFloor % 2 === 0;
  if (normalized === "necromancer") return safeFloor % 2 === 1;
  return safeFloor === 1;
}

export function getForcedFloorBossVariant(floor = 1, override = FLOOR_BOSS_OVERRIDE_AUTO) {
  const normalized = normalizeFloorBossOverride(override);
  if (normalized === FLOOR_BOSS_OVERRIDE_AUTO) return null;
  return isFloorBossVariantAllowedOnFloor(normalized, floor) ? normalized : null;
}

export function getStoredFloorBossOverride(storage = globalThis?.localStorage) {
  try {
    return normalizeFloorBossOverride(storage?.getItem?.(FLOOR_BOSS_OVERRIDE_STORAGE_KEY));
  } catch {
    return FLOOR_BOSS_OVERRIDE_AUTO;
  }
}

export function persistFloorBossOverride(override, storage = globalThis?.localStorage) {
  try {
    storage?.setItem?.(FLOOR_BOSS_OVERRIDE_STORAGE_KEY, normalizeFloorBossOverride(override));
  } catch {}
}
