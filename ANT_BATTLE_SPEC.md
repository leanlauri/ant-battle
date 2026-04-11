# Ant Battle Spec

## Status

Draft 1, derived from Lauri's design notes on 2026-04-11.

This document is the implementation-facing game spec for turning the current ant simulation into a mobile-first strategy game. It is written to support iterative delivery without requiring ongoing clarification for each step.

---

## 1. Vision

**Ant Battle** is a mobile-first, real-time ant-colony strategy game where the player expands from a small starting nest into a multi-nest colony, gathers food, evolves specialized ants, and defeats enemy factions across a campaign of procedurally generated levels.

The experience should feel:
- readable on a phone first
- tactile and satisfying to control with taps
- visually alive, with lots of ants moving at once
- strategically deep, but simple to learn
- incremental in complexity from level 1 to level 100

The current simulation already proves out terrain, ant swarming, food gathering, and basic scale. The game layer should build on that, not replace it.

---

## 2. Core Design Pillars

1. **Mobile first clarity**
   - Large touch targets
   - Minimal text during play
   - Clear high-contrast state cues
   - Playable with one thumb plus optional second-hand camera gestures

2. **Readable swarm strategy**
   - Many ants on screen, but the player's intent remains obvious
   - Nests, targets, enemies, and upgrade opportunities must be visually legible

3. **Iterative complexity**
   - Early levels teach one system at a time
   - New terrain hazards, factions, nest mechanics, and bosses appear gradually

4. **Systemic colony growth**
   - Food becomes military and expansion power
   - Nests are both production structures and vulnerable strategic anchors

5. **Spectacle without simulation collapse**
   - Large-scale ant battles should remain performant on mid-range mobile devices
   - Rendering and simulation should degrade gracefully with LODs and texture-based aftermath systems

---

## 3. Target Platforms

### Primary
- Mobile browsers, portrait-first UI, landscape gameplay supported
- Target modern iPhone Safari and Android Chrome

### Secondary
- Desktop browsers with mouse + keyboard support where appropriate

### Performance target
- 60 FPS on strong devices
- Acceptable fallback target 30 FPS on weaker mobile devices

---

## 4. High-Level Game Flow

1. **Title screen**
   - Game logo/title: `Ant Battle`
   - Background scene or subtle animated terrain/ants
   - Main CTA: `Tap to Start`

2. **Level select screen**
   - Level cards/buttons in pages of 20
   - Example pages: `1–20`, `21–40`, `41–60`, etc.
   - Left/right arrows or swipe to move between pages
   - Defeated levels clearly marked
   - Only completed levels plus the next undefeated level are selectable
   - Total level count currently assumed to be `100`

3. **Pre-level state**
   - Optional future addition: short level summary card
   - For now, selecting a level starts gameplay directly

4. **Gameplay**
   - Start with one nest and a small number of ants
   - Gather food, spawn and upgrade units, survive enemy pressure
   - Expand to multiple nests via queens
   - Destroy enemy nests to win

5. **Victory screen**
   - Level complete messaging
   - Stats summary
   - Unlock next level
   - CTA: next level / back to level select

6. **Game over screen**
   - Triggered when player's final nest is destroyed
   - Show `Tap to try again`
   - Show at minimum:
     - max number of player ants reached
     - total enemy ants defeated

---

## 5. Core Gameplay Loop

During a level, the player's loop is:
1. Select a nest
2. Set a local objective or area of interest
3. Ants gather food or attack nearby threats according to nest focus
4. Food increases nest storage and overall growth potential
5. When food thresholds are reached, upgrade choices become available
6. Player invests in more ants or expansion
7. Colony scales into multiple nests
8. Fighters pressure enemy ants and nests
9. Player wins by eliminating all enemy primary structures for the level objective

---

## 6. Controls and Input

## 6.1 Mobile-first controls

### In gameplay
- **Tap nest** to select it
- **Tap terrain** to assign that nest's attention/focus area
- **Tap upgrade card** to purchase an available upgrade
- **Tap UI button** for pause/menu if present
- Optional camera controls:
  - one-finger drag on empty terrain: pan or orbit, TBD after prototyping
  - pinch: zoom
  - two-finger drag: optional rotate/pan mode if needed

### Desired interaction simplicity
The primary command model should remain:
- select a nest
- tap a place
- colony responds automatically

No drag-box RTS selection. No per-ant commands.

## 6.2 Desktop controls
- Click nest to select
- Click terrain to assign focus area
- Mouse wheel to zoom
- Drag to orbit/pan via current camera model

---

## 7. Main Game Systems

## 7.1 Nests

A nest is the player's fundamental command and production unit.

Each nest has:
- position
- owning faction
- health
- food storage
- upgrade state
- local ant population by type
- focus target / area of interest
- optional queen status / queen presence
- visual growth state tied to food and tier

### Nest states
- active
- damaged
- collapsed / destroyed

### Nest health rules
- Enemy fighters can damage a nest slowly when they reach it
- Food can be spent or passively used to restore nest health, exact balance TBD
- If a nest reaches zero health:
  - it collapses
  - `1/3` of that nest's ants die immediately
  - surviving ants attempt to migrate to nearest friendly nest
  - if no friendly nest exists, they die or disperse, recommended: die for clarity

### Loss condition
- If the player's last remaining nest collapses, the level is lost

---

## 7.2 Food economy

Food is the main resource.

Food is used for:
- spawning or adding ants
- restoring nest health
- unlocking higher-tier options
- creating a queen
- expansion into additional nests

### Nest food thresholds
When a nest has enough food, it should surface upgrade choices to the player.

Recommended design:
- Upgrades are not freeform menus all the time
- Instead, when thresholds are hit, the selected nest can present **3 large upgrade options**
- The player chooses one

This preserves clarity and keeps progression feeling eventful.

---

## 7.3 Ant classes

The current simulation has scouts, foragers, and workers. The game should formalize distinct ant classes.

### 1. Worker
Role:
- efficient food gatherer
- low health
- non-combatant
- does not fight back

Traits:
- low HP
- moderate speed
- strong food prioritization
- weak or no nest attack damage

### 2. Scout
Role:
- exploration and map discovery behavior
- low health
- non-combatant
- helps find distant food and enemy zones

Traits:
- low HP
- higher mobility
- wider search radius / more exploratory behavior
- does not fight back

### 3. Fighter
Role:
- frontline combatant
- attacks enemy ants and enemy nests
- only class that fights back

Traits:
- higher HP
- combat AI enabled
- slower than scouts, possibly slightly faster than workers depending on feel
- nest siege damage

### 4. Queen
Role:
- strategic expansion unit
- unlocked later in a nest's progression
- can travel and establish a new nest

Traits:
- expensive
- vulnerable while relocating
- may require escort logic
- not primarily a combat unit

---

## 7.4 Combat

### Ant vs ant combat
- Only fighters actively attack and retaliate
- Workers and scouts can be attacked and killed but do not fight back
- Each ant has HP
- Combat should be lightweight, readable, and scalable

Recommended combat model:
- melee range checks
- attack cooldown per fighter
- simple damage values per attack
- death event triggers visual aftermath

### Ant vs nest combat
- Fighters that reach an enemy nest begin damaging it slowly over time
- Nests should not instantly melt, they should feel durable enough to matter strategically
- Damage-over-time siege model is preferable to burst damage

---

## 7.5 Multi-nest colony management

Once queens unlock, the player can operate multiple nests.

### Expansion flow
1. Mature nest reaches required food/tier
2. Queen option appears
3. Player creates queen
4. Queen travels to a valid nest location
5. New nest is founded
6. A subset of colony activity may start routing there

### Requirements for v1
- New nests should be created at valid reachable positions only
- New nests inherit player faction ownership
- Each nest manages its own local ant population and upgrades

### Command model for multiple nests
- Player can select one nest at a time
- Each selected nest shows its own available upgrades
- Tapping terrain assigns that nest's local focus region

---

## 7.6 Factions and enemies

### Player faction
- Distinct tint/color from all enemies
- Selected nest gets a bold light-green outline
- Player ants should carry a different tint so they remain recognizable in battle

### Enemy factions
- Different tint/color families
- Different behavior biases and starting strengths
- Eventually up to **5 enemy factions** by higher-level play, especially around level 50+

### Scaling rule
Enemy starting strength should scale upward over levels, but generally not exceed around **3x the player's starting ant count** per faction, unless it is a special boss/wasp level.

---

## 7.7 Wasp levels

Every tenth level should be a wasp-nest battle.

### Wasp design goals
- Fewer units than ants
- Much stronger in combat
- Can fly over terrain and ant traffic
- May choose to bypass ant swarms rather than always engaging

### Wasp behavior
- airborne movement ignores ground path congestion
- selective aggression
- strong direct threat to nests and fighters

### Recommended rollout
- Do not implement wasps early
- Treat wasps as a later milestone after core ant-vs-ant gameplay is stable

---

## 8. Progression and Campaign Structure

## 8.1 Level structure

Assume `100` levels for current planning.

### Unlocking
- Completed levels remain replayable
- Only one new undefeated level unlocks at a time

### Pagination
- 20 levels per page in the level select UI
- arrows or swipe to move between pages

## 8.2 Difficulty curve

### Levels 1–10
Introduce:
- movement and food collection
- nest selection and directing focus
- basic enemy colony behavior
- simple terrain
- first wasp level at 10, likely simplified boss introduction

### Levels 11–25
Introduce:
- stronger enemy colonies
- more complex food placement
- first meaningful terrain chokepoints
- larger maps
- more pressure to use fighters

### Levels 26–50
Introduce:
- second and third enemy factions in some levels
- expansion pressure
- queen and multi-nest play becomes necessary
- rivers/ponds begin appearing in selected levels

### Levels 51–75
Introduce:
- up to 5 factions in some levels
- stronger terrain complexity
- larger multi-front battles
- more demanding resource timing

### Levels 76–100
Introduce:
- peak complexity
- stronger enemy opening states
- mixed terrain obstacles and multi-faction pressure
- frequent need for multiple nests and efficient role composition

---

## 9. Terrain and Procedural Generation

Each level should derive from a deterministic random seed.

The seed controls at minimum:
- terrain shape
- food placement distribution
- water placement
- time of day
- faction placements
- nest positions
- palette variation

## 9.1 Terrain goals
- Levels should vary in size and complexity
- Some levels include rivers and ponds
- Terrain should feel organic and interesting
- Critical rule: **all land regions that matter must be reachable**

### Reachability requirement
Any playable land area used for food, player nest spawn, enemy nests, or objectives must be connected by valid traversable paths.

Recommended approach:
- generate terrain first
- classify blocked vs traversable zones
- run reachability validation
- repair or regenerate if disconnected

## 9.2 Water
- Rivers and ponds are introduced gradually
- Water blocks ant movement
- Wasps can ignore water due to flying
- Nests should not spawn in isolated invalid pockets

---

## 10. Time of Day and Lighting

Time of day should be randomized from the level seed.

### Effects of time of day
- overall palette tint
- light intensity
- sky/fog coloration
- nest glow/radiance

### Constraint
Even night levels should remain readable.
They should be darker and moodier, but not so dark that gameplay clarity suffers.

### Nest lighting
Nests should radiate light, especially at darker times of day, to improve readability and atmosphere.

---

## 11. Rendering and Visual Feedback

## 11.1 Ant visual identity
Different ant classes should look visually distinct.

Recommended minimum readable differences:
- **worker**: slimmer, practical silhouette
- **scout**: lighter/faster silhouette
- **fighter**: chunkier body / stronger head or mandibles
- **queen**: larger, unmistakable silhouette

Player ants should also have faction tinting distinct from enemy factions.

## 11.2 Nest selection feedback
Selected nest should have:
- light green bold outline
- optional subtle glow ring
- clear upgrade panel attached to selection context

## 11.3 Death aftermath and battlefield stain system
When ants die:
- animate body break/fall apart briefly
- convert aftermath into a terrain-overlay texture or battlefield decal buffer
- render crushed body remains and green blood onto a texture layered above terrain

### Why this matters
This allows battle aftermath to scale visually without keeping thousands of corpse meshes alive.

### Implementation direction
- Use a world-space splat/decal texture system over terrain
- Stamp body fragments and green fluid into the overlay
- Persist for a while or indefinitely during the level

---

## 12. UI and HUD

## 12.1 In-game HUD requirements
### Top-right
- prominently display current player ant count

Recommended also track nearby values later:
- total ants
- fighters count
- food total
- selected nest food

## 12.2 Upgrade presentation
When a selected nest has available upgrades:
- show large cards/icons near top of screen
- must be touch-friendly
- max 3 options at once
- minimal text, strong icons

## 12.3 Level select UI
- cards/buttons for levels
- completed state
- locked state
- current open level highlighted
- page arrows or swipe support

## 12.4 Title and game over UI
- clear centered text
- tap-to-continue interactions
- minimal friction

---

## 13. AI Behavior Direction

## 13.1 Nest focus command
When the player selects a nest and taps terrain, that nest updates its local attention area.

### Expected behavior from focus assignment
If the target area contains:
- **food**: send gather-capable ants there
- **enemy ants**: send fighters there
- **enemy nest**: commit fighters toward offense
- **empty space**: bias scouting/exploration there

This should not be a hard per-ant order system. It should be a nest-level strategic bias.

## 13.2 Enemy AI
Enemy colonies should use the same or nearly the same systemic rules as the player:
- gather food
- spawn units
- defend local area
- attack targets of opportunity
- expand at higher levels if needed

Enemy AI should be faction-biased rather than bespoke for each level whenever possible.

Example biases:
- aggressive fighter-heavy faction
- expansionist faction
- gatherer-heavy faction
- scout-heavy mobile faction
- defensive turtle faction

---

## 14. Win and Loss Conditions

## 14.1 Standard ant-colony levels
Win when all required enemy nests are destroyed.

## 14.2 Wasp levels
Win when the wasp nest is destroyed.

## 14.3 Lose condition
Lose when the player's final nest collapses.

## 14.4 Post-loss stats
Game over screen should display at least:
- max number of player ants reached
- enemy ants defeated

---

## 15. Save and Progress Model

For the first campaign version, persist at minimum:
- highest unlocked level
- completed levels
- optional best stats later

Recommended storage:
- browser local storage initially
- keep save format versioned

---

## 16. Non-Goals for Early Milestones

These should not block the first playable game version:
- sophisticated story/campaign narrative
- online features
- per-ant manual micro controls
- advanced animation blending
- deep audio system
- complex nest building placement UI
- polished tutorialization beyond basic guidance

---

## 17. Recommended System Architecture Additions

To evolve the current simulation into the game, add these conceptual modules:

- `game-state`
  - title, level select, gameplay, victory, defeat, pause
- `campaign-state`
  - unlocked/completed levels and persistence
- `level-definition`
  - seed, terrain params, faction setup, objective rules
- `faction-system`
  - ownership, tint, AI profile, faction relationships
- `nest-system`
  - nest health, food, upgrades, production, selection state
- `combat-system`
  - HP, attack, death, siege
- `upgrade-system`
  - threshold checks and available choices
- `queen/expansion-system`
  - multi-nest growth
- `battlefield-overlay-system`
  - corpse/blood terrain stamps
- `ui-screen-system`
  - title, level select, in-game overlays, game over, victory

These can be implemented incrementally and should minimize coupling to raw rendering code.

---

## 18. Iterative Implementation Plan

This is the recommended order of implementation.

## Phase 0, freeze the prototype baseline
Goal:
- keep the current simulation stable as the foundation

Deliverables:
- confirm current ants prototype runs in `ant-battle/game`
- ensure test/build/deploy pipeline remains green
- document baseline gameplay assumptions

Exit criteria:
- project can ship prototype changes safely

## Phase 1, game shell and screen flow
Goal:
- convert tech demo into a game-shaped app

Deliverables:
- title screen with `Tap to Start`
- level select screen with pages of 20 levels
- locked/completed/open level states
- gameplay screen state entry/exit
- victory and game over overlays

Exit criteria:
- player can launch game, select a level, lose/win, and return

## Phase 2, faction ownership and nest selection
Goal:
- establish player vs enemy structure

Deliverables:
- faction colors/tints
- player-owned nest and enemy-owned nests
- selected nest outline in light green
- top-right prominent ant count
- tap nest to select
- tap terrain to assign focus target

Exit criteria:
- player can meaningfully command one nest

## Phase 3, ant classes and combat foundation
Goal:
- turn simulation roles into game roles

Deliverables:
- worker, scout, fighter distinctions
- HP system for ants
- fighter-only retaliation/combat
- enemy ant deaths
- simple nest damage from fighters

Exit criteria:
- ant battles happen and resolve clearly

## Phase 4, food economy and upgrade cards
Goal:
- make food into strategic progression

Deliverables:
- food thresholds per nest
- 3-option upgrade card presentation
- spawn batches, recommended default: around 20 ants
- different options per nest state and level

Exit criteria:
- player can grow colony through choices instead of passive scaling alone

## Phase 5, nest health, collapse, and recovery
Goal:
- make nest survival central

Deliverables:
- nest HP
- repair via food model
- collapse logic
- one-third ant loss on collapse
- migration to nearest friendly nest
- game over when final nest falls
- game over stats

Exit criteria:
- complete lose loop exists and feels fair

## Phase 6, queen and multi-nest play
Goal:
- unlock strategic expansion

Deliverables:
- queen unlock rule
- queen unit behavior
- founding new nests
- multiple player nests each with own food/production/selection

Exit criteria:
- player can manage more than one nest

## Phase 7, level generator and seeded progression
Goal:
- create scalable campaign content

Deliverables:
- deterministic seeded level definitions
- terrain size/complexity scaling
- food and faction spawn rules
- connected-land validation
- rivers and ponds introduced gradually

Exit criteria:
- multiple levels feel meaningfully distinct and fair

## Phase 8, rendering aftermath and polish
Goal:
- increase battlefield readability and emotional payoff

Deliverables:
- ant death breakup/fall animation
- body/blood splat stamping into terrain overlay texture
- class silhouette refinement
- faction tint refinement
- time-of-day palette system
- nest glow for dark levels

Exit criteria:
- battlefield feels rich and persistent

## Phase 9, wasp levels
Goal:
- add boss-style variety every tenth level

Deliverables:
- wasp faction
- flying movement rules
- stronger combat tuning
- special level templates for 10/20/30...

Exit criteria:
- every tenth level feels like a distinct challenge type

## Phase 10, campaign balancing and content fill
Goal:
- finish 1–100 progression

Deliverables:
- balance pass across all systems
- faction intro pacing
- difficulty curve smoothing
- unlock and completion persistence
- level catalogue completion

Exit criteria:
- complete campaign is playable end-to-end

---

## 19. Default Product Decisions

These should be treated as the default implementation unless later changed.

- total planned levels: `100`
- level select page size: `20`
- one newly unlocked level at a time
- player starts each level with one nest and a small colony
- upgrade choices appear in sets of `3`
- ant batch upgrade default: `~20 ants`
- only fighters fight back
- worker and scout are non-combatants
- every tenth level is a wasp level
- selected nest outline color: bold light green
- top-right HUD displays player ant count prominently
- night levels remain readable, not dark for darkness' sake

---

## 20. Open Questions, not blockers

These can be decided during implementation without blocking Phase 1–3.

- exact ant batch size per upgrade, `20` is current default
- whether nest healing is passive from stored food or an explicit spend
- whether queens can be controlled directly or only assigned via nest UI
- exact camera behavior on mobile, especially one-finger drag semantics
- exact number and naming of enemy faction archetypes
- whether some late levels require annihilation vs limited objectives
- whether corpse/blood texture persists forever in a level or fades over time

---

## 21. Immediate Next Planning Deliverables

Before writing more gameplay code, create these follow-up docs:

1. `IMPLEMENTATION_ROADMAP.md`
   - convert phases into concrete engineering tickets

2. `LEVEL_SYSTEM_SPEC.md`
   - define seeded level data model and progression curve

3. `COMBAT_AND_NEST_SPEC.md`
   - define HP, attack cadence, nest collapse, migration

4. `UI_UX_SPEC.md`
   - title, level select, gameplay HUD, upgrade cards, game over

5. `FACTION_AND_UNIT_SPEC.md`
   - player/enemy colors, ant classes, AI biases, queen, wasps

These should be authored in that order.

---

## 22. Summary

Ant Battle should evolve from a simulation into a mobile-first real-time colony strategy game with:
- campaign progression
- multi-nest expansion
- ant-class strategy
- faction warfare
- readable touch controls
- procedural but fair levels
- scalable battle rendering

The recommended path is to build the game shell first, then faction ownership and selection, then combat, then economy and upgrades, then expansion, then procedural campaign depth.
