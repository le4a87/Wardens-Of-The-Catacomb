import { runtimeSceneBossDrawMethods } from "./runtimeSceneBossDrawMethods.js";

export const runtimeSceneEnemyDrawMethods = {
  ...runtimeSceneBossDrawMethods,
  drawGhost(enemyOrScreenX, maybeScreenX, maybeScreenY, maybeSize) {
    const ctx = this.ctx;
    const enemy = typeof enemyOrScreenX === "object" && enemyOrScreenX !== null ? enemyOrScreenX : null;
    const screenX = enemy ? maybeScreenX : enemyOrScreenX;
    const screenY = enemy ? maybeScreenY : maybeScreenX;
    const size = enemy ? maybeSize : maybeScreenY;
    const half = size / 2;
    const headRadius = half * 0.58;
    const bodyTop = screenY - size * 0.12;
    const bodyBottom = screenY + half;

    ctx.fillStyle = enemy?.isControlledUndead ? "#9eb8ff" : "#d8f2ff";
    ctx.beginPath();
    ctx.arc(screenX, screenY - size * 0.2, headRadius, Math.PI, 0);
    ctx.lineTo(screenX + half * 0.82, bodyBottom - 4);
    ctx.lineTo(screenX + half * 0.45, bodyBottom - 1);
    ctx.lineTo(screenX + half * 0.15, bodyBottom - 5);
    ctx.lineTo(screenX - half * 0.15, bodyBottom - 1);
    ctx.lineTo(screenX - half * 0.45, bodyBottom - 5);
    ctx.lineTo(screenX - half * 0.82, bodyBottom - 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = enemy?.isControlledUndead ? "rgba(120, 144, 255, 0.45)" : "rgba(120, 208, 255, 0.45)";
    ctx.fillRect(screenX - half * 0.72, bodyTop, half * 1.44, half * 1.15);
  },

  drawTreasureGoblin(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.6, half * 0.9, half * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4ea24b";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.15, half * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f8a3d";
    ctx.fillRect(screenX - half * 0.5, screenY + half * 0.1, half, half * 0.85);
    ctx.fillStyle = "#cfa84a";
    const coinCount = Math.min(5, 1 + Math.floor(enemy.goldEaten / 10));
    for (let i = 0; i < coinCount; i++) {
      const offset = (i - (coinCount - 1) / 2) * (half * 0.25);
      ctx.beginPath();
      ctx.arc(screenX + half * 0.62 + offset, screenY + half * 0.2, Math.max(1.2, half * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawMummy(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const auraAlpha = (enemy.auraPulseTimer || 0) > 0 ? 0.28 : 0.14;

    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.82, half, half * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(134, 214, 112, ${auraAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.22, half * 1.08, half * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#80724e";
    ctx.fillRect(screenX - half * 0.44, screenY - half * 0.2, half * 0.88, half * 1.0);
    ctx.fillStyle = "#b6a57b";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.48, half * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#d9cfab";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.42, screenY - half * 0.6);
    ctx.lineTo(screenX + half * 0.44, screenY - half * 0.32);
    ctx.moveTo(screenX - half * 0.46, screenY - half * 0.12);
    ctx.lineTo(screenX + half * 0.46, screenY + half * 0.16);
    ctx.moveTo(screenX - half * 0.38, screenY + half * 0.26);
    ctx.lineTo(screenX + half * 0.4, screenY + half * 0.52);
    ctx.stroke();

    ctx.fillStyle = "#4a4235";
    ctx.fillRect(screenX - 4, screenY - half * 0.56, 2, 2);
    ctx.fillRect(screenX + 2, screenY - half * 0.56, 2, 2);
  },

  drawRatArcher(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const aimX = Number.isFinite(enemy.dirX) ? enemy.dirX : 1;
    const aimY = Number.isFinite(enemy.dirY) ? enemy.dirY : 0;
    const perpX = -aimY;
    const perpY = aimX;
    const windup = Math.max(0, Math.min(1, (enemy.shotWindupTimer || 0) / 0.4));

    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.78, half * 0.95, half * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#6d4f2b";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.2, screenY + half * 0.38);
    ctx.quadraticCurveTo(screenX + half * 0.95, screenY + half * 0.68, screenX + half * 1.25, screenY + half * 1.15);
    ctx.stroke();

    ctx.fillStyle = "#6f5132";
    ctx.fillRect(screenX - half * 0.46, screenY - half * 0.04, half * 0.92, half * 0.88);

    ctx.fillStyle = "#8a643f";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.36, half * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4a2f1d";
    ctx.beginPath();
    ctx.moveTo(screenX - half * 0.62, screenY - half * 0.3);
    ctx.lineTo(screenX, screenY - half * 0.92);
    ctx.lineTo(screenX + half * 0.62, screenY - half * 0.3);
    ctx.lineTo(screenX + half * 0.42, screenY + half * 0.28);
    ctx.lineTo(screenX - half * 0.42, screenY + half * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#e5b27d";
    ctx.beginPath();
    ctx.arc(screenX - half * 0.16, screenY - half * 0.34, half * 0.07, 0, Math.PI * 2);
    ctx.arc(screenX + half * 0.16, screenY - half * 0.34, half * 0.07, 0, Math.PI * 2);
    ctx.fill();

    const bowX = screenX + aimX * half * (0.72 + windup * 0.1);
    const bowY = screenY - half * 0.08 + aimY * half * (0.72 + windup * 0.1);
    ctx.strokeStyle = "#9e7f51";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bowX + perpX * 6 - aimX * 2, bowY + perpY * 6 - aimY * 2);
    ctx.quadraticCurveTo(bowX + aimX * (5 + windup * 4), bowY + aimY * (5 + windup * 4), bowX - perpX * 6 - aimX * 2, bowY - perpY * 6 - aimY * 2);
    ctx.stroke();
    ctx.strokeStyle = windup > 0.2 ? "#f2d4a7" : "#ceb992";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(bowX + perpX * 6 - aimX * 2, bowY + perpY * 6 - aimY * 2);
    ctx.lineTo(bowX - perpX * 6 - aimX * 2, bowY - perpY * 6 - aimY * 2);
    ctx.stroke();
  },


  drawExitPortal(portal, screenX, screenY, time = 0) {
    const ctx = this.ctx;
    const pulse = 0.88 + Math.sin(time * 5.8) * 0.08;
    const outerR = 24 * pulse;
    const innerR = 14 * (1 + Math.sin(time * 7.1 + 0.6) * 0.05);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 18, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, outerR + 14);
    glow.addColorStop(0, "rgba(188, 255, 251, 0.55)");
    glow.addColorStop(0.55, "rgba(94, 183, 255, 0.28)");
    glow.addColorStop(1, "rgba(29, 58, 122, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY, outerR + 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#8be3ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#d9f8ff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(screenX, screenY, innerR, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const a = time * 1.9 + (i / 6) * Math.PI * 2;
      const r = 8 + (i % 2) * 6;
      const x = screenX + Math.cos(a) * r;
      const y = screenY + Math.sin(a) * r * 0.7;
      ctx.fillStyle = i % 2 === 0 ? "#a5f4ff" : "#4fa8ff";
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(7, 15, 31, 0.8)";
    ctx.fillRect(screenX - 30, screenY - 42, 60, 16);
    ctx.strokeStyle = "rgba(151, 231, 255, 0.75)";
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX - 29.5, screenY - 41.5, 59, 15);
    ctx.fillStyle = "#ddfbff";
    ctx.font = "bold 10px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("PORTAL", screenX, screenY - 30);
    ctx.textAlign = "left";
  },

  drawSkeleton(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size / 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.82, half * 0.92, half * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dfe1df";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - half * 0.2);
    ctx.lineTo(screenX, screenY + half * 0.68);
    ctx.moveTo(screenX - half * 0.4, screenY + half * 0.02);
    ctx.lineTo(screenX + half * 0.4, screenY + half * 0.02);
    ctx.moveTo(screenX, screenY + half * 0.68);
    ctx.lineTo(screenX - half * 0.38, screenY + half * 1.02);
    ctx.moveTo(screenX, screenY + half * 0.68);
    ctx.lineTo(screenX + half * 0.38, screenY + half * 1.02);
    ctx.stroke();
    ctx.fillStyle = "#f0efe8";
    ctx.beginPath();
    ctx.arc(screenX, screenY - half * 0.44, half * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2735";
    ctx.fillRect(screenX - 4, screenY - half * 0.56, 2, 2);
    ctx.fillRect(screenX + 2, screenY - half * 0.56, 2, 2);
    ctx.fillRect(screenX - 3, screenY - half * 0.32, 6, 2);
    ctx.strokeStyle = "#9b9fb2";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(screenX + half * 0.52, screenY - half * 0.1);
    ctx.lineTo(screenX + half * 0.88, screenY + half * 0.72);
    ctx.stroke();
  },

  drawMimic(enemy, screenX, screenY) {
    const ctx = this.ctx;
    const half = enemy.size * 0.5;
    const tongueLen = Math.max(0, enemy.tongueLength || 0);
    const tongueOut = tongueLen > 0.5;
    const lidLift = tongueOut ? half * 0.34 : half * 0.16;
    const dirX = enemy.tongueDirX || 1;
    const dirY = enemy.tongueDirY || 0;

    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.72, half, half * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6d4b2e";
    ctx.fillRect(screenX - half, screenY - half * 0.74, half * 2, half * 1.48);
    ctx.strokeStyle = "#8f6a43";
    ctx.strokeRect(screenX - half + 0.5, screenY - half * 0.74 + 0.5, half * 2 - 1, half * 1.48 - 1);
    ctx.fillStyle = "#b38b5f";
    ctx.fillRect(screenX - half * 0.92, screenY - 1, half * 1.84, 2);

    ctx.save();
    ctx.translate(screenX, screenY - 1);
    ctx.rotate(Math.atan2(dirY, dirX) * 0.08);
    ctx.fillStyle = "#7a5535";
    ctx.fillRect(-half, -half * 0.76 - lidLift, half * 2, half * 0.56);
    ctx.strokeStyle = "#a17a52";
    ctx.strokeRect(-half + 0.5, -half * 0.76 - lidLift + 0.5, half * 2 - 1, half * 0.56 - 1);
    ctx.restore();

    ctx.fillStyle = "#f1e7d2";
    for (let i = -2; i <= 2; i++) {
      const offset = i * (half * 0.3);
      ctx.beginPath();
      ctx.moveTo(screenX + offset, screenY - half * 0.18);
      ctx.lineTo(screenX + offset + half * 0.1, screenY - half * 0.02);
      ctx.lineTo(screenX + offset - half * 0.1, screenY - half * 0.02);
      ctx.closePath();
      ctx.fill();
    }

    if (tongueOut) {
      const startX = screenX + dirX * (half * 0.5);
      const startY = screenY + dirY * (half * 0.1);
      const tipX = startX + dirX * tongueLen;
      const tipY = startY + dirY * tongueLen;
      ctx.strokeStyle = "#ce5b7a";
      ctx.lineWidth = Math.max(3, half * 0.24);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        startX + dirX * (tongueLen * 0.45) - dirY * half * 0.35,
        startY + dirY * (tongueLen * 0.45) + dirX * half * 0.35,
        tipX,
        tipY
      );
      ctx.stroke();
      ctx.fillStyle = "#f08cab";
      ctx.beginPath();
      ctx.arc(tipX, tipY, Math.max(2, half * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawBreakable(br, screenX, screenY) {
    const ctx = this.ctx;
    const half = (br.size || 20) * 0.5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + half * 0.7, half * 0.9, half * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
    if (br.type === "crate") {
      ctx.fillStyle = "#7d5634";
      ctx.fillRect(screenX - half, screenY - half, half * 2, half * 2);
      ctx.strokeStyle = "#a57a4f";
      ctx.strokeRect(screenX - half + 0.5, screenY - half + 0.5, half * 2 - 1, half * 2 - 1);
      ctx.beginPath();
      ctx.moveTo(screenX - half + 2, screenY - half + 2);
      ctx.lineTo(screenX + half - 2, screenY + half - 2);
      ctx.moveTo(screenX + half - 2, screenY - half + 2);
      ctx.lineTo(screenX - half + 2, screenY + half - 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#6d4b2e";
      ctx.fillRect(screenX - half, screenY - half * 0.75, half * 2, half * 1.5);
      ctx.strokeStyle = "#8f6a43";
      ctx.strokeRect(screenX - half + 0.5, screenY - half * 0.75 + 0.5, half * 2 - 1, half * 1.5 - 1);
      ctx.fillStyle = "#b38b5f";
      ctx.fillRect(screenX - half * 0.9, screenY - 1, half * 1.8, 2);
    }
  }
};
