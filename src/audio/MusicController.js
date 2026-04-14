import { getStoredMasterVolume, normalizeMasterVolume, persistMasterVolume, syncGlobalMasterVolume } from "./audioSettings.js";
import { crossfadeAudioVolumes, fadeAudioVolume } from "./audioTransitions.js";
import { createMusicDebugState } from "./musicDebugState.js";
import { ALL_MUSIC_TRACKS, GAMEPLAY_TRACKS, TITLE_TRACK, VICTORY_TRACK, getBossTrackDefinitionForBiome } from "./musicCatalog.js";
const DEATH_TRACK = {
  title: "World's End",
  src: "./assets/sounds/world%27s%20end.mp3"
};
const FADE_DURATION_MS = 900;
  const BOSS_FADE_DURATION_MS = 360;
  const IDLE_SOUND_SRC = "./assets/sounds/basic.mp3";
  const IDLE_INITIAL_DELAY_MS = 6_000;
  const IDLE_REPEAT_DELAY_MS = 6_000;
  const IDLE_VOLUMES = [0.25, 0.5, 0.75, 1];
export class MusicController {
  constructor() {
    this.masterVolume = getStoredMasterVolume();
    this.tracks = ALL_MUSIC_TRACKS.map((track) => ({
      ...track,
      audio: this.createAudio(track.src, { loop: track.loop !== false })
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
    this.deathPlaybackStarted = false;
    this.lastVictoryCueKey = "";
    this.debug = createMusicDebugState();

    this.handleUnlock = this.handleUnlock.bind(this);
    this.handleMuteToggle = this.handleMuteToggle.bind(this);
    this.handleInteraction = this.handleInteraction.bind(this);
    this.updateIdleLoop = this.updateIdleLoop.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    syncGlobalMasterVolume(this.masterVolume);
    window.addEventListener("pointerdown", this.handleUnlock, { passive: true });
    window.addEventListener("keydown", this.handleUnlock);
    window.addEventListener("keydown", this.handleMuteToggle);
    window.addEventListener("pointerdown", this.handleInteraction, { passive: true });
    window.addEventListener("pointermove", this.handleInteraction, { passive: true });
    window.addEventListener("keydown", this.handleInteraction);
    window.addEventListener("wheel", this.handleInteraction, { passive: true });
    window.addEventListener("focus", this.handleWindowFocus);
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.idleRaf = requestAnimationFrame(this.updateIdleLoop);
  }
  createAudio(src, { loop = true } = {}) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = "auto";
    this.setAudioBaseVolume(audio, 1);
    audio.addEventListener("play", () => {
      this.debug.playSuccesses += 1;
      this.recordDebugEvent("play", { src, currentTime: audio.currentTime });
    });
    audio.addEventListener("pause", () => {
      this.debug.pauseCalls += 1;
      this.recordDebugEvent("pause", { src, currentTime: audio.currentTime });
    });
    audio.addEventListener("waiting", () => {
      this.debug.interruptionCount += 1;
      this.debug.waitingCount += 1;
      this.recordDebugEvent("waiting", { src, currentTime: audio.currentTime });
    });
    audio.addEventListener("stalled", () => {
      this.debug.interruptionCount += 1;
      this.debug.stalledCount += 1;
      this.recordDebugEvent("stalled", { src, currentTime: audio.currentTime });
    });
    audio.addEventListener("seeking", () => {
      this.debug.seekCount += 1;
      this.recordDebugEvent("seeking", { src, currentTime: audio.currentTime });
    });
    audio.addEventListener("ended", () => {
      this.recordDebugEvent("ended", { src, currentTime: audio.currentTime });
    });
    return audio;
  }
  recordDebugEvent(type, detail = {}) {
    this.debug.recentEvents.push({
      type,
      atMs: Math.round(performance.now()),
      ...detail
    });
    if (this.debug.recentEvents.length > 40) this.debug.recentEvents.splice(0, this.debug.recentEvents.length - 40);
  }

  attemptAudioPlay(audio, reason) {
    if (!audio) return;
    this.debug.playAttempts += 1;
    this.recordDebugEvent("playAttempt", {
      reason,
      src: audio.currentSrc || audio.src || "",
      currentTime: audio.currentTime
    });
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch((error) => {
        this.debug.playFailures += 1;
        this.recordDebugEvent("playFailure", {
          reason,
          src: audio.currentSrc || audio.src || "",
          message: error?.message || String(error)
        });
      });
    }
  }
  getDebugState() {
    const activeAudio = this.currentMode === "death"
      ? this.deathAudio
      : this.currentTrack?.audio || null;
    return {
      ...this.debug,
      currentMode: this.currentMode,
      currentFloor: this.currentFloor,
      masterVolume: this.masterVolume,
      muted: this.muted,
      idleGameplayActive: this.idleGameplayActive,
      idlePlayCount: this.idlePlayCount,
      documentVisibilityState: typeof document.visibilityState === "string" ? document.visibilityState : "",
      documentHasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
      currentTrackTime: activeAudio ? activeAudio.currentTime : 0,
      currentTrackPaused: activeAudio ? activeAudio.paused : true,
      currentTrackReadyState: activeAudio ? activeAudio.readyState : 0
    };
  }
  handleWindowFocus() {
    this.debug.focusCount += 1;
    this.recordDebugEvent("windowFocus", {
      visibilityState: typeof document.visibilityState === "string" ? document.visibilityState : ""
    });
  }
  handleWindowBlur() {
    this.debug.blurCount += 1;
    this.recordDebugEvent("windowBlur", {
      visibilityState: typeof document.visibilityState === "string" ? document.visibilityState : ""
    });
  }
  handleVisibilityChange() {
    this.debug.visibilityChangeCount += 1;
    this.recordDebugEvent("visibilityChange", {
      visibilityState: typeof document.visibilityState === "string" ? document.visibilityState : ""
    });
  }
  resolveTrack(trackLike) {
    if (!trackLike) return null;
    const title = typeof trackLike.title === "string" ? trackLike.title : null;
    const src = typeof trackLike.src === "string" ? trackLike.src : null;
    return this.tracks.find((track) => (title && track.title === title) || (src && track.src === src)) || null;
  }
  scaleVolume(volume) {
    return normalizeMasterVolume(volume, 1) * this.masterVolume;
  }

  setAudioBaseVolume(audio, volume) {
    if (!audio) return;
    const baseVolume = normalizeMasterVolume(volume, 1);
    audio.__masterBaseVolume = baseVolume;
    audio.volume = this.scaleVolume(baseVolume);
  }
  getAudioBaseVolume(audio, fallback = 1) {
    if (!audio) return normalizeMasterVolume(fallback, 1);
    return normalizeMasterVolume(audio.__masterBaseVolume, fallback);
  }

  refreshVolumeState() {
    for (const track of this.tracks) {
      this.setAudioBaseVolume(track.audio, this.getAudioBaseVolume(track.audio, 1));
    }
    this.setAudioBaseVolume(this.deathAudio, this.getAudioBaseVolume(this.deathAudio, 1));
    for (const audio of this.idleAudios) {
      this.setAudioBaseVolume(audio, this.getAudioBaseVolume(audio, 1));
    }
    syncGlobalMasterVolume(this.masterVolume);
  }
  setMasterVolume(volume, { persist = true } = {}) {
    this.masterVolume = normalizeMasterVolume(volume);
    if (persist) persistMasterVolume(this.masterVolume);
    this.refreshVolumeState();
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
    if (this.currentMode === "death" && this.deathAudio.paused && !this.deathPlaybackStarted) {
      this.attemptAudioPlay(this.deathAudio, "unlock-death");
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
    this.setAudioBaseVolume(audio, IDLE_VOLUMES[Math.min(this.idlePlayCount, IDLE_VOLUMES.length - 1)]);
    audio.muted = this.muted;
    const cleanup = () => {
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("pause", cleanup);
      this.idleAudios.delete(audio);
    };
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("pause", cleanup, { once: true });
    this.idleAudios.add(audio);
    this.attemptAudioPlay(audio, "idle");
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
    if (this.currentMode === "death" && !this.deathPlaybackStarted) {
      this.attemptAudioPlay(this.deathAudio, "unmute-death");
      return;
    }
    this.playCurrentTrack();
  }
  pauseCurrentTrack() {
    this.cancelFade();
    if (this.currentMode === "death") {
      this.deathAudio.pause();
      this.setAudioBaseVolume(this.deathAudio, 1);
      return;
    }
    if (this.currentTrack?.audio) {
      this.currentTrack.audio.pause();
      this.setAudioBaseVolume(this.currentTrack.audio, 1);
    }
  }
  stopDeathMusic({ reset = true } = {}) {
    this.deathAudio.pause();
    this.setAudioBaseVolume(this.deathAudio, 1);
    this.deathPlaybackStarted = false;
    if (reset) this.deathAudio.currentTime = 0;
  }
  playCurrentTrack({ reset = false, volume = 1 } = {}) {
    if (!this.currentTrack || this.muted) return;
    const audio = this.currentTrack.audio;
    if (reset) {
      audio.currentTime = 0;
      this.debug.resetCount += 1;
      this.recordDebugEvent("reset", {
        title: this.currentTrack.title,
        src: audio.currentSrc || audio.src || ""
      });
    }
    this.setAudioBaseVolume(audio, volume);
    if (!audio.paused && !reset) return;
    this.attemptAudioPlay(audio, reset ? "playCurrentTrack-reset" : "playCurrentTrack");
  }
  fadeAudio(audio, from, to, durationMs, token, onDone) {
    this.fadeRaf = fadeAudioVolume({
      getToken: () => this.transitionToken,
      audio,
      from,
      to,
      durationMs,
      onStep: (targetAudio, volume) => this.setAudioBaseVolume(targetAudio, volume),
      onDone: () => {
        this.fadeRaf = 0;
        if (typeof onDone === "function") onDone();
      }
    });
  }
  crossfadeTracks(previousAudio, nextAudio, durationMs, token, onDone) {
    this.fadeRaf = crossfadeAudioVolumes({
      getToken: () => this.transitionToken,
      previousAudio,
      nextAudio,
      fromVolume: this.getAudioBaseVolume(previousAudio, 1),
      durationMs,
      onStep: (targetAudio, volume) => this.setAudioBaseVolume(targetAudio, volume),
      onDone: () => {
        this.fadeRaf = 0;
        if (typeof onDone === "function") onDone();
      }
    });
  }
  transitionToTrack(track, { reset = true, immediate = false, fadeInMs = 0, transitionMs = FADE_DURATION_MS } = {}) {
    if (!track) return;
    this.stopDeathMusic();
    const previousTrack = this.currentTrack;
    const previousAudio = previousTrack?.audio || null;
    const nextAudio = track.audio;
    if (this.muted) {
      this.cancelFade();
      if (previousAudio && previousAudio !== nextAudio) {
        previousAudio.pause();
        this.setAudioBaseVolume(previousAudio, 1);
      }
      this.currentTrack = track;
      this.debug.activeTrackTitle = track.title || "";
      this.debug.activeTrackSrc = track.src || "";
      if (reset) nextAudio.currentTime = 0;
      this.setAudioBaseVolume(nextAudio, 1);
      return;
    }

    if (!previousAudio || immediate) {
      this.cancelFade();
      if (previousAudio && previousAudio !== nextAudio) {
        previousAudio.pause();
        this.setAudioBaseVolume(previousAudio, 1);
      }
      this.currentTrack = track;
      this.debug.trackTransitions += 1;
      this.debug.activeTrackTitle = track.title || "";
      this.debug.activeTrackSrc = track.src || "";
      this.recordDebugEvent("transition", {
        title: track.title,
        immediate: true,
        reset,
        fadeInMs
      });
      if (fadeInMs > 0 && !this.muted) {
        if (reset) nextAudio.currentTime = 0;
        this.setAudioBaseVolume(nextAudio, 0);
        this.attemptAudioPlay(nextAudio, "transition-immediate-fade");
        const token = this.transitionToken;
        this.fadeAudio(nextAudio, 0, 1, fadeInMs, token, () => {
          this.setAudioBaseVolume(nextAudio, 1);
        });
        return;
      }
      this.setAudioBaseVolume(nextAudio, 1);
      this.playCurrentTrack({ reset });
      return;
    }
    if (previousTrack === track && !reset) {
      this.playCurrentTrack();
      return;
    }
    this.cancelFade();
    const token = this.transitionToken;
    this.debug.trackTransitions += 1;
    this.debug.activeTrackTitle = track.title || "";
    this.debug.activeTrackSrc = track.src || "";
      this.recordDebugEvent("transition", {
        title: track.title,
        previousTitle: previousTrack?.title || "",
        immediate: false,
        reset,
        transitionMs
      });

    this.currentTrack = track;
    if (reset) nextAudio.currentTime = 0;
    this.setAudioBaseVolume(nextAudio, 0);
    this.attemptAudioPlay(nextAudio, "transition-crossfade");
    this.crossfadeTracks(previousAudio, nextAudio, transitionMs, token, () => {
      previousAudio.pause();
      this.setAudioBaseVolume(previousAudio, 1);
      this.setAudioBaseVolume(nextAudio, 1);
    });
  }
  playMenuMusic({ fadeInMs = 0 } = {}) {
    this.stopDeathMusic();
    this.currentMode = "menu";
    this.currentFloor = null;
    this.transitionToTrack(this.resolveTrack(TITLE_TRACK), {
      reset: false,
      immediate: !this.currentTrack,
      fadeInMs
    });
  }
  playGameplayMusic(floor, trackLike = null) {
    if (this.currentMode === "victory" && !this.currentTrack?.audio?.ended) return;
    this.stopDeathMusic();
    const normalizedFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    const floorChanged = this.currentMode !== "gameplay" || this.currentFloor !== normalizedFloor;
    const previousMode = this.currentMode;
    this.currentMode = "gameplay";
    this.currentFloor = normalizedFloor;
    const resolvedTrack = trackLike ? this.resolveTrack(trackLike) : null;
    const nextTrack = resolvedTrack || (floorChanged
      ? this.resolveTrack(GAMEPLAY_TRACKS[Math.floor(Math.random() * Math.max(1, GAMEPLAY_TRACKS.length))] || TITLE_TRACK)
      : this.currentTrack);
    if (!nextTrack) return;
    const trackChanged = this.currentTrack !== nextTrack;
    this.transitionToTrack(nextTrack, {
      reset: floorChanged || trackChanged,
      immediate: !this.currentTrack,
      transitionMs: previousMode === "boss" ? BOSS_FADE_DURATION_MS : FADE_DURATION_MS
    });
  }
  getBossTrackForBiome(biomeKey = "") {
    return this.resolveTrack(getBossTrackDefinitionForBiome(biomeKey));
  }
  playBossMusic({ floor = null, biomeKey = "" } = {}) {
    if (this.currentMode === "victory" && !this.currentTrack?.audio?.ended) return;
    this.stopDeathMusic();
    const normalizedFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : this.currentFloor;
    const nextTrack = this.getBossTrackForBiome(biomeKey);
    if (!nextTrack) return;
    const modeChanged = this.currentMode !== "boss";
    const trackChanged = this.currentTrack !== nextTrack;
    this.currentMode = "boss";
    this.currentFloor = normalizedFloor;
    this.transitionToTrack(nextTrack, {
      reset: modeChanged || trackChanged,
      immediate: !this.currentTrack,
      transitionMs: BOSS_FADE_DURATION_MS
    });
  }
  playBossVictoryCue(victoryKey = "") {
    this.stopDeathMusic();
    const nextTrack = this.resolveTrack(VICTORY_TRACK);
    const normalizedKey = typeof victoryKey === "string" ? victoryKey : "";
    const stillPlaying = this.currentMode === "victory" && this.currentTrack === nextTrack && !nextTrack?.audio?.ended;
    if (!nextTrack) return;
    if (normalizedKey && normalizedKey === this.lastVictoryCueKey) return stillPlaying ? this.playCurrentTrack() : undefined;
    if (stillPlaying) return this.playCurrentTrack();
    this.lastVictoryCueKey = normalizedKey;
    this.currentMode = "victory";
    this.transitionToTrack(nextTrack, { reset: true, immediate: !this.currentTrack, transitionMs: BOSS_FADE_DURATION_MS });
  }
  hasPlayedBossVictoryCue(victoryKey = "") { return !!victoryKey && victoryKey === this.lastVictoryCueKey; }
  playDeathMusic({ reset = false } = {}) {
    this.cancelFade();
    this.stopIdleSounds();
    if (this.currentTrack?.audio) {
      this.currentTrack.audio.pause();
      this.setAudioBaseVolume(this.currentTrack.audio, 1);
    }
    this.currentTrack = null;
    this.currentMode = "death";
    this.currentFloor = null;
    this.debug.activeTrackTitle = DEATH_TRACK.title;
    this.debug.activeTrackSrc = DEATH_TRACK.src;
    if (this.deathPlaybackStarted && !reset) return;
    if (reset) this.deathAudio.currentTime = 0;
    this.setAudioBaseVolume(this.deathAudio, 1);
    this.deathPlaybackStarted = true;
    if (this.muted) return;
    if (!this.deathAudio.paused && !reset) return;
    this.attemptAudioPlay(this.deathAudio, reset ? "death-reset" : "death");
  }
}
