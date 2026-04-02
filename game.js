import { Game } from "./src/Game.js";
import { MusicController } from "./src/audio/MusicController.js";
import { NetClient } from "./src/net/NetClient.js";
import {
  applyMapStateToGame,
  applyMapMetaToGame,
  applyMapChunkToGame,
  applyMetaStateToGame,
  applySnapshotToGame,
  isKnownMapTileAt,
  syncByIdLerp
} from "./src/net/clientStateSync.js";
import { chunkKey, computeChunkReadiness } from "./src/net/mapChunkReadiness.js";
import { predictProjectileSpawn, prunePredictedProjectiles } from "./src/net/projectilePrediction.js";
import { canRunPredictedCollision, collectInput, handleNetworkUiActions, predictFromInput, setSelectedClass, shouldSendNetworkInput, updateNetworkRole } from "./src/net/sessionInteraction.js";
import {
  clearSplashRender as clearSplashCanvas,
  consumeSnapshotForRender,
  drawSplashFrame,
  estimateServerNowMs as estimateServerNowMsFromState,
  observeServerTime as observeServerTimeIntoState,
  syncIdleSoundState as syncIdleMusicState,
  syncMusicForGame as syncMusicControllerForGame
} from "./src/bootstrap/gameUiRuntime.js";
import {
  cleanupCurrentGame as cleanupCurrentGameRuntime,
  dismissSplash as dismissSplashRuntime,
  getRenderDelayMs as getRenderDelayForRole,
  handleSplashKeydown as handleSplashKeydownRuntime,
  returnToMenu as returnToMenuRuntime,
  startSplashScreen as startSplashScreenRuntime,
  updateNetworkStatus as updateNetworkStatusRuntime,
  updateRequiredChunkReadiness as updateRequiredChunkReadinessRuntime
} from "./src/bootstrap/gameUiSessionRuntime.js";
import {
  hideLeaderboardModal,
  sortLeaderboardRows,
  syncLeaderboardModal
} from "./src/bootstrap/leaderboardUiRuntime.js";
import { createLocalGame, startIdleSoundMonitor } from "./src/bootstrap/gameStartupRuntime.js";
import { applyNetworkSnapshot, startNetworkRenderLoopRuntime } from "./src/bootstrap/networkRenderRuntime.js";
import {
  getNetworkDeathRulesHint,
  getStoredNetworkDeathRulesMode,
  normalizeNetworkDeathRulesMode,
  persistNetworkDeathRulesMode
} from "./src/net/networkDeathRules.js";
import {
  FLOOR_BOSS_OVERRIDE_AUTO,
  FLOOR_BOSS_OVERRIDE_OPTIONS,
  getStoredFloorBossOverride,
  normalizeFloorBossOverride,
  persistFloorBossOverride
} from "./src/game/floorBossDebugOverride.js";
import {
  buildGroupRunSummary,
  buildLocalRunSummary,
  fetchGlobalLeaderboard,
  getDefaultLeaderboardApiUrl,
  LEADERBOARD_BOARD_GROUP,
  LEADERBOARD_BOARD_SOLO,
  loadStoredPlayerHandle,
  normalizeLeaderboardBoardType,
  persistPlayerHandle,
  sanitizePlayerHandle,
  submitLocalRunToLeaderboard
} from "./src/leaderboard/leaderboardClient.js";
import { spawnTreasureGoblin } from "./src/game/enemySpawnFactories.js";

const canvas = document.getElementById("game");
const layout = document.querySelector(".layout");
const menuPanel = document.querySelector(".menu-shell");
const modeSelectScreen = document.getElementById("mode-select");
const networkSetupScreen = document.getElementById("network-setup-screen");
const selector = document.getElementById("character-select");
const networkLobbyScreen = document.getElementById("network-lobby-screen");
const characterSelectModeLabel = document.getElementById("character-select-mode-label");
const menuSingleButton = document.getElementById("menu-single");
const menuNetworkButton = document.getElementById("menu-network");
const menuOptionsButton = document.getElementById("menu-options");
const optionsScreen = document.getElementById("options-screen");
const optionsBackButton = document.getElementById("options-back");
const menuVolumeInput = document.getElementById("menu-volume");
const menuVolumeValue = document.getElementById("menu-volume-value");
const disableAdsInput = document.getElementById("disable-ads");
const topAdBanner = document.getElementById("top-ad-banner");
const topAdImage = document.getElementById("top-ad-image");
const devBossOptionsPanel = document.getElementById("dev-boss-options");
const devBossOverrideSelect = document.getElementById("dev-boss-override");
const devBossOverrideHint = document.getElementById("dev-boss-override-hint");
const networkSetupBackButton = document.getElementById("network-setup-back");
const networkSetupNextButton = document.getElementById("network-setup-next");
const characterSelectBackButton = document.getElementById("character-select-back");
const devStartOptions = document.getElementById("dev-start-options");
const devStartFloorInput = document.getElementById("dev-start-floor");
const classButtons = Array.from(document.querySelectorAll("[data-class-option]"));
const startButton = document.getElementById("start-game");
const openLeaderboardButton = document.getElementById("open-leaderboard");
const serverUrlInput = document.getElementById("net-server-url"), roomIdInput = document.getElementById("net-room-id");
const playerNameInput = document.getElementById("net-player-name"), networkPlayerNameInput = document.getElementById("net-player-name-setup"), networkSession = document.getElementById("network-session");
const networkStatus = document.getElementById("network-status"), networkTakeControl = document.getElementById("network-take-control");
const networkLeave = document.getElementById("network-leave");
const networkLobbyRoomId = document.getElementById("network-lobby-room-id");
const networkLobbyStatusText = document.getElementById("network-lobby-status-text");
const networkLobbyInlineMessage = document.getElementById("network-lobby-inline-message");
const networkLobbyRoster = document.getElementById("network-lobby-roster");
const networkLobbyCountdown = document.getElementById("network-lobby-countdown");
const networkLobbyReadyState = document.getElementById("network-lobby-ready-state");
const networkLobbyToggleReady = document.getElementById("network-lobby-toggle-ready");
const networkLobbyLeaveTop = document.getElementById("network-lobby-leave-top");
const networkLobbyDevStartOptions = document.getElementById("network-lobby-dev-start-options");
const networkLobbyDevStartFloorInput = document.getElementById("network-lobby-dev-start-floor");
const networkLobbyGameRulesPanel = document.getElementById("network-lobby-game-rules");
const networkLobbyDeathRulesInputs = Array.from(document.querySelectorAll('input[name="network-lobby-death-rules"]'));
const networkLobbyClassButtons = Array.from(document.querySelectorAll("[data-lobby-class-option]"));
const leaderboardModal = document.getElementById("leaderboard-modal");
const leaderboardTitle = document.getElementById("leaderboard-title");
const leaderboardSubtitle = document.getElementById("leaderboard-subtitle");
const leaderboardStatus = document.getElementById("leaderboard-status");
const leaderboardClose = document.getElementById("leaderboard-close");
const leaderboardDeathActions = document.querySelector(".leaderboard-death-actions");
const leaderboardStats = document.getElementById("leaderboard-stats");
const leaderboardContinue = document.getElementById("leaderboard-continue");
const leaderboardBoardSolo = document.getElementById("leaderboard-board-solo");
const leaderboardBoardGroup = document.getElementById("leaderboard-board-group");
const leaderboardTabGlobal = document.getElementById("leaderboard-tab-global");
const leaderboardTabSession = document.getElementById("leaderboard-tab-session");
const leaderboardGlobalBody = document.getElementById("leaderboard-global-body");
const leaderboardSessionBody = document.getElementById("leaderboard-session-body");
const music = new MusicController();
const splashLogo = new Image();
const SPLASH_FADE_MS = 1800;
const MENU_MODE_SINGLE = "single";
const MENU_MODE_NETWORK = "network";
let selectedClass = "archer";
let currentGame = null, netClient = null;
let netInputTimer = 0, netRenderRaf = 0;
let netPlayerId = null, netControllerId = null;
let netRoomOwnerId = null, netPauseOwnerId = null, netRoomPhase = "active", netRosterPlayers = [];
let netJoinedRoomId = "";
let netLobbyCountdownEndsAt = 0, netLobbyInlineText = "";
let netRequestedStartFloor = 1;
let netRequestedBossOverride = FLOOR_BOSS_OVERRIDE_AUTO;
let netRequestedDeathRulesMode = getStoredNetworkDeathRulesMode();
let netPendingWsUrl = "", netPendingRoomId = "", netPendingHandle = "";
let netInputSeq = 0, netLastAckSeq = 0;
let netPendingInputs = [], netMapSignature = "", netPendingSnapshot = null;
const NET_INPUT_DT = 1 / 60;
const NET_CLOCK_OFFSET_SMOOTHING = 0.12;
const netDelayParams = new URLSearchParams(window.location.search);
function parseDelayParam(key, fallback) {
  const raw = netDelayParams.get(key);
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}
const NET_RENDER_DELAY_MS_CONTROLLER = parseDelayParam("netDelayController", 36);
const NET_RENDER_DELAY_MS_SPECTATOR = parseDelayParam("netDelaySpectator", 72);
const NET_MAX_SNAPSHOT_BUFFER = 20;
const NET_MIN_SEND_MS = 28;
const NET_FORCE_SEND_IDLE_MS = 100;
let netSnapshotBuffer = [], netLastInputSendAt = 0, netLastSentInput = null, netLastInputProcessAt = 0;
let netMapChunksReceived = 0, netMapChunkSize = 24;
let netRequiredChunkKeys = new Set(), netReceivedChunkKeys = new Set(), netLastServerPlayer = null;
const netClockState = { offsetMs: 0, ready: false };
let netPredictedProjectiles = new Map(), netNextHeldPrimaryPredictAtMs = 0;
let netLatestLocalVitals = null;
let netLastSnapshotRecvAtMs = 0, netSnapshotIntervalMeanMs = 33, netSnapshotJitterMs = 0, netLastSnapshotGapMs = 33;
let netInitialSnapshotApplied = false;
let splashActive = true, splashDismissed = false, splashRaf = 0, splashStartedAt = 0, splashReady = false;
let splashPromptReady = false;
const isDevMode = new URLSearchParams(window.location.search).get("dev") === "1";
const menuState = {
  mode: null,
  screen: "mode"
};
const leaderboardState = {
  activeBoard: LEADERBOARD_BOARD_SOLO,
  activeTab: "global",
  globalRows: {
    [LEADERBOARD_BOARD_SOLO]: [],
    [LEADERBOARD_BOARD_GROUP]: []
  },
  sessionRows: {
    [LEADERBOARD_BOARD_SOLO]: [],
    [LEADERBOARD_BOARD_GROUP]: []
  },
  loading: false,
  errorText: "",
  mode: "menu",
  open: false
};
let currentPlayerHandle = loadStoredPlayerHandle();
let selectedBossOverride = getStoredFloorBossOverride();
let selectedNetworkDeathRulesMode = getStoredNetworkDeathRulesMode();
const runtimeConfig = window.__WOTC_CONFIG__ && typeof window.__WOTC_CONFIG__ === "object" ? window.__WOTC_CONFIG__ : {};
const MIN_DEV_START_FLOOR = 1;
const MAX_DEV_START_FLOOR = 15;
const ADS_DISABLED_STORAGE_KEY = "wotcDisableAds";
const AD_ROTATION_MS = 60000;
const AD_IMAGE_SOURCES = [
  "./assets/ads/barovia.png",
  "./assets/ads/elfbucks.png",
  "./assets/ads/shark.png",
  "./assets/ads/wizards.png"
];
let adsDisabled = loadStoredAdsDisabled();
let currentAdIndex = 0;
let adRotationTimer = 0;

function normalizeDevStartingFloor(value) {
  return Math.max(MIN_DEV_START_FLOOR, Math.min(MAX_DEV_START_FLOOR, Number.parseInt(value || "1", 10) || 1));
}

function loadStoredAdsDisabled() {
  try {
    return window.localStorage.getItem(ADS_DISABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistAdsDisabled(value) {
  try {
    window.localStorage.setItem(ADS_DISABLED_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Ignore storage failures and keep the current session preference.
  }
}

function syncMenuVolumeControl() {
  if (!menuVolumeInput) return;
  const percent = Math.round(music.masterVolume * 100);
  menuVolumeInput.value = String(percent);
  if (menuVolumeValue) menuVolumeValue.textContent = `${percent}%`;
}

function syncDisableAdsControl() {
  if (!disableAdsInput) return;
  disableAdsInput.checked = !!adsDisabled;
}

function rotateTopAd(force = false) {
  if (!topAdImage || AD_IMAGE_SOURCES.length === 0) return;
  if (force) {
    currentAdIndex = Math.max(0, currentAdIndex % AD_IMAGE_SOURCES.length);
  } else {
    currentAdIndex = (currentAdIndex + 1) % AD_IMAGE_SOURCES.length;
  }
  topAdImage.src = AD_IMAGE_SOURCES[currentAdIndex];
}

function stopAdRotation() {
  if (!adRotationTimer) return;
  window.clearInterval(adRotationTimer);
  adRotationTimer = 0;
}

function startAdRotation() {
  if (adRotationTimer || AD_IMAGE_SOURCES.length <= 1) return;
  adRotationTimer = window.setInterval(() => {
    rotateTopAd();
  }, AD_ROTATION_MS);
}

function syncTopAdVisibility() {
  const shouldShow = !splashActive && !adsDisabled && AD_IMAGE_SOURCES.length > 0;
  if (topAdBanner) topAdBanner.hidden = !shouldShow;
  if (layout) layout.classList.toggle("has-top-banner", shouldShow);
  if (!shouldShow) {
    stopAdRotation();
    return;
  }
  if (topAdImage && !topAdImage.getAttribute("src")) rotateTopAd(true);
  startAdRotation();
}

function getBossOverrideHint(override) {
  const normalized = normalizeFloorBossOverride(override);
  return FLOOR_BOSS_OVERRIDE_OPTIONS.find((option) => option.value === normalized)?.hint
    || FLOOR_BOSS_OVERRIDE_OPTIONS[0].hint;
}

function syncDevBossOverrideControl() {
  if (devBossOptionsPanel) devBossOptionsPanel.hidden = !isDevMode;
  if (!devBossOverrideSelect) return;
  const normalized = normalizeFloorBossOverride(selectedBossOverride);
  devBossOverrideSelect.value = normalized;
  if (devBossOverrideHint) devBossOverrideHint.textContent = getBossOverrideHint(normalized);
}

function syncNetworkDeathRulesControl({ owner = false, roomMode = selectedNetworkDeathRulesMode } = {}) {
  if (!networkLobbyGameRulesPanel || networkLobbyDeathRulesInputs.length === 0) return;
  const normalized = normalizeNetworkDeathRulesMode(roomMode);
  for (const input of networkLobbyDeathRulesInputs) {
    if (!input) continue;
    input.disabled = !owner;
    input.checked = input.value === normalized;
  }
}

function getConfiguredWsUrl() {
  return typeof runtimeConfig.defaultWsUrl === "string" ? runtimeConfig.defaultWsUrl.trim() : "";
}

function getConfiguredLeaderboardApiUrl() {
  return typeof runtimeConfig.leaderboardApiUrl === "string" ? runtimeConfig.leaderboardApiUrl.trim() : "";
}

function waitForImageSource(src) {
  return new Promise((resolve) => {
    if (typeof src !== "string" || !src.trim()) {
      resolve();
      return;
    }
    const image = new Image();
    const finish = () => {
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
    image.src = src;
    if (image.complete) finish();
  });
}

function waitForAudioElement(audio) {
  return new Promise((resolve) => {
    if (!audio) {
      resolve();
      return;
    }
    if ((audio.readyState || 0) >= 2 || audio.error) {
      resolve();
      return;
    }
    const finish = () => {
      audio.removeEventListener("loadeddata", finish);
      audio.removeEventListener("canplaythrough", finish);
      audio.removeEventListener("error", finish);
      resolve();
    };
    audio.addEventListener("loadeddata", finish, { once: true });
    audio.addEventListener("canplaythrough", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    if (typeof audio.load === "function") audio.load();
  });
}

function preloadStartupAssets() {
  const imageSources = new Set([
    "./assets/images/logo.png",
    ...Array.from(document.querySelectorAll(".menu-shell img"))
      .map((img) => img?.getAttribute("src") || img?.currentSrc || "")
      .filter(Boolean)
  ]);
  const startupAudios = [
    ...((Array.isArray(music?.tracks) ? music.tracks : []).map((track) => track?.audio).filter(Boolean)),
    music?.deathAudio
  ].filter(Boolean);
  return Promise.all([
    ...Array.from(imageSources, (src) => waitForImageSource(src)),
    ...startupAudios.map((audio) => waitForAudioElement(audio))
  ]);
}

if (playerNameInput) {
  playerNameInput.value = currentPlayerHandle;
  playerNameInput.required = true;
}
if (networkPlayerNameInput) {
  networkPlayerNameInput.value = currentPlayerHandle;
  networkPlayerNameInput.required = true;
}
if (serverUrlInput) {
  const configuredWsUrl = getConfiguredWsUrl();
  if (configuredWsUrl) {
    serverUrlInput.value = configuredWsUrl;
  } else if (!serverUrlInput.value || serverUrlInput.value.trim() === "ws://localhost:8090") {
  const hostname = window.location?.hostname || "localhost";
  const protocol = window.location?.protocol === "https:" ? "wss" : "ws";
  serverUrlInput.value = `${protocol}://${hostname}:8090`;
  }
}

if (devStartOptions) devStartOptions.hidden = !isDevMode;
syncMenuVolumeControl();
syncDisableAdsControl();
syncDevBossOverrideControl();
if (topAdImage && AD_IMAGE_SOURCES.length > 0) rotateTopAd(true);
syncTopAdVisibility();

function setCanvasVisible(visible) {
  if (!canvas) return;
  canvas.hidden = !visible;
}

function getCharacterSelectBackLabel() {
  return menuState.mode === MENU_MODE_NETWORK ? "Back to Network Setup" : "Back to Mode Select";
}

function syncCharacterSelectCopy() {
  if (characterSelectModeLabel) {
    characterSelectModeLabel.textContent = menuState.mode === MENU_MODE_NETWORK ? "Network Game" : "Single Game";
  }
  if (characterSelectBackButton) characterSelectBackButton.textContent = getCharacterSelectBackLabel();
  if (startButton) startButton.textContent = menuState.mode === MENU_MODE_NETWORK ? "Join Network Room" : "Start Single Game";
}

function renderMenuScreen() {
  if (modeSelectScreen) modeSelectScreen.hidden = menuState.screen !== "mode";
  if (optionsScreen) optionsScreen.hidden = menuState.screen !== "options";
  if (networkSetupScreen) networkSetupScreen.hidden = menuState.screen !== "network";
  if (selector) selector.hidden = menuState.screen !== "character";
  if (networkLobbyScreen) networkLobbyScreen.hidden = menuState.screen !== "lobby";
  syncCharacterSelectCopy();
}

function showModeSelect() {
  menuState.mode = null;
  menuState.screen = "mode";
  if (menuPanel) menuPanel.hidden = false;
  if (networkSession) networkSession.hidden = true;
  setCanvasVisible(false);
  renderMenuScreen();
  syncTopAdVisibility();
}

function showNetworkSetup() {
  menuState.mode = MENU_MODE_NETWORK;
  menuState.screen = "network";
  if (menuPanel) menuPanel.hidden = false;
  if (networkSession) networkSession.hidden = true;
  setCanvasVisible(false);
  renderMenuScreen();
  syncTopAdVisibility();
}

function showOptionsScreen() {
  menuState.screen = "options";
  if (menuPanel) menuPanel.hidden = false;
  if (networkSession) networkSession.hidden = true;
  setCanvasVisible(false);
  renderMenuScreen();
  syncTopAdVisibility();
}

function showCharacterSelect(mode) {
  menuState.mode = mode;
  menuState.screen = "character";
  if (menuPanel) menuPanel.hidden = false;
  if (networkSession) networkSession.hidden = true;
  setCanvasVisible(false);
  renderMenuScreen();
  syncTopAdVisibility();
}

function showNetworkLobby() {
  menuState.mode = MENU_MODE_NETWORK;
  menuState.screen = "lobby";
  if (menuPanel) menuPanel.hidden = false;
  if (networkSession) networkSession.hidden = true;
  setCanvasVisible(false);
  renderMenuScreen();
  syncTopAdVisibility();
}

function getLeaderboardApiUrl() {
  const configuredApiUrl = getConfiguredLeaderboardApiUrl();
  if (configuredApiUrl) return configuredApiUrl;
  return getDefaultLeaderboardApiUrl(window.location);
}

function getLeaderboardRows(bucket, boardType = leaderboardState.activeBoard) {
  const normalizedBoardType = normalizeLeaderboardBoardType(boardType);
  return Array.isArray(bucket?.[normalizedBoardType]) ? bucket[normalizedBoardType] : [];
}

function setLeaderboardRows(bucket, rows, boardType = leaderboardState.activeBoard) {
  const normalizedBoardType = normalizeLeaderboardBoardType(boardType);
  bucket[normalizedBoardType] = sortLeaderboardRows(rows);
}

function getActiveHandleInput() {
  return menuState.mode === MENU_MODE_NETWORK ? networkPlayerNameInput || playerNameInput : playerNameInput || networkPlayerNameInput;
}

function syncHandleInputs(value) {
  if (playerNameInput && playerNameInput.value !== value) playerNameInput.value = value;
  if (networkPlayerNameInput && networkPlayerNameInput.value !== value) networkPlayerNameInput.value = value;
}

function syncStoredHandleFromInput() {
  currentPlayerHandle = sanitizePlayerHandle(getActiveHandleInput()?.value || "");
  syncHandleInputs(currentPlayerHandle);
  if (currentPlayerHandle) persistPlayerHandle(currentPlayerHandle);
  return currentPlayerHandle;
}

function ensurePlayerHandle() {
  const handle = syncStoredHandleFromInput();
  if (handle) return handle;
  const input = getActiveHandleInput();
  if (input) {
    input.value = "";
    input.focus();
    input.setCustomValidity("Enter a handle before starting or submitting a run.");
    input.reportValidity();
    input.setCustomValidity("");
  }
  return "";
}

function setLobbySelectedClass(classType) {
  selectedClass = setSelectedClass(classType, classButtons);
  setSelectedClass(classType, networkLobbyClassButtons);
}

function getLocalRosterEntry() {
  return Array.isArray(netRosterPlayers) ? netRosterPlayers.find((player) => player && player.id === netPlayerId) || null : null;
}

function renderNetworkLobby() {
  if (!networkLobbyScreen || menuState.screen !== "lobby") return;
  if (networkLobbyRoomId) networkLobbyRoomId.textContent = netJoinedRoomId || netPendingRoomId || "-";
  if (networkLobbyStatusText) {
    const owner = netRoomOwnerId && netPlayerId && netRoomOwnerId === netPlayerId;
    const baseStatus =
      netRoomPhase === "active"
        ? "Run starting..."
        : owner
        ? "You own this room"
        : "Waiting for the room owner";
    networkLobbyStatusText.textContent = baseStatus;
  }
  const localEntry = getLocalRosterEntry();
  if (localEntry?.classType) setLobbySelectedClass(localEntry.classType);
  if (networkLobbyReadyState) networkLobbyReadyState.textContent = localEntry?.locked ? "Ready" : "Choosing";
  if (networkLobbyToggleReady) networkLobbyToggleReady.textContent = localEntry?.locked ? "Not Ready" : "Ready";
  if (networkLobbyCountdown) {
    const remainingMs = typeof netLobbyCountdownEndsAt === "number" ? Math.max(0, netLobbyCountdownEndsAt - Date.now()) : 0;
    networkLobbyCountdown.textContent =
      remainingMs > 0 ? `Starting in ${Math.max(1, Math.ceil(remainingMs / 1000))}` : "Waiting for all players";
  }
  if (networkLobbyInlineMessage) {
    const text = typeof netLobbyInlineText === "string" ? netLobbyInlineText.trim() : "";
    networkLobbyInlineMessage.hidden = !text;
    networkLobbyInlineMessage.textContent = text;
  }
  if (networkLobbyDevStartOptions) {
    const isOwner = !!(netRoomOwnerId && netPlayerId && netRoomOwnerId === netPlayerId);
    networkLobbyDevStartOptions.hidden = !isDevMode;
    if (networkLobbyDevStartFloorInput) {
      networkLobbyDevStartFloorInput.disabled = !isOwner;
      if (document.activeElement !== networkLobbyDevStartFloorInput) {
        networkLobbyDevStartFloorInput.value = `${Math.max(1, netRequestedStartFloor || 1)}`;
      }
    }
  }
  if (networkLobbyGameRulesPanel) {
    const isOwner = !!(netRoomOwnerId && netPlayerId && netRoomOwnerId === netPlayerId);
    syncNetworkDeathRulesControl({
      owner: isOwner,
      roomMode: netRequestedDeathRulesMode
    });
  }
  if (networkLobbyRoster) {
    const rows = Array.isArray(netRosterPlayers) ? netRosterPlayers : [];
    networkLobbyRoster.innerHTML = "";
    for (const player of rows) {
      if (!player) continue;
      const row = document.createElement("article");
      row.className = `network-lobby-roster-entry${player.id === netPlayerId ? " is-local" : ""}`;
      const state = player.locked ? "Ready" : "Choosing";
      row.innerHTML = `
        <div class="network-lobby-roster-top">
          <span class="network-lobby-roster-handle" style="color:${player.color || "#f3f2ea"}">${player.handle || player.name || "Player"}</span>
          <span class="network-lobby-roster-state">${state}</span>
        </div>
        <div class="network-lobby-roster-meta">
          <span class="network-lobby-badge">${player.classType || "No Class Selected"}</span>
          ${player.isOwner ? '<span class="network-lobby-badge star">★ Owner</span>' : ""}
        </div>
      `;
      networkLobbyRoster.appendChild(row);
    }
  }
}

function getDeathReturnSecondsRemaining() {
  if (!currentGame || !currentGame.gameOver) return 0;
  const total = Number.isFinite(currentGame.deathTransitionDuration) ? currentGame.deathTransitionDuration : 10;
  const elapsed = Number.isFinite(currentGame.deathTransition?.elapsed) ? currentGame.deathTransition.elapsed : 0;
  return Math.max(0, total - elapsed);
}

function renderLeaderboardModal() {
  if (!leaderboardState.open) {
    hideLeaderboardModal(leaderboardModal);
    return;
  }
  syncLeaderboardModal({
    modal: leaderboardModal,
    title: leaderboardTitle,
    subtitle: leaderboardSubtitle,
    status: leaderboardStatus,
    closeButton: leaderboardClose,
    statsButton: leaderboardStats,
    deathActions: leaderboardDeathActions,
    continueButton: leaderboardContinue,
    activeBoard: leaderboardState.activeBoard,
    soloButton: leaderboardBoardSolo,
    groupButton: leaderboardBoardGroup,
    activeTab: leaderboardState.activeTab,
    globalButton: leaderboardTabGlobal,
    sessionButton: leaderboardTabSession,
    globalRows: getLeaderboardRows(leaderboardState.globalRows),
    sessionRows: getLeaderboardRows(leaderboardState.sessionRows),
    globalTableBody: leaderboardGlobalBody,
    sessionTableBody: leaderboardSessionBody,
    errorText: leaderboardState.errorText,
    loading: leaderboardState.loading,
    mode: leaderboardState.mode,
    remainingSeconds: getDeathReturnSecondsRemaining()
  });
}

function syncDeathLeaderboardCanvasVisibility() {
  if (!currentGame) return;
  if (leaderboardState.open && leaderboardState.mode === "death") {
    setCanvasVisible(false);
    syncTopAdVisibility();
    return;
  }
  if (menuPanel?.hidden) setCanvasVisible(true);
  syncTopAdVisibility();
}

function closeLeaderboardModal() {
  leaderboardState.open = false;
  leaderboardState.mode = "menu";
  renderLeaderboardModal();
  syncDeathLeaderboardCanvasVisibility();
  syncTopAdVisibility();
}

function resetDeathReturnCountdown(game = currentGame) {
  if (!game?.deathTransition) return;
  game.deathTransition.active = true;
  game.deathTransition.elapsed = 0;
  game.deathTransition.returnTriggered = false;
}

function openDeathStatsScreen(game = currentGame) {
  if (!game?.gameOver) return;
  leaderboardState.open = false;
  renderLeaderboardModal();
  game.statsPanelView = "run";
  game.statsPanelOpen = true;
  game.statsPanelPausedGame = false;
  if (menuPanel?.hidden) setCanvasVisible(true);
}

function returnFromDeathStatsToLeaderboard(game = currentGame) {
  if (!game?.gameOver) return;
  game.statsPanelOpen = false;
  game.statsPanelPausedGame = false;
  resetDeathReturnCountdown(game);
  openLeaderboardModal("death", leaderboardState.activeBoard);
}

function openLeaderboardModal(mode = "menu", boardType = leaderboardState.activeBoard) {
  leaderboardState.mode = mode;
  leaderboardState.activeBoard = normalizeLeaderboardBoardType(boardType);
  leaderboardState.activeTab = "global";
  leaderboardState.open = true;
  renderLeaderboardModal();
  syncDeathLeaderboardCanvasVisibility();
}

async function refreshGlobalLeaderboard(boardType = leaderboardState.activeBoard) {
  const normalizedBoardType = normalizeLeaderboardBoardType(boardType);
  leaderboardState.loading = true;
  leaderboardState.errorText = "";
  renderLeaderboardModal();
  try {
    const response = await fetchGlobalLeaderboard(getLeaderboardApiUrl(), normalizedBoardType);
    setLeaderboardRows(leaderboardState.globalRows, response.rows, normalizedBoardType);
  } catch (error) {
    leaderboardState.errorText = error instanceof Error ? error.message : String(error);
  } finally {
    leaderboardState.loading = false;
    renderLeaderboardModal();
  }
}

async function submitCompletedLocalRun(game) {
  const handle = ensurePlayerHandle();
  const run = buildLocalRunSummary(game, handle || "Player");
  setLeaderboardRows(leaderboardState.sessionRows, [...getLeaderboardRows(leaderboardState.sessionRows, LEADERBOARD_BOARD_SOLO), run], LEADERBOARD_BOARD_SOLO);
  openLeaderboardModal("death", LEADERBOARD_BOARD_SOLO);
  leaderboardState.loading = true;
  leaderboardState.errorText = "";
  renderLeaderboardModal();
  try {
    const response = await submitLocalRunToLeaderboard(getLeaderboardApiUrl(), run);
    setLeaderboardRows(leaderboardState.globalRows, response.rows, LEADERBOARD_BOARD_SOLO);
  } catch (error) {
    leaderboardState.errorText = error instanceof Error ? error.message : String(error);
  } finally {
    leaderboardState.loading = false;
    renderLeaderboardModal();
  }
}

async function showNetworkGameOverLeaderboard(game, { includeSessionRun = false } = {}) {
  const run = game ? buildGroupRunSummary(game) : null;
  if (includeSessionRun && run) {
    setLeaderboardRows(leaderboardState.sessionRows, [...getLeaderboardRows(leaderboardState.sessionRows, LEADERBOARD_BOARD_GROUP), run], LEADERBOARD_BOARD_GROUP);
  }
  openLeaderboardModal("death", LEADERBOARD_BOARD_GROUP);
  leaderboardState.loading = true;
  leaderboardState.errorText = "";
  renderLeaderboardModal();
  try {
    const isOwner = !!(game?.networkRoomOwnerId && game?.networkLocalPlayerId && game.networkRoomOwnerId === game.networkLocalPlayerId);
    const response = isOwner && run
      ? await submitLocalRunToLeaderboard(getLeaderboardApiUrl(), run)
      : await fetchGlobalLeaderboard(getLeaderboardApiUrl(), LEADERBOARD_BOARD_GROUP);
    setLeaderboardRows(leaderboardState.globalRows, response.rows, LEADERBOARD_BOARD_GROUP);
  } catch (error) {
    leaderboardState.errorText = error instanceof Error ? error.message : String(error);
  } finally {
    leaderboardState.loading = false;
    renderLeaderboardModal();
  }
}

function showNetworkGameOverLeaderboardOnce(game, { includeSessionRun = false } = {}) {
  if (!game || game.networkGameOverLeaderboardShown) return;
  game.networkGameOverLeaderboardShown = true;
  void showNetworkGameOverLeaderboard(game, { includeSessionRun });
}

if (typeof window !== "undefined") {
  function getPauseBannerText(game) {
    if (!game?.networkEnabled || !game?.paused) return "";
    const localId = typeof game.networkLocalPlayerId === "string" ? game.networkLocalPlayerId : null;
    const pauseOwnerId = typeof game.networkPauseOwnerId === "string" ? game.networkPauseOwnerId : null;
    if (!pauseOwnerId || !localId || pauseOwnerId === localId) return "";
    const roster = Array.isArray(game.networkRosterPlayers) ? game.networkRosterPlayers : [];
    const owner = roster.find((player) => player?.id === pauseOwnerId);
    const handle = typeof owner?.handle === "string" && owner.handle.trim() ? owner.handle.trim() : "Player";
    return `${handle} paused the game.`;
  }

  function runDebugCommand(action, payload = {}) {
    const game = currentGame;
    if (!game) return { ok: false, error: "no active game" };
    if (typeof action !== "string" || !action) return { ok: false, error: "missing action" };
    if (action === "spawnHostileNearPlayer") {
      const offsets = [
        [96, 0],
        [-96, 0],
        [0, 96],
        [0, -96],
        [144, 0],
        [-144, 0]
      ];
      const playerX = Number.isFinite(game.player?.x) ? game.player.x : 0;
      const playerY = Number.isFinite(game.player?.y) ? game.player.y : 0;
      const radius = Math.max(12, ((game.player?.size || 20) * 0.5));
      let spawnX = playerX + offsets[0][0];
      let spawnY = playerY + offsets[0][1];
      for (const [dx, dy] of offsets) {
        const candidateX = playerX + dx;
        const candidateY = playerY + dy;
        const walkable = typeof game.isPositionWalkable === "function"
          ? game.isPositionWalkable(candidateX, candidateY, radius, true)
          : true;
        if (!walkable) continue;
        spawnX = candidateX;
        spawnY = candidateY;
        break;
      }
      const enemy = spawnTreasureGoblin(game, spawnX, spawnY);
      if (!Array.isArray(game.enemies)) game.enemies = [];
      game.enemies.push(enemy);
      return {
        ok: true,
        enemyType: enemy.type,
        x: enemy.x,
        y: enemy.y,
        hp: enemy.hp
      };
    }
    if (action === "damageNearestHostile") {
      if (typeof game.applyEnemyDamage !== "function") return { ok: false, error: "damage API unavailable" };
      const playerX = Number.isFinite(game.player?.x) ? game.player.x : 0;
      const playerY = Number.isFinite(game.player?.y) ? game.player.y : 0;
      const enemies = Array.isArray(game.enemies) ? game.enemies : [];
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy || (enemy.hp || 0) <= 0) continue;
        if (typeof game.isEnemyFriendlyToPlayer === "function" && game.isEnemyFriendlyToPlayer(enemy)) continue;
        const dist = Math.hypot((enemy.x || 0) - playerX, (enemy.y || 0) - playerY);
        if (dist < nearestDist) {
          nearest = enemy;
          nearestDist = dist;
        }
      }
      if (!nearest) return { ok: false, error: "no hostile enemy found" };
      const amount = Number.isFinite(payload.amount) ? Math.max(0, payload.amount) : Math.max(1, nearest.hp || 1);
      const ownerId = typeof payload.ownerId === "string" && payload.ownerId ? payload.ownerId : null;
      game.applyEnemyDamage(nearest, amount, typeof payload.damageType === "string" ? payload.damageType : "debug", ownerId);
      return {
        ok: true,
        enemyId: nearest.id || null,
        amount,
        ownerId,
        enemyHpAfter: nearest.hp || 0
      };
    }
    return { ok: false, error: `unknown action: ${action}` };
  }

  window.__WOTC_DEBUG__ = {
    getState() {
      const game = currentGame;
      if (!game) return null;
      const tileSize = game.config?.map?.tile || 32;
      const playerX = Number.isFinite(game.player?.x) ? game.player.x : 0;
      const playerY = Number.isFinite(game.player?.y) ? game.player.y : 0;
      const tileX = Math.floor(playerX / tileSize);
      const tileY = Math.floor(playerY / tileSize);
      const tile =
        Array.isArray(game.map) && tileY >= 0 && tileX >= 0 && tileY < game.map.length && tileX < game.map[0].length
          ? (typeof game.map[tileY] === "string" ? game.map[tileY][tileX] : game.map[tileY][tileX])
          : null;
      const radius = Math.max(4, (game.player?.size || 20) * 0.5);
      const walkable =
        typeof game.isPositionWalkable === "function"
          ? game.isPositionWalkable(playerX, playerY, radius, true)
          : null;
      const camera = typeof game.getCamera === "function" ? game.getCamera() : { x: 0, y: 0 };
      const hostiles = Array.isArray(game.enemies)
        ? game.enemies
            .filter((enemy) => enemy && (!game.isEnemyFriendlyToPlayer || !game.isEnemyFriendlyToPlayer(enemy)) && (enemy.hp || 0) > 0)
            .map((enemy) => ({
              id: enemy.id || null,
              type: enemy.type || "",
              x: enemy.x,
              y: enemy.y,
              hp: enemy.hp,
              maxHp: enemy.maxHp,
              size: enemy.size || 0,
              distToPlayer: Math.hypot((enemy.x || 0) - playerX, (enemy.y || 0) - playerY),
              screenX: (enemy.x || 0) - camera.x,
              screenY: (enemy.y || 0) - camera.y
            }))
            .sort((a, b) => a.distToPlayer - b.distToPlayer)
            .slice(0, 12)
        : [];
      return {
        networkReady: !!game.networkReady,
        networkHasMap: !!game.networkHasMap,
        networkHasChunks: !!game.networkHasChunks,
        networkRole: game.networkRole || "",
        floor: game.floor,
        player: {
          x: playerX,
          y: playerY,
          size: game.player?.size || 0,
          alive: (game.player?.health || 0) > 0,
          health: game.player?.health || 0,
          maxHealth: game.player?.maxHealth || 0,
          hpBarTimer: game.player?.hpBarTimer || 0,
          hpBarVisible: typeof game.showPlayerHealthBar === "function" ? !!game.showPlayerHealthBar() : false,
          level: game.player?.level || 1,
          xp: Number.isFinite(game.experience) ? game.experience : (game.player?.xp || 0),
          score: game.score || 0,
          gold: game.gold || 0,
          classType: game.player?.classType || game.classType || "",
          dirX: game.player?.dirX || 0,
          dirY: game.player?.dirY || 0,
          fireCooldown: game.player?.fireCooldown || 0,
          fireArrowCooldown: game.player?.fireArrowCooldown || 0
        },
        aim: {
          x: Number.isFinite(game.input?.mouse?.worldX) ? game.input.mouse.worldX : null,
          y: Number.isFinite(game.input?.mouse?.worldY) ? game.input.mouse.worldY : null,
          hasAim: !!game.input?.mouse?.hasAim
        },
        camera,
        tile: {
          x: tileX,
          y: tileY,
          value: tile
        },
        walkable,
        hostiles,
        combat: {
          meleeSwingCount: Array.isArray(game.meleeSwings) ? game.meleeSwings.length : 0,
          bulletCount: Array.isArray(game.bullets) ? game.bullets.length : 0,
          fireArrowCount: Array.isArray(game.fireArrows) ? game.fireArrows.length : 0,
          floatingTextCount: Array.isArray(game.floatingTexts) ? game.floatingTexts.length : 0,
          recentFloatingTexts: Array.isArray(game.floatingTexts)
            ? game.floatingTexts.slice(-6).map((entry) => ({
                text: entry.text,
                color: entry.color,
                x: entry.x,
                y: entry.y,
                life: entry.life
              }))
            : [],
          ownedProjectiles: [
            ...((Array.isArray(game.bullets) ? game.bullets : [])
              .filter((projectile) => !netPlayerId || projectile.ownerId === netPlayerId)
              .slice(-8)
              .map((projectile) => ({
                source: "authoritative",
                kind: "bullet",
                x: projectile.x,
                y: projectile.y,
                vx: projectile.vx || 0,
                vy: projectile.vy || 0,
                angle: projectile.angle,
                spawnSeq: projectile.spawnSeq || 0,
                projectileType: projectile.projectileType || "bullet"
              }))),
            ...((game.networkPredictedProjectiles instanceof Map
              ? Array.from(game.networkPredictedProjectiles.values()).flat()
              : [])
              .filter((projectile) => projectile && projectile.type === "bullet")
              .slice(-8)
              .map((projectile) => ({
                source: "predicted",
                kind: projectile.type,
                x: projectile.x,
                y: projectile.y,
                vx: projectile.vx || 0,
                vy: projectile.vy || 0,
                angle: projectile.angle,
                spawnSeq: projectile.seq || 0,
                projectileType: projectile.type || "bullet",
                createdAt: projectile.createdAt || 0
              })))
          ],
          recentPlayerShots: Array.isArray(game.recentPlayerShots)
            ? game.recentPlayerShots.slice(-8).map((shot) => ({
                atMs: shot.atMs,
                source: shot.source || "",
                moving: !!shot.moving,
                playerX: shot.playerX,
                playerY: shot.playerY,
                aimX: shot.aimX,
                aimY: shot.aimY,
                predictedX: shot.predictedX,
                predictedY: shot.predictedY,
                authoritativeX: shot.authoritativeX,
                authoritativeY: shot.authoritativeY,
                intendedAngle: shot.intendedAngle,
                authoritativeAngle: shot.authoritativeAngle,
                volleyAngles: Array.isArray(shot.volleyAngles) ? shot.volleyAngles.slice() : [],
                multishotCount: shot.multishotCount || 0,
                projectileSpeed: shot.projectileSpeed || 0,
                fireCooldown: shot.fireCooldown || 0,
                rejected: !!shot.rejected,
                seq: shot.seq || shot.spawnSeq || 0
              }))
            : []
        },
        net: {
          controllerId: netControllerId,
          playerId: netPlayerId,
          roomOwnerId: netRoomOwnerId,
          pauseOwnerId: netPauseOwnerId,
          roomPhase: netRoomPhase,
          lastAckSeq: netLastAckSeq,
          lastSentSeq: netInputSeq,
          unackedInputs: Math.max(0, netInputSeq - netLastAckSeq),
          pendingInputs: netPendingInputs.length,
          snapshotBuffer: netSnapshotBuffer.length,
          pendingSnapshot: !!netPendingSnapshot,
          jitterMs: netSnapshotJitterMs,
          gapMs: netLastSnapshotGapMs,
          msSinceLastSend: netLastInputSendAt > 0 ? Math.max(0, Math.round(performance.now() - netLastInputSendAt)) : null,
          msSinceLastSnapshot: netLastSnapshotRecvAtMs > 0 ? Math.max(0, Math.round(performance.now() - netLastSnapshotRecvAtMs)) : null
        },
        networkPerf: game.networkPerf && typeof game.networkPerf === "object"
          ? {
              appliedSnapshotCount: game.networkPerf.appliedSnapshotCount || 0,
              lastCorrectionPx: game.networkPerf.lastCorrectionPx || 0,
              maxCorrectionPx: game.networkPerf.maxCorrectionPx || 0,
              hardSnapCount: game.networkPerf.hardSnapCount || 0,
              softCorrectionCount: game.networkPerf.softCorrectionCount || 0,
              settleCorrectionCount: game.networkPerf.settleCorrectionCount || 0,
              blockedSnapCount: game.networkPerf.blockedSnapCount || 0,
              lastReplayMode: game.networkPerf.lastReplayMode || "",
              lastPredictionPressure: game.networkPerf.lastPredictionPressure || null,
              projectileReconcileRejects: game.networkPerf.projectileReconcileRejects || 0,
              recentCorrections: Array.isArray(game.networkPerf.recentCorrections)
                ? game.networkPerf.recentCorrections.slice(-8)
                : []
            }
          : null,
        ui: {
          paused: !!game.paused,
          pauseBannerText: getPauseBannerText(game),
          shopOpen: !!game.shopOpen,
          skillTreeOpen: !!game.skillTreeOpen,
          statsPanelOpen: !!game.statsPanelOpen,
          gold: Number.isFinite(game.gold) ? game.gold : 0,
          skillPoints: Number.isFinite(game.skillPoints) ? game.skillPoints : 0,
          shopButton: game.uiRects?.shopButton || null,
          skillTreeButton: game.uiRects?.skillTreeButton || null,
          shopClose: game.uiRects?.shopClose || null,
          skillTreeClose: game.uiRects?.skillTreeClose || null,
          shopItems: Array.isArray(game.uiRects?.shopItems)
            ? game.uiRects.shopItems.slice(0, 4).map((entry) => ({
                key: entry.key,
                rect: entry.rect
              }))
            : [],
          skillNodes: {
            fireArrow: game.uiRects?.skillFireArrowNode || null,
            piercingStrike: game.uiRects?.skillPiercingNode || null,
            multiarrow: game.uiRects?.skillMultiarrowNode || null,
            warriorMomentum: game.uiRects?.skillWarriorMomentumNode || null,
            warriorRage: game.uiRects?.skillWarriorRageNode || null,
            warriorExecute: game.uiRects?.skillWarriorExecuteNode || null,
            undeadMastery: game.uiRects?.skillUndeadMasteryNode || null,
            deathBolt: game.uiRects?.skillDeathBoltNode || null,
            explodingDeath: game.uiRects?.skillExplodingDeathNode || null
          },
          recentUiClicks: Array.isArray(game.input?.mouse?.recentUiLeftClicks)
            ? game.input.mouse.recentUiLeftClicks.slice(-8)
            : [],
          networkUiDebug: game.networkUiDebug && typeof game.networkUiDebug === "object"
            ? {
                lastClick: game.networkUiDebug.lastClick || null,
                lastHit: game.networkUiDebug.lastHit || "",
                lastActionKind: game.networkUiDebug.lastActionKind || "",
                recentActions: Array.isArray(game.networkUiDebug.recentActions)
                  ? game.networkUiDebug.recentActions.slice(-8)
                  : []
              }
            : null
        },
        spectate: {
          targetId: typeof game.spectateTargetId === "string" ? game.spectateTargetId : null
        },
        remotePlayers: Array.isArray(game.remotePlayers)
          ? game.remotePlayers.map((player) => ({
              id: player?.id || null,
              handle: player?.handle || "",
              alive: !!player?.alive,
              health: player?.health || 0,
              maxHealth: player?.maxHealth || 0,
              level: player?.level || 1,
              classType: player?.classType || "",
              isPauseOwner: !!player?.isPauseOwner
            }))
          : [],
        audio: typeof music.getDebugState === "function" ? music.getDebugState() : null,
        documentHasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
        documentVisibilityState: typeof document.visibilityState === "string" ? document.visibilityState : ""
      };
    },
    run(action, payload) {
      return runDebugCommand(action, payload);
    }
  };
}

splashLogo.addEventListener("load", () => { splashReady = true; });
splashLogo.addEventListener("error", () => { splashReady = false; });
splashLogo.src = "./assets/images/logo.png";
if (splashLogo.complete && splashLogo.naturalWidth > 0 && splashLogo.naturalHeight > 0) splashReady = true;

function syncIdleSoundState(game) {
  syncIdleMusicState(music, splashActive, game);
}

function syncMusicForGame(game) {
  if (game?.gameOver) {
    if (!game.__deathMusicStarted) {
      game.__deathMusicStarted = true;
      syncMusicControllerForGame(music, splashActive, game);
    }
    return;
  }
  if (game) game.__deathMusicStarted = false;
  syncMusicControllerForGame(music, splashActive, game);
}

function stopNetworkSession() {
  if (netRenderRaf) {
    cancelAnimationFrame(netRenderRaf);
    netRenderRaf = 0;
  }
  if (netInputTimer) {
    clearInterval(netInputTimer);
    netInputTimer = 0;
  }
  if (netClient) {
    netClient.disconnect();
    netClient = null;
  }
  netPlayerId = null; netControllerId = null;
  netRoomOwnerId = null; netPauseOwnerId = null; netRoomPhase = "active"; netRosterPlayers = [];
  netJoinedRoomId = ""; netLobbyCountdownEndsAt = 0; netLobbyInlineText = ""; netRequestedStartFloor = 1;
  netPendingWsUrl = ""; netPendingRoomId = ""; netPendingHandle = "";
  netInputSeq = 0; netLastAckSeq = 0;
  netPendingInputs = []; netMapSignature = ""; netPendingSnapshot = null;
  netSnapshotBuffer.length = 0; netLastInputSendAt = 0; netLastSentInput = null; netLastInputProcessAt = 0;
  netMapChunksReceived = 0; netMapChunkSize = 24;
  netRequiredChunkKeys = new Set(); netReceivedChunkKeys = new Set(); netLastServerPlayer = null;
  netClockState.offsetMs = 0; netClockState.ready = false;
  netPredictedProjectiles.clear(); netNextHeldPrimaryPredictAtMs = 0;
  netLastSnapshotRecvAtMs = 0; netSnapshotIntervalMeanMs = 33; netSnapshotJitterMs = 0; netLastSnapshotGapMs = 33;
  netInitialSnapshotApplied = false;
  if (currentGame) currentGame.networkPredictedProjectiles = null;
  if (networkSession) networkSession.hidden = true;
}

function returnNetworkGameToLobby() {
  closeLeaderboardModal();
  currentGame = cleanupCurrentGameRuntime(currentGame);
  netRoomPhase = "lobby";
  netLobbyCountdownEndsAt = 0;
  netLobbyInlineText = "";
  if (menuPanel) menuPanel.hidden = false;
  if (networkSession) networkSession.hidden = true;
  setCanvasVisible(false);
  showNetworkLobby();
  renderNetworkLobby();
  music.playMenuMusic();
  syncTopAdVisibility();
}

function returnToMenu() {
  if (currentGame?.networkEnabled && currentGame?.gameOver && netClient) {
    netClient.returnRoomToLobby();
    returnNetworkGameToLobby();
    return;
  }
  closeLeaderboardModal();
  const targetMode = currentGame?.networkEnabled ? MENU_MODE_NETWORK : (menuState.mode || MENU_MODE_SINGLE);
  returnToMenuRuntime({
    stopNetworkSession,
    cleanupCurrentGame: () => {
      currentGame = cleanupCurrentGameRuntime(currentGame);
    },
    layout,
    menuPanel,
    selector,
    music,
    showMenu: () => {
      if (targetMode === MENU_MODE_NETWORK) showNetworkSetup();
      else showCharacterSelect(targetMode);
    }
  });
  syncTopAdVisibility();
}

const drawSplash = (now) => {
  if (!canvas || !splashActive) return;
  drawSplashFrame({
    canvas,
    splashStartedAt,
    fadeMs: SPLASH_FADE_MS,
    splashReady,
    splashLogo,
    now,
    promptReady: splashPromptReady
  });
  splashRaf = requestAnimationFrame(drawSplash);
};

const dismissSplash = () => {
  dismissSplashRuntime({
    splashActive,
    splashDismissed,
    setSplashDismissed: (value) => {
      splashDismissed = value;
    },
    setSplashActive: (value) => {
      splashActive = value;
    },
    windowObject: window,
    handleSplashKeydown,
    layout,
    splashRaf,
    cancelFrame: (raf) => {
      cancelAnimationFrame(raf);
      splashRaf = 0;
    },
    clearSplashRender: () => clearSplashCanvas(canvas),
    selector,
    currentGame,
    menuPanel,
    music,
    showMenu: showModeSelect,
    startFallbackGame: () => {
      if (!startButton && classButtons.length === 0 && !currentGame) {
        currentGame = createLocalGame({
          Game,
          canvas,
          selectedClass: "archer",
          playerHandle: currentPlayerHandle || "Player",
          returnToMenu,
          syncMusicForGame,
          startingFloor: 1,
          onGameOverChanged: (gameOver, nextGame) => {
            if (gameOver) submitCompletedLocalRun(nextGame);
          }
        });
      }
    }
  });
  syncTopAdVisibility();
};

const handleSplashKeydown = (event) => {
  if (!splashPromptReady) return;
  handleSplashKeydownRuntime(event, splashActive, dismissSplash);
};

const startSplashScreen = () => {
  setCanvasVisible(true);
  const next = startSplashScreenRuntime({
    layout,
    menuPanel,
    selector,
    networkSession,
    music,
    fadeMs: SPLASH_FADE_MS,
    requestFrame: requestAnimationFrame,
    drawSplash,
    windowObject: window,
    handleSplashKeydown,
    now: performance.now()
  });
  splashStartedAt = next.splashStartedAt;
  splashRaf = next.splashRaf;
  syncTopAdVisibility();
};
const isNetworkController = () => !!(netControllerId && netPlayerId && netControllerId === netPlayerId);
const hasLocalPrediction = (game = currentGame) => !!(game?.networkEnabled && netPlayerId && (game.networkRoomPhase || netRoomPhase) === "active");

function getAckSeqForMessage(msg) {
  const byPlayer = msg?.lastInputSeqByPlayer;
  if (byPlayer && typeof byPlayer === "object" && netPlayerId && Number.isFinite(byPlayer[netPlayerId])) {
    return byPlayer[netPlayerId];
  }
  return Number.isFinite(msg?.lastInputSeq) ? msg.lastInputSeq : 0;
}

function applySnapshot(game, state, controller = false, ackSeq = 0) {
  let nextState = state;
  if (
    nextState &&
    typeof nextState === "object" &&
    netLatestLocalVitals &&
    Number.isFinite(netLatestLocalVitals.serverTime) &&
    Number.isFinite(netLatestLocalVitals.health)
  ) {
    const snapshotServerTime = Number.isFinite(nextState.serverTime) ? nextState.serverTime : NaN;
    if (!Number.isFinite(snapshotServerTime) || snapshotServerTime < netLatestLocalVitals.serverTime) {
      const patchedState = { ...nextState };
      if (patchedState.player && typeof patchedState.player === "object") {
        patchedState.player = {
          ...patchedState.player,
          health: netLatestLocalVitals.health,
          maxHealth: netLatestLocalVitals.maxHealth,
          hpBarTimer: netLatestLocalVitals.hpBarTimer
        };
      }
      if (Array.isArray(patchedState.players) && netPlayerId) {
        patchedState.players = patchedState.players.map((player) =>
          player && player.id === netPlayerId
            ? {
                ...player,
                health: netLatestLocalVitals.health,
                maxHealth: netLatestLocalVitals.maxHealth,
                hpBarTimer: netLatestLocalVitals.hpBarTimer
              }
            : player
        );
      }
      nextState = patchedState;
    }
  }
  const next = applyNetworkSnapshot({
    game,
    state: nextState,
    controller,
    ackSeq,
    applySnapshotToGame,
    isNetworkController: hasLocalPrediction(game),
    localPlayerId: netPlayerId,
    netPredictedProjectiles,
    netPendingInputs,
    netLastAckSeq,
    netSnapshotJitterMs,
    netLastSnapshotGapMs,
    syncMusicForGame
  });
  netPendingInputs = next.netPendingInputs;
  netLastAckSeq = next.netLastAckSeq;
  netInitialSnapshotApplied = true;
}

function getSnapshotLocalPlayerState(state) {
  const snapshotPlayers = Array.isArray(state?.players) ? state.players : [];
  if (netPlayerId) {
    const exact = snapshotPlayers.find((player) => player && player.id === netPlayerId);
    if (exact) return exact;
  }
  return state?.player && typeof state.player === "object" ? state.player : snapshotPlayers[0] || null;
}

function startNetworkRenderLoop(game) {
  startNetworkRenderLoopRuntime({
    game,
    getCurrentGame: () => currentGame,
    handleNetworkUiActions,
    getNetClient: () => netClient,
    isNetworkController: () => hasLocalPrediction(game),
    getRenderDelayMs: () => getRenderDelayForRole(() => hasLocalPrediction(game), NET_RENDER_DELAY_MS_CONTROLLER, NET_RENDER_DELAY_MS_SPECTATOR),
    estimateServerNowMs: () => estimateServerNowMsFromState(netClockState),
    consumeSnapshotForRender,
    netSnapshotBuffer,
    maxSnapshotBuffer: NET_MAX_SNAPSHOT_BUFFER,
    applySnapshot,
    collectInput,
    predictFromInput,
    canRunPredictedCollision: () => canRunPredictedCollision(game, isKnownMapTileAt),
    prunePredictedProjectiles,
    netPredictedProjectiles,
    setNetRenderRaf: (value) => {
      netRenderRaf = value;
    }
  });
}

function shouldBypassSnapshotBuffer(game = currentGame) {
  return !!(
    game &&
    game.networkEnabled &&
    game.networkHasMap &&
    game.networkHasChunks &&
    hasLocalPrediction(game)
  );
}

function startLocalGame() {
  if (!ensurePlayerHandle()) return;
  menuState.mode = MENU_MODE_SINGLE;
  stopNetworkSession();
  if (menuPanel) menuPanel.hidden = true;
  setCanvasVisible(true);
  syncTopAdVisibility();
  currentGame = cleanupCurrentGameRuntime(currentGame);
  const requestedStartFloor = isDevMode && devStartFloorInput
    ? normalizeDevStartingFloor(devStartFloorInput.value)
    : 1;
  currentGame = createLocalGame({
    Game,
    canvas,
    selectedClass,
    playerHandle: currentPlayerHandle || "Player",
    returnToMenu,
    syncMusicForGame,
    startingFloor: requestedStartFloor,
    bossOverride: selectedBossOverride,
    onGameOverChanged: (gameOver, nextGame) => {
      if (gameOver) submitCompletedLocalRun(nextGame);
    }
  });
  currentGame.deathTransitionDuration = 12;
  currentGame.onDeathStatsBackToLeaderboard = () => returnFromDeathStatsToLeaderboard(currentGame);
}

function startNetworkGameplay() {
  const name = netPendingHandle || currentPlayerHandle || "Player";
  const localEntry = getLocalRosterEntry();
  if (localEntry?.classType) setLobbySelectedClass(localEntry.classType);
  if (currentGame) return currentGame;
  menuState.mode = MENU_MODE_NETWORK;
  if (menuPanel) menuPanel.hidden = true;
  setCanvasVisible(true);
  syncTopAdVisibility();
  if (networkSession) networkSession.hidden = true;
  currentGame = cleanupCurrentGameRuntime(currentGame);
  const game = new Game(canvas, {
    classType: selectedClass,
    onReturnToMenu: returnToMenu,
    onPauseChanged: (_paused, nextGame) => syncMusicForGame(nextGame),
    onFloorChanged: (_floor, nextGame) => syncMusicForGame(nextGame),
    onGameOverChanged: (gameOver, nextGame) => {
      syncMusicForGame(nextGame);
      if (gameOver) showNetworkGameOverLeaderboardOnce(nextGame, { includeSessionRun: true });
    }
  });
  if (typeof game.applyDebugBossOverride === "function") {
    game.applyDebugBossOverride(netRequestedBossOverride);
  }
  game.networkDeathRulesMode = normalizeNetworkDeathRulesMode(netRequestedDeathRulesMode);
  game.playerHandle = name;
  game.deathTransitionDuration = 12;
  game.onDeathStatsBackToLeaderboard = () => returnFromDeathStatsToLeaderboard(game);
  game.networkEnabled = true;
  game.networkLocalPlayerId = netPlayerId;
  game.networkRole = "Connecting";
  game.networkRoomPhase = netRoomPhase || "active";
  game.networkRoomOwnerId = netRoomOwnerId;
  game.networkPauseOwnerId = netPauseOwnerId;
  game.networkRosterPlayers = netRosterPlayers.slice();
  game.networkReady = false;
  game.networkHasMap = false;
  game.networkHasChunks = false;
  game.networkChunkSync = true;
  game.networkLoadingMessage = "Connecting...";
  game.networkPerf = {
    appliedSnapshotCount: 0,
    lastCorrectionPx: 0,
    maxCorrectionPx: 0,
    hardSnapCount: 0,
    softCorrectionCount: 0,
    settleCorrectionCount: 0,
    blockedSnapCount: 0
  };
  game.networkGameOverLeaderboardShown = false;
  game.networkFinalResults = null;
  game.multiplayerNotificationQueue = [];
  game.multiplayerNotificationCurrent = null;
  game.pushMultiplayerNotification = (text) => {
    if (typeof text !== "string") return;
    const message = text.trim();
    if (!message) return;
    game.multiplayerNotificationQueue.push({ text: message, duration: 2.5 });
    if (!game.multiplayerNotificationCurrent) {
      game.multiplayerNotificationCurrent = game.multiplayerNotificationQueue.shift() || null;
    }
  };
  game.tickMultiplayerNotifications = (dt) => {
    if (game.gameOver) return;
    if (game.paused) return;
    if (!game.multiplayerNotificationCurrent && game.multiplayerNotificationQueue.length > 0) {
      game.multiplayerNotificationCurrent = game.multiplayerNotificationQueue.shift() || null;
    }
    if (!game.multiplayerNotificationCurrent) return;
    game.multiplayerNotificationCurrent.duration -= Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (game.multiplayerNotificationCurrent.duration > 0) return;
    game.multiplayerNotificationCurrent = game.multiplayerNotificationQueue.shift() || null;
  };
  game.networkPredictedProjectiles = netPredictedProjectiles;
  game.remotePlayers = [];
  game.map = [];
  game.mapWidth = 0;
  game.mapHeight = 0;
  game.worldWidth = 0;
  game.worldHeight = 0;
  game.enemies = [];
  game.drops = [];
  game.breakables = [];
  game.wallTraps = [];
  game.bullets = [];
  game.fireArrows = [];
  game.fireZones = [];
  game.meleeSwings = [];
  game.armorStands = [];
  game.explored = [];
  game.navDistance = [];
  game.navPlayerTile = { x: -1, y: -1 };
  currentGame = game;
  syncMusicForGame(game);
  updateNetworkStatusRuntime(networkStatus, currentGame, `Joined "${netJoinedRoomId || netPendingRoomId}"`);
  startNetworkRenderLoop(game);
  return game;
}

function startNetworkGame() {
  const handle = ensurePlayerHandle();
  if (!handle) return;
  menuState.mode = MENU_MODE_NETWORK;
  stopNetworkSession();
  if (networkSession) networkSession.hidden = true;
  currentGame = cleanupCurrentGameRuntime(currentGame);
  netPendingWsUrl = serverUrlInput && serverUrlInput.value ? serverUrlInput.value.trim() : "ws://localhost:8090";
  netPendingRoomId = roomIdInput && roomIdInput.value ? roomIdInput.value.trim() : "lobby";
  netPendingHandle = handle;
  netJoinedRoomId = netPendingRoomId;
  showNetworkLobby();
  renderNetworkLobby();
  updateNetworkStatusRuntime(networkStatus, currentGame, `Connecting to ${netPendingWsUrl}...`);

  netClient = new NetClient(netPendingWsUrl);
  netClient.on("open", () => {
    updateNetworkStatusRuntime(networkStatus, currentGame, `Connected. Joining room "${netPendingRoomId}"...`);
    if (networkLobbyStatusText) networkLobbyStatusText.textContent = "Connected";
    netClient.join(netPendingRoomId, netPendingHandle, selectedClass);
  });
  netClient.on("hello", (msg) => {
    netPlayerId = msg.playerId || null;
    renderNetworkLobby();
  });
  netClient.on("room.started", (msg) => {
    netRoomPhase = typeof msg.phase === "string" ? msg.phase : "active";
    netRoomOwnerId = msg.ownerId || netRoomOwnerId;
    netPauseOwnerId = msg.pauseOwnerId || netPauseOwnerId;
    netControllerId = msg.controllerId || netControllerId;
    startNetworkGameplay();
  });
  netClient.on("join.ok", (msg) => {
    netJoinedRoomId = msg.roomId || netJoinedRoomId || netPendingRoomId;
    netRoomPhase = typeof msg.phase === "string" ? msg.phase : netRoomPhase;
    netRoomOwnerId = msg.ownerId || netRoomOwnerId;
    netPauseOwnerId = msg.pauseOwnerId || netPauseOwnerId;
    netControllerId = msg.controllerId || null;
    renderNetworkLobby();
    if (msg.phase === "active") {
      const game = startNetworkGameplay();
      game.networkRoomPhase = netRoomPhase;
      game.networkRoomOwnerId = netRoomOwnerId;
      game.networkPauseOwnerId = netPauseOwnerId;
      game.networkLocalPlayerId = netPlayerId;
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      updateNetworkStatusRuntime(networkStatus, currentGame, `Joined "${msg.roomId}" as ${game.networkRole}`);
    } else {
      updateNetworkStatusRuntime(networkStatus, currentGame, `Joined lobby "${msg.roomId}"`);
    }
  });
  netClient.on("room.roster", (msg) => {
    const previousRoster = Array.isArray(netRosterPlayers) ? netRosterPlayers.slice() : [];
    const previousPauseOwnerId = netPauseOwnerId;
    netRoomPhase = typeof msg.phase === "string" ? msg.phase : netRoomPhase;
    netRoomOwnerId = msg.ownerId || netRoomOwnerId;
    netPauseOwnerId = msg.pauseOwnerId || netPauseOwnerId;
    netControllerId = msg.controllerId || null;
    netRequestedStartFloor = Number.isFinite(msg.requestedStartFloor) ? Math.max(1, Math.floor(msg.requestedStartFloor)) : netRequestedStartFloor;
    netRequestedStartFloor = normalizeDevStartingFloor(netRequestedStartFloor);
    netRequestedBossOverride = normalizeFloorBossOverride(msg.requestedBossOverride);
    netRequestedDeathRulesMode = normalizeNetworkDeathRulesMode(msg.requestedDeathRulesMode);
    netLobbyCountdownEndsAt = Number.isFinite(msg.lobbyCountdownEndsAt) ? msg.lobbyCountdownEndsAt : 0;
    netLobbyInlineText = typeof msg.lobbyInlineMessage === "string" ? msg.lobbyInlineMessage : "";
    netRosterPlayers = Array.isArray(msg.players) ? msg.players.slice() : [];
    if (isDevMode && netRoomOwnerId && netPlayerId && netRoomOwnerId === netPlayerId) {
      const desiredBossOverride = normalizeFloorBossOverride(selectedBossOverride);
      if (netClient && desiredBossOverride !== netRequestedBossOverride) {
        netClient.sendLobbyUpdate({ bossOverride: desiredBossOverride });
      }
      const desiredDeathRulesMode = normalizeNetworkDeathRulesMode(selectedNetworkDeathRulesMode);
      if (netClient && desiredDeathRulesMode !== netRequestedDeathRulesMode) {
        netClient.sendLobbyUpdate({ deathRulesMode: desiredDeathRulesMode });
      }
    }
    renderNetworkLobby();
    const game = currentGame;
    if (netRoomPhase === "lobby" && game?.networkEnabled) {
      returnNetworkGameToLobby();
    }
    const activeGame = currentGame;
    if (activeGame) {
      activeGame.networkRoomPhase = netRoomPhase;
      activeGame.networkRoomOwnerId = netRoomOwnerId;
      activeGame.networkPauseOwnerId = netPauseOwnerId;
      activeGame.networkLocalPlayerId = netPlayerId;
      activeGame.networkRosterPlayers = netRosterPlayers;
      activeGame.networkDeathRulesMode = normalizeNetworkDeathRulesMode(netRequestedDeathRulesMode);
      if (netRoomPhase === "active" && typeof activeGame.pushMultiplayerNotification === "function") {
        const nextIds = new Set(netRosterPlayers.filter((player) => player?.id).map((player) => player.id));
        for (const player of previousRoster) {
          if (!player?.id || nextIds.has(player.id)) continue;
          activeGame.pushMultiplayerNotification(`${player.handle || player.name || "Player"} disconnected`);
        }
        if (previousPauseOwnerId && previousPauseOwnerId !== netPauseOwnerId) {
          const nextOwner = netRosterPlayers.find((player) => player?.id === netPauseOwnerId);
          if (nextOwner?.handle) activeGame.pushMultiplayerNotification(`${nextOwner.handle} is now the pause owner.`);
        }
      }
      updateNetworkRole(activeGame, isNetworkController(), networkTakeControl);
    }
    const players = Array.isArray(msg.players) ? msg.players.length : 0;
    updateNetworkStatusRuntime(networkStatus, currentGame, activeGame ? `Room: ${players} connected | Role: ${activeGame.networkRole}` : `Lobby: ${players} connected`);
  });
  const handleMapReady = () => {
    const game = currentGame;
    if (!game) return;
    const playerX = Number.isFinite(netLastServerPlayer?.x) ? netLastServerPlayer.x : game.player.x;
    const playerY = Number.isFinite(netLastServerPlayer?.y) ? netLastServerPlayer.y : game.player.y;
    netRequiredChunkKeys = updateRequiredChunkReadinessRuntime(
      computeChunkReadiness,
      game,
      playerX,
      playerY,
      netMapChunkSize,
      netReceivedChunkKeys
    );
    if (!game.networkHasMap || !game.networkHasChunks) return;
    if (netPendingSnapshot && (!netPendingSnapshot.mapSignature || netPendingSnapshot.mapSignature === netMapSignature)) {
      observeServerTimeIntoState(netClockState, netPendingSnapshot.serverTime, NET_CLOCK_OFFSET_SMOOTHING);
      const initialPending = netPendingSnapshot;
      applySnapshot(
        game,
        initialPending.state,
        hasLocalPrediction(game),
        getAckSeqForMessage(initialPending)
      );
      netPendingSnapshot = null;
    }
    if (!netInitialSnapshotApplied) {
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      updateNetworkStatusRuntime(networkStatus, currentGame, "Waiting for first snapshot...");
      game.networkReady = false;
      return;
    }
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    updateNetworkStatusRuntime(networkStatus, currentGame, `Room synced | Role: ${game.networkRole}`);
    game.networkReady = true;
  };

  netClient.on("state.mapMeta", (msg) => {
    const game = currentGame;
    if (!game) return;
    netMapSignature = applyMapMetaToGame(game, msg) || netMapSignature;
    netPendingInputs = [];
    netLastAckSeq = 0;
    netSnapshotBuffer.length = 0;
    netMapChunksReceived = 0;
    netMapChunkSize = 24;
    netRequiredChunkKeys = new Set();
    netReceivedChunkKeys = new Set();
    netLastServerPlayer = null;
    netPredictedProjectiles.clear();
    netInitialSnapshotApplied = false;
    game.networkHasMap = true;
    game.networkHasChunks = false;
    game.networkChunkSync = true;
    game.armorStands = syncByIdLerp(game.armorStands, msg.armorStands, 1);
    updateNetworkStatusRuntime(networkStatus, currentGame, "Loading nearby map chunks...");
  });
  netClient.on("state.mapChunk", (msg) => {
    const game = currentGame;
    if (!game) return;
    const chunkSig = typeof msg.mapSignature === "string" ? msg.mapSignature : "";
    if (chunkSig && netMapSignature && chunkSig !== netMapSignature) return;
    if (applyMapChunkToGame(game, msg)) {
      netMapChunkSize = Number.isFinite(msg.chunkSize) ? Math.max(1, Math.floor(msg.chunkSize)) : netMapChunkSize;
      const cx = Number.isFinite(msg.cx) ? Math.floor(msg.cx) : NaN;
      const cy = Number.isFinite(msg.cy) ? Math.floor(msg.cy) : NaN;
      if (Number.isFinite(cx) && Number.isFinite(cy)) netReceivedChunkKeys.add(chunkKey(cx, cy));
      netMapChunksReceived += 1;
      handleMapReady();
    }
  });
  // Backward-compatibility with pre-chunk servers.
  netClient.on("state.map", (msg) => {
    const game = currentGame;
    if (!game) return;
    netMapSignature = applyMapStateToGame(game, msg) || netMapSignature;
    netPendingInputs = [];
    netLastAckSeq = 0;
    netSnapshotBuffer.length = 0;
    netRequiredChunkKeys = new Set();
    netReceivedChunkKeys = new Set();
    netLastServerPlayer = null;
    netPredictedProjectiles.clear();
    netInitialSnapshotApplied = false;
    game.networkHasMap = true;
    game.networkHasChunks = true;
    game.networkChunkSync = false;
    game.armorStands = syncByIdLerp(game.armorStands, msg.armorStands, 1);
    handleMapReady();
  });
  netClient.on("state.meta", (msg) => {
    const game = currentGame;
    if (!game) return;
    observeServerTimeIntoState(netClockState, msg.serverTime, NET_CLOCK_OFFSET_SMOOTHING);
    const metaSig = typeof msg.mapSignature === "string" ? msg.mapSignature : "";
    if (metaSig && netMapSignature && metaSig !== netMapSignature) return;
    const prevFloor = game.floor;
    const prevGameOver = !!game.gameOver;
    const prevPaused = !!game.paused;
    const prevTrackTitle = game.musicTrack?.title || "";
    const prevTrackSrc = game.musicTrack?.src || "";
    const meta = msg && msg.meta && typeof msg.meta === "object" ? msg.meta : msg;
    applyMetaStateToGame(game, meta);
    netRoomPhase = typeof game.networkRoomPhase === "string" ? game.networkRoomPhase : netRoomPhase;
    netRoomOwnerId = game.networkRoomOwnerId || netRoomOwnerId;
    netPauseOwnerId = game.networkPauseOwnerId || netPauseOwnerId;
    const nextTrackTitle = game.musicTrack?.title || "";
    const nextTrackSrc = game.musicTrack?.src || "";
    if (
      prevFloor !== game.floor ||
      prevGameOver !== !!game.gameOver ||
      prevPaused !== !!game.paused ||
      prevTrackTitle !== nextTrackTitle ||
      prevTrackSrc !== nextTrackSrc
    ) {
      syncMusicForGame(game);
    }
  });
  netClient.on("state.snapshot", (msg) => {
    const game = currentGame;
    if (!game) return;
    const recvAt = performance.now();
    if (netLastSnapshotRecvAtMs > 0) {
      const gap = Math.max(0, recvAt - netLastSnapshotRecvAtMs);
      netLastSnapshotGapMs = gap;
      netSnapshotIntervalMeanMs += (gap - netSnapshotIntervalMeanMs) * 0.1;
      netSnapshotJitterMs += (Math.abs(gap - netSnapshotIntervalMeanMs) - netSnapshotJitterMs) * 0.18;
    }
    netLastSnapshotRecvAtMs = recvAt;
    netRoomPhase = typeof msg.phase === "string" ? msg.phase : netRoomPhase;
    netRoomOwnerId = msg.ownerId || netRoomOwnerId;
    netPauseOwnerId = msg.pauseOwnerId || netPauseOwnerId;
    netControllerId = msg.controllerId || netControllerId;
    game.networkRoomPhase = netRoomPhase;
    game.networkRoomOwnerId = netRoomOwnerId;
    game.networkPauseOwnerId = netPauseOwnerId;
    game.networkLocalPlayerId = netPlayerId;
    observeServerTimeIntoState(netClockState, msg.serverTime, NET_CLOCK_OFFSET_SMOOTHING);
    if (Number.isFinite(msg.snapshotSeq)) {
      netClient.send("state.snapshotAck", { snapshotSeq: Math.floor(msg.snapshotSeq) });
    }
    const snapshotSig = typeof msg.mapSignature === "string" ? msg.mapSignature : "";
    if (snapshotSig && netMapSignature && snapshotSig !== netMapSignature) {
      netPendingSnapshot = msg;
      game.networkReady = false;
      game.networkHasChunks = false;
      netMapChunksReceived = 0;
      netMapChunkSize = 24;
      netRequiredChunkKeys = new Set();
      netReceivedChunkKeys = new Set();
      netLastServerPlayer = null;
      netSnapshotBuffer.length = 0;
      netPredictedProjectiles.clear();
      netLatestLocalVitals = null;
      netInitialSnapshotApplied = false;
      updateNetworkStatusRuntime(networkStatus, currentGame, "Synchronizing floor data...");
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    if (snapshotSig && !netMapSignature) {
      netPendingSnapshot = msg;
      game.networkReady = false;
      game.networkHasChunks = false;
      netLastServerPlayer = null;
      netSnapshotBuffer.length = 0;
      netPredictedProjectiles.clear();
      netLatestLocalVitals = null;
      netInitialSnapshotApplied = false;
      updateNetworkStatusRuntime(networkStatus, currentGame, "Waiting for map meta...");
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    if (game.networkHasMap && game.networkHasChunks && !game.networkReady && netSnapshotBuffer.length === 0) {
      applySnapshot(game, msg.state, hasLocalPrediction(game), getAckSeqForMessage(msg));
      if (netInitialSnapshotApplied) {
        updateNetworkRole(game, isNetworkController(), networkTakeControl);
        updateNetworkStatusRuntime(networkStatus, currentGame, `Room synced | Role: ${game.networkRole}`);
        game.networkReady = true;
      } else {
        updateNetworkRole(game, isNetworkController(), networkTakeControl);
        updateNetworkStatusRuntime(networkStatus, currentGame, "Waiting for first snapshot...");
        game.networkReady = false;
      }
      return;
    }
    const p = getSnapshotLocalPlayerState(msg?.state);
    if (p && typeof p === "object") {
      netLatestLocalVitals = {
        serverTime: Number.isFinite(msg.serverTime) ? msg.serverTime : Date.now(),
        health: Number.isFinite(p.health) ? p.health : game.player.health,
        maxHealth: Number.isFinite(p.maxHealth) ? p.maxHealth : game.player.maxHealth,
        hpBarTimer: Number.isFinite(p.hpBarTimer) ? p.hpBarTimer : game.player.hpBarTimer
      };
      if (Number.isFinite(p.health)) {
        game.player.health = p.health;
        game.player.alive = p.health > 0;
      }
      if (Number.isFinite(p.maxHealth)) game.player.maxHealth = p.maxHealth;
      if (Number.isFinite(p.hpBarTimer)) game.player.hpBarTimer = p.hpBarTimer;
    }
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      netLastServerPlayer = { x: p.x, y: p.y };
      netRequiredChunkKeys = updateRequiredChunkReadinessRuntime(
        computeChunkReadiness,
        game,
        p.x,
        p.y,
        netMapChunkSize,
        netReceivedChunkKeys
      );
    }
    if (shouldBypassSnapshotBuffer(game)) {
      netSnapshotBuffer.length = 0;
      applySnapshot(game, msg.state, true, getAckSeqForMessage(msg));
      if (game.networkHasMap && game.networkHasChunks) handleMapReady();
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    netSnapshotBuffer.push({ recvTime: recvAt, ...msg });
    if (netSnapshotBuffer.length > NET_MAX_SNAPSHOT_BUFFER * 2) {
      netSnapshotBuffer.splice(0, netSnapshotBuffer.length - NET_MAX_SNAPSHOT_BUFFER);
    }
    if (game.networkHasMap && game.networkHasChunks) handleMapReady();
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
  });
  netClient.on("warn", (msg) => updateNetworkStatusRuntime(networkStatus, currentGame, `Warning: ${msg.message || "Server warning"}`));
  netClient.on("error", (msg) => updateNetworkStatusRuntime(networkStatus, currentGame, `Error: ${msg.message || "Connection error"}`));
  netClient.on("close", () => {
    if (currentGame) {
      currentGame.networkReady = false;
      syncMusicForGame(currentGame);
    }
    if (networkLobbyStatusText && menuState.screen === "lobby") networkLobbyStatusText.textContent = "Disconnected";
    updateNetworkStatusRuntime(networkStatus, currentGame, "Disconnected from server");
  });
  netClient.connect();

  netInputTimer = setInterval(() => {
    const game = currentGame;
    if (!netClient || !game) return;
    const input = collectInput(game, true);
    input.seq = ++netInputSeq;
    const nowMs = performance.now();
    const inputDt = netLastInputProcessAt > 0 ? Math.min(0.05, Math.max(0.001, (nowMs - netLastInputProcessAt) / 1000)) : NET_INPUT_DT;
    netLastInputProcessAt = nowMs;
    if (nowMs - netLastInputSendAt < NET_MIN_SEND_MS && !input.firePrimaryQueued && !input.fireAltQueued) {
      return;
    }
    if (!shouldSendNetworkInput(input, nowMs, netLastSentInput, netLastInputSendAt, NET_FORCE_SEND_IDLE_MS)) return;
    netLastInputSendAt = nowMs;
    netLastSentInput = {
      moveX: input.moveX,
      moveY: input.moveY,
      hasAim: input.hasAim,
      aimX: input.aimX,
      aimY: input.aimY,
      aimDirX: input.aimDirX,
      aimDirY: input.aimDirY,
      firePrimaryHeld: input.firePrimaryHeld,
      firePrimaryQueued: input.firePrimaryQueued,
      fireAltQueued: input.fireAltQueued
    };
    if (hasLocalPrediction(game)) {
      netNextHeldPrimaryPredictAtMs = predictProjectileSpawn(
        game,
        input,
        nowMs,
        hasLocalPrediction(game),
        netPredictedProjectiles,
        netNextHeldPrimaryPredictAtMs
      );
      netPendingInputs.push({
        seq: input.seq,
        dt: inputDt,
        moveX: input.moveX,
        moveY: input.moveY,
        hasAim: input.hasAim,
        aimX: input.aimX,
        aimY: input.aimY,
        aimDirX: input.aimDirX,
        aimDirY: input.aimDirY
      });
      if (netPendingInputs.length > 120) {
        netPendingInputs.splice(0, netPendingInputs.length - 120);
      }
    }
    netClient.sendInput(input);
  }, 33);
}

function handlePrimaryStartAction() {
  if (menuState.mode === MENU_MODE_NETWORK) {
    startNetworkGame();
    return;
  }
  startLocalGame();
}

function handleCharacterSelectBack() {
  if (menuState.mode === MENU_MODE_NETWORK) {
    showNetworkSetup();
    return;
  }
  showModeSelect();
}

if (!canvas) {
  throw new Error("Game canvas not found.");
}

setLobbySelectedClass("archer");
for (const button of classButtons) {
  button.addEventListener("click", () => {
    setLobbySelectedClass(button.dataset.classOption);
  });
}
for (const button of networkLobbyClassButtons) {
  button.addEventListener("click", () => {
    const nextClass = button.dataset.lobbyClassOption;
    setLobbySelectedClass(nextClass);
    const localEntry = getLocalRosterEntry();
    if (netClient && menuState.screen === "lobby") {
      netClient.sendLobbyUpdate({
        classType: nextClass,
        locked: localEntry?.locked ? false : undefined
      });
    }
  });
}

if (menuSingleButton) {
  menuSingleButton.addEventListener("click", () => {
    showCharacterSelect(MENU_MODE_SINGLE);
  });
}

if (menuNetworkButton) {
  menuNetworkButton.addEventListener("click", () => {
    showNetworkSetup();
  });
}

if (menuOptionsButton) {
  menuOptionsButton.addEventListener("click", () => {
    showOptionsScreen();
  });
}

if (menuVolumeInput) {
  menuVolumeInput.addEventListener("input", () => {
    const nextVolume = Number(menuVolumeInput.value) / 100;
    music.setMasterVolume(nextVolume);
    syncMenuVolumeControl();
  });
}

if (disableAdsInput) {
  disableAdsInput.addEventListener("change", () => {
    adsDisabled = !!disableAdsInput.checked;
    persistAdsDisabled(adsDisabled);
    syncDisableAdsControl();
    syncTopAdVisibility();
  });
}

if (devBossOverrideSelect) {
  devBossOverrideSelect.addEventListener("change", () => {
    selectedBossOverride = normalizeFloorBossOverride(devBossOverrideSelect.value);
    persistFloorBossOverride(selectedBossOverride);
    syncDevBossOverrideControl();
  });
}

if (optionsBackButton) {
  optionsBackButton.addEventListener("click", () => {
    showModeSelect();
  });
}

if (networkSetupBackButton) {
  networkSetupBackButton.addEventListener("click", () => {
    showModeSelect();
  });
}

if (networkSetupNextButton) {
  networkSetupNextButton.addEventListener("click", () => {
    startNetworkGame();
  });
}

if (characterSelectBackButton) {
  characterSelectBackButton.addEventListener("click", () => {
    handleCharacterSelectBack();
  });
}

if (startButton) {
  startButton.addEventListener("click", () => {
    handlePrimaryStartAction();
  });
}

for (const handleInput of [playerNameInput, networkPlayerNameInput]) {
  if (!handleInput) continue;
  handleInput.addEventListener("input", () => {
    currentPlayerHandle = sanitizePlayerHandle(handleInput.value);
    syncHandleInputs(currentPlayerHandle);
    handleInput.setCustomValidity("");
  });
  handleInput.addEventListener("change", () => {
    syncStoredHandleFromInput();
  });
  handleInput.addEventListener("blur", () => {
    syncStoredHandleFromInput();
  });
}

if (devStartFloorInput) {
  devStartFloorInput.addEventListener("change", () => {
    devStartFloorInput.value = `${normalizeDevStartingFloor(devStartFloorInput.value)}`;
  });
}

if (openLeaderboardButton) {
  openLeaderboardButton.addEventListener("click", async () => {
    syncStoredHandleFromInput();
    openLeaderboardModal("menu", LEADERBOARD_BOARD_SOLO);
    await refreshGlobalLeaderboard(LEADERBOARD_BOARD_SOLO);
  });
}

if (leaderboardClose) {
  leaderboardClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLeaderboardModal();
  });
}
if (leaderboardContinue) {
  leaderboardContinue.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    returnToMenu();
  });
}
if (leaderboardStats) {
  leaderboardStats.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDeathStatsScreen();
  });
}
if (leaderboardBoardSolo) {
  leaderboardBoardSolo.addEventListener("click", async () => {
    leaderboardState.activeBoard = LEADERBOARD_BOARD_SOLO;
    renderLeaderboardModal();
    if (leaderboardState.activeTab === "global") await refreshGlobalLeaderboard(LEADERBOARD_BOARD_SOLO);
  });
}
if (leaderboardBoardGroup) {
  leaderboardBoardGroup.addEventListener("click", async () => {
    leaderboardState.activeBoard = LEADERBOARD_BOARD_GROUP;
    renderLeaderboardModal();
    if (leaderboardState.activeTab === "global") await refreshGlobalLeaderboard(LEADERBOARD_BOARD_GROUP);
  });
}
if (leaderboardTabGlobal) {
  leaderboardTabGlobal.addEventListener("click", async () => {
    leaderboardState.activeTab = "global";
    renderLeaderboardModal();
    await refreshGlobalLeaderboard();
  });
}
if (leaderboardTabSession) {
  leaderboardTabSession.addEventListener("click", () => {
    leaderboardState.activeTab = "session";
    renderLeaderboardModal();
  });
}
if (leaderboardModal) {
  leaderboardModal.addEventListener("click", (event) => {
    if (event.target === leaderboardModal && leaderboardState.mode !== "death") closeLeaderboardModal();
  });
}

const leaderboardUiTick = () => {
  if (leaderboardState.open && leaderboardState.mode === "death") renderLeaderboardModal();
  requestAnimationFrame(leaderboardUiTick);
};
requestAnimationFrame(leaderboardUiTick);

startIdleSoundMonitor(() => currentGame, syncIdleSoundState, syncMusicForGame);
if (networkTakeControl) {
  networkTakeControl.addEventListener("click", () => {
    if (netClient) netClient.takeControl();
  });
}

if (networkLeave) {
  networkLeave.addEventListener("click", () => {
    returnToMenu();
  });
}

if (networkLobbyToggleReady) {
  networkLobbyToggleReady.addEventListener("click", () => {
    if (!netClient) return;
    const localEntry = getLocalRosterEntry();
    netClient.sendLobbyUpdate({
      classType: selectedClass,
      locked: !localEntry?.locked
    });
  });
}

if (networkLobbyDevStartFloorInput) {
  networkLobbyDevStartFloorInput.addEventListener("change", () => {
    if (!netClient) return;
    const nextFloor = normalizeDevStartingFloor(networkLobbyDevStartFloorInput.value);
    networkLobbyDevStartFloorInput.value = `${nextFloor}`;
    netClient.sendLobbyUpdate({ startingFloor: nextFloor });
  });
}

for (const input of networkLobbyDeathRulesInputs) {
  input.addEventListener("change", () => {
    selectedNetworkDeathRulesMode = normalizeNetworkDeathRulesMode(input.value);
    netRequestedDeathRulesMode = selectedNetworkDeathRulesMode;
    persistNetworkDeathRulesMode(selectedNetworkDeathRulesMode);
    syncNetworkDeathRulesControl({
      owner: !!(netRoomOwnerId && netPlayerId && netRoomOwnerId === netPlayerId),
      roomMode: selectedNetworkDeathRulesMode
    });
    if (netClient && netRoomOwnerId && netPlayerId && netRoomOwnerId === netPlayerId) {
      netClient.sendLobbyUpdate({ deathRulesMode: selectedNetworkDeathRulesMode });
    }
  });
}

if (networkLobbyLeaveTop) {
  networkLobbyLeaveTop.addEventListener("click", () => {
    returnToMenu();
  });
}

renderLeaderboardModal();
renderMenuScreen();
startSplashScreen();
preloadStartupAssets().finally(() => {
  splashPromptReady = true;
});

const networkLobbyTick = () => {
  if (menuState.screen === "lobby") renderNetworkLobby();
  requestAnimationFrame(networkLobbyTick);
};
requestAnimationFrame(networkLobbyTick);
