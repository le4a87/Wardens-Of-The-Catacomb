# Task Board: Network Performance and Sync Stabilization

All tasks from this board are complete and have been folded into project documentation.

## Current State
- No open tasks.
- Historical implementation details and outcomes are documented in `README.md`.

## Baseline Policy (Ongoing)
- Use `artifacts/perf/baseline.json` as the active performance baseline.
- Any new performance task must define target metrics up front.
- A task may be marked complete only if targeted metrics improve by at least 2% vs baseline (or better threshold if explicitly defined).
- If baseline metrics are invalid for a target area (for example, zero or missing samples), recapture baseline before evaluating completion.

## Standard Validation Commands
- `npm run check`
- `npm run perf:test`
