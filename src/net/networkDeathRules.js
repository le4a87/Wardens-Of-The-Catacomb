export const NETWORK_DEATH_RULES_SURVIVAL = "survival";
export const NETWORK_DEATH_RULES_FRIENDLY = "friendly";

export const NETWORK_DEATH_RULES_OPTIONS = [
  { value: NETWORK_DEATH_RULES_SURVIVAL, label: "Survival", hint: "Dead allies stay dead until the run ends." },
  { value: NETWORK_DEATH_RULES_FRIENDLY, label: "Friendly", hint: "Dead allies revive at 30% health when the floor changes." }
];

const NETWORK_DEATH_RULES_STORAGE_KEY = "wardens.networkDeathRulesMode";

export function normalizeNetworkDeathRulesMode(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return NETWORK_DEATH_RULES_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : NETWORK_DEATH_RULES_SURVIVAL;
}

export function getNetworkDeathRulesLabel(mode) {
  const normalized = normalizeNetworkDeathRulesMode(mode);
  return NETWORK_DEATH_RULES_OPTIONS.find((option) => option.value === normalized)?.label
    || NETWORK_DEATH_RULES_OPTIONS[0].label;
}

export function getNetworkDeathRulesHint(mode) {
  const normalized = normalizeNetworkDeathRulesMode(mode);
  return NETWORK_DEATH_RULES_OPTIONS.find((option) => option.value === normalized)?.hint
    || NETWORK_DEATH_RULES_OPTIONS[0].hint;
}

export function getStoredNetworkDeathRulesMode(storage = globalThis?.localStorage) {
  try {
    return normalizeNetworkDeathRulesMode(storage?.getItem?.(NETWORK_DEATH_RULES_STORAGE_KEY));
  } catch {
    return NETWORK_DEATH_RULES_SURVIVAL;
  }
}

export function persistNetworkDeathRulesMode(mode, storage = globalThis?.localStorage) {
  try {
    storage?.setItem?.(NETWORK_DEATH_RULES_STORAGE_KEY, normalizeNetworkDeathRulesMode(mode));
  } catch {}
}
