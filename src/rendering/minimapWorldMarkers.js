export function drawMinimapWorldMarkers(renderer, game, miniX, miniY, scale) {
  const ctx = renderer.ctx;
  const tile = renderer.config.map.tile;
  const owlDelivery = game.owlDelivery;
  const owl = owlDelivery?.active;
  if (owl) {
    const destX = miniX + (owl.destX / tile) * scale;
    const destY = miniY + (owl.destY / tile) * scale;
    const owlX = miniX + ((Number.isFinite(owl.displayX) ? owl.displayX : owl.x) / tile) * scale;
    const owlY = miniY + ((Number.isFinite(owl.displayY) ? owl.displayY : owl.y) / tile) * scale;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 142, 42, 0.88)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(destX, destY, Math.max(3.5, scale * 1.6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ff8a24";
    ctx.beginPath();
    ctx.arc(owlX, owlY, Math.max(2.5, scale * 1.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (owlDelivery?.lastMarker) {
    const marker = owlDelivery.lastMarker;
    const mx = miniX + (marker.x / tile) * scale;
    const my = miniY + (marker.y / tile) * scale;
    ctx.save();
    ctx.fillStyle = "#7a4a2a";
    ctx.strokeStyle = "#d09052";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 3, 8, 7, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b9793d";
    ctx.fillRect(mx - 3, my, 6, 1.3);
    ctx.restore();
  }

  for (const chest of game.treasureChests || []) {
    if (!chest?.discovered) continue;
    const chestX = miniX + (chest.x / tile) * scale;
    const chestY = miniY + (chest.y / tile) * scale;
    const chestHalf = Math.max(1.6, scale * 0.95);
    ctx.fillStyle = chest.opened ? "#8f6e3b" : "#f0c85c";
    ctx.fillRect(chestX - chestHalf, chestY - chestHalf, chestHalf * 2, chestHalf * 2);
    ctx.strokeStyle = chest.opened ? "rgba(232, 198, 124, 0.55)" : "rgba(255, 237, 174, 0.9)";
    ctx.strokeRect(chestX - chestHalf - 0.5, chestY - chestHalf - 0.5, chestHalf * 2 + 1, chestHalf * 2 + 1);
  }
}
