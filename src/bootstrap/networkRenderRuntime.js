export function applyNetworkSnapshot({
  game,
  state,
  controller = false,
  ackSeq = 0,
  applySnapshotToGame,
  isNetworkController,
  localPlayerId,
  netPredictedProjectiles,
  netPendingInputs,
  netLastAckSeq,
  netSnapshotJitterMs,
  netLastSnapshotGapMs,
  syncMusicForGame
}) {
  const next = applySnapshotToGame({
    game,
    state,
    controller,
    ackSeq,
    isNetworkController,
    localPlayerId,
    netPredictedProjectiles,
    netPendingInputs,
    netLastAckSeq,
    snapshotJitterMs: netSnapshotJitterMs,
    frameGapMs: netLastSnapshotGapMs
  });
  if (game.gameOver && !game.deathTransition?.active && typeof game.triggerGameOver === "function") {
    game.triggerGameOver();
  }
  syncMusicForGame(game);
  return next;
}

export function startNetworkRenderLoopRuntime({
  game,
  getCurrentGame,
  handleNetworkUiActions,
  netClient,
  isNetworkController,
  getRenderDelayMs,
  estimateServerNowMs,
  consumeSnapshotForRender,
  netSnapshotBuffer,
  maxSnapshotBuffer,
  applySnapshot,
  collectInput,
  prunePredictedProjectiles,
  netPredictedProjectiles,
  setNetRenderRaf
}) {
  let lastFrameAt = performance.now();

  const loop = (now) => {
    if (!getCurrentGame() || getCurrentGame() !== game) return;
    const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
    lastFrameAt = now;
    handleNetworkUiActions(game, netClient, isNetworkController());
    const renderDelay = getRenderDelayMs();
    const targetRecvTime = performance.now() - renderDelay;
    const estimatedServerNow = estimateServerNowMs();
    const targetServerTime = Number.isFinite(estimatedServerNow) ? estimatedServerNow - renderDelay : NaN;
    const pkt = consumeSnapshotForRender(netSnapshotBuffer, targetServerTime, targetRecvTime, maxSnapshotBuffer);
    if (pkt) {
      applySnapshot(game, pkt.state, isNetworkController(), Number.isFinite(pkt.lastInputSeq) ? pkt.lastInputSeq : 0);
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
    setNetRenderRaf(requestAnimationFrame(loop));
  };

  setNetRenderRaf(requestAnimationFrame(loop));
}
