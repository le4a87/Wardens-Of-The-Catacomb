import { drawGroupPanel, drawHud, drawPlayerStatsPanel, drawShopMenu, drawSkillTreeMenu, drawPausedOverlay } from "./hudPanels.js";
import { RendererRuntimeEffects } from "./RendererRuntimeEffects.js";

export class Renderer extends RendererRuntimeEffects {
  drawHud(game, layout) {
    drawHud(this, game, layout);
  }

  drawPlayerStatsPanel(game, layout, panelY) {
    return drawPlayerStatsPanel(this, game, layout, panelY);
  }

  drawGroupPanel(game, layout, panelY) {
    return drawGroupPanel(this, game, layout, panelY);
  }

  drawShopMenu(game, layout) {
    drawShopMenu(this, game, layout);
  }

  drawSkillTreeMenu(game, layout) {
    drawSkillTreeMenu(this, game, layout);
  }

  drawPausedOverlay(layout) {
    drawPausedOverlay(this, layout);
  }
}
