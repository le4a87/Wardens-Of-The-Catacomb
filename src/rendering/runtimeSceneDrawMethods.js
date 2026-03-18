import { runtimeSceneEnemyDrawMethods } from "./runtimeSceneEnemyDrawMethods.js";

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

  ...runtimeSceneEnemyDrawMethods,

  drawSkeletonWarrior(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    if (enemy.collapsed) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + half * 0.7, half, half * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      const reviveGlow = enemy.reviveAtEnd ? (enemy.reanimating ? 0.85 : 0.45) : 0;
      if (reviveGlow > 0) {
        ctx.strokeStyle = `rgba(145, 220, 255, ${reviveGlow})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + half * 0.2, half * 0.9, half * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = enemy.reviveAtEnd ? "#bfe8ff" : "#d7d9de";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenX - 7, screenY + 2);
      ctx.lineTo(screenX + 7, screenY - 1);
      ctx.moveTo(screenX - 6, screenY - 4);
      ctx.lineTo(screenX + 5, screenY + 5);
      ctx.moveTo(screenX - 2, screenY - 7);
      ctx.lineTo(screenX + 2, screenY + 7);
      ctx.stroke();
      if (enemy.reanimating) {
        ctx.fillStyle = "#dff8ff";
        ctx.font = "bold 10px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText("REVIVING", screenX, screenY - 12);
        ctx.textAlign = "left";
      }
      return;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.8, half * 0.92, half * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#d5d7dc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - 7);
    ctx.lineTo(screenX, screenY + 7);
    ctx.moveTo(screenX - 5, screenY - 2);
    ctx.lineTo(screenX + 5, screenY - 2);
    ctx.moveTo(screenX - 3, screenY + 7);
    ctx.lineTo(screenX - 6, screenY + 14);
    ctx.moveTo(screenX + 3, screenY + 7);
    ctx.lineTo(screenX + 6, screenY + 14);
    ctx.moveTo(screenX - 5, screenY + 1);
    ctx.lineTo(screenX - 9, screenY + 7);
    ctx.moveTo(screenX + 5, screenY + 1);
    ctx.lineTo(screenX + 9, screenY + 7);
    ctx.stroke();

    ctx.fillStyle = "#c7cad1";
    ctx.beginPath();
    ctx.arc(screenX, screenY - 11, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#49515e";
    ctx.fillRect(screenX - 2.5, screenY - 13, 2, 2);
    ctx.fillRect(screenX + 0.5, screenY - 13, 2, 2);

    const aimX = Number.isFinite(enemy.dirX) ? enemy.dirX : 1;
    const aimY = Number.isFinite(enemy.dirY) ? enemy.dirY : 0;
    const handX = screenX - 5;
    const handY = screenY + 1;
    const swordMidX = handX - 2;
    const swordMidY = handY - 10;
    const swordTipX = handX - 4 + aimX * 1.5;
    const swordTipY = handY - 18 + aimY * 1.5;
    ctx.strokeStyle = "#8f7450";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(swordMidX, swordMidY);
    ctx.stroke();
    ctx.strokeStyle = "#d9dce3";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(swordMidX, swordMidY);
    ctx.lineTo(swordTipX, swordTipY);
    ctx.stroke();
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

};
