import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const webDir = resolve(rootDir, "www");
const androidDefaultWsUrl = "wss://wardens-of-the-catacomb-production.up.railway.app";
const copyTargets = ["index.html", "style.css", "game.js", "assets", "src"];

rmSync(webDir, { recursive: true, force: true });
mkdirSync(webDir, { recursive: true });

for (const target of copyTargets) {
  const source = resolve(rootDir, target);
  if (!existsSync(source)) continue;
  cpSync(source, resolve(webDir, target), { recursive: true });
}

const build = spawnSync(process.execPath, [resolve(rootDir, "scripts/build-runtime-config.js")], {
  cwd: rootDir,
  stdio: "inherit",
  env: {
    ...process.env,
    GAME_PLATFORM: process.env.GAME_PLATFORM || "android",
    GAME_WS_URL: process.env.GAME_WS_URL || androidDefaultWsUrl,
    GAME_SHOW_GAMEPLAY_ADS: process.env.GAME_SHOW_GAMEPLAY_ADS || "false",
    GAME_ALLOW_SERVER_URL_OVERRIDE: process.env.GAME_ALLOW_SERVER_URL_OVERRIDE || "true",
    GAME_RUNTIME_CONFIG_OUTPUT: "www/config.js"
  }
});

if (build.status !== 0) process.exit(build.status ?? 1);
console.log(`Prepared Capacitor web bundle in ${webDir}`);
