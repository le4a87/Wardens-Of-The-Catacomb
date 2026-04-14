function drawHudButton(ctx, rect, label, active, activeFill) {
  ctx.fillStyle = active ? activeFill : "rgba(25, 32, 48, 0.92)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = active ? "rgba(240, 220, 180, 0.9)" : "rgba(126, 139, 171, 0.55)";
  ctx.lineWidth = 1.1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.fillStyle = "#f2efe3";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText(label, rect.x + 12, rect.y + 18);
}

export function drawStatsGameOverActions(ctx, game, overlayX, overlayY, overlayW, overlayH) {
  const actionY = overlayY + overlayH - 44;
  const actionH = 28;
  const actionGap = 10;
  const actionW = 164;
  const menuRect = { x: overlayX + overlayW - actionW - 14, y: actionY, w: actionW, h: actionH };
  const leaderboardRect = { x: menuRect.x - actionW - actionGap, y: actionY, w: actionW, h: actionH };
  game.uiRects.gameOverLeaderboardButton = leaderboardRect;
  game.uiRects.gameOverMenuButton = menuRect;
  drawHudButton(ctx, leaderboardRect, "Back To Leaderboard", false, "rgba(88, 130, 105, 0.95)");
  drawHudButton(ctx, menuRect, "Return To Menu", false, "rgba(156, 113, 64, 0.95)");
}
