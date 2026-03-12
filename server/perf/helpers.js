import { existsSync, readFileSync } from "node:fs";

export function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function stddev(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
}

export function readBaseline(path) {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function diffMetric(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) {
    return { delta: 0, deltaPct: 0 };
  }
  const delta = current - baseline;
  return { delta, deltaPct: (delta / baseline) * 100 };
}

export function estimateServerNow(clockOffsetMs, ready) {
  if (!ready) return NaN;
  return Date.now() - clockOffsetMs;
}
