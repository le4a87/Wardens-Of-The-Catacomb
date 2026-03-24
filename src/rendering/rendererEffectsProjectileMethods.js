function hexToRgba(color, alpha) {
  if (typeof color !== "string") return `rgba(121, 255, 141, ${alpha})`;
  const hex = color.trim();
  const expanded = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const match = /^#([0-9a-f]{6})$/i.exec(expanded);
  if (!match) return `rgba(121, 255, 141, ${alpha})`;
  const int = Number.parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const rendererEffectsProjectileMethods = {
  drawProjectiles(game, cameraX, cameraY) {
    const ctx = this.ctx;
    for (const swing of game.meleeSwings || []) {
      this.drawMeleeSwing(swing, cameraX, cameraY, game.player);
    }

    if (game.necromancerBeam?.active) {
      const beam = game.necromancerBeam;
      const sx = game.player.x - cameraX;
      const sy = game.player.y - cameraY - 8;
      const tx = (Number.isFinite(beam.targetX) ? beam.targetX : game.player.x) - cameraX;
      const ty = (Number.isFinite(beam.targetY) ? beam.targetY : game.player.y) - cameraY;
      const grad = ctx.createLinearGradient(sx, sy, tx, ty);
      grad.addColorStop(0, "rgba(112, 255, 170, 0.2)");
      grad.addColorStop(0.5, "rgba(121, 255, 141, 0.85)");
      grad.addColorStop(1, "rgba(185, 255, 218, 0.35)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (beam.progress > 0) {
        ctx.fillStyle = "rgba(158, 255, 186, 0.95)";
        ctx.fillRect(tx - 12, ty - 20, 24 * Math.max(0, Math.min(1, beam.progress / (game.config.necromancer?.charmDuration || 2))), 4);
      }
    }

    for (const player of game.remotePlayers || []) {
      if (!player || player.alive === false || player.classType !== "necromancer") continue;
      const beam = player.necromancerBeam;
      if (!beam?.active) continue;
      const sx = player.x - cameraX;
      const sy = player.y - cameraY - 8;
      const fallbackTx = player.x + (Number.isFinite(player.dirX) ? player.dirX : 1) * ((game.config?.necromancer?.controlRangeTiles || 10) * (game.config?.map?.tile || 32) * 0.45);
      const fallbackTy = player.y + (Number.isFinite(player.dirY) ? player.dirY : 0) * ((game.config?.necromancer?.controlRangeTiles || 10) * (game.config?.map?.tile || 32) * 0.45);
      const tx = (Number.isFinite(beam.targetX) ? beam.targetX : fallbackTx) - cameraX;
      const ty = (Number.isFinite(beam.targetY) ? beam.targetY : fallbackTy) - cameraY;
      if (![sx, sy, tx, ty].every(Number.isFinite)) continue;
      const color = typeof player.color === "string" && player.color ? player.color : "#79ff8d";
      const grad = ctx.createLinearGradient(sx, sy, tx, ty);
      grad.addColorStop(0, hexToRgba(color, 0.18));
      grad.addColorStop(0.5, hexToRgba(color, 0.76));
      grad.addColorStop(1, hexToRgba(color, 0.3));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if ((beam.progress || 0) > 0) {
        ctx.fillStyle = hexToRgba(color, 0.92);
        ctx.fillRect(tx - 12, ty - 20, 24 * Math.max(0, Math.min(1, beam.progress / (game.config.necromancer?.charmDuration || 2))), 4);
      }
    }

    const drawArrowLikeProjectile = (projectile, alpha = 1) => {
      const x = projectile.x - cameraX;
      const y = projectile.y - cameraY;
      const isTrapArrow = projectile.projectileType === "trapArrow";
      const isDeathBolt = projectile.projectileType === "deathBolt";
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(projectile.angle);
      if (isDeathBolt) {
        const orb = ctx.createRadialGradient(0, 0, 1, 0, 0, 10);
        orb.addColorStop(0, "rgba(203, 255, 205, 0.95)");
        orb.addColorStop(0.45, "rgba(91, 230, 151, 0.9)");
        orb.addColorStop(1, "rgba(31, 94, 58, 0.2)");
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isTrapArrow ? "#d66e57" : "#d9c27f";
        ctx.fillRect(-7, -1.3, 11, 2.6);
        ctx.fillStyle = isTrapArrow ? "#ffb9a7" : "#e5e2dc";
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(1, -3);
        ctx.lineTo(1, 3);
        ctx.closePath();
        ctx.fill();
      }
      if (isTrapArrow) {
        ctx.fillStyle = "#791d15";
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(-10, -2.2);
        ctx.lineTo(-8.2, 0);
        ctx.lineTo(-10, 2.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    for (const b of game.bullets) {
      if (b.kind === "necroticBolt") {
        this.drawNecroticBolt(b, cameraX, cameraY, game.time);
        continue;
      }
      if (b.projectileType === "sonyaFireball") {
        this.drawSonyaFireball(b, cameraX, cameraY, game.time);
        continue;
      }
      if (b.projectileType === "luckyCharm") {
        this.drawLuckyCharmProjectile(b, cameraX, cameraY, game.time);
        continue;
      }
      drawArrowLikeProjectile(b, 1);
    }
    for (const arrow of game.fireArrows) {
      const x = arrow.x - cameraX;
      const y = arrow.y - cameraY;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(arrow.angle);
      ctx.fillStyle = "#ffb347";
      ctx.fillRect(-8, -1.7, 12, 3.4);
      ctx.fillStyle = "#ff6a3d";
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-12, -3);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-12, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const zone of game.fireZones) this.drawFireZone(zone, cameraX, cameraY, game.time);
  },

  drawNecroticBolt(projectile, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = projectile.x - cameraX;
    const y = projectile.y - cameraY;
    const size = Number.isFinite(projectile.size) ? projectile.size : 12;
    const pulse = 0.82 + Math.sin(time * 13 + projectile.x * 0.02 + projectile.y * 0.017) * 0.16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Number.isFinite(projectile.angle) ? projectile.angle : 0);
    const outer = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 0.9);
    outer.addColorStop(0, "rgba(235, 183, 255, 0.92)");
    outer.addColorStop(0.45, "rgba(153, 78, 214, 0.68)");
    outer.addColorStop(1, "rgba(56, 19, 89, 0)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.9 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a154f";
    ctx.beginPath();
    ctx.moveTo(size * 0.7, 0);
    ctx.lineTo(-size * 0.55, -size * 0.34);
    ctx.lineTo(-size * 0.1, 0);
    ctx.lineTo(-size * 0.55, size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f1d5ff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-size * 0.25, 0);
    ctx.lineTo(size * 0.5, 0);
    ctx.stroke();
    ctx.restore();
  },

  drawLuckyCharmProjectile(projectile, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = projectile.x - cameraX;
    const y = projectile.y - cameraY;
    const size = Number.isFinite(projectile.size) ? projectile.size : 10;
    const pulse = 0.9 + Math.sin(time * 14 + projectile.x * 0.04) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((projectile.angle || 0) + time * 2);
    ctx.fillStyle = "rgba(201, 255, 166, 0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, size * pulse, 0, Math.PI * 2);
    ctx.fill();
    const colors = ["#f3df69", "#8ae06f", "#f48b5f", "#8fd9ff"];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(Math.cos((i / 4) * Math.PI * 2) * 3, Math.sin((i / 4) * Math.PI * 2) * 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  drawSonyaFireball(projectile, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = projectile.x - cameraX;
    const y = projectile.y - cameraY;
    const size = Number.isFinite(projectile.size) ? projectile.size : 13;
    const pulse = 0.9 + Math.sin(time * 16 + projectile.x * 0.03) * 0.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Number.isFinite(projectile.angle) ? projectile.angle : 0);
    const outer = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 1.05);
    outer.addColorStop(0, "rgba(255, 248, 181, 0.95)");
    outer.addColorStop(0.4, "rgba(255, 156, 72, 0.88)");
    outer.addColorStop(1, "rgba(165, 35, 18, 0)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, size * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6d33";
    ctx.beginPath();
    ctx.moveTo(size * 0.72, 0);
    ctx.lineTo(-size * 0.48, -size * 0.34);
    ctx.lineTo(-size * 0.12, 0);
    ctx.lineTo(-size * 0.48, size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 233, 178, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, 0);
    ctx.lineTo(size * 0.48, 0);
    ctx.stroke();
    ctx.restore();
  },

  drawMeleeSwing(swing, cameraX, cameraY, player) {
    const ctx = this.ctx;
    const life = Number.isFinite(swing.life) ? swing.life : 0;
    const maxLife = Number.isFinite(swing.maxLife) && swing.maxLife > 0 ? swing.maxLife : this.config.effects.meleeSwingLife;
    const alpha = Math.max(0, Math.min(1, life / maxLife));
    if (alpha <= 0) return;

    const x = swing.x - cameraX;
    const y = swing.y - cameraY;
    const range = swing.range || 40;
    const arc = swing.arc || Math.PI * 0.5;
    const start = swing.angle - arc * 0.5;
    const end = swing.angle + arc * 0.5;
    const dirX = Math.cos(swing.angle);
    const dirY = Math.sin(swing.angle);
    const originPlayer = player && Number.isFinite(player.x) && Number.isFinite(player.y) ? player : null;
    if (![x, y, range, arc, start, end, dirX, dirY].every(Number.isFinite)) return;

    ctx.save();
    ctx.globalAlpha = 0.55 * alpha;
    const slashGrad = ctx.createRadialGradient(x, y, range * 0.15, x + dirX * range * 0.6, y + dirY * range * 0.6, range);
    if (swing.executeProc) {
      slashGrad.addColorStop(0, "rgba(255, 106, 106, 0.96)");
      slashGrad.addColorStop(0.55, "rgba(221, 48, 48, 0.7)");
      slashGrad.addColorStop(1, "rgba(128, 12, 12, 0)");
    } else {
      slashGrad.addColorStop(0, "rgba(255, 232, 188, 0.9)");
      slashGrad.addColorStop(1, "rgba(189, 96, 64, 0)");
    }
    ctx.fillStyle = slashGrad;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, start, end);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.85 * alpha;
    ctx.strokeStyle = swing.executeProc ? "#ff5f5f" : "#f4d8b3";
    ctx.lineWidth = swing.executeProc ? 3 : 2.4;
    ctx.beginPath();
    ctx.arc(x, y, range * 0.82, start, end);
    ctx.stroke();

    if (swing.executeProc) {
      ctx.globalAlpha = 0.95 * alpha;
      ctx.strokeStyle = "#ff4545";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(x, y, range * 0.88, start + arc * 0.08, end - arc * 0.08);
      ctx.stroke();
    }

    const bladeX = x + dirX * (range * 0.72);
    const bladeY = y + dirY * (range * 0.72);
    ctx.strokeStyle = swing.executeProc ? "#ffd0d0" : "#e9e0d1";
    ctx.lineWidth = swing.executeProc ? 2.3 : 2;
    if (originPlayer) {
      ctx.beginPath();
      ctx.moveTo(originPlayer.x - cameraX + dirX * 12, originPlayer.y - cameraY + dirY * 12);
      ctx.lineTo(bladeX, bladeY);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawFireZone(zone, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = zone.x - cameraX;
    const y = zone.y - cameraY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (zone.zoneType === "ghostSiphon") {
      const tx = (Number.isFinite(zone.targetX) ? zone.targetX : zone.x) - cameraX;
      const ty = (Number.isFinite(zone.targetY) ? zone.targetY : zone.y) - cameraY;
      const lifeFrac = Math.max(0, Math.min(1, zone.life / 0.35));
      const grad = ctx.createLinearGradient(x, y, tx, ty);
      grad.addColorStop(0, `rgba(180, 122, 255, ${0.18 * lifeFrac})`);
      grad.addColorStop(0.5, `rgba(156, 88, 255, ${0.72 * lifeFrac})`);
      grad.addColorStop(1, `rgba(231, 196, 255, ${0.2 * lifeFrac})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(tx, ty - 4);
      ctx.stroke();
      ctx.fillStyle = `rgba(190, 126, 255, ${0.22 * lifeFrac})`;
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const px = x + (tx - x) * t;
        const py = y + (ty - y) * t + Math.sin(time * 10 + i) * 3;
        ctx.beginPath();
        ctx.arc(px, py, 3.5 - t, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (zone.zoneType === "acid") {
      const lifeFrac = Math.max(0, Math.min(1, zone.life / 5));
      const pulse = 0.9 + Math.sin(time * 8 + zone.x * 0.02 + zone.y * 0.013) * 0.08;
      const outer = ctx.createRadialGradient(x, y, 2, x, y, zone.radius * pulse);
      outer.addColorStop(0, `rgba(172, 255, 106, ${0.28 * lifeFrac + 0.12})`);
      outer.addColorStop(0.55, `rgba(96, 214, 64, ${0.22 * lifeFrac + 0.08})`);
      outer.addColorStop(1, `rgba(43, 92, 25, ${0.08 * lifeFrac})`);
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, zone.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(205, 255, 155, ${0.16 * lifeFrac + 0.08})`;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + time * 1.5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * zone.radius * 0.28, y + Math.sin(a) * zone.radius * 0.18, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (zone.zoneType === "sonyaFire") {
      const lifeFrac = Math.max(0, Math.min(1, zone.life / (this.config.enemy?.sonyaFirePatchDuration || 3.6)));
      const radius = Number.isFinite(zone.radius) ? Math.max(0, zone.radius) : 0;
      const pulse = 0.92 + Math.sin(time * 9 + zone.x * 0.03 + zone.y * 0.02) * 0.08;
      const outer = ctx.createRadialGradient(x, y, 2, x, y, radius * pulse);
      outer.addColorStop(0, `rgba(255, 235, 162, ${0.22 * lifeFrac + 0.12})`);
      outer.addColorStop(0.45, `rgba(255, 127, 59, ${0.24 * lifeFrac + 0.12})`);
      outer.addColorStop(1, `rgba(135, 28, 14, ${0.08 * lifeFrac})`);
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 207, 121, ${0.18 * lifeFrac + 0.08})`;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + time * 1.8;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * radius * 0.28, y + Math.sin(a) * radius * 0.18, 3.4, 1.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (zone.zoneType === "deathBolt" || zone.zoneType === "deathBurst") {
      const lifeFrac = Math.max(0, Math.min(1, zone.life / (this.config.deathBolt?.visualLife || 0.35)));
      const outer = ctx.createRadialGradient(x, y, 2, x, y, zone.radius);
      outer.addColorStop(0, `rgba(190, 255, 210, ${0.38 * lifeFrac})`);
      outer.addColorStop(0.5, `rgba(93, 220, 154, ${0.26 * lifeFrac})`);
      outer.addColorStop(1, `rgba(32, 76, 54, ${0.06 * lifeFrac})`);
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const lifeFrac = Math.max(0, Math.min(1, zone.life / this.config.fireArrow.lingerDuration));
    const radius = Number.isFinite(zone.radius) ? Math.max(0, zone.radius) : 0;
    if (radius <= 0) return;
    const pulse = 0.88 + Math.sin((time * 10 + zone.x * 0.02 + zone.y * 0.015)) * 0.09;
    const coreR = radius * 0.42 * pulse;
    const midR = radius * 0.72 * (0.96 + Math.sin(time * 7.8 + zone.y * 0.018) * 0.06);
    const edgeR = radius * (0.96 + Math.sin(time * 6.1 + zone.x * 0.013) * 0.05);

    const outer = ctx.createRadialGradient(x, y, coreR * 0.15, x, y, edgeR);
    outer.addColorStop(0, `rgba(255, 224, 140, ${0.26 * lifeFrac + 0.12})`);
    outer.addColorStop(0.45, `rgba(255, 138, 62, ${0.24 * lifeFrac + 0.1})`);
    outer.addColorStop(1, `rgba(138, 34, 18, ${0.12 * lifeFrac})`);
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(x, y, edgeR, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(x, y, 2, x, y, midR);
    core.addColorStop(0, `rgba(255, 243, 175, ${0.35 * lifeFrac + 0.16})`);
    core.addColorStop(0.55, `rgba(255, 167, 70, ${0.26 * lifeFrac + 0.12})`);
    core.addColorStop(1, `rgba(255, 96, 45, ${0.1 * lifeFrac})`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, midR, 0, Math.PI * 2);
    ctx.fill();

    const tongues = 9;
    ctx.fillStyle = `rgba(255, 188, 93, ${0.16 * lifeFrac + 0.06})`;
    for (let i = 0; i < tongues; i++) {
      const a = (i / tongues) * Math.PI * 2 + time * 1.7;
      const wobble = Math.sin(time * 8 + i * 1.9 + zone.x * 0.01) * 0.1;
      const r1 = radius * (0.58 + wobble);
      const r2 = radius * (0.88 + wobble * 0.5);
      const px = x + Math.cos(a) * r1;
      const py = y + Math.sin(a) * r1;
      const tx = x + Math.cos(a) * r2;
      const ty = y + Math.sin(a) * r2;
      ctx.beginPath();
      ctx.ellipse((px + tx) * 0.5, (py + ty) * 0.5, 3.8, 1.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawDrops(game, cameraX, cameraY) {
    const ctx = this.ctx;
    for (const drop of game.drops) {
      const x = drop.x - cameraX;
      const y = drop.y - cameraY;
      if (drop.type === "health") {
        ctx.drawImage(this.potionSprite, x - 10, y - 13, 20, 24);
      } else if (drop.type === "gold") {
        ctx.fillStyle = "#e1bc54";
        ctx.beginPath();
        ctx.arc(x, y, drop.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (drop.type === "gold_bag") {
        ctx.drawImage(this.goldBagSprite, x - 12, y - 12, 24, 24);
      }
    }
  }
};
