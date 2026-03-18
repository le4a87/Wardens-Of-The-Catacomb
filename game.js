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
import { createLocalGame, startIdleSoundMonitor, wireMenuControls } from "./src/bootstrap/gameStartupRuntime.js";
import { applyNetworkSnapshot, startNetworkRenderLoopRuntime } from "./src/bootstrap/networkRenderRuntime.js";

const canvas = document.getElementById("game");
const layout = document.querySelector(".layout");
const menuPanel = document.querySelector(".panel");
const selector = document.getElementById("character-select");
const devStartOptions = document.getElementById("dev-start-options");
const devStartFloorInput = document.getElementById("dev-start-floor");
const classButtons = Array.from(document.querySelectorAll("[data-class-option]"));
const startButton = document.getElementById("start-game"), startNetworkButton = document.getElementById("start-network-game");
const serverUrlInput = document.getElementById("net-server-url"), roomIdInput = document.getElementById("net-room-id");
const playerNameInput = document.getElementById("net-player-name"), networkSession = document.getElementById("network-session");
const networkStatus = document.getElementById("network-status"), networkTakeControl = document.getElementById("network-take-control");
const networkLeave = document.getElementById("network-leave");
const music = new MusicController();
const splashLogo = new Image();
const SPLASH_FADE_MS = 1800;
let selectedClass = "archer";
let currentGame = null, netClient = null;
let netInputTimer = 0, netRenderRaf = 0;
let netPlayerId = null, netControllerId = null;
let netInputSeq = 0, netLastAckSeq = 0;
let netPendingInputs = [], netMapSignature = "", netPendingSnapshot = null;
const NET_INPUT_DT = 1 / 60;
const NET_CLOCK_OFFSET_SMOOTHING = 0.12;
const netDelayParams = new URLSearchParams(window.location.search);
const parsedControllerDelay = Number.parseInt(netDelayParams.get("netDelayController") || "22", 10);
const parsedSpectatorDelay = Number.parseInt(netDelayParams.get("netDelaySpectator") || "64", 10);
const NET_RENDER_DELAY_MS_CONTROLLER = Number.isFinite(parsedControllerDelay) ? Math.max(0, parsedControllerDelay) : 22;
const NET_RENDER_DELAY_MS_SPECTATOR = Number.isFinite(parsedSpectatorDelay) ? Math.max(0, parsedSpectatorDelay) : 64;
const NET_MAX_SNAPSHOT_BUFFER = 20;
const NET_MIN_SEND_MS = 12;
const NET_FORCE_SEND_IDLE_MS = 66;
let netSnapshotBuffer = [], netLastInputSendAt = 0, netLastSentInput = null, netLastInputProcessAt = 0;
let netMapChunksReceived = 0, netMapChunkSize = 24;
let netRequiredChunkKeys = new Set(), netReceivedChunkKeys = new Set(), netLastServerPlayer = null;
const netClockState = { offsetMs: 0, ready: false };
let netPredictedProjectiles = new Map(), netNextHeldPrimaryPredictAtMs = 0;
let netLastSnapshotRecvAtMs = 0, netSnapshotIntervalMeanMs = 33, netSnapshotJitterMs = 0, netLastSnapshotGapMs = 33;
let splashActive = true, splashDismissed = false, splashRaf = 0, splashStartedAt = 0, splashReady = false;
const isDevMode = new URLSearchParams(window.location.search).get("dev") === "1";

if (devStartOptions) devStartOptions.hidden = !isDevMode;

splashLogo.addEventListener("load", () => { splashReady = true; });
splashLogo.addEventListener("error", () => { splashReady = false; });
splashLogo.src = "./assets/images/logo.png";
if (splashLogo.complete && splashLogo.naturalWidth > 0 && splashLogo.naturalHeight > 0) splashReady = true;

function syncIdleSoundState(game) {
  syncIdleMusicState(music, splashActive, game);
}

function syncMusicForGame(game) {
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
  netInputSeq = 0; netLastAckSeq = 0;
  netPendingInputs = []; netMapSignature = ""; netPendingSnapshot = null;
  netSnapshotBuffer = []; netLastInputSendAt = 0; netLastSentInput = null; netLastInputProcessAt = 0;
  netMapChunksReceived = 0; netMapChunkSize = 24;
  netRequiredChunkKeys = new Set(); netReceivedChunkKeys = new Set(); netLastServerPlayer = null;
  netClockState.offsetMs = 0; netClockState.ready = false;
  netPredictedProjectiles = new Map(); netNextHeldPrimaryPredictAtMs = 0;
  netLastSnapshotRecvAtMs = 0; netSnapshotIntervalMeanMs = 33; netSnapshotJitterMs = 0; netLastSnapshotGapMs = 33;
  if (networkSession) networkSession.hidden = true;
}

function returnToMenu() {
  returnToMenuRuntime({
    stopNetworkSession,
    cleanupCurrentGame: () => {
      currentGame = cleanupCurrentGameRuntime(currentGame);
    },
    layout,
    menuPanel,
    selector,
    music
  });
}

const drawSplash = (now) => {
  if (!canvas || !splashActive) return;
  drawSplashFrame({
    canvas,
    splashStartedAt,
    fadeMs: SPLASH_FADE_MS,
    splashReady,
    splashLogo,
    now
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
    startFallbackGame: () => {
      if (!startButton && classButtons.length === 0 && !currentGame) {
        currentGame = createLocalGame({
          Game,
          canvas,
          selectedClass: "archer",
          returnToMenu,
          syncMusicForGame,
          startingFloor: 1
        });
      }
    }
  });
};

const handleSplashKeydown = (event) => {
  handleSplashKeydownRuntime(event, splashActive, dismissSplash);
};

const startSplashScreen = () => {
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
};
const isNetworkController = () => !!(netControllerId && netPlayerId && netControllerId === netPlayerId);

function applySnapshot(game, state, controller = false, ackSeq = 0) {
  const next = applyNetworkSnapshot({
    game,
    state,
    controller,
    ackSeq,
    applySnapshotToGame,
    isNetworkController: isNetworkController(),
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
}

function startNetworkRenderLoop(game) {
  startNetworkRenderLoopRuntime({
    game,
    getCurrentGame: () => currentGame,
    handleNetworkUiActions,
    netClient,
    isNetworkController,
    getRenderDelayMs: () => getRenderDelayForRole(isNetworkController, NET_RENDER_DELAY_MS_CONTROLLER, NET_RENDER_DELAY_MS_SPECTATOR),
    estimateServerNowMs: () => estimateServerNowMsFromState(netClockState),
    consumeSnapshotForRender,
    netSnapshotBuffer,
    maxSnapshotBuffer: NET_MAX_SNAPSHOT_BUFFER,
    applySnapshot,
    collectInput,
    prunePredictedProjectiles,
    netPredictedProjectiles,
    setNetRenderRaf: (value) => {
      netRenderRaf = value;
    }
  });
}

function startLocalGame() {
  stopNetworkSession();
  if (selector) selector.hidden = true;
  currentGame = cleanupCurrentGameRuntime(currentGame);
  const requestedStartFloor = isDevMode && devStartFloorInput
    ? Math.max(1, Number.parseInt(devStartFloorInput.value || "1", 10) || 1)
    : 1;
  currentGame = createLocalGame({
    Game,
    canvas,
    selectedClass,
    returnToMenu,
    syncMusicForGame,
    startingFloor: requestedStartFloor
  });
}

function startNetworkGame() {
  stopNetworkSession();
  if (selector) selector.hidden = true;
  if (networkSession) networkSession.hidden = false;
  currentGame = cleanupCurrentGameRuntime(currentGame);

  const wsUrl = serverUrlInput && serverUrlInput.value ? serverUrlInput.value.trim() : "ws://localhost:8090";
  const roomId = roomIdInput && roomIdInput.value ? roomIdInput.value.trim() : "lobby";
  const name = playerNameInput && playerNameInput.value ? playerNameInput.value.trim() : "Player";

  const game = new Game(canvas, {
    classType: selectedClass,
    onReturnToMenu: returnToMenu,
    onPauseChanged: (_paused, nextGame) => syncMusicForGame(nextGame),
    onFloorChanged: (_floor, nextGame) => syncMusicForGame(nextGame),
    onGameOverChanged: (_gameOver, nextGame) => syncMusicForGame(nextGame)
  });
  game.networkEnabled = true;
  game.networkRole = "Connecting";
  game.networkReady = false;
  game.networkHasMap = false;
  game.networkHasChunks = false;
  game.networkChunkSync = true;
  game.networkLoadingMessage = "Connecting...";
  currentGame = game;
  syncMusicForGame(game);
  updateNetworkStatusRuntime(networkStatus, currentGame, `Connecting to ${wsUrl}...`);
  startNetworkRenderLoop(game);

  netClient = new NetClient(wsUrl);
  netClient.on("open", () => {
    updateNetworkStatusRuntime(networkStatus, currentGame, `Connected. Joining room "${roomId}"...`);
    netClient.join(roomId, name, selectedClass);
  });
  netClient.on("hello", (msg) => {
    netPlayerId = msg.playerId || null;
  });
  netClient.on("join.ok", (msg) => {
    netControllerId = msg.controllerId || null;
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    updateNetworkStatusRuntime(networkStatus, currentGame, `Joined "${msg.roomId}" as ${game.networkRole}`);
  });
  netClient.on("room.roster", (msg) => {
    netControllerId = msg.controllerId || null;
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    const players = Array.isArray(msg.players) ? msg.players.length : 0;
    updateNetworkStatusRuntime(networkStatus, currentGame, `Room: ${players} connected | Role: ${game.networkRole}`);
  });
  const handleMapReady = () => {
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
      netSnapshotBuffer.push({ recvTime: performance.now(), ...netPendingSnapshot });
      netPendingSnapshot = null;
    }
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    updateNetworkStatusRuntime(networkStatus, currentGame, `Room synced | Role: ${game.networkRole}`);
    game.networkReady = true;
  };

  netClient.on("state.mapMeta", (msg) => {
    netMapSignature = applyMapMetaToGame(game, msg) || netMapSignature;
    netPendingInputs = [];
    netLastAckSeq = 0;
    netSnapshotBuffer = [];
    netMapChunksReceived = 0;
    netMapChunkSize = 24;
    netRequiredChunkKeys = new Set();
    netReceivedChunkKeys = new Set();
    netLastServerPlayer = null;
    netPredictedProjectiles = new Map();
    game.networkHasMap = true;
    game.networkHasChunks = false;
    game.networkChunkSync = true;
    game.armorStands = syncByIdLerp(game.armorStands, msg.armorStands, 1);
    updateNetworkStatusRuntime(networkStatus, currentGame, "Loading nearby map chunks...");
  });
  netClient.on("state.mapChunk", (msg) => {
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
    netMapSignature = applyMapStateToGame(game, msg) || netMapSignature;
    netPendingInputs = [];
    netLastAckSeq = 0;
    netSnapshotBuffer = [];
    netRequiredChunkKeys = new Set();
    netReceivedChunkKeys = new Set();
    netLastServerPlayer = null;
    netPredictedProjectiles = new Map();
    game.networkHasMap = true;
    game.networkHasChunks = true;
    game.networkChunkSync = false;
    game.armorStands = syncByIdLerp(game.armorStands, msg.armorStands, 1);
    handleMapReady();
  });
  netClient.on("state.meta", (msg) => {
    observeServerTimeIntoState(netClockState, msg.serverTime, NET_CLOCK_OFFSET_SMOOTHING);
    const metaSig = typeof msg.mapSignature === "string" ? msg.mapSignature : "";
    if (metaSig && netMapSignature && metaSig !== netMapSignature) return;
    const meta = msg && msg.meta && typeof msg.meta === "object" ? msg.meta : msg;
    applyMetaStateToGame(game, meta);
    syncMusicForGame(game);
  });
  netClient.on("state.snapshot", (msg) => {
    const recvAt = performance.now();
    if (netLastSnapshotRecvAtMs > 0) {
      const gap = Math.max(0, recvAt - netLastSnapshotRecvAtMs);
      netLastSnapshotGapMs = gap;
      netSnapshotIntervalMeanMs += (gap - netSnapshotIntervalMeanMs) * 0.1;
      netSnapshotJitterMs += (Math.abs(gap - netSnapshotIntervalMeanMs) - netSnapshotJitterMs) * 0.18;
    }
    netLastSnapshotRecvAtMs = recvAt;
    netControllerId = msg.controllerId || netControllerId;
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
      netPredictedProjectiles = new Map();
      updateNetworkStatusRuntime(networkStatus, currentGame, "Synchronizing floor data...");
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    if (snapshotSig && !netMapSignature) {
      netPendingSnapshot = msg;
      game.networkReady = false;
      game.networkHasChunks = false;
      netLastServerPlayer = null;
      netPredictedProjectiles = new Map();
      updateNetworkStatusRuntime(networkStatus, currentGame, "Waiting for map meta...");
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    const p = msg?.state?.player;
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
    game.networkReady = false;
    syncMusicForGame(game);
    updateNetworkStatusRuntime(networkStatus, currentGame, "Disconnected from server");
  });
  netClient.connect();

  netInputTimer = setInterval(() => {
    if (!netClient || !currentGame || currentGame !== game) return;
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
      firePrimaryQueued: input.firePrimaryQueued,
      fireAltQueued: input.fireAltQueued
    };
    if (!isNetworkController()) {
      input.firePrimaryQueued = false;
      input.firePrimaryHeld = false;
      input.fireAltQueued = false;
    } else {
      netNextHeldPrimaryPredictAtMs = predictProjectileSpawn(
        game,
        input,
        nowMs,
        isNetworkController(),
        netPredictedProjectiles,
        netNextHeldPrimaryPredictAtMs
      );
      if (netMapSignature && game.networkReady) {
        predictFromInput(game, input, inputDt, canRunPredictedCollision(game, isKnownMapTileAt));
      }
      netPendingInputs.push({
        seq: input.seq,
        dt: inputDt,
        moveX: input.moveX,
        moveY: input.moveY,
        hasAim: input.hasAim,
        aimX: input.aimX,
        aimY: input.aimY
      });
      if (netPendingInputs.length > 120) {
        netPendingInputs.splice(0, netPendingInputs.length - 120);
      }
    }
    netClient.sendInput(input);
  }, 16);
}

if (!canvas) {
  throw new Error("Game canvas not found.");
}

startIdleSoundMonitor(() => currentGame, syncIdleSoundState);

selectedClass = wireMenuControls({
  selector,
  startButton,
  classButtons,
  setSelectedClass,
  onClassSelected: (nextClass) => {
    selectedClass = nextClass;
  },
  startLocalGame,
  startNetworkButton,
  startNetworkGame,
  networkTakeControl,
  takeControl: () => {
    if (netClient) netClient.takeControl();
  },
  networkLeave,
  returnToMenu
});

startSplashScreen();
