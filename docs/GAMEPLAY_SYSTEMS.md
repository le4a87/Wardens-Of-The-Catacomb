# Gameplay Systems

This document summarizes the current gameplay-facing systems and balance rules.

## Core Loop
1. Explore the current floor.
2. Level up until you hit the floor boss trigger: `floor * 5`.
3. Defeat the current floor mini-boss.
4. Enter the exit portal.
5. Repeat on a larger floor.

Higher-floor dev starts now use room-centered spawn selection instead of arbitrary central-floor tiles, so jumping directly to later floors no longer tends to start the player in cramped corridor positions.

## Controls
- Move: `WASD` / Arrow Keys
- Primary attack: left click
- Secondary skill: right click
- Pause / resume: HUD `Pause` button, then overlay `Resume` button. In multiplayer, pause controls are disabled for clients without pause authority.
- Runtime options: top-right `Options` button opens the same persistent Options panel used by the main menu.
- Gameplay Tips are enabled by default from the Options menu and can also be changed in-game. Tips appear as a top-left help bubble for `5s`, are prefixed with `TIP:`, and fade out. The start tip explains movement, primary fire, and the class special; the level `2` tip explains swapping between class modes using `Q` on desktop or the Swap button on Android. Level `3` shows a class-specific tip, then additional tips from `tips.txt` appear at random after level `3`.

## Classes

### Archer
- Fastest baseline movement
- Lower health and defense than the melee class
- Passive level growth emphasizes move speed and attack speed
- Skill path focuses on Fire Arrow, Piercing Strike, and Multiarrow
- The current class-art pass focuses on making the ranger read as a female elf archer while preserving the retro sprite style. Ranger talent choices can change costume accents, weapon silhouettes, projectile styling, and short-lived status/effect visuals without changing combat rules by themselves.
- Ranger path and capstone visual accents are intentionally small and readable: Fire Arrow/storm effects emphasize orange and pale-blue arrow energy, Rogue emphasizes dark hood/shadow cues, Assassin emphasizes sharper dagger/execution marks, and Beast Master emphasizes natural green/bone/wolf-pact accents.
- Rogue attacks made from stealth, including Shadowstep, Shadow Veil, and smoke concealment, deal double damage and have a 33% critical-strike chance.
- Assassin ranged attacks chain physical damage to nearby enemies at medium-or-higher combo, and Assassin attacks have a 40% chance to execute normal enemies reduced below 15% health. Ranged executes leave a short red splash where the enemy fell.
- Throwing Knives now present ranged and melee modes differently without changing attack rules: ranged throws alternate hands and briefly show the thrown hand empty during reload, while melee `Close Cuts` draws tight alternating slash arcs near the ranger.
- Ranger `Flurry` converts combo tiers into attack speed, granting `+6%`, `+12%`, or `+18%` attack speed at `5`, `10`, or `20` combo.

### Fighter
- Higher baseline health and defense
- Built-in life leech and strong close-range damage
- Passive level growth emphasizes durability through health and defense
- Base `unholy` resistance reduces pressure from ghost siphons and related necrotic/death effects
- Skill path focuses on Frenzy, Rage, and Execute-style melee pressure
- The current class-art pass makes the fighter read as a castle warrior: heavy worn plate, dark cloak, leather straps, gray hair/beard, wolf clasp, and restrained doctrine accents. Warrior talent choices can change weapon silhouettes, doctrine colors, battle-cry aura colors, and short-lived status/effect visuals without changing combat rules by themselves.
- Warrior weapon-form visuals are distinct at gameplay scale: broadsword, longspear, war whip, and twin hatchets each use their own shoulder-rooted combat presentation. Red is reserved for battle-cry-style effects instead of the default body palette.

### Necromancer
- Control-focused ranged class
- Passive level growth emphasizes health, control power, and charm efficiency
- Skill path focuses on Control Mastery, Death Bolt, and augmenting controlled undead
- The current mage art pass makes the default loadout read as a hooded spellcaster with robe mass, visible front/back/side profiles, and a separately rigged staff or focus that follows the selected aim direction.
- No-talent mage primary fire is `Arcane Bolt`, a lower-DPS neutral projectile with modest light and no burn. Spending into Fire Bolt unlocks the stronger fire projectile and burning effect instead of duplicating the starter attack.
- Tier-1 mage cantrips have distinct roles:
  - `Fire Bolt` is the stronger burning projectile; burn damage and floating text pulse once per second and the projectile emits fire light.
  - `Frozen Orb` is a slower, lower-direct-damage cold orb that pulses smaller slowing shards while traveling. Chilled enemies tint bright blue on the sprite only, with no separate badge or floor tint, and the chill visual clears when the enemy dies.
  - `Shock` uses jagged electricity and branching arcs, with projectile and arc light emission.
  - `Green-Flame Blade` swaps the staff presentation for a compact green flame blade that swings during melee cantrip attacks without changing the melee tuning.

## Progression
- XP is granted directly on enemy kills.
- XP gain is blocked while the floor boss is active.
- XP-to-next-level uses the original exponential curve through level `19`.
- Starting at level `20`, XP requirements use a bounded late-game curve:
  - level `20-24`: `5500` XP per level
  - level `25-29`: `6300` XP per level
  - level `30-34`: `7100` XP per level
  - level `35+`: capped at `7500` XP per level
- This keeps floors after floor `4` near a five-minute ambient-spawn clear target instead of letting exponential XP requirements outpace capped spawn pressure.
- Each level grants:
  - `+1` skill point
  - class-based max-health growth
  - class-based offensive scaling
  - class-specific passive stat growth
- In multiplayer, some progression remains per-player while rewards are shared:
  - XP from kills and gold from pickups are granted to each living active player
  - kill score, skills, upgrades, cooldowns, and class build state belong to the acting player
  - kill rewards are last-hit based
  - controlled-necromancer summons inherit kill and damage credit for their owning necromancer, while XP rewards still fan out to the group

## Biomes
- Floors resolve through a biome layer before generation, trap placement, breakable placement, and rendering.
- The current biome cycle is:
  - floors `1-3`: `Catacomb`
  - floor `4`: `Sewer`
  - then repeat every four floors
- Biomes also contribute to the map signature used by sync/runtime systems, so clients stay aligned on floor presentation and hazards.

### Catacomb
- Uses the original crypt room-and-corridor layout.
- Visual identity:
  - dark stone floors and walls
  - wooden crates and boxes
  - standard dungeon door treatment
- Trap profile:
  - classic wall arrow traps
- Encounter profile:
  - baseline spawn rules with no biome-specific modifiers

### Sewer
- Uses a dedicated sewer layout with three long flooded halls, connecting offshoot corridors, and rooms with at least two entrances.
- Visual identity:
  - dark grey walls with green moss patches
  - darker grey floor tiles
  - dark brown-green sludge water in flooded halls
  - grates, rivulets, and room pool decals
  - sewer breakables are metal trashcans and crates
- Trap profile:
  - wall traps become poison traps
  - poison traps lay a line of acid pools instead of firing projectiles
  - acid lingers for `5s` and uses a reduced damage multiplier relative to base armor-enemy contact damage
- Encounter profile:
  - rat archers are `3x` more likely to spawn when they are eligible
  - rat archer active-cap is increased by `5`
  - armor stands are reskinned as small sewer pools
  - animated armor is reskinned as a gelatinous cube / moving water pool
  - disguised sewer cubes do not activate until the player is within `1` tile
- Terrain rules:
  - flooded hall tiles slow player movement by `20%`
  - room pools are visual decals only, though some pool tiles hide disguised cube enemies

## Dynamic Lighting
- Dungeon floors render with ambient darkness by default, but unlit areas are never fully black. Figures and nearby shapes remain faintly readable outside direct light.
- Light falloff is gradual:
  - bright near the source
  - dim through the middle radius
  - very dark past the outer falloff
- Current light sources are:
  - the local player
  - lit dungeon torches
  - remote players in multiplayer sessions
- Player light radius is driven by lantern fuel:
  - fuel starts at `50%`
  - `0%` fuel emits no player light and matches global darkness
  - radius scales linearly with fuel percentage
  - full-fuel radius is configured through `playerFuelRadiusTiles`
  - level and item radius modifiers reuse the same helper path and scale with fuel
- Lantern fuel slowly decays over time, is bounded between `0%` and `100%`, and is shown in the bottom HUD area above the XP bar.
- Torches are persistent floor objects placed on walkable tiles near walls while avoiding spawn, key, door, portal, and invalid map positions.
- Players collect lit torches by touching them, removing the torch from the floor and restoring `20%` lantern fuel.
- Players relight unlit torches by touching them.
- Snuffer enemies can extinguish lit torches by touching them; mummies currently opt into this behavior.
- Snuffed torches use a short cooldown to avoid immediate relight/snuff flicker, then can be relit by the player.
- Enemy and boss sprites render after the global darkness overlay, then receive a tight darkness pass that can reach the 99% global darkness maximum and brightens with a gentler sprite-specific falloff as they approach active light.
- Drops render after the global darkness overlay, then receive the same tight capped darkness pass as enemies so pickups brighten near active light and can fade to the 99% global darkness maximum at range.
- Floating text renders after the darkness overlay so it remains fully readable outside the light radius.
- Ranger Fire Arrow projectiles, lingering fire/pinning-fire zones, and ignited enemies emit bright temporary light with a wider bright center and slower falloff than normal dungeon lights.
- Mage Fire Bolt, Arcane Bolt, Shock, and Frozen Orb projectiles carry spell-specific light metadata so cantrip VFX remain visible in dark rooms and serialize consistently in multiplayer snapshots.
- Lighting is visual-only for now:
  - it does not alter collision
  - it does not change map exploration
  - it does not hide enemies or items outside the light radius
  - it does not currently drive enemy AI decisions

## Drops and Economy
- Gold drops scale with player level and floor level.
- Health drops use a computed drop-rate helper instead of a flat static chance.
- Health pickups restore `25%` of max health.
- Each generated floor places a small number of locked treasure chests away from spawn and progression markers.
- Treasure chests become shared minimap markers after any living player reveals the chest within normal exploration range.
- Chest keys are a rare enemy drop and are tracked separately from the floor exit key. Touching a locked chest spends one chest key.
- Opened chests pay out gold and a health potion pickup, grant one consumable item directly to the opening player, and grant one free run upgrade as gear.
- In multiplayer, treasure key pickups and chest inventory/gear rewards are owned by the collecting or opening player instead of mutating another teammate's inventory.
- Gold-find and spawn-rate shop upgrades were removed from the shop.
- The current shop is consumable-only. Consumables are active or passive, have finite charges, appear in the HUD while owned, and follow the schema in [CONSUMABLES_SHOP_DESIGN.md](CONSUMABLES_SHOP_DESIGN.md).
- Pressing `Call for Aid` opens an in-game radial aid menu around the player instead of a modal shop window. The menu does not pause local or multiplayer gameplay. Each radial entry shows the consumable icon and remaining stock; hover tooltips show the item name, type, rarity, price, effect, and purchase failure reason. On touch layouts, the first tap pins the tooltip and the second tap buys.
- Radial shop entries with `0` stock or insufficient gold are greyed out. The existing finite stock rules still apply, including shared multiplayer stock depletion.
- Call for Aid purchases deduct gold and stock immediately, but the item is delivered by Veronica, a bright blue magic owl courier. The first pending order starts a 15-30 second dispatch window. Orders added before Veronica spawns join that delivery; orders placed while Veronica is already on the map queue for the next delivery and start their dispatch window after the current Veronica departs.
- The shop pool includes tactical utility consumables such as Lantern Fuel, Darkvision Potion, Holy Candle, passive artifacts, and multiplayer-only revive consumables. Lantern Fuel refills the purchaser's lantern by 20%, Darkvision Potion privately gives the consumer 10 tiles of dark sight for 30 seconds, Holy Candle drops a 3-tile holy light for 10 seconds that heals players inside for 5% max health each second, Phoenix Draught revives one random dead ally at the user's position with 40% HP, and the once-per-run Flame of the Fallen creates a 20s pyre that revives all dead allies at 50% HP if nearby enemy kills fill its soul meter. Spike Growth is charge-based, retaliating for the next 25 hits instead of expiring by time. Forzare is a rare passive artifact that triggers when more than 3 enemies are within 1 tile, dealing force damage and knocking them back up to 3 tiles, then enters a 20s cooldown unless its 5% break chance destroys it.
- Veronica spawns near the dungeon edge, flies to a stable delivery point near the party, appears in-world as a small wolf-sized detailed blue ghost owl with a nameplate and long-lived blue magic sparkle trail, and is marked on the minimap with her destination regardless of player distance. Players automatically claim only their own ordered items by moving within 2 tiles of her.
- Veronica moves at roughly base Scout speed and is fragile. Nearby enemies target and damage her, under-attack feedback appears as the same top-screen notification style used by multiplayer join/leave messages, and a damaged health bar is shown. Unclaimed orders drop as recoverable owl parcels if she dies or waits 15 seconds at the delivery point. When she leaves she exits through a small dungeon-style portal; when slain, her body lingers briefly before that portal appears. Dropped-delivery minimap markers use a delivery box icon. If Veronica is slain, the next queued delivery waits an extra 60 seconds before its normal dispatch window. Purchased resources are not refunded.
- The class status area reserves fixed space for active consumable effect icons so the panel does not resize as effects start or expire.
- Regeneration Potion shows its item icon with remaining seconds in the class status area while active and displays periodic healing gain text as health is restored.
- Speed Potion, Spike Growth, Shield, Darkvision Potion, Fire Oil, and Frost Oil also show active effect icons in the class status area. Timed effects count down seconds, Shield shows temporary HP, and charge-based effects show remaining charged uses.
- Fire Oil and Frost Oil are attack-count weapon coatings: each use grants `15` charged attacks and applies the oil's damage/status effect to coated hits.
- New consumables should include a matching item icon generated with the canonical prompt in [CONSUMABLES_SHOP_DESIGN.md](CONSUMABLES_SHOP_DESIGN.md#icon-generation-prompt).

## Skills and Refunds
- Skill points are earned from level-ups and spent per player.
- When skill points increase during active play, a bottom-canvas skill popup appears above the lantern gauge for `8s`, showing only the currently spendable tier. Additional point gains queue additional popups behind the active one.
- Each class skill tree now shows spent-point totals, current refund count, and the current refund gold cost.
- Skill descriptions should follow the shared tooltip convention in [CLASS_TALENT_TREE_DESIGN.md](CLASS_TALENT_TREE_DESIGN.md#skill-description-convention): start with the category, omit redundant skill-name repeats, and describe mechanical effects with damage types, conditions, cooldowns, internal cooldowns, durations, and statuses where relevant.
- Full refunds reset all spent skill ranks for the acting player, restore the spent skill points, and increment that player's `refundCount`.
- Refunds charge gold and use an escalating cost model based on prior refunds, so repeated respecs are possible but not free.
- Refunds also clear skill-derived active state such as temporary timers or beam/cast state so the reset build cannot keep stale ability effects.
- In multiplayer, refunds remain per-player and travel through the authoritative action path instead of mutating local UI state directly.

## Enemy Systems
- Ambient enemy spawning is controlled by a computed spawn interval.
- Active enemy count is controlled by a floor-based cap:
  - `activeCapBase = 30`
  - `activeCapPerFloor = 10`
  - `activeCapMax = 200`
- Floor boss encounters stop normal enemy spawning and armor-stand activations while the boss is active. After the boss dies, off-screen hostile enemies are silently removed, ambient spawning stays suppressed for `10s` or until the next floor, then resumes at half rate for the rest of that floor. Non-boss enemies killed after the floor boss dies do not drop loot.
- Enemies now run through a tactics framework instead of only type-based chase logic.
- Current enemy-tactics highlights:
  - Ghosts orbit close to targets, maintain a purple siphon stream, and occasionally dive in for melee hits.
  - Goblins progress through scared, feeding, and enraged phases as they eat gold.
  - Rat archers manage distance through retreat, hold, advance, and reposition phases.
  - Skeleton warriors collapse into bones, then either expire or telegraph a reanimation.
  - Mummies are slow aura bruisers with poison pressure in close range.
- In multiplayer, enemy spawn distribution and activation use the living-player roster instead of only the local host view:
  - ambient spawns can appear around separated living players
  - active-world bounds expand to the union of living player view areas
  - proximity systems such as targeting, pickups, traps, and armor wakeups operate on the living player roster
  - hostile target fallback uses the nearest living player by distance instead of the first roster entry, and generic hostile enemies such as animated armor use the shared multiplayer-aware target selection
- Slain hostile enemies leave timed, non-blocking body/remnant sprites. Bosses such as the minotaur also leave bodies while still completing boss progression, opening the portal, and clearing active boss targeting. Dead bodies render below drops and living enemies, do not push the player, and do not deal contact damage.
- Dead bodies and collapsed remnants are not valid combat targets. Projectiles, melee checks, area effects, and direct damage routing skip slain enemies so corpse contact cannot consume projectiles, spawn hit effects, or create floating damage text.
- Ghosts leave a floor-mist remnant instead of disappearing immediately. Skeleton warrior collapsed-body behavior remains non-blocking and is treated consistently with other death remnants.
- Shared enemy movement uses target-point pathing with corner-assist probes and blocked-move recovery. Necromancer boss summons, standard enemies, and other target-chasing enemies can recover from wall pinning through the common movement path, while enemy-specific behaviors such as minotaur charge recovery can still override or specialize movement.
- The minotaur can destroy breakable boxes/crates by touching them, charging into them, or recovering from blocked movement against them. Blocked charges cancel into a sidestep recovery instead of staying pinned against collision.

## Difficulty Scaling

### Spawn Rate
- Spawn rate uses a floor-local stair-step curve instead of a single global level ramp.
- Current spawn scale:
  - `0.90 + floorStep + floorCatchup + floorLevelProgress * 0.09 + lateFloorProgress * 0.065`
  - `floorStep` adds `0.17` per floor after floor `1` and caps at `0.68`.
  - `floorCatchup` starts after floor `2`, adds `0.38` per floor, and caps at `0.48`.
  - `floorLevelProgress` resets to `0` at the start of a new floor and caps at the last normal spawning level before that floor's boss trigger.
  - `lateFloorProgress` starts after the first level of floors `2+`, preserving the floor `2` opening reset while letting later levels recover pressure.
- Floors `5+` also apply a floor-specific cap based on the floor `3` pre-boss peak, allowing `+5%` more per floor until the global spawn cap is reached.
- This makes the final spawning level of a floor the local spawn-pressure peak, then lowers pressure after the player takes the portal.
- Spawn interval is clamped by config minimums.

### Enemy Cap
- Active enemies scale by floor through `getActiveEnemyCap()`.
- Multiplayer can further scale the cap through `activePlayerCount`.

### Enemy Combat Scaling
- Enemy speed, damage, health, and defense scale through runtime difficulty helpers.
- Floor progression is weighted more heavily than player level for most combat difficulty systems.

### Floor Size Scaling
- Floor-size growth is now controlled by explicit progression config instead of one fixed multiplier.
- Current tuned growth factors:
  - floor `2`: `1.12`
  - floor `3`: `1.10`
  - floor `4`: `1.06`
  - floor `5+`: `1.03`
- This keeps later floors larger than floor `1`, but softens the growth curve where larger floor geometry stopped providing enough gameplay value relative to its perf cost.

### Multiplayer Difficulty
- The simulation tracks `activePlayerCount`.
- Multiplayer scaling is layered on top of the single-player floor/level model.
- Separate multiplayer multipliers exist for:
  - spawn rate
  - active enemy cap
  - enemy speed
  - enemy damage
- Current multiplayer scaling still uses connected room membership rather than only living survivors.

## Multiplayer Run Rules
- Up to `6` players can join a room.
- Duplicate classes are allowed.
- The first joined player becomes the room owner and initial pause owner.
- Only the pause owner controls global pause.
- Gameplay feedback parity is required between local and multiplayer play:
  - combat/progression floating text must show in multiplayer when the same event would show locally
  - active status icons must use the same status-row presentation in multiplayer as local play
  - damage text must still show when a hit kills or despawns the target
  - class progression effects for Archer, Fighter, and Necromancer must have targeted network validation when they add statuses, procs, summons, resource changes, or player-visible text
- Call for Aid, skill tree, and stats overlays are per-player UI in multiplayer:
  - Call for Aid never pauses the room
  - pause-owner skill actions pause the room globally
  - other players can open their own local overlays without opening them on teammates' clients
- Multiplayer skill spend and refund actions are authoritative:
  - local clicks send actions to the server
  - the acting player's build state is resynced immediately after spend/refund updates so the next snapshot tick does not revert the UI
- Pickups are first-touch:
  - gold and health go to the touching player
  - key / exit progression is shared room state
- Any living player can take the exit once it is open.
- Floor transitions are shared and lock gameplay immediately once triggered.
- Late joiners are blocked after the run starts.

## Multiplayer Death And Spectating
- A dead player stays dead until the run ends.
- The run ends only when all connected players are dead.
- Dead players automatically spectate living teammates after a short death beat.
- Spectators can cycle living targets and use passive UI like stats.
- Spectators appear near their current spectate target as small wisps using the spectator's stable run color; target changes fade out and fade back in instead of moving the wisp directly.
- Dead players cannot move, attack, shop, or spend skills.
- If the pause owner dies, they keep pause authority while connected; authority only transfers on disconnect.

## Multiplayer HUD And Results
- Remote players render as full in-world avatars.
- Remote player handles appear below their characters using that player's stable run color.
- The active-play HUD is rendered in-canvas instead of reserving a desktop sidebar. The minimap anchors to the top-right of the play canvas at `80%` opacity, and the combined player/class HUD aligns directly beneath it.
- The top-right HUD strip exposes `Stats` and `Options`; the combined player/class HUD keeps local player identity, gold, the class skill button, Call for Aid/skill tree, pause, the class meter, active consumable effects, and the group list. The `Call for Aid` button toggles the player-centered radial aid menu open and closed.
- Unspent skill points are no longer displayed as an `SP` counter during active play. Newly earned points open the tier-only skill popup, and the `Skill Tree` button slowly blinks green while points remain available.
- The group list is embedded at the bottom of the combined HUD. It renders every teammate as a compact one-line owner marker/name plus health bar, including dead-state entries for connected dead spectators.
- The minimap uses stable per-run player colors for teammates.
- Multiplayer game over shows a shared team-results overlay with:
  - roster
  - final level
  - final outcome
  - kills
  - damage dealt
- Multiplayer leaderboard submission is disabled in the current implementation.

## Player HUD Presentation
- The local overhead player health bar is intentionally compact. It renders only the base health span when the player has no temporary HP, then extends the bar only while temporary HP is present.
- The old active-play enemy counter and pace display are not shown in the in-canvas HUD. Enemy pacing diagnostics remain internal balance data unless exposed through a debug flow.

## Floor Boss Rules
- The floor boss trigger level is `floor * 5`.
- Floor bosses now alternate by floor:
  - odd floors: `Necromancer`
  - even floors: `Minotaur`
- When a floor boss is active:
  - ambient spawning stops
  - armor stand activations stop
  - XP gain is blocked
- Boss defeat opens the exit portal and starts a quiet cleanup window: hostiles outside every living player's current view disappear without death rewards or drops, ambient spawning stays at `0` for `10s` on that floor, then resumes at half rate. Remaining non-boss enemy deaths on that floor do not create loot.
- Boss behavior highlights:
  - `Necromancer`: ranged pressure, skeleton summons, and anti-kite blink pressure
  - `Minotaur`: rush-down charge, stomp pressure, player shove on contact, minimap boss marker, and direction/distance objective hints

## Network Combat Feedback
- Network mode synthesizes enemy damage floating text client-side from authoritative enemy HP changes instead of replicating full floating-text state.
- Local-player health in multiplayer is driven from authoritative snapshot health plus replicated player HP-bar visibility timers.
- Local controller movement is predicted in multiplayer and reconciled against authoritative snapshots so movement should remain responsive during normal play.
- Ranger arrows in multiplayer use local prediction for immediate feedback, then reconcile against authoritative projectiles. Predicted arrows are intentionally drawn faintly and expire quickly so missed reconciliation does not leave full-strength stale arrow artifacts on screen.
- Network projectile cadence follows the same attack cooldown as single-player. Held ranger primary fire should produce evenly spaced arrows rather than bursty catch-up shots.
- Torch state is synchronized through map meta/state, snapshots, and deltas so relit or snuffed torches stay aligned between network clients.
- Optional Agora voice chat can be enabled by server startup config. Voice chat defaults off and can be enabled from Options; when active, remote player voices are attenuated by distance, panned left/right from player positions, muffled through closed doors and walls, and scaled by a separate voice volume. Microphone modes include Open Mic, Push to Talk with a configurable button, and Mute. Allies fade out fully beyond 20 tiles.
- Dead spectators can only be heard by the living player they are currently spectating.
- Dev-mode multiplayer sessions can show a compact network stats panel for local playtesting. The debug panel reports FPS/frame timing, ping, approximate latency, snapshot jitter, snapshot buffer depth, and pending inputs.
- Browser/network validation now covers:
  - join safety
  - multiplayer combat input
  - hit-confirmation timing
  - refund spend/reset sync
  - shared reward sync, with XP divided across active players and gold divided across living players
  - archer projectile alignment
  - network floor-load movement and pause control
  - ranged projectile cadence and cleanup
  - smoothness, correction, and frame timing telemetry
  - focused-tab audio stability

## Notable Balance Changes
- Multiarrow damage is distributed across the whole volley with higher weight toward center arrows.
- Necromancer boss pressure was increased through higher health, faster movement, and stronger summon pacing.
- The XP reward model now uses an explicit level-based progression table rather than a level-to-floor penalty.
- The enemy roster now includes mummies and a generalized tactics layer for future enemy behavior work.
