import { formatTime } from "../../utils.js";

function drawMultiplayerNotifications(ctx, game, layout) {
  const current = game?.multiplayerNotificationCurrent;
  if (!current?.text) return;
  const boxW = Math.min(360, layout.playW - 40);
  const boxH = 24;
  const boxX = Math.floor((layout.playW - boxW) * 0.5);
  const boxY = 88;
  ctx.fillStyle = "rgba(10, 16, 25, 0.92)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "rgba(156, 176, 214, 0.52)";
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
  ctx.fillStyle = "#eef3ff";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(current.text, boxX + boxW * 0.5, boxY + 16);
  ctx.textAlign = "left";
}

function drawPauseOwnerBanner(ctx, game, layout) {
  if (!game?.networkEnabled || !game?.paused) return;
  const localId = typeof game.networkLocalPlayerId === "string" ? game.networkLocalPlayerId : null;
  const pauseOwnerId = typeof game.networkPauseOwnerId === "string" ? game.networkPauseOwnerId : null;
  if (!pauseOwnerId || !localId || pauseOwnerId === localId) return;
  const roster = Array.isArray(game.networkRosterPlayers) ? game.networkRosterPlayers : [];
  const owner = roster.find((player) => player?.id === pauseOwnerId);
  const handle = typeof owner?.handle === "string" && owner.handle.trim() ? owner.handle.trim() : "Player";
  const text = `${handle} paused the game.`;
  const boxW = Math.min(320, layout.playW - 40);
  const boxH = 24;
  const boxX = Math.floor((layout.playW - boxW) * 0.5);
  const boxY = 88;
  ctx.fillStyle = "rgba(10, 16, 25, 0.92)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "rgba(156, 176, 214, 0.52)";
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
  ctx.fillStyle = "#eef3ff";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(text, boxX + boxW * 0.5, boxY + 16);
  ctx.textAlign = "left";
}

export function drawHud(renderer, game, layout) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(5, 8, 14, 0.9)";
  ctx.fillRect(0, 0, layout.playW, layout.topHudH);
  ctx.fillStyle = "#f2efe3";
  ctx.font = "16px Trebuchet MS";
  ctx.fillText(`Score: ${game.score}`, 14, 24);
  ctx.fillText(`Time: ${formatTime(game.time)}`, 192, 24);
  ctx.fillText(`Floor: ${game.floor}`, 340, 24);
  if (game.networkEnabled) {
    ctx.fillStyle = game.networkRole === "Controller" ? "#8fe3a2" : "#dfc670";
    ctx.fillText(`Net: ${game.networkRole || "Connected"}`, 470, 24);
  }

  const objective = typeof game.getFloorObjectiveText === "function" ? game.getFloorObjectiveText() : "";
  const detail = typeof game.getFloorObjectiveDetail === "function" ? game.getFloorObjectiveDetail() : "";
  const boss = typeof game.getActiveFloorBossEnemy === "function" ? game.getActiveFloorBossEnemy() : null;
  const objectiveY = 43;

  ctx.fillStyle = "rgba(17, 24, 38, 0.96)";
  ctx.fillRect(12, 31, Math.min(540, layout.playW - 24), 28);
  ctx.strokeStyle = boss ? "rgba(208, 132, 255, 0.7)" : "rgba(126, 139, 171, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(12.5, 31.5, Math.min(540, layout.playW - 24) - 1, 27);
  ctx.fillStyle = boss ? "#f0d6ff" : "#dce7fb";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.fillText(objective, 22, objectiveY);
  ctx.fillStyle = "#9eb0d6";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText(detail, 22, objectiveY + 13);

  if (boss && Number.isFinite(boss.maxHp) && boss.maxHp > 0) {
    const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    const barW = Math.max(180, Math.min(360, layout.playW - 40));
    const barX = Math.floor((layout.playW - barW) / 2);
    const barY = 64;
    ctx.fillStyle = "rgba(18, 8, 24, 0.94)";
    ctx.fillRect(barX, barY, barW, 18);
    ctx.strokeStyle = "rgba(215, 154, 255, 0.72)";
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, 17);
    ctx.fillStyle = "#3a1f48";
    ctx.fillRect(barX + 4, barY + 4, barW - 8, 10);
    const bossLabel = game.floorBoss?.bossName || (boss.type === "leprechaun" ? "Leprechaun" : "Necromancer");
    const isLeprechaun = boss.type === "leprechaun";
    ctx.fillStyle = isLeprechaun ? "#74d74d" : "#b86cff";
    ctx.fillRect(barX + 4, barY + 4, Math.floor((barW - 8) * ratio), 10);
    ctx.fillStyle = "#f7e8ff";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.textAlign = "center";
    let title = `${bossLabel} ${Math.ceil(Math.max(0, boss.hp))}/${boss.maxHp}`;
    if (isLeprechaun && typeof game.getRemainingFloorBossTimer === "function") {
      const remaining = game.getRemainingFloorBossTimer();
      if (remaining !== null) title += ` | ${formatTime(remaining)}`;
    }
    ctx.fillText(title, layout.playW / 2, barY - 4 + 12);
    ctx.textAlign = "left";
  }

  drawPauseOwnerBanner(ctx, game, layout);
  drawMultiplayerNotifications(ctx, game, layout);
}

export function drawPausedOverlay(renderer, layout) {
  const ctx = renderer.ctx;
  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.fillRect(0, 0, layout.playW, renderer.canvas.height);
  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 42px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("Paused", layout.playW / 2, renderer.canvas.height / 2 - 4);
  ctx.font = "16px Trebuchet MS";
  ctx.fillText("Press Esc to resume", layout.playW / 2, renderer.canvas.height / 2 + 24);
  ctx.textAlign = "left";
}
