export function drawSkillRefundFooter(ctx, game, menuX, menuY, menuW, menuH) {
  const spentPoints = typeof game.getSpentSkillPointCount === "function" ? game.getSpentSkillPointCount() : 0;
  const refundCost = typeof game.getSkillRefundCost === "function" ? game.getSkillRefundCost(spentPoints, game.refundCount) : 0;
  const canRefund = typeof game.canRefundSkills === "function" ? game.canRefundSkills() : false;
  const noSpentPoints = spentPoints <= 0;
  const refundRect = { x: menuX + menuW - 158, y: menuY + menuH - 44, w: 136, h: 30 };
  game.uiRects.skillRefundButton = refundRect;

  ctx.fillStyle = "rgba(19, 18, 28, 0.98)";
  ctx.fillRect(menuX + 8, menuY + menuH - 56, menuW - 16, 44);
  ctx.strokeStyle = "rgba(111, 106, 138, 0.55)";
  ctx.strokeRect(menuX + 8, menuY + menuH - 56, menuW - 16, 44);

  ctx.font = "12px Trebuchet MS";
  ctx.fillStyle = "#d9d2e7";
  ctx.fillText(`Spent: ${spentPoints}`, menuX + 18, menuY + menuH - 31);
  ctx.fillText(`Refunds: ${Math.max(0, Math.floor(game.refundCount || 0))}`, menuX + 88, menuY + menuH - 31);
  if (noSpentPoints) {
    ctx.fillStyle = "#9f95b3";
    ctx.fillText("No spent points to refund.", menuX + 18, menuY + menuH - 16);
  } else if (canRefund) {
    ctx.fillStyle = "#99ddb2";
    ctx.fillText(`Refund all skills for ${refundCost}g.`, menuX + 18, menuY + menuH - 16);
  } else {
    ctx.fillStyle = "#d8b17c";
    ctx.fillText(`Need ${Math.max(0, refundCost - game.gold)}g more for refund (${refundCost}g).`, menuX + 18, menuY + menuH - 16);
  }

  ctx.fillStyle = noSpentPoints ? "rgba(80, 76, 90, 0.95)" : canRefund ? "rgba(150, 118, 74, 0.98)" : "rgba(99, 85, 66, 0.95)";
  ctx.fillRect(refundRect.x, refundRect.y, refundRect.w, refundRect.h);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
  ctx.strokeRect(refundRect.x, refundRect.y, refundRect.w, refundRect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.fillText(noSpentPoints ? "No Refund" : `${refundCost}g Refund`, refundRect.x + 20, refundRect.y + 20);
}

export function drawSkillTreeScrollbar(ctx, menuX, menuW, contentTop, visibleH, contentHeight, scroll, scrollMax) {
  if (scrollMax <= 0) return;
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

function drawSpendButton(ctx, rect, enabled, color, font = "bold 14px Trebuchet MS", label = "Spend 1 SP", textX = 20, textY = 22) {
  ctx.fillStyle = enabled ? color : "rgba(80, 76, 90, 0.95)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(232, 226, 211, 0.58)";
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = "#f3efe3";
  ctx.font = font;
  ctx.fillText(label, rect.x + textX, rect.y + textY);
}

export function drawNecromancerSkillTreeSection(ctx, game, menuX, menuY, menuW, sy) {
  const undeadMasterySkill = game.skills.undeadMastery;
  const deathBoltSkill = game.skills.deathBolt;
  const explodingDeathSkill = game.skills.explodingDeath;
  const canSpendUndeadMastery = game.skillPoints > 0 && undeadMasterySkill.points < undeadMasterySkill.maxPoints;
  const canSpendDeathBolt = game.skillPoints > 0 && deathBoltSkill.points < deathBoltSkill.maxPoints;
  const canSpendExplodingDeath = game.skillPoints > 0 && explodingDeathSkill.points < explodingDeathSkill.maxPoints;

  const masteryCard = { x: menuX + 22, y: sy(menuY + 58), w: menuW - 44, h: 196 };
  ctx.fillStyle = "rgba(18, 28, 45, 0.95)";
  ctx.fillRect(masteryCard.x, masteryCard.y, masteryCard.w, masteryCard.h);
  ctx.strokeStyle = "rgba(124, 177, 255, 0.82)";
  ctx.strokeRect(masteryCard.x, masteryCard.y, masteryCard.w, masteryCard.h);
  ctx.fillStyle = "#eef4ff";
  ctx.font = "bold 18px Trebuchet MS";
  ctx.fillText("Control Mastery", masteryCard.x + 14, masteryCard.y + 28);
  ctx.font = "14px Trebuchet MS";
  ctx.fillStyle = "#cad8f7";
  ctx.fillText(`Points: ${undeadMasterySkill.points}/${undeadMasterySkill.maxPoints}`, masteryCard.x + 14, masteryCard.y + 50);
  ctx.fillText(`Control Cap: ${game.getNecromancerControlCap()}`, masteryCard.x + 220, masteryCard.y + 50);
  ctx.fillStyle = "#d9e6ff";
  ctx.fillText(`Charm Time: ${game.getNecromancerCharmDuration().toFixed(2)}s`, masteryCard.x + 14, masteryCard.y + 82);
  ctx.fillText(`Controlled Undead: ${game.getControlledUndeadCount()}/${game.getNecromancerControlCap()}`, masteryCard.x + 14, masteryCard.y + 104);
  ctx.fillStyle = "#adc1ea";
  ctx.fillText("Adds +1 control cap per rank and smoothly lowers charm time to 0.5s.", masteryCard.x + 14, masteryCard.y + 132);
  const masterySpendRect = { x: masteryCard.x + masteryCard.w - 142, y: masteryCard.y + masteryCard.h - 48, w: 124, h: 34 };
  game.uiRects.skillUndeadMasteryNode = masterySpendRect;
  drawSpendButton(ctx, masterySpendRect, canSpendUndeadMastery, "rgba(96, 145, 206, 0.95)");

  const boltCard = { x: menuX + 22, y: masteryCard.y + masteryCard.h + 12, w: menuW - 44, h: 192 };
  ctx.fillStyle = "rgba(18, 38, 28, 0.95)";
  ctx.fillRect(boltCard.x, boltCard.y, boltCard.w, boltCard.h);
  ctx.strokeStyle = "rgba(116, 214, 158, 0.82)";
  ctx.strokeRect(boltCard.x, boltCard.y, boltCard.w, boltCard.h);
  ctx.fillStyle = "#edf8ef";
  ctx.font = "bold 18px Trebuchet MS";
  ctx.fillText("Death Bolt", boltCard.x + 14, boltCard.y + 28);
  ctx.font = "14px Trebuchet MS";
  ctx.fillStyle = "#c8efd8";
  ctx.fillText(`Points: ${deathBoltSkill.points}/${deathBoltSkill.maxPoints}`, boltCard.x + 14, boltCard.y + 50);
  ctx.fillText(`Cooldown: ${(game.config.deathBolt?.cooldown || 10).toFixed(1)}s`, boltCard.x + 220, boltCard.y + 50);
  ctx.fillStyle = "#dff8e9";
  ctx.fillText(`Damage: ${game.getDeathBoltBaseDamage().toFixed(1)} | Heal: ${game.getDeathBoltHealAmount().toFixed(1)}`, boltCard.x + 14, boltCard.y + 80);
  ctx.fillText(`Cost: ${((game.config.deathBolt?.hpCostPct || 0.05) * 100).toFixed(0)}% HP | Radius: ${game.getDeathBoltRadius().toFixed(0)}`, boltCard.x + 14, boltCard.y + 102);
  ctx.fillStyle = "#bce6ca";
  ctx.fillText("Blast pulses on impact and every second for 5s. Pet damage buff starts at +25% on rank 5.", boltCard.x + 14, boltCard.y + 130);
  const boltSpendRect = { x: boltCard.x + boltCard.w - 142, y: boltCard.y + boltCard.h - 48, w: 124, h: 34 };
  game.uiRects.skillDeathBoltNode = boltSpendRect;
  drawSpendButton(ctx, boltSpendRect, canSpendDeathBolt, "rgba(88, 164, 120, 0.95)");

  const explodeCard = { x: menuX + 22, y: boltCard.y + boltCard.h + 12, w: menuW - 44, h: 156 };
  ctx.fillStyle = "rgba(22, 28, 38, 0.95)";
  ctx.fillRect(explodeCard.x, explodeCard.y, explodeCard.w, explodeCard.h);
  ctx.strokeStyle = "rgba(151, 210, 255, 0.8)";
  ctx.strokeRect(explodeCard.x, explodeCard.y, explodeCard.w, explodeCard.h);
  ctx.fillStyle = "#eef6ff";
  ctx.font = "bold 18px Trebuchet MS";
  ctx.fillText("Augment Death", explodeCard.x + 14, explodeCard.y + 28);
  ctx.font = "14px Trebuchet MS";
  ctx.fillStyle = "#d7e8fb";
  ctx.fillText(`Points: ${explodingDeathSkill.points}/${explodingDeathSkill.maxPoints}`, explodeCard.x + 14, explodeCard.y + 50);
  ctx.fillText(`Damage: ${game.getDeathExplosionDamage().toFixed(1)}`, explodeCard.x + 220, explodeCard.y + 50);
  ctx.fillText(`Pet Boost: +${((game.getControlledUndeadBoost() - 1) * 100).toFixed(0)}%`, explodeCard.x + 14, explodeCard.y + 80);
  ctx.fillStyle = "#bdd8ee";
  ctx.fillText("Pets gain stat boosts from rank 1. At rank 3, they also explode on death.", explodeCard.x + 14, explodeCard.y + 106);
  const explodeSpendRect = { x: explodeCard.x + explodeCard.w - 142, y: explodeCard.y + explodeCard.h - 48, w: 124, h: 34 };
  game.uiRects.skillExplodingDeathNode = explodeSpendRect;
  drawSpendButton(ctx, explodeSpendRect, canSpendExplodingDeath, "rgba(97, 150, 202, 0.95)");
}

export function drawWarriorSkillTreeSection(ctx, game, menuX, menuY, menuW, sy) {
  const momentumSkill = game.skills.warriorMomentum;
  const rageSkill = game.skills.warriorRage;
  const executeSkill = game.skills.warriorExecute;
  const canSpendMomentum = game.skillPoints > 0 && momentumSkill.points < momentumSkill.maxPoints;
  const canSpendRage = game.skillPoints > 0 && rageSkill.points < rageSkill.maxPoints;
  const canSpendExecute = game.skillPoints > 0 && executeSkill.points < executeSkill.maxPoints;
  const nextMomentumPoints = Math.min(momentumSkill.maxPoints, momentumSkill.points + 1);
  const nextRagePoints = Math.min(rageSkill.maxPoints, rageSkill.points + 1);
  const nextExecutePoints = Math.min(executeSkill.maxPoints, executeSkill.points + 1);
  const curMomentumBonus = game.getWarriorMomentumMoveBonus(momentumSkill.points);
  const nextMomentumBonus = game.getWarriorMomentumMoveBonus(nextMomentumPoints);
  const curMomentumDur = game.getWarriorMomentumDuration(momentumSkill.points);
  const nextMomentumDur = game.getWarriorMomentumDuration(nextMomentumPoints);
  const curRageCd = game.getWarriorRageCooldown(rageSkill.points);
  const nextRageCd = game.getWarriorRageCooldown(nextRagePoints);
  const curRageBase = game.getWarriorRageBaseDamageBonus(rageSkill.points);
  const nextRageBase = game.getWarriorRageBaseDamageBonus(nextRagePoints);
  const curRageRush = game.getWarriorRageVictoryRushPerKillPct(rageSkill.points);
  const nextRageRush = game.getWarriorRageVictoryRushPerKillPct(nextRagePoints);
  const curExecuteChance = game.getWarriorExecuteChance(executeSkill.points);
  const nextExecuteChance = game.getWarriorExecuteChance(nextExecutePoints);
  const curExecuteThreshold = game.getWarriorExecuteThreshold(executeSkill.points);
  const nextExecuteThreshold = game.getWarriorExecuteThreshold(nextExecutePoints);
  const rageRushCap = game.getWarriorRageVictoryRushPoolCap() / Math.max(1, game.player.maxHealth);

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
    ctx.fillText(`Next: +${((nextMomentumBonus - curMomentumBonus) * 100).toFixed(2)}% speed, +${(nextMomentumDur - curMomentumDur).toFixed(2)}s`, card.x + 14, card.y + 152);
  }
  const spendRect = { x: card.x + card.w - 142, y: card.y + card.h - 50, w: 124, h: 34 };
  game.uiRects.skillWarriorMomentumNode = spendRect;
  drawSpendButton(ctx, spendRect, canSpendMomentum, "rgba(112, 160, 98, 0.95)");

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
  ctx.fillText(`Victory Rush: +${(curRageRush * 100).toFixed(0)}% max HP per kill over 15s`, rageCard.x + 14, rageCard.y + 138);
  ctx.fillStyle = "#f2bcbc";
  ctx.fillText(`Pool cap: ${(rageRushCap * 100).toFixed(0)}% max HP. Right click: half incoming damage.`, rageCard.x + 14, rageCard.y + 162);
  if (rageSkill.points >= rageSkill.maxPoints) {
    ctx.fillStyle = "#c5a5a5";
    ctx.fillText("Next Point: MAXED", rageCard.x + 14, rageCard.y + 186);
  } else {
    ctx.fillStyle = "#9ee0ad";
    ctx.fillText(`Next: ${Math.max(0, curRageCd - nextRageCd).toFixed(2)}s shorter CD, +${(nextRageBase - curRageBase).toFixed(2)} base dmg, +${((nextRageRush - curRageRush) * 100).toFixed(1)}% per kill`, rageCard.x + 14, rageCard.y + 186);
  }
  const rageSpendRect = { x: rageCard.x + rageCard.w - 142, y: rageCard.y + rageCard.h - 50, w: 124, h: 34 };
  game.uiRects.skillWarriorRageNode = rageSpendRect;
  drawSpendButton(ctx, rageSpendRect, canSpendRage, "rgba(112, 160, 98, 0.95)");

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
    ctx.fillText(`Next: +${((nextExecuteChance - curExecuteChance) * 100).toFixed(2)}% chance, +${((nextExecuteThreshold - curExecuteThreshold) * 100).toFixed(2)}% HP`, executeCard.x + 14, executeCard.y + 152);
  }
  const executeSpendRect = { x: executeCard.x + executeCard.w - 142, y: executeCard.y + executeCard.h - 50, w: 124, h: 34 };
  game.uiRects.skillWarriorExecuteNode = executeSpendRect;
  drawSpendButton(ctx, executeSpendRect, canSpendExecute, "rgba(112, 160, 98, 0.95)");

  ctx.fillStyle = "rgba(22, 22, 30, 0.92)";
  ctx.fillRect(menuX + 22, executeCard.y + executeCard.h + 12, menuW - 44, 86);
  ctx.strokeStyle = "rgba(133, 139, 164, 0.45)";
  ctx.strokeRect(menuX + 22, executeCard.y + executeCard.h + 12, menuW - 44, 86);
  ctx.fillStyle = "#b9c3d8";
  ctx.font = "13px Trebuchet MS";
  ctx.fillText("Ranger skills (Fire Arrow, Piercing Strike, Multiarrow)", menuX + 36, executeCard.y + executeCard.h + 44);
  ctx.fillText("are unavailable for Warrior.", menuX + 36, executeCard.y + executeCard.h + 64);
}

export function drawRangerSkillTreeSection(ctx, game, menuX, menuY, menuW, sy) {
  const fireSkill = game.skills.fireArrow;
  const pierceSkill = game.skills.piercingStrike;
  const multiarrowSkill = game.skills.multiarrow;
  const canSpend = game.skillPoints > 0 && fireSkill.points < fireSkill.maxPoints;
  const canSpendPierce = game.skillPoints > 0 && pierceSkill.points < pierceSkill.maxPoints;
  const canSpendMulti = game.skillPoints > 0 && multiarrowSkill.points < multiarrowSkill.maxPoints;
  const unlocked = game.isFireArrowUnlocked();
  const nextPoints = Math.min(fireSkill.maxPoints, fireSkill.points + 1);
  const nextPiercePoints = Math.min(pierceSkill.maxPoints, pierceSkill.points + 1);
  const nextMultiPoints = Math.min(multiarrowSkill.maxPoints, multiarrowSkill.points + 1);
  const curImpact = game.getFireArrowImpactDamage(fireSkill.points);
  const curRadius = game.getFireArrowBlastRadius(fireSkill.points);
  const curDps = game.getFireArrowLingerDps(fireSkill.points);
  const nextImpact = game.getFireArrowImpactDamage(nextPoints);
  const nextRadius = game.getFireArrowBlastRadius(nextPoints);
  const nextDps = game.getFireArrowLingerDps(nextPoints);
  const curPierce = game.getPiercingChance(pierceSkill.points);
  const nextPierce = game.getPiercingChance(nextPiercePoints);
  const curMultiCount = game.getMultiarrowCount(multiarrowSkill.points);
  const curMultiSpread = game.getMultiarrowSpreadDeg(multiarrowSkill.points);
  const curMultiDmg = game.getMultiarrowDamageMultiplier(multiarrowSkill.points);
  const nextMultiCount = game.getMultiarrowCount(nextMultiPoints);
  const nextMultiSpread = game.getMultiarrowSpreadDeg(nextMultiPoints);
  const nextMultiDmg = game.getMultiarrowDamageMultiplier(nextMultiPoints);

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
  ctx.fillStyle = "#b8a7ca";
  ctx.fillText("Each point increases power with diminishing returns.", card.x + 14, card.y + 148);
  ctx.fillStyle = fireSkill.points >= fireSkill.maxPoints ? "#9f95b3" : "#9ee0ad";
  if (fireSkill.points >= fireSkill.maxPoints) {
    ctx.fillText("Next Point: MAXED", card.x + 14, card.y + 170);
  } else {
    ctx.fillText(`Next Point: +${(nextImpact - curImpact).toFixed(2)} dmg, +${(nextRadius - curRadius).toFixed(2)} radius, +${(nextDps - curDps).toFixed(2)} dps`, card.x + 14, card.y + 170);
  }
  const spendRect = { x: card.x + card.w - 142, y: card.y + card.h - 52, w: 124, h: 34 };
  game.uiRects.skillFireArrowNode = spendRect;
  drawSpendButton(ctx, spendRect, canSpend, "rgba(112, 160, 98, 0.95)");

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
    ctx.fillText(`Next Point: +${((nextPierce - curPierce) * 100).toFixed(2)}% (to ${(nextPierce * 100).toFixed(1)}%)`, pierceCard.x + 14, pierceCard.y + 106);
  }
  ctx.fillStyle = "#9ab0d2";
  ctx.fillText("Diminishing returns keep late points meaningful but smaller.", pierceCard.x + 14, pierceCard.y + 130);
  const pierceSpendRect = { x: pierceCard.x + pierceCard.w - 142, y: pierceCard.y + pierceCard.h - 48, w: 124, h: 34 };
  game.uiRects.skillPiercingNode = pierceSpendRect;
  drawSpendButton(ctx, pierceSpendRect, canSpendPierce, "rgba(96, 145, 206, 0.95)");

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
  ctx.fillText(`Now: ${curMultiCount} arrows, ${curMultiSpread.toFixed(1)}deg, x${curMultiDmg.toFixed(2)} volley`, multiCard.x + 14, multiCard.y + 63);
  if (multiarrowSkill.points >= multiarrowSkill.maxPoints) {
    ctx.fillStyle = "#a0b19c";
    ctx.fillText("Next: MAXED", multiCard.x + 14, multiCard.y + 81);
  } else {
    ctx.fillStyle = "#9be7af";
    ctx.fillText(`Next: ${nextMultiCount} arrows, ${nextMultiSpread.toFixed(1)}deg, x${nextMultiDmg.toFixed(2)} volley`, multiCard.x + 14, multiCard.y + 81);
  }
  const multiSpendRect = { x: multiCard.x + multiCard.w - 142, y: multiCard.y + multiCard.h - 42, w: 124, h: 30 };
  game.uiRects.skillMultiarrowNode = multiSpendRect;
  drawSpendButton(ctx, multiSpendRect, canSpendMulti, "rgba(112, 160, 98, 0.95)", "bold 13px Trebuchet MS", "Spend 1 SP", 20, 20);
}
