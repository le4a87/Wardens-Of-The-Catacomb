import { compareRows, MAX_GLOBAL_ROWS, normalizeRow } from "./leaderboardStore.js";

const DEFAULT_UPSTASH_KEY = "wardens:leaderboard";

function buildCommandUrl(baseUrl, ...parts) {
  const trimmed = String(baseUrl || "").replace(/\/+$/, "");
  const encoded = parts.map((part) => encodeURIComponent(String(part)));
  return `${trimmed}/${encoded.join("/")}`;
}

async function upstashRequest(baseUrl, token, ...parts) {
  const response = await fetch(buildCommandUrl(baseUrl, ...parts), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Upstash request failed with ${response.status}`);
  }
  return payload?.result;
}

export class UpstashLeaderboardStore {
  constructor({
    url = process.env.UPSTASH_REDIS_REST_URL,
    token = process.env.UPSTASH_REDIS_REST_TOKEN,
    key = process.env.LEADERBOARD_UPSTASH_KEY || DEFAULT_UPSTASH_KEY
  } = {}) {
    if (!url || !token) {
      throw new Error("Missing Upstash Redis REST configuration.");
    }
    this.url = url;
    this.token = token;
    this.key = key;
  }

  async getRows() {
    const raw = await upstashRequest(this.url, this.token, "get", this.key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(String(raw));
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      return rows.map(normalizeRow).sort(compareRows).slice(0, MAX_GLOBAL_ROWS);
    } catch {
      return [];
    }
  }

  async submitRun(run) {
    const rows = [...await this.getRows(), normalizeRow(run)].sort(compareRows).slice(0, MAX_GLOBAL_ROWS);
    await upstashRequest(this.url, this.token, "set", this.key, JSON.stringify({ rows }));
    return rows.map((row) => ({ ...row }));
  }
}
