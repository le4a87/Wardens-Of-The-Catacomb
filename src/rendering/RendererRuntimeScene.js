import { RendererRuntimeBase } from "./RendererRuntimeBase.js";
import { runtimeSceneDrawMethods } from "./runtimeSceneDrawMethods.js";

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
    if (game.portal?.active) this.drawExitPortal(game.portal, game.portal.x - cameraX, game.portal.y - cameraY, game.time);

    for (const stand of game.armorStands) {
      if (stand.animated && stand.activated) continue;
      this.drawArmorStand(stand, stand.x - cameraX, stand.y - cameraY);
    }
    for (const br of game.breakables || []) this.drawBreakable(br, br.x - cameraX, br.y - cameraY);

    for (const enemy of game.enemies) {
      if (enemy.type === "goblin") this.drawTreasureGoblin(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "armor") this.drawAnimatedArmor(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "necromancer") this.drawNecromancer(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "skeleton") this.drawSkeleton(enemy, enemy.x - cameraX, enemy.y - cameraY);
      else if (enemy.type === "mimic") {
        if (enemy.dormant) this.drawBreakable({ type: "box", size: enemy.size }, enemy.x - cameraX, enemy.y - cameraY);
        else this.drawMimic(enemy, enemy.x - cameraX, enemy.y - cameraY);
      } else {
        this.drawGhost(enemy.x - cameraX, enemy.y - cameraY, enemy.size);
      }
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
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#f3f0e8";
      ctx.font = "bold 52px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", this.canvas.width / 2, this.canvas.height / 2 - 20);
      ctx.font = "22px Trebuchet MS";
      ctx.fillText("Press Esc for character select", this.canvas.width / 2, this.canvas.height / 2 + 24);
      ctx.textAlign = "left";
    }
  }
}

Object.assign(RendererRuntimeScene.prototype, runtimeSceneDrawMethods);
