export function drawGroupPanel(renderer, game, layout, panelY) {
  const ctx = renderer.ctx;
  const remotePlayers = Array.isArray(game.remotePlayers) ? game.remotePlayers : [];
  game.uiRects.groupPanelRows = [];
  if (remotePlayers.length === 0) return panelY;
  const panelX = layout.sidebarX + renderer.sidebarPadding;
  const panelW = layout.sidebarW - renderer.sidebarPadding * 2;
  const headerH = 30;
  const rowH = 40;
  const rows = remotePlayers.slice(0, 5);
  const panelH = headerH + rows.length * rowH + 8;
  const pauseOwnerId = typeof game.networkPauseOwnerId === "string" ? game.networkPauseOwnerId : null;

  ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "rgba(126, 139, 171, 0.65)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("Group", panelX + 10, panelY + 19);
  ctx.fillStyle = "#9fb0d6";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText(`${rows.length} teammate${rows.length === 1 ? "" : "s"}`, panelX + panelW - 92, panelY + 19);

  let y = panelY + headerH;
  for (const player of rows) {
    const alive = player?.alive !== false;
    const ratio = Number.isFinite(player?.maxHealth) && player.maxHealth > 0 ? Math.max(0, Math.min(1, player.health / player.maxHealth)) : 0;
    const accent = typeof player?.color === "string" && player.color.trim() ? player.color.trim() : "#58a6ff";
    const handle = typeof player?.handle === "string" && player.handle.trim() ? player.handle.trim() : "Player";
    const level = Number.isFinite(player?.level) ? player.level : 1;
    const isPauseOwner = pauseOwnerId && player?.id === pauseOwnerId;
    const rowRect = { x: panelX + 6, y, w: panelW - 12, h: rowH - 4 };
    const isSpectateTarget = typeof game.spectateTargetId === "string" && player?.id === game.spectateTargetId;
    game.uiRects.groupPanelRows.push({ id: player?.id || "", rect: rowRect, alive });

    ctx.fillStyle = isSpectateTarget ? "rgba(31, 45, 68, 0.96)" : "rgba(16, 22, 31, 0.9)";
    ctx.fillRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h);
    if (isSpectateTarget) {
      ctx.strokeStyle = "rgba(196, 222, 255, 0.78)";
      ctx.strokeRect(rowRect.x + 0.5, rowRect.y + 0.5, rowRect.w - 1, rowRect.h - 1);
    }
    ctx.fillStyle = accent;
    ctx.fillRect(rowRect.x, rowRect.y, 4, rowRect.h);

    ctx.fillStyle = accent;
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(handle, panelX + 16, y + 14);
    if (isPauseOwner) {
      ctx.fillStyle = "#f6d37a";
      ctx.fillText("*", panelX + panelW - 18, y + 14);
    }

    ctx.fillStyle = "#b7c7e6";
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(`Lvl ${level}`, panelX + 16, y + 28);

    const barX = panelX + 66;
    const barY = y + 19;
    const barW = panelW - 88;
    const barH = 8;
    ctx.fillStyle = "rgba(41, 52, 72, 0.95)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = alive ? (ratio > 0.5 ? "#76db8d" : ratio > 0.25 ? "#e1bf63" : "#df6767") : "#5c6371";
    ctx.fillRect(barX, barY, Math.floor(barW * ratio), barH);
    ctx.strokeStyle = "rgba(126, 139, 171, 0.4)";
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
    if (!alive) {
      ctx.fillStyle = "#d7a5a5";
      ctx.font = "bold 11px Trebuchet MS";
      ctx.fillText("Dead", barX + barW - 26, y + 28);
    }
    y += rowH;
  }

  return panelY + panelH;
}
