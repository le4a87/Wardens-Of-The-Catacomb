import { RendererRuntimeScene } from "./RendererRuntimeScene.js";

export class RendererRuntimeEffects extends RendererRuntimeScene {
  drawProjectiles(game, cameraX, cameraY) {
    const ctx = this.ctx;
    for (const swing of game.meleeSwings || []) {
      this.drawMeleeSwing(swing, cameraX, cameraY, game.player);
    }

    for (const b of game.bullets) {
      if (b.kind === "necroticBolt") {
        this.drawNecroticBolt(b, cameraX, cameraY, game.time);
        continue;
      }
      const x = b.x - cameraX;
      const y = b.y - cameraY;
      const isTrapArrow = b.projectileType === "trapArrow";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.angle);
      ctx.fillStyle = isTrapArrow ? "#d66e57" : "#d9c27f";
      ctx.fillRect(-7, -1.3, 11, 2.6);
      ctx.fillStyle = isTrapArrow ? "#ffb9a7" : "#e5e2dc";
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(1, -3);
      ctx.lineTo(1, 3);
      ctx.closePath();
      ctx.fill();
      if (isTrapArrow) {
        ctx.fillStyle = "#791d15";
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(-10, -2.2);
        ctx.lineTo(-8.2, 0);
        ctx.lineTo(-10, 2.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    for (const arrow of game.fireArrows) {
      const x = arrow.x - cameraX;
      const y = arrow.y - cameraY;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(arrow.angle);
      ctx.fillStyle = "#ffb347";
      ctx.fillRect(-8, -1.7, 12, 3.4);
      ctx.fillStyle = "#ff6a3d";
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-12, -3);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-12, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const zone of game.fireZones) this.drawFireZone(zone, cameraX, cameraY, game.time);
  }

  drawNecroticBolt(projectile, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = projectile.x - cameraX;
    const y = projectile.y - cameraY;
    const size = Number.isFinite(projectile.size) ? projectile.size : 12;
    const pulse = 0.82 + Math.sin(time * 13 + projectile.x * 0.02 + projectile.y * 0.017) * 0.16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Number.isFinite(projectile.angle) ? projectile.angle : 0);
    const outer = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 0.9);
    outer.addColorStop(0, "rgba(235, 183, 255, 0.92)");
    outer.addColorStop(0.45, "rgba(153, 78, 214, 0.68)");
    outer.addColorStop(1, "rgba(56, 19, 89, 0)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.9 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a154f";
    ctx.beginPath();
    ctx.moveTo(size * 0.7, 0);
    ctx.lineTo(-size * 0.55, -size * 0.34);
    ctx.lineTo(-size * 0.1, 0);
    ctx.lineTo(-size * 0.55, size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f1d5ff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-size * 0.25, 0);
    ctx.lineTo(size * 0.5, 0);
    ctx.stroke();
    ctx.restore();
  }

  drawMeleeSwing(swing, cameraX, cameraY, player) {
    const ctx = this.ctx;
    const life = Number.isFinite(swing.life) ? swing.life : 0;
    const maxLife = Number.isFinite(swing.maxLife) && swing.maxLife > 0 ? swing.maxLife : this.config.effects.meleeSwingLife;
    const alpha = Math.max(0, Math.min(1, life / maxLife));
    if (alpha <= 0) return;

    const x = swing.x - cameraX;
    const y = swing.y - cameraY;
    const range = swing.range || 40;
    const arc = swing.arc || Math.PI * 0.5;
    const start = swing.angle - arc * 0.5;
    const end = swing.angle + arc * 0.5;
    const dirX = Math.cos(swing.angle);
    const dirY = Math.sin(swing.angle);

    ctx.save();
    ctx.globalAlpha = 0.55 * alpha;
    const slashGrad = ctx.createRadialGradient(x, y, range * 0.15, x + dirX * range * 0.6, y + dirY * range * 0.6, range);
    slashGrad.addColorStop(0, "rgba(255, 232, 188, 0.9)");
    slashGrad.addColorStop(1, "rgba(189, 96, 64, 0)");
    ctx.fillStyle = slashGrad;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, start, end);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.85 * alpha;
    ctx.strokeStyle = "#f4d8b3";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, range * 0.82, start, end);
    ctx.stroke();

    const bladeX = x + dirX * (range * 0.72);
    const bladeY = y + dirY * (range * 0.72);
    ctx.strokeStyle = "#e9e0d1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x - cameraX + dirX * 12, player.y - cameraY + dirY * 12);
    ctx.lineTo(bladeX, bladeY);
    ctx.stroke();
    ctx.restore();
  }

  drawFireZone(zone, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = zone.x - cameraX;
    const y = zone.y - cameraY;
    const lifeFrac = Math.max(0, Math.min(1, zone.life / this.config.fireArrow.lingerDuration));
    const pulse = 0.88 + Math.sin((time * 10 + zone.x * 0.02 + zone.y * 0.015)) * 0.09;
    const coreR = zone.radius * 0.42 * pulse;
    const midR = zone.radius * 0.72 * (0.96 + Math.sin(time * 7.8 + zone.y * 0.018) * 0.06);
    const edgeR = zone.radius * (0.96 + Math.sin(time * 6.1 + zone.x * 0.013) * 0.05);

    const outer = ctx.createRadialGradient(x, y, coreR * 0.15, x, y, edgeR);
    outer.addColorStop(0, `rgba(255, 224, 140, ${0.26 * lifeFrac + 0.12})`);
    outer.addColorStop(0.45, `rgba(255, 138, 62, ${0.24 * lifeFrac + 0.1})`);
    outer.addColorStop(1, `rgba(138, 34, 18, ${0.12 * lifeFrac})`);
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(x, y, edgeR, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(x, y, 2, x, y, midR);
    core.addColorStop(0, `rgba(255, 243, 175, ${0.35 * lifeFrac + 0.16})`);
    core.addColorStop(0.55, `rgba(255, 167, 70, ${0.26 * lifeFrac + 0.12})`);
    core.addColorStop(1, `rgba(255, 96, 45, ${0.1 * lifeFrac})`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, midR, 0, Math.PI * 2);
    ctx.fill();

    // Irregular ember tongues around the perimeter.
    const tongues = 9;
    ctx.fillStyle = `rgba(255, 188, 93, ${0.16 * lifeFrac + 0.06})`;
    for (let i = 0; i < tongues; i++) {
      const a = (i / tongues) * Math.PI * 2 + time * 1.7;
      const wobble = Math.sin(time * 8 + i * 1.9 + zone.x * 0.01) * 0.1;
      const r1 = zone.radius * (0.58 + wobble);
      const r2 = zone.radius * (0.88 + wobble * 0.5);
      const px = x + Math.cos(a) * r1;
      const py = y + Math.sin(a) * r1;
      const tx = x + Math.cos(a) * r2;
      const ty = y + Math.sin(a) * r2;
      ctx.beginPath();
      ctx.ellipse((px + tx) * 0.5, (py + ty) * 0.5, 3.8, 1.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawDrops(game, cameraX, cameraY) {
    const ctx = this.ctx;
    for (const drop of game.drops) {
      const x = drop.x - cameraX;
      const y = drop.y - cameraY;
      if (drop.type === "health") {
        ctx.drawImage(this.potionSprite, x - 10, y - 13, 20, 24);
      } else if (drop.type === "gold") {
        ctx.fillStyle = "#e1bc54";
        ctx.beginPath();
        ctx.arc(x, y, drop.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (drop.type === "gold_bag") {
        ctx.drawImage(this.goldBagSprite, x - 12, y - 12, 24, 24);
      }
    }
  }

  drawPlayer(game, cameraX, cameraY) {
    const ctx = this.ctx;
    const p = game.player;
    const frameSize = this.config.player.spriteFrame;
    const renderSize = this.config.player.spriteRenderSize || frameSize;
    const playerScreenX = p.x - cameraX;
    const playerScreenY = p.y - cameraY;
    const prevRenderX = Number.isFinite(p._renderPrevX) ? p._renderPrevX : p.x;
    const prevRenderY = Number.isFinite(p._renderPrevY) ? p._renderPrevY : p.y;
    const movedRenderSq = (p.x - prevRenderX) * (p.x - prevRenderX) + (p.y - prevRenderY) * (p.y - prevRenderY);
    p._renderPrevX = p.x;
    p._renderPrevY = p.y;
    const movingVisual = !!p.moving || movedRenderSq > 0.01;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const lastTs = Number.isFinite(p._renderAnimTs) ? p._renderAnimTs : now;
    const renderDt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
    p._renderAnimTs = now;
    p._renderAnimPhase = Number.isFinite(p._renderAnimPhase) ? p._renderAnimPhase : 0;
    if (movingVisual) p._renderAnimPhase += renderDt * this.config.player.animationSpeed;
    else p._renderAnimPhase = Math.max(0, p._renderAnimPhase - renderDt * this.config.player.animationSpeed * 1.8);
    const animFrame = movingVisual
      ? Math.floor(p._renderAnimPhase) % this.config.player.spriteFramesPerDir
      : 0;
    const frameX = animFrame * frameSize;
    const frameY = p.facing * frameSize;
    const drawX = playerScreenX - renderSize / 2;
    const drawY = playerScreenY - renderSize * 0.56;
    let tintColor = null;
    let tintAlpha = 0;
    if (!game.classSpec?.usesRanged) {
      if ((game.warriorRageActiveTimer || 0) > 0) {
        tintColor = "#ff2a2a";
        tintAlpha = 0.5;
      } else if ((game.warriorRageCooldownTimer || 0) > 0 && game.isWarriorRageUnlocked && game.isWarriorRageUnlocked()) {
        tintColor = "#ff9b9b";
        tintAlpha = 0.32;
      }
    }
    this.drawPlayerSpriteFrame(frameX, frameY, frameSize, drawX, drawY, renderSize, tintColor, tintAlpha);
    const baseCd = game.getPlayerFireCooldown ? game.getPlayerFireCooldown() : this.config.player.baseFireCooldown;
    const firePulse = baseCd > 0 ? Math.max(0, Math.min(1, p.fireCooldown / baseCd)) : 0;
    const walkPhase = movingVisual ? p._renderAnimPhase * 0.1 : 0;
    if (game.classSpec && !game.classSpec.usesRanged) {
      this.drawPlayerFighterRig(p, playerScreenX, playerScreenY, walkPhase, firePulse);
    } else {
      this.drawPlayerAimingRig(p, playerScreenX, playerScreenY, walkPhase, firePulse);
    }
  }

  drawPlayerSpriteFrame(frameX, frameY, frameSize, drawX, drawY, renderSize, tintColor = null, tintAlpha = 0) {
    const ctx = this.ctx;
    if (!tintColor || tintAlpha <= 0) {
      ctx.drawImage(this.playerSpriteSheet, frameX, frameY, frameSize, frameSize, drawX, drawY, renderSize, renderSize);
      return;
    }
    const cache = this._playerTintCanvas || document.createElement("canvas");
    if (cache.width !== frameSize || cache.height !== frameSize) {
      cache.width = frameSize;
      cache.height = frameSize;
    }
    const cctx = cache.getContext("2d");
    cctx.clearRect(0, 0, frameSize, frameSize);
    cctx.drawImage(this.playerSpriteSheet, frameX, frameY, frameSize, frameSize, 0, 0, frameSize, frameSize);
    cctx.globalCompositeOperation = "source-atop";
    cctx.fillStyle = tintColor;
    cctx.globalAlpha = Math.max(0, Math.min(1, tintAlpha));
    cctx.fillRect(0, 0, frameSize, frameSize);
    cctx.globalAlpha = 1;
    cctx.globalCompositeOperation = "source-over";
    this._playerTintCanvas = cache;
    ctx.drawImage(cache, 0, 0, frameSize, frameSize, drawX, drawY, renderSize, renderSize);
  }

  drawPlayerFighterRig(player, screenX, screenY, walkPhase = 0, attackPulse = 0) {
    const ctx = this.ctx;
    const aimAngle = Math.atan2(player.dirY || 0, player.dirX || 1);
    const ax = Math.cos(aimAngle);
    const ay = Math.sin(aimAngle);
    const px = -ay;
    const py = ax;

    const chestX = screenX;
    const chestY = screenY - 8 + Math.sin(walkPhase * Math.PI * 2) * 0.6;
    const shoulderSpread = 4.7;
    const rearShoulderX = chestX - px * shoulderSpread;
    const rearShoulderY = chestY - py * shoulderSpread;
    const frontShoulderX = chestX + px * shoulderSpread;
    const frontShoulderY = chestY + py * shoulderSpread;

    const swing = 1 - Math.max(0, Math.min(1, attackPulse));
    const swordHandX = chestX + ax * (12 + swing * 4.5) + px * 1.8;
    const swordHandY = chestY + ay * (12 + swing * 4.5) + py * 1.8;
    const guardHandX = chestX + ax * (8 + swing * 1.2) - px * 3.8;
    const guardHandY = chestY + ay * (8 + swing * 1.2) - py * 3.8;

    const drawArm = (sx, sy, hx, hy, color, bendSign) => {
      const vx = hx - sx;
      const vy = hy - sy;
      const len = Math.hypot(vx, vy) || 1;
      const nx = -vy / len;
      const ny = vx / len;
      const elbow = 2.3 * bendSign;
      const ex = sx + vx * 0.53 + nx * elbow;
      const ey = sy + vy * 0.53 + ny * elbow;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    };

    drawArm(rearShoulderX, rearShoulderY, guardHandX, guardHandY, "#6f8aa8", -1);
    drawArm(frontShoulderX, frontShoulderY, swordHandX, swordHandY, "#8ca1bd", 1);

    const bladeLen = 15.5;
    const tipX = swordHandX + ax * bladeLen;
    const tipY = swordHandY + ay * bladeLen;
    const crossX = swordHandX - ax * 2.2;
    const crossY = swordHandY - ay * 2.2;
    ctx.strokeStyle = "#d8e3ef";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(crossX, crossY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = "#a08b5f";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(crossX + px * 4.2, crossY + py * 4.2);
    ctx.lineTo(crossX - px * 4.2, crossY - py * 4.2);
    ctx.stroke();
  }

  drawPlayerHealthBar(game, cameraX, cameraY) {
    if (!game.shouldShowPlayerHealthBar || !game.shouldShowPlayerHealthBar()) return;
    const ctx = this.ctx;
    const p = game.player;
    const ratio = p.maxHealth > 0 ? Math.max(0, Math.min(1, p.health / p.maxHealth)) : 0;
    const width = 52;
    const height = 6;
    const x = Math.floor(p.x - cameraX - width / 2);
    const y = Math.floor(p.y - cameraY - 36);

    ctx.fillStyle = "rgba(15, 18, 24, 0.9)";
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = "#2f3a4e";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = ratio > 0.5 ? "#76db8d" : ratio > 0.25 ? "#e1bf63" : "#df6767";
    ctx.fillRect(x, y, width * ratio, height);
  }

  drawFloatingTexts(game, cameraX, cameraY) {
    if (!game.floatingTexts || game.floatingTexts.length === 0) return;
    const ctx = this.ctx;
    for (const ft of game.floatingTexts) {
      const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${ft.size || 14}px Trebuchet MS`;
      ctx.textAlign = "center";
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x - cameraX, ft.y - cameraY);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
  }

  drawVignette(game, cameraX, cameraY) {
    const ctx = this.ctx;
    const x = game.player.x - cameraX;
    const y = game.player.y - cameraY;
    const vignette = ctx.createRadialGradient(x, y, 90, x, y, 420);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMinimap(game, layout) {
    const mapW = game.map[0].length;
    const mapH = game.map.length;
    const miniX = layout.sidebarX + this.sidebarPadding;
    const miniY = layout.topHudH + this.sidebarPadding;
    const miniW = layout.sidebarW - this.sidebarPadding * 2;
    const miniH = Math.min(this.config.minimap.height, 190);
    const scale = Math.min(miniW / mapW, miniH / mapH);
    const drawW = mapW * scale;
    const drawH = mapH * scale;
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(8, 11, 18, 0.88)";
    ctx.fillRect(miniX - 6, miniY - 6, drawW + 12, drawH + 12);
    ctx.strokeStyle = "rgba(126, 139, 171, 0.8)";
    ctx.strokeRect(miniX - 6, miniY - 6, drawW + 12, drawH + 12);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const cacheKey = `${mapW}x${mapH}@${scale.toFixed(4)}`;
    const needRebuild =
      !this._minimapCache ||
      this._minimapCache.key !== cacheKey ||
      now - this._minimapCache.lastBuildAt > 125;
    if (needRebuild) {
      const cacheCanvas = this._minimapCache?.canvas || document.createElement("canvas");
      const cacheW = Math.max(1, Math.ceil(drawW));
      const cacheH = Math.max(1, Math.ceil(drawH));
      if (cacheCanvas.width !== cacheW || cacheCanvas.height !== cacheH) {
        cacheCanvas.width = cacheW;
        cacheCanvas.height = cacheH;
      }
      const cctx = cacheCanvas.getContext("2d");
      cctx.clearRect(0, 0, cacheCanvas.width, cacheCanvas.height);
      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
          if (!game.explored[y][x]) continue;
          const tile = game.map[y][x];
          cctx.fillStyle = tile === "#" ? "#3a4258" : "#9ca7bf";
          cctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }
      this._minimapCache = {
        key: cacheKey,
        canvas: cacheCanvas,
        lastBuildAt: now
      };
    }
    if (this._minimapCache?.canvas) ctx.drawImage(this._minimapCache.canvas, miniX, miniY, drawW, drawH);

    ctx.fillStyle = "#59f3a2";
    ctx.beginPath();
    ctx.arc(miniX + (game.player.x / this.config.map.tile) * scale, miniY + (game.player.y / this.config.map.tile) * scale, Math.max(2, scale * 1.2), 0, Math.PI * 2);
    ctx.fill();

    return miniY + drawH + 6;
  }
}
