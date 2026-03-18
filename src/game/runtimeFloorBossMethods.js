export const runtimeFloorBossMethods = {
  getFloorBossTriggerLevel(floor = this.floor) {
    const safeFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    const multiplier = Number.isFinite(this.config.progression?.floorBossLevelMultiplier)
      ? Math.max(1, Math.floor(this.config.progression.floorBossLevelMultiplier))
      : 5;
    return safeFloor * multiplier;
  },

  createFloorBossState(floor = this.floor) {
    const safeFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    const bossType = this.getFloorBossType(safeFloor);
    return {
      floor: safeFloor,
      bossType,
      bossName: this.getFloorBossName(bossType),
      triggerLevel: this.getFloorBossTriggerLevel(safeFloor),
      phase: "idle",
      spawnPending: false,
      spawnTriggeredAtLevel: null,
      activatedAtTime: null,
      defeatedAtTime: null,
      portalSpawnedAtTime: null,
      completedAtTime: null
    };
  },

  syncFloorBossState() {
    if (!this.floorBoss || this.floorBoss.floor !== this.floor) {
      this.floorBoss = this.createFloorBossState(this.floor);
      this.lastFloorBossFeedbackPhase = null;
      return this.floorBoss;
    }
    this.floorBoss.bossType = this.getFloorBossType(this.floorBoss.floor);
    this.floorBoss.bossName = this.getFloorBossName(this.floorBoss.bossType);
    this.floorBoss.triggerLevel = this.getFloorBossTriggerLevel(this.floorBoss.floor);
    return this.floorBoss;
  },

  getFloorBossType(floor = this.floor) {
    const safeFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    return safeFloor % 2 === 0 ? "minotaur" : "necromancer";
  },

  getFloorBossName(type = this.getFloorBossType()) {
    return type === "minotaur" ? "Minotaur" : "Necromancer";
  },

  updateFloorBossTrigger() {
    const boss = this.syncFloorBossState();
    if (boss.phase !== "idle") return false;
    if (!Number.isFinite(this.level) || this.level < boss.triggerLevel) return false;
    boss.phase = "queued";
    boss.spawnPending = true;
    boss.spawnTriggeredAtLevel = this.level;
    return true;
  },

  consumeFloorBossSpawnRequest() {
    const boss = this.syncFloorBossState();
    if (!boss.spawnPending) return null;
    boss.spawnPending = false;
    return {
      floor: boss.floor,
      bossType: boss.bossType,
      bossName: boss.bossName,
      triggerLevel: boss.triggerLevel,
      spawnTriggeredAtLevel: boss.spawnTriggeredAtLevel
    };
  },

  markFloorBossActive() {
    const boss = this.syncFloorBossState();
    boss.phase = "active";
    boss.spawnPending = false;
    boss.activatedAtTime = this.time;
  },

  markFloorBossDefeated() {
    const boss = this.syncFloorBossState();
    boss.phase = "defeated";
    boss.spawnPending = false;
    boss.defeatedAtTime = this.time;
  },

  markFloorBossPortalSpawned() {
    const boss = this.syncFloorBossState();
    boss.phase = "portal";
    boss.spawnPending = false;
    boss.portalSpawnedAtTime = this.time;
  },

  markFloorBossCompleted() {
    const boss = this.syncFloorBossState();
    boss.phase = "completed";
    boss.spawnPending = false;
    boss.completedAtTime = this.time;
  },

  isFloorBossActive() {
    const boss = this.syncFloorBossState();
    return boss.phase === "active";
  },

  spawnExitPortal(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || this.portal?.active) return false;
    this.portal = { x, y, active: true };
    this.markFloorBossPortalSpawned();
    return true;
  },

  isPlayerAtPortal() {
    if (!this.portal?.active) return false;
    const dx = this.player.x - this.portal.x;
    const dy = this.player.y - this.portal.y;
    const touchRadius = this.player.size * 0.5 + this.config.map.tile * 0.42;
    return dx * dx + dy * dy <= touchRadius * touchRadius;
  },

  getActiveFloorBossEnemy() {
    return (this.enemies || []).find((enemy) => enemy && enemy.isFloorBoss && enemy.hp > 0) || null;
  },

  getFloorObjectiveText() {
    const boss = this.syncFloorBossState();
    const bossName = boss.bossName || this.getFloorBossName(boss.bossType);
    if (this.portal?.active || boss.phase === "portal") return "Objective: Enter the portal";
    if (boss.phase === "active" || boss.phase === "defeated") return `Objective: Defeat the ${bossName.toLowerCase()}`;
    const targetLevel = Number.isFinite(boss.triggerLevel) ? boss.triggerLevel : this.getFloorBossTriggerLevel();
    const levelsRemaining = Math.max(0, targetLevel - (Number.isFinite(this.level) ? this.level : 1));
    if (boss.phase === "queued") return `Objective: Survive the ${bossName.toLowerCase()} encounter`;
    return levelsRemaining > 0
      ? `Objective: Reach Lv ${targetLevel} to summon the ${bossName.toLowerCase()}`
      : `Objective: Prepare for the ${bossName.toLowerCase()}`;
  },

  getFloorObjectiveDetail() {
    const boss = this.syncFloorBossState();
    const bossName = boss.bossName || this.getFloorBossName(boss.bossType);
    if (this.portal?.active || boss.phase === "portal") return "Portal open. Step into it to descend.";
    if (boss.phase === "active") {
      const activeBoss = this.getActiveFloorBossEnemy();
      if (activeBoss) {
        const dx = activeBoss.x - this.player.x;
        const dy = activeBoss.y - this.player.y;
        const distTiles = Math.max(0, Math.round(Math.hypot(dx, dy) / this.config.map.tile));
        const horizontal = Math.abs(dx) >= this.config.map.tile * 0.75 ? (dx > 0 ? "E" : "W") : "";
        const vertical = Math.abs(dy) >= this.config.map.tile * 0.75 ? (dy > 0 ? "S" : "N") : "";
        const dir = `${vertical}${horizontal}` || "HERE";
        const hint = boss.bossType === "minotaur"
          ? "Avoid charges and stomp range."
          : "Avoid volleys and skeleton summons.";
        return `${bossName} ${distTiles} tiles ${dir}. ${hint}`;
      }
      return boss.bossType === "minotaur"
        ? "Mini-boss active. Avoid charges and stomp range."
        : "Mini-boss active. Avoid volleys and skeleton summons.";
    }
    if (boss.phase === "queued") return `The ritual is complete. The ${bossName.toLowerCase()} is arriving.`;
    const targetLevel = Number.isFinite(boss.triggerLevel) ? boss.triggerLevel : this.getFloorBossTriggerLevel();
    const currentLevel = Number.isFinite(this.level) ? this.level : 1;
    return `Floor ${this.floor} trigger: Lv ${currentLevel}/${targetLevel}`;
  },

  getFeedbackAudioContext() {
    if (this.feedbackAudioContext) return this.feedbackAudioContext;
    if (typeof window === "undefined") return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioCtor !== "function") return null;
    this.feedbackAudioContext = new AudioCtor();
    return this.feedbackAudioContext;
  },

  playToneSequence(sequence) {
    if (!Array.isArray(sequence) || sequence.length === 0) return false;
    const audio = this.getFeedbackAudioContext();
    if (!audio) return false;
    if (audio.state === "suspended" && typeof audio.resume === "function") {
      audio.resume().catch(() => {});
    }
    const startAt = audio.currentTime + 0.01;
    for (const tone of sequence) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tone.type || "triangle";
      oscillator.frequency.value = Number.isFinite(tone.frequency) ? tone.frequency : 440;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      const toneStart = startAt + Math.max(0, tone.at || 0);
      const duration = Math.max(0.04, Number.isFinite(tone.duration) ? tone.duration : 0.12);
      const toneEnd = toneStart + duration;
      const peak = Number.isFinite(tone.gain) ? tone.gain : 0.035;
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.linearRampToValueAtTime(peak, toneStart + Math.min(0.02, duration * 0.35));
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
      oscillator.start(toneStart);
      oscillator.stop(toneEnd + 0.02);
    }
    return true;
  },

  playFloorBossPhaseCue(phase) {
    if (phase === "active") {
      return this.playToneSequence([
        { at: 0, frequency: 246.94, duration: 0.16, gain: 0.03, type: "sawtooth" },
        { at: 0.12, frequency: 196.0, duration: 0.2, gain: 0.028, type: "triangle" }
      ]);
    }
    if (phase === "portal") {
      return this.playToneSequence([
        { at: 0, frequency: 392.0, duration: 0.12, gain: 0.026, type: "triangle" },
        { at: 0.09, frequency: 523.25, duration: 0.14, gain: 0.028, type: "triangle" },
        { at: 0.2, frequency: 659.25, duration: 0.18, gain: 0.03, type: "sine" }
      ]);
    }
    return false;
  },

  syncFloorBossFeedback() {
    const boss = this.syncFloorBossState();
    if (boss.phase === this.lastFloorBossFeedbackPhase) return;
    this.lastFloorBossFeedbackPhase = boss.phase;
    if (boss.phase === "active" || boss.phase === "portal") this.playFloorBossPhaseCue(boss.phase);
  }
};
