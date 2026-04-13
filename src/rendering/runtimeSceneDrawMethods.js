import { runtimeSceneEnemyDrawMethods } from "./runtimeSceneEnemyDrawMethods.js";
import { runtimeSceneObjectDrawMethods } from "./runtimeSceneObjectDrawMethods.js";
import { drawConsumablesBar } from "./hud/consumablesBar.js";

function hexToRgba(color, alpha) {
  if (typeof color !== "string") return `rgba(199, 202, 209, ${alpha})`;
  const hex = color.trim();
  const expanded = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const match = /^#([0-9a-f]{6})$/i.exec(expanded);
  if (!match) return `rgba(199, 202, 209, ${alpha})`;
  const int = Number.parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
      const statsBottom = this.drawPlayerStatsPanel(game, layout, minimapBottom + this.sidebarPadding);
      this.drawGroupPanel(game, layout, statsBottom + this.sidebarPadding);
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

    drawConsumablesBar(this, game, layout, y);
  },

  drawMap(game, cameraX, cameraY) {
    const ctx = this.ctx;
    const map = game.map;
    const palette = typeof game.getBiomeAppearance === "function" ? game.getBiomeAppearance() : {};
    const isSewer = game.biomeKey === "sewer";
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
          ctx.fillStyle = palette.wallOuter || "#262a37";
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = palette.wallInner || "#2f3445";
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
          ctx.fillStyle = palette.wallBands || "#3a4054";
          ctx.fillRect(px + 2, py + 2, tileSize - 4, 6);
          ctx.fillRect(px + 2, py + 14, tileSize - 4, 6);
          ctx.fillRect(px + 2, py + 26, tileSize - 4, 4);
          if (isSewer) {
            if ((hash & 3) === 0) {
              ctx.fillStyle = palette.wallMossDark || "#3f5f2f";
              ctx.beginPath();
              ctx.arc(px + 8 + (hash & 3), py + 8 + ((hash >> 3) & 7), 4, 0, Math.PI * 2);
              ctx.arc(px + 19, py + 18, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = palette.wallMoss || "#5f8a48";
              ctx.beginPath();
              ctx.arc(px + 10, py + 9, 2.8, 0, Math.PI * 2);
              ctx.arc(px + 20, py + 16, 3.2, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if ((hash & 7) === 0) {
            ctx.fillStyle = palette.wallAccent || "#4f2230";
            ctx.fillRect(px + 11, py + 9, 10, 14);
            ctx.fillStyle = palette.wallAccentMetal || "#d7a54c";
            ctx.fillRect(px + 14, py + 13, 4, 5);
          }
        } else {
          ctx.fillStyle = palette.floorBase || "#141821";
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.fillStyle = (hash & 1) === 0 ? palette.floorInsetA || "#1b202b" : palette.floorInsetB || "#191e28";
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
          ctx.strokeStyle = palette.floorStroke || "#202634";
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1.5, py + 1.5, tileSize - 3, tileSize - 3);
          if (isSewer) {
            if (tile === "~") {
              ctx.fillStyle = palette.sewerWater || "#447b6f";
              ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
              ctx.fillStyle = palette.sewerWaterDark || "#29554c";
              ctx.fillRect(px + 3, py + 5, tileSize - 6, tileSize - 10);
              ctx.strokeStyle = palette.sewerFoam || "rgba(198, 239, 224, 0.32)";
              ctx.beginPath();
              ctx.moveTo(px + 4, py + 9);
              ctx.quadraticCurveTo(px + tileSize * 0.45, py + 6, px + tileSize - 4, py + 11);
              ctx.moveTo(px + 5, py + 22);
              ctx.quadraticCurveTo(px + tileSize * 0.58, py + 25, px + tileSize - 6, py + 20);
              ctx.stroke();
            } else {
              for (let step = 4; step < tileSize - 3; step += 9) {
                ctx.strokeStyle = (hash & 1) === 0 ? "#d5d7d7" : "#a8adad";
                ctx.beginPath();
                ctx.moveTo(px + 2, py + step + 0.5);
                ctx.lineTo(px + tileSize - 2, py + step - 2.5);
                ctx.stroke();
              }
            }
            if (tile === "g") {
              ctx.fillStyle = palette.grateFrame || "#4d5356";
              ctx.fillRect(px + 6, py + 6, tileSize - 12, tileSize - 12);
              ctx.strokeStyle = palette.grateBars || "#2f3437";
              for (let gx = px + 9; gx <= px + tileSize - 9; gx += 4) {
                ctx.beginPath();
                ctx.moveTo(gx + 0.5, py + 7);
                ctx.lineTo(gx + 0.5, py + tileSize - 7);
                ctx.stroke();
              }
            } else if (tile === "r") {
              ctx.strokeStyle = palette.rivulet || "#5f9689";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(px + 4, py + 7);
              ctx.bezierCurveTo(px + 11, py + 10, px + 18, py + 19, px + tileSize - 5, py + tileSize - 8);
              ctx.stroke();
              ctx.lineWidth = 1;
            } else if (tile === "o") {
              ctx.fillStyle = palette.sewerPool || "#4e8c7e";
              ctx.beginPath();
              ctx.ellipse(px + tileSize / 2, py + tileSize / 2, tileSize * 0.28, tileSize * 0.18, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = palette.sewerPoolDark || "#325a52";
              ctx.stroke();
            }
          }
        }

        if (tile === "D" && !(game.floorBoss && game.pickup?.taken && game.door?.open)) {
          const frameX = px + 5;
          const frameY = py + 3;
          const frameW = tileSize - 10;
          const frameH = tileSize - 6;
          ctx.fillStyle = palette.doorFrame || "#3b2b1d";
          ctx.fillRect(frameX, frameY, frameW, frameH);
          ctx.fillStyle = palette.doorInner || "#6b4a2e";
          ctx.fillRect(frameX + 2, frameY + 2, frameW - 4, frameH - 4);
          if (game.door.open) {
            const glow = ctx.createRadialGradient(px + tileSize / 2, py + tileSize / 2, 2, px + tileSize / 2, py + tileSize / 2, tileSize * 0.72);
            glow.addColorStop(0, palette.doorOpenGlowInner || "rgba(132, 255, 188, 0.7)");
            glow.addColorStop(1, palette.doorOpenGlowOuter || "rgba(65, 149, 109, 0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = palette.doorOpenFill || "#4f9f6f";
            ctx.fillRect(frameX + 4, frameY + 4, frameW - 8, frameH - 8);
          } else {
            ctx.fillStyle = palette.doorClosed || "#8f5a39";
            ctx.fillRect(frameX + 4, frameY + 4, frameW - 8, frameH - 8);
            ctx.strokeStyle = palette.doorClosedMark || "#b47a4c";
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
  ...runtimeSceneObjectDrawMethods,

  drawPrisoner(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const aimX = Number.isFinite(enemy.dirX) ? enemy.dirX : 1;
    const aimY = Number.isFinite(enemy.dirY) ? enemy.dirY : 0;
    const windup = Math.max(0.01, this.config.enemy.prisonerWindup || 0.16);
    const swingRatio = 1 - Math.max(0, Math.min(1, (enemy.swingTimer || 0) / windup));
    const chainReach = (this.config.enemy.prisonerAttackRangeTiles || 2) * this.config.map.tile * 0.55;
    const sweepRange = (this.config.enemy.prisonerAttackRangeTiles || 1.5) * this.config.map.tile;
    const sweepArc = ((this.config.enemy.prisonerAttackArcDeg || 180) * Math.PI) / 180;
    const dragX = -aimX;
    const dragY = -aimY;
    const dragPerpX = -dragY;
    const dragPerpY = dragX;

    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.82, half * 1.05, half * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5d4b42";
    ctx.fillRect(screenX - half * 0.48, screenY - half * 0.1, half * 0.96, half * 1.08);
    ctx.fillStyle = "#7c675a";
    ctx.fillRect(screenX - half * 0.38, screenY - half * 0.72, half * 0.76, half * 0.72);

    ctx.fillStyle = "#d7c2ae";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.42, half * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a342c";
    ctx.fillRect(screenX - half * 0.15, screenY - half * 0.25, half * 0.3, half * 0.48);

    ctx.strokeStyle = "#8d7b6e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.34, screenY - half * 0.02);
    ctx.quadraticCurveTo(
      screenX - half * 0.34 + dragPerpX * 8,
      screenY + half * 0.24 + dragPerpY * 8,
      screenX - half * 0.34 + dragX * chainReach * 0.7,
      screenY + half * 0.18 + dragY * chainReach * 0.7
    );
    ctx.moveTo(screenX + half * 0.34, screenY - half * 0.02);
    ctx.quadraticCurveTo(
      screenX + half * 0.34 - dragPerpX * 8,
      screenY + half * 0.28 - dragPerpY * 8,
      screenX + half * 0.34 + dragX * chainReach * 0.55,
      screenY + half * 0.24 + dragY * chainReach * 0.55
    );
    ctx.stroke();

    if ((enemy.swingTimer || 0) > 0) {
      const sweepAngle = Math.atan2(aimY, aimX);
      const sweepStart = sweepAngle - sweepArc * 0.5;
      const sweepEnd = sweepAngle + sweepArc * 0.5;
      const alpha = Math.max(0.18, Math.min(0.78, 0.22 + swingRatio * 0.56));
      const arcRadius = sweepRange * (0.88 + swingRatio * 0.16);
      const slashGrad = ctx.createRadialGradient(
        screenX,
        screenY,
        arcRadius * 0.16,
        screenX + aimX * arcRadius * 0.55,
        screenY + aimY * arcRadius * 0.55,
        arcRadius
      );
      slashGrad.addColorStop(0, `rgba(255, 228, 186, ${alpha})`);
      slashGrad.addColorStop(0.65, `rgba(210, 118, 82, ${alpha * 0.72})`);
      slashGrad.addColorStop(1, "rgba(120, 38, 22, 0)");

      ctx.save();
      ctx.fillStyle = slashGrad;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.arc(screenX, screenY, arcRadius, sweepStart, sweepEnd);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(244, 216, 179, ${Math.min(0.95, alpha + 0.18)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(screenX, screenY, arcRadius * 0.82, sweepStart, sweepEnd);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#5a463b";
    ctx.fillRect(screenX - half * 0.52, screenY + half * 0.92, half * 0.28, half * 0.42);
    ctx.fillRect(screenX + half * 0.24, screenY + half * 0.92, half * 0.28, half * 0.42);
  },

  drawSkeletonWarrior(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const controlledColor = typeof enemy?.controlledColor === "string" && enemy.controlledColor ? enemy.controlledColor : null;
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
      ctx.strokeStyle = enemy.reviveAtEnd ? "#bfe8ff" : controlledColor ? hexToRgba(controlledColor, 0.84) : "#d7d9de";
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

    ctx.strokeStyle = controlledColor ? hexToRgba(controlledColor, 0.8) : "#d5d7dc";
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

    ctx.fillStyle = controlledColor ? hexToRgba(controlledColor, 0.9) : "#c7cad1";
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
    const ctx = this.ctx;
    if ((enemy.burningTimer || 0) > 0) {
      const fx = Math.floor(screenX);
      const fy = Math.floor(screenY + enemy.size * 0.42);
      ctx.fillStyle = "rgba(255, 160, 74, 0.9)";
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 226, 120, 0.95)";
      ctx.beginPath();
      ctx.arc(fx, fy - 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 109, 52, 0.92)";
      ctx.beginPath();
      ctx.moveTo(fx, fy - 8);
      ctx.lineTo(fx + 4, fy - 1);
      ctx.lineTo(fx, fy + 2);
      ctx.lineTo(fx - 4, fy - 1);
      ctx.closePath();
      ctx.fill();
    }
    if ((enemy.curseTimer || 0) > 0) {
      const fx = Math.floor(screenX - 10);
      const fy = Math.floor(screenY + enemy.size * 0.42);
      ctx.fillStyle = "rgba(176, 116, 255, 0.92)";
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(228, 196, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(fx, fy - 1, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(120, 62, 201, 0.95)";
      ctx.beginPath();
      ctx.moveTo(fx, fy - 8);
      ctx.lineTo(fx + 4, fy - 1);
      ctx.lineTo(fx, fy + 2);
      ctx.lineTo(fx - 4, fy - 1);
      ctx.closePath();
      ctx.fill();
    }
    if ((enemy.rotTimer || 0) > 0) {
      const fx = Math.floor(screenX + 10);
      const fy = Math.floor(screenY + enemy.size * 0.42);
      ctx.fillStyle = "rgba(103, 214, 96, 0.92)";
      ctx.beginPath();
      ctx.moveTo(fx, fy - 6);
      ctx.bezierCurveTo(fx + 4, fy - 4, fx + 6, fy + 1, fx, fy + 7);
      ctx.bezierCurveTo(fx - 6, fy + 1, fx - 4, fy - 4, fx, fy - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(208, 255, 198, 0.88)";
      ctx.beginPath();
      ctx.arc(fx + 1, fy - 1, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if ((enemy.hpBarTimer || 0) <= 0) return;
    if (typeof enemy.maxHp !== "number" || enemy.maxHp <= 0) return;

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

};
