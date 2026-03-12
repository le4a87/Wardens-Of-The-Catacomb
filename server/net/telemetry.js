export function monotonicNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

export function makeSamplePusher(maxSamples = 4096) {
  const cap = Number.isFinite(maxSamples) ? Math.max(1, Math.floor(maxSamples)) : 4096;
  return function pushTelemetrySample(list, value) {
    if (!Array.isArray(list) || !Number.isFinite(value)) return;
    list.push(value);
    if (list.length > cap) {
      list.splice(0, list.length - cap);
    }
  };
}

export function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}
