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
- `npm run validate:boss`: validate floor-boss progression and lockout behavior
- `npm run perf:test`: run the automated local+network perf flow and write `artifacts/perf/latest.json`

## Project Snapshot
- Procedural floor progression with a necromancer floor mini-boss triggered by player level
- Playable classes: Archer, Fighter, and Necromancer
- Class-specific passive level scaling, floor-based enemy caps, and progression-driven reward tuning
- Authoritative network mode with one active controller per room and spectator clients that can request control

## Documentation
- [docs/GAMEPLAY_SYSTEMS.md](docs/GAMEPLAY_SYSTEMS.md): classes, progression, drops, enemies, and difficulty systems
- [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md): runtime architecture, networking, validation, and performance workflow
- [docs/CODEX_WORKFLOW.md](docs/CODEX_WORKFLOW.md): Codex collaboration workflow for this repository
- [docs/TASK_BOARD.md](docs/TASK_BOARD.md): branch task tracking and validation log

## Development Workflow
- Use [docs/TASK_BOARD.md](docs/TASK_BOARD.md) to break work into finite, testable tasks.
- Use [docs/CODEX_WORKFLOW.md](docs/CODEX_WORKFLOW.md) for the expected Codex branch, validation, and PR workflow.
- Run `npm run check` before committing. Run `npm run validate:boss` and `npm run perf:test` when changing progression, spawning, networking, or performance-sensitive systems.

## Troubleshooting
- If `npm` is missing, install Node.js and reopen the terminal.
- If `http://localhost:8090` shows an error in the browser, that is expected: `8090` is the WebSocket server, not the game client.
- If a port is already in use, stop the conflicting process or start with different `HTTP_PORT` / `WS_PORT` values.
- If you are running from a UNC path in Windows/WSL, the project scripts are already configured to resolve from the repo root even if npm prints the standard UNC warning.
