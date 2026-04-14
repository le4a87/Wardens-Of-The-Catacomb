# Android Support Design

This document defines the recommended path for adding Android support to Wardens of the Catacomb before any gameplay or platform code changes are made.

## Summary

Wardens is already a browser game with a canvas-based client and a separate Node WebSocket server. Because of that, the lowest-risk Android strategy is not a native rewrite. The practical path is to keep the existing web runtime, package it in an Android shell, and add a mobile-specific input and platform layer around the current game.

Recommended approach:

- Package the existing web client as an Android app with Capacitor
- Keep single-player fully client-side inside the packaged app
- Default Android multiplayer to the same deployed `wss://` server used by the hosted web build, while still allowing manual override for local or alternate endpoints
- Add a platform-aware input abstraction so touch controls can coexist with keyboard and mouse
- Review touch controls and HUD changes in design form before any Android runtime implementation begins
- Ship Android support in phases, with a playable single-player build before multiplayer polish and store work

## Current State

The current codebase has these relevant properties:

- The client is vanilla JavaScript, HTML, CSS, and canvas
- The game already runs in a browser without an engine dependency
- Multiplayer depends on a separate Node WebSocket server in `server/networkServer.js`
- The network setup UI defaults to `ws://localhost:8090`, which is desktop-local and not suitable for a packaged phone build
- Input is currently centered on keyboard and mouse in `src/InputController.js`
- Audio already has interaction-unlock and focus/visibility handling in `src/audio/MusicController.js`
- There is no existing mobile shell, manifest, service worker, touch HUD, or Android build pipeline

## Goals

- Reuse as much of the current client runtime as possible
- Avoid a native or engine port unless the web client proves unworkable on device
- Reach a maintainable Android build with the smallest architecture fork
- Preserve both solo and network play where practical
- Keep future validation automatable from the existing repo workflow

## Non-Goals

- Running the Node authoritative server on-device in v1
- Rewriting rendering or gameplay into a native Android UI toolkit
- Solving iOS at the same time unless choices naturally keep that path open

## Constraints

### Networking

- The current multiplayer path assumes a reachable WebSocket server.
- Android app builds cannot rely on `localhost` for the gameplay server.
- The hosted `wss://` deployment already exists for the web build and should become the Android default.
- Android should still expose a manual server override path so local and alternate test servers remain usable.

### Input

- The game currently expects keyboard movement plus mouse aiming and clicks.
- Android needs touch-first controls for movement, aiming, attack, alternate attack, pause, shop, skill tree, and any hotbar actions.
- The current input class is a good seam for abstraction, but not yet sufficient for mobile controls as-is.

### Layout

- Existing menus and HUD were designed around desktop canvas and desktop form controls.
- Android will need safe-area handling, landscape assumptions, larger touch targets, and likely simplified HUD placement.

### Lifecycle and Audio

- Android suspend/resume behavior is harsher than desktop browser tab switching.
- Audio focus, app backgrounding, orientation, and resume flow will need explicit handling beyond the current browser listeners.

## Option Analysis

### Option 1: PWA Only

Description:

- Add web manifest, service worker, installability, and mobile web polish

Pros:

- Lowest implementation cost
- No Android-native project to maintain
- Preserves one deployment surface

Cons:

- Weakest control over fullscreen, lifecycle, splash, and store distribution
- Browser chrome and autoplay/input quirks remain more exposed
- Harder to present as a real Android app
- Less room for native integrations later

Assessment:

- Viable as an intermediate milestone, but not the best primary target if the goal is a proper Android app

### Option 2: Capacitor Android Shell

Description:

- Package the web client into an Android app using Capacitor and keep the game running in a WebView

Pros:

- Reuses the current client almost entirely
- Gives a standard Android project for icons, splash, orientation, permissions, and store packaging
- Leaves room for plugins for status bar, splash, haptics, keep-awake, and other device integration
- Lower cost than a rewrite while producing a real app artifact

Cons:

- Still depends on WebView performance and browser compatibility
- Requires mobile-specific UI and input work in the web layer
- Multiplayer still needs remote backend hosting and secure WebSocket configuration

Assessment:

- Best fit for this repo

### Option 3: Trusted Web Activity

Description:

- Ship the hosted web app through Android with a Chrome-based wrapper

Pros:

- Lighter than a full native rewrite
- Good if the game is primarily a hosted web product

Cons:

- Ties the app more tightly to hosted web deployment
- Less control than Capacitor for local packaging and native hooks
- Still weak for offline/local-first single-player packaging

Assessment:

- Inferior to Capacitor for this project because single-player can live entirely in packaged assets

### Option 4: Native or Engine Port

Description:

- Rebuild the client in a native Android stack or another engine

Pros:

- Maximum platform control
- Potentially better long-term mobile-specific UX if the game is reimagined

Cons:

- Highest cost by a large margin
- Major gameplay regression risk
- Splits the codebase and validation surface

Assessment:

- Not justified unless the current web runtime performs poorly on target devices after a serious Android prototype

## Recommendation

Use Capacitor as the Android packaging layer and treat Android support as a web-client adaptation effort, not a port.

That recommendation is based on the current architecture:

- The rendering and gameplay loop already run in-browser
- The server is already separate from the client
- The main missing pieces are platform integration, touch controls, layout adaptation, and remote-network configuration

## Proposed Architecture

### Client Packaging

- Add a Capacitor project under a dedicated Android app directory
- Build or copy the web client into the Capacitor web assets directory
- Keep one gameplay client codebase, with a small platform-detection layer for Android-specific behavior

### Runtime Modes

- Single-player:
  - Fully supported inside the packaged client with no backend dependency beyond existing leaderboard or ad decisions
- Multiplayer:
  - Supported only against a configured remote authoritative server
  - The Android app should default to the same deployed `wss://` endpoint used by the hosted web build
  - The connection UI should still allow the player or tester to replace that default with a local or alternate server URL

### Input Model

- Refactor `src/InputController.js` into a device-agnostic input state surface
- Add a mobile control layer that can emit the same movement, aim, queued-action, and UI-intent signals as desktop input
- Prefer on-screen controls over gesture-only controls for combat reliability

Recommended Android control scheme for v1:

- Left virtual stick for movement
- Right drag pad or aim stick for facing and ranged targeting
- Large attack button
- Separate alt-attack / class-skill button if required by current controls
- Dedicated pause and UI buttons for shop / skills if those surfaces must remain accessible during play
- Touch-friendly consumable or hotbar buttons if the current design requires them

### UI and Layout

- Lock gameplay to landscape on Android v1
- Add safe-area padding for notches and gesture bars
- Increase touch target sizes in menus and lobby forms
- Rework HUD anchors so critical controls and party status do not overlap touch regions
- Remove or restyle desktop-only hover assumptions

### Audio and Lifecycle

- Preserve the existing interaction-unlock flow, but add app resume and pause hooks through the Android shell
- Explicitly pause or mute on app background when appropriate
- Test resume behavior during calls, app switching, and screen-off/on flows

### Configuration

- Introduce runtime config for:
  - platform type
  - default server URL
  - whether multiplayer is enabled in the current build
  - optional feature flags for mobile HUD and touch controls

## Phased Rollout

### Phase 0: Control And HUD Design Review

- Design the Android touch-control model before runtime changes
- Design HUD and menu layout changes for phone-sized landscape play
- Confirm which in-run actions need dedicated touch affordances in v1
- Review the design and freeze the first implementation scope

Exit criteria:

- Touch controls and HUD adaptation are documented well enough to implement without inventing behavior during coding

### Phase 1: Technical Spike

- Create a minimal Capacitor Android shell
- Confirm the current game boots inside a WebView
- Measure baseline performance on at least one mid-range Android device
- Verify asset loading, canvas scaling, audio unlock, and local single-player playability

Exit criteria:

- The packaged app launches into menus and can start a solo run without runtime blockers

### Phase 2: Mobile Playable Solo

- Add landscape lock and safe-area handling
- Implement touch controls for core gameplay
- Adapt menus and HUD for phone-sized landscape screens
- Replace local desktop defaults with Android-aware config and the hosted `wss://` default

Exit criteria:

- A player can install the app, start a solo run, complete combat, shop interactions, and pause/resume on a phone without keyboard or mouse input

### Phase 3: Android Multiplayer

- Preserve the hosted `wss://` default while keeping manual override support
- Validate room join, class select, gameplay, pause behavior, and reconnect expectations from Android
- Harden lifecycle handling around network interruption and resume

Exit criteria:

- Android clients can join a hosted room and complete a stable multiplayer session

### Phase 4: Store Readiness and Polish

- Splash, icons, signing, package identifiers, privacy copy, and release config
- Ads, analytics, or leaderboard policy decisions if those remain in scope
- Device compatibility testing and crash/perf pass

Exit criteria:

- The app is ready for internal, closed, or public distribution

## Validation Strategy

The existing validation suite is desktop-browser focused. Android support will need additional validation layers.

### Keep Existing Validation

- Continue using current gameplay and network validation to guard core logic regressions
- Keep the Android adaptation layer thin so existing tests remain valuable

### Add Android-Specific Validation

- Manual smoke checklist for:
  - install and launch
  - menu navigation
  - touch controls
  - pause/resume
  - audio unlock and recovery
  - orientation behavior
  - multiplayer join against hosted server
- Targeted browser-emulation checks for touch UI where practical
- At least one real-device validation pass before merging substantial Android work

## Main Risks

- Touch controls may require more gameplay tuning than expected, especially for aiming-heavy classes
- WebView performance may degrade on lower-end devices during dense later floors
- Multiplayer reliability depends on hosted backend readiness and secure WebSocket support
- HUD complexity may not fit phone screens cleanly without reducing or reorganizing information density

## Open Questions

- Is Android v1 expected to ship single-player only, or must multiplayer be available immediately?
- Is the intended release path Google Play, sideloaded APK, or internal test distribution first?
- Should ads exist in the Android build from day one?
- Is portrait support required anywhere, or can Android v1 be landscape-only?
- Are tablets in scope for the initial UX, or only phones?

## Recommended Next Steps

1. Approve Capacitor as the packaging direction.
2. Design and review touch controls and HUD changes before any implementation work.
3. Convert the approved design into a finite implementation task list in `docs/TASK_BOARD.md`.
4. Start with the Capacitor technical spike after the control and HUD design is approved.
