export function drawPlayerStatsPanel(renderer, game, layout, panelY) {
  const ctx = renderer.ctx;
  const panelX = layout.sidebarX + renderer.sidebarPadding;
  const panelW = layout.sidebarW - renderer.sidebarPadding * 2;
  const panelH = 118;
  const outpace = game.getEnemyOutpacingStatus();
  const goblinCount = game.enemies.filter((enemy) => enemy.type === "goblin").length;
  const fireCdText = game.isWarriorClass && game.isWarriorClass()
    ? "N/A"
    : game.isNecromancerClass && game.isNecromancerClass()
    ? game.player.deathBoltCooldown > 0
      ? game.player.deathBoltCooldown.toFixed(1) + "s"
      : game.skills.deathBolt.points > 0
      ? "Ready"
      : "Locked"
    : !game.isFireArrowUnlocked()
    ? "Locked"
    : game.player.fireArrowCooldown > 0
    ? game.player.fireArrowCooldown.toFixed(1) + "s"
    : "Ready";

  ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "rgba(126, 139, 171, 0.65)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("HUD", panelX + 10, panelY + 19);
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
    ctx.font = "13px Trebuchet MS";
  }
  ctx.font = "13px Trebuchet MS";
  ctx.fillStyle = "#cfd6e7";
  ctx.fillText(`Gold ${game.gold}`, panelX + 10, panelY + 39);
  ctx.fillText(`Lvl ${game.level}`, panelX + 92, panelY + 39);
  ctx.fillText(`SP ${game.skillPoints}`, panelX + 150, panelY + 39);
  ctx.fillText(`Enemies ${game.enemies.length} (G:${goblinCount})`, panelX + 10, panelY + 58);
  ctx.fillText(`Fire ${fireCdText}`, panelX + 10, panelY + 77);
  ctx.fillText("Pace", panelX + 10, panelY + 96);
  ctx.fillStyle = outpace.color;
  ctx.fillText(outpace.label, panelX + 52, panelY + 96);

  const buttonW = Math.floor((panelW - 40) / 3);
  const buttonH = 28;
  const buttonX = panelX + 10;
  const skillButtonX = buttonX + buttonW + 10;
  const statsButtonX = skillButtonX + buttonW + 10;
  const buttonY = panelY + panelH - buttonH - 8;
  game.uiRects.shopButton = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
  game.uiRects.skillTreeButton = { x: skillButtonX, y: buttonY, w: buttonW, h: buttonH };
  game.uiRects.statsButton = { x: statsButtonX, y: buttonY, w: buttonW, h: buttonH };

  ctx.fillStyle = game.shopOpen ? "rgba(156, 113, 64, 0.95)" : "rgba(95, 126, 189, 0.92)";
  ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.72)";
  ctx.strokeRect(buttonX, buttonY, buttonW, buttonH);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText(game.shopOpen ? "Resume" : "Shop", buttonX + 34, buttonY + 19);

  ctx.fillStyle = game.skillTreeOpen ? "rgba(133, 74, 122, 0.95)" : "rgba(95, 126, 189, 0.92)";
  ctx.fillRect(skillButtonX, buttonY, buttonW, buttonH);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.72)";
  ctx.strokeRect(skillButtonX, buttonY, buttonW, buttonH);
  ctx.fillStyle = "#f3efe3";
  ctx.fillText(game.skillTreeOpen ? "Resume" : "Skill Tree", skillButtonX + 26, buttonY + 19);

  ctx.fillStyle = game.statsPanelOpen ? "rgba(88, 130, 105, 0.95)" : "rgba(95, 126, 189, 0.92)";
  ctx.fillRect(statsButtonX, buttonY, buttonW, buttonH);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.72)";
  ctx.strokeRect(statsButtonX, buttonY, buttonW, buttonH);
  ctx.fillStyle = "#f3efe3";
  ctx.fillText(game.statsPanelOpen ? "Hide Stats" : "Stats", statsButtonX + 30, buttonY + 19);

  if (!game.statsPanelOpen) return;

  const fullY = panelY + panelH + 8;
  const fullH = renderer.canvas.height - fullY - renderer.sidebarPadding;
  ctx.fillStyle = "rgba(8, 12, 18, 0.94)";
  ctx.fillRect(panelX, fullY, panelW, fullH);
  ctx.strokeStyle = "rgba(126, 139, 171, 0.65)";
  ctx.strokeRect(panelX, fullY, panelW, fullH);
  const closeRect = { x: panelX + panelW - 24, y: fullY + 8, w: 16, h: 16 };
  game.uiRects.statsClose = closeRect;
  ctx.fillStyle = "rgba(132, 78, 78, 0.95)";
  ctx.fillRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 12px Trebuchet MS";
  ctx.fillText("X", closeRect.x + 4, closeRect.y + 12);

  ctx.fillStyle = "#f2efe3";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("Player Stats", panelX + 10, fullY + 22);
  ctx.font = "13px Trebuchet MS";
  let y = fullY + 42;
  const row = (label, value) => {
    if (y > fullY + fullH - 8) return;
    ctx.fillStyle = "#cfd6e7";
    ctx.fillText(label, panelX + 10, y);
    ctx.fillStyle = "#f2efe3";
    ctx.fillText(value, panelX + 154, y);
    y += 15;
  };

  row("Health", `${game.player.health}/${game.player.maxHealth}`);
  row("XP", `${game.experience}/${game.expToNextLevel}`);
  row("Move Speed", `${game.getPlayerMoveSpeed().toFixed(1)}`);
  row("Pickup Radius", `${game.getPickupRadius().toFixed(1)}`);
  row("Atk Speed", `${game.getAttackSpeed().toFixed(2)}/s`);
  const dmgRange = game.getPrimaryDamageRange();
  row("Atk Damage", `${dmgRange.min.toFixed(1)}-${dmgRange.max.toFixed(1)}`);
  row("Life Leech", `${(game.getLifeLeechPercent() * 100).toFixed(1)}%`);
  row("Defense", `${game.getDefenseFlatReduction().toFixed(1)}`);
  row("Gold Find", `x${game.getGoldFindMultiplier().toFixed(2)}`);
  row("Drop Rate", `${(game.getGoldDropRate() * 100).toFixed(1)}%`);
  row("Health Drop", `${(game.getHealthDropRate().toFixed(3) * 100).toFixed(1)}%`);
  row("Spawn Scale", `x${game.getEnemySpawnRateScale().toFixed(2)}`);
  row("Enemy Cap", `${game.getActiveEnemyCap()}`);
  row("Players", `${game.getActivePlayerCount()}`);
  row("Class", game.classSpec.label);
  row(
    "Range/Reach",
    game.isWarriorClass && game.isWarriorClass()
      ? `${(game.classSpec.meleeRange || 42).toFixed(0)} melee`
      : game.isNecromancerClass && game.isNecromancerClass()
      ? `${((game.config.necromancer?.controlRangeTiles || 10) * game.config.map.tile).toFixed(0)} beam`
      : game.classSpec.usesRanged
      ? `${(game.getProjectileSpeed ? game.getProjectileSpeed() : game.config.player.projectileSpeed).toFixed(0)} arrow`
      : `${(game.classSpec.meleeRange || 42).toFixed(0)} melee`
  );
  row("Fire Arrow", game.isArcherClass && game.isArcherClass() ? `${game.isFireArrowUnlocked() ? `Lv ${game.skills.fireArrow.points}` : "Locked"}` : "N/A");
  row("Fire AoE Radius", game.isArcherClass && game.isArcherClass() ? `${game.isFireArrowUnlocked() ? game.getFireArrowBlastRadius().toFixed(1) : "-"}` : "N/A");
  row("Pierce Chance", game.isArcherClass && game.isArcherClass() ? `${(game.getPiercingChance() * 100).toFixed(1)}%` : "N/A");
  row("Multiarrow", game.isArcherClass && game.isArcherClass() ? `${game.getMultiarrowCount()} (${game.getMultiarrowSpreadDeg().toFixed(1)}deg)` : "N/A");
  row("Frenzy Skill", game.isWarriorClass && game.isWarriorClass() ? `Lv ${game.skills.warriorMomentum.points} (+${(game.getWarriorMomentumMoveBonus() * 100).toFixed(0)}%)` : "N/A");
  row("Frenzy", game.isWarriorClass && game.isWarriorClass() ? game.warriorMomentumTimer > 0 ? `${game.warriorMomentumTimer.toFixed(1)}s` : "Idle" : "N/A");
  row("Rage Skill", game.isWarriorClass && game.isWarriorClass() ? `Lv ${game.skills.warriorRage.points} (CD ${game.getWarriorRageCooldown().toFixed(1)}s)` : "N/A");
  row("Rage", game.isWarriorClass && game.isWarriorClass() ? game.warriorRageActiveTimer > 0 ? `Active ${game.warriorRageActiveTimer.toFixed(1)}s` : game.warriorRageCooldownTimer > 0 ? `Cooldown ${game.warriorRageCooldownTimer.toFixed(1)}s` : "Ready" : "N/A");
  row("Rage Dmg Bonus", game.isWarriorClass && game.isWarriorClass() ? `+${game.getWarriorRageBaseDamageBonus().toFixed(2)} base` : "N/A");
  row("Victory Rush", game.isWarriorClass && game.isWarriorClass() ? `+${(game.getWarriorRageVictoryRushPerKillPct() * 100).toFixed(1)}% max HP per kill, ${((game.getWarriorRageVictoryRushPoolCap() / Math.max(1, game.player.maxHealth)) * 100).toFixed(0)}% cap` : "N/A");
  row("Control Mastery", game.isNecromancerClass && game.isNecromancerClass() ? `Lv ${game.skills.undeadMastery.points} (${game.getControlledUndeadCount()}/${game.getNecromancerControlCap()}, ${game.getNecromancerCharmDuration().toFixed(2)}s)` : "N/A");
  row("Death Bolt", game.isNecromancerClass && game.isNecromancerClass() ? `Lv ${game.skills.deathBolt.points} (${game.getDeathBoltBaseDamage().toFixed(1)} dmg, +${((game.getDeathBoltPetDamageMultiplier() - 1) * 100).toFixed(0)}% pet dmg)` : "N/A");
  row("Augment Death", game.isNecromancerClass && game.isNecromancerClass() ? `Lv ${game.skills.explodingDeath.points} (+${((game.getControlledUndeadBoost() - 1) * 100).toFixed(0)}%, ${game.skills.explodingDeath.points >= 3 ? `${game.getDeathExplosionDamage().toFixed(1)} dmg` : "inactive"})` : "N/A");
  row("Key", `${game.hasKey ? "Yes" : "No"}`);
  row("Enemy Speed", `x${game.getEnemySpeedScale().toFixed(2)}`);
  row("Enemy Damage", `x${game.getEnemyDamageScale().toFixed(2)}`);
  row("Enemy Defense", `x${game.getEnemyDefenseScale().toFixed(2)}`);
  row("Enemy Spawn Int", `${game.getEnemySpawnInterval().toFixed(2)}s`);
}
