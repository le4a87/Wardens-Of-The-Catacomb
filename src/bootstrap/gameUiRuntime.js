export function syncIdleSoundState(music, splashActive, game) {
  if (splashActive) {
    music.setIdleGameplayActive(false);
    music.resetIdleTimer();
    return;
  }
  const idleGameplayActive = !!(
    game &&
    !game.networkEnabled &&
    !game.paused &&
    !game.gameOver &&
    !game.shopOpen &&
    !game.skillTreeOpen &&
    !game.statsPanelOpen
  );
  music.setIdleGameplayActive(idleGameplayActive);
  if (!idleGameplayActive) music.resetIdleTimer();
}

function isFloorBossMusicActive(game) {
  if (!game || game.gameOver) return false;
  return game.floorBoss?.phase === "active";
}

export function syncMusicForGame(music, splashActive, game) {
  if (splashActive) return;
  syncIdleSoundState(music, splashActive, game);
  if (!game) {
    music.playMenuMusic();
    return;
  }
  if (game.gameOver) {
    if (music.currentMode !== "death") music.playDeathMusic();
    return;
  }
  const defeatedAtTime = game.floorBoss?.defeatedAtTime;
  const bossPhase = game.floorBoss?.phase;
  const victoryKey = Number.isFinite(defeatedAtTime) ? `boss-defeat:${defeatedAtTime}` : "";
  if (
    Number.isFinite(defeatedAtTime) &&
    (bossPhase === "defeated" || bossPhase === "portal") &&
    !(typeof music.hasPlayedBossVictoryCue === "function" && music.hasPlayedBossVictoryCue(victoryKey))
  ) {
    music.playBossVictoryCue(victoryKey);
    if (game.paused) music.pauseCurrentTrack();
    else music.playCurrentTrack();
    return;
  }
  if (isFloorBossMusicActive(game)) {
    music.playBossMusic({
      floor: game.floor,
      biomeKey: typeof game.biomeKey === "string" ? game.biomeKey : ""
    });
    if (game.paused) music.pauseCurrentTrack();
    else music.playCurrentTrack();
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

export function observeServerTime(clockState, serverTime, smoothing = 0.12) {
  if (!Number.isFinite(serverTime)) return;
  const observedOffset = Date.now() - serverTime;
  if (!clockState.ready) {
    clockState.offsetMs = observedOffset;
    clockState.ready = true;
    return;
  }
  clockState.offsetMs += (observedOffset - clockState.offsetMs) * smoothing;
}

export function estimateServerNowMs(clockState) {
  if (!clockState.ready) return NaN;
  return Date.now() - clockState.offsetMs;
}

export function clearSplashRender(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawSplashFrame({ canvas, splashStartedAt, fadeMs, splashReady, splashLogo, now, promptReady = true }) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const elapsed = Math.max(0, now - splashStartedAt);
  const fade = Math.max(0, Math.min(1, elapsed / fadeMs));
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#090d14");
  bg.addColorStop(0.52, "#111827");
  bg.addColorStop(1, "#1b1410");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.18 * fade;
  ctx.fillStyle = "#d2a15f";
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.5, Math.min(width, height) * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (splashReady && splashLogo.naturalWidth > 0 && splashLogo.naturalHeight > 0) {
    const maxWidth = width * 0.68;
    const maxHeight = height * 0.42;
    const scale = Math.min(maxWidth / splashLogo.naturalWidth, maxHeight / splashLogo.naturalHeight);
    const drawWidth = splashLogo.naturalWidth * scale;
    const drawHeight = splashLogo.naturalHeight * scale;
    const drawX = (width - drawWidth) * 0.5;
    const drawY = height * 0.23;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 28;
    ctx.drawImage(splashLogo, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }

  const promptAlpha = fade >= 0.92 ? 0.92 : fade * 0.65;
  const promptText = promptReady ? "Press any key to continue" : "Loading...";
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(244, 236, 222, ${0.82 * fade})`;
  ctx.font = "600 18px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText("Wardens of the Catacomb", width * 0.5, height * 0.74);
  ctx.fillStyle = `rgba(216, 203, 182, ${promptAlpha})`;
  ctx.font = "15px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(promptText, width * 0.5, height * 0.82);
  ctx.restore();
}

export function consumeSnapshotForRender(netSnapshotBuffer, targetServerTime, targetRecvTime, maxSnapshotBuffer) {
  if (netSnapshotBuffer.length === 0) return null;
  if (netSnapshotBuffer.length > maxSnapshotBuffer) {
    netSnapshotBuffer.splice(0, netSnapshotBuffer.length - maxSnapshotBuffer);
  }
  const backlogFallbackDepth = Math.max(6, Math.floor(maxSnapshotBuffer * 0.75));
  if (netSnapshotBuffer.length >= backlogFallbackDepth) {
    const latest = netSnapshotBuffer[netSnapshotBuffer.length - 1];
    netSnapshotBuffer.length = 0;
    return latest;
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
    if (netSnapshotBuffer.length > 10) {
      const keep = netSnapshotBuffer.slice(-6);
      netSnapshotBuffer.length = 0;
      netSnapshotBuffer.push(...keep);
    }
    return null;
  }
  const chosen = netSnapshotBuffer[chosenIndex];
  netSnapshotBuffer.splice(0, chosenIndex + 1);
  return chosen;
}
