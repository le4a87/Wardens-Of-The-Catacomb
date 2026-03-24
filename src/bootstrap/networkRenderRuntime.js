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
  return next;
}

export function startNetworkRenderLoopRuntime({
  game,
  getCurrentGame,
  handleNetworkUiActions,
  getNetClient,
  isNetworkController,
  getRenderDelayMs,
  estimateServerNowMs,
  consumeSnapshotForRender,
  netSnapshotBuffer,
  maxSnapshotBuffer,
  applySnapshot,
  collectInput,
  predictFromInput,
  canRunPredictedCollision,
  prunePredictedProjectiles,
  netPredictedProjectiles,
  setNetRenderRaf
}) {
  let lastFrameAt = performance.now();
  const stepClientFloatingTexts = (texts, dt) => {
    if (!Array.isArray(texts) || texts.length === 0) return texts;
    for (const ft of texts) {
      if (!ft) continue;
      ft.life = Math.max(0, (Number.isFinite(ft.life) ? ft.life : 0) - dt);
      ft.y -= (Number.isFinite(ft.vy) ? ft.vy : 22) * dt;
    }
    return texts.filter((ft) => ft && ft.life > 0);
  };

  const loop = (now) => {
    if (!getCurrentGame() || getCurrentGame() !== game) return;
    const targetFrameMs = isNetworkController() ? 0 : 1000 / 45;
    if (targetFrameMs > 0 && now - lastFrameAt < targetFrameMs) {
      setNetRenderRaf(requestAnimationFrame(loop));
      return;
    }
    const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
    lastFrameAt = now;
    handleNetworkUiActions(game, typeof getNetClient === "function" ? getNetClient() : null, isNetworkController());
    const renderDelay = getRenderDelayMs();
    const targetRecvTime = performance.now() - renderDelay;
    const estimatedServerNow = estimateServerNowMs();
    const targetServerTime = Number.isFinite(estimatedServerNow) ? estimatedServerNow - renderDelay : NaN;
    const pkt = consumeSnapshotForRender(netSnapshotBuffer, targetServerTime, targetRecvTime, maxSnapshotBuffer);
    if (pkt) {
      const stateWithServerTime =
        pkt?.state && typeof pkt.state === "object" && Number.isFinite(pkt.serverTime)
          ? { ...pkt.state, serverTime: pkt.serverTime }
          : pkt.state;
      applySnapshot(game, stateWithServerTime, isNetworkController(), Number.isFinite(pkt.lastInputSeq) ? pkt.lastInputSeq : 0);
    }
    if (isNetworkController()) {
      const input = collectInput(game, false);
      if (game.networkReady && typeof predictFromInput === "function") {
        predictFromInput(game, input, dt, typeof canRunPredictedCollision === "function" ? canRunPredictedCollision() : false);
      }
      if (input.hasAim) {
        if (Number.isFinite(input.aimDirX) && Number.isFinite(input.aimDirY)) {
          const alen = Math.hypot(input.aimDirX, input.aimDirY) || 1;
          game.player.dirX = input.aimDirX / alen;
          game.player.dirY = input.aimDirY / alen;
        } else {
          const ax = input.aimX - game.player.x;
          const ay = input.aimY - game.player.y;
          const alen = Math.hypot(ax, ay) || 1;
          game.player.dirX = ax / alen;
          game.player.dirY = ay / alen;
        }
      }
    }
    if (typeof game.updateDeathTransition === "function") game.updateDeathTransition(dt);
    if (typeof game.tickMultiplayerNotifications === "function") game.tickMultiplayerNotifications(dt);
    if (Array.isArray(game.map) && game.map.length > 0) {
      if (game.player.health > 0 || !game.getSpectateTargetEntity) game.revealAroundPlayer();
      else {
        const target = game.getSpectateTargetEntity();
        if (target) {
          const originalX = game.player.x;
          const originalY = game.player.y;
          game.player.x = target.x;
          game.player.y = target.y;
          game.revealAroundPlayer();
          game.player.x = originalX;
          game.player.y = originalY;
        } else {
          game.revealAroundPlayer();
        }
      }
    }
    game.floatingTexts = stepClientFloatingTexts(game.floatingTexts, dt);
    prunePredictedProjectiles(netPredictedProjectiles);
    game.renderer.draw(game);
    setNetRenderRaf(requestAnimationFrame(loop));
  };

  setNetRenderRaf(requestAnimationFrame(loop));
}
