export function drawPinnedAbilityTooltip(renderer, rect, state) {
  if (!rect || !state) return;
  const ctx = renderer.ctx;
  ctx.save();
  ctx.font = "12px Trebuchet MS";
  const padding = 8;
  const textW = ctx.measureText(state.hoverText).width;
  const tipX = Math.max(10, Math.min(renderer.canvas.width - textW - padding * 2 - 10, rect.x - textW - padding * 2 - 12));
  const tipY = Math.max(24, rect.y + 10);
  ctx.fillStyle = "rgba(8, 12, 18, 0.96)";
  ctx.fillRect(tipX, tipY - 16, textW + padding * 2, 22);
  ctx.strokeStyle = state.accent;
  ctx.strokeRect(tipX + 0.5, tipY - 15.5, textW + padding * 2 - 1, 21);
  ctx.fillStyle = "#f2efe3";
  ctx.fillText(state.hoverText, tipX + padding, tipY);
  ctx.restore();
}
