import { GameRuntimeSystems } from "./GameRuntimeSystems.js";
import { stepGame } from "./gameStep.js";

export class Game extends GameRuntimeSystems {
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.running = false;
    this.rafId = 0;
  }

  update(dt) {
    const input = this.input.getGameplayIntent({
      playerX: this.player.x,
      playerY: this.player.y,
      gameplayBlocked: false,
      consumeQueued: true,
      fallbackAimDirX: Number.isFinite(this.player?.dirX) ? this.player.dirX : 1,
      fallbackAimDirY: Number.isFinite(this.player?.dirY) ? this.player.dirY : 0
    });
    stepGame(this, dt, {
      processUi: true,
      ...input
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
