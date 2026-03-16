export const runtimeSceneDrawMethods = {
  drawNetworkPendingScene(game, layout) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(5, 9, 14, 0.98)";
    ctx.fillRect(0, 0, layout.playW, this.canvas.height);
    ctx.strokeStyle = "rgba(126, 139, 171, 0.35)";
    ctx.strokeRect(0.5, 0.5, layout.playW - 1, this.canvas.height - 1);

    ctx.fillStyle = "#e7edf8";
    ctx.textAlign = "center";
    ctx.font = "bold 30px Trebuchet MS";
    ctx.fillText("Network Session", layout.playW / 2, this.canvas.height / 2 - 26);
    ctx.font = "18px Trebuchet MS";
    ctx.fillStyle = "#b8c7e6";
    const status = game.networkLoadingMessage || "Connecting...";
    ctx.fillText(status, layout.playW / 2, this.canvas.height / 2 + 6);
    ctx.font = "14px Trebuchet MS";
    ctx.fillStyle = "#8fa1c7";
    ctx.fillText("Playable area unlocks after room + map sync.", layout.playW / 2, this.canvas.height / 2 + 34);
    ctx.textAlign = "left";

    this.drawHud(game, layout);
    const row0 = Array.isArray(game.map) && game.map.length > 0 ? game.map[0] : null;
    const row0Len = typeof row0 === "string" ? row0.length : Array.isArray(row0) ? row0.length : 0;
    if (row0Len > 0) {
      const minimapBottom = this.drawMinimap(game, layout);
      this.drawPlayerStatsPanel(game, layout, minimapBottom + this.sidebarPadding);
    }
  },

  drawSidebarBackground(layout) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6, 10, 16, 0.96)";
    ctx.fillRect(layout.sidebarX, 0, layout.sidebarW, this.canvas.height);
    ctx.strokeStyle = "rgba(126, 139, 171, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(layout.sidebarX + 0.5, 0);
    ctx.lineTo(layout.sidebarX + 0.5, this.canvas.height);
    ctx.stroke();
  },

  drawExperienceBar(game, layout) {
    const ctx = this.ctx;
    const x = 0;
    const y = this.canvas.height - layout.xpBarH;
    const w = layout.playW;
    const h = layout.xpBarH;
    const ratio = game.expToNextLevel > 0 ? Math.max(0, Math.min(1, game.experience / game.expToNextLevel)) : 0;

    ctx.fillStyle = "rgba(7, 10, 16, 0.94)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(126, 139, 171, 0.48)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    const pad = 10;
    const barX = x + pad;
    const barY = y + 8;
    const barW = w - pad * 2;
    const barH = 8;
    ctx.fillStyle = "#1f2a3e";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#7ea8ff";
    ctx.fillRect(barX, barY, Math.floor(barW * ratio), barH);

    ctx.strokeStyle = "rgba(198, 212, 246, 0.35)";
    for (let i = 1; i < 10; i++) {
      const sx = Math.floor(barX + (barW * i) / 10) + 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, barY);
      ctx.lineTo(sx, barY + barH);
      ctx.stroke();
    }

    ctx.fillStyle = "#d7e4ff";
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(`XP ${game.experience}/${game.expToNextLevel} (${Math.round(ratio * 100)}%)`, barX, y + 22);
  },

  drawMap(game, cameraX, cameraY) {
    const ctx = this.ctx;
    const map = game.map;
    const tileSize = this.config.map.tile;
    const playW = game.getPlayAreaWidth ? game.getPlayAreaWidth() : this.canvas.width - this.sidebarWidth;
    const minX = Math.max(0, Math.floor(cameraX / tileSize) - 1);
    const maxX = Math.min(map[0].length - 1, Math.ceil((cameraX + playW) / tileSize) + 1);
    const minY = Math.max(0, Math.floor(cameraY / tileSize) - 1);
    const maxY = Math.min(map.length - 1, Math.ceil((cameraY + this.canvas.height) / tileSize) + 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = map[y][x];
        const px = x * tileSize - cameraX;
        const py = y * tileSize - cameraY;
        const hash = (x * 73856093) ^ (y * 19349663);

        if (tile === "#") {
          ctx.fillStyle = "#262a37";
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = "#2f3445";
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
          ctx.fillStyle = "#3a4054";
          ctx.fillRect(px + 2, py + 2, tileSize - 4, 6);
          ctx.fillRect(px + 2, py + 14, tileSize - 4, 6);
          ctx.fillRect(px + 2, py + 26, tileSize - 4, 4);
          if ((hash & 7) === 0) {
            ctx.fillStyle = "#4f2230";
            ctx.fillRect(px + 11, py + 9, 10, 14);
            ctx.fillStyle = "#d7a54c";
            ctx.fillRect(px + 14, py + 13, 4, 5);
          }
        } else {
          ctx.fillStyle = "#141821";
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = (hash & 1) === 0 ? "#1b202b" : "#191e28";
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
          ctx.strokeStyle = "#202634";
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1.5, py + 1.5, tileSize - 3, tileSize - 3);
        }

        if (tile === "D" && !(game.floorBoss && game.pickup?.taken && game.door?.open)) {
          const frameX = px + 5;
          const frameY = py + 3;
          const frameW = tileSize - 10;
          const frameH = tileSize - 6;
          ctx.fillStyle = "#3b2b1d";
          ctx.fillRect(frameX, frameY, frameW, frameH);
          ctx.fillStyle = "#6b4a2e";
          ctx.fillRect(frameX + 2, frameY + 2, frameW - 4, frameH - 4);
          if (game.door.open) {
            const glow = ctx.createRadialGradient(px + tileSize / 2, py + tileSize / 2, 2, px + tileSize / 2, py + tileSize / 2, tileSize * 0.72);
            glow.addColorStop(0, "rgba(132, 255, 188, 0.7)");
            glow.addColorStop(1, "rgba(65, 149, 109, 0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#4f9f6f";
            ctx.fillRect(frameX + 4, frameY + 4, frameW - 8, frameH - 8);
          } else {
            ctx.fillStyle = "#8f5a39";
            ctx.fillRect(frameX + 4, frameY + 4, frameW - 8, frameH - 8);
            ctx.strokeStyle = "#b47a4c";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(frameX + 7, frameY + 7);
            ctx.lineTo(frameX + frameW - 7, frameY + frameH - 7);
            ctx.moveTo(frameX + frameW - 7, frameY + 7);
            ctx.lineTo(frameX + 7, frameY + frameH - 7);
            ctx.stroke();
          }
        }
      }
    }
  },

  drawGhost(screenX, screenY, size) {
    const ctx = this.ctx;
    const half = size / 2;
    const headRadius = half * 0.58;
    const bodyTop = screenY - size * 0.12;
    const bodyBottom = screenY + half;

    ctx.fillStyle = "#d8f2ff";
    ctx.beginPath();
    ctx.arc(screenX, screenY - size * 0.2, headRadius, Math.PI, 0);
    ctx.lineTo(screenX + half * 0.82, bodyBottom - 4);
    ctx.lineTo(screenX + half * 0.45, bodyBottom - 1);
    ctx.lineTo(screenX + half * 0.15, bodyBottom - 5);
    ctx.lineTo(screenX - half * 0.15, bodyBottom - 1);
    ctx.lineTo(screenX - half * 0.45, bodyBottom - 5);
    ctx.lineTo(screenX - half * 0.82, bodyBottom - 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(120, 208, 255, 0.45)";
    ctx.fillRect(screenX - half * 0.72, bodyTop, half * 1.44, half * 1.15);
  },

  drawTreasureGoblin(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.6, half * 0.9, half * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4ea24b";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.15, half * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f8a3d";
    ctx.fillRect(screenX - half * 0.5, screenY + half * 0.1, half, half * 0.85);
    ctx.fillStyle = "#cfa84a";
    const coinCount = Math.min(5, 1 + Math.floor(enemy.goldEaten / 10));
    for (let i = 0; i < coinCount; i++) {
      const offset = (i - (coinCount - 1) / 2) * (half * 0.25);
      ctx.beginPath();
      ctx.arc(screenX + half * 0.62 + offset, screenY + half * 0.2, Math.max(1.2, half * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawEnemyHealthBar(enemy, screenX, screenY) {
    if ((enemy.hpBarTimer || 0) <= 0) return;
    if (typeof enemy.maxHp !== "number" || enemy.maxHp <= 0) return;

    const ctx = this.ctx;
    const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    const width = Math.max(20, enemy.size + 6);
    const height = 4;
    const x = Math.floor(screenX - width / 2);
    const y = Math.floor(screenY - enemy.size * 0.85 - 12);

    ctx.fillStyle = "rgba(20, 22, 28, 0.85)";
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = "#3a4358";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = ratio > 0.5 ? "#7cd88f" : ratio > 0.25 ? "#e1bf63" : "#de6a6a";
    ctx.fillRect(x, y, width * ratio, height);
  },

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

  drawExitPortal(portal, screenX, screenY, time = 0) {
    const ctx = this.ctx;
    const pulse = 0.88 + Math.sin(time * 5.8) * 0.08;
    const outerR = 24 * pulse;
    const innerR = 14 * (1 + Math.sin(time * 7.1 + 0.6) * 0.05);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 18, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, outerR + 14);
    glow.addColorStop(0, "rgba(188, 255, 251, 0.55)");
    glow.addColorStop(0.55, "rgba(94, 183, 255, 0.28)");
    glow.addColorStop(1, "rgba(29, 58, 122, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY, outerR + 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#8be3ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#d9f8ff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(screenX, screenY, innerR, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const a = time * 1.9 + (i / 6) * Math.PI * 2;
      const r = 8 + (i % 2) * 6;
      const x = screenX + Math.cos(a) * r;
      const y = screenY + Math.sin(a) * r * 0.7;
      ctx.fillStyle = i % 2 === 0 ? "#a5f4ff" : "#4fa8ff";
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(7, 15, 31, 0.8)";
    ctx.fillRect(screenX - 30, screenY - 42, 60, 16);
    ctx.strokeStyle = "rgba(151, 231, 255, 0.75)";
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX - 29.5, screenY - 41.5, 59, 15);
    ctx.fillStyle = "#ddfbff";
    ctx.font = "bold 10px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("PORTAL", screenX, screenY - 30);
    ctx.textAlign = "left";
  },

  drawSkeleton(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size / 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.82, half * 0.92, half * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dfe1df";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - half * 0.2);
    ctx.lineTo(screenX, screenY + half * 0.68);
    ctx.moveTo(screenX - half * 0.4, screenY + half * 0.02);
    ctx.lineTo(screenX + half * 0.4, screenY + half * 0.02);
    ctx.moveTo(screenX, screenY + half * 0.68);
    ctx.lineTo(screenX - half * 0.38, screenY + half * 1.02);
    ctx.moveTo(screenX, screenY + half * 0.68);
    ctx.lineTo(screenX + half * 0.38, screenY + half * 1.02);
    ctx.stroke();
    ctx.fillStyle = "#f0efe8";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.44, half * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2735";
    ctx.fillRect(screenX - 4, screenY - half * 0.56, 2, 2);
    ctx.fillRect(screenX + 2, screenY - half * 0.56, 2, 2);
    ctx.fillRect(screenX - 3, screenY - half * 0.32, 6, 2);
    ctx.strokeStyle = "#9b9fb2";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(screenX + half * 0.52, screenY - half * 0.1);
    ctx.lineTo(screenX + half * 0.88, screenY + half * 0.72);
    ctx.stroke();
  },

  drawMimic(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const tongueLen = Math.max(0, enemy.tongueLength || 0);
    const tongueOut = tongueLen > 0.5;
    const lidLift = tongueOut ? half * 0.34 : half * 0.16;
    const dirX = enemy.tongueDirX || 1;
    const dirY = enemy.tongueDirY || 0;

    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.72, half, half * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6d4b2e";
    ctx.fillRect(screenX - half, screenY - half * 0.74, half * 2, half * 1.48);
    ctx.strokeStyle = "#8f6a43";
    ctx.strokeRect(screenX - half + 0.5, screenY - half * 0.74 + 0.5, half * 2 - 1, half * 1.48 - 1);
    ctx.fillStyle = "#b38b5f";
    ctx.fillRect(screenX - half * 0.92, screenY - 1, half * 1.84, 2);

    ctx.save();
    ctx.translate(screenX, screenY - 1);
    ctx.rotate(Math.atan2(dirY, dirX) * 0.08);
    ctx.fillStyle = "#7a5535";
    ctx.fillRect(-half, -half * 0.76 - lidLift, half * 2, half * 0.56);
    ctx.strokeStyle = "#a17a52";
    ctx.strokeRect(-half + 0.5, -half * 0.76 - lidLift + 0.5, half * 2 - 1, half * 0.56 - 1);
    ctx.restore();

    ctx.fillStyle = "#f1e7d2";
    for (let i = -2; i <= 2; i++) {
      const offset = i * (half * 0.3);
      ctx.beginPath();
      ctx.moveTo(screenX + offset, screenY - half * 0.18);
      ctx.lineTo(screenX + offset + half * 0.1, screenY - half * 0.02);
      ctx.lineTo(screenX + offset - half * 0.1, screenY - half * 0.02);
      ctx.closePath();
      ctx.fill();
    }

    if (tongueOut) {
      const startX = screenX + dirX * (half * 0.5);
      const startY = screenY + dirY * (half * 0.1);
      const tipX = startX + dirX * tongueLen;
      const tipY = startY + dirY * tongueLen;
      ctx.strokeStyle = "#ce5b7a";
      ctx.lineWidth = Math.max(3, half * 0.24);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        startX + dirX * (tongueLen * 0.45) - dirY * half * 0.35,
        startY + dirY * (tongueLen * 0.45) + dirX * half * 0.35,
        tipX,
        tipY
      );
      ctx.stroke();
      ctx.fillStyle = "#f08cab";
      ctx.beginPath();
      ctx.arc(tipX, tipY, Math.max(2, half * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
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
