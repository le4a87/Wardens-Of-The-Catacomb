export const PLAYER_HANDLE_STORAGE_KEY = "wardens.playerHandle";
export const LEADERBOARD_REQUEST_TIMEOUT_MS = 5000;
export const LEADERBOARD_BOARD_SOLO = "solo";
export const LEADERBOARD_BOARD_GROUP = "group";

const CLASS_LABELS = {
  archer: "Elvish Archer",
  fighter: "Castle Warrior",
  warrior: "Castle Warrior",
  necromancer: "Reformed Necromancer"
};

export function sanitizePlayerHandle(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 20);
  return normalized || fallback;
}

export function normalizeLeaderboardBoardType(value) {
  return value === LEADERBOARD_BOARD_GROUP ? LEADERBOARD_BOARD_GROUP : LEADERBOARD_BOARD_SOLO;
}

export function loadStoredPlayerHandle(storage = globalThis?.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return "";
  try {
    return sanitizePlayerHandle(storage.getItem(PLAYER_HANDLE_STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

export function persistPlayerHandle(handle, storage = globalThis?.localStorage) {
  if (!storage || typeof storage.setItem !== "function") return false;
  const normalized = sanitizePlayerHandle(handle);
  if (!normalized) return false;
  try {
    storage.setItem(PLAYER_HANDLE_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export function getDefaultLeaderboardApiUrl(locationObject = globalThis?.location) {
  const protocol = locationObject?.protocol === "https:" ? "https:" : "http:";
  const hostname = locationObject?.hostname || "localhost";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalhost) return `${protocol}//${hostname}:8090/api/leaderboard`;
  if (locationObject?.origin) return `${locationObject.origin}/api/leaderboard`;
  return `${protocol}//${hostname}/api/leaderboard`;
}

export function getClassLabel(classType) {
  return CLASS_LABELS[classType] || CLASS_LABELS.archer;
}

export function compareLeaderboardEntries(a, b) {
  const scoreDiff = (Number.isFinite(b?.score) ? b.score : 0) - (Number.isFinite(a?.score) ? a.score : 0);
  if (scoreDiff !== 0) return scoreDiff;
  const floorDiff = (Number.isFinite(b?.floorReached) ? b.floorReached : 0) - (Number.isFinite(a?.floorReached) ? a.floorReached : 0);
  if (floorDiff !== 0) return floorDiff;
  const timeDiff = (Number.isFinite(b?.timeSeconds) ? b.timeSeconds : 0) - (Number.isFinite(a?.timeSeconds) ? a.timeSeconds : 0);
  if (timeDiff !== 0) return timeDiff;
  return (Number.isFinite(a?.submittedAt) ? a.submittedAt : 0) - (Number.isFinite(b?.submittedAt) ? b.submittedAt : 0);
}

export function normalizeLeaderboardRow(row = {}) {
  const boardType = normalizeLeaderboardBoardType(row.boardType);
  const handles = Array.isArray(row.handles) && row.handles.length > 0
    ? row.handles.map((handle) => sanitizePlayerHandle(handle, "Player")).filter((handle) => !!handle)
    : [sanitizePlayerHandle(row.handle, "Player")];
  const classTypes = Array.isArray(row.classTypes) && row.classTypes.length > 0
    ? row.classTypes.map((classType) => (
      classType === "fighter" || classType === "warrior" || classType === "necromancer"
        ? (classType === "warrior" ? "fighter" : classType)
        : "archer"
    ))
    : [row.classType === "fighter" || row.classType === "warrior" || row.classType === "necromancer"
      ? (row.classType === "warrior" ? "fighter" : row.classType)
      : "archer"];
  return {
    boardType,
    handle: handles[0] || "Player",
    classType: classTypes[0] || "archer",
    handles,
    classTypes,
    score: Number.isFinite(row.score) ? Math.max(0, Math.floor(row.score)) : 0,
    timeSeconds: Number.isFinite(row.timeSeconds) ? Math.max(0, Math.floor(row.timeSeconds)) : 0,
    floorReached: Number.isFinite(row.floorReached) ? Math.max(1, Math.floor(row.floorReached)) : 1,
    submittedAt: Number.isFinite(row.submittedAt) ? row.submittedAt : Date.now()
  };
}

export function buildLocalRunSummary(game, handle) {
  return normalizeLeaderboardRow({
    boardType: LEADERBOARD_BOARD_SOLO,
    handle,
    classType: game?.classType,
    score: game?.score,
    timeSeconds: game?.time,
    floorReached: game?.floor,
    submittedAt: Date.now()
  });
}

export function buildGroupRunSummary(game) {
  const roster = Array.isArray(game?.networkRosterPlayers) ? game.networkRosterPlayers.filter((player) => !!player) : [];
  if (roster.length < 2) return null;
  const connectedPlayers = roster.map((player) => {
    const entity =
      typeof game?.getPlayerEntityById === "function" && player?.id
        ? game.getPlayerEntityById(player.id)
        : null;
    return {
      handle: sanitizePlayerHandle(player?.handle || player?.name, "Player"),
      classType: player?.classType,
      score: Number.isFinite(entity?.score) ? entity.score : 0
    };
  });
  return normalizeLeaderboardRow({
    boardType: LEADERBOARD_BOARD_GROUP,
    handles: connectedPlayers.map((player) => sanitizePlayerHandle(player?.handle, "Player")),
    classTypes: connectedPlayers.map((player) => player?.classType),
    score: connectedPlayers.reduce((sum, player) => sum + (Number.isFinite(player?.score) ? player.score : 0), 0),
    timeSeconds: game?.time,
    floorReached: game?.floor,
    submittedAt: Date.now()
  });
}

export function getLeaderboardHandleText(entry = {}) {
  const normalized = normalizeLeaderboardRow(entry);
  if (normalized.boardType === LEADERBOARD_BOARD_GROUP) return normalized.handles.join(", ");
  return normalized.handle;
}

export function getLeaderboardClassText(entry = {}) {
  const normalized = normalizeLeaderboardRow(entry);
  if (normalized.boardType === LEADERBOARD_BOARD_GROUP) return normalized.classTypes.map((classType) => getClassLabel(classType)).join(" / ");
  return getClassLabel(normalized.classType);
}

export function formatLeaderboardDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function requestLeaderboard(apiUrl, init = {}, boardType = LEADERBOARD_BOARD_SOLO) {
  if (!apiUrl || typeof fetch !== "function") {
    throw new Error("Leaderboard connection is unavailable.");
  }
  const normalizedBoardType = normalizeLeaderboardBoardType(boardType);
  const requestUrl = new URL(apiUrl, globalThis?.location?.href || "http://localhost");
  requestUrl.searchParams.set("board", normalizedBoardType);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), LEADERBOARD_REQUEST_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(requestUrl.toString(), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {})
      },
      signal: controller?.signal
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (!response.ok) {
      throw new Error(payload?.error || "Leaderboard request failed.");
    }
    return {
      rows: Array.isArray(payload?.rows) ? payload.rows.map(normalizeLeaderboardRow) : [],
      accepted: payload?.accepted !== false
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Leaderboard request timed out.");
    throw new Error(error instanceof Error ? error.message : "Unable to reach the leaderboard server.");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function fetchGlobalLeaderboard(apiUrl, boardType = LEADERBOARD_BOARD_SOLO) {
  return requestLeaderboard(apiUrl, { method: "GET" }, boardType);
}

export function submitLocalRunToLeaderboard(apiUrl, run) {
  const normalizedRun = normalizeLeaderboardRow(run);
  return requestLeaderboard(apiUrl, {
    method: "POST",
    body: JSON.stringify({
      boardType: normalizedRun.boardType,
      run: normalizedRun
    })
  }, normalizedRun.boardType);
}
