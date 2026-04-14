function drawConsumableSlot(ctx, slotX, slotY, slotSize, fillStyle, label, count, cooldownRatio = 0, keyLabel = "") {
  ctx.fillStyle = "rgba(8, 12, 18, 0.94)";
  ctx.fillRect(slotX, slotY, slotSize, slotSize);
  ctx.strokeStyle = "rgba(198, 212, 246, 0.35)";
  ctx.strokeRect(slotX + 0.5, slotY + 0.5, slotSize - 1, slotSize - 1);
  if (label) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(slotX + 3, slotY + 3, slotSize - 6, slotSize - 6);
    if (cooldownRatio > 0) {
      ctx.fillStyle = "rgba(6, 8, 12, 0.66)";
      ctx.fillRect(slotX + 2, slotY + 2, slotSize - 4, (slotSize - 4) * cooldownRatio);
    }
    ctx.fillStyle = "#eef3ff";
    ctx.font = "bold 10px Trebuchet MS";
    ctx.fillText(label, slotX + 8, slotY + 19);
    ctx.font = "bold 11px Trebuchet MS";
    ctx.fillText(`${count || 0}`, slotX + 24, slotY + 28);
  }
  if (!keyLabel) return;
  ctx.fillStyle = "#d7e4ff";
  ctx.font = "10px Trebuchet MS";
  ctx.fillText(keyLabel, slotX + 3, slotY + 10);
}

export function drawConsumablesBar(renderer, game, layout, xpBarY) {
  const ctx = renderer.ctx;
  const activeSlots = Array.isArray(game.consumables?.activeSlots) ? game.consumables.activeSlots : [];
  const passiveSlots = Array.isArray(game.consumables?.passiveSlots) ? game.consumables.passiveSlots : [];
  const slotSize = 34;
  const slotGap = 6;
  const barBaseY = xpBarY - slotSize - 8;
  const activeStartX = 10;

  for (let i = 0; i < 5; i++) {
    const slotX = activeStartX + i * (slotSize + slotGap);
    const slot = activeSlots[i] || null;
    const cooldownRatio = (game.consumables?.sharedCooldown || 0) > 0
      ? Math.max(0, Math.min(1, (game.consumables.sharedCooldown || 0) / 2))
      : 0;
    drawConsumableSlot(
      ctx,
      slotX,
      barBaseY,
      slotSize,
      "rgba(126, 168, 255, 0.16)",
      slot ? (slot.key || "").slice(0, 2).toUpperCase() : "",
      slot?.count || 0,
      cooldownRatio,
      `${i + 1}`
    );
  }

  const passiveStartX = activeStartX + 5 * (slotSize + slotGap) + 12;
  for (let i = 0; i < passiveSlots.length; i++) {
    const slot = passiveSlots[i];
    const slotX = passiveStartX + i * (slotSize + slotGap);
    drawConsumableSlot(
      ctx,
      slotX,
      barBaseY,
      slotSize,
      "rgba(210, 168, 255, 0.16)",
      (slot.key || "").slice(0, 2).toUpperCase(),
      slot.count || 0,
      Math.max(0, Math.min(1, (slot.cooldownRemaining || 0) / 5))
    );
  }
}
