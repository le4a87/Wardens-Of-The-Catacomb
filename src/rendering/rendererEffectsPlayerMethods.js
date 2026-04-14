import { hasWarriorCrusaderInvestment, isWarriorRaging } from "../game/warriorTalentTree.js";

export const rendererEffectsPlayerMethods = {
  getPlayerTempHp(entity) {
    if (!entity || typeof entity !== "object") return 0;
    const warriorTemp = Number.isFinite(entity?.warriorRuntime?.tempHp) ? entity.warriorRuntime.tempHp : 0;
    const necromancerTemp = Number.isFinite(entity?.necromancerRuntime?.tempHp) ? entity.necromancerRuntime.tempHp : 0;
    const consumableTemp = Number.isFinite(entity?.consumableRuntime?.tempHp) ? entity.consumableRuntime.tempHp : 0;
    return Math.max(0, warriorTemp + necromancerTemp + consumableTemp);
  },

  getReplicatedPlayerClassSpec(player) {
    const classType = player?.classType;
    return this.config.classes[classType] || this.config.classes.archer;
  },

  drawReplicatedPlayerSprite(player, screenX, screenY, renderSize, frameSize) {
    const prevRenderX = Number.isFinite(player._renderPrevX) ? player._renderPrevX : player.x;
    const prevRenderY = Number.isFinite(player._renderPrevY) ? player._renderPrevY : player.y;
    const movedRenderSq = (player.x - prevRenderX) * (player.x - prevRenderX) + (player.y - prevRenderY) * (player.y - prevRenderY);
    player._renderPrevX = player.x;
    player._renderPrevY = player.y;
    const movingVisual = !!player.moving || movedRenderSq > 0.01;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const lastTs = Number.isFinite(player._renderAnimTs) ? player._renderAnimTs : now;
    const renderDt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
    player._renderAnimTs = now;
    player._renderAnimPhase = Number.isFinite(player._renderAnimPhase) ? player._renderAnimPhase : 0;
    if (movingVisual) player._renderAnimPhase += renderDt * this.config.player.animationSpeed;
    else player._renderAnimPhase = Math.max(0, player._renderAnimPhase - renderDt * this.config.player.animationSpeed * 1.8);
    const animFrame = movingVisual ? Math.floor(player._renderAnimPhase) % this.config.player.spriteFramesPerDir : 0;
    const frameX = animFrame * frameSize;
    const frameY = (Number.isFinite(player.facing) ? player.facing : 0) * frameSize;
    const drawX = screenX - renderSize / 2;
    const drawY = screenY - renderSize * 0.56;
    const foxstepActive = (player?.rangerRuntime?.foxstepActiveTimer || 0) > 0;
    const crusaderInvested = hasWarriorCrusaderInvestment(player);
    const warriorRaging = isWarriorRaging(player);
    this.drawPlayerSpriteFrame(
      frameX,
      frameY,
      frameSize,
      drawX,
      drawY,
      renderSize,
      warriorRaging ? (crusaderInvested ? "#f5cf6f" : "#ff2a2a") : null,
      warriorRaging ? (crusaderInvested ? 0.78 : 0.5) : 0,
      foxstepActive ? "saturate(50%) brightness(0.95)" : (warriorRaging && crusaderInvested ? "brightness(1.08) contrast(1.05)" : "none")
    );
    return { movingVisual, walkPhase: movingVisual ? player._renderAnimPhase * 0.1 : 0 };
  },

  drawReplicatedPlayerRig(player, classSpec, screenX, screenY, walkPhase = 0) {
    const usesRanged = !!classSpec?.usesRanged;
    const crusaderInvested = hasWarriorCrusaderInvestment(player);
    if (player.classType === "necromancer") {
      this.drawPlayerNecromancerRig(player, screenX, screenY, walkPhase, 0);
      return;
    }
    if (!usesRanged) {
      if ((player?.warriorRageActiveTimer || 0) > 0 && crusaderInvested) this.ctx.save();
      if ((player?.warriorRageActiveTimer || 0) > 0 && crusaderInvested) this.ctx.filter = "brightness(1.08) saturate(1.15)";
      this.drawPlayerFighterRig(player, screenX, screenY, walkPhase, 0);
      if ((player?.warriorRageActiveTimer || 0) > 0 && crusaderInvested) this.ctx.restore();
      return;
    }
    this.drawPlayerAimingRig(player, screenX, screenY, walkPhase, 0);
  },

  drawRemotePlayerHandle(player, screenX, screenY) {
    const ctx = this.ctx;
    const handle = typeof player?.handle === "string" && player.handle.trim() ? player.handle.trim() : "Player";
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 13px Trebuchet MS";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(10, 12, 18, 0.9)";
    ctx.fillStyle = typeof player?.color === "string" && player.color.trim() ? player.color.trim() : "#58a6ff";
    ctx.strokeText(handle, screenX, screenY + 24);
    ctx.fillText(handle, screenX, screenY + 24);
    ctx.restore();
    ctx.textAlign = "left";
  },

  drawRemotePlayers(game, cameraX, cameraY) {
    const remotePlayers = Array.isArray(game.remotePlayers) ? game.remotePlayers : [];
    if (remotePlayers.length === 0) return;
    const frameSize = this.config.player.spriteFrame;
    const renderSize = this.config.player.spriteRenderSize || frameSize;
    for (const player of remotePlayers) {
      if (!player || player.alive === false) continue;
      const screenX = player.x - cameraX;
      const screenY = player.y - cameraY;
      const classSpec = this.getReplicatedPlayerClassSpec(player);
      const { walkPhase } = this.drawReplicatedPlayerSprite(player, screenX, screenY, renderSize, frameSize);
      this.drawReplicatedPlayerRig(player, classSpec, screenX, screenY, walkPhase);
      this.drawRemotePlayerHandle(player, screenX, screenY);
    }
  },

  drawPlayer(game, cameraX, cameraY) {
    const p = game.player;
    if (!p) return;
    const isDead = Number.isFinite(p.health) ? p.health <= 0 : p.alive === false;
    if (isDead && game?.networkEnabled && !game?.gameOver) return;
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
    const animFrame = movingVisual ? Math.floor(p._renderAnimPhase) % this.config.player.spriteFramesPerDir : 0;
    const frameX = animFrame * frameSize;
    const frameY = p.facing * frameSize;
    const drawX = playerScreenX - renderSize / 2;
    const drawY = playerScreenY - renderSize * 0.56;
    const foxstepActive = (game.rangerRuntime?.foxstepActiveTimer || 0) > 0;
    let tintColor = null;
    let tintAlpha = 0;
    if (game.isNecromancerClass && game.isNecromancerClass()) {
      tintColor = "#a6a8ad";
      tintAlpha = 0.5;
    } else if (!game.classSpec?.usesRanged) {
      const crusaderInvested = hasWarriorCrusaderInvestment(game);
      if (isWarriorRaging(game)) {
        tintColor = crusaderInvested ? "#f5cf6f" : "#ff2a2a";
        tintAlpha = crusaderInvested ? 0.78 : 0.5;
      } else if ((game.warriorRageCooldownTimer || 0) > 0 && game.isWarriorRageUnlocked && game.isWarriorRageUnlocked()) {
        tintColor = crusaderInvested ? "#f2dfad" : "#ff9b9b";
        tintAlpha = 0.32;
      }
    }
    this.drawPlayerSpriteFrame(
      frameX,
      frameY,
      frameSize,
      drawX,
      drawY,
      renderSize,
      tintColor,
      tintAlpha,
      foxstepActive ? "saturate(50%) brightness(0.95)" : (!game.classSpec?.usesRanged && hasWarriorCrusaderInvestment(game) && isWarriorRaging(game) ? "brightness(1.08) contrast(1.05)" : "none")
    );
    const baseCd = game.getPlayerFireCooldown ? game.getPlayerFireCooldown() : this.config.player.baseFireCooldown;
    const firePulse = baseCd > 0 ? Math.max(0, Math.min(1, p.fireCooldown / baseCd)) : 0;
    const walkPhase = movingVisual ? p._renderAnimPhase * 0.1 : 0;
    if (foxstepActive || (!game.classSpec?.usesRanged && hasWarriorCrusaderInvestment(game) && isWarriorRaging(game))) this.ctx.save();
    if (foxstepActive) this.ctx.filter = "saturate(50%) brightness(0.95)";
    else if (!game.classSpec?.usesRanged && hasWarriorCrusaderInvestment(game) && isWarriorRaging(game)) this.ctx.filter = "brightness(1.08) saturate(1.15)";
    if (game.isNecromancerClass && game.isNecromancerClass()) {
      this.drawPlayerNecromancerRig(p, playerScreenX, playerScreenY, walkPhase, firePulse);
    } else if (game.classSpec && !game.classSpec.usesRanged) {
      this.drawPlayerFighterRig(p, playerScreenX, playerScreenY, walkPhase, firePulse);
    } else {
      this.drawPlayerAimingRig(p, playerScreenX, playerScreenY, walkPhase, firePulse);
    }
    if (foxstepActive || (!game.classSpec?.usesRanged && hasWarriorCrusaderInvestment(game) && isWarriorRaging(game))) this.ctx.restore();
  },

  drawPlayerSpriteFrame(frameX, frameY, frameSize, drawX, drawY, renderSize, tintColor = null, tintAlpha = 0, filter = "none") {
    const ctx = this.ctx;
    if (!tintColor || tintAlpha <= 0) {
      ctx.save();
      ctx.filter = filter || "none";
      ctx.drawImage(this.playerSpriteSheet, frameX, frameY, frameSize, frameSize, drawX, drawY, renderSize, renderSize);
      ctx.restore();
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
    ctx.save();
    ctx.filter = filter || "none";
    ctx.drawImage(cache, 0, 0, frameSize, frameSize, drawX, drawY, renderSize, renderSize);
    ctx.restore();
  },

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
  },

  drawPlayerNecromancerRig(player, screenX, screenY, walkPhase = 0, firePulse = 0) {
    const ctx = this.ctx;
    const aimAngle = Math.atan2(player.dirY || 0, player.dirX || 1);
    const ax = Math.cos(aimAngle);
    const ay = Math.sin(aimAngle);
    const px = -ay;
    const py = ax;
    const chestX = screenX;
    const chestY = screenY - 8 + Math.sin(walkPhase * Math.PI * 2) * 0.75;
    const recoil = Math.max(0, Math.min(1, firePulse));
    const rearHandX = chestX + ax * (5 - recoil * 2) - px * 2;
    const rearHandY = chestY + ay * (5 - recoil * 2) - py * 2;
    const frontHandX = chestX + ax * 10 + px * 1.5;
    const frontHandY = chestY + ay * 10 + py * 1.5;
    const staffBaseX = chestX - ax * 10;
    const staffBaseY = chestY - ay * 10;
    const staffTipX = chestX + ax * 20;
    const staffTipY = chestY + ay * 20;

    ctx.strokeStyle = "#6f737b";
    ctx.lineWidth = 3.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(chestX - px * 3.6, chestY - py * 3.6);
    ctx.lineTo(rearHandX, rearHandY);
    ctx.moveTo(chestX + px * 3.6, chestY + py * 3.6);
    ctx.lineTo(frontHandX, frontHandY);
    ctx.stroke();

    ctx.strokeStyle = "#111317";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(staffBaseX, staffBaseY);
    ctx.lineTo(staffTipX, staffTipY);
    ctx.stroke();

    ctx.fillStyle = "#23262b";
    ctx.beginPath();
    ctx.arc(staffTipX, staffTipY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPlayerHealthBar(game, cameraX, cameraY) {
    const p = game.player;
    const isDead = Number.isFinite(p?.health) ? p.health <= 0 : p?.alive === false;
    if (isDead && game?.networkEnabled && !game?.gameOver) return;
    if (!game.shouldShowPlayerHealthBar || !game.shouldShowPlayerHealthBar()) return;
    const ctx = this.ctx;
    const ratio = p.maxHealth > 0 ? Math.max(0, Math.min(1, p.health / p.maxHealth)) : 0;
    const tempHp = this.getPlayerTempHp(p);
    const tempRatio = p.maxHealth > 0 ? Math.max(0, Math.min(0.2, tempHp / p.maxHealth)) : 0;
    const width = 52;
    const totalWidth = Math.round(width * 1.2);
    const height = 6;
    const x = Math.floor(p.x - cameraX - totalWidth / 2);
    const y = Math.floor(p.y - cameraY - 36);

    ctx.fillStyle = "rgba(15, 18, 24, 0.9)";
    ctx.fillRect(x - 1, y - 1, totalWidth + 2, height + 2);
    ctx.fillStyle = "#2f3a4e";
    ctx.fillRect(x, y, totalWidth, height);
    ctx.fillStyle = "rgba(85, 122, 163, 0.3)";
    ctx.fillRect(x + width, y, totalWidth - width, height);
    ctx.fillStyle = ratio > 0.5 ? "#76db8d" : ratio > 0.25 ? "#e1bf63" : "#df6767";
    ctx.fillRect(x, y, width * ratio, height);
    if (tempRatio > 0) {
      const tempStart = x + width * ratio;
      const tempWidth = Math.min(width * tempRatio, totalWidth - width * ratio);
      ctx.fillStyle = "#b8ecff";
      ctx.fillRect(tempStart, y, tempWidth, height);
      ctx.fillStyle = "rgba(184, 236, 255, 0.22)";
      ctx.fillRect(tempStart, y - 1, tempWidth, 2);
    }
    ctx.strokeStyle = "rgba(175, 193, 222, 0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, totalWidth - 1, height - 1);
    ctx.strokeStyle = "rgba(114, 137, 171, 0.55)";
    ctx.beginPath();
    ctx.moveTo(x + width + 0.5, y + 0.5);
    ctx.lineTo(x + width + 0.5, y + height - 0.5);
    ctx.stroke();
  },

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
  },

  drawVignette(game, cameraX, cameraY) {
    const ctx = this.ctx;
    const x = game.player.x - cameraX;
    const y = game.player.y - cameraY;
    const vignette = ctx.createRadialGradient(x, y, 90, x, y, 420);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },

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
    const needRebuild = !this._minimapCache || this._minimapCache.key !== cacheKey || now - this._minimapCache.lastBuildAt > 125;
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

    for (const player of Array.isArray(game.remotePlayers) ? game.remotePlayers : []) {
      if (!player || player.alive === false) continue;
      ctx.fillStyle = typeof player.color === "string" && player.color.trim() ? player.color.trim() : "#58a6ff";
      ctx.beginPath();
      ctx.arc(miniX + (player.x / this.config.map.tile) * scale, miniY + (player.y / this.config.map.tile) * scale, Math.max(2, scale * 1.15), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#59f3a2";
    ctx.beginPath();
    ctx.arc(miniX + (game.player.x / this.config.map.tile) * scale, miniY + (game.player.y / this.config.map.tile) * scale, Math.max(2, scale * 1.2), 0, Math.PI * 2);
    ctx.fill();

    const activeBoss = typeof game.getActiveFloorBossEnemy === "function" ? game.getActiveFloorBossEnemy() : null;
    if (activeBoss) {
      const blink = 0.5 + 0.5 * Math.sin((game.time || 0) * 7.5);
      const bossX = miniX + (activeBoss.x / this.config.map.tile) * scale;
      const bossY = miniY + (activeBoss.y / this.config.map.tile) * scale;
      const bossRadius = Math.max(2.5, scale * 1.45 + blink * 0.6);
      ctx.save();
      ctx.globalAlpha = 0.55 + blink * 0.4;
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.arc(bossX, bossY, bossRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 214, 214, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bossX, bossY, bossRadius + 1.3 + blink * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    return miniY + drawH + 6;
  }
};
