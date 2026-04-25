export class InputController {
  constructor(canvas, getCamera, isActive, options = {}) {
    this.canvas = canvas;
    this.getCamera = getCamera;
    this.isActive = isActive;
    this.platform = typeof options.platform === "string" && options.platform ? options.platform : "web";
    this.getUiRects = typeof options.getUiRects === "function" ? options.getUiRects : () => ({});
    this.keys = new Set();
    this.keyQueued = new Set();
    this.mouse = {
      leftDown: false,
      leftQueued: false,
      rightQueued: false,
      uiLeftClicks: [],
      recentUiLeftClicks: [],
      wheelDelta: 0,
      screenX: 0,
      screenY: 0,
      worldX: 0,
      worldY: 0,
      hasAim: false
    };
    this.touch = {
      enabled: this.platform === "android",
      moveStick: null,
      aimStick: null,
      activeTouches: new Map(),
      tapMaxDistance: 18,
      stickRadius: 56,
      stickDeadzone: 10
    };

    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (!this.keys.has(key)) this.keyQueued.add(key);
      this.keys.add(key);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        const screen = this.getScreenPosition(e);
        this.mouse.uiLeftClicks.push(screen);
        this.mouse.recentUiLeftClicks.push({
          x: screen.x,
          y: screen.y,
          atMs: Math.round(performance.now())
        });
        if (this.mouse.recentUiLeftClicks.length > 12) this.mouse.recentUiLeftClicks.splice(0, this.mouse.recentUiLeftClicks.length - 12);
      }
      if (!this.isActive()) return;
      this.updateAim(e);
      if (e.button === 0) {
        this.mouse.leftDown = true;
        this.mouse.leftQueued = true;
      }
      if (e.button === 2) {
        e.preventDefault();
        this.mouse.rightQueued = true;
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.leftDown = false;
    });

    canvas.addEventListener("mouseleave", () => {
      this.mouse.leftDown = false;
    });

    canvas.addEventListener("mousemove", (e) => this.updateAim(e));
    const onWheel = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      const screen = this.getScreenPosition(e);
      this.mouse.screenX = screen.x;
      this.mouse.screenY = screen.y;
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16; // line units -> pixels
      else if (e.deltaMode === 2) delta *= this.canvas.height; // page units -> pixels
      this.mouse.wheelDelta += delta;
      e.preventDefault();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("wheel", onWheel, { passive: false });
    if (this.touch.enabled) {
      canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e), { passive: false });
      canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e), { passive: false });
      canvas.addEventListener("touchend", (e) => this.handleTouchEnd(e), { passive: false });
      canvas.addEventListener("touchcancel", (e) => this.handleTouchEnd(e), { passive: false });
    }
  }

  updateAim(event) {
    const screen = this.getScreenPosition(event);
    this.mouse.screenX = screen.x;
    this.mouse.screenY = screen.y;
    this.refreshAimWorldPosition();
    this.mouse.hasAim = true;
  }

  refreshAimWorldPosition() {
    const camera = this.getCamera();
    this.mouse.worldX = this.mouse.screenX + camera.x;
    this.mouse.worldY = this.mouse.screenY + camera.y;
  }

  getScreenPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  queueUiLeftClick(screen) {
    if (!screen) return;
    this.mouse.uiLeftClicks.push(screen);
    this.mouse.recentUiLeftClicks.push({
      x: screen.x,
      y: screen.y,
      atMs: Math.round(performance.now())
    });
    if (this.mouse.recentUiLeftClicks.length > 12) this.mouse.recentUiLeftClicks.splice(0, this.mouse.recentUiLeftClicks.length - 12);
  }

  queueAltFire() {
    this.mouse.rightQueued = true;
  }

  addWheelDelta(delta) {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.mouse.wheelDelta += delta;
  }

  pointInRect(x, y, rect) {
    return !!rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
  }

  isInteractiveUiPoint(x, y, uiRects) {
    const rectKeys = [
      "shopButton",
      "skillTreeButton",
      "statsButton",
      "statsClose",
      "statsRunTab",
      "statsCharacterTab",
      "shopClose",
      "skillTreeClose",
      "gameOverLeaderboardButton",
      "gameOverMenuButton",
      "gameOverStatsButton",
      "hudAbilityWidget"
    ];
    for (const key of rectKeys) {
      if (this.pointInRect(x, y, uiRects?.[key])) return true;
    }
    const rectGroups = [uiRects?.shopItems, uiRects?.skillTreeNodes, uiRects?.consumableSlots, uiRects?.groupPanelRows];
    for (const group of rectGroups) {
      for (const entry of Array.isArray(group) ? group : []) {
        if (this.pointInRect(x, y, entry?.rect || entry)) return true;
      }
    }
    return false;
  }

  resolveTouchRole(point) {
    const uiRects = this.getUiRects() || {};
    if (this.isInteractiveUiPoint(point.x, point.y, uiRects)) return { role: "tap" };
    if (this.pointInRect(point.x, point.y, uiRects.shopScrollArea)) return { role: "scroll", key: "shop" };
    if (this.pointInRect(point.x, point.y, uiRects.skillTreeScrollArea)) return { role: "scroll", key: "skillTree" };
    if (this.pointInRect(point.x, point.y, uiRects.touchMoveRegion) || point.x <= this.canvas.width * 0.5) return { role: "move" };
    if (this.pointInRect(point.x, point.y, uiRects.touchAimRegion) || point.x > this.canvas.width * 0.5) return { role: "aim" };
    return { role: "tap" };
  }

  getTouchPoint(touch) {
    return this.getScreenPosition(touch);
  }

  handleTouchStart(event) {
    if (!this.touch.enabled) return;
    for (const touch of Array.from(event.changedTouches || [])) {
      const point = this.getTouchPoint(touch);
      const next = this.resolveTouchRole(point);
      if (next.role === "move" && this.touch.moveStick) continue;
      if (next.role === "aim" && this.touch.aimStick) continue;
      const state = { id: touch.identifier, role: next.role, key: next.key || "", startX: point.x, startY: point.y, x: point.x, y: point.y, lastY: point.y };
      this.touch.activeTouches.set(touch.identifier, state);
      if (state.role === "move") this.touch.moveStick = state;
      if (state.role === "aim") this.touch.aimStick = state;
    }
    if (event.changedTouches?.length) event.preventDefault();
  }

  handleTouchMove(event) {
    if (!this.touch.enabled) return;
    for (const touch of Array.from(event.changedTouches || [])) {
      const state = this.touch.activeTouches.get(touch.identifier);
      if (!state) continue;
      const point = this.getTouchPoint(touch);
      state.x = point.x;
      state.y = point.y;
      if (state.role === "scroll") {
        this.addWheelDelta(state.lastY - point.y);
        state.lastY = point.y;
      }
    }
    if (event.changedTouches?.length) event.preventDefault();
  }

  handleTouchEnd(event) {
    if (!this.touch.enabled) return;
    for (const touch of Array.from(event.changedTouches || [])) {
      const state = this.touch.activeTouches.get(touch.identifier);
      if (!state) continue;
      const point = this.getTouchPoint(touch);
      if (state.role === "tap" && Math.hypot(point.x - state.startX, point.y - state.startY) <= this.touch.tapMaxDistance) this.queueUiLeftClick(point);
      if (this.touch.moveStick?.id === touch.identifier) this.touch.moveStick = null;
      if (this.touch.aimStick?.id === touch.identifier) this.touch.aimStick = null;
      this.touch.activeTouches.delete(touch.identifier);
    }
    if (!this.touch.aimStick) this.mouse.leftDown = false;
    if (event.changedTouches?.length) event.preventDefault();
  }

  getTouchStickVector(stick) {
    if (!stick) return null;
    const dx = stick.x - stick.startX;
    const dy = stick.y - stick.startY;
    const dist = Math.hypot(dx, dy);
    if (dist < this.touch.stickDeadzone) return null;
    const scale = Math.min(dist, this.touch.stickRadius) / dist;
    return { dx: dx * scale, dy: dy * scale, dist: Math.min(dist, this.touch.stickRadius) };
  }

  consumeLeftQueued() {
    const queued = this.mouse.leftQueued;
    this.mouse.leftQueued = false;
    return queued;
  }

  consumeRightQueued() {
    const queued = this.mouse.rightQueued;
    this.mouse.rightQueued = false;
    return queued;
  }

  consumeUiLeftClicks() {
    const clicks = this.mouse.uiLeftClicks.slice();
    this.mouse.uiLeftClicks.length = 0;
    return clicks;
  }

  consumeWheelDelta() {
    const delta = this.mouse.wheelDelta;
    this.mouse.wheelDelta = 0;
    return delta;
  }

  consumeKeyQueued(key) {
    const lower = key.toLowerCase();
    const queued = this.keyQueued.has(lower);
    this.keyQueued.delete(lower);
    return queued;
  }

  getMoveVector(gameplayBlocked = false) {
    if (gameplayBlocked) return { moveX: 0, moveY: 0 };
    const touchMove = this.getTouchStickVector(this.touch.moveStick);
    if (touchMove) {
      return {
        moveX: touchMove.dx / this.touch.stickRadius,
        moveY: touchMove.dy / this.touch.stickRadius
      };
    }
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) moveX -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) moveX += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) moveY -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) moveY += 1;
    return { moveX, moveY };
  }

  getGameplayIntent({
    playerX = 0,
    playerY = 0,
    gameplayBlocked = false,
    consumeQueued = true,
    fallbackAimDirX = 1,
    fallbackAimDirY = 0
  } = {}) {
    if (this.mouse.hasAim && typeof this.refreshAimWorldPosition === "function") this.refreshAimWorldPosition();
    const { moveX, moveY } = this.getMoveVector(gameplayBlocked);
    const touchAim = !gameplayBlocked ? this.getTouchStickVector(this.touch.aimStick) : null;
    if (touchAim) {
      const aimLen = Math.hypot(touchAim.dx, touchAim.dy) || 1;
      const aimDirX = touchAim.dx / aimLen;
      const aimDirY = touchAim.dy / aimLen;
      const aimDistance = Math.max(this.canvas.width, this.canvas.height);
      this.mouse.leftDown = true;
      this.mouse.hasAim = true;
      this.mouse.worldX = playerX + aimDirX * aimDistance;
      this.mouse.worldY = playerY + aimDirY * aimDistance;
      return {
        moveX,
        moveY,
        hasAim: true,
        aimX: this.mouse.worldX,
        aimY: this.mouse.worldY,
        aimDirX,
        aimDirY,
        swapAttackQueued: !gameplayBlocked && consumeQueued ? this.consumeKeyQueued("q") : false,
        firePrimaryQueued: false,
        firePrimaryHeld: true,
        fireAltQueued: !gameplayBlocked && consumeQueued ? this.consumeRightQueued() : false
      };
    }
    if (this.touch.enabled) this.mouse.leftDown = false;
    const rawAimX = this.mouse.worldX - playerX;
    const rawAimY = this.mouse.worldY - playerY;
    const rawAimLen = Math.hypot(rawAimX, rawAimY) || 1;
    const hasAim = !gameplayBlocked && !!this.mouse.hasAim;
    return {
      moveX,
      moveY,
      hasAim,
      aimX: this.mouse.worldX,
      aimY: this.mouse.worldY,
      aimDirX: hasAim ? rawAimX / rawAimLen : fallbackAimDirX,
      aimDirY: hasAim ? rawAimY / rawAimLen : fallbackAimDirY,
      swapAttackQueued: !gameplayBlocked && consumeQueued ? this.consumeKeyQueued("q") : false,
      firePrimaryQueued: !gameplayBlocked && consumeQueued ? this.consumeLeftQueued() : false,
      firePrimaryHeld: !gameplayBlocked && !!this.mouse.leftDown,
      fireAltQueued: !gameplayBlocked && consumeQueued ? this.consumeRightQueued() : false
    };
  }
}
