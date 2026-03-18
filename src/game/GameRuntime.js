import { GameRuntimeSystems } from "./GameRuntimeSystems.js";
import { stepGame } from "./gameStep.js";

export class Game extends GameRuntimeSystems {
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.running = false;
    this.rafId = 0;
  }

  update(dt) {
    let mx = 0;
    let my = 0;
    const keys = this.input.keys;
    if (keys.has("arrowleft") || keys.has("a")) mx -= 1;
    if (keys.has("arrowright") || keys.has("d")) mx += 1;
    if (keys.has("arrowup") || keys.has("w")) my -= 1;
    if (keys.has("arrowdown") || keys.has("s")) my += 1;

    const mouse = this.input.mouse;
    if (typeof this.input.refreshAimWorldPosition === "function" && mouse.hasAim) {
      this.input.refreshAimWorldPosition();
    }
    const rawAimX = mouse.worldX - this.player.x;
    const rawAimY = mouse.worldY - this.player.y;
    const rawAimLen = Math.hypot(rawAimX, rawAimY) || 1;
    stepGame(this, dt, {
      processUi: true,
      moveX: mx,
      moveY: my,
      hasAim: !!mouse.hasAim,
      aimX: mouse.worldX,
      aimY: mouse.worldY,
      aimDirX: mouse.hasAim ? rawAimX / rawAimLen : (Number.isFinite(this.player?.dirX) ? this.player.dirX : 1),
      aimDirY: mouse.hasAim ? rawAimY / rawAimLen : (Number.isFinite(this.player?.dirY) ? this.player.dirY : 0),
      firePrimaryQueued: this.input.consumeLeftQueued(),
      firePrimaryHeld: !!mouse.leftDown,
      fireAltQueued: this.input.consumeRightQueued()
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.033);
      this.last = now;
      try {
        this.update(dt);
        this.renderer.draw(this);
      } catch (err) {
        // Keep the frame loop alive for debugging instead of hard-freezing on runtime errors.
        console.error("Game loop error:", err);
        this.paused = true;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.last = performance.now();
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }
}
