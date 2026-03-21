import { createLeaderboardApiStore, handleLeaderboardApiRequest } from "../server/leaderboardApi.js";

export default async function handler(req, res) {
  try {
    const store = createLeaderboardApiStore();
    await handleLeaderboardApiRequest(req, res, store);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(`${JSON.stringify({ error: error instanceof Error ? error.message : "Leaderboard API unavailable." })}\n`);
  }
}
