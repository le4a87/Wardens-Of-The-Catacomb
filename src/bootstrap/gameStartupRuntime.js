export function createLocalGame({
  Game,
  canvas,
  selectedClass,
  playerHandle = "Player",
  returnToMenu,
  syncMusicForGame,
  startingFloor = 1,
  onGameOverChanged = null
}) {
  const game = new Game(canvas, {
    classType: selectedClass,
    onReturnToMenu: returnToMenu,
    onPauseChanged: (_paused, nextGame) => syncMusicForGame(nextGame),
    onFloorChanged: (_floor, nextGame) => syncMusicForGame(nextGame),
    onGameOverChanged: (gameOver, nextGame) => {
      syncMusicForGame(nextGame);
      if (typeof onGameOverChanged === "function") onGameOverChanged(gameOver, nextGame);
    }
  });
  game.playerHandle = playerHandle;
  game.deathTransitionDuration = 10;
  if (startingFloor > 1 && typeof game.applyDebugStartingFloor === "function") {
    game.applyDebugStartingFloor(startingFloor);
  }
  syncMusicForGame(game);
  game.start();
  return game;
}

export function startIdleSoundMonitor(getCurrentGame, syncIdleSoundState) {
  const monitor = () => {
    syncIdleSoundState(getCurrentGame());
    requestAnimationFrame(monitor);
  };
  requestAnimationFrame(monitor);
}

export function wireMenuControls({
  selector,
  startButton,
  classButtons,
  setSelectedClass,
  onClassSelected,
  startLocalGame,
  startNetworkButton,
  startNetworkGame,
  networkTakeControl,
  takeControl,
  networkLeave,
  returnToMenu
}) {
  if (!selector || !startButton || classButtons.length === 0) return setSelectedClass("archer", classButtons);
  let selectedClass = setSelectedClass("archer", classButtons);
  for (const button of classButtons) {
    button.addEventListener("click", () => {
      selectedClass = setSelectedClass(button.dataset.classOption, classButtons);
      onClassSelected(selectedClass);
    });
  }
  startButton.addEventListener("click", startLocalGame);
  if (startNetworkButton) startNetworkButton.addEventListener("click", startNetworkGame);
  if (networkTakeControl) {
    networkTakeControl.addEventListener("click", () => {
      takeControl();
    });
  }
  if (networkLeave) networkLeave.addEventListener("click", returnToMenu);
  return selectedClass;
}
