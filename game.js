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
let netLastSnapshotRecvAtMs = 0, netSnapshotIntervalMeanMs = 33, netSnapshotJitterMs = 0, netLastSnapshotGapMs = 33;
let netInitialSnapshotApplied = false;
let splashActive = true, splashDismissed = false, splashRaf = 0, splashStartedAt = 0, splashReady = false;
const isDevMode = new URLSearchParams(window.location.search).get("dev") === "1";

if (devStartOptions) devStartOptions.hidden = !isDevMode;

if (typeof window !== "undefined") {
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
          health: game.player?.health || 0,
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
                intendedAngle: shot.intendedAngle,
                volleyAngles: Array.isArray(shot.volleyAngles) ? shot.volleyAngles.slice() : [],
                multishotCount: shot.multishotCount || 0,
                projectileSpeed: shot.projectileSpeed || 0,
                fireCooldown: shot.fireCooldown || 0,
                seq: shot.seq || 0
              }))
            : []
        },
        net: {
          controllerId: netControllerId,
          playerId: netPlayerId,
          lastAckSeq: netLastAckSeq,
          pendingInputs: netPendingInputs.length,
          snapshotBuffer: netSnapshotBuffer.length,
          pendingSnapshot: !!netPendingSnapshot,
          jitterMs: netSnapshotJitterMs,
          gapMs: netLastSnapshotGapMs
        },
        networkPerf: game.networkPerf && typeof game.networkPerf === "object"
          ? {
              appliedSnapshotCount: game.networkPerf.appliedSnapshotCount || 0,
              lastCorrectionPx: game.networkPerf.lastCorrectionPx || 0,
              maxCorrectionPx: game.networkPerf.maxCorrectionPx || 0,
              hardSnapCount: game.networkPerf.hardSnapCount || 0,
              softCorrectionCount: game.networkPerf.softCorrectionCount || 0,
              settleCorrectionCount: game.networkPerf.settleCorrectionCount || 0,
              blockedSnapCount: game.networkPerf.blockedSnapCount || 0
            }
          : null,
        ui: {
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
        audio: typeof music.getDebugState === "function" ? music.getDebugState() : null,
        documentHasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
        documentVisibilityState: typeof document.visibilityState === "string" ? document.visibilityState : ""
      };
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
  netInitialSnapshotApplied = true;
}

function startNetworkRenderLoop(game) {
  startNetworkRenderLoopRuntime({
    game,
    getCurrentGame: () => currentGame,
    handleNetworkUiActions,
    getNetClient: () => netClient,
    isNetworkController,
    getRenderDelayMs: () => getRenderDelayForRole(isNetworkController, NET_RENDER_DELAY_MS_CONTROLLER, NET_RENDER_DELAY_MS_SPECTATOR),
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
  game.networkPerf = {
    appliedSnapshotCount: 0,
    lastCorrectionPx: 0,
    maxCorrectionPx: 0,
    hardSnapCount: 0,
    softCorrectionCount: 0,
    settleCorrectionCount: 0,
    blockedSnapCount: 0
  };
  game.networkPredictedProjectiles = netPredictedProjectiles;
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
      updateNetworkStatusRuntime(networkStatus, currentGame, "Waiting for first snapshot...");
      game.networkReady = false;
      return;
    }
    updateNetworkRole(game, isNetworkController(), networkTakeControl);
    updateNetworkStatusRuntime(networkStatus, currentGame, `Room synced | Role: ${game.networkRole}`);
    game.networkReady = true;
  };

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
      netInitialSnapshotApplied = false;
      updateNetworkStatusRuntime(networkStatus, currentGame, "Waiting for map meta...");
      updateNetworkRole(game, isNetworkController(), networkTakeControl);
      return;
    }
    if (game.networkHasMap && game.networkHasChunks && !game.networkReady && netSnapshotBuffer.length === 0) {
      applySnapshot(game, msg.state, isNetworkController(), Number.isFinite(msg.lastInputSeq) ? msg.lastInputSeq : 0);
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
