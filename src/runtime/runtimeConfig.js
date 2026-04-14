const DEFAULT_WS_PORT = 8090;
export const SERVER_URL_OVERRIDE_STORAGE_KEY = "wotcServerUrlOverride";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  }
  return fallback;
}

export function getRuntimeConfig(config = globalThis?.__WOTC_CONFIG__) {
  return config && typeof config === "object" ? config : {};
}

export function getRuntimePlatform(config = globalThis?.__WOTC_CONFIG__) {
  return normalizeString(getRuntimeConfig(config).platform);
}

export function getRuntimeDefaultWsUrl(config = globalThis?.__WOTC_CONFIG__) {
  return normalizeString(getRuntimeConfig(config).defaultWsUrl);
}

export function getRuntimeLeaderboardApiUrl(config = globalThis?.__WOTC_CONFIG__) {
  return normalizeString(getRuntimeConfig(config).leaderboardApiUrl);
}

function tryDeriveLeaderboardApiUrlFromWsUrl(wsUrl) {
  const normalized = normalizeString(wsUrl);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "ws:") parsed.protocol = "http:";
    else if (parsed.protocol === "wss:") parsed.protocol = "https:";
    else return "";
    parsed.pathname = "/api/leaderboard";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function getRuntimeAllowServerUrlOverride(config = globalThis?.__WOTC_CONFIG__) {
  return normalizeBoolean(getRuntimeConfig(config).allowServerUrlOverride, true);
}

export function getRuntimeShowGameplayAds(config = globalThis?.__WOTC_CONFIG__) {
  return normalizeBoolean(getRuntimeConfig(config).showGameplayAds, true);
}

export function inferLocalWsUrl(locationObject = globalThis?.location, port = DEFAULT_WS_PORT) {
  const hostname = normalizeString(locationObject?.hostname) || "localhost";
  const protocol = locationObject?.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${hostname}:${port}`;
}

export function resolveDefaultServerUrl({
  runtimeConfig = globalThis?.__WOTC_CONFIG__,
  locationObject = globalThis?.location,
  port = DEFAULT_WS_PORT
} = {}) {
  return getRuntimeDefaultWsUrl(runtimeConfig) || inferLocalWsUrl(locationObject, port);
}

export function resolveLeaderboardApiUrl({
  runtimeConfig = globalThis?.__WOTC_CONFIG__,
  locationObject = globalThis?.location,
  port = DEFAULT_WS_PORT
} = {}) {
  return getRuntimeLeaderboardApiUrl(runtimeConfig)
    || tryDeriveLeaderboardApiUrlFromWsUrl(getRuntimeDefaultWsUrl(runtimeConfig))
    || getRuntimeLeaderboardApiUrl(runtimeConfig)
    || inferDefaultLeaderboardApiUrl(locationObject, port);
}

function inferDefaultLeaderboardApiUrl(locationObject = globalThis?.location, port = DEFAULT_WS_PORT) {
  const protocol = locationObject?.protocol === "https:" ? "https:" : "http:";
  const hostname = normalizeString(locationObject?.hostname) || "localhost";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalhost) return `${protocol}//${hostname}:${port}/api/leaderboard`;
  if (locationObject?.origin) return `${locationObject.origin}/api/leaderboard`;
  return `${protocol}//${hostname}/api/leaderboard`;
}

export function loadStoredServerUrlOverride(storage = globalThis?.localStorage) {
  try {
    return normalizeString(storage?.getItem(SERVER_URL_OVERRIDE_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function persistStoredServerUrlOverride(value, storage = globalThis?.localStorage) {
  const normalized = normalizeString(value);
  if (!normalized) return "";
  try {
    storage?.setItem(SERVER_URL_OVERRIDE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures and keep the current session value.
  }
  return normalized;
}

export function clearStoredServerUrlOverride(storage = globalThis?.localStorage) {
  try {
    storage?.removeItem(SERVER_URL_OVERRIDE_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the current session default.
  }
}

export function persistSuccessfulServerUrlChoice(
  value,
  {
    runtimeConfig = globalThis?.__WOTC_CONFIG__,
    storage = globalThis?.localStorage,
    locationObject = globalThis?.location,
    port = DEFAULT_WS_PORT
  } = {}
) {
  const normalized = normalizeString(value);
  const defaultUrl = resolveDefaultServerUrl({ runtimeConfig, locationObject, port });
  if (!normalized || normalized === defaultUrl) {
    clearStoredServerUrlOverride(storage);
    return defaultUrl;
  }
  return persistStoredServerUrlOverride(normalized, storage);
}

export function resolveActiveServerUrl({
  inputValue = "",
  runtimeConfig = globalThis?.__WOTC_CONFIG__,
  storage = globalThis?.localStorage,
  locationObject = globalThis?.location,
  port = DEFAULT_WS_PORT
} = {}) {
  return normalizeString(inputValue)
    || loadStoredServerUrlOverride(storage)
    || resolveDefaultServerUrl({ runtimeConfig, locationObject, port });
}
