# Android Controls And HUD Design

This document defines the Android touch-control model and HUD/menu changes for Wardens of the Catacomb. It is the required control and layout reference before Android runtime or packaging code changes begin.

## Scope

This document covers:

- in-run touch controls
- Android-specific HUD layout changes
- touch interaction rules for shop, skill tree, stats, and pause
- landscape phone assumptions
- multiplayer-specific HUD interaction requirements

This document does not define:

- Capacitor project structure
- Android signing or store packaging
- low-level input implementation details

## Current Desktop Control Contract

The current runtime expects these control behaviors:

- Movement:
  - `WASD` or arrow keys
- Aim:
  - mouse position drives aim direction
- Primary attack:
  - left click queued press
  - held left click for continuous necromancer beam behavior
- Alternate or class active:
  - right click queued press
- Pause or close top overlay:
  - `Escape`
- Shop:
  - `B`
- Skill tree:
  - `K`
- Stats:
  - `C`
- Active consumables:
  - `1-5`
- UI interaction:
  - mouse click on HUD buttons and overlay widgets
- Shop and skill tree scrolling:
  - mouse wheel

Android needs to preserve the same gameplay intents without depending on keyboard, mouse hover, or mouse wheel.

## Design Goals

- Make combat fully playable on a phone in landscape
- Preserve class-specific combat identity, especially ranged aiming and necromancer beam aiming
- Avoid gesture ambiguity during high-pressure combat
- Keep non-combat UI reachable without blocking movement and attacks
- Minimize overlap between touch controls and critical world visibility
- Preserve multiplayer information while reducing desktop HUD density

## Device Assumptions

- Android v1 is landscape-only during gameplay
- Primary target is phone-sized landscape screens
- Safe-area insets must be respected for notches and gesture bars
- Tablets may use the same layout with increased spacing, but are not the primary design target

## Touch Control Model

### Core Principle

Use persistent on-screen controls instead of gesture-only combat input.

Reasoning:

- The current game mixes directional movement, directional aiming, held attacks, queued alt skills, and overlay shortcuts
- Gesture-only controls would create conflicts between movement, aim, and UI activation
- Persistent controls map more cleanly onto the existing desktop control contract

### Left Side: Movement Stick

- A floating virtual movement stick appears wherever the player first presses within the left control half of the gameplay region
- The stick uses a movable thumb relative to that touch origin
- Drag direction maps to `moveX` and `moveY`
- Releasing the stick returns movement to `0,0`
- The movement stick only activates from touches that begin in the left control half and outside higher-priority UI hit targets

Design rules:

- Floating-position stick, not fixed
- Large enough for thumb correction under stress
- Slight deadzone near the center
- Clamp diagonal magnitude to the same normalized movement contract used today

### Right Side: Aim Pad

- A floating virtual aim stick appears wherever the player first presses within the right control half of the gameplay region
- Drag direction sets aim direction continuously
- While the aim stick is actively pressed, it also drives continuous primary attack behavior
- The aim stick does not require aiming at exact world coordinates; it emits normalized aim direction
- Releasing the aim pad keeps the last valid facing direction

Reasoning:

- The runtime already supports directional aim through `aimDirX` and `aimDirY`
- This is more robust on touch than forcing the player to tap an exact world point through their thumb
- Auto-firing on right-stick engagement removes the need for a separate primary-attack button

### Class Skill Trigger

- The existing class cooldown widget becomes the direct-touch class-skill trigger on Android
- Tapping the cooldown widget queues the alternate or class-skill action
- The widget must remain visibly disabled when the skill is locked or on cooldown

This preserves the existing class-skill identity and avoids introducing an extra dedicated skill button that competes for space with the aim controls.

### Utility Buttons

Small touch buttons remain available at the screen edge for:

- `Pause`
- `Shop`
- `Skill Tree`
- `Stats`

Rules:

- These stay visually distinct from combat buttons
- They should live in the upper-right utility cluster rather than the lower combat region
- They should remain tappable while the player is moving

### Consumable Buttons

- Active consumables remain direct-touch buttons
- The Android layout should always show up to five active consumables as tappable slots
- Tapping a slot uses that consumable directly instead of simulating `1-5`

Passive consumables remain display-only.

### Spectate Interaction

- When dead in multiplayer, the group panel remains tappable for spectate target selection
- Dead players should also get left and right spectate-cycle buttons near the group panel

Reasoning:

- Desktop can lean on keyboard and click precision
- Mobile needs a larger, more explicit target-switch affordance when the player is spectating

## Class-Specific Combat Notes

### Archer

- Movement stick plus aim stick supports kiting cleanly
- Pressing and dragging the aim stick auto-fires the primary attack
- Fire Arrow uses the direct-touch cooldown widget
- Multishot and passive talent effects do not require extra buttons

### Warrior

- Movement stick plus aim stick controls facing before melee attacks
- Pressing and dragging the aim stick repeatedly triggers the primary attack cadence
- Rage uses the direct-touch cooldown widget

### Necromancer

- Aim stick controls beam direction
- Holding the aim stick sustains primary beam behavior
- Death Bolt uses the direct-touch cooldown widget

Necromancer is the main reason the design requires the aim stick to sustain held-primary behavior while it remains engaged.

## HUD Layout Changes

### Current Desktop HUD Pressure

The current HUD uses:

- a top status strip
- objective and boss widgets across the top play area
- a right-side stats and control panel
- a bottom XP bar
- a bottom consumables bar
- a multiplayer group panel on the right side

That is too dense for phone-sized landscape when touch controls also need screen real estate.

### Android HUD Strategy

Keep the information model but redistribute it around touch zones.

#### Top Edge

- Keep score, time, floor, and objective text at the top
- Compress font sizes and horizontal spacing
- Boss bar remains top-center
- Utility buttons sit top-right

#### Right Sidebar

- Remove the desktop-style wide sidebar during active Android play
- Replace it with compact stacked cards or floating pills for:
  - player summary
  - class cooldown widget
  - multiplayer group panel
- Keep the compact player summary always visible during gameplay

Reasoning:

- The lower-right region is needed for the floating aim stick
- A persistent wide sidebar would either shrink world view too much or collide with controls

#### Bottom Edge

- XP bar remains full-width near the bottom center
- Active consumables sit above the XP bar in the center band
- Passive consumables shift to the right of the active consumables, but must stop before the aim controls

#### Left and Right Bottom Corners

- Bottom-left:
  - floating movement stick activation space
- Bottom-right:
  - floating aim stick activation space

No information-heavy widgets should occupy those zones during active play.

## Safe-Area Layout Rules

- All top-row UI must respect top safe-area inset
- Utility buttons must avoid the top-right cutout region
- Bottom controls must clear the gesture-navigation area
- The control layout should use inset-aware margins instead of fixed edge offsets

## Overlay Design On Android

### Pause

- Tapping `Pause` pauses the game
- The paused overlay should say `Tap Pause to resume` instead of `Press Esc to resume`
- If an overlay is already open, the same button closes the active overlay first before returning to gameplay

### Shop

- Shop stays a modal overlay
- The close target must be larger than the current desktop `X`
- Shop rows must become larger touch cards
- Vertical scrolling must be drag-based, not wheel-based

### Skill Tree

- Skill tree remains a modal overlay
- Skill cards and spend buttons need larger tap areas
- Scrolling becomes drag-based
- The close target must be larger and easier to hit than the desktop version

### Stats

- Stats remains a modal overlay
- Run and Character tabs need larger touch targets
- The close target and any post-death actions need larger touch targets

### Leaderboard And Menus

- Menu buttons are already structurally touchable, but need larger spacing for phones
- Network setup fields should be easier to focus without accidental backdrop taps
- Lobby actions need larger buttons and more vertical breathing room
- Ads may appear on non-canvas menu, setup, leaderboard, and lobby screens only
- Ads must not appear during active gameplay or on top of the gameplay canvas

## Multiplayer HUD Requirements

- Keep a compact group panel visible during gameplay
- Each teammate row must remain tappable for spectate targeting
- Pause-owner indicators must remain visible
- Remote pause banners and multiplayer notifications remain top-center, but should avoid overlapping the boss bar when possible

For Android v1, the group panel should prioritize:

- teammate name
- health
- death state
- spectate target highlighting

Lower-priority secondary details can be reduced if screen width is tight.

## Interaction Priority Rules

To avoid ambiguous touch handling:

- UI buttons always win over world interactions when a touch begins inside their rect
- Movement stick touches are captured once activated and should not trigger HUD buttons
- Aim pad touches are captured once activated and should not trigger HUD buttons
- The class cooldown widget and consumable slots should not pass through to world click handling
- Overlay drag regions should consume movement so scrolling a shop does not move the player

## Proposed Screen Regions

### Gameplay

- Top-left:
  - score, time, floor
- Top-center:
  - objective text
  - boss bar when active
  - multiplayer notifications when present
- Top-right:
  - pause, shop, skill tree, stats utility cluster
  - compact cooldown widget and player summary
  - compact player summary stays always visible
- Mid-right:
  - compact group panel when multiplayer is active
- Bottom-center:
  - XP bar
  - active and passive consumables
- Bottom-left:
  - floating movement stick activation region
- Bottom-right:
  - floating aim stick activation region

### Overlays

- Modal content remains centered
- Overlay width should expand close to safe-area bounds on phones
- Controls beneath the overlay become visually muted and non-interactive

## Open Design Decisions

- Whether the floating sticks should render with circular guide rings only after touch-down or with faint idle hint zones
- Whether the aim stick activation region should be circularly clamped or rectangularly tolerant after touch-down
- Whether Android should offer optional left-handed control mirroring later

## Recommended Implementation Notes

- Refactor input to represent gameplay intents instead of raw keyboard and mouse events
- Let the touch provider emit both queued-primary and held-primary states from aim-stick engagement
- Add explicit support for drag-scrolling overlays
- Replace hover-only affordances with persistent labels or tap states
- Keep desktop and Android HUD layout paths sharing as much content logic as possible, while allowing different placement rules

## Acceptance Criteria

This design is ready for implementation when:

- every desktop gameplay action has a defined Android touch equivalent
- every important overlay has a touch interaction model
- the HUD has a defined placement strategy that leaves room for controls
- safe-area handling and landscape assumptions are explicit
- multiplayer spectate and group-panel interactions are still supported
