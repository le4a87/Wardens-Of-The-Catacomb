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
- Browser/network validation now covers:
  - join safety
  - controller combat input
  - hit-confirmation timing
  - archer projectile alignment
  - focused-tab audio stability

## Notable Balance Changes
- Multiarrow damage is distributed across the whole volley with higher weight toward center arrows.
- Necromancer boss pressure was increased through higher health, faster movement, and stronger summon pacing.
- The XP reward model now uses an explicit level-based progression table rather than a level-to-floor penalty.
- The enemy roster now includes mummies and a generalized tactics layer for future enemy behavior work.
