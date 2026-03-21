import { LeaderboardStore } from "./leaderboardStore.js";
import { UpstashLeaderboardStore } from "./upstashLeaderboardStore.js";

function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  res.end(`${JSON.stringify(payload)}\n`);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createLeaderboardApiStore() {
  const hasUpstash =
    typeof process.env.UPSTASH_REDIS_REST_URL === "string" &&
    process.env.UPSTASH_REDIS_REST_URL.length > 0 &&
    typeof process.env.UPSTASH_REDIS_REST_TOKEN === "string" &&
    process.env.UPSTASH_REDIS_REST_TOKEN.length > 0;

  if (hasUpstash) return new UpstashLeaderboardStore();

  if (process.env.VERCEL) {
    throw new Error(
      "Leaderboard storage is not configured for Vercel. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  return new LeaderboardStore();
}

export async function handleLeaderboardApiRequest(req, res, store = createLeaderboardApiStore()) {
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.statusCode = 204;
    if (typeof res.setHeader === "function") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    res.end();
    return;
  }

  if (method === "GET") {
    const rows = await store.getRows();
    writeJson(res, 200, { rows });
    return;
  }

  if (method === "POST") {
    try {
      const body = await readJsonBody(req);
      const run = body?.run && typeof body.run === "object" ? body.run : null;
      if (!run) {
        writeJson(res, 400, { error: "Missing leaderboard run payload" });
        return;
      }
      const rows = await store.submitRun(run);
      writeJson(res, 200, { accepted: true, rows });
    } catch (error) {
      writeJson(res, 400, { error: error instanceof Error ? error.message : "Invalid JSON" });
    }
    return;
  }

  writeJson(res, 405, { error: "Method not allowed" });
}
