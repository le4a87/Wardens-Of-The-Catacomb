export function collectInput(game, consumeQueued = true) {
  if (game?.input?.mouse?.hasAim && typeof game.input.refreshAimWorldPosition === "function") {
    game.input.refreshAimWorldPosition();
  }
  const playerAlive = !(Number.isFinite(game?.player?.health) && game.player.health <= 0);
  const gameplayBlocked = !playerAlive || !!game?.gameOver || !!game?.paused || !!game?.shopOpen || !!game?.skillTreeOpen;
  const playerX = Number.isFinite(game?.player?.x) ? game.player.x : 0;
  const playerY = Number.isFinite(game?.player?.y) ? game.player.y : 0;
  const rawAimX = game.input.mouse.worldX - playerX;
  const rawAimY = game.input.mouse.worldY - playerY;
  const rawAimLen = Math.hypot(rawAimX, rawAimY) || 1;
  const keys = game.input.keys;
  let moveX = 0;
  let moveY = 0;
  if (keys.has("arrowleft") || keys.has("a")) moveX -= 1;
  if (keys.has("arrowright") || keys.has("d")) moveX += 1;
  if (keys.has("arrowup") || keys.has("w")) moveY -= 1;
  if (keys.has("arrowdown") || keys.has("s")) moveY += 1;
  return {
    moveX: gameplayBlocked ? 0 : moveX,
    moveY: gameplayBlocked ? 0 : moveY,
    hasAim: !gameplayBlocked && !!game.input.mouse.hasAim,
    aimX: game.input.mouse.worldX,
    aimY: game.input.mouse.worldY,
    aimDirX: !gameplayBlocked && game.input.mouse.hasAim ? rawAimX / rawAimLen : 0,
    aimDirY: !gameplayBlocked && game.input.mouse.hasAim ? rawAimY / rawAimLen : 0,
    firePrimaryQueued: !gameplayBlocked && consumeQueued ? game.input.consumeLeftQueued() : false,
    firePrimaryHeld: !gameplayBlocked && !!game.input.mouse.leftDown,
    fireAltQueued: !gameplayBlocked && consumeQueued ? game.input.consumeRightQueued() : false
  };
}

export function shouldSendNetworkInput(input, nowMs, previous, lastInputSendAt, forceSendIdleMs) {
  if (!previous) return true;
  const changedMove = input.moveX !== previous.moveX || input.moveY !== previous.moveY;
  const changedAimMode = input.hasAim !== previous.hasAim;
  const changedAimPos =
    input.hasAim &&
    previous.hasAim &&
    (Math.abs(input.aimX - previous.aimX) > 1.5 || Math.abs(input.aimY - previous.aimY) > 1.5);
  const changedAimDir =
    input.hasAim &&
    previous.hasAim &&
    (Math.abs((input.aimDirX || 0) - (previous.aimDirX || 0)) > 0.01 || Math.abs((input.aimDirY || 0) - (previous.aimDirY || 0)) > 0.01);
  const changedPrimaryHold = !!input.firePrimaryHeld !== !!previous.firePrimaryHeld;
  const hasQueuedAction = !!input.firePrimaryQueued || !!input.fireAltQueued;
  const hasContinuousInput = !!input.firePrimaryHeld || !!input.moveX || !!input.moveY;
  if (changedMove || changedAimMode || changedAimPos || changedAimDir || changedPrimaryHold || hasQueuedAction || hasContinuousInput) return true;
  return nowMs - lastInputSendAt >= forceSendIdleMs;
}

export function handleNetworkUiActions(game, netClient, isController) {
  const playerAlive = !(Number.isFinite(game?.player?.health) && game.player.health <= 0);
  const isActiveMultiplayer = !!game?.networkEnabled && game.networkRoomPhase === "active";
  const localPlayerId = typeof game?.networkLocalPlayerId === "string" ? game.networkLocalPlayerId : null;
  const pauseOwnerId = typeof game?.networkPauseOwnerId === "string" ? game.networkPauseOwnerId : null;
  const isPauseOwner = !!(isActiveMultiplayer && localPlayerId && pauseOwnerId && localPlayerId === pauseOwnerId);
  const canUseLocalPanels = !!game && isActiveMultiplayer;
  const toggleLocalShop = (open) => {
    if (typeof game?.toggleShop === "function") game.toggleShop(open);
  };
  const toggleLocalSkillTree = (open) => {
    if (typeof game?.toggleSkillTree === "function") game.toggleSkillTree(open);
  };
  const toggleLocalStats = (open) => {
    if (typeof game?.toggleStatsPanel === "function") game.toggleStatsPanel(open);
  };
  const handleSpectateUi = () => {
    if (!game || !game.input || game.gameOver || (Number.isFinite(game?.player?.health) && game.player.health > 0)) return false;
    let handled = false;
    const pointInRect = typeof game.pointInRect === "function"
      ? (x, y, rect) => game.pointInRect(x, y, rect)
      : (x, y, rect) => !!rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
    if (game.input.consumeKeyQueued("q")) {
      if (typeof game.cycleSpectateTarget === "function") game.cycleSpectateTarget(-1);
      handled = true;
    }
    if (game.input.consumeKeyQueued("e")) {
      if (typeof game.cycleSpectateTarget === "function") game.cycleSpectateTarget(1);
      handled = true;
    }
    const clicks = game.input.consumeUiLeftClicks();
    for (const click of clicks) {
      const rows = Array.isArray(game.uiRects?.groupPanelRows) ? game.uiRects.groupPanelRows : [];
      const hitRow = rows.find((row) => row?.alive && row.rect && pointInRect(click.x, click.y, row.rect));
      if (!hitRow) continue;
      if (typeof game.setSpectateTargetById === "function") game.setSpectateTargetById(hitRow.id);
      handled = true;
    }
    return handled;
  };
  if (!game.networkUiDebug || typeof game.networkUiDebug !== "object") {
    game.networkUiDebug = {
      lastClick: null,
      lastHit: "",
      lastActionKind: "",
      recentActions: []
    };
  }
  if (!netClient) {
    const handledSpectateUi = handleSpectateUi();
    const droppedClicks = handledSpectateUi ? [] : game.input.consumeUiLeftClicks();
    if (droppedClicks.length > 0) {
      game.networkUiDebug.lastClick = droppedClicks[droppedClicks.length - 1];
      game.networkUiDebug.lastHit = "noNetClient";
      game.networkUiDebug.lastActionKind = "";
      game.networkUiDebug.recentActions.push({
        atMs: Math.round(performance.now()),
        click: droppedClicks[droppedClicks.length - 1],
        hit: "noNetClient",
        actionKind: "",
        actionKey: ""
      });
      if (game.networkUiDebug.recentActions.length > 16) {
        game.networkUiDebug.recentActions.splice(0, game.networkUiDebug.recentActions.length - 16);
      }
    }
    if (game.input.consumeWheelDelta) game.input.consumeWheelDelta();
    return;
  }
  const handledSpectateUi = handleSpectateUi();
  if (handledSpectateUi) {
    if (game.input.consumeWheelDelta) game.input.consumeWheelDelta();
    return;
  }
  const wheelDelta = game.input.consumeWheelDelta ? game.input.consumeWheelDelta() : 0;
  if (playerAlive && wheelDelta !== 0 && (game.skillTreeOpen || game.shopOpen)) {
    const target = game.skillTreeOpen
      ? { max: game.uiRects.skillTreeScrollMax, key: "skillTree" }
      : { max: game.uiRects.shopScrollMax, key: "shop" };
    const max = Number.isFinite(target.max) ? target.max : 0;
    const step = Math.sign(wheelDelta) * Math.max(36, Math.abs(wheelDelta));
    const next = (game.uiScroll?.[target.key] || 0) + step;
    game.uiScroll[target.key] = Math.max(0, Math.min(max, next));
  }
  if (game.input.consumeKeyQueued("escape")) {
    if (isActiveMultiplayer && !isPauseOwner) {
      if (game.shopOpen) toggleLocalShop(false);
      else if (game.skillTreeOpen) toggleLocalSkillTree(false);
      else if (game.statsPanelOpen) toggleLocalStats(false);
    } else if (isController) {
      netClient.sendAction({ kind: "escape" });
    }
  }
  if (playerAlive && game.input.consumeKeyQueued("b") && !game.gameOver) {
    if (isActiveMultiplayer && !isPauseOwner) toggleLocalShop();
    else if (isController) netClient.sendAction({ kind: "toggleShop" });
  }
  if (playerAlive && game.input.consumeKeyQueued("k") && !game.gameOver) {
    if (isActiveMultiplayer && !isPauseOwner) toggleLocalSkillTree();
    else if (isController) netClient.sendAction({ kind: "toggleSkillTree" });
  }
  if (game.input.consumeKeyQueued("c")) {
    if (canUseLocalPanels) toggleLocalStats();
    else if (isController) netClient.sendAction({ kind: "toggleStats" });
  }
  if (playerAlive && !game.gameOver && !game.shopOpen && !game.skillTreeOpen && !game.statsPanelOpen) {
    for (let i = 0; i < 5; i++) {
      if (!game.input.consumeKeyQueued(`${i + 1}`)) continue;
      if (isController) netClient.sendAction({ kind: "useConsumableSlot", slot: i });
    }
  }
  const clicks = game.input.consumeUiLeftClicks();
  if (clicks.length === 0) return;

  const hit = (x, y, rect) => game.pointInRect(x, y, rect);
  const recordAction = (click, hitName, actionKind, actionKey = "") => {
    game.networkUiDebug.lastClick = click ? { x: click.x, y: click.y } : null;
    game.networkUiDebug.lastHit = hitName || "";
    game.networkUiDebug.lastActionKind = actionKind || "";
    game.networkUiDebug.recentActions.push({
      atMs: Math.round(performance.now()),
      click: click ? { x: click.x, y: click.y } : null,
      hit: hitName || "",
      actionKind: actionKind || "",
      actionKey
    });
    if (game.networkUiDebug.recentActions.length > 16) {
      game.networkUiDebug.recentActions.splice(0, game.networkUiDebug.recentActions.length - 16);
    }
  };
  for (const click of clicks) {
    if (hit(click.x, click.y, game.uiRects.gameOverStatsButton)) {
      recordAction(click, "gameOverStatsButton", "toggleStats");
      if (canUseLocalPanels) toggleLocalStats();
      else if (isController) netClient.sendAction({ kind: "toggleStats" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.shopButton)) {
      if (!playerAlive) continue;
      recordAction(click, "shopButton", "toggleShop");
      if (isActiveMultiplayer && !isPauseOwner) toggleLocalShop();
      else if (isController) netClient.sendAction({ kind: "toggleShop" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.shopClose)) {
      if (!playerAlive) continue;
      recordAction(click, "shopClose", "closeShop");
      if (isActiveMultiplayer && !isPauseOwner) toggleLocalShop(false);
      else if (isController) netClient.sendAction({ kind: "closeShop" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillTreeButton)) {
      if (!playerAlive) continue;
      recordAction(click, "skillTreeButton", "toggleSkillTree");
      if (isActiveMultiplayer && !isPauseOwner) toggleLocalSkillTree();
      else if (isController) netClient.sendAction({ kind: "toggleSkillTree" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillTreeClose)) {
      if (!playerAlive) continue;
      recordAction(click, "skillTreeClose", "closeSkillTree");
      if (isActiveMultiplayer && !isPauseOwner) toggleLocalSkillTree(false);
      else if (isController) netClient.sendAction({ kind: "closeSkillTree" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.statsButton)) {
      recordAction(click, "statsButton", "toggleStats");
      if (canUseLocalPanels) toggleLocalStats();
      else if (isController) netClient.sendAction({ kind: "toggleStats" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.statsClose)) {
      recordAction(click, "statsClose", "closeStats");
      if (canUseLocalPanels) toggleLocalStats(false);
      else if (isController) netClient.sendAction({ kind: "closeStats" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.statsRunTab)) {
      recordAction(click, "statsRunTab", "setStatsView", "run");
      if (typeof game?.setStatsPanelView === "function" && canUseLocalPanels) game.setStatsPanelView("run");
      else if (isController) netClient.sendAction({ kind: "setStatsView", view: "run" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.statsCharacterTab)) {
      recordAction(click, "statsCharacterTab", "setStatsView", "character");
      if (typeof game?.setStatsPanelView === "function" && canUseLocalPanels) game.setStatsPanelView("character");
      else if (isController) netClient.sendAction({ kind: "setStatsView", view: "character" });
      continue;
    }
    const itemRects = game.uiRects.shopItems || [];
    for (const item of itemRects) {
      if (!playerAlive) break;
      if (hit(click.x, click.y, item.rect)) {
        recordAction(click, `shopItem:${item.key}`, "buyUpgrade", item.key);
        netClient.sendAction({ kind: "buyUpgrade", key: item.key });
        break;
      }
    }
    const skillNodeRects = Array.isArray(game.uiRects.skillTreeNodes) ? game.uiRects.skillTreeNodes : [];
    let handledSkillNode = false;
    for (const node of skillNodeRects) {
      if (!playerAlive || !hit(click.x, click.y, node.rect)) continue;
      recordAction(click, `skillNode:${node.key}`, "spendSkill", node.key);
      netClient.sendAction({ kind: "spendSkill", key: node.key });
      handledSkillNode = true;
      break;
    }
    if (handledSkillNode) continue;
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillFireArrowNode)) {
      recordAction(click, "skillFireArrowNode", "spendSkill", "fireArrow");
      netClient.sendAction({ kind: "spendSkill", key: "fireArrow" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillPiercingNode)) {
      recordAction(click, "skillPiercingNode", "spendSkill", "piercingStrike");
      netClient.sendAction({ kind: "spendSkill", key: "piercingStrike" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillMultiarrowNode)) {
      recordAction(click, "skillMultiarrowNode", "spendSkill", "multiarrow");
      netClient.sendAction({ kind: "spendSkill", key: "multiarrow" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillWarriorMomentumNode)) {
      recordAction(click, "skillWarriorMomentumNode", "spendSkill", "warriorMomentum");
      netClient.sendAction({ kind: "spendSkill", key: "warriorMomentum" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillWarriorRageNode)) {
      recordAction(click, "skillWarriorRageNode", "spendSkill", "warriorRage");
      netClient.sendAction({ kind: "spendSkill", key: "warriorRage" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillWarriorExecuteNode)) {
      recordAction(click, "skillWarriorExecuteNode", "spendSkill", "warriorExecute");
      netClient.sendAction({ kind: "spendSkill", key: "warriorExecute" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillUndeadMasteryNode)) {
      recordAction(click, "skillUndeadMasteryNode", "spendSkill", "undeadMastery");
      netClient.sendAction({ kind: "spendSkill", key: "undeadMastery" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillDeathBoltNode)) {
      recordAction(click, "skillDeathBoltNode", "spendSkill", "deathBolt");
      netClient.sendAction({ kind: "spendSkill", key: "deathBolt" });
      continue;
    }
    if (playerAlive && hit(click.x, click.y, game.uiRects.skillExplodingDeathNode)) {
      recordAction(click, "skillExplodingDeathNode", "spendSkill", "explodingDeath");
      netClient.sendAction({ kind: "spendSkill", key: "explodingDeath" });
      continue;
    }
    recordAction(click, "", "", "");
    if (hit(click.x, click.y, game.uiRects.returnMenuButton)) {
      if (typeof game.onReturnToMenu === "function") game.onReturnToMenu();
    }
  }
}

export function predictFromInput(game, input, dt, canRunPredictedCollision) {
  if (!canRunPredictedCollision) return;
  const mx = Number.isFinite(input.moveX) ? input.moveX : 0;
  const my = Number.isFinite(input.moveY) ? input.moveY : 0;
  if (mx || my) {
    if (typeof game.moveWithCollisionSubsteps === "function") {
      const len = Math.hypot(mx, my) || 1;
      const speed = game.getPlayerMoveSpeed();
      game.moveWithCollisionSubsteps(game.player, (mx / len) * speed * dt, (my / len) * speed * dt);
    } else if (typeof game.moveWithCollision === "function") {
      const len = Math.hypot(mx, my) || 1;
      const speed = game.getPlayerMoveSpeed();
      game.moveWithCollision(game.player, (mx / len) * speed * dt, (my / len) * speed * dt);
    } else {
      const len = Math.hypot(mx, my) || 1;
      const speed = game.getPlayerMoveSpeed();
      const stepX = (mx / len) * speed * dt;
      const stepY = (my / len) * speed * dt;
      const r = game.player.size * 0.5;
      const minX = r;
      const minY = r;
      const maxX = Math.max(minX, game.worldWidth - r);
      const maxY = Math.max(minY, game.worldHeight - r);
      game.player.x = Math.max(minX, Math.min(maxX, game.player.x + stepX));
      game.player.y = Math.max(minY, Math.min(maxY, game.player.y + stepY));
    }
    game.player.moving = true;
  } else {
    game.player.moving = false;
  }

  if (input.hasAim) {
    if (Number.isFinite(input.aimDirX) && Number.isFinite(input.aimDirY)) {
      const alen = Math.hypot(input.aimDirX, input.aimDirY) || 1;
      game.player.dirX = input.aimDirX / alen;
      game.player.dirY = input.aimDirY / alen;
    } else {
      const ax = input.aimX - game.player.x;
      const ay = input.aimY - game.player.y;
      const alen = Math.hypot(ax, ay) || 1;
      game.player.dirX = ax / alen;
      game.player.dirY = ay / alen;
    }
  }
}

function hasRecentCorrectionPressure(game) {
  const perf = game?.networkPerf;
  if (!perf || typeof perf !== "object") return false;
  if (Number.isFinite(perf.lastCorrectionPx) && perf.lastCorrectionPx >= 56) return true;
  const recent = Array.isArray(perf.recentCorrections) ? perf.recentCorrections : [];
  const last = recent[recent.length - 1];
  return !!last && Number.isFinite(last.errorPx) && last.errorPx >= 56;
}

export function canRunPredictedCollision(game, isKnownMapTileAt) {
  if (!game || !game.player) return false;
  if (hasRecentCorrectionPressure(game)) return false;
  const r = (game.player.size || 22) * 0.5;
  return (
    isKnownMapTileAt(game, game.player.x - r, game.player.y - r) &&
    isKnownMapTileAt(game, game.player.x + r, game.player.y - r) &&
    isKnownMapTileAt(game, game.player.x - r, game.player.y + r) &&
    isKnownMapTileAt(game, game.player.x + r, game.player.y + r)
  );
}

export function updateNetworkRole(game, isController, networkTakeControl) {
  if (!game) return;
  const playerAlive = Number.isFinite(game?.player?.health) ? game.player.health > 0 : true;
  const inActiveRoom = game.networkRoomPhase === "active";
  const role = inActiveRoom ? (playerAlive ? "Active" : "Spectating") : (isController ? "Controller" : "Connected");
  game.networkEnabled = true;
  game.networkRole = role;
  if (networkTakeControl) networkTakeControl.disabled = !!isController;
}

export function setSelectedClass(classType, classButtons) {
  const selectedClass = classType === "fighter" || classType === "warrior" ? "fighter" : classType === "necromancer" ? "necromancer" : "archer";
  for (const button of classButtons || []) {
    const option = button.dataset.classOption === "warrior" ? "fighter" : button.dataset.classOption;
    const isActive = option === selectedClass;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
  return selectedClass;
}
