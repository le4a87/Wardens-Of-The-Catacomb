# Wardens of the Catacomb

Wardens of the Catacomb is a top-down action roguelite built with vanilla JavaScript and HTML5 Canvas. You can run it locally in single-player or connect to an authoritative WebSocket server for network testing.

## Requirements
- Node.js 18+ and npm
- Python 3.x
- Modern browser

## Quick Start
1. Install dependencies:
   - `npm install`
2. Start the dev stack:
   - `npm run dev`
3. Open:
   - `http://localhost:8080`

`npm run dev` starts the static web host, the authoritative WebSocket server, and opens the browser.

## Scripts
- `npm run dev`: start static host + network server + open browser
- `npm run serve`: start the static host only
- `npm run server:net`: start the authoritative WebSocket server only
- `npm run check`: syntax check all JavaScript files
- `npm run validate:dev-start`: verify higher-floor dev starts load and spawn correctly
- `npm run validate:pre-commit`: run the recommended pre-commit validation suite
- `npm run validate:closeout`: run the full branch closeout validation suite
- `npm run perf:test`: run the automated local+network perf flow and write `artifacts/perf/latest.json`
- `npm run perf:floor-scaling`: profile later-floor map and enemy-load cost

## Project Snapshot
- Procedural floor progression with alternating floor mini-bosses triggered by player level
- Playable classes: Archer, Fighter, and Necromancer
- Class-specific passive level scaling, damage-type resistances, floor-based enemy caps, and progression-driven reward tuning
- Enemy tactics framework with bespoke ghost, goblin, rat-archer, skeleton, mummy, necromancer, and minotaur behaviors
- Tunable per-floor map-growth controls plus later-floor perf instrumentation for map-size and enemy-density analysis
- Authoritative network mode with one active controller per room and spectator clients that can request control
- Browser-driven regression coverage for network join, combat, hit confirmation, audio, archer projectile behavior, UI interaction, and browser perf

## Documentation
- [docs/GAMEPLAY_SYSTEMS.md](docs/GAMEPLAY_SYSTEMS.md): classes, progression, drops, enemies, and difficulty systems
- [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md): runtime architecture, networking, validation, and performance workflow
- [docs/CODEX_WORKFLOW.md](docs/CODEX_WORKFLOW.md): Codex collaboration workflow for this repository
- [docs/TASK_BOARD.md](docs/TASK_BOARD.md): branch task tracking and validation log

## Development Workflow
- Use [docs/TASK_BOARD.md](docs/TASK_BOARD.md) to break work into finite, testable tasks.
- Use [docs/CODEX_WORKFLOW.md](docs/CODEX_WORKFLOW.md) for the expected Codex branch, validation, and PR workflow.
- Run `npm run validate:pre-commit` before committing. Use `npm run validate:closeout` before branch closeout or PR finalization.

## Troubleshooting
- If `npm` is missing, install Node.js and reopen the terminal.
- If `http://localhost:8090` shows an error in the browser, that is expected: `8090` is the WebSocket server, not the game client.
- If a port is already in use, stop the conflicting process or start with different `HTTP_PORT` / `WS_PORT` values.
- If you are running from a UNC path in Windows/WSL, the project scripts are already configured to resolve from the repo root even if npm prints the standard UNC warning.
