# Gauntlet Clone (Browser Prototype)

A top-down action roguelite inspired by classic Gauntlet-style dungeon runs.  
You can play in local single-player mode or connect to an authoritative WebSocket server for network testing.

## Tech Stack
- Vanilla JavaScript (ES modules), HTML5 Canvas, CSS
- Node.js for tooling and WebSocket server
- Python `http.server` for static hosting in dev

## Project Status
- Playable prototype with two classes (Archer, Warrior)
- Procedural castle floors with level-gated necromancer boss progression
- Authoritative network mode is implemented as a Phase 1 architecture:
  - One active controller per room
  - Other connected peers are spectators (can request control)

## Requirements
- Node.js 18+ and npm
- Python 3.x (or Python launcher on Windows)
- Modern browser (Chrome/Edge/Firefox)

## Quick Start (Any OS)
1. Install dependencies:
   - `npm install`
2. Launch dev services:
   - `npm run dev`
3. Open:
   - `http://localhost:8080`

`npm run dev` starts:
- static web host on `http://localhost:8080`
- network server on `ws://localhost:8090`
- browser auto-open

Stop with `Ctrl+C`.

## Run Instructions by Environment

### Windows (PowerShell)
1. Install Node.js LTS and Python 3.
2. In project folder:
   - `npm install`
   - `npm run dev`
3. If npm is blocked by execution policy:
   - `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`
4. Open `http://localhost:8080`.

### Linux
1. Install Node.js, npm, Python 3.
2. In project folder:
   - `npm install`
   - `npm run dev`
3. Open `http://localhost:8080`.

### WSL + Windows Browser
- `npm run dev` supports WSL and opens the Windows browser automatically.

## Scripts
- `npm run dev`: start static host + network server + open browser
- `npm run serve`: static host only (`python -m http.server 8080`)
- `npm run server:net`: authoritative WebSocket server only
- `npm run check`: syntax check all JS files (`node --check` sweep)
- `npm run validate:boss`: headless validation for the floor-boss progression loop
- `npm run perf:test`: run automated local+network perf flow and emit `artifacts/perf/latest.json`

## How to Play

### Goal Loop
1. Explore the procedural floor.
2. Reach the floor trigger level: `floor * 5`.
3. Defeat the necromancer mini-boss.
4. Enter the portal that opens on boss defeat.
5. New floor is generated 20% larger each clear.

Run ends when player health reaches 0.

### Controls
- Move: `WASD` / Arrow Keys
- Primary Attack: Left click (hold for auto-attack)
- Secondary Skill: Right click
  - Archer: Fire Arrow
  - Warrior: Rage activation
- Pause / Close menus: `Esc`

## Single-Player vs Multiplayer (Network Mode)

### Single-Player
- Fully local simulation in browser.
- Best responsiveness and reference behavior.

### Network Mode (Authoritative, Phase 1)
- Client connects to WebSocket server (`ws://...`).
- Server simulates authoritative game state.
- Clients render snapshots with interpolation.
- One controller drives the player entity per room; others spectate.
- Spectators can use **Take Control**.

### Start Network Session
1. Run `npm run dev` (or run host + server separately).
2. Open `http://localhost:8080` on one or more machines.
3. Choose class.
4. Set:
   - Server URL (example local: `ws://localhost:8090`)
   - Room ID (same for all players in same room)
   - Player name
5. Click **Join Network Room**.

For LAN testing, host machine should use LAN IP in URL (example: `ws://192.168.1.50:8090`) and allow firewall access to port `8090`.

## Classes

### Elvish Archer
- Ranged class, faster baseline movement
- Lower base health/defense than warrior
- Right-click skill path focused on arrows/AoE

### Castle Warrior
- Melee class, higher baseline health/defense
- Built-in life leech and stronger close combat profile
- Right-click activates Rage if unlocked

## Skills

### Ranger Skill Tree
- Fire Arrow:
  - Unlocks right-click fire projectile
  - Explodes on impact and leaves short burn zone
  - Damage/radius/burn scale with points (diminishing returns)
- Piercing Strike:
  - Chance for arrows to pass through enemies
  - Scales with diminishing returns
- Multiarrow:
  - +1 arrow per point
  - Slight damage bonus with diminishing returns
  - Wider spread as arrow count increases

### Warrior Skill Tree
- Frenzy:
  - On enemy kill, temporary move speed buff
  - Buff scales with points
- Rage:
  - Activated skill on right-click (when unlocked)
  - Duration: 10s
  - Base cooldown: 20s, reduced by invested points
  - Effects while active:
    - Incoming damage halved (rounded down)
    - Base weapon damage bonus (applies before % multipliers)
  - Visual state:
    - Bright red sprite while active
    - Light red while on cooldown

## Stats, Progression, Shop

### Progression
- XP gained directly on enemy kill (no XP orbs)
- Level-up grants:
  - +1 skill point
  - Class-based max HP gain
  - Class-based weapon damage growth
- Gold and build progression persist between floors

### Passive Sustain
- Archer: passive regen every 2s (1% max HP, min 1)
- Warrior: passive regen every 2s (2% max HP, min 1)
- Warrior starts with base life leech; leech heals on damage dealt (rounded up to at least 1 when applicable)

### Shop Upgrades
- Move Speed
- Enemy Spawn Rate (risk/reward scaling)
- Gold Find (improves gold rate and amount)
- Attack Speed
- Damage
- Defense

Shop and skill tree are available from HUD buttons and support scrolling.

## Enemies and Drops
- Ghosts: baseline roaming threat
- Treasure Goblins:
  - Rare
  - Prefer collecting unpicked gold while weak
  - Grow stronger/more aggressive as they consume gold
  - Drop large gold bag on death
- Animated Armor:
  - Tough melee enemies with better rewards
- Mimics:
  - Rarely emerge from breakable boxes
  - Use a tongue strike at short range
- Necromancer floor boss:
  - Spawns when player level reaches `floor * 5`
  - Strafes, casts a three-bolt necrotic volley, and summons skeletons
  - Drops high-value rewards and opens the exit portal on death
- Skeletons:
  - Summoned by the necromancer during the boss encounter
  - Removed when the boss dies

Drop behavior includes gold, health potions, treasure bags, and breakable-container loot.

## Difficulty Scaling
- Difficulty scales primarily with floor progression and partially with player level
- Scales include:
  - Enemy speed
  - Enemy damage
  - Enemy health
  - Enemy defense
  - Enemy spawn pressure
  - Pack density
- XP effectiveness is tuned by player-level-to-floor-level ratio:
  - Best gains around 1x-3x floor level
  - Very low gains when heavily over-leveled for the floor

## Development Notes
- Network and runtime monoliths were split into focused modules:
  - client session/input/prediction/map-readiness helpers in `src/net/*`
  - shared runtime methods in `src/game/*`
  - server protocol/scheduler/serialization helpers in `server/net/*`
- Floor-boss progression is validated by a dedicated headless script in `server/validate-floor-boss.js`
- Delta snapshot protocol is in use with stable entity IDs and keyframe recovery.
- Snapshot ack and per-client recovery are implemented to reduce prolonged desync.
- Projectile reconciliation includes held-fire cadence linkage for reduced origin drift/snap.
- Tick scheduling is drift-compensated with monotonic timing and scheduler telemetry.
- Use `npm run check` before pushing changes
- Network architecture is currently designed to evolve toward true multi-entity multiplayer in later phases

## Codebase Review Snapshot
This section reflects a code review pass over the current repository state.

### Runtime Architecture
- `game.js`: browser bootstrap, character select, local start, and network client session orchestration
- `src/game/*`: game simulation/runtime systems
- `src/rendering/*`: rendering pipeline and HUD
- `src/net/*`: client-side network state sync/interpolation, prediction, map-chunk readiness, and session interaction helpers
- `server/networkServer.js`: authoritative server entrypoint and room management
- `server/net/*`: server-side protocol routing, state serialization, delta helpers, map chunk streaming, scheduler, telemetry

### Network Protocol (Current)
- Client -> Server:
  - `join`
  - `input`
  - `action`
  - `room.takeControl`
- Server -> Client:
  - `hello`
  - `join.ok`
  - `room.roster`
  - `state.mapMeta`
  - `state.mapChunk`
  - `state.snapshot`
  - `warn` / `error`
- Compatibility fallback:
  - `state.map` is still handled client-side for older servers.

### File Size Hotspots (non-`node_modules`)
- `game.js` (~473 lines)
- `server/networkServer.js` (~482 lines)
- `src/rendering/runtimeSceneDrawMethods.js` (~481 lines)
- `server/perfRunner.js` (~435 lines)

No current source monoliths exceed 500 lines.

### Quality Gates
- Automated checks:
  - `npm run check` (syntax sweep via `node --check`)
  - `npm run perf:test` (scripted local+network performance flow)
- Perf artifacts:
  - latest run: `artifacts/perf/latest.json`
  - active baseline: `artifacts/perf/baseline.json`
  - prior baseline snapshots can be stored as `artifacts/perf/baseline_previous.json`

### Performance Baseline Workflow
- Baseline is captured from 3 perf runs and aggregated into `artifacts/perf/baseline.json`.
- New changes are validated by running `npm run perf:test` and comparing `latest.json` metrics against baseline metrics.
- Task pass criteria for performance work:
  - target metric must improve by at least 2% vs baseline (unless a stricter threshold is specified).
- If a baseline metric is invalid for a target area (for example, missing or zero sample counts), baseline must be recaptured before gating.
- Primary comparison metrics include:
  - `avgSnapshotBytes`, `p95SnapshotBytes`
  - `avgCorrectionPx`, `maxCorrectionPx`
  - `p95FrameGapMs`, `clientJitterMs`
  - `projectileOriginErrorPx_p95`, `projectileSnapEvents`
  - server telemetry (tick/serialize/broadcast timing and scheduler drift stats)

### Current Collaboration Notes
- The project is suitable for collaborative feature work, but contributors should treat network mode as an active area (phase-1 authoritative model).
- Recommended PR checklist:
  - run `npm run check`
  - test local single-player flow
  - test network room join/snapshot sync
  - verify no regressions in HUD/shop/skill tree interactions

## Troubleshooting
- `npm: command not found`:
  - Install Node.js and restart terminal.
- `Upgrade Required` in browser on `:8090`:
  - `8090` is WebSocket server, not web host.
  - Open `http://localhost:8080` for game client.
- `EADDRINUSE: 8090`:
  - Another server is already using port `8090`.
  - Stop existing process or run with different `PORT`.
- `304` responses in dev host logs:
  - Normal browser cache behavior, not an error.
