# Technical Overview

This document summarizes the current high-level architecture and validation workflow.

## Runtime Structure
- [game.js](../game.js): browser bootstrap, splash/menu flow, and client session orchestration
- `src/game/*`: simulation and gameplay runtime systems
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
  - `src/game/enemyRewards.js`
  - `src/game/stepCombatResolution.js`
  - `src/bootstrap/gameUiRuntime.js`
  - `src/bootstrap/gameUiSessionRuntime.js`
  - `src/bootstrap/gameStartupRuntime.js`
  - `src/bootstrap/networkRenderRuntime.js`
  - `src/rendering/rendererEffectsProjectileMethods.js`
  - `src/rendering/rendererEffectsPlayerMethods.js`
  - `src/rendering/runtimeSceneEnemyDrawMethods.js`

## Network Model
- The server is authoritative.
- Rooms currently support one active controller and spectator clients.
- The client handles:
  - snapshot interpolation
  - prediction for controller input
  - map chunk readiness
  - projectile reconciliation

## Validation and Quality Gates
- `npm run check`
  - syntax validation across the repo
- `npm run validate:boss`
  - verifies floor-boss progression and encounter lockout behavior
- `npm run perf:test`
  - runs the local+network scripted perf flow and writes `artifacts/perf/latest.json`

## Performance Workflow
- Baseline metrics are stored in `artifacts/perf/baseline.json`.
- Latest test output is written to `artifacts/perf/latest.json`.
- Current tracked comparison metrics include:
  - snapshot payload size
  - frame gap and jitter
  - correction distance
  - projectile origin error and snap events
  - server tick / serialize / broadcast timing

## Current Validation Notes
- Repo scripts were updated to resolve from the project root in UNC-path environments.
- `server/perfRunner.js` was hardened to resolve its root from `import.meta.url`, matching the other tooling fixes.
- The latest perf artifact should be compared against the baseline before merge if enemy density, spawning, or network payload size changed.

## Current Follow-Ups
- Revisit enemy-density tuning after the recent active-enemy-cap increase.
- Re-check the level-only spawn-rate curve in live play.
- Confirm the floor-boss XP lockout feels correct during active encounters.
- Review whether the current binary asset changes belong in the same branch before merge.
