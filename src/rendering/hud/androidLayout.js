export function getAndroidHudCardX(layout, panelW, inset = 16) {
  return layout.playW - panelW - inset;
}

export function getAndroidConsumablesStartX(layout, totalWidth, inset = 10) {
  return Math.max(inset, Math.floor((layout.playW - totalWidth) * 0.5));
}

export function getAndroidTouchRegions(layout, xpBarY, inset = 20) {
  const regionH = 152;
  const regionW = Math.min(220, Math.floor(layout.playW * 0.28));
  return {
    move: { x: inset, y: xpBarY - regionH - 20, w: regionW, h: regionH },
    aim: { x: layout.playW - regionW - inset, y: xpBarY - regionH - 20, w: regionW, h: regionH }
  };
}

export function drawAndroidTouchControls(ctx, input) {
  const sticks = [input?.touch?.moveStick, input?.touch?.aimStick];
  for (const stick of sticks) {
    if (!stick) continue;
    const dx = stick.x - stick.startX;
    const dy = stick.y - stick.startY;
    const dist = Math.hypot(dx, dy) || 1;
    const limit = Math.min(dist, input.touch.stickRadius);
    const thumbX = stick.startX + (dx / dist) * limit;
    const thumbY = stick.startY + (dy / dist) * limit;
    ctx.save();
    ctx.fillStyle = "rgba(12, 18, 27, 0.34)";
    ctx.beginPath();
    ctx.arc(stick.startX, stick.startY, input.touch.stickRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(211, 225, 255, 0.26)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stick.startX, stick.startY, input.touch.stickRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(126, 168, 255, 0.38)";
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
