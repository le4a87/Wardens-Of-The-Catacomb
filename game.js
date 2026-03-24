import { Game } from "./src/Game.js";
import { MusicController } from "./src/audio/MusicController.js";
import { installDebugRuntime } from "./src/bootstrap/debugRuntime.js";
import {
  clearSplashRender as clearSplashCanvas,
  drawSplashFrame,
  syncIdleSoundState as syncIdleMusicState,
  syncMusicForGame as syncMusicControllerForGame
} from "./src/bootstrap/gameUiRuntime.js";
import {
  cleanupCurrentGame as cleanupCurrentGameRuntime,
  dismissSplash as dismissSplashRuntime,
  handleSplashKeydown as handleSplashKeydownRuntime,
  returnToMenu as returnToMenuRuntime,
  startSplashScreen as startSplashScreenRuntime
} from "./src/bootstrap/gameUiSessionRuntime.js";
import { createNetworkSessionController } from "./src/bootstrap/networkSessionRuntime.js";
import { createLocalGame, startIdleSoundMonitor, wireMenuControls } from "./src/bootstrap/gameStartupRuntime.js";
import { setSelectedClass } from "./src/net/sessionInteraction.js";

const canvas = document.getElementById("game");
const layout = document.querySelector(".layout");
const menuPanel = document.querySelector(".panel");
const selector = document.getElementById("character-select");
const devStartOptions = document.getElementById("dev-start-options");
const devStartFloorInput = document.getElementById("dev-start-floor");
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
const splashLogo = new Image();
const SPLASH_FADE_MS = 1800;
const delayParams = new URLSearchParams(window.location.search);
const isDevMode = delayParams.get("dev") === "1";

let selectedClass = "archer";
let currentGame = null;
let splashActive = true;
let splashDismissed = false;
let splashRaf = 0;
let splashStartedAt = 0;
let splashReady = false;
let networkController = null;

function parseDelayParam(key, fallback) {
  const raw = delayParams.get(key);
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

if (!canvas) {
  throw new Error("Game canvas not found.");
}

if (devStartOptions) devStartOptions.hidden = !isDevMode;

function syncIdleSoundState(game) {
  syncIdleMusicState(music, splashActive, game);
}

function syncMusicForGame(game) {
  syncMusicControllerForGame(music, splashActive, game);
}

function cleanupCurrentGame(game) {
  return cleanupCurrentGameRuntime(game);
}

function setCurrentGame(game) {
  currentGame = game;
}

function returnToMenu() {
  returnToMenuRuntime({
    stopNetworkSession: () => networkController?.stopNetworkSession(),
    cleanupCurrentGame: () => {
      currentGame = cleanupCurrentGame(currentGame);
    },
    layout,
    menuPanel,
    selector,
    music
  });
}

function createReturnToMenuHandler() {
  return returnToMenu;
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

const handleSplashKeydown = (event) => {
  handleSplashKeydownRuntime(event, splashActive, dismissSplash);
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

function startSplashScreen() {
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
}

function startLocalGame() {
  networkController.stopNetworkSession();
  if (selector) selector.hidden = true;
  currentGame = cleanupCurrentGame(currentGame);
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

networkController = createNetworkSessionController({
  Game,
  canvas,
  selector,
  networkSession,
  networkStatus,
  networkTakeControl,
  serverUrlInput,
  roomIdInput,
  playerNameInput,
  getCurrentGame: () => currentGame,
  setCurrentGame,
  cleanupCurrentGame,
  syncMusicForGame,
  createReturnToMenuHandler,
  controllerRenderDelayMs: parseDelayParam("netDelayController", 36),
  spectatorRenderDelayMs: parseDelayParam("netDelaySpectator", 72)
});

installDebugRuntime({
  getCurrentGame: () => currentGame,
  getMusicDebugState: () => (typeof music.getDebugState === "function" ? music.getDebugState() : null),
  getNetworkDebugState: () => networkController.getDebugState()
});

splashLogo.addEventListener("load", () => {
  splashReady = true;
});
splashLogo.addEventListener("error", () => {
  splashReady = false;
});
splashLogo.src = "./assets/images/logo.png";
if (splashLogo.complete && splashLogo.naturalWidth > 0 && splashLogo.naturalHeight > 0) splashReady = true;

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
  startNetworkGame: () => {
    networkController.startNetworkGame(selectedClass);
  },
  networkTakeControl,
  takeControl: () => {
    networkController.takeControl();
  },
  networkLeave,
  returnToMenu
});

startSplashScreen();
