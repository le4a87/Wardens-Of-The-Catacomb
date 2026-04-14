import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  }
  return fallback;
}

const runtimeConfig = {
  defaultWsUrl: normalizeValue(process.env.GAME_WS_URL),
  leaderboardApiUrl: normalizeValue(process.env.LEADERBOARD_API_URL),
  platform: normalizeValue(process.env.GAME_PLATFORM),
  allowServerUrlOverride: normalizeBoolean(process.env.GAME_ALLOW_SERVER_URL_OVERRIDE, true),
  showGameplayAds: normalizeBoolean(process.env.GAME_SHOW_GAMEPLAY_ADS, true)
};

const outputPath = resolve(process.cwd(), normalizeValue(process.env.GAME_RUNTIME_CONFIG_OUTPUT) || "config.js");
const output = `window.__WOTC_CONFIG__ = Object.freeze(${JSON.stringify(runtimeConfig, null, 2)});\n`;

writeFileSync(outputPath, output, "utf8");
console.log(`Wrote runtime config to ${outputPath}`);
