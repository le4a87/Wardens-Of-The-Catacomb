const MASTER_VOLUME_STORAGE_KEY = "wardens.masterVolume";
const DEFAULT_MASTER_VOLUME = 0.25;

export function normalizeMasterVolume(value, fallback = DEFAULT_MASTER_VOLUME) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

export function getStoredMasterVolume(storage = globalThis?.localStorage) {
  try {
    const raw = storage?.getItem?.(MASTER_VOLUME_STORAGE_KEY);
    if (raw == null || raw === "") return DEFAULT_MASTER_VOLUME;
    return normalizeMasterVolume(raw, DEFAULT_MASTER_VOLUME);
  } catch {
    return DEFAULT_MASTER_VOLUME;
  }
}

export function persistMasterVolume(volume, storage = globalThis?.localStorage) {
  try {
    storage?.setItem?.(MASTER_VOLUME_STORAGE_KEY, String(normalizeMasterVolume(volume)));
  } catch {}
}

export function syncGlobalMasterVolume(volume) {
  if (typeof window === "undefined") return;
  window.__WOTC_MASTER_VOLUME__ = normalizeMasterVolume(volume);
}
