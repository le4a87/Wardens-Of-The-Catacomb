import { NetClient } from "../net/NetClient.js";
import {
  applyMapStateToGame,
  applyMapMetaToGame,
  applyMapChunkToGame,
  applyMetaStateToGame,
  applySnapshotToGame,
  isKnownMapTileAt,
  syncByIdLerp
} from "../net/clientStateSync.js";
import { chunkKey, computeChunkReadiness } from "../net/mapChunkReadiness.js";
import { predictProjectileSpawn, prunePredictedProjectiles } from "../net/projectilePrediction.js";
import {
  canRunPredictedCollision,
  collectInput,
  handleNetworkUiActions,
  predictFromInput,
  shouldSendNetworkInput,
  updateNetworkRole
} from "../net/sessionInteraction.js";
import {
  consumeSnapshotForRender,
  estimateServerNowMs as estimateServerNowMsFromState,
  observeServerTime as observeServerTimeIntoState
} from "./gameUiRuntime.js";
import {
  getRenderDelayMs as getRenderDelayForRole,
  updateNetworkStatus as updateNetworkStatusRuntime,
  updateRequiredChunkReadiness as updateRequiredChunkReadinessRuntime
} from "./gameUiSessionRuntime.js";
import { initializeNetworkGameState } from "./networkSessionGameInit.js";
import { applyNetworkSnapshot, startNetworkRenderLoopRuntime } from "./networkRenderRuntime.js";
import {
  persistSuccessfulServerUrlChoice,
  resolveActiveServerUrl,
} from "../runtime/runtimeConfig.js";

const NET_INPUT_DT = 1 / 60;
const NET_CLOCK_OFFSET_SMOOTHING = 0.12;
const NET_MAX_SNAPSHOT_BUFFER = 20;
const NET_MIN_SEND_MS = 28;
const NET_FORCE_SEND_IDLE_MS = 100;

export function createNetworkSessionController({
  Game,
  canvas,
  selector,
  networkSession,
  networkStatus,
  networkTakeControl,
  serverUrlInput,
  roomIdInput,
  playerNameInput,
  getCurrentGame,
  setCurrentGame,
  cleanupCurrentGame,
  syncMusicForGame,
  createReturnToMenuHandler,
  controllerRenderDelayMs = 36,
  spectatorRenderDelayMs = 72
}) {
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
  let netSnapshotBuffer = [];
  let netLastInputSendAt = 0;
  let netLastSentInput = null;
  let netLastInputProcessAt = 0;
  let netMapChunksReceived = 0;
  let netMapChunkSize = 24;
  let netRequiredChunkKeys = new Set();
  let netReceivedChunkKeys = new Set();
  let netLastServerPlayer = null;
  const netClockState = { offsetMs: 0, ready: false };
  const netPredictedProjectiles = new Map();
  let netNextHeldPrimaryPredictAtMs = 0;
  let netLastSnapshotRecvAtMs = 0;
  let netSnapshotIntervalMeanMs = 33;
  let netSnapshotJitterMs = 0;
  let netLastSnapshotGapMs = 33;
  let netInitialSnapshotApplied = false;

  const isNetworkController = () => !!(netControllerId && netPlayerId && netControllerId === netPlayerId);

  const getDebugState = () => ({
    controllerId: netControllerId,
    playerId: netPlayerId,
    lastAckSeq: netLastAckSeq,
    pendingInputs: netPendingInputs.length,
    snapshotBuffer: netSnapshotBuffer.length,
    pendingSnapshot: !!netPendingSnapshot,
    jitterMs: netSnapshotJitterMs,
    gapMs: netLastSnapshotGapMs
  });

  const resetNetworkState = () => {
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
    netClockState.offsetMs = 0;
    netClockState.ready = false;
    netPredictedProjectiles.clear();
    netNextHeldPrimaryPredictAtMs = 0;
    netLastSnapshotRecvAtMs = 0;
    netSnapshotIntervalMeanMs = 33;
    netSnapshotJitterMs = 0;
    netLastSnapshotGapMs = 33;
    netInitialSnapshotApplied = false;
  };

  const stopNetworkSession = () => {
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
    resetNetworkState();
    const game = getCurrentGame();
    if (game) game.networkPredictedProjectiles = null;
    if (networkSession) networkSession.hidden = true;
  };

  const applySnapshot = (game, state, controller = false, ackSeq = 0) => {
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
    netInitialSnapshotApplied = true;
  };

  const startNetworkRenderLoop = (game) => {
    startNetworkRenderLoopRuntime({
      game,
      getCurrentGame,
      handleNetworkUiActions,
      getNetClient: () => netClient,
      isNetworkController,
      getRenderDelayMs: () => getRenderDelayForRole(isNetworkController, controllerRenderDelayMs, spectatorRenderDelayMs),
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
  };

  const startNetworkGame = (selectedClass) => {
    stopNetworkSession();
    if (selector) selector.hidden = true;
    if (networkSession) networkSession.hidden = false;
    setCurrentGame(cleanupCurrentGame(getCurrentGame()));

    const wsUrl = resolveActiveServerUrl({
      inputValue: serverUrlInput?.value || "",
      storage: globalThis?.localStorage,
      locationObject: globalThis?.location
    });
    const roomId = roomIdInput && roomIdInput.value ? roomIdInput.value.trim() : "lobby";
    const name = playerNameInput && playerNameInput.value ? playerNameInput.value.trim() : "Player";
    if (serverUrlInput && !serverUrlInput.value.trim()) serverUrlInput.value = wsUrl;

    const game = new Game(canvas, {
      classType: selectedClass,
      onReturnToMenu: createReturnToMenuHandler(stopNetworkSession),
      onPauseChanged: (_paused, nextGame) => syncMusicForGame(nextGame),
      onFloorChanged: (_floor, nextGame) => syncMusicForGame(nextGame),
      onGameOverChanged: (_gameOver, nextGame) => syncMusicForGame(nextGame)
    });
    initializeNetworkGameState(game, netPredictedProjectiles);
    setCurrentGame(game);
    syncMusicForGame(game);
    updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Connecting to ${wsUrl}...`);
    startNetworkRenderLoop(game);

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
        const initialPending = netPendingSnapshot;
        applySnapshot(
          game,
          initialPending.state,
          isNetworkController(),
          Number.isFinite(initialPending.lastInputSeq) ? initialPending.lastInputSeq : 0
        );
        netPendingSnapshot = null;
      }
      if (!netInitialSnapshotApplied) {
        updateNetworkRole(game, isNetworkController(), networkTakeControl);
        updateNetworkStatusRuntime(networkStatus, getCurrentGame(), "Waiting for first snapshot...");
        game.networkReady = false;
        return;
      }
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Room synced | Role: ${game.networkRole}`);
      game.networkReady = true;
    };

    netClient = new NetClient(wsUrl);
    netClient.on("open", () => {
      persistSuccessfulServerUrlChoice(wsUrl);
      updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Connected. Joining room "${roomId}"...`);
      netClient.join(roomId, name, selectedClass);
    });
    netClient.on("hello", (msg) => {
      netPlayerId = msg.playerId || null;
    });
    netClient.on("join.ok", (msg) => {
      netControllerId = msg.controllerId || null;
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Joined "${msg.roomId}" as ${game.networkRole}`);
    });
    netClient.on("room.roster", (msg) => {
      netControllerId = msg.controllerId || null;
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      const players = Array.isArray(msg.players) ? msg.players.length : 0;
      updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Room: ${players} connected | Role: ${game.networkRole}`);
    });
    netClient.on("state.mapMeta", (msg) => {
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
      updateNetworkStatusRuntime(networkStatus, getCurrentGame(), "Loading nearby map chunks...");
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
    netClient.on("state.map", (msg) => {
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
        netSnapshotBuffer.length = 0;
        netPredictedProjectiles.clear();
        netInitialSnapshotApplied = false;
        updateNetworkStatusRuntime(networkStatus, getCurrentGame(), "Synchronizing floor data...");
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
        netInitialSnapshotApplied = false;
        updateNetworkStatusRuntime(networkStatus, getCurrentGame(), "Waiting for map meta...");
        updateNetworkRole(game, isNetworkController(), networkTakeControl);
        return;
      }
      if (game.networkHasMap && game.networkHasChunks && !game.networkReady && netSnapshotBuffer.length === 0) {
        applySnapshot(game, msg.state, isNetworkController(), Number.isFinite(msg.lastInputSeq) ? msg.lastInputSeq : 0);
        if (netInitialSnapshotApplied) {
          updateNetworkRole(game, isNetworkController(), networkTakeControl);
          updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Room synced | Role: ${game.networkRole}`);
          game.networkReady = true;
        } else {
          updateNetworkRole(game, isNetworkController(), networkTakeControl);
          updateNetworkStatusRuntime(networkStatus, getCurrentGame(), "Waiting for first snapshot...");
          game.networkReady = false;
        }
        return;
      }
      const player = msg?.state?.player;
      if (player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
        netLastServerPlayer = { x: player.x, y: player.y };
        netRequiredChunkKeys = updateRequiredChunkReadinessRuntime(
          computeChunkReadiness,
          game,
          player.x,
          player.y,
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
    netClient.on("warn", (msg) => updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Warning: ${msg.message || "Server warning"}`));
    netClient.on("error", (msg) => updateNetworkStatusRuntime(networkStatus, getCurrentGame(), `Error: ${msg.message || "Connection error"}`));
    netClient.on("close", () => {
      game.networkReady = false;
      syncMusicForGame(game);
      updateNetworkStatusRuntime(networkStatus, getCurrentGame(), "Disconnected from server");
    });
    netClient.connect();

    netInputTimer = setInterval(() => {
      const currentGame = getCurrentGame();
      if (!netClient || !currentGame || currentGame !== game) return;
      const input = collectInput(game, true);
      input.seq = ++netInputSeq;
      const nowMs = performance.now();
      const inputDt = netLastInputProcessAt > 0 ? Math.min(0.05, Math.max(0.001, (nowMs - netLastInputProcessAt) / 1000)) : NET_INPUT_DT;
      netLastInputProcessAt = nowMs;
      if (nowMs - netLastInputSendAt < NET_MIN_SEND_MS && !input.firePrimaryQueued && !input.fireAltQueued) return;
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
  };

  const takeControl = () => {
    if (netClient) netClient.takeControl();
  };

  return {
    stopNetworkSession,
    startNetworkGame,
    takeControl,
    getDebugState,
    isNetworkController
  };
}
