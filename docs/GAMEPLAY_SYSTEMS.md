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
- Pause / close menus: `Esc`

## Classes

### Archer
- Fastest baseline movement
- Lower health and defense than the melee class
- Passive level growth emphasizes move speed and attack speed
- Skill path focuses on Fire Arrow, Piercing Strike, and Multiarrow

### Fighter
- Higher baseline health and defense
- Built-in life leech and strong close-range damage
- Passive level growth emphasizes durability through health and defense
- Base `unholy` resistance reduces pressure from ghost siphons and related necrotic/death effects
- Skill path focuses on Frenzy, Rage, and Execute-style melee pressure

### Necromancer
- Control-focused ranged class
- Passive level growth emphasizes health, control power, and charm efficiency
- Skill path focuses on Control Mastery, Death Bolt, and augmenting controlled undead

## Progression
- XP is granted directly on enemy kills.
- XP gain is blocked while the floor boss is active.
- Each level grants:
  - `+1` skill point
  - class-based max-health growth
  - class-based offensive scaling
  - class-specific passive stat growth
- In multiplayer, progression is per-player rather than shared:
  - XP, gold, score, skills, upgrades, cooldowns, and class build state belong to the acting player
  - kill rewards are last-hit based
  - controlled-necromancer summons inherit kill, damage, XP, and score credit for their owning necromancer

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

## Drops and Economy
- Gold drops scale with player level and floor level.
- Health drops use a computed drop-rate helper instead of a flat static chance.
- Health pickups restore `25%` of max health.
- Gold-find and spawn-rate shop upgrades were removed from the shop.
- Current shop upgrades are:
  - Move Speed
  - Attack Speed
  - Damage
  - Defense

## Skills and Refunds
- Skill points are earned from level-ups and spent per player.
- Each class skill tree now shows spent-point totals, current refund count, and the current refund gold cost.
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
- Floor boss encounters stop normal enemy spawning and armor-stand activations while the boss is active.
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

## Difficulty Scaling

### Spawn Rate
- Spawn rate is now a function of player level only.
- Current spawn scale:
  - `1 + (level - 1) * 0.10`
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
- Shop, skill tree, and stats overlays are per-player UI in multiplayer:
  - pause-owner shop/skill actions pause the room globally
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
- Dead players cannot move, attack, shop, or spend skills.
- If the pause owner dies, they keep pause authority while connected; authority only transfers on disconnect.

## Multiplayer HUD And Results
- Remote players render as full in-world avatars.
- Remote player handles appear below their characters using that player's stable run color.
- The bottom-right HUD keeps the local player panel, then adds a compact group panel below it for other connected run members.
- The group panel shows:
  - handle
  - class/color identity
  - level
  - health bar
  - dead-state entries for connected dead spectators
- The minimap uses stable per-run player colors for teammates.
- Multiplayer game over shows a shared team-results overlay with:
  - roster
  - final level
  - final outcome
  - kills
  - damage dealt
- Multiplayer leaderboard submission is disabled in the current implementation.

## Floor Boss Rules
- The floor boss trigger level is `floor * 5`.
- Floor bosses now alternate by floor:
  - odd floors: `Necromancer`
  - even floors: `Minotaur`
- When a floor boss is active:
  - ambient spawning stops
  - armor stand activations stop
  - XP gain is blocked
- Boss defeat opens the exit portal and ends the encounter state.
- Boss behavior highlights:
  - `Necromancer`: ranged pressure, skeleton summons, and anti-kite blink pressure
  - `Minotaur`: rush-down charge, stomp pressure, player shove on contact, minimap boss marker, and direction/distance objective hints

## Network Combat Feedback
- Network mode synthesizes enemy damage floating text client-side from authoritative enemy HP changes instead of replicating full floating-text state.
- Local-player health in multiplayer is driven from authoritative snapshot health plus replicated player HP-bar visibility timers.
- Browser/network validation now covers:
  - join safety
  - multiplayer combat input
  - hit-confirmation timing
  - refund spend/reset sync
  - archer projectile alignment
  - focused-tab audio stability

## Notable Balance Changes
- Multiarrow damage is distributed across the whole volley with higher weight toward center arrows.
- Necromancer boss pressure was increased through higher health, faster movement, and stronger summon pacing.
- The XP reward model now uses an explicit level-based progression table rather than a level-to-floor penalty.
- The enemy roster now includes mummies and a generalized tactics layer for future enemy behavior work.
