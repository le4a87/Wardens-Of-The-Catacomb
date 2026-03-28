import { RendererRuntimeBase } from "./RendererRuntimeBase.js";
import { runtimeSceneDrawMethods } from "./runtimeSceneDrawMethods.js";
import { getNetworkDeathRulesLabel } from "../net/networkDeathRules.js";

function drawMultiplayerResultsOverlay(ctx, game, canvas) {
  const results = game?.networkFinalResults && typeof game.networkFinalResults === "object" ? game.networkFinalResults : null;
  if (!results) return false;
  ctx.save();
  ctx.textAlign = "left";
  const roster = Array.isArray(results.players) ? results.players : [];
  const localHandle = typeof game.playerHandle === "string" && game.playerHandle.trim() ? game.playerHandle.trim() : "Player";
  const localEntry = roster.find((player) => player && player.handle === localHandle) || null;
  const panelW = Math.min(760, canvas.width - 80);
  const rowH = 30;
  const panelH = Math.min(canvas.height - 120, 268 + Math.min(6, roster.length) * rowH);
  const panelX = (canvas.width - panelW) * 0.5;
  const panelY = Math.max(84, (canvas.height - panelH) * 0.5 + 42);
  const rosterRows = roster.slice(0, 6);

  ctx.fillStyle = "rgba(9, 13, 20, 0.96)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "rgba(143, 159, 194, 0.62)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#f3f0e8";
  ctx.font = "bold 24px Trebuchet MS";
  ctx.fillText("Team Summary", panelX + 20, panelY + 30);
  ctx.fillStyle = "#b8c4dc";
  ctx.font = "14px Trebuchet MS";
  ctx.fillText(`${results.teamOutcome || "Defeat"} • ${roster.length} participant${roster.length === 1 ? "" : "s"}`, panelX + 20, panelY + 52);
  const rulesLabel = getNetworkDeathRulesLabel(game?.networkDeathRulesMode);
  ctx.fillStyle = "rgba(80, 98, 132, 0.82)";
  ctx.fillRect(panelX + panelW - 168, panelY + 18, 148, 28);
  ctx.strokeStyle = "rgba(154, 176, 214, 0.56)";
  ctx.strokeRect(panelX + panelW - 168, panelY + 18, 148, 28);
  ctx.fillStyle = "#e7edf8";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(`Rules: ${rulesLabel}`, panelX + panelW - 94, panelY + 37);
  ctx.textAlign = "left";

  const selfText = localEntry
    ? `You: Lvl ${localEntry.level || 1} • ${localEntry.outcome || "Dead"} • ${localEntry.kills || 0} kills • ${Math.round(localEntry.damageDealt || 0)} dmg`
    : `You: Lvl ${game.level || 1} • ${game.player?.health > 0 ? "Alive" : "Dead"} • ${game.runStats?.totalKills || 0} kills • ${Math.round(game.runStats?.damageDealt || 0)} dmg`;
  ctx.fillStyle = "#dce5f7";
  ctx.fillText(selfText, panelX + 20, panelY + 74);

  const headerY = panelY + 104;
  ctx.fillStyle = "#8fa5cb";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.fillText("Player", panelX + 20, headerY);
  ctx.fillText("Level", panelX + 280, headerY);
  ctx.fillText("Outcome", panelX + 352, headerY);
  ctx.fillText("Kills", panelX + 476, headerY);
  ctx.fillText("Damage", panelX + 548, headerY);

  let rowY = headerY + 20;
  for (const player of rosterRows) {
    const accent = typeof player?.color === "string" && player.color ? player.color : "#5bb3ff";
    ctx.fillStyle = "rgba(18, 24, 35, 0.92)";
    ctx.fillRect(panelX + 14, rowY - 15, panelW - 28, rowH);
    ctx.fillStyle = accent;
    ctx.fillRect(panelX + 14, rowY - 15, 4, rowH);
    ctx.fillStyle = accent;
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(player?.handle || "Player", panelX + 24, rowY + 4);
    ctx.fillStyle = "#b8c4dc";
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(player?.classLabel || player?.classType || "Unknown", panelX + 146, rowY + 4);
    ctx.fillText(`${player?.level || 1}`, panelX + 280, rowY + 4);
    ctx.fillText(player?.outcome || "Dead", panelX + 352, rowY + 4);
    ctx.fillText(`${player?.kills || 0}`, panelX + 476, rowY + 4);
    ctx.fillText(`${Math.round(player?.damageDealt || 0)}`, panelX + 548, rowY + 4);
    rowY += rowH;
  }

  const remaining = Math.max(
    0,
    (Number.isFinite(game.deathTransitionDuration) ? game.deathTransitionDuration : 0) -
      (Number.isFinite(game.deathTransition?.elapsed) ? game.deathTransition.elapsed : 0)
  );
  ctx.fillStyle = "#d3dbeb";
  ctx.font = "13px Trebuchet MS";
  ctx.fillText(`Returning to lobby in ${Math.ceil(remaining)}s`, panelX + 20, panelY + panelH - 18);
  ctx.restore();
  return true;
}

export class RendererRuntimeScene extends RendererRuntimeBase {
  draw(game) {
    const ctx = this.ctx;
    const camera = game.getCamera();
    const cameraX = camera.x;
    const cameraY = camera.y;
    const biomePalette = typeof game.getBiomeAppearance === "function" ? game.getBiomeAppearance() : null;
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
    game.uiRects.skillWarriorExecuteNode = null;
    game.uiRects.skillUndeadMasteryNode = null;
    game.uiRects.skillDeathBoltNode = null;
    game.uiRects.skillExplodingDeathNode = null;
    game.uiRects.statsButton = null;
    game.uiRects.statsClose = null;
    game.uiRects.statsRunTab = null;
    game.uiRects.statsCharacterTab = null;
    game.uiRects.gameOverStatsButton = null;
    game.uiRects.hudAbilityWidget = null;

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
    if (game.portal?.active) this.drawExitPortal(game.portal, game.portal.x - cameraX, game.portal.y - cameraY, game.time);
    if (game.floorBoss?.variant === "leprechaun" && Number.isFinite(game.floorBoss?.potX) && Number.isFinite(game.floorBoss?.potY)) {
      this.drawLeprechaunPot(game.floorBoss.potX - cameraX, game.floorBoss.potY - cameraY, game.time);
    }

    for (const stand of game.armorStands) {
      if (stand.animated && stand.activated) continue;
      this.drawArmorStand(game, stand, stand.x - cameraX, stand.y - cameraY);
    }
    for (const trap of game.wallTraps || []) {
      if (!trap.spotted) continue;
      this.drawWallTrap(trap, trap.x - cameraX, trap.y - cameraY, biomePalette);
    }
    for (const br of game.breakables || []) this.drawBreakable(game, br, br.x - cameraX, br.y - cameraY);

    for (const enemy of game.enemies) {
      if (enemy.type === "goblin") this.drawTreasureGoblin(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "armor") this.drawAnimatedArmor(game, enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "mummy") this.drawMummy(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "prisoner") this.drawPrisoner(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "rat_archer") this.drawRatArcher(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "skeleton_warrior") this.drawSkeletonWarrior(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "sonya") this.drawSonyaBoss(enemy, enemy.x - cameraX, enemy.y - cameraY, game.time);
      else if (enemy.type === "necromancer") this.drawNecromancer(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "leprechaun") this.drawLeprechaunBoss(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "minotaur") this.drawMinotaur(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "skeleton") this.drawSkeleton(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "mimic") {
        if (enemy.dormant) this.drawBreakable(game, { type: "box", size: enemy.size }, enemy.x - cameraX, enemy.y - cameraY);
        else this.drawMimic(enemy, enemy.x - cameraX, enemy.y - cameraY);
      } else {
        this.drawGhost(enemy, enemy.x - cameraX, enemy.y - cameraY, enemy.size);
      }
      this.drawEnemyHealthBar(enemy, enemy.x - cameraX, enemy.y - cameraY);
    }

    this.drawDrops(game, cameraX, cameraY);
    this.drawRemotePlayers(game, cameraX, cameraY);
    this.drawPlayer(game, cameraX, cameraY);
    this.drawProjectiles(game, cameraX, cameraY);
    this.drawPlayerHealthBar(game, cameraX, cameraY);
    this.drawFloatingTexts(game, cameraX, cameraY);
    this.drawVignette(game, cameraX, cameraY);
    ctx.restore();

    this.drawExperienceBar(game, layout);
    this.drawBossSpeechCallout(game, cameraX, cameraY, layout);
    this.drawHud(game, layout);
    const minimapBottom = this.drawMinimap(game, layout);
    if (!game.gameOver || !game.statsPanelOpen) {
      const statsBottom = this.drawPlayerStatsPanel(game, layout, minimapBottom + this.sidebarPadding);
      this.drawGroupPanel(game, layout, statsBottom + this.sidebarPadding);
    }
    if (game.shopOpen) this.drawShopMenu(game, layout);
    if (game.skillTreeOpen) this.drawSkillTreeMenu(game, layout);
    if (game.paused && !game.shopOpen && !game.skillTreeOpen && !game.statsPanelOpen && !game.gameOver) this.drawPausedOverlay(layout);

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
      ctx.fillText(game.gameOverTitle || "GAME OVER", this.canvas.width / 2, this.canvas.height / 2 - 18);
      ctx.fillStyle = `rgba(208, 203, 194, ${subtitleAlpha})`;
      ctx.font = "20px Trebuchet MS";
      if (!drawMultiplayerResultsOverlay(ctx, game, this.canvas)) {
        ctx.fillText("Run complete. Continue or wait to return to the menu.", this.canvas.width / 2, this.canvas.height / 2 + 28);
      }
      ctx.textAlign = "left";
    }
  }
}

Object.assign(RendererRuntimeScene.prototype, runtimeSceneDrawMethods);
