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

    const drawHarvesterAura = (player) => {
      if (!player || player.classType !== "necromancer") return;
      const hasHarvester = player === game.player
        ? (game.necromancerTalents?.harvester?.points || 0) > 0
        : (player?.necromancerTalents?.harvester?.points || 0) > 0;
      if (!hasHarvester) return;
      const x = (player.x || 0) - cameraX;
      const y = (player.y || 0) - cameraY;
      const radius = (game.config?.map?.tile || 32);
      const pulse = 0.96 + Math.sin(game.time * 3.4 + (player.x || 0) * 0.01) * 0.05;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "rgba(8, 4, 14, 0.14)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const phase = game.time * (1.5 + i * 0.25) + i * 2.1;
        const start = phase;
        const end = phase + Math.PI * (1.05 + i * 0.08);
        ctx.strokeStyle = `rgba(42, 18, 56, ${0.34 - i * 0.08})`;
        ctx.lineWidth = 5 - i;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (0.58 + i * 0.18), start, end);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(104, 74, 126, 0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.98, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    drawHarvesterAura(game.player);
    for (const player of game.remotePlayers || []) drawHarvesterAura(player);

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
      if (b.projectileType === "holyWave") {
        this.drawHolyWaveProjectile(b, cameraX, cameraY, game.time);
        continue;
      }
      if (b.projectileType === "arcaneWave") {
        this.drawArcaneWaveProjectile(b, cameraX, cameraY, game.time);
        continue;
      }
      if (b.projectileType === "fleshBall") {
        this.drawFleshBallProjectile(b, cameraX, cameraY, game.time);
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

  drawFleshBallProjectile(projectile, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = projectile.x - cameraX;
    const y = projectile.y - cameraY;
    const size = Number.isFinite(projectile.size) ? projectile.size : 16;
    const pulse = 0.94 + Math.sin(time * 8 + projectile.x * 0.03) * 0.06;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((projectile.angle || 0) + time * 2.2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.arc(0, size * 0.18, size * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8b403b";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.72 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d99895";
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + time * 1.3;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * size * 0.28, Math.sin(angle) * size * 0.22, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  drawHolyWaveProjectile(projectile, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = projectile.x - cameraX;
    const y = projectile.y - cameraY;
    const size = Number.isFinite(projectile.size) ? projectile.size : 28;
    const pulse = 0.92 + Math.sin(time * 12 + projectile.x * 0.02) * 0.08;
    const damageType = typeof projectile.damageType === "string" ? projectile.damageType : "holy";
    const arcane = damageType === "arcane";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Number.isFinite(projectile.angle) ? projectile.angle : 0);
    ctx.strokeStyle = arcane ? "rgba(128, 142, 255, 0.3)" : "rgba(255, 216, 120, 0.28)";
    ctx.lineWidth = Math.max(8, size * 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.9 * pulse, -0.56, 0.56);
    ctx.stroke();
    ctx.strokeStyle = arcane ? "rgba(189, 198, 255, 0.96)" : "rgba(255, 241, 186, 0.96)";
    ctx.lineWidth = Math.max(4, size * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.92 * pulse, -0.58, 0.58);
    ctx.stroke();
    ctx.strokeStyle = arcane ? "rgba(229, 230, 255, 0.82)" : "rgba(255, 250, 224, 0.82)";
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.78 * pulse, -0.52, 0.52);
    ctx.stroke();
    ctx.restore();
  },

  drawArcaneWaveProjectile(projectile, cameraX, cameraY, time = 0) {
    const ctx = this.ctx;
    const x = projectile.x - cameraX;
    const y = projectile.y - cameraY;
    const size = Number.isFinite(projectile.size) ? projectile.size : 24;
    const pulse = 0.9 + Math.sin(time * 11 + projectile.x * 0.018) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Number.isFinite(projectile.angle) ? projectile.angle : 0);
    ctx.strokeStyle = "rgba(103, 86, 255, 0.24)";
    ctx.lineWidth = Math.max(8, size * 0.38);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.82 * pulse, -0.6, 0.6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(142, 158, 255, 0.95)";
    ctx.lineWidth = Math.max(4, size * 0.15);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.86 * pulse, -0.62, 0.62);
    ctx.stroke();
    ctx.strokeStyle = "rgba(216, 205, 255, 0.82)";
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.72 * pulse, -0.56, 0.56);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const t = time * 7 + i * 0.9;
      ctx.strokeStyle = `rgba(167, 150, 255, ${0.5 - i * 0.12})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-size * 0.2 + Math.sin(t) * 3, -size * 0.1 + i * 2);
      ctx.lineTo(size * 0.32 + Math.cos(t) * 4, size * 0.08 - i * 2);
      ctx.stroke();
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
    const style = typeof swing.style === "string" ? swing.style : "broadswing";
    const modifier = typeof swing.modifier === "string" ? swing.modifier : "";
    const doctrine = typeof swing.doctrine === "string" ? swing.doctrine : "";
    const palette =
      doctrine === "paladin"
        ? { core: "rgba(255, 236, 176, 0.96)", edge: "#ffe39f", shadow: "rgba(181, 128, 48, 0)" }
        : doctrine === "eldritch"
        ? { core: "rgba(166, 190, 255, 0.94)", edge: "#aac4ff", shadow: "rgba(78, 104, 196, 0)" }
        : doctrine === "berserker"
        ? { core: "rgba(255, 170, 154, 0.94)", edge: "#ff9c8d", shadow: "rgba(171, 42, 26, 0)" }
        : { core: "rgba(255, 232, 188, 0.9)", edge: "#f4d8b3", shadow: "rgba(189, 96, 64, 0)" };

    ctx.save();
    if (style === "longspear") {
      const shaftX = x + dirX * range * 0.84;
      const shaftY = y + dirY * range * 0.84;
      const spread = Math.max(8, range * (modifier === "cleaving" ? 0.2 : modifier === "focused" ? 0.1 : 0.14));
      const width = Math.max(5, spread * 0.75);
      const leftX = shaftX + -dirY * spread;
      const leftY = shaftY + dirX * spread;
      const rightX = shaftX - -dirY * spread;
      const rightY = shaftY - dirX * spread;
      ctx.globalAlpha = 0.24 * alpha;
      ctx.fillStyle = doctrine === "eldritch" ? "rgba(126, 156, 255, 0.24)" : doctrine === "paladin" ? "rgba(255, 232, 162, 0.22)" : "rgba(246, 225, 192, 0.18)";
      ctx.beginPath();
      ctx.moveTo(x + dirX * 10, y + dirY * 10);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(shaftX + dirX * 12, shaftY + dirY * 12);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.52 * alpha;
      const grad = ctx.createLinearGradient(x, y, shaftX, shaftY);
      grad.addColorStop(0, "rgba(255,255,255,0.02)");
      grad.addColorStop(0.35, palette.core);
      grad.addColorStop(1, palette.shadow);
      ctx.strokeStyle = grad;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + dirX * 10, y + dirY * 10);
      ctx.lineTo(shaftX, shaftY);
      ctx.stroke();
      ctx.globalAlpha = 0.9 * alpha;
      ctx.strokeStyle = swing.executeProc ? "#ff5f5f" : palette.edge;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(x + dirX * 12, y + dirY * 12);
      ctx.lineTo(shaftX, shaftY);
      ctx.stroke();
      ctx.fillStyle = swing.executeProc ? "#ffd0d0" : "#f3efe3";
      ctx.beginPath();
      ctx.moveTo(shaftX + dirX * 9, shaftY + dirY * 9);
      ctx.lineTo(shaftX - dirX * 2 + -dirY * 6, shaftY - dirY * 2 + dirX * 6);
      ctx.lineTo(shaftX - dirX * 2 - -dirY * 6, shaftY - dirY * 2 - dirX * 6);
      ctx.closePath();
      ctx.fill();
    } else if (style === "warWhip") {
      const isCleaving = modifier === "cleaving";
      const curveA = isCleaving ? 0.28 : 0.18;
      const curveB = isCleaving ? 0.34 : 0.22;
      const tipReach = isCleaving ? 1.02 : 0.98;
      const ctrl1X = x + dirX * range * 0.28 + -dirY * range * curveA;
      const ctrl1Y = y + dirY * range * 0.28 + dirX * range * curveA;
      const ctrl2X = x + dirX * range * 0.68 - -dirY * range * curveB;
      const ctrl2Y = y + dirY * range * 0.68 - dirX * range * curveB;
      const tipX = x + dirX * range * tipReach;
      const tipY = y + dirY * range * tipReach;
      const ribbonWidth = isCleaving ? 12 : modifier === "focused" ? 5 : 7;
      ctx.globalAlpha = 0.16 * alpha;
      ctx.strokeStyle = doctrine === "eldritch" ? "rgba(144, 176, 255, 0.44)" : "rgba(255, 220, 184, 0.38)";
      ctx.lineWidth = ribbonWidth * (isCleaving ? 3.1 : 2.6);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + dirX * 10, y + dirY * 10);
      ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, tipX, tipY);
      ctx.stroke();
      if (isCleaving) {
        ctx.globalAlpha = 0.11 * alpha;
        ctx.strokeStyle = doctrine === "eldritch" ? "rgba(184, 196, 255, 0.42)" : "rgba(255, 232, 198, 0.34)";
        ctx.lineWidth = ribbonWidth * 4.4;
        ctx.beginPath();
        ctx.moveTo(x + dirX * 8, y + dirY * 8);
        ctx.bezierCurveTo(
          x + dirX * range * 0.24 + -dirY * range * 0.38,
          y + dirY * range * 0.24 + dirX * range * 0.38,
          x + dirX * range * 0.62 - -dirY * range * 0.42,
          y + dirY * range * 0.62 - dirX * range * 0.42,
          x + dirX * range * 1.04,
          y + dirY * range * 1.04
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5 * alpha;
      ctx.strokeStyle = doctrine === "eldritch" ? "rgba(144, 176, 255, 0.84)" : "rgba(244, 206, 167, 0.82)";
      ctx.lineWidth = ribbonWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + dirX * 10, y + dirY * 10);
      ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, tipX, tipY);
      ctx.stroke();
      ctx.globalAlpha = 0.95 * alpha;
      ctx.strokeStyle = swing.executeProc ? "#ff7474" : palette.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + dirX * 10, y + dirY * 10);
      ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, tipX, tipY);
      ctx.stroke();
      ctx.fillStyle = swing.executeProc ? "#ffd0d0" : "#f6ead6";
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === "twinHatchets") {
      const baseR = range * 0.9;
      const off = 8;
      for (const sign of [-1, 1]) {
        ctx.globalAlpha = 0.46 * alpha;
        ctx.strokeStyle = sign < 0 ? "rgba(255, 194, 168, 0.9)" : palette.core;
        ctx.lineWidth = 6.4;
        ctx.beginPath();
        ctx.arc(x + -dirY * off * sign, y + dirX * off * sign, baseR, start + sign * 0.06, end + sign * 0.06);
        ctx.stroke();
        ctx.globalAlpha = 0.88 * alpha;
        ctx.strokeStyle = swing.executeProc ? "#ff7c7c" : "#fff0dc";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(x + -dirY * off * sign, y + dirX * off * sign, baseR * 0.94, start + sign * 0.08, end + sign * 0.08);
        ctx.stroke();
      }
    } else {
      ctx.globalAlpha = 0.55 * alpha;
      const slashGrad = ctx.createRadialGradient(x, y, range * 0.15, x + dirX * range * 0.6, y + dirY * range * 0.6, range);
      if (swing.executeProc) {
        slashGrad.addColorStop(0, "rgba(255, 106, 106, 0.96)");
        slashGrad.addColorStop(0.55, "rgba(221, 48, 48, 0.7)");
        slashGrad.addColorStop(1, "rgba(128, 12, 12, 0)");
      } else {
        slashGrad.addColorStop(0, palette.core);
        slashGrad.addColorStop(1, palette.shadow);
      }
      ctx.fillStyle = slashGrad;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, range, start, end);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.85 * alpha;
      ctx.strokeStyle = swing.executeProc ? "#ff5f5f" : palette.edge;
      ctx.lineWidth = swing.executeProc ? 3 : 2.4;
      ctx.beginPath();
      ctx.arc(x, y, range * 0.82, start, end);
      ctx.stroke();
    }

    if (swing.executeProc && style !== "longspear") {
      ctx.globalAlpha = 0.95 * alpha;
      ctx.strokeStyle = "#ff4545";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      if (style === "twinHatchets") {
        ctx.arc(x, y, range * 0.72, start + arc * 0.08, end - arc * 0.08);
      } else {
        ctx.arc(x, y, range * 0.88, start + arc * 0.08, end - arc * 0.08);
      }
      ctx.stroke();
    }

    const bladeX = x + dirX * (range * 0.72);
    const bladeY = y + dirY * (range * 0.72);
    ctx.strokeStyle = swing.executeProc ? "#ffd0d0" : "#e9e0d1";
    ctx.lineWidth = swing.executeProc ? 2.3 : 2;
    if (originPlayer && style !== "warWhip" && style !== "twinHatchets") {
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
    if (zone.zoneType === "bloodPool") {
      const lifeFrac = Math.max(0, Math.min(1, zone.life / (this.config.enemy?.golemFleshBallPoolDuration || 4.2)));
      const pulse = 0.92 + Math.sin(time * 6 + zone.x * 0.02 + zone.y * 0.013) * 0.05;
      const outer = ctx.createRadialGradient(x, y, 2, x, y, zone.radius * pulse);
      outer.addColorStop(0, `rgba(148, 24, 30, ${0.34 * lifeFrac + 0.16})`);
      outer.addColorStop(0.55, `rgba(116, 14, 18, ${0.24 * lifeFrac + 0.1})`);
      outer.addColorStop(1, `rgba(42, 6, 8, ${0.08 * lifeFrac})`);
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, zone.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(196, 76, 76, ${0.14 * lifeFrac + 0.08})`;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + time * 1.2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * zone.radius * 0.25, y + Math.sin(a) * zone.radius * 0.18, 2.4, 0, Math.PI * 2);
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
    if (zone.zoneType === "deathBolt") {
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
    if (zone.zoneType === "deathBurst") {
      const totalLife = this.config.deathBolt?.visualLife || 0.35;
      const lifeFrac = Math.max(0, Math.min(1, zone.life / totalLife));
      const pulse = 0.9 + Math.sin(time * 14 + zone.x * 0.03 + zone.y * 0.02) * 0.09;
      const outer = ctx.createRadialGradient(x, y, 2, x, y, zone.radius * pulse);
      outer.addColorStop(0, `rgba(230, 176, 255, ${0.32 * lifeFrac + 0.18})`);
      outer.addColorStop(0.42, `rgba(112, 48, 158, ${0.28 * lifeFrac + 0.14})`);
      outer.addColorStop(1, `rgba(18, 6, 32, ${0.12 * lifeFrac})`);
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, zone.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(148, 78, 198, ${0.44 * lifeFrac - i * 0.08})`;
        ctx.lineWidth = 3 - i * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, zone.radius * (0.46 + i * 0.18), time * (1.4 + i * 0.22), time * (1.4 + i * 0.22) + Math.PI * 1.35);
        ctx.stroke();
      }
      return;
    }
    if (zone.zoneType === "crusaderAura" || zone.zoneType === "warCircle") {
      const radius = Number.isFinite(zone.radius) ? Math.max(0, zone.radius) : 0;
      if (radius <= 0) return;
      const totalLife = Number.isFinite(zone.totalLife) && zone.totalLife > 0 ? zone.totalLife : 8;
      const lifeFrac = Math.max(0, Math.min(1, zone.life / totalLife));
      const pulse = 0.95 + Math.sin(time * 5 + zone.x * 0.01 + zone.y * 0.008) * 0.04;
      const outer = ctx.createRadialGradient(x, y, 2, x, y, radius * pulse);
      const damageType = typeof zone.damageType === "string" ? zone.damageType : "holy";
      const palette = damageType === "arcane"
        ? ["rgba(206, 196, 255,", "rgba(132, 118, 255,", "rgba(38, 22, 76,"]
        : zone.doctrine === "berserker"
        ? ["rgba(255, 202, 196,", "rgba(216, 88, 74,", "rgba(94, 28, 22,"]
        : zone.doctrine === "gladiator"
        ? ["rgba(250, 225, 188,", "rgba(213, 171, 115,", "rgba(94, 66, 26,"]
        : ["rgba(255, 245, 188,", "rgba(245, 207, 111,", "rgba(125, 92, 26,"];
      outer.addColorStop(0, `${palette[0]} ${0.34 * lifeFrac + 0.14})`);
      outer.addColorStop(0.5, `${palette[1]} ${0.28 * lifeFrac + 0.14})`);
      outer.addColorStop(1, `${palette[2]} ${0.08 * lifeFrac})`);
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = damageType === "arcane"
        ? `rgba(218, 210, 255, ${0.55 * lifeFrac + 0.18})`
        : zone.doctrine === "berserker"
        ? `rgba(255, 190, 170, ${0.55 * lifeFrac + 0.18})`
        : zone.doctrine === "gladiator"
        ? `rgba(245, 221, 182, ${0.55 * lifeFrac + 0.18})`
        : `rgba(255, 239, 166, ${0.55 * lifeFrac + 0.18})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.96, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = damageType === "arcane"
        ? `rgba(235, 232, 255, ${0.7 * lifeFrac + 0.18})`
        : zone.doctrine === "berserker"
        ? `rgba(255, 220, 212, ${0.7 * lifeFrac + 0.18})`
        : zone.doctrine === "gladiator"
        ? `rgba(255, 241, 218, ${0.7 * lifeFrac + 0.18})`
        : `rgba(255, 248, 214, ${0.7 * lifeFrac + 0.18})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.22, y);
      ctx.lineTo(x + radius * 0.22, y);
      ctx.moveTo(x, y - radius * 0.22);
      ctx.lineTo(x, y + radius * 0.22);
      ctx.stroke();
      return;
    }
    if (zone.zoneType === "tempestAura") {
      const radius = Number.isFinite(zone.radius) ? Math.max(0, zone.radius) : 0;
      if (radius <= 0) return;
      const totalLife = Number.isFinite(zone.totalLife) && zone.totalLife > 0 ? zone.totalLife : 3;
      const lifeFrac = Math.max(0, Math.min(1, zone.life / totalLife));
      const pulse = 0.94 + Math.sin(time * 8 + zone.x * 0.015 + zone.y * 0.01) * 0.08;
      const damageType = typeof zone.damageType === "string" ? zone.damageType : "physical";
      const outer = ctx.createRadialGradient(x, y, 2, x, y, radius * pulse);
      if (damageType === "arcane") {
        outer.addColorStop(0, `rgba(220, 214, 255, ${0.18 + lifeFrac * 0.18})`);
        outer.addColorStop(0.5, `rgba(121, 102, 255, ${0.18 + lifeFrac * 0.22})`);
        outer.addColorStop(1, `rgba(34, 18, 68, ${0.06 + lifeFrac * 0.08})`);
      } else if (damageType === "holy") {
        outer.addColorStop(0, `rgba(255, 244, 198, ${0.18 + lifeFrac * 0.18})`);
        outer.addColorStop(0.5, `rgba(245, 207, 111, ${0.18 + lifeFrac * 0.22})`);
        outer.addColorStop(1, `rgba(125, 92, 26, ${0.06 + lifeFrac * 0.08})`);
      } else if (zone.doctrine === "berserker") {
        outer.addColorStop(0, `rgba(255, 212, 198, ${0.18 + lifeFrac * 0.18})`);
        outer.addColorStop(0.5, `rgba(224, 96, 72, ${0.18 + lifeFrac * 0.22})`);
        outer.addColorStop(1, `rgba(92, 24, 18, ${0.06 + lifeFrac * 0.08})`);
      } else {
        outer.addColorStop(0, `rgba(247, 233, 204, ${0.18 + lifeFrac * 0.18})`);
        outer.addColorStop(0.5, `rgba(213, 171, 115, ${0.18 + lifeFrac * 0.22})`);
        outer.addColorStop(1, `rgba(87, 60, 24, ${0.06 + lifeFrac * 0.08})`);
      }
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = damageType === "arcane"
          ? `rgba(202, 194, 255, ${0.42 * lifeFrac - i * 0.08})`
          : damageType === "holy"
          ? `rgba(255, 240, 190, ${0.42 * lifeFrac - i * 0.08})`
          : zone.doctrine === "berserker"
          ? `rgba(255, 196, 176, ${0.42 * lifeFrac - i * 0.08})`
          : `rgba(246, 226, 188, ${0.42 * lifeFrac - i * 0.08})`;
        ctx.lineWidth = 3 - i * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, radius * (0.45 + i * 0.17), time * (1.8 + i * 0.4), time * (1.8 + i * 0.4) + Math.PI * 1.1);
        ctx.stroke();
      }
      return;
    }
    if (zone.zoneType === "arcaneChain") {
      const tx = (Number.isFinite(zone.targetX) ? zone.targetX : zone.x) - cameraX;
      const ty = (Number.isFinite(zone.targetY) ? zone.targetY : zone.y) - cameraY;
      const lifeFrac = Math.max(0, Math.min(1, zone.life / (zone.totalLife || 0.18)));
      const grad = ctx.createLinearGradient(x, y, tx, ty);
      grad.addColorStop(0, `rgba(110, 92, 255, ${0.18 + lifeFrac * 0.22})`);
      grad.addColorStop(0.55, `rgba(171, 159, 255, ${0.6 * lifeFrac})`);
      grad.addColorStop(1, `rgba(228, 223, 255, ${0.18 + lifeFrac * 0.12})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x + (tx - x) * 0.3, y + Math.sin(time * 24 + x * 0.06) * 5);
      ctx.lineTo(x + (tx - x) * 0.68, y + (ty - y) * 0.68 + Math.cos(time * 24 + y * 0.04) * 4);
      ctx.lineTo(tx, ty - 2);
      ctx.stroke();
      return;
    }
    if (zone.zoneType === "golemCollapseWarning") {
      const size = Number.isFinite(zone.size) ? zone.size : (zone.radius || 16) * 2;
      const lifeFrac = Number.isFinite(zone.strikeAt) && zone.strikeAt > 0 ? Math.max(0, Math.min(1, zone.life / zone.strikeAt)) : 1;
      ctx.fillStyle = `rgba(255, 145, 59, ${0.16 + (1 - lifeFrac) * 0.22})`;
      ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
      ctx.strokeStyle = `rgba(255, 197, 108, ${0.55 + (1 - lifeFrac) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - size * 0.5 + 1, y - size * 0.5 + 1, size - 2, size - 2);
      return;
    }
    if (zone.zoneType === "golemCollapseImpact") {
      const size = Number.isFinite(zone.size) ? zone.size : (zone.radius || 16) * 2;
      const outer = ctx.createRadialGradient(x, y, 2, x, y, size * 0.7);
      outer.addColorStop(0, "rgba(255, 222, 154, 0.45)");
      outer.addColorStop(0.5, "rgba(255, 138, 72, 0.28)");
      outer.addColorStop(1, "rgba(95, 68, 52, 0.06)");
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
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
