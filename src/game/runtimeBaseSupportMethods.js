export const runtimeBaseSupportMethods = {
  shouldShowPlayerHealthBar() {
    const ratio = this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 0;
    return this.player.hpBarTimer > 0 || ratio <= this.config.player.lowHealthThreshold;
  },

  markPlayerHealthBarVisible() {
    this.player.hpBarTimer = this.config.player.hpBarDuration;
  },

  applyPlayerHealing(amount) {
    if (amount <= 0) return;
    const before = this.player.health;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
    if (this.player.health > before) {
      const healed = this.player.health - before;
      this.markPlayerHealthBarVisible();
      this.spawnFloatingText(this.player.x, this.player.y - 26, `+${Math.max(1, Math.round(healed))}`, "#79e59a", 0.8, 14);
    }
  },

  getHealthPickupAmount() {
    const pct = Number.isFinite(this.config?.drops?.healthRestorePct) ? this.config.drops.healthRestorePct : 0.25;
    return Math.max(1, Math.round(this.player.maxHealth * Math.max(0, pct)));
  },

  applyPlayerDamage(amount) {
    if (amount <= 0) return;
    this.spawnFloatingText(this.player.x, this.player.y - 18, `-${Math.round(amount)}`, "#ef6d6d");
    this.player.health = Math.max(0, this.player.health - amount);
    this.markPlayerHealthBarVisible();
    if (this.player.health <= 0) this.triggerGameOver();
  },

  triggerGameOver() {
    if (this.deathTransition.active) return;
    this.gameOver = true;
    this.paused = false;
    this.shopOpen = false;
    this.skillTreeOpen = false;
    this.statsPanelOpen = false;
    this.deathTransition.active = true;
    this.deathTransition.elapsed = 0;
    this.deathTransition.returnTriggered = false;
    if (typeof this.onGameOverChanged === "function") this.onGameOverChanged(true, this);
  },

  updateDeathTransition(dt) {
    if (!this.deathTransition.active) return false;
    this.deathTransition.elapsed = Math.min(
      this.deathTransitionDuration,
      this.deathTransition.elapsed + Math.max(0, Number.isFinite(dt) ? dt : 0)
    );
    if (!this.deathTransition.returnTriggered && this.deathTransition.elapsed >= this.deathTransitionDuration) {
      this.deathTransition.returnTriggered = true;
      if (typeof this.onReturnToMenu === "function") this.onReturnToMenu();
    }
    return true;
  },

  getDeathTransitionProgress() {
    if (!this.deathTransition.active || this.deathTransitionDuration <= 0) return 0;
    return Math.max(0, Math.min(1, this.deathTransition.elapsed / this.deathTransitionDuration));
  },

  spawnFloatingText(x, y, text, color, life = 0.75, size = 14) {
    this.floatingTexts.push({ x, y, text, color, life, maxLife: life, vy: 22, size });
  },

  recordPlayerShotTelemetry(entry = {}) {
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.recentPlayerShots.push({
      atMs: Math.round(nowMs),
      classType: this.classType,
      floor: this.floor,
      ...entry
    });
    if (this.recentPlayerShots.length > 24) {
      this.recentPlayerShots.splice(0, this.recentPlayerShots.length - 24);
    }
  }
};
