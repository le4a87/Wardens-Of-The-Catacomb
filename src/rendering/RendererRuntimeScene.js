import { RendererRuntimeBase } from "./RendererRuntimeBase.js";

export class RendererRuntimeScene extends RendererRuntimeBase {
  draw(game) {
    const ctx = this.ctx;
    const camera = game.getCamera();
    const cameraX = camera.x;
    const cameraY = camera.y;
    const layout = {
      sidebarX: this.canvas.width - this.sidebarWidth,
      sidebarW: this.sidebarWidth,
      topHudH: this.topHudHeight,
      playW: this.canvas.width - this.sidebarWidth,
      xpBarH: 28
    };
    game.uiRects.shopButton = null;
    game.uiRects.shopItems = [];
    game.uiRects.shopClose = null;
    game.uiRects.shopScrollArea = null;
    game.uiRects.shopScrollMax = 0;
    game.uiRects.skillTreeButton = null;
    game.uiRects.skillTreeClose = null;
    game.uiRects.skillTreeScrollArea = null;
    game.uiRects.skillTreeScrollMax = 0;
    game.uiRects.skillFireArrowNode = null;
    game.uiRects.skillPiercingNode = null;
    game.uiRects.skillMultiarrowNode = null;
    game.uiRects.skillWarriorMomentumNode = null;
    game.uiRects.skillWarriorRageNode = null;
    game.uiRects.statsButton = null;
    game.uiRects.statsClose = null;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawSidebarBackground(layout);
    if (game.networkEnabled && !game.networkReady) {
      this.drawNetworkPendingScene(game, layout);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, layout.topHudH, layout.playW, this.canvas.height - layout.topHudH - layout.xpBarH);
    ctx.clip();

    this.drawMap(game, cameraX, cameraY);

    if (!game.pickup.taken) {
      const x = game.pickup.x - cameraX;
      const y = game.pickup.y - cameraY;
      ctx.drawImage(this.keySprite, x - 8, y - 8, 16, 16);
    }

    for (const stand of game.armorStands) {
      if (stand.animated && stand.activated) continue;
      this.drawArmorStand(stand, stand.x - cameraX, stand.y - cameraY);
    }
    for (const trap of game.wallTraps || []) {
      if (!trap.spotted) continue;
      this.drawWallTrap(trap, trap.x - cameraX, trap.y - cameraY);
    }
    for (const br of game.breakables || []) this.drawBreakable(br, br.x - cameraX, br.y - cameraY);

    for (const enemy of game.enemies) {
      if (enemy.type === "goblin") this.drawTreasureGoblin(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "armor") this.drawAnimatedArmor(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "rat_archer") this.drawRatArcher(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "mimic") {
        if (enemy.dormant) this.drawBreakable({ type: "box", size: enemy.size }, enemy.x - cameraX, enemy.y - cameraY);
        else this.drawMimic(enemy, enemy.x - cameraX, enemy.y - cameraY);
      }
      else this.drawGhost(enemy.x - cameraX, enemy.y - cameraY, enemy.size);
      this.drawEnemyHealthBar(enemy, enemy.x - cameraX, enemy.y - cameraY);
    }

    this.drawDrops(game, cameraX, cameraY);
    this.drawPlayer(game, cameraX, cameraY);
    this.drawProjectiles(game, cameraX, cameraY);
    this.drawPlayerHealthBar(game, cameraX, cameraY);
    this.drawFloatingTexts(game, cameraX, cameraY);
    this.drawVignette(game, cameraX, cameraY);
    ctx.restore();

    this.drawExperienceBar(game, layout);
    this.drawHud(game, layout);
    const minimapBottom = this.drawMinimap(game, layout);
    this.drawPlayerStatsPanel(game, layout, minimapBottom + this.sidebarPadding);
    if (game.shopOpen) this.drawShopMenu(game, layout);
    if (game.skillTreeOpen) this.drawSkillTreeMenu(game, layout);
    if (game.paused && !game.shopOpen && !game.skillTreeOpen && !game.gameOver) this.drawPausedOverlay(layout);

    if (game.gameOver) {
      const progress = typeof game.getDeathTransitionProgress === "function" ? game.getDeathTransitionProgress() : 1;
      const fadeAlpha = Math.min(1, progress / 0.45);
      const titleAlpha = progress <= 0.16 ? 0 : Math.min(1, (progress - 0.16) / 0.2);
      const subtitleAlpha = progress <= 0.34 ? 0 : Math.min(1, (progress - 0.34) / 0.14);
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(243, 240, 232, ${titleAlpha})`;
      ctx.font = "bold 64px Trebuchet MS";
      ctx.fillText("GAME OVER", this.canvas.width / 2, this.canvas.height / 2 - 18);
      ctx.fillStyle = `rgba(208, 203, 194, ${subtitleAlpha})`;
      ctx.font = "20px Trebuchet MS";
      ctx.fillText("Returning to the main menu...", this.canvas.width / 2, this.canvas.height / 2 + 28);
      ctx.textAlign = "left";
    }
  }

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
  }

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
  }

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
  }

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

        if (tile === "D") {
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
  }

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
  }

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
  }

  drawTreasureGoblin(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const size = enemy.size;
    const half = size / 2;

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
  }

  drawRatArcher(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const aimX = Number.isFinite(enemy.dirX) ? enemy.dirX : 1;
    const aimY = Number.isFinite(enemy.dirY) ? enemy.dirY : 0;
    const perpX = -aimY;
    const perpY = aimX;
    const windup = Math.max(0, Math.min(1, (enemy.shotWindupTimer || 0) / 0.4));

    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.78, half * 0.95, half * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#6d4f2b";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.2, screenY + half * 0.38);
    ctx.quadraticCurveTo(screenX + half * 0.95, screenY + half * 0.68, screenX + half * 1.25, screenY + half * 1.15);
    ctx.stroke();

    ctx.fillStyle = "#6f5132";
    ctx.fillRect(screenX - half * 0.46, screenY - half * 0.04, half * 0.92, half * 0.88);

    ctx.fillStyle = "#8a643f";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.36, half * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4a2f1d";
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.62, screenY - half * 0.3);
    ctx.lineTo(screenX, screenY - half * 0.92);
    ctx.lineTo(screenX + half * 0.62, screenY - half * 0.3);
    ctx.lineTo(screenX + half * 0.42, screenY + half * 0.28);
    ctx.lineTo(screenX - half * 0.42, screenY + half * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#e5b27d";
    ctx.beginPath();
    ctx.arc(screenX - half * 0.16, screenY - half * 0.34, half * 0.07, 0, Math.PI * 2);
    ctx.arc(screenX + half * 0.16, screenY - half * 0.34, half * 0.07, 0, Math.PI * 2);
    ctx.fill();

    const bowX = screenX + aimX * half * (0.72 + windup * 0.1);
    const bowY = screenY - half * 0.08 + aimY * half * (0.72 + windup * 0.1);
    ctx.strokeStyle = "#9e7f51";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bowX + perpX * 6 - aimX * 2, bowY + perpY * 6 - aimY * 2);
    ctx.quadraticCurveTo(bowX + aimX * (5 + windup * 4), bowY + aimY * (5 + windup * 4), bowX - perpX * 6 - aimX * 2, bowY - perpY * 6 - aimY * 2);
    ctx.stroke();
    ctx.strokeStyle = windup > 0.2 ? "#f2d4a7" : "#ceb992";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(bowX + perpX * 6 - aimX * 2, bowY + perpY * 6 - aimY * 2);
    ctx.lineTo(bowX - perpX * 6 - aimX * 2, bowY - perpY * 6 - aimY * 2);
    ctx.stroke();
  }

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
  }

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

    // Halberd resting by the armor.
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
  }

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

    // Wielded halberd.
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
  }

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
}
