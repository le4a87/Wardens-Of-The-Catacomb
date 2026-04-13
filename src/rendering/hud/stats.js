import { drawStatsGameOverActions } from "./statsGameOverActions.js";
import { getNecromancerTalentPoints } from "../../game/necromancerTalentTree.js";

function formatEnemyTypeLabel(type) {
  const raw = typeof type === "string" && type.length > 0 ? type : "unknown";
  return raw
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function createSection(title, rows) {
  return { title, rows: rows.filter(Boolean) };
}

function isPointInRect(x, y, rect) {
  return !!rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

function getHudAbilityState(game) {
  if (game.isWarriorClass && game.isWarriorClass()) {
    const cooldownMax = Math.max(0.01, game.getWarriorRageCooldown());
    const cooldownRemaining = Math.max(0, game.warriorRageCooldownTimer || 0);
    return {
      title: "Rage",
      color: "#d14f4f",
      accent: "#ffb0b0",
      cooldownRemaining,
      cooldownMax,
      progress: cooldownRemaining > 0 ? 1 - cooldownRemaining / cooldownMax : 1,
      hoverText:
        cooldownRemaining > 0
          ? `Rage cooldown: ${cooldownRemaining.toFixed(1)}s`
          : "Rage ready"
    };
  }
  if (game.isNecromancerClass && game.isNecromancerClass()) {
    const unlocked = (game.skills?.deathBolt?.points || 0) > 0;
    const cooldownMax = Math.max(0.01, game.config.deathBolt?.cooldown || 10);
    const cooldownRemaining = Math.max(0, game.player.deathBoltCooldown || 0);
    return {
      title: "Death Bolt",
      color: "#f3f4f7",
      accent: "#ffffff",
      cooldownRemaining,
      cooldownMax,
      progress: unlocked ? (cooldownRemaining > 0 ? 1 - cooldownRemaining / cooldownMax : 1) : 0,
      hoverText: !unlocked ? "Death Bolt locked" : cooldownRemaining > 0 ? `Death Bolt cooldown: ${cooldownRemaining.toFixed(1)}s` : "Death Bolt ready"
    };
  }
  const unlocked = game.isFireArrowUnlocked();
  const cooldownMax = Math.max(0.01, game.config.fireArrow.cooldown);
  const cooldownRemaining = Math.max(0, game.player.fireArrowCooldown || 0);
  return {
    title: "Fire Arrow",
    color: "#59b85a",
    accent: "#d7ffd0",
    cooldownRemaining,
    cooldownMax,
    progress: unlocked ? (cooldownRemaining > 0 ? 1 - cooldownRemaining / cooldownMax : 1) : 0,
    hoverText: !unlocked ? "Fire Arrow locked" : cooldownRemaining > 0 ? `Fire Arrow cooldown: ${cooldownRemaining.toFixed(1)}s` : "Fire Arrow ready"
  };
}

function drawAbilityCooldownWidget(renderer, game, x, y, size) {
  const ctx = renderer.ctx;
  const state = getHudAbilityState(game);
  const radius = size * 0.5;
  const cx = x + radius;
  const cy = y + radius;
  const startAngle = -Math.PI * 0.5;
  const endAngle = startAngle + Math.PI * 2 * Math.max(0, Math.min(1, state.progress));
  const rect = { x, y, w: size, h: size };
  game.uiRects.hudAbilityWidget = rect;

  ctx.save();
  ctx.fillStyle = "rgba(10, 14, 20, 0.98)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(232, 226, 211, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = state.color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 4, startAngle, endAngle);
  ctx.stroke();

  ctx.fillStyle = state.color;
  ctx.globalAlpha = state.progress >= 1 ? 0.2 : 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 10px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(state.title, cx, y + size + 11);
  ctx.font = "bold 12px Trebuchet MS";
  const text = state.cooldownRemaining > 0 ? `${Math.ceil(state.cooldownRemaining)}` : "R";
  ctx.fillText(text, cx, cy + 4);
  ctx.textAlign = "left";
  ctx.restore();

  const mouseX = game.input?.mouse?.screenX;
  const mouseY = game.input?.mouse?.screenY;
  if (Number.isFinite(mouseX) && Number.isFinite(mouseY) && isPointInRect(mouseX, mouseY, rect)) {
    const padding = 8;
    ctx.save();
    ctx.font = "12px Trebuchet MS";
    const textW = ctx.measureText(state.hoverText).width;
    const tipX = Math.max(10, Math.min(renderer.canvas.width - textW - padding * 2 - 10, mouseX + 14));
    const tipY = Math.max(22, mouseY - 12);
    ctx.fillStyle = "rgba(8, 12, 18, 0.96)";
    ctx.fillRect(tipX, tipY - 16, textW + padding * 2, 22);
    ctx.strokeStyle = state.accent;
    ctx.strokeRect(tipX + 0.5, tipY - 15.5, textW + padding * 2 - 1, 21);
    ctx.fillStyle = "#f2efe3";
    ctx.fillText(state.hoverText, tipX + padding, tipY);
    ctx.restore();
  }
}

function drawHudButton(ctx, rect, label, active, activeFill) {
  ctx.fillStyle = active ? activeFill : "rgba(95, 126, 189, 0.92)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.72)";
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(label, rect.x + rect.w * 0.5, rect.y + 18);
  ctx.textAlign = "left";
}

function drawNecromancerPetOrbs(ctx, game, x, y) {
  const cap = Math.max(0, Math.floor(game.getNecromancerControlCap()));
  const used = Math.max(0, Math.min(cap, Math.floor(game.getControlledUndeadCount())));
  ctx.fillStyle = "#9fb1d5";
  ctx.font = "11px Trebuchet MS";
  ctx.fillText("Pets", x, y);
  if (cap <= 0) return;

  const radius = 6;
  const gap = 7;
  const startX = x + 34;
  const centerY = y - 4;
  for (let i = 0; i < cap; i++) {
    const cx = startX + i * (radius * 2 + gap);
    ctx.fillStyle = i < used ? "#b8f0bf" : "rgba(91, 109, 145, 0.26)";
    ctx.beginPath();
    ctx.arc(cx, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = i < used ? "rgba(228, 255, 232, 0.95)" : "rgba(154, 170, 202, 0.58)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function getRunStats(game) {
  if (typeof game.ensureRunStats === "function") return game.ensureRunStats();
  return game.runStats || {
    totalKills: 0,
    bossKills: 0,
    floorsCleared: 0,
    damageDealt: 0,
    damageTaken: 0,
    healingReceived: 0,
    goldEarned: 0,
    goldSpent: 0,
    killsByEnemyType: {},
    killsByFloor: {},
    classSpecific: {
      ranger: { shotsFired: 0, fireArrowKills: 0 },
      warrior: { executeKills: 0, frenzies: 0 },
      necromancer: { undeadCharmed: 0, undeadHealing: 0 }
    }
  };
}

function buildRunColumns(game) {
  const runStats = getRunStats(game);
  const overview = createSection("Overview", [
    ["Class", game.classSpec.label],
    ["Floor", `${game.floor}`],
    ["Level", `${game.level}`],
    ["Total Kills", `${runStats.totalKills || 0}`],
    ["Boss Kills", `${runStats.bossKills || 0}`],
    ["Floors Cleared", `${runStats.floorsCleared || 0}`],
    ["Damage Dealt", `${Math.round(runStats.damageDealt || 0)}`],
    ["Damage Taken", `${Math.round(runStats.damageTaken || 0)}`]
  ]);
  const economy = createSection("Economy", [
    ["Gold On Hand", `${game.gold}`],
    ["Gold Earned", `${Math.round(runStats.goldEarned || 0)}`],
    ["Gold Spent", `${Math.round(runStats.goldSpent || 0)}`],
    ["Healing Received", `${Math.round(runStats.healingReceived || 0)}`]
  ]);
  const difficulty = createSection("Difficulty", [
    ["Pace", game.getEnemyOutpacingStatus().label],
    ["Spawn Scale", `x${game.getEnemySpawnRateScale().toFixed(2)}`],
    ["Enemy Cap", `${game.getActiveEnemyCap()}`],
    ["Enemy Speed", `x${game.getEnemySpeedScale().toFixed(2)}`],
    ["Enemy Damage", `x${game.getEnemyDamageScale().toFixed(2)}`],
    ["Enemy Defense", `x${game.getEnemyDefenseScale().toFixed(2)}`]
  ]);

  let classActivity = null;
  if (game.isArcherClass && game.isArcherClass()) {
    classActivity = createSection("Ranger Run", [
      ["Shots Fired", `${runStats.classSpecific?.ranger?.shotsFired || 0}`],
      ["Fire Arrow Kills", `${runStats.classSpecific?.ranger?.fireArrowKills || 0}`]
    ]);
  } else if (game.isWarriorClass && game.isWarriorClass()) {
    classActivity = createSection("Warrior Run", [
      ["Execute Kills", `${runStats.classSpecific?.warrior?.executeKills || 0}`],
      ["Frenzies", `${runStats.classSpecific?.warrior?.frenzies || 0}`]
    ]);
  } else if (game.isNecromancerClass && game.isNecromancerClass()) {
    classActivity = createSection("Necromancer Run", [
      ["Undead Charmed", `${runStats.classSpecific?.necromancer?.undeadCharmed || 0}`],
      ["Undead Healing", `${Math.round(runStats.classSpecific?.necromancer?.undeadHealing || 0)}`]
    ]);
  }

  const killsByFloorRows = Object.entries(runStats.killsByFloor || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([floor, count]) => [`Floor ${floor}`, `${count}`]);
  const killsByFloor = createSection("Kills By Floor", killsByFloorRows.length > 0 ? killsByFloorRows : [[`Floor ${game.floor}`, "0"]]);

  const killsByEnemyRows = Object.entries(runStats.killsByEnemyType || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 14)
    .map(([type, count]) => [formatEnemyTypeLabel(type), `${count}`]);
  const killsByEnemy = createSection("Kills By Enemy", killsByEnemyRows.length > 0 ? killsByEnemyRows : [["None", "0"]]);

  return [
    [overview, economy],
    [difficulty, classActivity, killsByFloor].filter(Boolean),
    [killsByEnemy]
  ];
}

function buildCharacterColumns(game) {
  const dmgRange = game.getPrimaryDamageRange();
  const tempHp =
    Math.max(0, Number.isFinite(game.player?.warriorRuntime?.tempHp) ? game.player.warriorRuntime.tempHp : 0) +
    Math.max(0, Number.isFinite(game.player?.necromancerRuntime?.tempHp) ? game.player.necromancerRuntime.tempHp : 0) +
    Math.max(0, Number.isFinite(game.player?.consumableRuntime?.tempHp) ? game.player.consumableRuntime.tempHp : 0);
  const core = createSection("Core", [
    ["Health", `${Math.round(game.player.health)}/${Math.round(game.player.maxHealth)}${tempHp > 0 ? ` (+${Math.round(tempHp)} THP)` : ""}`],
    ["XP", `${game.experience}/${game.expToNextLevel}`],
    ["Move Speed", `${game.getPlayerMoveSpeed().toFixed(1)}`],
    ["Pickup Radius", `${game.getPickupRadius().toFixed(1)}`],
    ["Players", `${game.getActivePlayerCount()}`],
    ["Key", game.hasKey ? "Yes" : "No"]
  ]);
  const combat = createSection("Combat", [
    ["Atk Speed", `${game.getAttackSpeed().toFixed(2)}/s`],
    ["Atk Damage", `${dmgRange.min.toFixed(1)}-${dmgRange.max.toFixed(1)}`],
    ["Life Leech", `${(game.getLifeLeechPercent() * 100).toFixed(1)}%`],
    ["Defense", `${game.getDefenseFlatReduction().toFixed(1)}`],
    [
      "Range/Reach",
      game.isWarriorClass && game.isWarriorClass()
        ? `${(game.classSpec.meleeRange || 42).toFixed(0)} melee`
        : game.isNecromancerClass && game.isNecromancerClass()
        ? `${((game.config.necromancer?.controlRangeTiles || 10) * game.config.map.tile).toFixed(0)} beam`
        : `${(game.getProjectileSpeed ? game.getProjectileSpeed() : game.config.player.projectileSpeed).toFixed(0)} arrow`
    ]
  ]);

  let classKit = null;
  if (game.isArcherClass && game.isArcherClass()) {
    classKit = createSection("Ranger Kit", [
      ["Fire Arrow", game.isFireArrowUnlocked() ? "Unlocked" : "Locked"],
      ["Fire Cooldown", game.player.fireArrowCooldown > 0 ? `${game.player.fireArrowCooldown.toFixed(1)}s` : "Ready"],
      ["Fire AoE Radius", game.isFireArrowUnlocked() ? game.getFireArrowBlastRadius().toFixed(1) : "-"],
      ["Pierce Chance", `${(game.getPiercingChance() * 100).toFixed(1)}%`],
      ["Multiarrow", `${game.getMultiarrowCount()} (${game.getMultiarrowSpreadDeg().toFixed(1)}deg)`],
      ["Tree SP", `${game.skillPoints} available`]
    ]);
  } else if (game.isWarriorClass && game.isWarriorClass()) {
    classKit = createSection("Warrior Kit", [
      ["Frenzy Skill", `Lv ${game.skills.warriorMomentum.points}`],
      ["Frenzy", game.warriorMomentumTimer > 0 ? `${game.warriorMomentumTimer.toFixed(1)}s` : "Idle"],
      ["Rage Skill", `Lv ${game.skills.warriorRage.points}`],
      [
        "Rage",
        game.warriorRageActiveTimer > 0
          ? `Active ${game.warriorRageActiveTimer.toFixed(1)}s`
          : game.warriorRageCooldownTimer > 0
          ? `Cooldown ${game.warriorRageCooldownTimer.toFixed(1)}s`
          : "Ready"
      ],
      ["Execute", `${(game.getWarriorExecuteChance() * 100).toFixed(1)}% @ ${(game.getWarriorExecuteThreshold() * 100).toFixed(1)}% HP`]
    ]);
  } else if (game.isNecromancerClass && game.isNecromancerClass()) {
    classKit = createSection("Necromancer Kit", [
      ["Control Mastery", `Lv ${getNecromancerTalentPoints(game, "controlMastery")}`],
      ["Cold Command", `Lv ${getNecromancerTalentPoints(game, "coldCommand")}`],
      ["Controlled Undead", `${game.getControlledUndeadCount()}/${game.getNecromancerControlCap()}`],
      ["Charm Time", `${game.getNecromancerCharmDuration().toFixed(2)}s`],
      ["Death Bolt", `Lv ${getNecromancerTalentPoints(game, "deathBoltActive")}`],
      ["Death Bolt Dmg", `${game.getDeathBoltBaseDamage().toFixed(1)}`],
      ["Plaguecraft", `Lv ${getNecromancerTalentPoints(game, "plaguecraft")}`]
    ]);
  }

  const scaling = createSection("Scaling", [
    ["Gold Find", `x${game.getGoldFindMultiplier().toFixed(2)}`],
    ["Drop Rate", `${(game.getGoldDropRate() * 100).toFixed(1)}%`],
    ["Health Drop", `${(game.getHealthDropRate().toFixed(3) * 100).toFixed(1)}%`],
    ["Spawn Scale", `x${game.getEnemySpawnRateScale().toFixed(2)}`]
  ]);

  return [
    [core],
    [combat, scaling],
    [classKit].filter(Boolean)
  ];
}

function drawColumn(renderer, x, topY, width, bottomY, sections) {
  const ctx = renderer.ctx;
  let y = topY;
  const rowHeight = 16;
  for (const section of sections) {
    if (!section || !Array.isArray(section.rows) || section.rows.length === 0) continue;
    if (y > bottomY - 14) break;
    ctx.fillStyle = "#9db0cf";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillText(section.title.toUpperCase(), x, y);
    y += rowHeight;
    ctx.font = "13px Trebuchet MS";
    const valueX = x + Math.max(120, width * 0.5);
    for (const [label, value] of section.rows) {
      if (y > bottomY) break;
      ctx.fillStyle = "#cfd6e7";
      ctx.fillText(label, x, y);
      ctx.fillStyle = "#f2efe3";
      ctx.fillText(value, valueX, y);
      y += rowHeight;
    }
    y += 8;
  }
}

function drawStatsTabs(ctx, game, x, y, panelW) {
  const tabW = 102;
  const tabH = 28;
  const gap = 8;
  const runRect = { x, y, w: tabW, h: tabH };
  const characterRect = { x: x + tabW + gap, y, w: tabW + 24, h: tabH };
  game.uiRects.statsRunTab = runRect;
  game.uiRects.statsCharacterTab = characterRect;
  const tabs = [
    { rect: runRect, label: "Run", active: game.statsPanelView !== "character" },
    { rect: characterRect, label: "Character", active: game.statsPanelView === "character" }
  ];
  for (const tab of tabs) {
    ctx.fillStyle = tab.active ? "rgba(88, 130, 105, 0.95)" : "rgba(39, 53, 79, 0.9)";
    ctx.fillRect(tab.rect.x, tab.rect.y, tab.rect.w, tab.rect.h);
    ctx.strokeStyle = tab.active ? "rgba(212, 238, 198, 0.82)" : "rgba(126, 139, 171, 0.65)";
    ctx.strokeRect(tab.rect.x, tab.rect.y, tab.rect.w, tab.rect.h);
    ctx.fillStyle = "#f3efe3";
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(tab.label, tab.rect.x + 22, tab.rect.y + 18);
  }
  const summary = game.statsPanelView === "character" ? "Character build and combat profile" : "Run telemetry and encounter totals";
  ctx.fillStyle = "#b7c0d6";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText(summary, x + panelW - 260, y + 18);
}

export function drawPlayerStatsPanel(renderer, game, layout, panelY) {
  const ctx = renderer.ctx;
  const panelX = layout.sidebarX + renderer.sidebarPadding;
  const panelW = layout.sidebarW - renderer.sidebarPadding * 2;
  const isNecromancer = game.isNecromancerClass && game.isNecromancerClass();
  const panelH = isNecromancer ? 158 : 142;
  const outpace = game.getEnemyOutpacingStatus();
  const playerHandle = typeof game.playerHandle === "string" && game.playerHandle.trim()
    ? game.playerHandle.trim()
    : "Player";
  const classLabel = game.classSpec?.label || "Unknown";
  ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "rgba(126, 139, 171, 0.65)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText(playerHandle, panelX + 10, panelY + 19);
  ctx.fillStyle = "#aebbd8";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText(classLabel, panelX + 10, panelY + 34);
  if (isNecromancer) {
    drawNecromancerPetOrbs(ctx, game, panelX + 10, panelY + 49);
  }
  if (game.hasKey) {
    const badgeW = 132;
    const badgeH = 18;
    const badgeX = panelX + panelW - badgeW - 10;
    const badgeY = panelY + 6;
    const pulse = 0.75 + Math.sin(game.time * 5.2) * 0.25;
    ctx.fillStyle = `rgba(80, 137, 96, ${0.72 + pulse * 0.18})`;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = "rgba(202, 246, 186, 0.92)";
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);
    ctx.fillStyle = "#f2ffe8";
    ctx.font = "bold 11px Trebuchet MS";
    ctx.fillText("KEY FOUND - EXIT OPEN", badgeX + 8, badgeY + 12);
  }
  ctx.font = "13px Trebuchet MS";
  ctx.fillStyle = "#cfd6e7";
  const statsRowY = isNecromancer ? panelY + 70 : panelY + 56;
  const enemyRowY = isNecromancer ? panelY + 91 : panelY + 77;
  const paceRowY = isNecromancer ? panelY + 112 : panelY + 98;
  ctx.fillText(`Gold ${game.gold}`, panelX + 10, statsRowY);
  ctx.fillText(`Lvl ${game.level}`, panelX + 94, statsRowY);
  ctx.fillText(`SP ${game.skillPoints}`, panelX + 152, statsRowY);
  ctx.fillText(`Enemies ${game.enemies.length}`, panelX + 10, enemyRowY);
  ctx.fillText("Pace", panelX + 10, paceRowY);
  ctx.fillStyle = outpace.color;
  ctx.fillText(outpace.label, panelX + 42, paceRowY);
  drawAbilityCooldownWidget(renderer, game, panelX + panelW - 64, isNecromancer ? panelY + 58 : panelY + 44, 42);

  const buttonW = Math.floor((panelW - 20) / 3);
  const buttonH = 28;
  const buttonX = panelX + 10;
  const buttonGap = 5;
  const skillButtonX = buttonX + buttonW + buttonGap;
  const statsButtonX = skillButtonX + buttonW + buttonGap;
  const buttonY = panelY + panelH - buttonH - 8;
  game.uiRects.shopButton = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
  game.uiRects.skillTreeButton = { x: skillButtonX, y: buttonY, w: buttonW, h: buttonH };
  game.uiRects.statsButton = { x: statsButtonX, y: buttonY, w: buttonW, h: buttonH };

  drawHudButton(ctx, game.uiRects.shopButton, game.shopOpen ? "Resume" : "Shop", game.shopOpen, "rgba(156, 113, 64, 0.95)");
  drawHudButton(ctx, game.uiRects.skillTreeButton, game.skillTreeOpen ? "Resume" : "Skill Tree", game.skillTreeOpen, "rgba(133, 74, 122, 0.95)");
  drawHudButton(ctx, game.uiRects.statsButton, game.statsPanelOpen ? "Hide Stats" : "Stats", game.statsPanelOpen, "rgba(88, 130, 105, 0.95)");

  const panelBottom = panelY + panelH;
  if (!game.statsPanelOpen) return panelBottom;
  const overlayX = 16;
  const overlayY = layout.topHudH + 12;
  const overlayW = layout.playW + layout.sidebarW - 32;
  const overlayH = renderer.canvas.height - layout.topHudH - layout.xpBarH - 24;
  const closeRect = { x: overlayX + overlayW - 28, y: overlayY + 10, w: 18, h: 18 };
  game.uiRects.statsClose = closeRect;

  ctx.fillStyle = "rgba(8, 12, 18, 0.97)";
  ctx.fillRect(overlayX, overlayY, overlayW, overlayH);
  ctx.strokeStyle = "rgba(126, 139, 171, 0.75)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(overlayX, overlayY, overlayW, overlayH);

  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 16px Trebuchet MS";
  ctx.fillText("Stats", overlayX + 14, overlayY + 24);
  ctx.fillStyle = "rgba(132, 78, 78, 0.95)";
  ctx.fillRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.fillText("X", closeRect.x + 5, closeRect.y + 13);

  drawStatsTabs(ctx, game, overlayX + 14, overlayY + 36, overlayW - 28);

  const columns = game.statsPanelView === "character" ? buildCharacterColumns(game) : buildRunColumns(game);
  const contentX = overlayX + 14;
  const contentY = overlayY + 86;
  const contentW = overlayW - 28;
  const gap = 18;
  const columnW = (contentW - gap * 2) / 3;
  const contentBottom = overlayY + overlayH - 14;

  for (let i = 0; i < columns.length; i++) {
    drawColumn(renderer, contentX + i * (columnW + gap), contentY, columnW, contentBottom, columns[i]);
  }

  if (game.gameOver) drawStatsGameOverActions(ctx, game, overlayX, overlayY, overlayW, overlayH);
  return panelBottom;
}
