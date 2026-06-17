import { isWarriorRaging } from "../game/warriorTalentTree.js";
import { getMageDirectionIndexFromVector } from "./mageSpriteSheet.js";
import { getMagePathPresentation, getMageVisualSpec } from "./mageVisualPresentation.js";
import { getRangerVisualSpec } from "./rangerVisualPresentation.js";
import { drawRangerStatusEffects } from "./rangerStatusEffects.js";
import {
  getWarriorPathPresentation,
  getWarriorVisualSpec
} from "./warriorVisualPresentation.js";
import { drawWarriorBattleCryAura } from "./warriorBattleCryAura.js";
import { drawMinimapWorldMarkers } from "./minimapWorldMarkers.js";

import { rendererEffectsFighterRigMethods } from "./rendererEffectsFighterRigMethods.js";
import { rendererEffectsMageStaffMethods } from "./rendererEffectsMageStaffMethods.js";

function isWarriorEntity(entity) {
  return entity?.classType === "fighter" || entity?.classType === "warrior";
}

export const rendererEffectsPlayerMethods = {
  getRangerVisualSpec(entityOrGame) {
    return getRangerVisualSpec(entityOrGame);
  },

  getMagePathPresentation(entityOrGame) {
    return getMagePathPresentation(entityOrGame);
  },

  getMageVisualSpec(entityOrGame) {
    return getMageVisualSpec(entityOrGame);
  },

  getPlayerTempHp(entity) {
    if (!entity || typeof entity !== "object") return 0;
    const warriorTemp = Number.isFinite(entity?.warriorRuntime?.tempHp) ? entity.warriorRuntime.tempHp : 0;
    const necromancerTemp = Number.isFinite(entity?.necromancerRuntime?.tempHp) ? entity.necromancerRuntime.tempHp : 0;
    const consumableTemp = Number.isFinite(entity?.consumableRuntime?.tempHp) ? entity.consumableRuntime.tempHp : 0;
    return Math.max(0, warriorTemp + necromancerTemp + consumableTemp);
  },

  getReplicatedPlayerClassSpec(player) {
    const classType = player?.classType;
    if (classType === "warrior") return this.config.classes.fighter;
    return this.config.classes[classType] || this.config.classes.archer;
  },

  getReplicatedPlayerFirePulse(player) {
    const fireCooldown = Number.isFinite(player?.fireCooldown) ? player.fireCooldown : 0;
    const baseCd = Number.isFinite(this.config?.player?.baseFireCooldown) ? this.config.player.baseFireCooldown : 0;
    return baseCd > 0 ? Math.max(0, Math.min(1, fireCooldown / baseCd)) : 0;
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
    const runtime = player?.necromancerRuntime || {};
    if (player.classType === "necromancer" && (runtime.mimicTimer || 0) > 0 && typeof this.drawMimic === "function") {
      const tile = this.config?.map?.tile || 32;
      this.drawMimic({
        size: Math.max(24, (player.size || 22) * 1.35),
        tongueLength: (runtime.mimicTongueTimer || 0) > 0 ? tile * 1.5 : 0,
        tongueDirX: runtime.mimicTongueDirX || player.dirX || 1,
        tongueDirY: runtime.mimicTongueDirY || player.dirY || 0
      }, screenX, screenY);
      return { movingVisual, walkPhase: movingVisual ? player._renderAnimPhase * 0.1 : 0, skipRig: true };
    }
    const frameX = animFrame * frameSize;
    const mageSpec = player?.classType === "necromancer" ? this.getMageVisualSpec(player) : null;
    const frameY = (mageSpec ? getMageDirectionIndexFromVector(player.dirX || 1, player.dirY || 0) : (Number.isFinite(player.facing) ? player.facing : 0)) * frameSize;
    const drawX = screenX - renderSize / 2;
    const rangerSpec = player?.classType === "archer" ? this.getRangerVisualSpec(player) : null;
    const warriorSpec = isWarriorEntity(player) ? getWarriorVisualSpec(player) : null;
    const drawY = screenY - renderSize * (warriorSpec ? 0.75 : 0.56);
    const shadowVeilActive = (player?.rangerRuntime?.shadowVeilTimer || 0) > 0;
    const warriorRaging = isWarriorRaging(player);
    const doctrineVisual = getWarriorPathPresentation(player);
    const rangerVisual = rangerSpec?.pathPresentation || null;
    const warriorVisual = warriorSpec?.pathPresentation || null;
    const mageVisual = player?.classType === "necromancer" ? this.getMagePathPresentation(player) : null;
    if (warriorSpec) drawWarriorBattleCryAura(this.ctx, player, screenX, screenY, this.config, player.animTime || 0);
    const firePulse = player.classType === "necromancer" ? this.getReplicatedPlayerFirePulse(player) : 0;
    if (mageSpec) this.drawPlayerMageStaffRig(player, screenX, screenY, firePulse, "under");
    this.drawPlayerSpriteFrame(
      frameX,
      frameY,
      frameSize,
      drawX,
      drawY,
      renderSize,
      warriorRaging ? doctrineVisual.tint : warriorVisual?.tint || rangerVisual?.tint || mageVisual?.tint || null,
      warriorRaging ? doctrineVisual.alpha : warriorVisual?.alpha || rangerVisual?.alpha || mageVisual?.alpha || 0,
      shadowVeilActive ? "saturate(45%) brightness(0.9) opacity(0.68)" : (warriorRaging ? doctrineVisual.filter : warriorVisual?.filter || rangerVisual?.filter || mageVisual?.filter || "none"),
      warriorSpec ? this.getPlayerSpriteSheet(warriorSpec) : rangerSpec ? this.getPlayerSpriteSheet(rangerSpec) : mageSpec ? this.getPlayerSpriteSheet(mageSpec) : null
    );
    if (mageSpec) this.drawPlayerMageStaffRig(player, screenX, screenY, firePulse, "over");
    if (rangerSpec) drawRangerStatusEffects(this.ctx, player, screenX, screenY, 0);
    return { movingVisual, walkPhase: movingVisual ? player._renderAnimPhase * 0.1 : 0 };
  },

  drawReplicatedPlayerRig(player, classSpec, screenX, screenY, walkPhase = 0) {
    const usesRanged = !!classSpec?.usesRanged;
    const doctrineVisual = getWarriorPathPresentation(player);
    const firePulse = this.getReplicatedPlayerFirePulse(player);
    if (player.classType === "necromancer") {
      return;
    }
    if (!usesRanged) {
      if ((player?.warriorRageActiveTimer || 0) > 0) this.ctx.save();
      if ((player?.warriorRageActiveTimer || 0) > 0) this.ctx.filter = doctrineVisual.filter;
      this.drawPlayerFighterRig(player, screenX, screenY, walkPhase, firePulse, getWarriorVisualSpec(player));
      if ((player?.warriorRageActiveTimer || 0) > 0) this.ctx.restore();
      return;
    }
    this.drawPlayerAimingRig(player, screenX, screenY, walkPhase, firePulse, this.getRangerVisualSpec(player));
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
      const { walkPhase, skipRig } = this.drawReplicatedPlayerSprite(player, screenX, screenY, renderSize, frameSize);
      if (!skipRig) this.drawReplicatedPlayerRig(player, classSpec, screenX, screenY, walkPhase);
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
    if (game.isNecromancerClass && game.isNecromancerClass() && (game.necromancerRuntime?.mimicTimer || 0) > 0 && typeof this.drawMimic === "function") {
      const tile = game.config?.map?.tile || 32;
      this.drawMimic({
        size: Math.max(24, (p.size || 22) * 1.35),
        tongueLength: (game.necromancerRuntime?.mimicTongueTimer || 0) > 0 ? tile * 1.5 : 0,
        tongueDirX: game.necromancerRuntime?.mimicTongueDirX || p.dirX || 1,
        tongueDirY: game.necromancerRuntime?.mimicTongueDirY || p.dirY || 0
      }, playerScreenX, playerScreenY);
      return;
    }
    const animFrame = movingVisual ? Math.floor(p._renderAnimPhase) % this.config.player.spriteFramesPerDir : 0;
    const frameX = animFrame * frameSize;
    const mageVisualSpec = game.isNecromancerClass && game.isNecromancerClass() ? this.getMageVisualSpec(game) : null;
    const frameY = (mageVisualSpec ? getMageDirectionIndexFromVector(p.dirX || 1, p.dirY || 0) : p.facing) * frameSize;
    const drawX = playerScreenX - renderSize / 2;
    const isWarriorPlayer = !game.classSpec?.usesRanged;
    const drawY = playerScreenY - renderSize * (isWarriorPlayer ? 0.75 : 0.56);
    const shadowVeilActive = (game.rangerRuntime?.shadowVeilTimer || 0) > 0;
    const archerVisualSpec = game.isArcherClass && game.isArcherClass() ? this.getRangerVisualSpec(game) : null;
    const archerPathVisual = archerVisualSpec?.pathPresentation || null;
    let tintColor = null;
    let tintAlpha = 0;
    if (game.isNecromancerClass && game.isNecromancerClass()) {
      const mageVisual = this.getMagePathPresentation(game);
      tintColor = mageVisual.tint;
      tintAlpha = mageVisual.alpha;
    } else if (archerPathVisual) {
      tintColor = archerPathVisual.tint;
      tintAlpha = archerPathVisual.alpha;
    } else if (isWarriorPlayer) {
      const doctrineVisual = getWarriorPathPresentation(game);
      const warriorVisualSpec = getWarriorVisualSpec(game);
      const warriorPathVisual = warriorVisualSpec.pathPresentation;
      if (isWarriorRaging(game)) {
        tintColor = doctrineVisual.tint;
        tintAlpha = doctrineVisual.alpha;
      } else if ((game.warriorRageCooldownTimer || 0) > 0 && game.isWarriorRageUnlocked && game.isWarriorRageUnlocked()) {
        tintColor = doctrineVisual.tint === "#d6b487" ? "#e6d2b5" : doctrineVisual.tint === "#9d7bff" ? "#c0b1ff" : doctrineVisual.tint === "#f5cf6f" ? "#f2dfad" : "#ff9b9b";
        tintAlpha = 0.32;
      } else {
        tintColor = warriorPathVisual.tint;
        tintAlpha = warriorPathVisual.alpha;
      }
    }
    if (isWarriorPlayer) drawWarriorBattleCryAura(this.ctx, game, playerScreenX, playerScreenY, this.config, game.time || 0);
    const baseCd = game.getPlayerFireCooldown ? game.getPlayerFireCooldown() : this.config.player.baseFireCooldown;
    const firePulse = baseCd > 0 ? Math.max(0, Math.min(1, p.fireCooldown / baseCd)) : 0;
    if (mageVisualSpec) this.drawPlayerMageStaffRig(p, playerScreenX, playerScreenY, firePulse, "under");
    this.drawPlayerSpriteFrame(
      frameX,
      frameY,
      frameSize,
      drawX,
      drawY,
      renderSize,
      tintColor,
      tintAlpha,
      shadowVeilActive ? "saturate(45%) brightness(0.9) opacity(0.68)" : (isWarriorPlayer ? getWarriorPathPresentation(game).filter : archerPathVisual?.filter || (game.isNecromancerClass && game.isNecromancerClass() ? this.getMagePathPresentation(game).filter : "none")),
      isWarriorPlayer ? this.getPlayerSpriteSheet(getWarriorVisualSpec(game)) : archerVisualSpec ? this.getPlayerSpriteSheet(archerVisualSpec) : mageVisualSpec ? this.getPlayerSpriteSheet(mageVisualSpec) : null
    );
    if (mageVisualSpec) this.drawPlayerMageStaffRig(p, playerScreenX, playerScreenY, firePulse, "over");
    if (archerVisualSpec) drawRangerStatusEffects(this.ctx, game, playerScreenX, playerScreenY, game.time || 0);
    const walkPhase = movingVisual ? p._renderAnimPhase * 0.1 : 0;
    const magePathVisual = game.isNecromancerClass && game.isNecromancerClass() ? this.getMagePathPresentation(game) : null;
    const warriorPathVisual = isWarriorPlayer ? getWarriorPathPresentation(game) : null;
    const hasArcherPathFilter = !!archerPathVisual?.filter && archerPathVisual.filter !== "none";
    const hasMagePathFilter = !!magePathVisual?.filter && magePathVisual.filter !== "none";
    const hasWarriorPathFilter = !!warriorPathVisual?.filter && warriorPathVisual.filter !== "none";
    if (shadowVeilActive || hasArcherPathFilter || hasMagePathFilter || hasWarriorPathFilter) this.ctx.save();
    if (shadowVeilActive) this.ctx.filter = "saturate(45%) brightness(0.9) opacity(0.68)";
    else if (hasArcherPathFilter) this.ctx.filter = archerPathVisual.filter;
    else if (hasMagePathFilter) this.ctx.filter = magePathVisual.filter;
    else if (hasWarriorPathFilter) this.ctx.filter = warriorPathVisual.filter;
    if (game.isNecromancerClass && game.isNecromancerClass()) {
      if (shadowVeilActive || hasArcherPathFilter || hasMagePathFilter || hasWarriorPathFilter) this.ctx.restore();
      return;
    } else if (game.classSpec && !game.classSpec.usesRanged) {
      this.drawPlayerFighterRig(p, playerScreenX, playerScreenY, walkPhase, firePulse, getWarriorVisualSpec(game));
    } else {
      this.drawPlayerAimingRig(p, playerScreenX, playerScreenY, walkPhase, firePulse, this.getRangerVisualSpec(game));
    }
    if (shadowVeilActive || hasArcherPathFilter || hasMagePathFilter || hasWarriorPathFilter) this.ctx.restore();
  },

  drawPlayerSpriteFrame(frameX, frameY, frameSize, drawX, drawY, renderSize, tintColor = null, tintAlpha = 0, filter = "none", spriteSheet = null) {
    const ctx = this.ctx;
    const sourceSheet = spriteSheet || this.playerSpriteSheet;
    if (!tintColor || tintAlpha <= 0) {
      ctx.save();
      ctx.filter = filter || "none";
      ctx.drawImage(sourceSheet, frameX, frameY, frameSize, frameSize, drawX, drawY, renderSize, renderSize);
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
    cctx.drawImage(sourceSheet, frameX, frameY, frameSize, frameSize, 0, 0, frameSize, frameSize);
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

  ...rendererEffectsFighterRigMethods,

  ...rendererEffectsMageStaffMethods,

  drawPlayerHealthBar(game, cameraX, cameraY) {
    const p = game.player;
    const isDead = Number.isFinite(p?.health) ? p.health <= 0 : p?.alive === false;
    if (isDead && game?.networkEnabled && !game?.gameOver) return;
    if (!game.shouldShowPlayerHealthBar || !game.shouldShowPlayerHealthBar()) return;
    const ctx = this.ctx;
    const ratio = p.maxHealth > 0 ? Math.max(0, Math.min(1, p.health / p.maxHealth)) : 0;
    const tempHp = this.getPlayerTempHp(p);
    const tempRatio = p.maxHealth > 0 ? Math.max(0, Math.min(0.2, tempHp / p.maxHealth)) : 0;
    const width = 29;
    const totalWidth = tempRatio > 0 ? Math.round(width * (1 + tempRatio)) : width;
    const height = 4;
    const x = Math.floor(p.x - cameraX - totalWidth / 2);
    const y = Math.floor(p.y - cameraY - 36);

    ctx.fillStyle = "rgba(15, 18, 24, 0.9)";
    ctx.fillRect(x - 1, y - 1, totalWidth + 2, height + 2);
    ctx.fillStyle = "#2f3a4e";
    ctx.fillRect(x, y, totalWidth, height);
    if (tempRatio > 0) {
      ctx.fillStyle = "rgba(85, 122, 163, 0.3)";
      ctx.fillRect(x + width, y, totalWidth - width, height);
    }
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
    if (tempRatio > 0) {
      ctx.strokeStyle = "rgba(114, 137, 171, 0.55)";
      ctx.beginPath();
      ctx.moveTo(x + width + 0.5, y + 0.5);
      ctx.lineTo(x + width + 0.5, y + height - 0.5);
      ctx.stroke();
    }
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

  drawMinimap(game, layout, panelY = null) {
    const mapW = game.map[0].length;
    const mapH = game.map.length;
    const configuredW = Number.isFinite(this.config?.minimap?.width) ? this.config.minimap.width : 180;
    const miniW = layout.isAndroid ? 176 : Math.min(240, Math.max(220, configuredW));
    const miniH = layout.isAndroid ? 126 : Math.min(this.config.minimap.height, 190);
    const miniX = layout.playW - miniW - (layout.isAndroid ? 12 : 16);
    const defaultY = layout.topHudH + this.sidebarPadding;
    const miniY = Number.isFinite(panelY) ? Math.max(defaultY, Math.floor(panelY)) : defaultY;
    const scale = Math.min(miniW / mapW, miniH / mapH);
    const drawW = mapW * scale;
    const drawH = mapH * scale;
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "rgba(8, 11, 18, 0.88)";
    ctx.fillRect(miniX - 6, miniY - 6, miniW + 12, miniH + 12);
    ctx.strokeStyle = "rgba(126, 139, 171, 0.8)";
    ctx.strokeRect(miniX - 6, miniY - 6, miniW + 12, miniH + 12);
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

    for (const drop of game.drops || []) {
      if (!drop || drop.life <= 0 || (drop.type !== "health" && drop.type !== "mushroom" && drop.type !== "owl_item")) continue;
      ctx.fillStyle = drop.type === "health" ? "#ff3f3f" : drop.type === "owl_item" ? "#b9793d" : "#ff6a52";
      ctx.beginPath();
      ctx.arc(miniX + (drop.x / this.config.map.tile) * scale, miniY + (drop.y / this.config.map.tile) * scale, Math.max(1.6, scale * 0.95), 0, Math.PI * 2);
      ctx.fill();
    }

    drawMinimapWorldMarkers(this, game, miniX, miniY, scale);

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

    ctx.restore();
    return miniY + miniH + 6;
  }
};
