export const runtimeSceneObjectDrawMethods = {
  drawArmorStand(stand, screenX, screenY) {
    const ctx = this.ctx;
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

  drawWallTrap(trap, screenX, screenY) {
    const ctx = this.ctx;
    const dirX = Number.isFinite(trap.dirX) ? trap.dirX : 1;
    const dirY = Number.isFinite(trap.dirY) ? trap.dirY : 0;
    const perpX = -dirY;
    const perpY = dirX;
    const baseX = screenX - dirX * 10;
    const baseY = screenY - dirY * 10;
    const tipX = screenX + dirX * 9;
    const tipY = screenY + dirY * 9;

    ctx.fillStyle = "#4b1714";
    ctx.beginPath();
    ctx.moveTo(baseX + perpX * 8, baseY + perpY * 8);
    ctx.lineTo(baseX - perpX * 8, baseY - perpY * 8);
    ctx.lineTo(baseX - dirX * 4, baseY - dirY * 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#c43e34";
    ctx.beginPath();
    ctx.moveTo(baseX + perpX * 5, baseY + perpY * 5);
    ctx.lineTo(baseX - perpX * 5, baseY - perpY * 5);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#ff9d82";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(baseX + perpX * 3.4, baseY + perpY * 3.4);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX - perpX * 3.4, baseY - perpY * 3.4);
    ctx.stroke();
  },

  drawAnimatedArmor(enemy, screenX, screenY) {
    const ctx = this.ctx;
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
  },

  drawLeprechaunPot(screenX, screenY, time = 0) {
    const ctx = this.ctx;
    const pulse = 0.92 + Math.sin(time * 5.5) * 0.08;
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 14, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c1d18";
    ctx.beginPath();
    ctx.arc(screenX, screenY, 18, Math.PI * 0.1, Math.PI * 0.9, false);
    ctx.lineTo(screenX + 16, screenY + 12);
    ctx.lineTo(screenX - 16, screenY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#efcf52";
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + time * 1.2;
      ctx.beginPath();
      ctx.arc(screenX + Math.cos(a) * 8, screenY - 8 + Math.sin(a * 1.6) * 3, 3 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawBossSpeechCallout(game, cameraX, cameraY, layout) {
    const boss = game.floorBoss;
    if (!boss?.speechText || !boss?.speechExpiresAt || game.time >= boss.speechExpiresAt) return;
    const ctx = this.ctx;
    const playLeft = 0;
    const playTop = layout.topHudH;
    const playRight = layout.playW;
    const playBottom = this.canvas.height - layout.xpBarH;
    const sx = (boss.speechSourceX || game.player.x) - cameraX;
    const sy = (boss.speechSourceY || game.player.y) - cameraY - 46;
    let bubbleX = sx;
    let bubbleY = sy;
    const visible = sx >= playLeft + 32 && sx <= playRight - 32 && sy >= playTop + 12 && sy <= playBottom - 12;
    if (!visible) {
      const dx = (boss.speechSourceX || game.player.x) - game.player.x;
      const dy = (boss.speechSourceY || game.player.y) - game.player.y;
      const len = Math.hypot(dx, dy) || 1;
      bubbleX = Math.min(playRight - 80, Math.max(playLeft + 80, layout.playW * 0.5 + (dx / len) * (layout.playW * 0.33)));
      bubbleY = Math.min(playBottom - 22, Math.max(playTop + 22, (playTop + playBottom) * 0.5 + (dy / len) * ((playBottom - playTop) * 0.33)));
    }
    const text = boss.speechText;
    ctx.font = "bold 13px Trebuchet MS";
    const pad = 10;
    const width = Math.min(320, ctx.measureText(text).width + pad * 2);
    const height = 28;
    const x = bubbleX - width * 0.5;
    const y = bubbleY - height;
    ctx.fillStyle = "rgba(249, 252, 232, 0.96)";
    ctx.strokeStyle = "rgba(38, 54, 28, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#29401d";
    ctx.textAlign = "center";
    ctx.fillText(text, bubbleX, y + 18);
    ctx.textAlign = "left";
  },

  drawBreakable(br, screenX, screenY) {
    const ctx = this.ctx;
    const half = (br.size || 20) * 0.5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.7, half * 0.9, half * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
    if (br.type === "crate") {
      ctx.fillStyle = "#7d5634";
      ctx.fillRect(screenX - half, screenY - half, half * 2, half * 2);
      ctx.strokeStyle = "#a57a4f";
      ctx.strokeRect(screenX - half + 0.5, screenY - half + 0.5, half * 2 - 1, half * 2 - 1);
      ctx.beginPath();
      ctx.moveTo(screenX - half + 2, screenY - half + 2);
      ctx.lineTo(screenX + half - 2, screenY + half - 2);
      ctx.moveTo(screenX + half - 2, screenY - half + 2);
      ctx.lineTo(screenX - half + 2, screenY + half - 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#6d4b2e";
      ctx.fillRect(screenX - half, screenY - half * 0.75, half * 2, half * 1.5);
      ctx.strokeStyle = "#8f6a43";
      ctx.strokeRect(screenX - half + 0.5, screenY - half * 0.75 + 0.5, half * 2 - 1, half * 1.5 - 1);
      ctx.fillStyle = "#b38b5f";
      ctx.fillRect(screenX - half * 0.9, screenY - 1, half * 1.8, 2);
    }
  }
};
