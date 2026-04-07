# Class Talent Tree Design

This document captures a proposed replacement for the current split between:

- the gold shop stat upgrades
- the class skill tree unlocks

The goal is a unified talent system that:

- keeps class identity clear
- uses gated progression by total points spent
- supports distinct builds inside each class
- allows limited crossover without collapsing all builds into one dominant path

This is a design document only. It does not describe implemented behavior.

## Current Design Decisions

The following decisions are assumed throughout this document:

- Capstones are strictly in-lane
- Generic stats only appear where they fit the class and lane fantasy
- Each class has at most `1` regular active skill bound to right click
- Each class may optionally have `1` active capstone skill
- Each class path must contribute meaningfully to at least one active skill, even if it does not unlock a separate button
- Row 3 nodes and capstones are encouraged to modify or reshape the class active so each lane has a distinct feel without adding button bloat
- Multiplayer-relevant effects are desirable, but they must still have solo value

## Core Structure

Each class uses the same broad framework:

- `Row 0` for the shared class active
- `Row 0` utility talents for the migrated shop stats
- `3 lanes`
- `4 rows`
- passive nodes usually have `2-3 ranks`
- unlock nodes and capstones usually have `1 rank`
- one shared class active, heavily modified by lane investment

### Row Gates

- Row 0: first point grants the class active
- Row 0 utility nodes are available immediately
- Row 1: requires `1` point spent in row 0
- Row 2: requires `3` points spent in the class tree
- Row 3: requires `8` points spent in the class tree
- Row 4: requires `14` points spent in the class tree

### Lane Rules

- Rows 1-2 are the main identity-commitment rows
- Adjacent crossover opens at Row 3
- Row 4 capstones require `5` points spent in that lane
- The center lane is usually the easiest crossover bridge, because it tends to carry class-defining survival or utility
- Capstones remain strictly in-lane
- A lane may reshape the class active in Row 3 or Row 4, but should not usually add a second normal active

### Node Rank Rules

- Basic passive nodes: `3 ranks`
- Strong passive nodes: `2 ranks`
- Unlock nodes: `1 rank`
- Capstones: `1 rank`

## System Goals

Moving the shop stats into the talent tree should not create a tree full of generic tax nodes. The stat nodes should reinforce class identity and lane identity.

Good talent trees here should:

- give each lane a recognizable stat profile
- unlock actives in thematic places
- let every lane solve the core gameplay problem of that class
- avoid overloading every lane with equal health, defense, and damage
- let the same active skill feel different depending on lane investment
- create multiplayer upside without making nodes dead in solo

## Active Skill Model

This system should avoid a large active-skill loadout. The cleanest model is:

- each class has `1` core active skill bound to right click
- that active is available to all builds of the class
- each lane modifies that active through passive riders in Rows 2-4
- a capstone may optionally add an active capstone behavior, but this should be rare

Lane identity should therefore come from:

- stat ownership
- conditional combat bonuses
- modifications to the same active skill
- optional multiplayer support riders

Rather than from:

- multiple unrelated active buttons
- lane-exclusive hotbar kits

## Universal Utility Package

The current shop's four generic stat upgrades should move into the tree as a shared utility package available to every class at Row 0.

These are:

- `Move Speed`
- `Attack Speed`
- `Damage`
- `Defense`

### Utility Node Rules

- each utility node has `4 ranks`
- all utility nodes are available immediately at Row 0
- they are class-agnostic in category, but their actual value can still be tuned per class if needed
- these nodes exist to preserve the broad progression feel of the current shop without keeping a separate gold-based stat system

### Utility Design Notes

- This adds `16` total ranks to every class tree
- The utility package should stay intentionally plain and readable
- The class lanes should still carry most of the class identity and build flavor
- If utility nodes become too efficient, they will flatten the lane system, so their power budget should stay conservative relative to lane-defining talents

## Skill Point Progression Rule

For the current target of:

- `42` total skill points
- max player level `30`
- first skill point awarded at `Level 2`

The recommended skill point progression is:

- `Level 2`: award `2 SP`
- `Levels 3-11`: award `1 SP` per level
- `Levels 12-20`: award `1 SP` every `2` levels

Math:

- Level `2` = `2 SP`
- Levels `3-11` = `9 SP`
- Levels `12, 14, 16, 18, 20` = `5 SP`
- total by `Level 20` = `16 SP`

This front-loads the early tree enough for Row 4 access at the start of floor 5, then slows progression so later points feel more deliberate.

## Ranger

### Class Identity

The ranger is a ranged kiter in a horde game.

That means the class should win by:

- spacing
- movement
- lane control
- efficient front-line deletion

The ranger should not be framed as a pure single-target sniper, because that would be too narrow for a game where most play is against a pursuing crowd.

### Lane Overview

- `Sharpshooter`
  - efficient line shots, pierce, front-rank deletion, projectile quality
- `Skirmisher`
  - movement, uptime, defense through motion, survivability
- `Warden`
  - fire, AoE, wave shaping, crowd pressure

### Ranger Core Active

The ranger should have one shared right-click active. The cleanest candidate remains a revised `Fire Arrow`:

- baseline use: a high-impact utility shot with AoE or rider potential
- `Sharpshooter` investment makes it more precise, piercing, and front-rank lethal
- `Skirmisher` investment makes it smoother to use while moving and safer to weave into kiting
- `Warden` investment makes it more explosive, burning, and wave-shaping

`Piercing Strike` and `Multiarrow` should therefore be treated less like separate permanent buttons and more like:

- passive augments
- conditional riders
- alternate firing patterns
- or enhancements applied to the ranger's one active

### Stat Ownership

#### Sharpshooter owns

- damage
- crit chance
- crit damage
- projectile speed
- pierce
- line-hit bonuses

#### Skirmisher owns

- move speed
- attack speed
- health
- defense
- damage while moving
- uptime and recovery

#### Warden owns

- burn duration
- burn damage
- AoE radius
- cooldown reduction
- multiarrow quality
- damage against affected targets

### Ranger Tree

| Row | Sharpshooter | Skirmisher | Warden |
|---|---|---|---|
| 0 |  | `Fire Arrow` |  |
| 1 | `Keen Sight` | `Multi-Shot Arrow` | `Kindling` |
| 2 | `Pinning Shot` | `Fleetstep` | `Fire Mastery` |
| 3 | `Linebreaker` | `Dance of Thorns` | `Volleycraft` |
| 4 | `Cull the Pack` | `Foxstep` | `Wildfire` |

### Ranger Node Details

#### Row 0

##### Fire Arrow
- Type: core active
- Ranks: `1`
- The ranger's first skill point grants the class right-click active. Equivalent to the first rank of fire arrow in the existing skill.
- Baseline purpose:
  - a high-impact utility shot with room for precision, movement, or AoE specialization later
- Later lane nodes modify this active rather than adding more normal buttons

##### Move Speed Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+move speed` per rank
- Move speed is a core ranger ability, so they should have the highest gain in move speed of all classes.

##### Attack Speed Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+attack speed` per rank
- Ranger gain - moderate

##### Damage Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+damage` per rank
- Ranger gain - moderate

##### Defense Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+defense` per rank
- Ranger gain - low

#### Row 1

##### Keen Sight
- Type: passive
- Ranks: `3`
- Purpose: establish the Sharpshooter profile immediately
- Rank 1: `+3% projectile speed, +3% ranged damage, +4% crit chance`
- Rank 2: `+3% projectile speed, +3% ranged damage, +4% crit chance`
- Rank 3: `+3% projectile speed, +3% ranged damage, +4% crit chance`

##### Multi-Shot Arrow
- Type: passive
- Ranks: `3`
- Purpose: core Skirmisher throughput node
- Rank 1: `Multishot +1 Arrow, +25% chance to spot traps, +25% chance to spot hidden monsters`
- Rank 2: `Multishot +1 Arrow, +25% chance to spot traps, +25% chance to spot hidden monsters`
- Rank 3: `Multishot +1 Arrow, +25% chance to spot traps, +25% chance to spot hidden monsters`
- Multiplayer rider option:
  - Nearby allies spot any traps or hidden monsters you spot

##### Kindling
- Type: passive
- Ranks: `3`
- Purpose: establish the Warden lane's fire-control identity
- Rank 1: `+10% chance to set enemies on fire with arrows for damage over time, +8% fire damage, +6% fire arrow radius`
- Rank 2: `+10% chance to set enemies on fire with arrows for damage over time, +8% fire damage, +6% fire arrow radius`
- Rank 3: `+10% chance to set enemies on fire with arrows for damage over time, +8% fire damage, +6% fire arrow radius`

#### Row 2

##### Pinning Shot
- Type: modifier
- Ranks: `1`
- Purpose: convert the ranger active toward a precise lane-control shot for Sharpshooter builds
- Effects:
  - the ranger active fire arrow generates fire in a line instead of a circle, damaging and slowing all enemies that enter it by 25%
  - arrows that pass through the fire line deal `+10%` damage
  - this is not a second permanent button; it is a lane modifier on the ranger active
- Multiplayer Effect:
  - Allies do +10% damage to enemies slowed by fire arrow

##### Fleetstep
- Type: passive
- Ranks: `1`
- Purpose: establish the ranger's movement identity and the Skirmisher lane's survival role
- Rank 1: `+12% move speed, +6% max health, +15% dodge`

##### Fire Mastery
- Type: modifier
- Ranks: `1`
- Enhances the ranger's Row 0 active in the Warden direction
- Fire Arrow radius is doubled, the ground effect lasts twice as long, and becomes a ground target shot
- Includes a small passive rider:
  - `+10% Fire Arrow impact damage`

#### Row 3

##### Linebreaker
- Type: passive
- Ranks: `3`
- Purpose: make the Sharpshooter lane horde-relevant rather than boss-only
- Rank 1: `When you are not moving, basic attacks pierce +25% of the time, arrows gain +10% damage for each enemy they strike`
- Rank 2: `When you are not moving, basic attacks pierce +25% of the time, arrows gain +10% damage for each enemy they strike`
- Rank 3: `When you are not moving, basic attacks pierce +25% of the time, arrows gain +10% damage for each enemy they strike`

##### Dance of Thorns
- Type: passive
- Ranks: `3`
- Purpose: reward sustained movement and active kiting
- While moving continuously for more than 6 seconds, gain the "Dance of Thorns" buff.
- Rank 1: `While moving continuously for more than 6 seconds, gain +6% attack speed`
- Rank 2: `While moving continuously for more than 6 seconds, gain +5% defense and deal 10 damage when hit`
- Rank 3: `While moving continuously for more than 6 seconds, gain +8% damage`
- Multiplayer rider option:
  - Allies within 3 tiles gain +5% defense while you have "Dance of Thorns" active

##### Volleycraft
- Type: passive
- Ranks: `3`
- Purpose: make the Warden lane's version of the ranger active feel like controlled crowd pressure
- Rank 1: `Fire Arrow cooldown reduced by 1 second`
- Rank 2: `Fire Arrow cooldown reduced by 1 second`
- Rank 3: `Fire Arrow cooldown reduced by 1 second`

#### Row 4

##### Trick Shot
- Type: capstone
- Ranks: `1`
- Purpose: turn Sharpshooter into a wave-cutting lane
- Effects:
  - Ranger basic attacks can ricochet off walls twice if they have not already hit an enemy

##### Foxstep
- Type: capstone
- Ranks: `1`
- Purpose: make Skirmisher the strongest uptime and movement lane
- Effects:
  - When the ranger is reduced below 50% hp, damage is halved and the ranger regains 50% hp over the course of 15 seconds. This effect lasts for 15 seconds. This can only occur once every 90 seconds.
  - active interaction:
    While the Foxstep effect is active, basic attacks have +50% critical chance
  - optional multiplayer rider:
    - nearby allies damage is reduced by 25% while this effect is enabled

##### Wildfire
- Type: capstone
- Ranks: `1`
- Purpose: turn Warden into the premier wave-shaping lane
- Effects:
  - `Fire Arrow` radius is doubled
  - Burning enemies take 15% more arrow damage
  - Burning enemies have a 25% chance to set other nearby enemies on fire

### Ranger Crossover Patterns

#### Sharpshooter -> Skirmisher
- precise lane-clearing build with stronger kiting
- likely the most stable all-round ranger build

#### Skirmisher -> Warden
- safest pack-control build
- best baseline horde survival shape

#### Sharpshooter -> Warden
- high-output artillery style
- more explosive, less forgiving

### Ranger Design Notes

- Major health and defense should mostly live in `Skirmisher`
- `Sharpshooter` should solve horde pressure through efficient line damage, not pure boss damage
- `Warden` should be strongest at wave shaping and AoE pressure, not generic stat stacking

## Warrior

### Class Identity

The warrior is a bruiser who survives pressure by staying in the fight.

The warrior should feel like:

- durable under pressure
- strongest at close range
- rewarded for committing into enemies
- able to specialize between brawling, endurance, and momentum

### Lane Overview

- `Crusader`
  - consecrated ground, anti-undead pressure, stand-your-ground defense
- `Executioner`
  - direct weapon damage, cleave, finishing pressure
- `Berserker`
  - speed, rage, sustain spikes, aggressive momentum

### Warrior Core Active

The warrior should also use one shared right-click active. The strongest candidate remains `Rage`, reframed as a core combat activation:

- baseline use: short offensive commitment window
- `Crusader` investment makes it defensive, holy, and zone-controlling
- `Executioner` investment makes it deadlier and more front-loaded
- `Berserker` investment makes it faster, longer, and more snowbally

If a more direct strike ability is preferred instead, the same lane logic still applies:

- one shared strike/commit active
- lanes modify how it behaves
- no lane should add a second ordinary active button

### Warrior Stat Ownership

#### Crusader owns

- defense
- holy area control
- anti-undead pressure
- healing amplification inside consecrated ground

#### Executioner owns

- raw damage
- cleave efficiency
- execute thresholds
- melee range feel

#### Berserker owns

- attack speed
- move speed in combat
- rage generation
- temporary sustain
- kill-chain momentum

### Warrior Tree

| Row | Crusader | Executioner | Berserker |
|---|---|---|---|
| 0 |  | `Rage` |  |
| 1 | `Sanctified Steel` | `Heavy Hand` | `Bloodheat` |
| 2 | `Consecrated Rage` | `Cleave Discipline` | `Rage Mastery` |
| 3 | `Purging Light` | `Executioner’s Reach` | `Battle Frenzy` |
| 4 | `Judgment Wave` | `Butcher’s Path` | `Red Tempest` |

### Warrior Node Details

#### Row 0

##### Rage
- Type: core active
- Ranks: `1`
- The warrior's first skill point grants the class right-click active
- Half incoming damage from physical, melee, arrow damage.
- Baseline purpose:
  - a short combat commitment window that all warrior builds can reshape
  - 
- Later lane nodes modify this active rather than introducing more normal buttons

##### Move Speed Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+move speed` per rank

##### Attack Speed Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+attack speed` per rank

##### Damage Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+damage` per rank

##### Defense Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+defense` per rank

#### Row 1

##### Sanctified Steel
- Type: passive
- Ranks: `3`
- Purpose: establish Crusader as the holy stand-your-ground lane
- Rank 1: `+4% defense`
- Rank 2: `+4% defense, +8 max health`
- Rank 3: `+4% defense, +8 max health, +6% damage against undead`

##### Heavy Hand
- Type: passive
- Ranks: `3`
- Purpose: establish the Executioner lane as the direct melee-pressure path
- Rank 1: `+4% melee damage`
- Rank 2: `+4% melee damage`, `+10% cleave arc`
- Rank 3: `+4% damage against enemies above 70% health`

##### Bloodheat
- Type: passive
- Ranks: `3`
- Purpose: establish Berserker as the momentum lane
- Rank 1: `+5% attack speed`
- Rank 2: `+5% attack speed, +5% move speed while Rage is active`
- Rank 3: `+5% attack speed, +5% passive move speed`

#### Row 2

##### Consecrated Rage
- Type: modifier
- Ranks: `1`
- Purpose: make Rage create a holy stand-your-ground zone instead of a pure stat steroid
- While raging, create a consecrated area where Rage was activated
- Consecrated area radius: `4 tiles` before Purging Light
- Consecrated area deals holy damage over time
- Consecrated area deals bonus damage to undead
- Healing received within the consecrated area is increased
- While standing in the consecrated area, the warrior gains `5%` damage reduction

##### Cleave Discipline
- Type: modifier
- Ranks: `1`
- Purpose: make the warrior active feel like an Executioner tool instead of adding another button
- The first attack after the rage skill is activated will deal critical damage.
- Rage increases critical damage by 20%.
- While raging, cleave width is `+10%`

##### Rage Mastery
- Type: modifier anchor
- Ranks: `1`
- Enhances the warrior's Row 0 active in the Berserker direction
- Rage increases attack speed by 25%
- Rage increases movement speed by 10%
- Includes a small passive rider:
  - `+15% rage duration` or slightly better baseline rage uptime

#### Row 3

##### Purging Light
- Type: passive
- Ranks: `3`
- Purpose: deepen the consecrated-area identity without adding a second active
- Rank 1: `+15% consecrated area radius`
- Rank 2: `+15% consecrated area holy damage`
- Rank 3: undead inside the consecrated area take `+20% damage`
- Active interaction:
  - Rage still grants Second Wind, healing yourself for 25% max health over 10 seconds
- Multiplayer rider option:
  - When Rage is triggered, nearby allies gain 10% of their maximum health over 10 seconds

##### Executioner's Reach
- Type: passive
- Ranks: `3`
- Purpose: make Executioner useful in a crowd-heavy game instead of only on elites
- Rank 1: `+10% chance to instantly kill enemies when damage leaves them under 30% health`
- Rank 2: `+10% chance to instantly kill enemies when damage leaves them under 30% health`
- Rank 3: `+10% chance to instantly kill enemies when damage leaves them under 30% health`
- Active interaction:
  - While raging, attack range is `+10% longer`.

##### Battle Frenzy
- Type: passive
- Ranks: `3`
- Purpose: reward kill-chain pressure and staying active in the wave
- Rank 1: When you kill an enemy while raging, gain Battle Frenzy and gain `+10% move speed and +5% damage` for 3 seconds. This has a `10` second internal cooldown.
- Rank 2: While under the effects of Battle Frenzy, you gain `+10% move speed and +5% damage`
- Rank 3: While under the effects of Battle Frenzy, you gain `+10% move speed and +5% damage`
- Active interaction:
  - rage windows extend or intensify when kills happen during the active

#### Row 4

##### Judgment Wave
- Type: capstone
- Ranks: `1`
- Purpose: make Crusader the holy front-line lane that locks down undead-heavy space
- Effects:
  - Cleave attacks have a chance to release a holy wave in the swing arc
  - The holy wave travels forward and damages enemies it passes through
  - Undead struck by the holy wave have their defenses reduced, causing them to take more damage
  - While raging, Crusader turns gold instead of red

##### Butcher's Path
- Type: capstone
- Ranks: `1`
- Purpose: make Executioner the strongest offensive horde-break lane
- Effects:
  - After executing an enemy, your next hit is a guaranteed critical
  - While raging, your execution chance is doubled.
  - After executing an enemy, your next cleave gains `+20%` width and `+20%` damage

##### Red Tempest
- Type: capstone
- Ranks: `1`
- Purpose: make Berserker the warrior's most explosive momentum path
- Effects:
  - While raging, gain +20% movement speed
  - When you rage, gain 25% of your maximum hp as temporary hitpoints. Temporary hitpoints cannot be healed.
  - When you rage, for the first 5 seconds your attacks are in a 360 degree arc.
  
### Warrior Crossover Patterns

#### Crusader -> Executioner
- durable front-liner who adds better direct damage and execute pressure
- ideal for players who want to hold space without becoming purely defensive

#### Executioner -> Berserker
- all-in aggression build
- strongest offense, weakest passive durability

#### Crusader -> Berserker
- high-damage front-liner with better stability
- holy bruiser that ramps while holding consecrated ground
- likely the safest warrior progression shape with better multiplayer value

### Warrior Design Notes

- Major health and defense should mostly live in `Crusader`
- `Crusader` should survive by sanctifying space, not by pure brick-wall mitigation
- `Executioner` should be horde-relevant through cleave and front-line deletion, not only boss damage
- `Berserker` should feel fast and explosive, but not permanently tanky

## Necromancer

### Class Identity

The necromancer is a commander and attrition caster.

The class should feel like:

- strongest when building and maintaining battlefield advantage
- rewarded for positioning near allies, corpses, and control zones
- powerful through layered pressure instead of direct burst alone

### Lane Overview

- `Reaper`
  - direct spell damage, death bolt pressure, self-buffing through undead presence and death
- `Gravekeeper`
  - pet durability, healing, ally support, command stability
- `Plaguebinder`
  - curses, zones, spread effects, sacrificial undead pressure

### Necromancer Core Active

The necromancer's shared right-click active should remain `Death Bolt`.

- baseline use: direct necrotic projectile with utility and setup value
- `Reaper` investment makes it the direct damage and burst lane, with undead amplifying the necromancer instead of being buffed themselves
- `Gravekeeper` investment makes it support pets, formation, and healing
- `Plaguebinder` investment makes it spread afflictions, zones, and turn undead into expendable plague vectors

This is the clearest class for the shared-active model, because the existing kit already points this way.

### Necromancer Stat Ownership

#### Reaper owns

- spell damage
- death bolt scaling
- explosion damage
- projectile quality
- self-buffs gained from nearby undead, undead kills, or undead deaths

#### Gravekeeper owns

- pet health
- pet defense
- healing power
- controlled undead upkeep
- command radius / stability

#### Plaguebinder owns

- damage-over-time
- radius
- duration
- cooldown reduction
- spread and chain pressure
- on-death undead effects
- plague-vector pet behavior

### Necromancer Tree

| Row | Reaper | Gravekeeper | Plaguebinder |
|---|---|---|---|
| 0 |  | `Death Bolt` |  |
| 1 | `Black Candle` | `Control Mastery` | `Hexcraft` |
| 2 | `Death Mastery` | `Cold Command` | `Plaguecraft` |
| 3 | `Exploding Death` | `Bone Ward` | `Rot Touched` |
| 4 | `Harvester` | `Legion Master` | `Blightstorm` |

- Necromancer baseline charm time starts at `1.5s` and smoothly drops by level until reaching `0.33s` at `Level 10`.

### Necromancer Node Details

#### Row 0

##### Death Bolt
- Type: core active
- Ranks: `1`

- The necromancer's first skill point grants the class right-click active
- Baseline purpose:
  - a direct necrotic projectile that later lanes can push toward burst, support, or affliction play
  - the necrotic beam can always deal direct damage, but at a lower base output than the ranger's arrows
- Later lane nodes modify this active rather than adding more normal buttons

##### Move Speed Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+move speed` per rank

##### Attack Speed Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+attack speed` per rank

##### Damage Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+damage` per rank

##### Defense Training
- Type: utility
- Ranks: `4`
- Migrated from the old shop stat line
- Rank 1-4: `+defense` per rank

#### Row 1

##### Black Candle
- Type: passive
- Ranks: `3`
- Purpose: establish Reaper as the direct offense lane where pets feed the necromancer's power instead of being durable assets
- Rank 1: `+5% Death Bolt damage, +5% explosion damage, +15% necrotic beam damage`
- Rank 2: `+5% Death Bolt damage, +5% explosion damage, +15% necrotic beam damage`
- Rank 3: `+5% Death Bolt damage, +5% explosion damage, +15% necrotic beam damage`
- If the target is cursed, necrotic beam deals `+10%` damage

##### Control Mastery
- Type: passive
- Ranks: `3`
- Purpose: establish Gravekeeper as the pet-command lane
- Rank 1: `+1 controlled undead, +15% necrotic beam healing`
- Rank 2: `+1 controlled undead, +15% necrotic beam healing`
- Rank 3: `+1 controlled undead, +15% necrotic beam healing`
- Multiplayer rider option:
  - attacks against allies in the same tile as undead harm the undead only

##### Hexcraft
- Type: passive
- Ranks: `3`
- Purpose: turn `Death Bolt` toward affliction setup and make undead function like disposable plague missiles
- Rank 1:
  - `Death Bolt` applies `Curse` on hit
  - `Death Bolt` deals poison damage
  - `Curse`: `-25% attack speed`, `-25% defense`, `+25% poison vulnerability`
- Rank 2:
    - `Curse` lasts `+1` second
    - cursed enemies take `+20%` damage from controlled undead
- Rank 3:
    - `Death Bolt` curse radius increases
    - cursed enemies also take stronger poison damage over time from `Rot`

#### Row 2

##### Death Mastery
- Type: modifier anchor
- Ranks: `3`
- Increase deathbolt active damage by 10% per rank
- Reduce cooldown by 1s per rank
- Includes a small passive rider:
  - Increase necrotic beam pulse rate by `15%` per rank
  - Death Bolt and necrotic beam kills grant `1` temporary hp, up to `20%` of the necromancer's max hp

##### Cold Command
- Type: modifier
- Ranks: `3`
- Formalizes the Gravekeeper lane's modification of `Death Bolt` and pet control
- Rank 1:
  - `+15% controlled undead health, +10% defense, +10% damage, +10% attack speed`
  - Kills from Death Bolt have a +10% chance to spawn a controlled ghost, if the necromancer has slots available.
- Rank 2:
  - `+15% controlled undead health, +10% defense, +10% damage, +10% attack speed`
  - Kills from Death Bolt have a +10% chance to spawn a controlled ghost, if the necromancer has slots available.
- Rank 3:
  - `+15% controlled undead health, +10% defense, +10% damage, +10% attack speed`
  - Kills from Death Bolt have a +10% chance to spawn a controlled ghost, if the necromancer has slots available.

##### Plaguecraft
- Type: passive
- Ranks: `3`
- Purpose: make Plaguebinder strongest in drawn-out crowd fights where undead are expected to die profitably
- Rank 1:
  - controlled undead attacks apply `Rot` to a single target
  - `Rot`: poison damage over time and `-25% movement speed`
- Rank 2:
  - when controlled undead die, all enemies within `1` tile gain `Rot`
- Rank 3:
  - non-undead enemies suffering from either `Curse` or `Rot` have a `20%` chance to rise again as controlled skeletons on death, if the necromancer has control slots available

#### Row 3

##### Exploding Death
- Type: modifier
- Ranks: `1`
- When undead die, they explode and deal 5 damage within a 2 tile radius
- When a controlled undead dies, the necromancer gains Vigor of Life:
    - +15% defense for 5 seconds (capped, non-stacking) and healing of 15% of their total hp over 5 seconds.

##### Bone Ward
- Type: passive
- Ranks: `1`
- Purpose: make Gravekeeper the safest and most reliable minion lane
- Rank 1:
  - controlled undead take `10%` less damage
  - controlled undead within `2` tiles of the necromancer gain `+10%` damage
  - controlled undead within `2` tiles of the necromancer have a `15%` chance to reflect projectiles

##### Rot Touched
- Type: passive
- Ranks: `1`
- Purpose: add a late-row battlefield-shaping upgrade to Death Bolt's lingering area
- Rank 1:
  - `Death Bolt` area duration `+20%`
  - `Death Bolt` area radius `+10%`
  - enemies that hit the necromancer take `5` poison damage

#### Row 4

##### Harvester
- Type: capstone
- Ranks: `1`
- Purpose: make Reaper the necromancer's direct kill-pressure lane
- Effects:
  - Gain a 1 tile necrotic aura around the necromancer.
  - Enemies that die within the aura have a 40% chance to rise as controlled ghosts, if the necromancer has slots available.
  - Reduce the cooldown on death bolt by 20%.
  - For every kill, the necromancer's next death bolt damage increases by 5% (up to 50%)
  - direct spellcasting becomes a legitimate primary playstyle rather than just support for pets
  
##### Legion Master
- Type: capstone
- Ranks: `1`
- Purpose: make Gravekeeper the dominant ally-command lane
- Effects:
  - Skeletal warriors can shoot arrows with a range of 5 tiles
  - Ghosts life steal increases by 0.2%
  - Kills from Death Bolt have a +50% chance to spawn a controlled ghost, if the necromancer has slots available.

##### Blightstorm
- Type: capstone
- Ranks: `1`
- Purpose: make Plaguebinder the attrition king of crowd control
- Effects:
  - `Death Bolt` fires `3` bolts in a wide cone
  - the necromancer's necrotic beam applies `Curse`
  - controlled undead spawn a mini plague burst when they die (`2` tile radius)
  - `Curse` and `Rot` stack visually and mechanically:
    - `Curse` uses purple fire
    - `Rot` uses a green teardrop layered above it
  
### Necromancer Crossover Patterns

#### Reaper -> Gravekeeper
- active caster build with enough stable minion support to stay safe while still centering the necromancer's own power
- likely the most approachable offensive necromancer hybrid

#### Gravekeeper -> Plaguebinder
- stable commander build with stronger long-fight control, where preserved undead later become useful plague carriers
- likely the safest broad necromancer shape

#### Reaper -> Plaguebinder
- high-pressure caster-control build
- strongest direct spell and zone output, with undead serving as spell fuel and sacrificial spread tools rather than a stable frontline

### Necromancer Design Notes

- `Gravekeeper` should own most of the pet-defense and ally-healing budget
- `Reaper` should give the necromancer a stronger direct play option without erasing the pet fantasy, by making undead amplify the caster instead of becoming tougher
- `Plaguebinder` should make the class better at choking off space and grinding down crowds by making undead disposable plague vectors rather than tanky lieutenants

## Cross-Class Design Principles

### 1. Every class needs one lane that carries most of its survivability budget

- Ranger: `Skirmisher`
- Warrior: `Crusader`
- Necromancer: `Gravekeeper`

### 2. Every lane must solve the class’s core game problem

Bad lane design in this game would be a lane that only matters in boss fights or only matters in empty-room scenarios.

Each lane needs to remain useful under crowd pressure.

### 3. Replacing the shop requires real stat ownership

If the current shop stats are absorbed into the trees, the stats should be distributed in a way that reinforces lane identity:

- health and defense should not be equally available everywhere
- movement and attack speed should not be universal filler
- class-specific offensive stats should live where they make fantasy sense

### 4. Crossover should create hybrids, not erase specializations

Good crossover means:

- a Sharpshooter can dip into Skirmisher and still feel like a Sharpshooter
- a Necromancer Reaper can dip into Gravekeeper and still feel spell-forward
- a Warrior Berserker can take some Crusader stability without turning into a pure tank

### 5. Multiplayer support should be additive, not mandatory

Good multiplayer-aware nodes should:

- help in solo and multiplayer
- rise in value with allies nearby
- usually work through buffs, debuffs, proximity effects, or support riders on the shared active

Bad multiplayer-aware nodes would:

- only function with a party
- require a very specific party composition
- consume too much of a lane's power budget for solo players

### 6. Row 3 and capstones are the best places to reshape the shared active

The tree should stay low on button count but high on build expression.

That means Row 3 and Row 4 are the right place for:

- changing projectile or swing behavior
- adding support riders
- changing area shape or target logic
- adding multiplayer-friendly utility pulses

Without:

- adding multiple new active hotbar skills

## Point Budget

With Row 0 added in front of the existing trees:

- Ranger total points to fully max the current proposed tree: `42`
- Warrior total points to fully max the current proposed tree: `42`
- Necromancer total points to fully max the current proposed tree: `42`

Math:

- `26` points from the class-specific lane tree
- `16` points from the four shared utility nodes at `4` ranks each
- total: `42`

If the game grants `1` skill point per level:

- a `42`-point tree maxes at `Level 42` if Level 1 grants the first point
- the same tree maxes at `Level 43` if the first point is awarded at Level 2

Class parity goal:

- all classes should have equal total point depth to full max
- individual nodes may still have different rank counts if class identity benefits from it

## Open Design Questions

- Should each lane include a secondary side node in Row 3, or should Rows 3-4 stay narrower and cleaner?
- Should capstones be strictly in-lane, or should late crossover capstones exist?
- Should generic stats like gold find, pickup radius, or cooldown reduction appear in all classes, or only where they fit class fantasy?
- Should the current active skills remain on the same row across all classes, or should some classes unlock earlier or later based on complexity?

## Recommendation

Use the ranger tree as the prototype because it has the clearest tension between:

- current skill unlocks
- shop stat migration
- lane identity in a horde game

If that structure works cleanly for ranger, the same framework can be applied to warrior and necromancer with less risk.
