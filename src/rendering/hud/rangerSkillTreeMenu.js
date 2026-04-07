import {
  canSpendRangerNode,
  canSpendRangerUtility,
  formatLaneLabel,
  getRangerAvailableSkillPoints,
  getRangerSpentSkillPoints,
  getRangerTalentDefs,
  getRangerTalentPoints,
  getRangerTooltip,
  getRangerUnlockRequirementText,
  getRangerUtilityLevel,
  isRangerRowAccessible
} from "../../game/rangerTalentTree.js";

function isPointInRect(x, y, rect) {
  return !!rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

function drawRankPips(ctx, x, y, filled, total, color, locked) {
  const size = 10;
  const gap = 4;
  for (let i = 0; i < total; i++) {
    const px = x + i * (size + gap);
    ctx.fillStyle = i < filled ? color : locked ? "rgba(68, 74, 86, 0.92)" : "rgba(28, 34, 44, 0.96)";
    ctx.fillRect(px, y, size, size);
    ctx.strokeStyle = locked ? "rgba(110, 116, 128, 0.72)" : "rgba(220, 228, 238, 0.52)";
    ctx.strokeRect(px + 0.5, y + 0.5, size - 1, size - 1);
  }
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
  ctx.strokeStyle = "rgba(182, 196, 222, 0.78)";
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "#f6f0df" : line.startsWith("Requirement:") ? "#ffcf9b" : "#d8e0ec";
    ctx.font = index === 0 ? "bold 13px Trebuchet MS" : "12px Trebuchet MS";
    ctx.fillText(line, x + padding, y + padding + 12 + index * lineH);
  });
  ctx.restore();
}

export function drawRangerSkillTreeMenu(renderer, game, layout, frame) {
  const ctx = renderer.ctx;
  const menuX = frame.menuX;
  const menuY = frame.menuY;
  const menuW = frame.menuW;
  const menuH = frame.menuH;
  const contentTop = menuY + 48;
  const contentBottom = menuY + menuH - 10;
  const visibleH = contentBottom - contentTop;
  const rowH = 98;
  const contentHeight = 5 * rowH + 40;
  const scrollMax = Math.max(0, contentHeight - visibleH);
  const scroll = Math.max(0, Math.min(scrollMax, game.uiScroll?.skillTree || 0));
  game.uiScroll.skillTree = scroll;
  game.uiRects.skillTreeScrollArea = { x: menuX + 8, y: contentTop, w: menuW - 16, h: visibleH };
  game.uiRects.skillTreeScrollMax = scrollMax;
  game.uiRects.skillTreeNodes = [];
  const sy = (y) => y - scroll;

  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 20px Trebuchet MS";
  ctx.fillText("Ranger Talent Tree", menuX + 16, menuY + 30);
  ctx.font = "13px Trebuchet MS";
  ctx.fillStyle = "#d2d9e8";
  ctx.textAlign = "right";
  ctx.fillText(`SP ${getRangerSpentSkillPoints(game)}/${getRangerSpentSkillPoints(game) + getRangerAvailableSkillPoints(game)}   Available ${getRangerAvailableSkillPoints(game)}`, menuX + menuW - 46, menuY + 30);
  ctx.textAlign = "left";

  ctx.save();
  ctx.beginPath();
  ctx.rect(menuX + 8, contentTop, menuW - 16, visibleH);
  ctx.clip();

  const defs = getRangerTalentDefs();
  const rowNodes = new Map();
  for (const def of defs) {
    const list = rowNodes.get(def.row) || [];
    list.push(def);
    rowNodes.set(def.row, list);
  }
  const utilityDefs = [
    { key: "moveSpeed", label: "Move Speed Training", icon: "MV", color: "#7cd5ff" },
    { key: "attackSpeed", label: "Attack Speed Training", icon: "AT", color: "#88efaa" },
    { key: "damage", label: "Damage Training", icon: "DM", color: "#ffba6d" },
    { key: "defense", label: "Defense Training", icon: "DF", color: "#cbb5ff" }
  ];

  let hovered = null;
  const mouseX = game.input?.mouse?.screenX;
  const mouseY = game.input?.mouse?.screenY;

  for (let row = 0; row <= 4; row++) {
    const rowY = sy(menuY + 62 + row * rowH);
    const rowRect = { x: menuX + 18, y: rowY, w: menuW - 36, h: rowH - 10 };
    const accessible = row === 0 || isRangerRowAccessible(game, row);
    ctx.fillStyle = accessible ? "rgba(17, 24, 35, 0.94)" : "rgba(22, 22, 26, 0.86)";
    ctx.fillRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h);
    ctx.strokeStyle = accessible ? "rgba(134, 156, 196, 0.55)" : "rgba(88, 92, 104, 0.52)";
    ctx.strokeRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h);
    ctx.fillStyle = accessible ? "#eef3fe" : "#9198a4";
    ctx.font = "bold 14px Trebuchet MS";
    const label = row === 0 ? "Row 0  Core + Utility" : `Row ${row}  Requires ${row === 1 ? "Fire Arrow" : `${row === 2 ? 3 : row === 3 ? 8 : 14} total points`}`;
    ctx.fillText(label, rowRect.x + 12, rowRect.y + 20);
    if (!accessible && row > 0) {
      ctx.font = "12px Trebuchet MS";
      ctx.fillStyle = "#bda885";
      const gateText =
        row === 1
          ? "Requires Fire Arrow first."
          : row === 4
          ? "Requires 14 total points for the first capstone, then 20 for the second."
          : `Requires ${row === 2 ? 3 : 8} total points spent.`;
      ctx.fillText(gateText, rowRect.x + 12, rowRect.y + 36);
    }

    if (row === 0) {
      const activeDef = defs.find((def) => def.key === "fireArrowActive");
      const activeRect = { x: rowRect.x + 14, y: rowRect.y + 30, w: 120, h: 48 };
      const activeLocked = !canSpendRangerNode(game, activeDef.key) && getRangerTalentPoints(game, activeDef.key) <= 0;
      drawIcon(ctx, { x: activeRect.x, y: activeRect.y, w: 30, h: 30 }, activeDef.icon, activeDef.color, activeLocked);
      ctx.fillStyle = activeLocked ? "#9ea4af" : "#f2efe7";
      ctx.font = "bold 13px Trebuchet MS";
      ctx.fillText(activeDef.label, activeRect.x + 40, activeRect.y + 14);
      drawRankPips(ctx, activeRect.x + 40, activeRect.y + 20, getRangerTalentPoints(game, activeDef.key), 1, activeDef.color, activeLocked);
      game.uiRects.skillTreeNodes.push({ key: activeDef.key, kind: "node", rect: activeRect });
      if (Number.isFinite(mouseX) && Number.isFinite(mouseY) && isPointInRect(mouseX, mouseY, activeRect)) {
        hovered = getRangerTooltip(game, { key: activeDef.key, kind: "node", locked: activeLocked });
      }

      utilityDefs.forEach((def, index) => {
        const x = rowRect.x + 150 + index * 86;
        const rect = { x, y: rowRect.y + 28, w: 78, h: 54 };
        const level = getRangerUtilityLevel(game, def.key);
        const locked = !canSpendRangerUtility(game, def.key) && level <= 0;
        drawIcon(ctx, { x: rect.x + 4, y: rect.y + 4, w: 24, h: 24 }, def.icon, def.color, locked);
        ctx.fillStyle = locked ? "#9ea4af" : "#f2efe7";
        ctx.font = "bold 11px Trebuchet MS";
        ctx.fillText(def.label.split(" ")[0], rect.x + 34, rect.y + 16);
        drawRankPips(ctx, rect.x + 6, rect.y + 34, level, 4, def.color, locked);
        game.uiRects.skillTreeNodes.push({ key: def.key, kind: "utility", rect });
        if (Number.isFinite(mouseX) && Number.isFinite(mouseY) && isPointInRect(mouseX, mouseY, rect)) {
          hovered = getRangerTooltip(game, { key: def.key, kind: "utility", locked });
        }
      });
      continue;
    }

    const nodes = (rowNodes.get(row) || []).filter((def) => def.key !== "fireArrowActive");
    nodes.forEach((def, index) => {
      const rect = { x: rowRect.x + 18 + index * 152, y: rowRect.y + 34, w: 136, h: 44 };
      const points = getRangerTalentPoints(game, def.key);
      const locked = !canSpendRangerNode(game, def.key) && points <= 0;
      drawIcon(ctx, { x: rect.x + 4, y: rect.y + 6, w: 28, h: 28 }, def.icon, def.color, locked || !accessible);
      ctx.fillStyle = locked || !accessible ? "#9ea4af" : "#f2efe7";
      ctx.font = "bold 12px Trebuchet MS";
      ctx.fillText(def.label, rect.x + 38, rect.y + 16);
      ctx.font = "11px Trebuchet MS";
      ctx.fillStyle = locked || !accessible ? "#828894" : "#cfd7e6";
      ctx.fillText(formatLaneLabel(def.lane), rect.x + 38, rect.y + 30);
      drawRankPips(ctx, rect.x + 38, rect.y + 32, points, def.maxRanks, def.color, locked || !accessible);
      game.uiRects.skillTreeNodes.push({ key: def.key, kind: "node", rect });
      if (Number.isFinite(mouseX) && Number.isFinite(mouseY) && isPointInRect(mouseX, mouseY, rect)) {
        hovered = getRangerTooltip(game, { key: def.key, kind: "node", locked: locked || !accessible });
      }
    });
  }

  ctx.restore();
  if (hovered && Number.isFinite(mouseX) && Number.isFinite(mouseY)) drawTooltip(ctx, renderer, mouseX, mouseY, hovered);
}
