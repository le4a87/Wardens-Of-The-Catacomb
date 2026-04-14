function drawConsumablePlaceholder(ctx, key, x, y, size, accent = "rgba(126, 168, 255, 0.16)") {
  ctx.fillStyle = "rgba(8, 12, 18, 0.94)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(198, 212, 246, 0.35)";
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
  ctx.fillStyle = "#eef3ff";
  ctx.font = "bold 10px Trebuchet MS";
  ctx.fillText((key || "").slice(0, 2).toUpperCase(), x + 8, y + 19);
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export function drawShopMenu(renderer, game, layout) {
  const ctx = renderer.ctx;
  const menuW = 620;
  const menuH = 404;
  const menuX = Math.floor((layout.playW - menuW) / 2);
  const menuY = Math.floor((renderer.canvas.height - menuH) / 2);
  const items = typeof game.getShopItems === "function" ? game.getShopItems() : [];

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

  const rowH = 66;
  const contentTop = menuY + 46;
  const footerH = 48;
  const contentBottom = menuY + menuH - footerH;
  const visibleH = contentBottom - contentTop;
  const contentHeight = items.length * rowH + 6;
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
  for (const item of items) {
    const owned = typeof game.getConsumableOwnedCount === "function" ? game.getConsumableOwnedCount(item.key) : 0;
    const failure = typeof game.getShopFailureReason === "function" ? game.getShopFailureReason(item.key) : "";
    const canBuy = !failure;
    const rarityColor = item.rarity === "Legendary" ? "#f0ce63" : item.rarity === "Rare" ? "#c8a8ff" : "#8ec3ff";
    const portraitX = menuX + 22;
    const portraitY = rowY + 11;
    const portraitSize = 36;
    const buyRect = { x: menuX + menuW - 126, y: rowY + 16, w: 96, h: 30 };
    const textStartX = portraitX + portraitSize + 12;
    const metaWidth = 156;
    const effectStartX = textStartX + metaWidth;
    const textMaxWidth = buyRect.x - effectStartX - 16;

    ctx.fillStyle = "rgba(20, 28, 41, 0.92)";
    ctx.fillRect(menuX + 12, rowY, menuW - 24, rowH - 6);
    ctx.strokeStyle = "rgba(109, 125, 156, 0.52)";
    ctx.strokeRect(menuX + 12, rowY, menuW - 24, rowH - 6);

    drawConsumablePlaceholder(
      ctx,
      item.key,
      portraitX,
      portraitY,
      portraitSize,
      item.type === "Passive" ? "rgba(210, 168, 255, 0.16)" : "rgba(126, 168, 255, 0.16)"
    );

    ctx.fillStyle = "#f1ede0";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText(item.name, textStartX, rowY + 19);
    ctx.fillStyle = rarityColor;
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(`${item.type} • ${item.rarity}`, textStartX, rowY + 35);
    ctx.fillStyle = "#b9c3d9";
    ctx.fillText(`Owned ${owned}/${item.maxStack} • Stock ${item.stock}/${item.maxInventory}`, textStartX, rowY + 51);

    ctx.fillStyle = "#9eb6df";
    ctx.font = "12px Trebuchet MS";
    const wrappedEffect = wrapText(ctx, item.effect, textMaxWidth);
    for (let i = 0; i < Math.min(2, wrappedEffect.length); i++) {
      ctx.fillText(wrappedEffect[i], effectStartX, rowY + 20 + i * 14);
    }
    if (failure) {
      ctx.fillStyle = "#d8aa8e";
      ctx.fillText(failure, effectStartX, rowY + 48);
    }

    game.uiRects.shopItems.push({ key: item.key, rect: buyRect });
    ctx.fillStyle = canBuy ? "rgba(77, 132, 89, 0.95)" : "rgba(92, 76, 76, 0.95)";
    ctx.fillRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h);
    ctx.strokeStyle = "rgba(220, 224, 233, 0.52)";
    ctx.strokeRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h);
    ctx.fillStyle = "#f4efe1";
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(`${item.priceForFloor}g`, buyRect.x + 28, buyRect.y + 20);

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
  const footerText = game.consumables?.message || "Mouse wheel to scroll items.";
  ctx.fillText(footerText, menuX + 14, menuY + menuH - 28);
  ctx.fillText("All shop entries are consumables.", menuX + 14, menuY + menuH - 12);
}
