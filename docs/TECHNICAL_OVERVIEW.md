# Technical Overview

This document summarizes the current high-level architecture and validation workflow.

## Runtime Structure
- [game.js](../game.js): browser bootstrap, splash/menu flow, and client session orchestration
- `src/game/*`: simulation and gameplay runtime systems
- `src/biomes.js`: biome definitions for floor layout, colors, traps, breakables, and special-rule hooks
- `src/mapGenerator.js`: biome-specific procedural map generators for catacomb and sewer floors
- `src/rendering/*`: renderer, HUD, scene drawing, and effects
- `src/net/*`: client-side networking, prediction, interpolation, and map sync helpers
- [server/networkServer.js](../server/networkServer.js): authoritative WebSocket server entrypoint
- `server/net/*`: server-side room, protocol, scheduler, telemetry, and serialization helpers

## Recent Refactor Summary
- Large gameplay, server, bootstrap, and renderer files were split into reusable modules.
- No application JavaScript files remain over the `500` LOC threshold.
- Notable extracted module groups include:
  - `src/game/enemySpawnFactories.js`
  - `src/game/enemyAi.js`
  - `src/game/enemyLeprechaunAi.js`
  - `src/game/enemyTactics.js`
  - `src/game/enemyRewards.js`
  - `src/game/runtimeBasePlacementMethods.js`
  - `src/game/runtimePlayerAttackMethods.js`
  - `src/game/stepCombatResolution.js`
  - `src/bootstrap/gameUiRuntime.js`
  - `src/bootstrap/gameUiSessionRuntime.js`
  - `src/bootstrap/gameStartupRuntime.js`
  - `src/bootstrap/networkRenderRuntime.js`
  - `src/rendering/rendererEffectsProjectileMethods.js`
  - `src/rendering/rendererEffectsPlayerMethods.js`
  - `src/rendering/runtimeSceneBossDrawMethods.js`
  - `src/rendering/runtimeSceneEnemyDrawMethods.js`
  - `src/rendering/runtimeSceneObjectDrawMethods.js`

## Network Model
- The server is authoritative.
- Rooms now support a dedicated shared lobby phase and a true multiplayer active phase.
- A room tracks:
  - `roomOwnerId` for lobby ownership
  - `pauseOwnerId` for global pause authority
  - a roster of connected clients with class selection, ready state, and stable run colors
  - a collection of active player entities rather than only one authoritative avatar
- The client handles:
  - snapshot interpolation
  - local-player prediction/reconciliation
  - map chunk readiness
  - projectile reconciliation
- The authoritative room still keeps one primary `sim.player` path for the pause owner, but snapshots now also serialize a `players` collection for all active participants.
- The client runtime resolves the local player out of `state.players`, keeps remote players in `game.remotePlayers`, and renders/interpolates them separately from the local predicted avatar.
- The network render/runtime path now reads the active `netClient` dynamically instead of capturing a stale pre-connect reference, which keeps multiplayer UI actions working after live room join.
- The browser debug surface in `game.js` now exposes enough live state for Playwright-based network validation and perf harnesses.

### Lobby And Session Flow
- Network players enter Connection Setup, then join a dedicated shared lobby instead of going through the local character-select start path.
- The lobby supports:
  - live shared roster
  - in-room class selection
  - ready/unready state
  - owner star
  - owner-controlled dev start floor selection
  - auto-start countdown when all connected players are ready
- Completed multiplayer runs reset the authoritative room back to the lobby instead of reusing the ended run state.

### Multiplayer Gameplay State
- The authoritative room tracks non-owner active players in `activePlayers` and periodically syncs the pause-owner state out of the primary sim into the same roster shape.
- Snapshot payloads now include:
  - local `player`
  - `players` for the full active roster
  - room/meta ownership and phase fields
  - per-player progression/build state needed for multiplayer HUD and ability correctness
- Per-player skill refund state now moves through the same authoritative pipeline:
  - `refundCount` is cloned with player context
  - spend/refund actions mutate only the acting player's authoritative build state
  - post-action active-player resync happens immediately so the next snapshot does not overwrite freshly updated refund UI
- Remote players now participate in:
  - movement
  - hostile targeting and damage intake
  - class primary/alt combat paths
  - per-player XP/gold/score progression
  - death/spectate flow
  - disconnect removal and room-owner / pause-owner transfer rules

### Spectating And Results
- Dead players stay in the connected run roster, become read-only spectators, and can cycle living targets through keyboard and party-panel selection.
- Final multiplayer results are serialized through room meta state and rendered client-side as a shared team summary rather than using the solo leaderboard path.
- Multiplayer leaderboard submission is currently disabled by design.

## Enemy Runtime Notes
- Enemy behavior now routes through `src/game/enemyTactics.js`, which provides:
  - stable `tacticKey` assignment
  - lightweight phase state on each enemy
  - a central dispatch seam for per-enemy behavior
- Shared movement/pathing now uses target-point steering plus corner-assist probes in `src/game/world/navigationCollision.js`.
- Floor-boss state in `src/game/runtimeFloorBossMethods.js` is now boss-type aware instead of necromancer-specific, which allows the same progression flow to drive both necromancer and minotaur encounters.
- Safe spawn and teleport placement now validate full movement footprints instead of trusting tile centers, which hardens player starts and boss teleports against blocked placements.

## Validation and Quality Gates
- `npm run validate:core`
  - syntax and LOC validation
- `npm run validate:gameplay`
  - boss, tactics, and minotaur gameplay regressions
- `npm run validate:network`
  - browser-driven network join, combat, hit-confirmation, archer, audio, and UI regressions
- `npm run perf:all`
  - local+network perf plus browser perf
- `npm run validate:pre-commit`
  - recommended pre-commit gate
- `npm run validate:closeout`
  - branch closeout gate that runs all grouped validation suites

### Browser Validation Coverage
- `validate:solo-xp`
  - verifies that single-player kill rewards still grant XP/score
  - now fills the required local player handle, uses the solo character-select path, and spawns a deterministic hostile target so the check is not floor-generation dependent
- `validate:skill-refund`
  - verifies local skill spend plus full refund flow, including gold cost, point restoration, and refund-count updates
- `validate:network-join`
  - verifies real browser room join, authoritative spawn adoption, and post-join movement
- `validate:network-combat`
  - verifies controller attack input produces combat objects in a live room
- `validate:network-combat-hit`
  - measures attack emission, enemy HP confirmation, and floating-text confirmation in browser play
  - now uses reliable target-selection and repositioning so misses on drifting enemies do not masquerade as combat-feedback regressions
- `validate:network-archer`
  - checks moving archer shots against live projectile direction/alignment
  - now retries moving-shot samples and records skipped attempts so authoritative-visibility timing noise does not make the suite flaky
- `validate:network-audio`
  - records focused-tab music diagnostics during live network play
- `validate:network-audio:focus`
  - runs the audio validator in explicit focus-cycle mode and records focus/visibility telemetry; use `--headed` when a real desktop session is available and strict blur/focus assertions are desired
- `validate:network-ui`
  - verifies that controller clients can open and interact with skill/shop UI paths in live network sessions
- `validate:network-refund`
  - verifies multiplayer-authoritative refund actions, snapshot propagation, and acting-player build-state resync
- `validate:network-pause`
  - verifies pause-owner shop flow pauses the room without opening overlays on other clients
  - checks that the passive `<handle> paused the game.` banner clears when the pause owner unpauses
- `perf:network-browser`
  - captures active-tab frame cadence, snapshot backlog, correction pressure, and movement-latency proxies
- `validate:dev-start`
  - verifies higher-floor dev starts across classes and catches spawn-quality regressions on larger maps
- `perf:floor-scaling`
  - compares floor `1`, map-only later floors, and loaded later floors so map-growth and enemy-density costs can be evaluated separately

## Performance Workflow
- Baseline metrics are stored in:
  - `artifacts/perf/baseline.json` for the corrected local+network perf runner
  - `artifacts/perf/network-browser-baseline.json` for the browser network harness
- Latest test output is written to:
  - `artifacts/perf/latest.json`
  - `artifacts/perf/network-browser-latest.json`
- Current tracked comparison metrics include:
  - snapshot payload size
  - frame gap and jitter
  - correction distance
  - projectile origin error and snap events
  - server tick / serialize / broadcast timing
- The floor-scaling harness showed that later-floor slowdown is not just geometry growth; enemy load is the dominant multiplier once floor `4+` density ramps up.
- Tunable per-floor map-growth controls now exist so geometry growth can be adjusted independently from combat-density tuning.
- For server-side performance comparisons, treat `serverMetrics.tickDurationMs` as the authoritative server tick metric.
- Treat `avgSnapshotIntervalMs` / `p95SnapshotIntervalMs` as client-observed delivery cadence, not raw server simulation cost.

## Current Validation Notes
- Repo scripts were updated to resolve from the project root in UNC-path environments.
- `server/perfRunner.js` was hardened to resolve its root from `import.meta.url`, matching the other tooling fixes.
- `server/run-validation-suite.js` now groups the growing validation surface into maintainable suites instead of requiring every workflow step to list individual commands manually.
- Shared browser/network harness helpers now live under `server/validation/`, which keeps individual validators below the LOC gate while preserving a common startup, port-probing, and failure-capture path.
- The perf baselines were refreshed from post-fix runs on 2026-03-17/18, so future comparisons should use the current baseline files instead of the earlier pre-correction artifacts.
- `server/validate-floor-boss.js` now validates the generalized floor-boss flow rather than assuming only the necromancer boss exists.
- `server/validate-dev-start.js` now covers higher-floor local dev starts so larger-floor spawn regressions are caught by automation instead of manual testing.
- If network startup or render regressions return, inspect snapshot-buffer identity and snapshot-consumption paths before changing interpolation or prediction. A real branch regression came from replacing the live snapshot buffer after the render loop had already captured it.
- If local-only multiplayer HUD regressions return, inspect the split between immediate local-authoritative state application and delayed buffered snapshot playback. Some multiplayer bugs only affected the damaged player's own HUD while remote party views were already correct.
- If controller-only network UI regressions return, inspect the active `netClient` wiring first. A real regression came from the render loop capturing `null` before connection completed, which silently drained shop/skill clicks through the no-client path.

## Operational Notes
- Revisit enemy-density tuning if the active-enemy-cap curve changes again.
- If manual active-tab audio issues return, rerun `validate:network-audio:focus` in a headed desktop session so the harness can assert real blur/focus/visibility transitions instead of headless continuity only.
