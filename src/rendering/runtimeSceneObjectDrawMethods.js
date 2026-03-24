export const runtimeSceneObjectDrawMethods = {
  drawArmorStand(game, stand, screenX, screenY) {
    const ctx = this.ctx;
    if (stand?.variant === "sewer_pool") {
      const palette = typeof game?.getBiomeAppearance === "function" ? game.getBiomeAppearance() : {};
      const rx = (stand.size || 24) * 0.58;
      const ry = (stand.size || 24) * 0.34;
      ctx.fillStyle = palette.sewerPoolDark || "#325a52";
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + 2, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.sewerPool || "#4e8c7e";
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, rx * 0.86, ry * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      if (stand.animated && !stand.activated) {
        ctx.fillStyle = "rgba(205, 255, 173, 0.18)";
        ctx.beginPath();
        ctx.ellipse(screenX, screenY - 1, rx * 0.48, ry * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const half = stand.size / 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.75, half * 0.95, half * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8e96a8";
    ctx.fillRect(screenX - 5, screenY - 4, 10, 14);
    ctx.fillStyle = "#aeb7ca";
    ctx.beginPath();
    ctx.arc(screenX, screenY - 9, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a7388";
    ctx.fillRect(screenX - 7, screenY + 8, 14, 5);
    ctx.fillStyle = "#7f6543";
    ctx.fillRect(screenX + 8, screenY - 12, 2, 22);
    ctx.fillStyle = "#aeb7ca";
    ctx.beginPath();
    ctx.moveTo(screenX + 9, screenY - 15);
    ctx.lineTo(screenX + 15, screenY - 9);
    ctx.lineTo(screenX + 9, screenY - 4);
    ctx.closePath();
    ctx.fill();
    if (stand.animated && !stand.activated) {
      ctx.fillStyle = "rgba(255, 90, 90, 0.9)";
      ctx.fillRect(screenX - 2.5, screenY - 10, 2, 2);
      ctx.fillRect(screenX + 0.5, screenY - 10, 2, 2);
    }
  },

  drawWallTrap(trap, screenX, screenY, palette = null) {
    const ctx = this.ctx;
    const colors = palette || {};
    const dirX = Number.isFinite(trap.dirX) ? trap.dirX : 1;
    const dirY = Number.isFinite(trap.dirY) ? trap.dirY : 0;
    const perpX = -dirY;
    const perpY = dirX;
    const baseX = screenX - dirX * 10;
    const baseY = screenY - dirY * 10;
    const tipX = screenX + dirX * 9;
    const tipY = screenY + dirY * 9;

    ctx.fillStyle = colors.trapBase || "#4b1714";
    ctx.beginPath();
    ctx.moveTo(baseX + perpX * 8, baseY + perpY * 8);
    ctx.lineTo(baseX - perpX * 8, baseY - perpY * 8);
    ctx.lineTo(baseX - dirX * 4, baseY - dirY * 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.trapFill || "#c43e34";
    ctx.beginPath();
    ctx.moveTo(baseX + perpX * 5, baseY + perpY * 5);
    ctx.lineTo(baseX - perpX * 5, baseY - perpY * 5);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = colors.trapStroke || "#ff9d82";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(baseX + perpX * 3.4, baseY + perpY * 3.4);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX - perpX * 3.4, baseY - perpY * 3.4);
    ctx.stroke();
  },

  drawAnimatedArmor(game, enemy, screenX, screenY) {
    const ctx = this.ctx;
    if (enemy?.variant === "gel_cube") {
      const palette = typeof game?.getBiomeAppearance === "function" ? game.getBiomeAppearance() : {};
      const half = enemy.size / 2;
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + half * 0.72, half * 0.95, half * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createLinearGradient(screenX - half, screenY - half, screenX + half, screenY + half);
      body.addColorStop(0, "rgba(163, 255, 188, 0.72)");
      body.addColorStop(1, "rgba(63, 157, 106, 0.82)");
      ctx.fillStyle = body;
      ctx.fillRect(screenX - half * 0.82, screenY - half * 0.72, half * 1.64, half * 1.44);
      ctx.strokeStyle = palette.sewerPoolDark || "#325a52";
      ctx.strokeRect(screenX - half * 0.82 + 0.5, screenY - half * 0.72 + 0.5, half * 1.64 - 1, half * 1.44 - 1);
      ctx.fillStyle = "rgba(220, 255, 224, 0.3)";
      ctx.fillRect(screenX - half * 0.45, screenY - half * 0.45, half * 0.75, half * 0.42);
      ctx.fillStyle = "#143620";
      ctx.fillRect(screenX - 4, screenY - 3, 2, 2);
      ctx.fillRect(screenX + 2, screenY - 3, 2, 2);
      return;
    }
    const half = enemy.size / 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.8, half, half * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ba4ba";
    ctx.fillRect(screenX - 6, screenY - 4, 12, 15);
    ctx.fillStyle = "#bec8dc";
    ctx.beginPath();
    ctx.arc(screenX, screenY - 10, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#737f98";
    ctx.fillRect(screenX - 8, screenY + 9, 16, 5);

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(Math.atan2(enemy.y - (enemy.lastY ?? enemy.y), enemy.x - (enemy.lastX ?? enemy.x)) + Math.PI / 2);
    ctx.fillStyle = "#7d6240";
    ctx.fillRect(8, -1, 16, 2);
    ctx.fillStyle = "#d0d8e9";
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(30, -5);
    ctx.lineTo(30, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ff6868";
    ctx.fillRect(screenX - 2.5, screenY - 11, 2, 2);
    ctx.fillRect(screenX + 0.5, screenY - 11, 2, 2);
  }
};
