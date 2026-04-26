# Task Board

Branch: `android`

Use this file as the working board for the current branch. Keep tasks finite, testable, and tied to concrete validation steps. When the feature is complete, roll durable summaries into the long-lived docs and reset this file to a clean state.

## Active Tasks
- Add the first Android lifecycle bridge for pause/resume, focus, and audio resume handling inside the Capacitor shell without changing desktop behavior.
- Decide whether the generated `android/` project will be committed now or regenerated in local Android Studio setup once Java/SDK tooling is available.
- Validate the packaged shell on a machine with Java plus Android SDK so the hosted `wss://` default, non-gameplay ad policy, and touch HUD can be exercised end-to-end.

## Implementation Task List
- Add centralized runtime-config helpers for platform, default server URL, ad policy, and leaderboard URL resolution.
- Add local-storage helpers for server URL override load, persist-on-success, and reset-to-default behavior.
- Replace hardcoded `ws://localhost:8090` fallbacks in `game.js`, `index.html`, and network bootstrap paths with the shared resolver.
- Update network setup UX to show default vs saved override state and expose a `Use Default` reset action.
- Update ad visibility logic so gameplay never shows ads when the resolved runtime policy disables gameplay ads.
- Refactor `src/InputController.js` toward device-agnostic gameplay intents while keeping the current desktop input behavior unchanged.
- Keep `src/game/GameRuntime.js` and related game-step wiring compatible with desktop input while adding the seam for a touch provider.
- Add Android HUD layout scaffolding for floating-stick activation regions, compact player summary, direct-touch cooldown widget, and always-visible consumables behind Android-only layout branches.
- Add touch-scroll support for shop, skill tree, and stats overlays without regressing mouse-wheel desktop behavior.
- Build a minimal Capacitor Android shell and verify the current client boots with the hosted `wss://wardens-of-the-catacomb-production.up.railway.app` default plus manual override support.
- Run targeted validation after each task, with desktop regression checks treated as required gates, not optional follow-up.

## Follow-Ups
- Confirm whether the Android target is store-distributed, sideload-only, or an internal test build.
- Decide whether tablets are in scope for the first Android UX pass or if phones-only is sufficient.
- Consumables shop still needs a balance-focused polish pass after the UI feedback and trigger-coverage fixes.

## Validation Commands
- `git status -u`
- `git diff -- docs/TASK_BOARD.md docs/ANDROID_SUPPORT_DESIGN.md docs/ANDROID_CONTROLS_HUD_DESIGN.md docs/ANDROID_RUNTIME_CONFIG_DESIGN.md`
- `npm run validate:core`
- `npm run validate:network-join`

## Validation Results
- `git status -u` reviewed before planning changes; branch is `android` with existing unrelated artifact churn in the worktree.
- Architecture audit completed from `README.md`, `docs/TECHNICAL_OVERVIEW.md`, `index.html`, `src/InputController.js`, and `src/audio/MusicController.js`.
- `git diff -- docs/TASK_BOARD.md docs/ANDROID_SUPPORT_DESIGN.md docs/ANDROID_CONTROLS_HUD_DESIGN.md docs/ANDROID_RUNTIME_CONFIG_DESIGN.md` reviewed after the planning edits.
- Android controls and HUD design drafted from the current control path in `src/game/GameRuntime.js`, `src/game/world/uiEconomy.js`, `src/InputController.js`, and HUD modules in `src/rendering/hud/*`.
- Android control decisions updated to floating dual sticks, aim-stick auto-primary-fire, direct-touch cooldown widget skill trigger, persistent consumable slots, always-visible compact player summary, and no ads during gameplay.
- Android runtime-config design drafted from `scripts/build-runtime-config.js`, `game.js`, and `src/bootstrap/networkSessionRuntime.js`, including hosted `wss://` defaults plus manual override support.
- Android hosted default server is `wss://wardens-of-the-catacomb-production.up.railway.app`.
- Server URL override persistence is now recommended on successful connection, not immediately on edit.
- Runtime-config and server URL resolution helpers implemented in `game.js`, `src/runtime/runtimeConfig.js`, `src/bootstrap/networkSessionRuntime.js`, `index.html`, `style.css`, and `scripts/build-runtime-config.js`.
- `npm run validate:core` passed after trimming `src/bootstrap/networkSessionRuntime.js` back under the LOC limit.
- `npm run validate:network-join` passed when rerun outside the sandbox; the initial in-sandbox failure was a local port-bind permission error, not an app regression.
- Shared gameplay-intent input seam implemented in `src/InputController.js`, `src/game/GameRuntime.js`, and `src/net/sessionInteraction.js` while preserving existing desktop control behavior.
- Initial Android HUD scaffold implemented through platform-aware runtime/layout branches in `game.js`, `src/bootstrap/gameStartupRuntime.js`, `src/game/GameRuntimeBase.js`, `src/rendering/RendererRuntimeScene.js`, `src/rendering/runtimeSceneDrawMethods.js`, and `src/rendering/hud/*`.
- `npm run validate:core` passed after the Android HUD scaffold LOC trim.
- `npm run validate:network-join` passed after the shared-input and Android HUD scaffold changes.
- Floating dual-stick Android touch input implemented in `src/InputController.js`, including aim-stick auto-primary-fire, touch-drag overlay scrolling, and tap forwarding into the existing UI click system.
- Android direct-touch interactions now include consumable slots, the existing cooldown ability widget, and compact touch-stick overlay feedback via `src/game/world/uiEconomy.js`, `src/net/sessionInteraction.js`, `src/rendering/hud/consumablesBar.js`, `src/rendering/hud/androidLayout.js`, and `src/rendering/runtimeSceneDrawMethods.js`.
- `npm run validate:core` passed after the Android touch-input pass.
- `npm run validate:network-join` passed after the Android touch-input pass.
- Capacitor dependencies and config added through `package.json`, `package-lock.json`, `capacitor.config.ts`, and `scripts/prepare-capacitor-web.js`.
- Android packaging bundle now builds into `www/` with Android runtime defaults, including hosted `wss://` and gameplay-ads-disabled policy, via `npm run build:android:web`.
- `npx cap add android` and `npm run cap:sync:android` both succeeded, generating and syncing the native shell in `android/`.
- `npm run validate:core` passed after the Capacitor shell spike.
- `npm run validate:network-join` passed after the Capacitor shell spike.
- Native Gradle verification is currently blocked in this environment because `JAVA_HOME` is unset and no `java` runtime is installed, so Android Studio or local SDK validation still needs a machine with Java configured.
- Shop consumable polish pass queued around timed-buff HUD visibility, oil trigger coverage for special attacks, and first-pass duration/value tuning.
