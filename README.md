# Wardens of the Catacomb

Wardens of the Catacomb is a top-down action roguelite built with vanilla JavaScript and HTML5 Canvas. You can run it locally in single-player or connect to an authoritative WebSocket server for network testing.

## Requirements
- Node.js 18+ and npm
- Python 3.x
- Modern browser

## Android Build Requirements
- JDK 21
- Android SDK with:
  - `platform-tools`
  - `platforms;android-36`
  - `build-tools;36.0.0`
- Capacitor dependencies installed via `npm install`

The repo now includes Android packaging and build wrappers that assume the local toolchain lives at:
- `JAVA_HOME=/home/merrik/.local/lib/jdk-21`
- `ANDROID_SDK_ROOT=/home/merrik/Android/Sdk`

If your machine uses different locations, set `JAVA_HOME` and `ANDROID_SDK_ROOT` before running the Android commands below.

## Quick Start
1. Install dependencies:
   - `npm install`
2. Start the dev stack:
   - `npm run dev`
3. Open:
   - `http://localhost:8080`

`npm run dev` starts the static web host, the authoritative WebSocket server, and opens the browser.

## Local Run Flow
- Enter a `Player Handle` before starting a local or network run. The game trims the value to 20 characters and persists it in local storage.
- After the splash screen, choose either `Single` or `Network`.
- `Single` goes directly to Character Select. `Network` goes to Connection Setup first, then into a dedicated shared room lobby.
- Single-player Character Select includes class portraits, class descriptions, and the local run start button.
- Network class selection happens inside the shared room lobby. Players can change class there, mark ready, see the room roster, and auto-start after the shared countdown when everyone is ready.
- Open `Leaderboard` from the start menu to view the persistent global top 25 local solo runs and the current browser session's local results.
- After a local run ends, the leaderboard opens automatically, submits the run to the server-backed global board, and returns to Character Select for the same mode after 10 seconds unless you continue immediately.
- Add `?dev=1` to the URL to expose `Dev Start`, which lets you begin a local run on floors 2-5 with the matching minimum entry level applied automatically.

## Scripts
- `npm run dev`: start static host + network server + open browser
- `npm run serve`: start the static host only
- `npm run server:net`: start the authoritative WebSocket server only
- `npm run build:android:web`: build the Capacitor web bundle in `www/` with Android runtime defaults
- `npm run cap:sync:android`: rebuild the Android web bundle and sync it into the Capacitor native project
- `npm run android:gradle -- <task>`: run any Gradle task through the repo-local Android toolchain wrapper
- `npm run android:assembleDebug`: build the Android debug APK without manual env exports
- `npm run check`: syntax check all JavaScript files
- `npm run validate:core`: syntax, LOC, and core validation grouping
- `npm run validate:gameplay`: boss, tactics, minotaur, solo XP attribution, and gameplay regression grouping
- `npm run validate:network`: browser-driven network join, combat, hit-confirmation, two-client damage, archer, audio, pause-flow, and UI grouping
- `npm run validate:solo-xp`: solo kill reward / XP attribution regression coverage
- `npm run validate:network-pause`: pause-owner overlay isolation regression coverage
- `npm run validate:dev-start`: verify higher-floor dev starts load and spawn correctly
- `npm run validate:pre-commit`: run the recommended pre-commit validation suite
- `npm run validate:closeout`: run the full branch closeout validation suite
- `npm run perf:test`: run the automated local+network perf flow and write `artifacts/perf/latest.json`
- `npm run perf:all`: run the grouped performance suite
- `npm run perf:floor-scaling`: profile later-floor map and enemy-load cost

## Project Snapshot
- Procedural floor progression with alternating floor mini-bosses triggered by player level
- Biome system for floor generation, visuals, traps, breakables, and future floor-specific rules
- Floor biomes currently cycle as `catacomb`, `catacomb`, `catacomb`, `sewer`, then repeat
- Default `catacomb` preserves the original stone crypt layout, arrow traps, and wooden breakables
- `sewer` adds long flooded halls, two-entrance offshoot rooms, darker stonework, sludge water, grate/pool floor dressing, hidden gelatinous cubes, boosted rat archers, and poison traps that leave lingering acid
- Playable classes: Archer, Fighter, and Necromancer
- Class-specific passive level scaling, damage-type resistances, floor-based enemy caps, and progression-driven reward tuning
- Enemy tactics framework with bespoke ghost, goblin, rat-archer, skeleton, mummy, necromancer, and minotaur behaviors
- Tunable per-floor map-growth controls plus later-floor perf instrumentation for map-size and enemy-density analysis
- Staged startup flow with splash, mode selection, network setup, character select, class portrait cards, and mode-aware back navigation
- Expanded in-run HUD with class-aware cooldown widgets, floor objective tracking, boss health bars, a top status bar for run state, and a right panel for player identity and controls
- Stats panel split into character-build and run-telemetry views, including class-specific activity totals, economy stats, damage totals, kill breakdowns, and scaling readouts
- Necromancer-specific right-panel pet-capacity display using orb slots with pale-green filled active summons
- Authoritative network mode with a shared pre-run lobby, up to 6 connected players, duplicate classes, stable per-run player colors, and a dedicated pause owner instead of the old controller/spectator gameplay model
- True multiplayer gameplay with per-player avatars, per-player progression/build state, remote world handles, minimap teammate markers, compact party status UI, and class-colored necromancer summons
- Multiplayer death flow where dead players spectate living teammates, runs only end when all connected players are dead, and completed network runs return to the room lobby instead of kicking players back to setup
- Multiplayer final-results overlay with team roster, per-player level/outcome, kills, and damage dealt; multiplayer leaderboard submission is intentionally disabled for now
- Persistent server-backed leaderboard storage in `data/leaderboard.json` for the global top 25 local solo runs, plus per-session local leaderboard tracking in the browser
- Browser-driven regression coverage for network join, combat, hit confirmation, audio, archer projectile behavior, UI interaction, dev-start flow, and browser perf

## Documentation
- [docs/GAMEPLAY_SYSTEMS.md](docs/GAMEPLAY_SYSTEMS.md): classes, progression, drops, enemies, and difficulty systems
- [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md): runtime architecture, networking, validation, and performance workflow
- [docs/CODEX_WORKFLOW.md](docs/CODEX_WORKFLOW.md): Codex collaboration workflow for this repository
- [docs/TASK_BOARD.md](docs/TASK_BOARD.md): branch task tracking and validation log

## Development Workflow
- Use [docs/TASK_BOARD.md](docs/TASK_BOARD.md) to break work into finite, testable tasks.
- Use [docs/CODEX_WORKFLOW.md](docs/CODEX_WORKFLOW.md) for the expected Codex branch, validation, and PR workflow.
- Run `npm run validate:pre-commit` before committing. Use `npm run validate:closeout` before branch closeout or PR finalization.

## Android Build
1. Install dependencies:
   - `npm install`
2. Build and sync the Android shell:
   - `npm run cap:sync:android`
3. Build the debug APK:
   - `npm run android:assembleDebug`

Debug APK output:
- `android/app/build/outputs/apk/debug/app-debug.apk`

If you want to run other native Gradle tasks, use:
- `npm run android:gradle -- help`
- `npm run android:gradle -- installDebug`
- `npm run android:gradle -- clean`

## Troubleshooting
- If `npm` is missing, install Node.js and reopen the terminal.
- If `http://localhost:8090` shows an error in the browser, that is expected: `8090` is the WebSocket server, not the game client.
- If a port is already in use, stop the conflicting process or start with different `HTTP_PORT` / `WS_PORT` values.
- If `npm run validate:dev-start` cannot launch Chromium, install the missing Playwright browser dependencies for your OS and retry.
- If you are running from a UNC path in Windows/WSL, the project scripts are already configured to resolve from the repo root even if npm prints the standard UNC warning.
- If `npm run android:assembleDebug` reports missing Java or SDK files, either install them at the default paths above or export `JAVA_HOME` and `ANDROID_SDK_ROOT` to your local install locations before rerunning.
