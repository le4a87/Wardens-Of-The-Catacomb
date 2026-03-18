export function updateNetworkStatus(networkStatus, currentGame, text) {
  if (networkStatus) networkStatus.textContent = text;
  if (currentGame && currentGame.networkEnabled) currentGame.networkLoadingMessage = text;
}

export function getRenderDelayMs(isNetworkController, controllerDelayMs, spectatorDelayMs) {
  return isNetworkController() ? controllerDelayMs : spectatorDelayMs;
}

export function updateRequiredChunkReadiness(computeChunkReadiness, game, playerX, playerY, netMapChunkSize, netReceivedChunkKeys) {
  const readiness = computeChunkReadiness(game, playerX, playerY, netMapChunkSize, netReceivedChunkKeys);
  if (game) game.networkHasChunks = readiness.hasChunks;
  return readiness.requiredChunkKeys;
}

export function cleanupCurrentGame(currentGame) {
  if (currentGame) currentGame.stop();
  return null;
}

export function returnToMenu({ stopNetworkSession, cleanupCurrentGame, layout, menuPanel, selector, music }) {
  stopNetworkSession();
  cleanupCurrentGame();
  if (layout) layout.classList.remove("is-splash");
  if (menuPanel) menuPanel.hidden = false;
  if (selector) selector.hidden = false;
  music.playMenuMusic();
}

export function dismissSplash({
  splashActive,
  splashDismissed,
  setSplashDismissed,
  setSplashActive,
  windowObject,
  handleSplashKeydown,
  layout,
  splashRaf,
  cancelFrame,
  clearSplashRender,
  selector,
  currentGame,
  menuPanel,
  music,
  startFallbackGame
}) {
  if (!splashActive || splashDismissed) return false;
  setSplashDismissed(true);
  setSplashActive(false);
  windowObject.removeEventListener("keydown", handleSplashKeydown);
  if (layout) layout.classList.remove("is-splash");
  if (splashRaf) cancelFrame(splashRaf);
  clearSplashRender();
  if (selector && !currentGame) {
    if (menuPanel) menuPanel.hidden = false;
    selector.hidden = false;
    music.playMenuMusic();
    return true;
  }
  if (!selector && !currentGame) startFallbackGame();
  return true;
}

export function handleSplashKeydown(event, splashActive, dismissSplash) {
  if (!splashActive) return;
  if (!event || event.repeat) return;
  dismissSplash();
}

export function startSplashScreen({
  layout,
  menuPanel,
  selector,
  networkSession,
  music,
  fadeMs,
  requestFrame,
  drawSplash,
  windowObject,
  handleSplashKeydown,
  now
}) {
  if (layout) layout.classList.add("is-splash");
  if (menuPanel) menuPanel.hidden = true;
  if (selector) selector.hidden = true;
  if (networkSession) networkSession.hidden = true;
  music.playMenuMusic({ fadeInMs: fadeMs });
  const splashRaf = requestFrame(drawSplash);
  windowObject.addEventListener("keydown", handleSplashKeydown);
  return { splashStartedAt: now, splashRaf };
}
