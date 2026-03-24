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

## Validation Notes
- 2026-03-21: Reviewed the current controller/spectator path in `server/networkServer.js`, `server/net/AuthoritativeRoom.js`, `server/net/clientMessageHandler.js`, `server/net/stateSerialization.js`, `game.js`, `src/net/clientStateSync.js`, `src/net/sessionInteraction.js`, `src/rendering/rendererEffectsPlayerMethods.js`, and `src/rendering/hud/stats.js`.
- Current blockers for true multiplayer:
  - The authoritative room owns a single `controllerId` and a single `sim.player`.
  - Snapshot serialization only sends one local `player` state plus room roster metadata.
  - Client prediction, reconciliation, camera, collision, combat, pickups, floor progression, and death flow all assume one active player avatar.
  - Network UI actions are dropped for non-controller clients, and `room.takeControl` still exposes the old role model.
  - HUD rendering only supports one player card, one minimap marker, and no in-world labels for remote players.
- Multiplayer design requirements for the next implementation passes:
  - Replace the controller/spectator gameplay split with a room roster of active players, while preserving a separate pause owner role for the first joined player.
  - Allow duplicate classes by storing class selection per player instead of per room.
  - Extend authoritative snapshots/meta state to include all player avatars and enough per-player data for rendering handles, level, health, and minimap/group-panel summaries.
  - Keep the local client camera centered on its own avatar while rendering other players as world entities.
  - Render each remote player handle below their character, and add a new group panel beneath the local player panel showing each other player’s name, level, and health.
  - Restrict pause toggles to the pause-owner player, but allow all players to remain active participants in movement and combat.
- Locked design decisions captured on 2026-03-21:
  - Dead players stay dead until the run ends, then spectate living players; the run ends only when all connected players are dead.
  - Progression is fully per-player.
  - Pickups are first-touch, with shared room-level objective state for key/exit progression.
  - Pause remains global and owner-controlled; shop/skills/stats are per-player overlays.
  - Difficulty scaling continues to use all connected players for now.
  - Spectators can cycle living players and use passive UI; their self context never changes to the spectate target.
  - Late joiners are blocked once the run has started.
  - The pre-run flow is a dedicated shared lobby with live roster, class selection/locking, owner star, and a 5 second auto-start countdown when all connected players are ready.
  - Stable per-run player colors are assigned from a fixed six-color palette on lobby join and persist through gameplay, spectating, minimap, and final results.
  - Active snapshots should carry per-player combat state plus handle and level; compact final-results records are retained for dead/disconnected players.
  - First playable validation must cover both core gameplay flow and multiplayer HUD verification.
- 2026-03-21 implementation kickoff:
  - Starting with room/protocol scaffolding for lobby phase, room owner/pause owner metadata, stable player color assignment, and richer roster payloads before the full multi-avatar simulation refactor.
  - Completed the first scaffolding pass in `server/net/AuthoritativeRoom.js`, `server/net/clientMessageHandler.js`, `server/net/stateSerialization.js`, `src/net/NetClient.js`, `src/net/clientStateSync.js`, and `game.js`.
  - The room/session protocol now carries `phase`, `ownerId`, `pauseOwnerId`, stable player color assignments, and richer roster entries while preserving the legacy `controllerId` field for compatibility.
  - Added a `room.lobbyUpdate` message path so class/ready state can be wired into the future shared lobby instead of reworking the protocol later.
  - Added a dedicated shared lobby screen in `index.html`, `style.css`, and `game.js`, with live roster rendering, local class changes, ready/unready flow, owner labeling, and countdown display.
  - The network join flow now lands in the shared lobby first and only creates the gameplay runtime after the server transitions the room into the active phase.
  - Applied lobby UX follow-up changes: network handle entry now lives in connection setup, network mode no longer routes through pre-join character select, lobby class cards dim when not selected, owner-controlled dev start floor selection now lives in the lobby, and the ready/leave actions share aligned button treatment.
  - Next implementation focus: replace the single authoritative `sim.player` runtime path with a player collection and multi-player snapshot shape, then wire the lobby start into true multi-player gameplay instead of the legacy single-controller active path.
- 2026-03-21 validation:
  - `npm run check` -> passed (`node --check` passed for 97 files).
- 2026-03-21 multiplayer gameplay slice 1:
  - Added authoritative `activePlayers` tracking in `server/net/AuthoritativeRoom.js` and extended `server/net/stateSerialization.js` plus snapshot broadcast payloads to carry `state.players` alongside the legacy single `state.player`.
  - The client snapshot path in `src/net/clientStateSync.js` now derives the local avatar from `state.players` using the local player id, keeps replicated remote players in `game.remotePlayers`, and preserves current local reconciliation behavior.
  - The runtime now renders remote players in-world, on the minimap, and in a compact group panel through `src/rendering/rendererEffectsPlayerMethods.js`, `src/rendering/RendererRuntimeScene.js`, and `src/rendering/hud/stats.js`, using stable run colors and handle labels as the first visible multiplayer gameplay slice.
  - Current limit: only the pause-owner path is still fully wired into the underlying gameplay sim. Remote players now replicate and render, but combat, pickups, progression, death/spectate, and HUD group-panel behavior still need the deeper multiplayer runtime refactor.
- 2026-03-21 multiplayer gameplay slice 2:
  - Added shared player-entity helpers in `src/game/runtimeBaseSupportMethods.js` so the authoritative sim can enumerate living players, apply damage/healing to specific player entities, and avoid immediate game-over when the primary player dies while others are still alive.
  - The authoritative room now exposes `sim.networkActivePlayers` from `server/net/AuthoritativeRoom.js`, using the real primary `sim.player` plus remote active-player state objects so enemy AI and combat resolution can operate on a multiplayer roster.
  - Updated enemy targeting and incoming-damage paths in `src/game/enemyAiShared.js`, `src/game/enemyAi.js`, `src/game/enemyAdvancedAi.js`, `src/game/enemyLeprechaunAi.js`, `src/game/gameStep.js`, and `src/game/stepCombatResolution.js` so hostile AI, wall traps, hostile projectiles, contact damage, mummy aura damage, and health pickups now consider living player entities instead of only `game.player`.
  - Current limit: remote players can now be targeted and lose health on the authoritative sim, but remote offensive actions, per-player progression/rewards, spectate/death ownership flow, and full disconnect/run-end handling still need follow-up passes.
- 2026-03-21 multiplayer gameplay slice 3:
  - Removed the old server-side input gate in `server/net/clientMessageHandler.js` so all active players can send gameplay input during the run instead of only the legacy controller role.
  - Added authoritative remote attack execution in `server/net/AuthoritativeRoom.js` for base-class ranged primary fire and fighter melee, with remote per-player cooldown state tracked on active-player records.
  - Moved per-player cooldown ticking into `src/game/runtimeBaseSupportMethods.js` and adjusted `src/game/gameStep.js` so those timers can apply across the multiplayer player roster instead of only the primary local avatar.
  - Updated `src/game/stepCombatResolution.js` so player projectiles can carry explicit damage values, allowing remote projectiles to resolve using their own attack data instead of borrowing the primary player’s damage roll.
  - Current limit: remote attacks now exist authoritatively for basic archer/fighter primary fire, but remote alternate skills, necromancer multiplayer abilities, per-player XP/gold attribution, death-to-spectate flow, and final run ownership/results logic still need follow-up passes.
- 2026-03-21 multiplayer gameplay slice 4:
  - Added player-owner attribution to enemy damage in `src/game/world/spawnCombat.js` and wired primary/remote projectile plus melee damage call sites through that ownership path.
  - Updated `src/game/stepCombatResolution.js` so enemy kills now award XP and score to the last-hit player entity, and gold pickups award to the actual player entity that touched them instead of always crediting the primary runtime player.
  - Extended active-player state and snapshot serialization in `server/net/AuthoritativeRoom.js` and `server/net/stateSerialization.js` to include per-player progression fields needed for multiplayer self-HUD correctness: level, score, gold, experience, exp-to-next-level, and skill points.
  - Updated `src/net/clientStateSync.js` so in active multiplayer the local player’s own snapshot entry is the source of truth for self progression fields, avoiding primary-player meta fields stomping non-owner HUD state between snapshots.
  - Current limit: per-player reward ownership and self-HUD progression are now wired for basic multiplayer combat, but remote alternate skills, necromancer multiplayer abilities, death-to-spectate flow, disconnect cleanup, and final team-results handling still need follow-up passes.
- 2026-03-21 multiplayer gameplay slice 5:
  - Updated player-death handling in `src/game/runtimeBaseSupportMethods.js` so the run only ends when no living connected players remain, instead of treating the primary local player as a special wipe condition.
  - Added a first spectate handoff path in `src/game/runtimeBaseSupportMethods.js` and `src/game/GameRuntimeBase.js`: when the local player dies and teammates remain alive, the client automatically spectates a living teammate and the camera follows that teammate instead of staying locked to the dead avatar.
  - Updated `src/net/clientStateSync.js` and `src/bootstrap/networkRenderRuntime.js` so spectate target selection refreshes from snapshot state and fog/exploration updates use the spectated teammate while the local player is dead.
  - Current limit: this is the first death/spectate slice only. Manual spectate cycling, spectate-target highlighting, dead-player UI restrictions, disconnect-result bookkeeping, and final team-results flow are still follow-up work.
- 2026-03-21 multiplayer gameplay slice 6:
  - Added explicit spectate target helpers in `src/game/runtimeBaseSupportMethods.js`, including wrapped keyboard cycling and direct target selection by player id for dead spectators.
  - Updated `src/rendering/hud/stats.js` so the bottom-right group panel now publishes clickable teammate row rects and highlights the current spectate target while dead.
  - Updated `src/net/sessionInteraction.js` so dead network clients, including non-owners, can cycle spectate targets with `Q` and `E` or click living teammates in the group panel without reopening the general gameplay action gate.
  - Current limit: disconnect bookkeeping, final team-results flow, and the remaining dead-player UI restrictions still need follow-up work.
- 2026-03-21 multiplayer gameplay slice 7:
  - Added compact authoritative run-result tracking in `server/net/AuthoritativeRoom.js`, retaining per-player final multiplayer summary data for connected and disconnected participants instead of relying on the old single-player game-over assumptions.
  - Extended `server/net/stateSerialization.js` and `src/net/clientStateSync.js` so multiplayer final results travel through room meta state and are stored on the client runtime once the run ends.
  - Updated `src/rendering/RendererRuntimeScene.js` to render an in-canvas multiplayer game-over summary with team roster entries, per-player level, outcome, kills, and damage dealt, replacing the old network leaderboard-driven closeout as the primary multiplayer end-of-run view.
  - Current limit: transient disconnect/owner-transfer notifications and some remaining dead-player UI restrictions still need follow-up work.
- 2026-03-21 multiplayer gameplay slice 8:
  - Fixed spectate identity leaks by making dead players read-only for movement/combat input and preventing dead entities from receiving post-death kill credit, score, gold, or XP in `src/net/sessionInteraction.js`, `server/net/AuthoritativeRoom.js`, `src/game/runtimeBaseSupportMethods.js`, and `src/game/stepCombatResolution.js`.
  - Fixed the client spectate handoff source in `src/game/runtimeBaseSupportMethods.js` so camera follow, spectate selection, and group-panel highlighting use the client’s `remotePlayers` roster rather than only the server-only `networkActivePlayers` array.
  - Hardened melee-swing rendering in `src/rendering/rendererEffectsProjectileMethods.js` against non-finite projectile data, and added top-center queued multiplayer notifications for death, disconnect, and pause-owner transfer in `src/net/clientStateSync.js`, `game.js`, `src/bootstrap/networkRenderRuntime.js`, and `src/rendering/hud/top.js`.
  - Current limit: explicit dead-player UI restrictions for shop/skill access and the remaining multiplayer combat ability gaps still need follow-up work.
- 2026-03-21 multiplayer gameplay slice 9:
  - Tightened dead-player UI restrictions in `src/game/runtimeBaseSupportMethods.js`, `src/game/world/uiEconomy.js`, `src/net/sessionInteraction.js`, and `server/net/clientMessageHandler.js` so dead spectators can keep passive stats access but cannot open or use shop/skill interfaces.
  - Adjusted active multiplayer pause-overlay behavior in `server/net/clientMessageHandler.js`, `src/net/clientStateSync.js`, `src/rendering/hud/top.js`, and `game.js` so pause-owner shop/skill usage pauses the room globally without opening those overlays on other clients; non-owners now see a passive `<handle> paused the game.` banner until the pause owner unpauses.
  - Current limit: remote alternate abilities and the remaining class-specific multiplayer combat gaps still need follow-up work.
- 2026-03-21 multiplayer gameplay slice 10:
  - Extended authoritative active-player state in `server/net/AuthoritativeRoom.js` to carry per-player skills, upgrades, attack cooldowns, level-damage bonus, and warrior-class timers instead of treating remote players as stripped-down combat shells.
  - Reworked remote combat execution in `server/net/AuthoritativeRoom.js` to run through a player-specific simulation context, so remote primary and alternate attacks now use the acting player’s own progression state rather than borrowing pause-owner damage/cooldown values.
  - Added projectile/effect ownership metadata in `src/game/runtimePlayerAttackMethods.js` and updated `src/game/stepCombatResolution.js` plus `src/game/enemyAi.js` so fire-arrow explosions, lingering fire zones, death-bolt explosions/pulses, and warrior momentum-on-kill resolve against the correct player owner.
  - Updated `server/net/clientMessageHandler.js`, `server/net/stateSerialization.js`, `src/net/clientStateSync.js`, and `src/game/runtimeBaseSupportMethods.js` so non-owner buy/skill-spend actions can mutate their own authoritative build state, and each client’s local HUD/runtime now sources skills, upgrades, cooldowns, and rage timers from its own snapshot entry during active multiplayer.
  - Current limit: the authoritative per-player build/combat state is now in place, but non-owner shop/skill overlays themselves are still not full local-per-player multiplayer UI yet, and necromancer primary/control-specific multiplayer behavior still needs a dedicated pass.
- 2026-03-21 multiplayer gameplay slice 11:
  - Added owner-aware controlled-undead support in `src/game/GameRuntimeBase.js`, `src/game/runtimeBaseSupportMethods.js`, `src/game/GameRuntimeSystems.js`, and `src/game/enemyAiShared.js`, so friendly undead can now belong to a specific player, follow that owner, respect that owner’s control cap, and avoid attacking targets actively being charmed by any necromancer beam.
  - Implemented authoritative remote necromancer primary-beam handling in `server/net/AuthoritativeRoom.js`, including line-of-sight targeting, breakable destruction, per-player charm progress, healing of that player’s own controlled undead, and ownership-aware control assignment.
  - Extended `server/net/stateSerialization.js`, `src/net/clientStateSync.js`, and `src/rendering/rendererEffectsProjectileMethods.js` so per-player necromancer beam state replicates and remote/local non-owner necromancer beams render on clients instead of existing only on the pause-owner runtime path.
  - Tagged controlled undead with owner-specific exploding-death metadata in `src/game/GameRuntimeBase.js` and `src/game/runtimePlayerAttackMethods.js` so exploding-death damage remains tied to the controller who owned that undead instead of whichever local runtime processed the kill.
  - Current limit: the remaining major multiplayer gap is now per-player local overlay behavior for non-owner shop/skill/stats interactions and the remaining client-side polish/validation around those multiplayer UI flows.
- 2026-03-21 multiplayer gameplay slice 12:
  - Reworked active-multiplayer UI handling in `src/net/sessionInteraction.js` so non-owners are no longer blocked by the old controller-only UI gate; non-owner shop/skill/stats overlays now open locally, while pause-owner shop/skill actions still route through authoritative room pause.
  - Updated `src/net/clientStateSync.js` so active-multiplayer room meta no longer stomps non-owner local shop/skill/stats overlay state every snapshot, and stats is now treated as a local per-player overlay rather than shared room UI.
  - Adjusted `src/game/world/uiEconomy.js` so active-multiplayer stats toggling is local-only and does not piggyback on the old local-pause behavior, while still closing conflicting overlays and preserving the existing single-player path.
  - Tightened `collectInput` in `src/net/sessionInteraction.js` so living players stop sending movement/combat input while any personal overlay is open, matching the multiplayer design that shop/skill/stats are read-only/local UI moments rather than concurrent gameplay input.
  - Current limit: the main remaining work is broader multiplayer validation/polish, especially exercising these overlay flows under real two-player gameplay and cleaning up any edge cases that surface there.
- 2026-03-21 multiplayer gameplay slice 13:
  - Fixed remote necromancer beam behavior in `server/net/AuthoritativeRoom.js` so held remote beams stay visible while aiming, matching the local necromancer beam path instead of only appearing when a valid undead target was already locked.
  - Extended `server/net/stateSerialization.js` to serialize controlled-undead ownership metadata and owner run colors for enemies, then updated `src/rendering/runtimeSceneEnemyDrawMethods.js` and `src/rendering/runtimeSceneDrawMethods.js` so controlled ghosts, skeletons, and skeleton warriors tint to their owner’s multiplayer color instead of the old hardcoded blue.
  - Added a hard owner leash for controlled undead in `src/game/GameRuntimeSystems.js` so necromancer pets stop chasing once they drift beyond the owner’s control radius and return toward the player instead of wandering off-map.
  - Updated `src/rendering/rendererEffectsProjectileMethods.js` so remote necromancer beams render more defensively and use the owning player’s multiplayer color, with fallback beam endpoints when the target snapshot is transiently incomplete.
- 2026-03-21 validation follow-up:
  - Added `validate:solo-xp` to guard the single-player regression where kill rewards stopped granting XP/score when `lastDamageOwnerId` was missing.
  - Extended `validate:network-two-client-damage` to assert the damaged player's own HP bar becomes visible immediately after taking damage, covering the replicated `hpBarTimer` regression.
  - Added `validate:network-pause` to verify pause-owner shop flow pauses the room without opening overlays on other clients, and that the passive `<handle> paused the game.` banner clears on unpause.
  - Remaining targeted multiplayer checks are still manual for now: death-to-spectate handoff, return-to-lobby after wipe plus fresh rerun, distributed proximity spawns/activations away from the owner, and the full necromancer ownership suite (beam visibility, leash, pet tint, pet kill credit, pets dying with owner).

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
