export class InputController {
  constructor(canvas, getCamera, isActive) {
    this.canvas = canvas;
    this.getCamera = getCamera;
    this.isActive = isActive;
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
}
