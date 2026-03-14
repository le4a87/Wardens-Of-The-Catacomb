export function drawShopMenu(renderer, game, layout) {
  const ctx = renderer.ctx;
  const menuW = 520;
  const menuH = 378;
  const menuX = Math.floor((layout.playW - menuW) / 2);
  const menuY = Math.floor((renderer.canvas.height - menuH) / 2);

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

  const rowH = 50;
  const contentTop = menuY + 46;
  const footerH = 36;
  const contentBottom = menuY + menuH - footerH;
  const visibleH = contentBottom - contentTop;
  const contentHeight = game.shopOrder.length * rowH + 6;
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
  for (const key of game.shopOrder) {
    const upgrade = game.upgrades[key];
    const cost = game.getUpgradeCost(key);
    const isMax = !Number.isFinite(cost);
    const canBuy = game.canBuyUpgrade(key);

    ctx.fillStyle = "rgba(20, 28, 41, 0.92)";
    ctx.fillRect(menuX + 12, rowY, menuW - 24, rowH - 4);
    ctx.strokeStyle = "rgba(109, 125, 156, 0.52)";
    ctx.strokeRect(menuX + 12, rowY, menuW - 24, rowH - 4);

    ctx.fillStyle = "#f1ede0";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText(upgrade.label, menuX + 22, rowY + 20);
    ctx.fillStyle = "#b9c3d9";
    ctx.font = "13px Trebuchet MS";
    ctx.fillText(`Level ${upgrade.level}/${upgrade.maxLevel}`, menuX + 22, rowY + 38);

    let valueText = "";
    if (key === "moveSpeed") valueText = `x${game.getMoveSpeedMultiplier().toFixed(2)} move`;
    if (key === "enemySpawnRate") valueText = `x${game.getEnemySpawnRateMultiplier().toFixed(2)} spawn`;
    if (key === "goldFind") valueText = `x${game.getGoldFindMultiplier().toFixed(2)} gold`;
    if (key === "attackSpeed") valueText = `x${game.getAttackSpeedMultiplier().toFixed(2)} attack`;
    if (key === "damage") valueText = `x${game.getDamageMultiplier().toFixed(2)} damage`;
    if (key === "defense") valueText = `-${game.getDefenseFlatReduction().toFixed(1)} hit dmg`;
    ctx.fillStyle = "#9eb6df";
    ctx.fillText(valueText, menuX + 188, rowY + 29);

    const buyRect = { x: menuX + menuW - 126, y: rowY + 9, w: 96, h: 30 };
    game.uiRects.shopItems.push({ key, rect: buyRect });
    ctx.fillStyle = isMax ? "rgba(68, 76, 92, 0.95)" : canBuy ? "rgba(77, 132, 89, 0.95)" : "rgba(99, 85, 66, 0.95)";
    ctx.fillRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h);
    ctx.strokeStyle = "rgba(220, 224, 233, 0.52)";
    ctx.strokeRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h);
    ctx.fillStyle = "#f4efe1";
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(isMax ? "MAXED" : `${cost}g`, buyRect.x + 27, buyRect.y + 20);

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
  ctx.fillText("Mouse wheel to scroll items.", menuX + 14, menuY + menuH - 28);
  ctx.fillText(`Skill Points: ${game.skillPoints}`, menuX + 14, menuY + menuH - 12);
}

export function drawSkillTreeMenu(renderer, game, layout) {
  const ctx = renderer.ctx;
  const menuW = 520;
  const menuH = Math.min(renderer.canvas.height - 30, 560);
  const menuX = Math.floor((layout.playW - menuW) / 2);
  const menuY = Math.floor((renderer.canvas.height - menuH) / 2);
  const fireSkill = game.skills.fireArrow;
  const pierceSkill = game.skills.piercingStrike;
  const multiarrowSkill = game.skills.multiarrow;
  const canSpend = game.skillPoints > 0 && fireSkill.points < fireSkill.maxPoints;
  const canSpendPierce = game.skillPoints > 0 && pierceSkill.points < pierceSkill.maxPoints;
  const canSpendMulti = game.skillPoints > 0 && multiarrowSkill.points < multiarrowSkill.maxPoints;
  const unlocked = game.isFireArrowUnlocked();
  const nextPoints = Math.min(fireSkill.maxPoints, fireSkill.points + 1);
  const curImpact = game.getFireArrowImpactDamage(fireSkill.points);
  const curRadius = game.getFireArrowBlastRadius(fireSkill.points);
  const curDps = game.getFireArrowLingerDps(fireSkill.points);
  const nextImpact = game.getFireArrowImpactDamage(nextPoints);
  const nextRadius = game.getFireArrowBlastRadius(nextPoints);
  const nextDps = game.getFireArrowLingerDps(nextPoints);
  const nextPiercePoints = Math.min(pierceSkill.maxPoints, pierceSkill.points + 1);
  const curPierce = game.getPiercingChance(pierceSkill.points);
  const nextPierce = game.getPiercingChance(nextPiercePoints);
  const nextMultiPoints = Math.min(multiarrowSkill.maxPoints, multiarrowSkill.points + 1);
  const curMultiCount = game.getMultiarrowCount(multiarrowSkill.points);
  const curMultiSpread = game.getMultiarrowSpreadDeg(multiarrowSkill.points);
  const curMultiDmg = game.getMultiarrowDamageMultiplier(multiarrowSkill.points);
  const nextMultiCount = game.getMultiarrowCount(nextMultiPoints);
  const nextMultiSpread = game.getMultiarrowSpreadDeg(nextMultiPoints);
  const nextMultiDmg = game.getMultiarrowDamageMultiplier(nextMultiPoints);
  const momentumSkill = game.skills.warriorMomentum;
  const canSpendMomentum = game.skillPoints > 0 && momentumSkill.points < momentumSkill.maxPoints;
  const nextMomentumPoints = Math.min(momentumSkill.maxPoints, momentumSkill.points + 1);
  const curMomentumBonus = game.getWarriorMomentumMoveBonus(momentumSkill.points);
  const nextMomentumBonus = game.getWarriorMomentumMoveBonus(nextMomentumPoints);
  const curMomentumDur = game.getWarriorMomentumDuration(momentumSkill.points);
  const nextMomentumDur = game.getWarriorMomentumDuration(nextMomentumPoints);
  const rageSkill = game.skills.warriorRage;
  const canSpendRage = game.skillPoints > 0 && rageSkill.points < rageSkill.maxPoints;
  const nextRagePoints = Math.min(rageSkill.maxPoints, rageSkill.points + 1);
  const curRageCd = game.getWarriorRageCooldown(rageSkill.points);
  const nextRageCd = game.getWarriorRageCooldown(nextRagePoints);
  const curRageBase = game.getWarriorRageBaseDamageBonus(rageSkill.points);
  const nextRageBase = game.getWarriorRageBaseDamageBonus(nextRagePoints);
  const executeSkill = game.skills.warriorExecute;
  const canSpendExecute = game.skillPoints > 0 && executeSkill.points < executeSkill.maxPoints;
  const nextExecutePoints = Math.min(executeSkill.maxPoints, executeSkill.points + 1);
  const curExecuteChance = game.getWarriorExecuteChance(executeSkill.points);
  const nextExecuteChance = game.getWarriorExecuteChance(nextExecutePoints);
  const curExecuteThreshold = game.getWarriorExecuteThreshold(executeSkill.points);
  const nextExecuteThreshold = game.getWarriorExecuteThreshold(nextExecutePoints);

  ctx.fillStyle = "rgba(4, 7, 11, 0.78)";
  ctx.fillRect(0, 0, layout.playW, renderer.canvas.height);

  ctx.fillStyle = "rgba(16, 11, 21, 0.95)";
  ctx.fillRect(menuX, menuY, menuW, menuH);
  ctx.strokeStyle = "rgba(179, 136, 215, 0.75)";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(menuX, menuY, menuW, menuH);

  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 20px Trebuchet MS";
  ctx.fillText("Skill Tree", menuX + 16, menuY + 30);
  ctx.font = "14px Trebuchet MS";
  ctx.fillStyle = "#d8dfef";
  ctx.fillText(`Skill Points: ${game.skillPoints}`, menuX + menuW - 150, menuY + 30);

  const closeRect = { x: menuX + menuW - 34, y: menuY + 10, w: 20, h: 20 };
  game.uiRects.skillTreeClose = closeRect;
  ctx.fillStyle = "rgba(140, 78, 78, 0.9)";
  ctx.fillRect(closeRect.x, closeRect.y, closeRect.w, closeRect.h);
  ctx.fillStyle = "#f4ece6";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("X", closeRect.x + 6, closeRect.y + 15);

  const contentTop = menuY + 50;
  const contentBottom = menuY + menuH - 8;
  const visibleH = contentBottom - contentTop;
  const contentHeight = !game.classSpec.usesRanged ? 836 : 582;
  const scrollMax = Math.max(0, contentHeight - visibleH);
  const scroll = Math.max(0, Math.min(scrollMax, game.uiScroll?.skillTree || 0));
  game.uiScroll.skillTree = scroll;
  game.uiRects.skillTreeScrollArea = { x: menuX + 8, y: contentTop, w: menuW - 16, h: visibleH };
  game.uiRects.skillTreeScrollMax = scrollMax;
  const sy = (y) => y - scroll;

  ctx.save();
  ctx.beginPath();
  ctx.rect(menuX + 8, contentTop, menuW - 16, visibleH);
  ctx.clip();

  if (!game.classSpec.usesRanged) {
    const card = { x: menuX + 22, y: sy(menuY + 58), w: menuW - 44, h: 208 };
    ctx.fillStyle = "rgba(34, 24, 18, 0.94)";
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = "rgba(205, 156, 106, 0.75)";
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    ctx.fillStyle = "#f4e9da";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.fillText("Frenzy", card.x + 14, card.y + 28);
    ctx.font = "14px Trebuchet MS";
    ctx.fillStyle = "#dfc8ab";
    ctx.fillText(`Points: ${momentumSkill.points}/${momentumSkill.maxPoints}`, card.x + 14, card.y + 50);
    ctx.fillText(`Active: ${game.warriorMomentumTimer > 0 ? `${game.warriorMomentumTimer.toFixed(1)}s` : "No"}`, card.x + 220, card.y + 50);

    ctx.fillStyle = "#f0dcc2";
    ctx.fillText(`Move Speed Bonus: +${(curMomentumBonus * 100).toFixed(1)}%`, card.x + 14, card.y + 78);
    ctx.fillText(`Duration: ${curMomentumDur.toFixed(2)}s`, card.x + 14, card.y + 98);
    ctx.fillStyle = "#cdb89b";
    ctx.fillText("Defeating an enemy grants temporary move speed.", card.x + 14, card.y + 124);

    if (momentumSkill.points >= momentumSkill.maxPoints) {
      ctx.fillStyle = "#9f95b3";
      ctx.fillText("Next Point: MAXED", card.x + 14, card.y + 152);
    } else {
      ctx.fillStyle = "#9ee0ad";
      ctx.fillText(
        `Next: +${((nextMomentumBonus - curMomentumBonus) * 100).toFixed(2)}% speed, +${(nextMomentumDur - curMomentumDur).toFixed(2)}s`,
        card.x + 14,
        card.y + 152
      );
    }

    const spendRect = { x: card.x + card.w - 142, y: card.y + card.h - 50, w: 124, h: 34 };
    game.uiRects.skillWarriorMomentumNode = spendRect;
    ctx.fillStyle = canSpendMomentum ? "rgba(112, 160, 98, 0.95)" : "rgba(80, 76, 90, 0.95)";
    ctx.fillRect(spendRect.x, spendRect.y, spendRect.w, spendRect.h);
    ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
    ctx.strokeRect(spendRect.x, spendRect.y, spendRect.w, spendRect.h);
    ctx.fillStyle = "#f3efe3";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText("Spend 1 SP", spendRect.x + 20, spendRect.y + 22);

    const rageCard = { x: menuX + 22, y: card.y + card.h + 12, w: menuW - 44, h: 208 };
    ctx.fillStyle = "rgba(43, 19, 19, 0.95)";
    ctx.fillRect(rageCard.x, rageCard.y, rageCard.w, rageCard.h);
    ctx.strokeStyle = "rgba(214, 109, 109, 0.8)";
    ctx.strokeRect(rageCard.x, rageCard.y, rageCard.w, rageCard.h);

    ctx.fillStyle = "#f8ecec";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.fillText("Rage", rageCard.x + 14, rageCard.y + 28);
    ctx.font = "14px Trebuchet MS";
    ctx.fillStyle = "#efc8c8";
    ctx.fillText(`Points: ${rageSkill.points}/${rageSkill.maxPoints}`, rageCard.x + 14, rageCard.y + 50);
    const rageStatus = (game.warriorRageActiveTimer || 0) > 0
      ? `ACTIVE ${game.warriorRageActiveTimer.toFixed(1)}s`
      : (game.warriorRageCooldownTimer || 0) > 0
      ? `Cooldown ${game.warriorRageCooldownTimer.toFixed(1)}s`
      : "Ready";
    ctx.fillText(rageStatus, rageCard.x + 220, rageCard.y + 50);

    ctx.fillStyle = "#ffd9d9";
    ctx.fillText("Duration: 10.0s", rageCard.x + 14, rageCard.y + 78);
    ctx.fillText(`Cooldown: ${curRageCd.toFixed(1)}s`, rageCard.x + 14, rageCard.y + 98);
    ctx.fillText(`Base Weapon Damage Bonus: +${curRageBase.toFixed(2)}`, rageCard.x + 14, rageCard.y + 118);
    ctx.fillStyle = "#f2bcbc";
    ctx.fillText("Right click to activate: half incoming damage while active.", rageCard.x + 14, rageCard.y + 142);

    if (rageSkill.points >= rageSkill.maxPoints) {
      ctx.fillStyle = "#c5a5a5";
      ctx.fillText("Next Point: MAXED", rageCard.x + 14, rageCard.y + 166);
    } else {
      ctx.fillStyle = "#9ee0ad";
      ctx.fillText(
        `Next: ${Math.max(0, curRageCd - nextRageCd).toFixed(2)}s shorter CD, +${(nextRageBase - curRageBase).toFixed(2)} base dmg`,
        rageCard.x + 14,
        rageCard.y + 166
      );
    }

    const rageSpendRect = { x: rageCard.x + rageCard.w - 142, y: rageCard.y + rageCard.h - 50, w: 124, h: 34 };
    game.uiRects.skillWarriorRageNode = rageSpendRect;
    ctx.fillStyle = canSpendRage ? "rgba(112, 160, 98, 0.95)" : "rgba(80, 76, 90, 0.95)";
    ctx.fillRect(rageSpendRect.x, rageSpendRect.y, rageSpendRect.w, rageSpendRect.h);
    ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
    ctx.strokeRect(rageSpendRect.x, rageSpendRect.y, rageSpendRect.w, rageSpendRect.h);
    ctx.fillStyle = "#f3efe3";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText("Spend 1 SP", rageSpendRect.x + 20, rageSpendRect.y + 22);

    const executeCard = { x: menuX + 22, y: rageCard.y + rageCard.h + 12, w: menuW - 44, h: 188 };
    ctx.fillStyle = "rgba(46, 16, 16, 0.95)";
    ctx.fillRect(executeCard.x, executeCard.y, executeCard.w, executeCard.h);
    ctx.strokeStyle = "rgba(232, 93, 93, 0.78)";
    ctx.strokeRect(executeCard.x, executeCard.y, executeCard.w, executeCard.h);

    ctx.fillStyle = "#f8ecec";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.fillText("Execute", executeCard.x + 14, executeCard.y + 28);
    ctx.font = "14px Trebuchet MS";
    ctx.fillStyle = "#efc8c8";
    ctx.fillText(`Points: ${executeSkill.points}/${executeSkill.maxPoints}`, executeCard.x + 14, executeCard.y + 50);
    ctx.fillText(`Chance: ${(curExecuteChance * 100).toFixed(1)}%`, executeCard.x + 215, executeCard.y + 50);

    ctx.fillStyle = "#ffd9d9";
    ctx.fillText(`Threshold: ${(curExecuteThreshold * 100).toFixed(1)}% HP`, executeCard.x + 14, executeCard.y + 78);
    ctx.fillStyle = "#f2bcbc";
    ctx.fillText("Melee hits can instantly kill weakened non-boss enemies.", executeCard.x + 14, executeCard.y + 106);
    ctx.fillText("Triggers after a hit drops them below the threshold.", executeCard.x + 14, executeCard.y + 126);

    if (executeSkill.points >= executeSkill.maxPoints) {
      ctx.fillStyle = "#c5a5a5";
      ctx.fillText("Next Point: MAXED", executeCard.x + 14, executeCard.y + 152);
    } else {
      ctx.fillStyle = "#9ee0ad";
      ctx.fillText(
        `Next: +${((nextExecuteChance - curExecuteChance) * 100).toFixed(2)}% chance, +${((nextExecuteThreshold - curExecuteThreshold) * 100).toFixed(2)}% HP`,
        executeCard.x + 14,
        executeCard.y + 152
      );
    }

    const executeSpendRect = { x: executeCard.x + executeCard.w - 142, y: executeCard.y + executeCard.h - 50, w: 124, h: 34 };
    game.uiRects.skillWarriorExecuteNode = executeSpendRect;
    ctx.fillStyle = canSpendExecute ? "rgba(112, 160, 98, 0.95)" : "rgba(80, 76, 90, 0.95)";
    ctx.fillRect(executeSpendRect.x, executeSpendRect.y, executeSpendRect.w, executeSpendRect.h);
    ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
    ctx.strokeRect(executeSpendRect.x, executeSpendRect.y, executeSpendRect.w, executeSpendRect.h);
    ctx.fillStyle = "#f3efe3";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText("Spend 1 SP", executeSpendRect.x + 20, executeSpendRect.y + 22);

    ctx.fillStyle = "rgba(22, 22, 30, 0.92)";
    ctx.fillRect(menuX + 22, executeCard.y + executeCard.h + 12, menuW - 44, 86);
    ctx.strokeStyle = "rgba(133, 139, 164, 0.45)";
    ctx.strokeRect(menuX + 22, executeCard.y + executeCard.h + 12, menuW - 44, 86);
    ctx.fillStyle = "#b9c3d8";
    ctx.font = "13px Trebuchet MS";
    ctx.fillText("Ranger skills (Fire Arrow, Piercing Strike, Multiarrow)", menuX + 36, executeCard.y + executeCard.h + 44);
    ctx.fillText("are unavailable for Warrior.", menuX + 36, executeCard.y + executeCard.h + 64);
    ctx.restore();
    return;
  }

  const card = { x: menuX + 22, y: sy(menuY + 58), w: menuW - 44, h: 205 };
  ctx.fillStyle = "rgba(28, 20, 37, 0.94)";
  ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.strokeStyle = unlocked ? "rgba(244, 165, 90, 0.8)" : "rgba(120, 98, 140, 0.65)";
  ctx.strokeRect(card.x, card.y, card.w, card.h);

  ctx.fillStyle = "#f4eee6";
  ctx.font = "bold 18px Trebuchet MS";
  ctx.fillText("Fire Arrow", card.x + 14, card.y + 28);
  ctx.font = "14px Trebuchet MS";
  ctx.fillStyle = "#c7b9d7";
  ctx.fillText(`Points: ${fireSkill.points}/${fireSkill.maxPoints}`, card.x + 14, card.y + 50);
  ctx.fillText(unlocked ? "Unlocked (Right Click)" : "Locked", card.x + 200, card.y + 50);

  ctx.fillStyle = "#e2d6bf";
  ctx.fillText(`Impact Damage: ${curImpact.toFixed(1)}`, card.x + 14, card.y + 78);
  ctx.fillText(`Blast Radius: ${curRadius.toFixed(1)}`, card.x + 14, card.y + 98);
  ctx.fillText(`Burn DPS: ${curDps.toFixed(1)}`, card.x + 14, card.y + 118);

  ctx.fillStyle = fireSkill.points >= fireSkill.maxPoints ? "#9f95b3" : "#9ee0ad";
  if (fireSkill.points >= fireSkill.maxPoints) {
    ctx.fillText("Next Point: MAXED", card.x + 14, card.y + 170);
  } else {
    ctx.fillText(
      `Next Point: +${(nextImpact - curImpact).toFixed(2)} dmg, +${(nextRadius - curRadius).toFixed(2)} radius, +${(nextDps - curDps).toFixed(2)} dps`,
      card.x + 14,
      card.y + 170
    );
  }

  ctx.fillStyle = "#b8a7ca";
  ctx.fillText("Each point increases power with diminishing returns.", card.x + 14, card.y + 148);

  const spendRect = { x: card.x + card.w - 142, y: card.y + card.h - 52, w: 124, h: 34 };
  game.uiRects.skillFireArrowNode = spendRect;
  ctx.fillStyle = canSpend ? "rgba(112, 160, 98, 0.95)" : "rgba(80, 76, 90, 0.95)";
  ctx.fillRect(spendRect.x, spendRect.y, spendRect.w, spendRect.h);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
  ctx.strokeRect(spendRect.x, spendRect.y, spendRect.w, spendRect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("Spend 1 SP", spendRect.x + 20, spendRect.y + 22);

  const pierceCard = { x: menuX + 22, y: sy(menuY + 276), w: menuW - 44, h: 180 };
  ctx.fillStyle = "rgba(21, 27, 41, 0.94)";
  ctx.fillRect(pierceCard.x, pierceCard.y, pierceCard.w, pierceCard.h);
  ctx.strokeStyle = "rgba(124, 164, 226, 0.72)";
  ctx.strokeRect(pierceCard.x, pierceCard.y, pierceCard.w, pierceCard.h);

  ctx.fillStyle = "#f4eee6";
  ctx.font = "bold 18px Trebuchet MS";
  ctx.fillText("Piercing Strike", pierceCard.x + 14, pierceCard.y + 28);
  ctx.font = "14px Trebuchet MS";
  ctx.fillStyle = "#c3cee7";
  ctx.fillText(`Points: ${pierceSkill.points}/${pierceSkill.maxPoints}`, pierceCard.x + 14, pierceCard.y + 50);
  ctx.fillText(`Chance: ${(curPierce * 100).toFixed(1)}%`, pierceCard.x + 215, pierceCard.y + 50);

  ctx.fillStyle = "#d7e0ef";
  ctx.fillText("Primary arrows have a chance to pass through enemies.", pierceCard.x + 14, pierceCard.y + 78);
  ctx.fillStyle = pierceSkill.points >= pierceSkill.maxPoints ? "#9aabcb" : "#95dfb0";
  if (pierceSkill.points >= pierceSkill.maxPoints) {
    ctx.fillText("Next Point: MAXED", pierceCard.x + 14, pierceCard.y + 106);
  } else {
    ctx.fillText(
      `Next Point: +${((nextPierce - curPierce) * 100).toFixed(2)}% (to ${(nextPierce * 100).toFixed(1)}%)`,
      pierceCard.x + 14,
      pierceCard.y + 106
    );
  }
  ctx.fillStyle = "#9ab0d2";
  ctx.fillText("Diminishing returns keep late points meaningful but smaller.", pierceCard.x + 14, pierceCard.y + 130);

  const pierceSpendRect = { x: pierceCard.x + pierceCard.w - 142, y: pierceCard.y + pierceCard.h - 48, w: 124, h: 34 };
  game.uiRects.skillPiercingNode = pierceSpendRect;
  ctx.fillStyle = canSpendPierce ? "rgba(96, 145, 206, 0.95)" : "rgba(80, 76, 90, 0.95)";
  ctx.fillRect(pierceSpendRect.x, pierceSpendRect.y, pierceSpendRect.w, pierceSpendRect.h);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
  ctx.strokeRect(pierceSpendRect.x, pierceSpendRect.y, pierceSpendRect.w, pierceSpendRect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText("Spend 1 SP", pierceSpendRect.x + 20, pierceSpendRect.y + 22);

  const multiCard = { x: menuX + 22, y: pierceCard.y + pierceCard.h + 12, w: menuW - 44, h: 92 };
  ctx.fillStyle = "rgba(22, 34, 24, 0.95)";
  ctx.fillRect(multiCard.x, multiCard.y, multiCard.w, multiCard.h);
  ctx.strokeStyle = "rgba(143, 189, 128, 0.75)";
  ctx.strokeRect(multiCard.x, multiCard.y, multiCard.w, multiCard.h);
  ctx.fillStyle = "#eef4e4";
  ctx.font = "bold 17px Trebuchet MS";
  ctx.fillText("Multiarrow", multiCard.x + 14, multiCard.y + 25);
  ctx.font = "13px Trebuchet MS";
  ctx.fillStyle = "#cfe2c8";
  ctx.fillText(`Points: ${multiarrowSkill.points}/${multiarrowSkill.maxPoints}`, multiCard.x + 14, multiCard.y + 45);
  ctx.fillText(
    `Now: ${curMultiCount} arrows, ${curMultiSpread.toFixed(1)}deg, x${curMultiDmg.toFixed(2)} dmg`,
    multiCard.x + 14,
    multiCard.y + 63
  );
  if (multiarrowSkill.points >= multiarrowSkill.maxPoints) {
    ctx.fillStyle = "#a0b19c";
    ctx.fillText("Next: MAXED", multiCard.x + 14, multiCard.y + 81);
  } else {
    ctx.fillStyle = "#9be7af";
    ctx.fillText(
      `Next: ${nextMultiCount} arrows, ${nextMultiSpread.toFixed(1)}deg, x${nextMultiDmg.toFixed(2)} dmg`,
      multiCard.x + 14,
      multiCard.y + 81
    );
  }

  const multiSpendRect = { x: multiCard.x + multiCard.w - 142, y: multiCard.y + multiCard.h - 42, w: 124, h: 30 };
  game.uiRects.skillMultiarrowNode = multiSpendRect;
  ctx.fillStyle = canSpendMulti ? "rgba(112, 160, 98, 0.95)" : "rgba(80, 76, 90, 0.95)";
  ctx.fillRect(multiSpendRect.x, multiSpendRect.y, multiSpendRect.w, multiSpendRect.h);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
  ctx.strokeRect(multiSpendRect.x, multiSpendRect.y, multiSpendRect.w, multiSpendRect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.fillText("Spend 1 SP", multiSpendRect.x + 20, multiSpendRect.y + 20);

  ctx.restore();

  if (scrollMax > 0) {
    const trackX = menuX + menuW - 10;
    const trackY = contentTop;
    const trackH = visibleH;
    const thumbH = Math.max(30, Math.floor((visibleH / contentHeight) * trackH));
    const thumbY = trackY + Math.floor((scroll / scrollMax) * (trackH - thumbH));
    ctx.fillStyle = "rgba(68, 76, 97, 0.7)";
    ctx.fillRect(trackX, trackY, 4, trackH);
    ctx.fillStyle = "rgba(180, 194, 228, 0.85)";
    ctx.fillRect(trackX, thumbY, 4, thumbH);
  }

  ctx.font = "12px Trebuchet MS";
  ctx.fillStyle = "#9d8bb7";
  ctx.fillText("Mouse wheel to scroll skills.", menuX + 18, menuY + menuH - 14);
}
