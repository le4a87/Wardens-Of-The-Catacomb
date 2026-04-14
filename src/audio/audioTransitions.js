export function fadeAudioVolume({ getToken, audio, from, to, durationMs, onStep, onDone }) {
  const token = getToken();
  const startedAt = performance.now();
  const step = (now) => {
    if (token !== getToken()) return;
    const elapsed = Math.max(0, now - startedAt);
    const progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
    onStep(audio, from + (to - from) * progress);
    if (progress >= 1) {
      if (typeof onDone === "function") onDone();
      return;
    }
    requestAnimationFrame(step);
  };
  return requestAnimationFrame(step);
}

export function crossfadeAudioVolumes({ getToken, previousAudio, nextAudio, fromVolume = 1, durationMs, onStep, onDone }) {
  const token = getToken();
  const startedAt = performance.now();
  const step = (now) => {
    if (token !== getToken()) return;
    const elapsed = Math.max(0, now - startedAt);
    const progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
    onStep(previousAudio, fromVolume * (1 - progress));
    onStep(nextAudio, progress);
    if (progress >= 1) {
      if (typeof onDone === "function") onDone();
      return;
    }
    requestAnimationFrame(step);
  };
  return requestAnimationFrame(step);
}
