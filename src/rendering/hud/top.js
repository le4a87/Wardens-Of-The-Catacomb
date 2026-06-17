import { formatTime } from "../../utils.js";

function drawMultiplayerNotifications(ctx, game, layout) {
  const current = game?.multiplayerNotificationCurrent;
  if (!current?.text) return;
  const boxW = Math.min(360, layout.playW - 40);
  const boxH = 24;
  const boxX = Math.floor((layout.playW - boxW) * 0.5);
  const boxY = 88;
  ctx.fillStyle = "rgba(10, 16, 25, 0.92)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "rgba(156, 176, 214, 0.52)";
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
  ctx.fillStyle = "#eef3ff";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(current.text, boxX + boxW * 0.5, boxY + 16);
  ctx.textAlign = "left";
}

function drawPauseOwnerBanner(ctx, game, layout) {
  if (!game?.networkEnabled || !game?.paused) return;
  const localId = typeof game.networkLocalPlayerId === "string" ? game.networkLocalPlayerId : null;
  const pauseOwnerId = typeof game.networkPauseOwnerId === "string" ? game.networkPauseOwnerId : null;
  if (!pauseOwnerId || !localId || pauseOwnerId === localId) return;
  const roster = Array.isArray(game.networkRosterPlayers) ? game.networkRosterPlayers : [];
  const owner = roster.find((player) => player?.id === pauseOwnerId);
  const handle = typeof owner?.handle === "string" && owner.handle.trim() ? owner.handle.trim() : "Player";
  const text = `${handle} paused the game.`;
  const boxW = Math.min(320, layout.playW - 40);
  const boxH = 24;
  const boxX = Math.floor((layout.playW - boxW) * 0.5);
  const boxY = 88;
  ctx.fillStyle = "rgba(10, 16, 25, 0.92)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "rgba(156, 176, 214, 0.52)";
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
  ctx.fillStyle = "#eef3ff";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(text, boxX + boxW * 0.5, boxY + 16);
  ctx.textAlign = "left";
}

function formatDebugNumber(value, suffix = "", digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}${suffix}`;
}

function getDebugStats(game) {
  const stats = game?.debugHudStats && typeof game.debugHudStats === "object" ? game.debugHudStats : {};
  const net = stats.network && typeof stats.network === "object" ? stats.network : {};
  return { stats, net };
}

function formatNetworkDebugSummary(game) {
  if (!game?.debugHudEnabled || !game.networkEnabled) return "";
  const { stats, net } = getDebugStats(game);
  return [
    `${formatDebugNumber(stats.fps)}fps`,
    `ping ${formatDebugNumber(net.pingMs, "ms")}`,
    `lat ${formatDebugNumber(net.latencyMs, "ms")}`,
    `jit ${formatDebugNumber(net.jitterMs, "ms")}`,
    `buf ${formatDebugNumber(net.snapshotBuffer)}`,
    `in ${formatDebugNumber(net.pendingInputs)}`
  ].join(" | ");
}

function drawTopHudButton(ctx, rect, label, active = false) {
  ctx.fillStyle = active ? "rgba(92, 109, 153, 0.96)" : "rgba(39, 53, 79, 0.94)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(126, 139, 171, 0.72)";
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(label, rect.x + rect.w * 0.5, rect.y + 17);
  ctx.textAlign = "left";
}

function getDebugStatsHudRect(renderer, game, layout, lines) {
  const ctx = renderer.ctx;
  const padding = 8;
  const lineH = 14;
  const measuredW = Math.ceil(lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0));
  const boxW = Math.min(layout.playW - 24, Math.max(game.networkEnabled ? 220 : 104, measuredW + padding * 2));
  const boxH = padding * 2 + lines.length * lineH;
  return {
    x: Math.max(12, Math.floor((layout.playW - boxW) * 0.5)),
    y: layout.topHudH + 8,
    w: boxW,
    h: boxH,
    padding,
    lineH
  };
}

export function drawDebugStatsHud(renderer, game, layout) {
  if (!game?.debugHudEnabled) return;
  const ctx = renderer.ctx;
  const { stats, net } = getDebugStats(game);
  const lines = [
    game.networkEnabled ? "NET DEBUG" : "DEBUG",
    `FPS ${formatDebugNumber(stats.fps)}`,
    `Frame ${formatDebugNumber(stats.frameMs, "ms", 1)}`
  ];
  if (game.networkEnabled) {
    lines.push(
      `Ping ${formatDebugNumber(net.pingMs, "ms")}`,
      `Latency ${formatDebugNumber(net.latencyMs, "ms")}`,
      `Jitter ${formatDebugNumber(net.jitterMs, "ms")}`,
      `Buf ${formatDebugNumber(net.snapshotBuffer)}  In ${formatDebugNumber(net.pendingInputs)}`
    );
  }
  ctx.save();
  ctx.font = "12px Trebuchet MS";
  const rect = getDebugStatsHudRect(renderer, game, layout, lines);
  game.debugHudStatsRect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  ctx.fillStyle = "rgba(4, 8, 14, 0.78)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(143, 227, 162, 0.45)";
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.fillStyle = "#d9f6df";
  ctx.textAlign = "left";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], rect.x + rect.padding, rect.y + rect.padding + 10 + i * rect.lineH);
  }
  ctx.restore();
}

export function drawHud(renderer, game, layout) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(5, 8, 14, 0.9)";
  ctx.fillRect(0, 0, layout.playW, layout.topHudH);
  const topButtonW = 72;
  const topButtonGap = 6;
  const optionsRect = { x: layout.playW - 12 - topButtonW, y: 7, w: topButtonW, h: 24 };
  const statsRect = { x: optionsRect.x - topButtonGap - topButtonW, y: 7, w: topButtonW, h: 24 };
  game.uiRects.statsButton = statsRect;
  game.uiRects.optionsButton = optionsRect;
  ctx.fillStyle = "#f2efe3";
  ctx.font = "16px Trebuchet MS";
  ctx.fillText(`Score: ${game.score}`, 14, 24);
  ctx.fillText(`Time: ${formatTime(game.time)}`, 192, 24);
  ctx.fillText(`Floor: ${game.floor}`, 340, 24);
  const chestKeyLabel = (game.treasureKeys || 0) > 0 ? `Chest Keys: ${game.treasureKeys}` : "";
  if (chestKeyLabel) ctx.fillText(chestKeyLabel, 430, 24);
  if (game.networkEnabled) {
    ctx.fillStyle = game.networkRole === "Controller" ? "#8fe3a2" : "#dfc670";
    const netLabel = `Net: ${game.networkRole || "Connected"}`;
    const netX = chestKeyLabel ? 580 : 470;
    ctx.fillText(netLabel, netX, 24);
    const debugSummary = formatNetworkDebugSummary(game);
    if (debugSummary) {
      ctx.fillStyle = "#bfe8ff";
      ctx.font = "13px Trebuchet MS";
      const debugX = Math.min(layout.playW - 12, netX + ctx.measureText(netLabel).width + 18);
      if (debugX < layout.playW - 180) ctx.fillText(debugSummary, debugX, 24);
      ctx.font = "16px Trebuchet MS";
    }
  }
  drawTopHudButton(ctx, statsRect, "Stats", game.statsPanelOpen);
  drawTopHudButton(ctx, optionsRect, "Options", game.optionsOpen);
  const objective = typeof game.getFloorObjectiveText === "function" ? game.getFloorObjectiveText() : "";
  const detail = typeof game.getFloorObjectiveDetail === "function" ? game.getFloorObjectiveDetail() : "";
  const boss = typeof game.getActiveFloorBossEnemy === "function" ? game.getActiveFloorBossEnemy() : null;
  const objectiveY = 43;

  ctx.fillStyle = "rgba(17, 24, 38, 0.96)";
  ctx.fillRect(12, 31, Math.min(540, layout.playW - 24), 28);
  ctx.strokeStyle = boss ? "rgba(208, 132, 255, 0.7)" : "rgba(126, 139, 171, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(12.5, 31.5, Math.min(540, layout.playW - 24) - 1, 27);
  ctx.fillStyle = boss ? "#f0d6ff" : "#dce7fb";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.fillText(objective, 22, objectiveY);
  ctx.fillStyle = "#9eb0d6";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText(detail, 22, objectiveY + 13);

  if (boss && Number.isFinite(boss.maxHp) && boss.maxHp > 0) {
    const bossGroup = typeof game.getActiveFloorBossEnemies === "function" ? game.getActiveFloorBossEnemies() : [boss];
    const groupedGolems = Array.isArray(bossGroup) && bossGroup.length > 1 && bossGroup.every((entry) => entry?.type === "golem");
    const displayHp = groupedGolems ? bossGroup.reduce((sum, entry) => sum + Math.max(0, entry.hp || 0), 0) : boss.hp;
    const displayMaxHp = groupedGolems ? bossGroup.reduce((sum, entry) => sum + Math.max(1, entry.maxHp || 1), 0) : boss.maxHp;
    const ratio = Math.max(0, Math.min(1, displayHp / displayMaxHp));
    const barW = Math.max(180, Math.min(360, layout.playW - 40));
    const barX = Math.floor((layout.playW - barW) / 2);
    const barY = 64;
    ctx.fillStyle = "rgba(18, 8, 24, 0.94)";
    ctx.fillRect(barX, barY, barW, 18);
    ctx.strokeStyle = "rgba(215, 154, 255, 0.72)";
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, 17);
    ctx.fillStyle = "#3a1f48";
    ctx.fillRect(barX + 4, barY + 4, barW - 8, 10);
    const bossLabel = game.floorBoss?.bossName || (boss.type === "leprechaun" ? "Leprechaun" : boss.type === "sonya" ? "Sonya" : boss.type === "golem" ? "Flesh Golem" : "Necromancer");
    const isLeprechaun = boss.type === "leprechaun";
    const isSonya = boss.type === "sonya";
    const isGolem = boss.type === "golem";
    ctx.fillStyle = isLeprechaun ? "#74d74d" : isSonya ? "#ff8a4a" : isGolem ? "#ffae63" : "#b86cff";
    ctx.fillRect(barX + 4, barY + 4, Math.floor((barW - 8) * ratio), 10);
    ctx.fillStyle = "#f7e8ff";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.textAlign = "center";
    let title = `${bossLabel}${groupedGolems ? " x2" : ""} ${Math.ceil(Math.max(0, displayHp))}/${displayMaxHp}`;
    if (isLeprechaun && typeof game.getRemainingFloorBossTimer === "function") {
      const remaining = game.getRemainingFloorBossTimer();
      if (remaining !== null) title += ` | ${formatTime(remaining)}`;
    }
    ctx.fillText(title, layout.playW / 2, barY - 4 + 12);
    ctx.textAlign = "left";
  }

  drawPauseOwnerBanner(ctx, game, layout);
  drawMultiplayerNotifications(ctx, game, layout);
}

function drawResumeButton(ctx, game, layout, canvasHeight) {
  const rect = { x: layout.playW / 2 - 76, y: canvasHeight / 2 + 18, w: 152, h: 34 };
  if (game?.uiRects) game.uiRects.pauseOverlayResume = rect;
  const localPlayerId = typeof game?.networkLocalPlayerId === "string" ? game.networkLocalPlayerId : null;
  const pauseOwnerId = typeof game?.networkPauseOwnerId === "string" ? game.networkPauseOwnerId : null;
  const disabled = !!(game?.networkEnabled && localPlayerId && pauseOwnerId && localPlayerId !== pauseOwnerId);
  ctx.fillStyle = disabled ? "rgba(42, 47, 58, 0.72)" : "rgba(39, 53, 79, 0.96)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = disabled ? "rgba(111, 119, 136, 0.44)" : "rgba(210, 190, 145, 0.86)";
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.fillStyle = disabled ? "#8992a4" : "#f2efe3";
  ctx.font = "bold 15px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("Resume", layout.playW / 2, rect.y + 22);
}

export function drawPausedOverlay(renderer, game, layout) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.fillRect(0, 0, layout.playW, renderer.canvas.height);
  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 42px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("Paused", layout.playW / 2, renderer.canvas.height / 2 - 14);
  drawResumeButton(ctx, game, layout, renderer.canvas.height);
  ctx.textAlign = "left";
}
