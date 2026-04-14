# Android Runtime Config Design

This document defines how runtime configuration should work for Android support, with emphasis on multiplayer server defaults, manual override behavior, and compatibility with the existing web and validation workflows.

## Goals

- Default Android network play to `wss://wardens-of-the-catacomb-production.up.railway.app`
- Preserve manual server override for local development and alternate test environments
- Keep desktop-local development and Playwright validation working without extra friction
- Avoid hardcoding Android-only networking behavior directly into gameplay code
- Extend the current runtime config path instead of inventing a second configuration system

## Current State

The repo currently has a small runtime config flow:

- `scripts/build-runtime-config.js` writes `config.js`
- `config.js` populates `window.__WOTC_CONFIG__`
- `game.js` reads:
  - `defaultWsUrl`
  - `leaderboardApiUrl`

Current limitations:

- `defaultWsUrl` is the only network runtime setting
- There is no concept of platform-specific defaults
- There is no persisted manual server override
- Several paths still fall back to `ws://localhost:8090`
- The network setup input in `index.html` still ships with `ws://localhost:8090`

## Design Principles

- Runtime config should express defaults, not user state
- Manual server override should be user state and should live in local storage
- Android should use the hosted `wss://` endpoint by default, but that default must remain replaceable
- Desktop local workflows should continue to derive a local default when no runtime-config default is provided
- Validation harnesses should be able to continue filling the server field directly without being blocked by Android defaults

## Configuration Model

### Build-Time Runtime Config

Extend `window.__WOTC_CONFIG__` with explicit fields for platform-aware defaults.

Recommended fields:

- `defaultWsUrl`
  - canonical default multiplayer endpoint for this build
- `leaderboardApiUrl`
  - canonical leaderboard API endpoint for this build
- `platform`
  - runtime build target such as `web` or `android`
- `allowServerUrlOverride`
  - boolean flag controlling whether the UI allows editing the server URL
- `showGameplayAds`
  - boolean flag for whether ads may appear during gameplay

Notes:

- Android should set `platform: "android"`
- Android should set `defaultWsUrl: "wss://wardens-of-the-catacomb-production.up.railway.app"`
- Android should set `showGameplayAds: false`
- Android should keep `allowServerUrlOverride: true`
- Web builds can keep `platform: "web"` and decide `defaultWsUrl` per deployment environment

### User-State Override

Add a persisted user override for the multiplayer server URL.

Recommended storage behavior:

- Store the last explicitly chosen server URL in local storage
- Treat an empty override as `no override`
- Provide a way to reset back to the build default

Recommended storage key:

- `wotcServerUrlOverride`

This is separate from runtime config because:

- runtime config belongs to the build or deployment
- override state belongs to the user or tester on that device

## Resolution Order

The network server URL should resolve in this order:

1. Explicit current value in the server URL input
2. Persisted local override from storage
3. `runtimeConfig.defaultWsUrl`
4. Environment-derived local fallback:
   - `wss://<hostname>:8090` when current page is `https:`
   - `ws://<hostname>:8090` when current page is `http:`

Important rule:

- Android builds should normally stop at step `2` or `3`
- Desktop local development can still reach step `4`

## Android Default Behavior

### First Launch

On a fresh Android install with no stored override:

- the server URL field should resolve to `wss://wardens-of-the-catacomb-production.up.railway.app`
- the player can immediately join the deployed multiplayer server

### Manual Local Testing

If a tester enters a local or alternate server URL:

- that URL should be accepted as the active connection target
- it should persist as the override until reset or replaced
- the UI should make it clear that the current value is overriding the app default

### Reset Behavior

The network setup UI should support returning to the build default.

Recommended UX:

- a small `Use Default` action near the server URL field
- pressing it clears the stored override and repopulates the field from the resolved default

## UI Requirements

### Network Setup Screen

The server URL field should:

- show the resolved current value
- remain editable on Android
- support local `ws://` and remote `wss://` values for testing
- provide a reset-to-default action

The UI should also expose whether the current value is:

- app default
- saved override
- unsaved custom value

This reduces confusion when a tester forgets that a local address was previously saved.

### Android Copy Expectations

Android copy should avoid implying local-only networking defaults.

Examples:

- good:
  - `Server URL`
  - `Default server`
  - `Saved override`
- bad:
  - copy that implies `localhost` is the standard Android path

## Gameplay Ad Rule

Runtime config should explicitly support the Android ad rule:

- ads may appear on non-canvas menu or setup screens
- ads must not appear during active gameplay

Recommended runtime-config field:

- `showGameplayAds`

Android expectation:

- `showGameplayAds: false`

This separates product policy from UI heuristics and avoids relying on fragile screen detection alone.

## Compatibility With Existing Workflows

### Local Desktop Development

Desktop local development should continue working without a runtime-config `defaultWsUrl`.

Expected behavior:

- if no stored override exists
- and no runtime-config `defaultWsUrl` exists
- the app resolves to the current local hostname plus port `8090`

This preserves the current convenience for `npm run dev`.

### Hosted Web Deployment

Hosted web builds can continue to inject the deployed `wss://` endpoint through runtime config.

That means Android and hosted web can share the same server default when appropriate.

### Automated Validation

Current browser-driven validation scripts frequently fill `#net-server-url` directly.

The config design should not break that.

Required property:

- direct test-time writes to the input still win over defaults and stored values

## Override Persistence Decision

Recommended behavior:

- persist the server URL override only after a successful connection attempt

Reasoning:

- it avoids saving accidental typos or half-entered values
- it still supports local testing once the tester actually connects
- it keeps the stored override meaningfully associated with a known-good endpoint

Expected UX:

- editing the field creates an unsaved custom value state
- attempting to connect uses that value immediately
- on successful socket open or successful room join, persist it as the saved override
- if connection fails, leave the field value intact for correction but do not replace the saved override

Reset behavior remains:

- `Use Default` clears both the saved override and any current unsaved custom value

## Required Implementation Tracks

### Runtime Config Builder

Update `scripts/build-runtime-config.js` to emit the expanded runtime config fields.

### Config Readers

Add centralized helpers for:

- reading runtime defaults
- loading and persisting the server URL override
- resolving the effective multiplayer server URL

This should avoid duplicating fallback rules across `game.js` and network session bootstrap code.

### Network Setup Initialization

Replace hardcoded `ws://localhost:8090` fallbacks with the centralized resolver.

### Reset And Persistence UX

Add a UI path to:

- persist explicit override edits
- clear the override and restore the default

### Ad Visibility Logic

Update ad visibility logic so gameplay-canvas sessions do not show ads when the runtime config forbids it.

## Open Questions

- Should Android builds allow overriding the server URL from the in-lobby screen, or only from network setup?
- Should `showGameplayAds` remain a general runtime-config field for all platforms, or be treated as Android-specific policy only?

## Recommendation

Use a two-layer model:

- build-provided runtime defaults from `window.__WOTC_CONFIG__`
- device-local user override in local storage

That model best fits the current repo because it:

- preserves the existing `config.js` approach
- supports Android hosted-server defaults
- preserves manual local testing
- keeps local desktop workflows intact
