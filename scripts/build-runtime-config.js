import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

const runtimeConfig = {
  defaultWsUrl: normalizeValue(process.env.GAME_WS_URL),
  leaderboardApiUrl: normalizeValue(process.env.LEADERBOARD_API_URL)
};

const outputPath = resolve(process.cwd(), "config.js");
const output = `window.__WOTC_CONFIG__ = Object.freeze(${JSON.stringify(runtimeConfig, null, 2)});\n`;

writeFileSync(outputPath, output, "utf8");
console.log(`Wrote runtime config to ${outputPath}`);
