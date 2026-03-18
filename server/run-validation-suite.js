import { spawnSync } from "node:child_process";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(projectRoot);

const SCRIPT_TARGETS = {
  check: "server/check-all.js",
  "validate:boss": "server/validate-floor-boss.js",
  "validate:tactics": "server/validate-tactics.js",
  "validate:minotaur": "server/validate-minotaur.js",
  "validate:dev-start": "server/validate-dev-start.js",
  "validate:loc": "server/validate-loc.js",
  "validate:network-join": "server/validate-network-join.js",
  "validate:network-combat": "server/validate-network-combat.js",
  "validate:network-combat-hit": "server/validate-network-combat-hit.js",
  "validate:network-archer": "server/validate-network-archer.js",
  "validate:network-audio": "server/validate-network-audio.js",
  "validate:network-ui": "server/validate-network-ui.js",
  "perf:test": "server/perfRunner.js",
  "perf:network-browser": "server/perfNetworkBrowser.js",
  "perf:floor-scaling": "server/perfFloorScaling.js"
};

const SUITES = {
  core: ["check", "validate:loc"],
  gameplay: ["validate:boss", "validate:tactics", "validate:minotaur", "validate:dev-start"],
  network: [
    "validate:network-join",
    "validate:network-combat",
    "validate:network-combat-hit",
    "validate:network-archer",
    "validate:network-audio",
    "validate:network-ui"
  ],
  perf: ["perf:test", "perf:network-browser", "perf:floor-scaling"],
  "pre-commit": ["check", "validate:loc", "validate:boss", "validate:tactics", "validate:minotaur", "validate:dev-start"],
  closeout: [
    "check",
    "validate:loc",
    "validate:boss",
    "validate:tactics",
    "validate:minotaur",
    "validate:dev-start",
    "validate:network-join",
    "validate:network-combat",
    "validate:network-combat-hit",
    "validate:network-archer",
    "validate:network-audio",
    "validate:network-ui",
    "perf:test",
    "perf:network-browser",
    "perf:floor-scaling"
  ]
};

function runScript(scriptName) {
  const relativeTarget = SCRIPT_TARGETS[scriptName];
  if (!relativeTarget) {
    throw new Error(`No target configured for validation script "${scriptName}"`);
  }

  const targetUrl = pathToFileURL(resolve(projectRoot, relativeTarget)).href;
  console.log(`\n=== ${scriptName} ===`);
  const result = spawnSync(process.execPath, ["-e", "import(process.argv[1])", targetUrl], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env
  });
  return Number.isFinite(result.status) ? result.status : 1;
}

function main() {
  const suiteName = process.argv[2] || process.argv[1] || "core";
  const scripts = SUITES[suiteName];
  if (!scripts) {
    const known = Object.keys(SUITES).sort().join(", ");
    throw new Error(`Unknown validation suite "${suiteName}". Known suites: ${known}`);
  }

  for (const scriptName of scripts) {
    const status = runScript(scriptName);
    if (status !== 0) process.exit(status);
  }

  console.log(`\nValidation suite "${suiteName}" passed.`);
}

main();
