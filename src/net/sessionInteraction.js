export function collectInput(game, consumeQueued = true) {
  const keys = game.input.keys;
  let moveX = 0;
  let moveY = 0;
  if (keys.has("arrowleft") || keys.has("a")) moveX -= 1;
  if (keys.has("arrowright") || keys.has("d")) moveX += 1;
  if (keys.has("arrowup") || keys.has("w")) moveY -= 1;
  if (keys.has("arrowdown") || keys.has("s")) moveY += 1;
  return {
    moveX,
    moveY,
    hasAim: !!game.input.mouse.hasAim,
    aimX: game.input.mouse.worldX,
    aimY: game.input.mouse.worldY,
    firePrimaryQueued: consumeQueued ? game.input.consumeLeftQueued() : false,
    firePrimaryHeld: !!game.input.mouse.leftDown,
    fireAltQueued: consumeQueued ? game.input.consumeRightQueued() : false
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
  const hasAction = !!input.firePrimaryQueued || !!input.fireAltQueued;
  if (changedMove || changedAimMode || changedAimPos || hasAction) return true;
  return nowMs - lastInputSendAt >= forceSendIdleMs;
}

export function handleNetworkUiActions(game, netClient, isController) {
  if (!netClient || !isController) {
    game.input.consumeUiLeftClicks();
    if (game.input.consumeWheelDelta) game.input.consumeWheelDelta();
    return;
  }
  const wheelDelta = game.input.consumeWheelDelta ? game.input.consumeWheelDelta() : 0;
  if (wheelDelta !== 0 && (game.skillTreeOpen || game.shopOpen)) {
    const target = game.skillTreeOpen
      ? { max: game.uiRects.skillTreeScrollMax, key: "skillTree" }
      : { max: game.uiRects.shopScrollMax, key: "shop" };
    const max = Number.isFinite(target.max) ? target.max : 0;
    const step = Math.sign(wheelDelta) * Math.max(36, Math.abs(wheelDelta));
    const next = (game.uiScroll?.[target.key] || 0) + step;
    game.uiScroll[target.key] = Math.max(0, Math.min(max, next));
  }
  if (game.input.consumeKeyQueued("escape")) {
    netClient.sendAction({ kind: "escape" });
  }
  const clicks = game.input.consumeUiLeftClicks();
  if (clicks.length === 0) return;

  const hit = (x, y, rect) => game.pointInRect(x, y, rect);
  for (const click of clicks) {
    if (hit(click.x, click.y, game.uiRects.shopButton)) {
      netClient.sendAction({ kind: "toggleShop" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.shopClose)) {
      netClient.sendAction({ kind: "closeShop" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillTreeButton)) {
      netClient.sendAction({ kind: "toggleSkillTree" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillTreeClose)) {
      netClient.sendAction({ kind: "closeSkillTree" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.statsButton)) {
      netClient.sendAction({ kind: "toggleStats" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.statsClose)) {
      netClient.sendAction({ kind: "closeStats" });
      continue;
    }
    const itemRects = game.uiRects.shopItems || [];
    for (const item of itemRects) {
      if (hit(click.x, click.y, item.rect)) {
        netClient.sendAction({ kind: "buyUpgrade", key: item.key });
        break;
      }
    }
    if (hit(click.x, click.y, game.uiRects.skillFireArrowNode)) {
      netClient.sendAction({ kind: "spendSkill", key: "fireArrow" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillPiercingStrikeNode)) {
      netClient.sendAction({ kind: "spendSkill", key: "piercingStrike" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillMultiarrowNode)) {
      netClient.sendAction({ kind: "spendSkill", key: "multiarrow" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillWarriorMomentumNode)) {
      netClient.sendAction({ kind: "spendSkill", key: "warriorMomentum" });
      continue;
    }
    if (hit(click.x, click.y, game.uiRects.skillWarriorRageNode)) {
      netClient.sendAction({ kind: "spendSkill", key: "warriorRage" });
      continue;
    }
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
    if (typeof game.moveWithCollision === "function") {
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
    const ax = input.aimX - game.player.x;
    const ay = input.aimY - game.player.y;
    const alen = Math.hypot(ax, ay) || 1;
    game.player.dirX = ax / alen;
    game.player.dirY = ay / alen;
  }
}

export function canRunPredictedCollision(game, isKnownMapTileAt) {
  if (!game || !game.player) return false;
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
  const role = isController ? "Controller" : "Spectator";
  game.networkEnabled = true;
  game.networkRole = role;
  if (networkTakeControl) networkTakeControl.disabled = role === "Controller";
}

export function setSelectedClass(classType, classButtons) {
  const selectedClass = classType === "fighter" || classType === "warrior" ? "fighter" : "archer";
  for (const button of classButtons || []) {
    const option = button.dataset.classOption === "warrior" ? "fighter" : button.dataset.classOption;
    const isActive = option === selectedClass;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
  return selectedClass;
}
