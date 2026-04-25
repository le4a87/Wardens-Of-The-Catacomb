import {
  canSpendWarriorNode,
  formatWarriorLaneLabel,
  getWarriorAvailableSkillPoints,
  getWarriorSpentSkillPoints,
  getWarriorTalentDefs,
  getWarriorTalentPoints,
  getWarriorTooltip,
  isWarriorRowAccessible
} from "../../game/warriorTalentTree.js";
import { drawSkillRefundFooter } from "./skillTreeMenuSections.js";

function isPointInRect(x, y, rect) {
  return !!rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

function drawIcon(ctx, rect, icon, fill, locked) {
  ctx.fillStyle = locked ? "rgba(48, 52, 61, 0.96)" : fill;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = locked ? "rgba(119, 124, 134, 0.82)" : "rgba(242, 236, 224, 0.62)";
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.fillStyle = "#f4efe3";
  ctx.font = "bold 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(icon, rect.x + rect.w * 0.5, rect.y + rect.h * 0.62);
  ctx.textAlign = "left";
}

function drawTooltip(ctx, renderer, mouseX, mouseY, tooltip) {
  if (!tooltip) return;
  const lines = [tooltip.title, ...tooltip.lines];
  if (tooltip.requirement) lines.push(`Requirement: ${tooltip.requirement}`);
  ctx.save();
  ctx.font = "12px Trebuchet MS";
  let width = 0;
  for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
  const lineH = 16;
  const padding = 10;
  const boxW = width + padding * 2;
  const boxH = lines.length * lineH + padding * 2 - 4;
  const x = Math.max(10, Math.min(renderer.canvas.width - boxW - 10, mouseX + 16));
  const y = Math.max(26, Math.min(renderer.canvas.height - boxH - 10, mouseY - 10));
  ctx.fillStyle = "rgba(8, 11, 17, 0.97)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = "rgba(222, 180, 143, 0.78)";
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "#f6f0df" : line.startsWith("Requirement:") ? "#ffcf9b" : "#d8e0ec";
    ctx.font = index === 0 ? "bold 13px Trebuchet MS" : "12px Trebuchet MS";
    ctx.fillText(line, x + padding, y + padding + 12 + index * lineH);
  });
  ctx.restore();
}

function getPinnedTooltip(game) {
  const pinned = game?.uiPinnedTooltip;
  if (!pinned || pinned.source !== "skillTree") return null;
  return getWarriorTooltip(game, { key: pinned.key, kind: pinned.kind || "node" });
}

export function drawWarriorSkillTreeMenu(renderer, game, layout, frame) {
  const ctx = renderer.ctx;
  const menuX = frame.menuX;
  const menuY = frame.menuY;
  const menuW = frame.menuW;
  const menuH = frame.menuH;
  const contentTop = menuY + 48;
  const contentBottom = menuY + menuH - 84;
  const visibleH = contentBottom - contentTop;
  const defs = getWarriorTalentDefs();
  const maxTier = defs.reduce((max, def) => Math.max(max, def.tier || 1), 1);
  const tiers = new Map();
  for (const def of defs) {
    const list = tiers.get(def.tier) || [];
    list.push(def);
    tiers.set(def.tier, list);
  }
  const getTierColumnCount = (tier, count) => {
    if (tier === 5) return Math.min(4, Math.max(2, count));
    if (count >= 6) return 3;
    if (count >= 4) return 2;
    return Math.max(1, count);
  };
  const tierLayouts = [];
  let contentHeight = 40;
  for (let tier = 1; tier <= maxTier; tier++) {
    const nodes = tiers.get(tier) || [];
    const columns = getTierColumnCount(tier, nodes.length || 1);
    const rows = Math.max(1, Math.ceil(Math.max(1, nodes.length) / Math.max(1, columns)));
    const height = 58 + rows * 48 + Math.max(0, rows - 1) * 8;
    tierLayouts.push({ tier, nodes, columns, rows, height });
    contentHeight += height + 10;
  }
  const scrollMax = Math.max(0, contentHeight - visibleH);
  const scroll = Math.max(0, Math.min(scrollMax, game.uiScroll?.skillTree || 0));
  game.uiScroll.skillTree = scroll;
  game.uiRects.skillTreeScrollArea = { x: menuX + 8, y: contentTop, w: menuW - 16, h: visibleH };
  game.uiRects.skillTreeScrollMax = scrollMax;
  game.uiRects.skillTreeNodes = [];
  const sy = (y) => y - scroll;

  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 20px Trebuchet MS";
  ctx.fillText("Warrior Talent Tree", menuX + 16, menuY + 30);
  ctx.font = "13px Trebuchet MS";
  ctx.fillStyle = "#d2d9e8";
  ctx.textAlign = "right";
  ctx.fillText(
    `SP ${getWarriorSpentSkillPoints(game)}   Available ${getWarriorAvailableSkillPoints(game)}`,
    menuX + menuW - 46,
    menuY + 30
  );
  ctx.textAlign = "left";

  let hovered = null;
  const mouseX = game.input?.mouse?.screenX;
  const mouseY = game.input?.mouse?.screenY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(menuX + 8, contentTop, menuW - 16, visibleH);
  ctx.clip();

  let tierCursorY = menuY + 62;
  for (const layoutEntry of tierLayouts) {
    const { tier, nodes, columns, rows, height } = layoutEntry;
    const rowY = sy(tierCursorY);
    const rowRect = { x: menuX + 18, y: rowY, w: menuW - 36, h: height };
    const accessible = isWarriorRowAccessible(game, tier - 1);
    ctx.fillStyle = accessible ? "rgba(24, 20, 18, 0.94)" : "rgba(26, 22, 22, 0.86)";
    ctx.fillRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h);
    ctx.strokeStyle = accessible ? "rgba(196, 156, 120, 0.55)" : "rgba(96, 92, 90, 0.52)";
    ctx.strokeRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h);
    ctx.fillStyle = accessible ? "#f5eadc" : "#9a948b";
    ctx.font = "bold 14px Trebuchet MS";
    const tierLabel =
      tier === 1 ? "Tier 1  Weapon Form" :
      tier === 2 ? "Tier 2  Stance A Modifier" :
      tier === 3 ? "Tier 3  Stance B Modifier" :
      tier === 4 ? "Tier 4  Doctrine + Class Skill" :
      tier === 5 ? "Tier 5  Extras" :
      "Tier 6  Capstone";
    ctx.fillText(tierLabel, rowRect.x + 12, rowRect.y + 20);
    ctx.font = "12px Trebuchet MS";
    ctx.fillStyle = accessible ? "#cfd7e6" : "#c9a67b";
    const gateText = `Unlocks at level ${tier === 1 ? 2 : tier === 2 ? 3 : tier === 3 ? 4 : tier === 4 ? 6 : tier === 5 ? 8 : 10}`;
    ctx.fillText(gateText, rowRect.x + 12, rowRect.y + 36);

    const cardGap = 10;
    const cardH = 42;
    const cardW = Math.max(120, Math.floor((rowRect.w - 24 - Math.max(0, columns - 1) * cardGap) / Math.max(1, columns)));
    nodes.forEach((def, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const rect = {
        x: rowRect.x + 12 + col * (cardW + cardGap),
        y: rowRect.y + 46 + row * (cardH + 8),
        w: cardW,
        h: cardH
      };
      const points = getWarriorTalentPoints(game, def.key);
      const locked = !canSpendWarriorNode(game, def.key) && points <= 0;
      drawIcon(ctx, { x: rect.x + 4, y: rect.y + 6, w: 28, h: 28 }, def.icon, def.color, locked || !accessible);
      ctx.fillStyle = locked || !accessible ? "#9ea4af" : "#f2efe7";
      ctx.font = "bold 12px Trebuchet MS";
      ctx.fillText(def.label, rect.x + 38, rect.y + 16);
      ctx.font = "11px Trebuchet MS";
      ctx.fillStyle = locked || !accessible ? "#828894" : "#cfd7e6";
      ctx.fillText(formatWarriorLaneLabel(def.lane), rect.x + 38, rect.y + 30);
      if (points > 0) {
        ctx.fillStyle = "#f6ddb4";
        ctx.fillText("Selected", rect.x + rect.w - 50, rect.y + 30);
      }
      game.uiRects.skillTreeNodes.push({ key: def.key, kind: "node", rect });
      if (Number.isFinite(mouseX) && Number.isFinite(mouseY) && isPointInRect(mouseX, mouseY, rect)) {
        hovered = getWarriorTooltip(game, { key: def.key, kind: "node", locked: locked || !accessible });
      }
    });
    tierCursorY += height + 10;
  }

  ctx.restore();
  drawSkillRefundFooter(ctx, game, menuX, menuY, menuW, menuH);
  if (hovered && Number.isFinite(mouseX) && Number.isFinite(mouseY)) {
    drawTooltip(ctx, renderer, mouseX, mouseY, hovered);
    return;
  }
  if (layout.isAndroid) {
    const pinned = getPinnedTooltip(game);
    if (pinned) drawTooltip(ctx, renderer, menuX + menuW - 280, menuY + 82, pinned);
  }
}
