import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DEFAULT_STORE_PATH = resolve(process.cwd(), "data", "leaderboard.json");
export const MAX_GLOBAL_ROWS = 25;

export function sanitizeHandle(value) {
  if (typeof value !== "string") return "Player";
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 20);
  return normalized || "Player";
}

export function normalizeClassType(value) {
  return value === "fighter" || value === "warrior" || value === "necromancer"
    ? (value === "warrior" ? "fighter" : value)
    : "archer";
}

export function normalizeRow(row = {}) {
  return {
    handle: sanitizeHandle(row.handle),
    classType: normalizeClassType(row.classType),
    score: Number.isFinite(row.score) ? Math.max(0, Math.floor(row.score)) : 0,
    timeSeconds: Number.isFinite(row.timeSeconds) ? Math.max(0, Math.floor(row.timeSeconds)) : 0,
    floorReached: Number.isFinite(row.floorReached) ? Math.max(1, Math.floor(row.floorReached)) : 1,
    submittedAt: Number.isFinite(row.submittedAt) ? row.submittedAt : Date.now()
  };
}

export function compareRows(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;
  const floorDiff = b.floorReached - a.floorReached;
  if (floorDiff !== 0) return floorDiff;
  const timeDiff = b.timeSeconds - a.timeSeconds;
  if (timeDiff !== 0) return timeDiff;
  return a.submittedAt - b.submittedAt;
}

export class LeaderboardStore {
  constructor(path = DEFAULT_STORE_PATH) {
    this.path = path;
    this.rows = [];
    this.load();
  }

  load() {
    if (!existsSync(this.path)) {
      this.rows = [];
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf8"));
      const rows = Array.isArray(raw?.rows) ? raw.rows : [];
      this.rows = rows.map(normalizeRow).sort(compareRows).slice(0, MAX_GLOBAL_ROWS);
    } catch {
      this.rows = [];
    }
  }

  save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify({ rows: this.rows }, null, 2)}\n`, "utf8");
  }

  getRows() {
    return this.rows.map((row) => ({ ...row }));
  }

  submitRun(run) {
    this.rows = [...this.rows, normalizeRow(run)].sort(compareRows).slice(0, MAX_GLOBAL_ROWS);
    this.save();
    return this.getRows();
  }
}
