export function drawShopMenu(renderer, game, layout) {
  const ctx = renderer.ctx;
  const menuW = 520;
  const menuH = 378;
  const menuX = Math.floor((layout.playW - menuW) / 2);
  const menuY = Math.floor((renderer.canvas.height - menuH) / 2);

  ctx.fillStyle = "rgba(4, 7, 11, 0.78)";
  ctx.fillRect(0, 0, layout.playW, renderer.canvas.height);

  ctx.fillStyle = "rgba(10, 15, 24, 0.95)";
  ctx.fillRect(menuX, menuY, menuW, menuH);
  ctx.strokeStyle = "rgba(155, 173, 211, 0.8)";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(menuX, menuY, menuW, menuH);

  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 20px Trebuchet MS";
  ctx.fillText("Castle Quartermaster", menuX + 16, menuY + 30);
  ctx.font = "14px Trebuchet MS";
  ctx.fillStyle = "#d8dfef";
  ctx.fillText(`Gold: ${game.gold}`, menuX + menuW - 120, menuY + 30);

  const closeRect = { x: menuX + menuW - 34, y: menuY + 10, w: 20, h: 20 };
  game.uiRects.shopClose = closeRect;
  ctx.fillStyle = "rgba(140, 78, 78, 0.9)";
  ctx.fillRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
  ctx.fillStyle = "#f4ece6";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("X", closeRect.x + 6, closeRect.y + 15);

  const rowH = 50;
  const contentTop = menuY + 46;
  const footerH = 36;
  const contentBottom = menuY + menuH - footerH;
  const visibleH = contentBottom - contentTop;
  const contentHeight = game.shopOrder.length * rowH + 6;
  const scrollMax = Math.max(0, contentHeight - visibleH);
  const scroll = Math.max(0, Math.min(scrollMax, game.uiScroll?.shop || 0));
  game.uiScroll.shop = scroll;
  game.uiRects.shopScrollArea = { x: menuX + 10, y: contentTop, w: menuW - 20, h: visibleH };
  game.uiRects.shopScrollMax = scrollMax;

  ctx.save();
  ctx.beginPath();
  ctx.rect(menuX + 10, contentTop, menuW - 20, visibleH);
  ctx.clip();

  let rowY = menuY + 48 - scroll;
  for (const key of game.shopOrder) {
    const upgrade = game.upgrades[key];
    const cost = game.getUpgradeCost(key);
    const isMax = !Number.isFinite(cost);
    const canBuy = game.canBuyUpgrade(key);

    ctx.fillStyle = "rgba(20, 28, 41, 0.92)";
    ctx.fillRect(menuX + 12, rowY, menuW - 24, rowH - 4);
    ctx.strokeStyle = "rgba(109, 125, 156, 0.52)";
    ctx.strokeRect(menuX + 12, rowY, menuW - 24, rowH - 4);

    ctx.fillStyle = "#f1ede0";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText(upgrade.label, menuX + 22, rowY + 20);
    ctx.fillStyle = "#b9c3d9";
    ctx.font = "13px Trebuchet MS";
    ctx.fillText(`Level ${upgrade.level}/${upgrade.maxLevel}`, menuX + 22, rowY + 38);

    let valueText = "";
    if (key === "moveSpeed") valueText = `x${game.getMoveSpeedMultiplier().toFixed(2)} move`;
    if (key === "attackSpeed") valueText = `x${game.getAttackSpeedMultiplier().toFixed(2)} attack`;
    if (key === "damage") valueText = `x${game.getDamageMultiplier().toFixed(2)} damage`;
    if (key === "defense") valueText = `-${game.getDefenseFlatReduction().toFixed(1)} hit dmg`;
    ctx.fillStyle = "#9eb6df";
    ctx.fillText(valueText, menuX + 188, rowY + 29);

    const buyRect = { x: menuX + menuW - 126, y: rowY + 9, w: 96, h: 30 };
    game.uiRects.shopItems.push({ key, rect: buyRect });
    ctx.fillStyle = isMax ? "rgba(68, 76, 92, 0.95)" : canBuy ? "rgba(77, 132, 89, 0.95)" : "rgba(99, 85, 66, 0.95)";
    ctx.fillRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h);
    ctx.strokeStyle = "rgba(220, 224, 233, 0.52)";
    ctx.strokeRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h);
    ctx.fillStyle = "#f4efe1";
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(isMax ? "MAXED" : `${cost}g`, buyRect.x + 27, buyRect.y + 20);

    rowY += rowH;
  }
  ctx.restore();

  if (scrollMax > 0) {
    const trackX = menuX + menuW - 10;
    const trackY = contentTop;
    const trackH = visibleH;
    const thumbH = Math.max(28, Math.floor((visibleH / contentHeight) * trackH));
    const thumbY = trackY + Math.floor((scroll / scrollMax) * (trackH - thumbH));
    ctx.fillStyle = "rgba(68, 76, 97, 0.7)";
    ctx.fillRect(trackX, trackY, 4, trackH);
    ctx.fillStyle = "rgba(180, 194, 228, 0.85)";
    ctx.fillRect(trackX, thumbY, 4, thumbH);
  }

  ctx.font = "12px Trebuchet MS";
  ctx.fillStyle = "#8ea1c5";
  ctx.fillText(
    (game.isArcherClass && game.isArcherClass()) || (game.isWarriorClass && game.isWarriorClass())
      ? "Utility upgrades now live in the skill tree."
      : "Mouse wheel to scroll items.",
    menuX + 14,
    menuY + menuH - 28
  );
  ctx.fillText(`Skill Points: ${game.skillPoints}`, menuX + 14, menuY + menuH - 12);
}
