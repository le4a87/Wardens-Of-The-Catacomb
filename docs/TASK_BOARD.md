# Task Board

Branch: `biomes`

Use this file as the working board for the current branch. Keep tasks finite, testable, and tied to concrete validation steps. When the feature is complete, roll durable summaries into the long-lived docs and reset this file to a clean state.

## Active Tasks
- [x] Add the `sewer` biome with a dedicated hallway-and-offshoot floor generator.
  Scope: Create a sewer-specific map layout with three long water halls, connecting offshoots, and walkable decorative floor tiles for grates and room pools.
  Validation: `npm run check`
- [x] Add sewer biome rendering and encounter reskins.
  Scope: Render sewer walls/floors/moss/water/grates, switch breakables to trashcans and crates, and reskin animated armor stands as disguised gelatinous cube pools.
  Validation: `npm run check`
- [x] Implement sewer biome gameplay modifiers and poison traps.
  Scope: Increase rat archer spawn pressure in sewer floors and replace arrow traps with poison traps that leave damaging acid lines for 5 seconds against the player and allies.
  Validation: `npm run check`, `npm run validate:boss`

## Follow-Ups
- None.

## Validation Commands
- `npm run check`
- `npm run validate:boss`
- `npm run perf:test`

## Validation Results
- 2026-03-18: `npm run check` passed.
- 2026-03-18: `npm run validate:boss` passed.
- 2026-03-18: `npm run check` passed after the sewer biome, poison trap, and reskin changes.
- 2026-03-18: `npm run validate:boss` passed after the sewer biome, poison trap, and reskin changes.
- 2026-03-18: `npm run check` passed after widening sewer offshoots, adding second room entrances, and adding flooded-hall slow.
- 2026-03-18: `npm run validate:boss` passed after widening sewer offshoots, adding second room entrances, and adding flooded-hall slow.
