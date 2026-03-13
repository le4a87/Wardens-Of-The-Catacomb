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

const canvas = document.getElementById("game");
const selector = document.getElementById("character-select");
const classButtons = Array.from(document.querySelectorAll("[data-class-option]"));
const startButton = document.getElementById("start-game");
const startNetworkButton = document.getElementById("start-network-game");
const serverUrlInput = document.getElementById("net-server-url");
const roomIdInput = document.getElementById("net-room-id");
const playerNameInput = document.getElementById("net-player-name");
const networkSession = document.getElementById("network-session");
const networkStatus = document.getElementById("network-status");
const networkTakeControl = document.getElementById("network-take-control");
const networkLeave = document.getElementById("network-leave");
const music = new MusicController();
let selectedClass = "archer";
let currentGame = null;
let netClient = null;
let netInputTimer = 0;
let netRenderRaf = 0;
let netPlayerId = null;
let netControllerId = null;
let netInputSeq = 0;
let netLastAckSeq = 0;
let netPendingInputs = [];
let netMapSignature = "";
let netPendingSnapshot = null;
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
let netSnapshotBuffer = [];
let netLastInputSendAt = 0;
let netLastSentInput = null;
let netLastInputProcessAt = 0;
let netMapChunksReceived = 0;
let netMapChunkSize = 24;
let netRequiredChunkKeys = new Set();
let netReceivedChunkKeys = new Set();
let netLastServerPlayer = null;
let netClockOffsetMs = 0;
let netClockOffsetReady = false;
let netPredictedProjectiles = new Map();
let netNextHeldPrimaryPredictAtMs = 0;
let netLastSnapshotRecvAtMs = 0;
let netSnapshotIntervalMeanMs = 33;
let netSnapshotJitterMs = 0;
let netLastSnapshotGapMs = 33;

function syncIdleSoundState(game) {
  const idleGameplayActive = !!(
    game &&
    !game.paused &&
    !game.gameOver &&
    !game.shopOpen &&
    !game.skillTreeOpen &&
    !game.statsPanelOpen
  );
  music.setIdleGameplayActive(idleGameplayActive);
  if (!idleGameplayActive) music.resetIdleTimer();
}

function syncMusicForGame(game) {
  syncIdleSoundState(game);
  if (!game) {
    music.playMenuMusic();
    return;
  }
  if (game.gameOver) {
    music.playDeathMusic();
    return;
  }
  if (game.networkEnabled) {
    if (game.musicTrack) music.playGameplayMusic(game.floor, game.musicTrack);
  } else {
    music.playGameplayMusic(game.floor);
  }
  if (game.paused || game.gameOver) music.pauseCurrentTrack();
  else music.playCurrentTrack();
}

function updateNetworkStatus(text) {
  if (networkStatus) networkStatus.textContent = text;
  if (currentGame && currentGame.networkEnabled) currentGame.networkLoadingMessage = text;
}

function getRenderDelayMs() {
  return isNetworkController() ? NET_RENDER_DELAY_MS_CONTROLLER : NET_RENDER_DELAY_MS_SPECTATOR;
}

function observeServerTime(serverTime) {
  if (!Number.isFinite(serverTime)) return;
  const observedOffset = Date.now() - serverTime;
  if (!netClockOffsetReady) {
    netClockOffsetMs = observedOffset;
    netClockOffsetReady = true;
    return;
  }
  netClockOffsetMs += (observedOffset - netClockOffsetMs) * NET_CLOCK_OFFSET_SMOOTHING;
}

function estimateServerNowMs() {
  if (!netClockOffsetReady) return NaN;
  return Date.now() - netClockOffsetMs;
}

function updateRequiredChunkReadiness(game, playerX, playerY) {
  const readiness = computeChunkReadiness(game, playerX, playerY, netMapChunkSize, netReceivedChunkKeys);
  netRequiredChunkKeys = readiness.requiredChunkKeys;
  if (game) game.networkHasChunks = readiness.hasChunks;
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
  netPlayerId = null;
  netControllerId = null;
  netInputSeq = 0;
  netLastAckSeq = 0;
  netPendingInputs = [];
  netMapSignature = "";
  netPendingSnapshot = null;
  netSnapshotBuffer = [];
  netLastInputSendAt = 0;
  netLastSentInput = null;
  netLastInputProcessAt = 0;
  netMapChunksReceived = 0;
  netMapChunkSize = 24;
  netRequiredChunkKeys = new Set();
  netReceivedChunkKeys = new Set();
  netLastServerPlayer = null;
  netClockOffsetMs = 0;
  netClockOffsetReady = false;
  netPredictedProjectiles = new Map();
  netNextHeldPrimaryPredictAtMs = 0;
  netLastSnapshotRecvAtMs = 0;
  netSnapshotIntervalMeanMs = 33;
  netSnapshotJitterMs = 0;
  netLastSnapshotGapMs = 33;
  if (networkSession) networkSession.hidden = true;
}

function cleanupCurrentGame() {
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
}

function returnToMenu() {
  stopNetworkSession();
  cleanupCurrentGame();
  if (selector) selector.hidden = false;
  music.playMenuMusic();
}

function isNetworkController() {
  return !!(netControllerId && netPlayerId && netControllerId === netPlayerId);
}

function applySnapshot(game, state, controller = false, ackSeq = 0) {
  const next = applySnapshotToGame({
    game,
    state,
    controller,
    ackSeq,
    isNetworkController: isNetworkController(),
    localPlayerId: netPlayerId,
    netPredictedProjectiles,
    netPendingInputs,
    netLastAckSeq,
    snapshotJitterMs: netSnapshotJitterMs,
    frameGapMs: netLastSnapshotGapMs
  });
  netPendingInputs = next.netPendingInputs;
  netLastAckSeq = next.netLastAckSeq;
  if (game.gameOver && !game.deathTransition?.active && typeof game.triggerGameOver === "function") game.triggerGameOver();
  syncMusicForGame(game);
}

function startNetworkRenderLoop(game) {
  let lastFrameAt = performance.now();

  const consumeSnapshotForRender = (targetServerTime, targetRecvTime) => {
    if (netSnapshotBuffer.length === 0) return null;
    // Keep buffer bounded and drop stale backlog to prevent catch-up bursts.
    if (netSnapshotBuffer.length > NET_MAX_SNAPSHOT_BUFFER) {
      netSnapshotBuffer.splice(0, netSnapshotBuffer.length - NET_MAX_SNAPSHOT_BUFFER);
    }
    const useServerClock = Number.isFinite(targetServerTime);
    let chosenIndex = -1;
    for (let i = 0; i < netSnapshotBuffer.length; i++) {
      const pkt = netSnapshotBuffer[i];
      const compareTime = useServerClock && Number.isFinite(pkt.serverTime) ? pkt.serverTime : pkt.recvTime;
      if (compareTime <= (useServerClock ? targetServerTime : targetRecvTime)) chosenIndex = i;
      else break;
    }
    if (chosenIndex < 0) {
      // Nothing old enough yet; avoid rendering far behind by trimming excessive queue growth.
      if (netSnapshotBuffer.length > 10) {
        const keep = netSnapshotBuffer.slice(-6);
        netSnapshotBuffer.length = 0;
        netSnapshotBuffer.push(...keep);
      }
      return null;
    }
    const chosen = netSnapshotBuffer[chosenIndex];
    // Drop all snapshots up to chosen; render at most one snapshot per frame.
    netSnapshotBuffer.splice(0, chosenIndex + 1);
    return chosen;
  };

  const loop = (now) => {
    if (!currentGame || currentGame !== game) return;
    const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
    lastFrameAt = now;
    handleNetworkUiActions(game, netClient, isNetworkController());
    const renderDelay = getRenderDelayMs();
    const targetRecvTime = performance.now() - renderDelay;
    const estimatedServerNow = estimateServerNowMs();
    const targetServerTime = Number.isFinite(estimatedServerNow) ? estimatedServerNow - renderDelay : NaN;
    const pkt = consumeSnapshotForRender(targetServerTime, targetRecvTime);
    if (pkt) {
      applySnapshot(
        game,
        pkt.state,
        isNetworkController(),
        Number.isFinite(pkt.lastInputSeq) ? pkt.lastInputSeq : 0
      );
    }
    if (isNetworkController()) {
      const input = collectInput(game, false);
      if (input.hasAim) {
        const ax = input.aimX - game.player.x;
        const ay = input.aimY - game.player.y;
        const alen = Math.hypot(ax, ay) || 1;
        game.player.dirX = ax / alen;
        game.player.dirY = ay / alen;
      }
    }
    if (typeof game.updateDeathTransition === "function") game.updateDeathTransition(dt);
    if (Array.isArray(game.map) && game.map.length > 0) game.revealAroundPlayer();
    prunePredictedProjectiles(netPredictedProjectiles);
    game.renderer.draw(game);
    netRenderRaf = requestAnimationFrame(loop);
  };
  netRenderRaf = requestAnimationFrame(loop);
}

function startLocalGame() {
  stopNetworkSession();
  if (selector) selector.hidden = true;
  cleanupCurrentGame();
  currentGame = new Game(canvas, {
    classType: selectedClass,
    onReturnToMenu: returnToMenu,
    onPauseChanged: (_paused, game) => syncMusicForGame(game),
    onFloorChanged: (_floor, game) => syncMusicForGame(game),
    onGameOverChanged: (_gameOver, game) => syncMusicForGame(game)
  });
  syncMusicForGame(currentGame);
  currentGame.start();
}

function startNetworkGame() {
  stopNetworkSession();
  if (selector) selector.hidden = true;
  if (networkSession) networkSession.hidden = false;
  cleanupCurrentGame();

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
  updateNetworkStatus(`Connecting to ${wsUrl}...`);
  startNetworkRenderLoop(game);

  netClient = new NetClient(wsUrl);
  netClient.on("open", () => {
    updateNetworkStatus(`Connected. Joining room "${roomId}"...`);
    netClient.join(roomId, name, selectedClass);
  });
  netClient.on("hello", (msg) => {
    netPlayerId = msg.playerId || null;
  });
  netClient.on("join.ok", (msg) => {
    netControllerId = msg.controllerId || null;
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    updateNetworkStatus(`Joined "${msg.roomId}" as ${game.networkRole}`);
  });
  netClient.on("room.roster", (msg) => {
    netControllerId = msg.controllerId || null;
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    const players = Array.isArray(msg.players) ? msg.players.length : 0;
    updateNetworkStatus(`Room: ${players} connected | Role: ${game.networkRole}`);
  });
  const handleMapReady = () => {
    const playerX = Number.isFinite(netLastServerPlayer?.x) ? netLastServerPlayer.x : game.player.x;
    const playerY = Number.isFinite(netLastServerPlayer?.y) ? netLastServerPlayer.y : game.player.y;
    updateRequiredChunkReadiness(game, playerX, playerY);
    if (!game.networkHasMap || !game.networkHasChunks) return;
    if (netPendingSnapshot && (!netPendingSnapshot.mapSignature || netPendingSnapshot.mapSignature === netMapSignature)) {
      observeServerTime(netPendingSnapshot.serverTime);
      netSnapshotBuffer.push({ recvTime: performance.now(), ...netPendingSnapshot });
      netPendingSnapshot = null;
    }
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    updateNetworkStatus(`Room synced | Role: ${game.networkRole}`);
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
    updateNetworkStatus("Loading nearby map chunks...");
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
    observeServerTime(msg.serverTime);
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
    observeServerTime(msg.serverTime);
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
      updateNetworkStatus("Synchronizing floor data...");
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    if (snapshotSig && !netMapSignature) {
      netPendingSnapshot = msg;
      game.networkReady = false;
      game.networkHasChunks = false;
      netLastServerPlayer = null;
      netPredictedProjectiles = new Map();
      updateNetworkStatus("Waiting for map meta...");
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    const p = msg?.state?.player;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      netLastServerPlayer = { x: p.x, y: p.y };
      updateRequiredChunkReadiness(game, p.x, p.y);
    }
    netSnapshotBuffer.push({ recvTime: recvAt, ...msg });
    if (netSnapshotBuffer.length > NET_MAX_SNAPSHOT_BUFFER * 2) {
      netSnapshotBuffer.splice(0, netSnapshotBuffer.length - NET_MAX_SNAPSHOT_BUFFER);
    }
    if (game.networkHasMap && game.networkHasChunks) handleMapReady();
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
  });
  netClient.on("warn", (msg) => updateNetworkStatus(`Warning: ${msg.message || "Server warning"}`));
  netClient.on("error", (msg) => updateNetworkStatus(`Error: ${msg.message || "Connection error"}`));
  netClient.on("close", () => {
    game.networkReady = false;
    syncMusicForGame(game);
    updateNetworkStatus("Disconnected from server");
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

music.playMenuMusic();

function monitorIdleSoundState() {
  syncIdleSoundState(currentGame);
  requestAnimationFrame(monitorIdleSoundState);
}

requestAnimationFrame(monitorIdleSoundState);

if (!selector || !startButton || classButtons.length === 0) {
  currentGame = new Game(canvas, {
    classType: "archer",
    onPauseChanged: (_paused, game) => syncMusicForGame(game),
    onFloorChanged: (_floor, game) => syncMusicForGame(game),
    onGameOverChanged: (_gameOver, game) => syncMusicForGame(game)
  });
  syncMusicForGame(currentGame);
  currentGame.start();
} else {
  selectedClass = setSelectedClass("archer", classButtons);
  for (const button of classButtons) {
    button.addEventListener("click", () => {
      selectedClass = setSelectedClass(button.dataset.classOption, classButtons);
    });
  }
  startButton.addEventListener("click", startLocalGame);
  if (startNetworkButton) startNetworkButton.addEventListener("click", startNetworkGame);
  if (networkTakeControl) {
    networkTakeControl.addEventListener("click", () => {
      if (netClient) netClient.takeControl();
    });
  }
  if (networkLeave) networkLeave.addEventListener("click", returnToMenu);
}
