export function createMusicDebugState() {
  return {
    playAttempts: 0,
    playSuccesses: 0,
    playFailures: 0,
    pauseCalls: 0,
    resetCount: 0,
    trackTransitions: 0,
    interruptionCount: 0,
    waitingCount: 0,
    stalledCount: 0,
    seekCount: 0,
    focusCount: 0,
    blurCount: 0,
    visibilityChangeCount: 0,
    activeTrackTitle: "",
    activeTrackSrc: "",
    recentEvents: []
  };
}
