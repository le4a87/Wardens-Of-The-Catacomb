export const runtimeSceneBossDrawMethods = {
  drawLeprechaunPot(screenX, screenY, time = 0) {
    const ctx = this.ctx;
    const pulse = Math.sin(time * 4.2) * 0.5 + 0.5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 10, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(screenX, screenY + 2, 4, screenX, screenY + 2, 28);
    glow.addColorStop(0, `rgba(182, 255, 115, ${0.2 + pulse * 0.18})`);
    glow.addColorStop(1, "rgba(64, 120, 36, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY + 2, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2b2418";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 2, 18, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4c3a21";
    ctx.fillRect(screenX - 16, screenY - 7, 32, 18);
    ctx.fillStyle = "#cfb24c";
    ctx.fillRect(screenX - 18, screenY - 9, 36, 4);
    ctx.strokeStyle = "#e7d67c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX, screenY - 4, 6, Math.PI, 0);
    ctx.stroke();

    ctx.fillStyle = "#f2d45a";
    for (let i = 0; i < 6; i++) {
      const angle = i * 0.9 + time * 0.8;
      const coinX = screenX + Math.cos(angle) * (5 + (i % 3) * 3);
      const coinY = screenY - 8 + Math.sin(angle * 1.2) * 2 + (i % 2);
      ctx.beginPath();
      ctx.ellipse(coinX, coinY, 4, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawBossSpeechCallout(game, cameraX, cameraY, layout) {
    const boss = game.floorBoss;
    const text = typeof boss?.speechText === "string" ? boss.speechText.trim() : "";
    if (!text) return;

    const sourceX = Number.isFinite(boss?.speechSourceX) ? boss.speechSourceX : game.player?.x || 0;
    const sourceY = Number.isFinite(boss?.speechSourceY) ? boss.speechSourceY : game.player?.y || 0;
    const screenX = sourceX - cameraX;
    const screenY = sourceY - cameraY - 56;
    const maxWidth = Math.min(320, Math.max(180, layout.playW - 48));
    const ctx = this.ctx;

    ctx.save();
    ctx.font = "bold 16px Trebuchet MS";
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth - 24 && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);

    const bubbleW = Math.min(
      maxWidth,
      Math.max(120, ...lines.map((entry) => Math.ceil(ctx.measureText(entry).width) + 24))
    );
    const bubbleH = lines.length * 18 + 18;
    const bubbleX = Math.max(12, Math.min(layout.playW - bubbleW - 12, screenX - bubbleW * 0.5));
    const bubbleY = Math.max(layout.topHudH + 8, screenY - bubbleH);

    ctx.fillStyle = "rgba(18, 22, 16, 0.92)";
    ctx.strokeStyle = "rgba(202, 241, 150, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 10);
    ctx.fill();
    ctx.stroke();

    const tailTargetX = Math.max(bubbleX + 18, Math.min(bubbleX + bubbleW - 18, screenX));
    const tailBaseY = bubbleY + bubbleH;
    ctx.beginPath();
    ctx.moveTo(tailTargetX - 10, tailBaseY - 1);
    ctx.lineTo(tailTargetX + 10, tailBaseY - 1);
    ctx.lineTo(screenX, Math.min(this.canvas.height - 36, screenY + 18));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f2f7da";
    ctx.textAlign = "center";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bubbleX + bubbleW * 0.5, bubbleY + 22 + i * 18);
    }
    ctx.textAlign = "left";
    ctx.restore();
  },

  drawNecromancer(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size / 2;
    const pulse = Math.sin((enemy.hpBarTimer || 0) * 0.06) * 0.5 + 0.5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.82, half * 1.05, half * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(screenX, screenY - half * 0.25, 2, screenX, screenY - half * 0.25, half * 1.5);
    glow.addColorStop(0, `rgba(180, 108, 255, ${0.18 + pulse * 0.18})`);
    glow.addColorStop(1, "rgba(50, 18, 70, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.2, half * 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2e213f";
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - half * 0.95);
    ctx.lineTo(screenX + half * 0.82, screenY - half * 0.15);
    ctx.lineTo(screenX + half * 0.46, screenY + half * 0.9);
    ctx.lineTo(screenX - half * 0.46, screenY + half * 0.9);
    ctx.lineTo(screenX - half * 0.82, screenY - half * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5d3e83";
    ctx.fillRect(screenX - half * 0.34, screenY - half * 0.24, half * 0.68, half * 0.95);
    ctx.fillStyle = "#e7def7";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.36, half * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7d58a6";
    ctx.fillRect(screenX - half * 0.72, screenY - half * 0.08, half * 1.44, half * 0.14);
    ctx.fillStyle = "#ff7676";
    ctx.fillRect(screenX - 5, screenY - half * 0.42, 3, 2);
    ctx.fillRect(screenX + 2, screenY - half * 0.42, 3, 2);
    ctx.strokeStyle = "#b98fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX + half * 0.82, screenY - half * 0.55);
    ctx.lineTo(screenX + half * 1.18, screenY + half * 0.8);
    ctx.stroke();
    ctx.fillStyle = "#d8caff";
    ctx.beginPath();
    ctx.arc(screenX + half * 0.82, screenY - half * 0.55, half * 0.12, 0, Math.PI * 2);
    ctx.fill();
  },

  drawSonyaBoss(enemy, screenX, screenY, time = 0) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const pulse = Math.sin(time * 8 + screenX * 0.01) * 0.5 + 0.5;
    const blink = Math.max(0, enemy.blinkFlashTimer || 0);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.86, half * 1.08, half * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(screenX, screenY - half * 0.1, 2, screenX, screenY - half * 0.1, half * (1.3 + blink * 0.8));
    glow.addColorStop(0, `rgba(255, 216, 130, ${0.18 + pulse * 0.14 + blink * 0.3})`);
    glow.addColorStop(0.55, `rgba(255, 108, 54, ${0.15 + pulse * 0.14 + blink * 0.22})`);
    glow.addColorStop(1, "rgba(120, 28, 14, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.05, half * (1.25 + blink * 0.5), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8e1f1b";
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - half * 1.02);
    ctx.lineTo(screenX + half * 0.76, screenY - half * 0.1);
    ctx.lineTo(screenX + half * 0.48, screenY + half * 0.94);
    ctx.lineTo(screenX - half * 0.48, screenY + half * 0.94);
    ctx.lineTo(screenX - half * 0.76, screenY - half * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#c93a2a";
    ctx.fillRect(screenX - half * 0.36, screenY - half * 0.18, half * 0.72, half * 1.03);
    ctx.fillStyle = "#e4b44f";
    ctx.fillRect(screenX - half * 0.42, screenY + half * 0.18, half * 0.84, half * 0.08);

    ctx.fillStyle = "#f4dac5";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.4, half * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0cf58";
    ctx.beginPath();
    ctx.ellipse(screenX - half * 0.16, screenY - half * 0.58, half * 0.16, half * 0.24, -0.2, 0, Math.PI * 2);
    ctx.ellipse(screenX + half * 0.16, screenY - half * 0.58, half * 0.16, half * 0.24, 0.2, 0, Math.PI * 2);
    ctx.ellipse(screenX, screenY - half * 0.7, half * 0.26, half * 0.18, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7d1414";
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.56, screenY - half * 0.52);
    ctx.lineTo(screenX, screenY - half * 0.95);
    ctx.lineTo(screenX + half * 0.56, screenY - half * 0.52);
    ctx.lineTo(screenX + half * 0.4, screenY - half * 0.15);
    ctx.lineTo(screenX - half * 0.4, screenY - half * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#612012";
    ctx.fillRect(screenX - 5, screenY - half * 0.42, 3, 2.5);
    ctx.fillRect(screenX + 2, screenY - half * 0.42, 3, 2.5);
    ctx.strokeStyle = "#7a2415";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.1, screenY - half * 0.26);
    ctx.lineTo(screenX + half * 0.12, screenY - half * 0.24);
    ctx.stroke();
  },

  drawMinotaur(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const moving = Math.hypot((enemy.x || 0) - (enemy.lastX ?? enemy.x ?? 0), (enemy.y || 0) - (enemy.lastY ?? enemy.y ?? 0));
    const walkPhase = Math.sin(now * 0.014 + (enemy.x || 0) * 0.035 + (enemy.y || 0) * 0.021) * Math.min(1, moving * 0.2 + 0.35);
    const chargeState = Math.max(enemy.chargeTimer || 0, enemy.chargeWindupTimer || 0);
    const chargeGlow = chargeState > 0 ? 0.22 : 0.08;
    const hornLower = Math.max(0, Math.min(1, (enemy.chargeWindupTimer || 0) / Math.max(0.01, this.config.enemy.minotaurWindup || 0.38)));
    const chargeLean = (enemy.chargeTimer || 0) > 0 ? 1 : hornLower;
    const armSwing = walkPhase * half * 0.18;
    const legSwing = walkPhase * half * 0.2;
    const hornDrop = hornLower * half * 0.18 + chargeLean * half * 0.08;
    const headY = screenY - half * (0.42 - chargeLean * 0.08);

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.84, half * 1.08, half * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 125, 82, ${chargeGlow})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.18, half * 1.12, half * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#5c311f";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.28, screenY + half * 0.54);
    ctx.lineTo(screenX - half * 0.38, screenY + half * 1.0 - legSwing);
    ctx.moveTo(screenX + half * 0.28, screenY + half * 0.54);
    ctx.lineTo(screenX + half * 0.38, screenY + half * 1.0 + legSwing);
    ctx.stroke();
    ctx.strokeStyle = "#74442b";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.5, screenY + half * 0.04);
    ctx.lineTo(screenX - half * 0.86, screenY + half * 0.34 + armSwing);
    ctx.moveTo(screenX + half * 0.5, screenY + half * 0.04);
    ctx.lineTo(screenX + half * 0.86, screenY + half * 0.34 - armSwing);
    ctx.stroke();
    ctx.fillStyle = "#6e4128";
    ctx.fillRect(screenX - half * 0.5, screenY - half * 0.12 + chargeLean * 2, half, half * 1.02);
    ctx.fillStyle = "#8a5738";
    ctx.beginPath();
    ctx.arc(screenX, headY, half * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dcc59a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.15, headY - half * 0.38 + hornDrop);
    ctx.quadraticCurveTo(screenX - half * 0.6, headY - half * 0.7 + hornDrop, screenX - half * 0.72, headY - half * 0.05 + hornDrop);
    ctx.moveTo(screenX + half * 0.15, headY - half * 0.38 + hornDrop);
    ctx.quadraticCurveTo(screenX + half * 0.6, headY - half * 0.7 + hornDrop, screenX + half * 0.72, headY - half * 0.05 + hornDrop);
    ctx.stroke();
    ctx.fillStyle = "#36261d";
    ctx.fillRect(screenX - 5, headY - half * 0.06, 3, 3);
    ctx.fillRect(screenX + 2, headY - half * 0.06, 3, 3);
    ctx.strokeStyle = "#2a1a14";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.12, headY + half * 0.18);
    ctx.lineTo(screenX + half * 0.12, headY + half * 0.18);
    ctx.stroke();
  },

  drawLeprechaunBoss(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const enraged = enemy.phase === "enraged";
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.82, half * 1.05, half * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enraged ? "#1f7c34" : "#2f9d43";
    ctx.fillRect(screenX - half * 0.38, screenY - half * 0.12, half * 0.76, half * 1.04);
    ctx.fillStyle = "#f3d2b3";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.42, half * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d96c2b";
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.26, screenY - half * 0.18);
    ctx.lineTo(screenX + half * 0.26, screenY - half * 0.18);
    ctx.lineTo(screenX, screenY + half * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1e5f2c";
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.62, screenY - half * 0.56);
    ctx.lineTo(screenX, screenY - half * 1.02);
    ctx.lineTo(screenX + half * 0.62, screenY - half * 0.56);
    ctx.lineTo(screenX + half * 0.5, screenY - half * 0.18);
    ctx.lineTo(screenX - half * 0.5, screenY - half * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d4c35e";
    ctx.fillRect(screenX - half * 0.52, screenY - half * 0.18, half * 1.04, half * 0.12);
    ctx.fillStyle = "#2c2a1e";
    ctx.fillRect(screenX - half * 0.08, screenY - half * 0.2, half * 0.16, half * 0.16);
    ctx.fillStyle = "#f6f1d9";
    ctx.fillRect(screenX - half * 0.18, screenY - half * 0.48, half * 0.08, half * 0.06);
    ctx.fillRect(screenX + half * 0.1, screenY - half * 0.48, half * 0.08, half * 0.06);
    if (enraged) {
      ctx.strokeStyle = "rgba(167, 255, 121, 0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY - half * 0.1, half * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#5cda6b";
      ctx.fillRect(screenX - half * 0.9, screenY + half * 0.02, half * 0.3, half * 0.18);
      ctx.fillRect(screenX + half * 0.6, screenY + half * 0.02, half * 0.3, half * 0.18);
    }
  }
};
