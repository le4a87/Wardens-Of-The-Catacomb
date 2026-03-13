const TITLE_TRACK = {
  title: "Ward the Catacombs",
  src: "./assets/music/Ward%20the%20Catacombs.mp3"
};

const GAMEPLAY_TRACKS = [
  {
    title: "Evil Lair",
    src: "./assets/music/Evil%20Lair.mp3"
  },
  {
    title: "Hidden Danger",
    src: "./assets/music/Hidden%20Danger.mp3"
  },
  {
    title: "The Crypt",
    src: "./assets/music/The%20Crypt.mp3"
  }
];

const DEATH_TRACK = {
  title: "World's End",
  src: "./assets/sounds/world%27s%20end.mp3"
};

const TRACKS = [TITLE_TRACK, ...GAMEPLAY_TRACKS];
const FADE_DURATION_MS = 900;
const IDLE_SOUND_SRC = "./assets/sounds/basic.mp3";
const IDLE_INITIAL_DELAY_MS = 6_000;
const IDLE_REPEAT_DELAY_MS = 6_000;
const IDLE_VOLUMES = [0.25, 0.5, 0.75, 1];

export class MusicController {
  constructor() {
    this.tracks = TRACKS.map((track) => ({
      ...track,
      audio: this.createAudio(track.src)
    }));
    this.deathAudio = this.createAudio(DEATH_TRACK.src, { loop: false });
    this.currentTrack = null;
    this.currentMode = "menu";
    this.currentFloor = null;
    this.muted = false;
    this.fadeRaf = 0;
    this.transitionToken = 0;
    this.idleGameplayActive = false;
    this.idleElapsedMs = 0;
    this.idleNextPlayAtMs = IDLE_INITIAL_DELAY_MS;
    this.idlePlayCount = 0;
    this.idleAudios = new Set();
    this.idleRaf = 0;
    this.idleLastFrameAt = performance.now();

    this.handleUnlock = this.handleUnlock.bind(this);
    this.handleMuteToggle = this.handleMuteToggle.bind(this);
    this.handleInteraction = this.handleInteraction.bind(this);
    this.updateIdleLoop = this.updateIdleLoop.bind(this);

    window.addEventListener("pointerdown", this.handleUnlock, { passive: true });
    window.addEventListener("keydown", this.handleUnlock);
    window.addEventListener("keydown", this.handleMuteToggle);
    window.addEventListener("pointerdown", this.handleInteraction, { passive: true });
    window.addEventListener("pointermove", this.handleInteraction, { passive: true });
    window.addEventListener("keydown", this.handleInteraction);
    window.addEventListener("wheel", this.handleInteraction, { passive: true });

    this.idleRaf = requestAnimationFrame(this.updateIdleLoop);
  }

  createAudio(src, { loop = true } = {}) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = "auto";
    audio.volume = 1;
    return audio;
  }

  resolveTrack(trackLike) {
    if (!trackLike) return null;
    const title = typeof trackLike.title === "string" ? trackLike.title : null;
    const src = typeof trackLike.src === "string" ? trackLike.src : null;
    return this.tracks.find((track) => (title && track.title === title) || (src && track.src === src)) || null;
  }

  cancelFade() {
    this.transitionToken += 1;
    if (this.fadeRaf) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = 0;
    }
  }

  handleUnlock() {
    if (this.muted) return;
    if (this.currentMode === "death" && this.deathAudio.paused) {
      const playAttempt = this.deathAudio.play();
      if (playAttempt && typeof playAttempt.catch === "function") playAttempt.catch(() => {});
      return;
    }
    if (this.currentTrack?.audio?.paused) this.playCurrentTrack();
  }

  handleMuteToggle(event) {
    if (!event || typeof event.key !== "string") return;
    if (event.key.toLowerCase() !== "m" || event.repeat) return;
    this.setMuted(!this.muted);
  }

  handleInteraction() {
    this.resetIdleTimer();
  }

  resetIdleTimer() {
    this.idleElapsedMs = 0;
    this.idleNextPlayAtMs = IDLE_INITIAL_DELAY_MS;
    this.idlePlayCount = 0;
  }

  stopIdleSounds() {
    for (const audio of this.idleAudios) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.idleAudios.clear();
  }

  setIdleGameplayActive(active) {
    this.idleGameplayActive = !!active;
    if (!this.idleGameplayActive) this.stopIdleSounds();
  }

  playIdleSound() {
    if (!this.idleGameplayActive || this.muted) return;
    const audio = new Audio(IDLE_SOUND_SRC);
    audio.preload = "auto";
    audio.volume = IDLE_VOLUMES[Math.min(this.idlePlayCount, IDLE_VOLUMES.length - 1)];
    audio.muted = this.muted;
    const cleanup = () => {
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("pause", cleanup);
      this.idleAudios.delete(audio);
    };
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("pause", cleanup, { once: true });
    this.idleAudios.add(audio);
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        this.idleAudios.delete(audio);
      });
    }
  }

  updateIdleLoop(now) {
    const elapsedMs = Math.max(0, now - this.idleLastFrameAt);
    this.idleLastFrameAt = now;
    if (this.idleGameplayActive && !this.muted) {
      this.idleElapsedMs += elapsedMs;
      if (this.idleElapsedMs >= this.idleNextPlayAtMs) {
        this.playIdleSound();
        this.idlePlayCount += 1;
        this.idleNextPlayAtMs += IDLE_REPEAT_DELAY_MS;
      }
    }
    this.idleRaf = requestAnimationFrame(this.updateIdleLoop);
  }

  setMuted(muted) {
    this.muted = !!muted;
    for (const track of this.tracks) track.audio.muted = this.muted;
    this.deathAudio.muted = this.muted;
    for (const audio of this.idleAudios) audio.muted = this.muted;
    if (this.muted) {
      this.cancelFade();
      this.stopIdleSounds();
      this.pauseCurrentTrack();
      return;
    }
    if (this.currentMode === "death") {
      const playAttempt = this.deathAudio.play();
      if (playAttempt && typeof playAttempt.catch === "function") playAttempt.catch(() => {});
      return;
    }
    this.playCurrentTrack();
  }

  pauseCurrentTrack() {
    this.cancelFade();
    if (this.currentMode === "death") {
      this.deathAudio.pause();
      this.deathAudio.volume = 1;
      return;
    }
    if (this.currentTrack?.audio) {
      this.currentTrack.audio.pause();
      this.currentTrack.audio.volume = 1;
    }
  }

  stopDeathMusic({ reset = true } = {}) {
    this.deathAudio.pause();
    this.deathAudio.volume = 1;
    if (reset) this.deathAudio.currentTime = 0;
  }

  playCurrentTrack({ reset = false } = {}) {
    if (!this.currentTrack || this.muted) return;
    const audio = this.currentTrack.audio;
    if (reset) audio.currentTime = 0;
    audio.volume = 1;
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === "function") playAttempt.catch(() => {});
  }

  fadeAudio(audio, from, to, durationMs, token, onDone) {
    const startedAt = performance.now();
    const step = (now) => {
      if (token !== this.transitionToken) return;
      const elapsed = Math.max(0, now - startedAt);
      const progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
      audio.volume = from + (to - from) * progress;
      if (progress >= 1) {
        this.fadeRaf = 0;
        if (typeof onDone === "function") onDone();
        return;
      }
      this.fadeRaf = requestAnimationFrame(step);
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  transitionToTrack(track, { reset = true, immediate = false } = {}) {
    if (!track) return;
    this.stopDeathMusic();
    const previousTrack = this.currentTrack;
    const previousAudio = previousTrack?.audio || null;
    const nextAudio = track.audio;

    if (this.muted) {
      this.cancelFade();
      if (previousAudio && previousAudio !== nextAudio) {
        previousAudio.pause();
        previousAudio.volume = 1;
      }
      this.currentTrack = track;
      if (reset) nextAudio.currentTime = 0;
      nextAudio.volume = 1;
      return;
    }

    if (!previousAudio || immediate) {
      this.cancelFade();
      if (previousAudio && previousAudio !== nextAudio) {
        previousAudio.pause();
        previousAudio.volume = 1;
      }
      this.currentTrack = track;
      nextAudio.volume = 1;
      this.playCurrentTrack({ reset });
      return;
    }

    if (previousTrack === track && !reset) {
      this.playCurrentTrack();
      return;
    }

    this.cancelFade();
    const token = this.transitionToken;

    this.fadeAudio(previousAudio, previousAudio.volume, 0, FADE_DURATION_MS * 0.5, token, () => {
      previousAudio.pause();
      previousAudio.volume = 1;
      this.currentTrack = track;
      if (reset) nextAudio.currentTime = 0;
      nextAudio.volume = 0;
      const playAttempt = nextAudio.play();
      if (playAttempt && typeof playAttempt.catch === "function") playAttempt.catch(() => {});
      this.fadeAudio(nextAudio, 0, 1, FADE_DURATION_MS * 0.5, token, () => {
        nextAudio.volume = 1;
      });
    });
  }

  playMenuMusic() {
    this.stopDeathMusic();
    this.currentMode = "menu";
    this.currentFloor = null;
    this.transitionToTrack(this.resolveTrack(TITLE_TRACK), {
      reset: false,
      immediate: !this.currentTrack
    });
  }

  playGameplayMusic(floor, trackLike = null) {
    this.stopDeathMusic();
    const normalizedFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    const floorChanged = this.currentMode !== "gameplay" || this.currentFloor !== normalizedFloor;
    this.currentMode = "gameplay";
    this.currentFloor = normalizedFloor;
    const nextTrack = trackLike
      ? this.resolveTrack(trackLike)
      : floorChanged
      ? this.resolveTrack(GAMEPLAY_TRACKS[Math.floor(Math.random() * Math.max(1, GAMEPLAY_TRACKS.length))] || TITLE_TRACK)
      : this.currentTrack;
    if (!nextTrack) return;
    this.transitionToTrack(nextTrack, {
      reset: floorChanged || !!trackLike,
      immediate: !this.currentTrack
    });
  }

  playDeathMusic({ reset = false } = {}) {
    this.cancelFade();
    this.stopIdleSounds();
    if (this.currentTrack?.audio) {
      this.currentTrack.audio.pause();
      this.currentTrack.audio.volume = 1;
    }
    this.currentTrack = null;
    this.currentMode = "death";
    this.currentFloor = null;
    if (reset) this.deathAudio.currentTime = 0;
    this.deathAudio.volume = 1;
    if (this.muted) return;
    if (!this.deathAudio.paused && !reset) return;
    const playAttempt = this.deathAudio.play();
    if (playAttempt && typeof playAttempt.catch === "function") playAttempt.catch(() => {});
  }
}
