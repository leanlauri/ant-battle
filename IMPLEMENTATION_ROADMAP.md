# Ant Battle Implementation Roadmap

## Purpose

This roadmap translates `ANT_BATTLE_SPEC.md` into a practical execution sequence.

Goals:
- keep implementation incremental
- preserve a always-playable main branch
- avoid large rewrites
- reduce design ambiguity during execution
- allow future coding passes to proceed with minimal human intervention

---

## Execution status

### Current checkpoint
- Current milestone: Milestone 6, Upgrade cards and economy loop
- Current sprint: Sprint D
- Current focus: player-facing nest upgrades now that repair and first unit-purchase cards exist, then enemy colony production and level differentiation

### Progress log
- [x] Project docs baseline is authored in repo root (`ANT_BATTLE_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`, `LEVEL_SYSTEM_SPEC.md`, `COMBAT_AND_NEST_SPEC.md`, `UI_UX_SPEC.md`, `FACTION_AND_UNIT_SPEC.md`)
- [x] Repo naming cleanup started, page title and HUD title now read `Ant Battle`
- [x] Campaign progress persistence and 1–100 level catalog added in code
- [x] App/game state machine added
- [x] Title screen UI layer added
- [x] Level select UI layer added
- [x] Gameplay boot moved behind state entry
- [x] Victory / defeat overlay shell added
- [x] Local progression is wired into the playable flow
- [x] End-to-end smoke flow covers title → level select → gameplay → shell victory unlock
- [x] Player nest ownership, enemy nest identity, selection ring, and focus marker are implemented
- [x] Top-right ant count now reflects player ownership and gameplay HUD shows selected nest + focus target
- [x] Ant classes now use worker / fighter naming with class-specific visuals and behavior hooks
- [x] Enemy nests seed enemy-tinted ants so faction ownership is visible on the battlefield
- [x] Per-ant HP, fighter-only melee targeting, death removal, and battle stats are implemented
- [x] HUD and shell overlays now report enemy defeats and player losses
- [x] Scout class was removed for now, simplifying the playable roster to worker + fighter
- [x] Enemy fighter pressure was increased so enemy fighters push toward hostile nests more reliably
- [x] Nest HP scaffolding and fighter-to-nest siege hooks are now implemented, with HUD visibility for nest health and destroyed enemy nests
- [x] Real victory / defeat triggers now come from battle state instead of only debug buttons
- [x] Nest collapse consequences now apply a first-pass colony loss and immediate reassignment model for surviving ants
- [x] Selected nests now expose a first upgrade-card skeleton, including food-based nest repair and worker/fighter batch purchases
- [x] Enemy nests now convert stored food into new worker/fighter batches over time, and selected-nest HUD feedback now shows local stored food more clearly
- [x] The gameplay HUD now exposes the active player nest's stored food as a dedicated top-bar readout, and the upgrade panel mirrors that same value so nest-local affordability is obvious at a glance
- [x] Direct HUD shell win/lose buttons are gone, smoke coverage now uses a hidden test hook instead of player-facing debug controls, and level-number-based scenario variation now changes enemy nest count and budget bands
- [x] Levels now carry deterministic biome-like flavor data, including terrain roughness, time-of-day atmosphere, and objective text, which now affects battlefield shape and presentation in-game
- [x] Nest upgrades now include persistent specialization choices, not only one-shot repair/reinforcement spends: worker-batch growth, fighter-batch growth, and nest fortification all persist per nest
- [x] Level setup now affects opening colony compositions and enemy doctrine, so campaign fights differ in starting worker/fighter mixes rather than only map mood and overall budget
- [x] Nest upgrade feedback now gives clear ready/shortfall/active messaging, success confirmation, and mobile-friendlier card wrapping in the compact overlay
- [x] Runtime reinforcement spawning now uses its own deterministic `ants-spawn` seed stream, keeping upgrade/enemy production ant creation from perturbing ongoing AI decision rolls
- [x] Delivered food regrowth is now covered by deterministic seed tests, confirming replenished food stays locked to the level `food` stream across replays
- [x] Enemy production cooldown timing is now covered by deterministic runtime tests, confirming the `enemy-economy` stream keeps colony growth replay-stable for a level seed
- [x] Live enemy-economy integration is now covered by deterministic seed tests, confirming production timing stays locked to `enemy-economy` while spawned reinforcement placement remains isolated on `ants-spawn`
- [x] Live runtime integration now also covers seeded food regrowth alongside enemy production and spawned reinforcements, confirming the `food`, `enemy-economy`, and `ants-spawn` streams stay isolated when they run together in the gameplay update order
- [x] Live runtime deterministic coverage now also exercises a real ant decision roll plus combat-death aftermath, confirming `ants-runtime` and `ants-effects` stay isolated from `food`, `enemy-economy`, and `ants-spawn` changes during the gameplay update order
- [x] Live runtime deterministic coverage now also exercises worker claim, assist-carry, and delivery flow, confirming carried-food interactions stay stable when unrelated `enemy-economy`, `ants-spawn`, `ants-runtime`, and `ants-effects` seeds change while delivery-triggered regrow timers remain on the `food` stream
- [x] Live runtime deterministic coverage now also exercises player focus-target routing and seeded enemy fighter pressure decisions, confirming those AI decision paths stay isolated from `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` changes during the gameplay update order
- [x] Live runtime deterministic coverage now also exercises unfocused worker idle-versus-wander fallback and player-fighter patrol fallback, confirming those background brain paths stay isolated from `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` changes during the gameplay update order while `ants-runtime` still owns their divergence
- [x] Live runtime deterministic coverage now also exercises siege-driven enemy nest collapse plus immediate colony reassignment, confirming collapse aftermath stays structurally stable when unrelated `food`, `enemy-economy`, `ants-spawn`, or `ants-runtime` seeds change, while collapse-side presentation remains isolated on `ants-effects`
- [x] The alternative battlefield camera is now exposed through the normal gameplay HUD with a visible mode label and toggle, so players/testers no longer need hidden dev controls to reach it
- [x] The battlefield camera now uses a steeper orthographic tactical view with re-tuned zoom/framing, making the playfield read more top-down while keeping tap targeting and HUD camera switching intact
- [x] The battlefield camera framing was refined again with a steeper plan-aligned tilt, deeper zoom range, and zoom-aware pan bounds so close mobile framing stays stable on the terrain without introducing sideways yaw
- [x] Battlefield camera controls now keep a true 45 degree orthographic tactical tilt, allow target-stable rotation around the current focus, and zoom in closer for near-ant inspection without breaking tap targeting
- [x] Battlefield camera foreground clipping was reduced by biasing the orthographic frustum slightly toward the lower screen edge and widening the near/far safety range, so close tactical zoom keeps the lower battlefield visible
- [x] Battlefield foreground occlusion was reduced further by softening terrain relief near the outer rim and tightening battlefield edge clamping at close zoom, so raised horizon geometry no longer crowds the lower tactical view

### Next implementation slice
1. Replace coarse level bands with a richer deterministic level-definition model.
2. Add visible death/aftermath presentation for ant combat.
3. Tune enemy economy and production pacing across the campaign.

---

## 1. Delivery strategy

## 1.1 Core principle

At the end of each milestone, the game should still:
- build
- run locally
- deploy successfully
- remain playable, even if incomplete

## 1.2 Implementation shape

Prefer vertical slices over isolated technical subsystems.

That means:
- ship a minimal title screen before building the entire menu stack
- ship one selectable player nest before building full multi-nest logic
- ship simple combat before advanced faction tuning
- ship one basic seeded level definition before 100 levels

## 1.3 Branching recommendation

For now, keep work on short-lived feature branches merged back into `main` quickly.

Avoid long-lived branches for entire phases.

---

## 2. Immediate repo tasks

These are lightweight prep tasks before larger feature work.

### Task 2.1, establish project docs baseline
Create or update:
- `ANT_BATTLE_SPEC.md` ✅
- `IMPLEMENTATION_ROADMAP.md` ✅
- `LEVEL_SYSTEM_SPEC.md`
- `COMBAT_AND_NEST_SPEC.md`
- `UI_UX_SPEC.md`
- `FACTION_AND_UNIT_SPEC.md`

### Task 2.2, repo naming cleanup
Update game-facing labels and internal references from prototype wording to Ant Battle consistently.

Includes eventually:
- HUD labels
- page metadata
- README if added
- test names where helpful
- future screen naming

### Task 2.3, baseline protection
Add or maintain test coverage around:
- boot/smoke render
- ant spawning
- food collection
- deploy build

Done when:
- current prototype remains stable while game shell work begins

---

## 3. Milestone plan

## Milestone 1, Game shell

### Goal
Turn the simulation into a game-shaped app with screen states.

### Deliverables
- title screen with `Tap to Start`
- level select screen
- level pagination in groups of 20
- locked/completed/open level states
- gameplay state entry
- game over overlay shell
- victory overlay shell
- basic local persistence for unlocked level

### Implementation tasks
1. Introduce app/game state machine
   - title
   - level select
   - gameplay
   - victory
   - defeat
2. Move current simulation boot under gameplay state
3. Add title screen UI layer
4. Add level select UI layer
5. Add save/load for unlocked progress
6. Add temporary mock level data for 1–100

### Dependencies
- none beyond current prototype

### Done when
- user can launch game, tap start, choose level 1, enter gameplay, and return to level select after win/loss

---

## Milestone 2, Player ownership and selection

### Goal
Introduce player control in a readable way.

### Deliverables
- player faction identity
- enemy faction identity
- selectable player nest
- selected nest light-green outline
- top-right ant count display
- tap terrain to assign focus area
- visible focus marker on terrain

### Implementation tasks
1. Add faction ownership model to nests and ants
2. Add selected nest state
3. Add nest picking / hit detection
4. Add terrain click/tap command target
5. Add visible selected state ring or outline
6. Add HUD ant-count panel
7. Add simple focus marker visualization

### Done when
- player can clearly select their nest and redirect colony attention with a tap

---

## Milestone 3, Ant classes as game units

### Goal
Replace vague role flavor with true gameplay classes.

### Deliverables
- worker class behavior
- fighter class behavior
- visual differentiation between classes
- player faction tinting
- enemy faction tinting

### Implementation tasks
1. Convert role model into class model with clear stats
2. Separate gather/combat/explore priorities by class
3. Adjust spawning rules to support class-specific batches
4. Add readable silhouette changes by class
5. Keep performance model compatible with many ants

### Done when
- the player can visually tell classes apart and gameplay behavior reflects class differences

---

## Milestone 4, Combat foundation

### Goal
Make colony conflict real and readable.

### Deliverables
- HP for ants
- fighter-only attacks and retaliation
- death handling
- enemy elimination counts
- basic enemy nest attack behavior

### Implementation tasks
1. Add per-ant HP and death state
2. Add combat target acquisition for fighters
3. Add attack cooldown + damage loop
4. Add enemy fighters with same system
5. Add basic death animation placeholder
6. Add battle stat tracking

### Done when
- fighters engage enemies, units die, and battles affect level outcome

---

## Milestone 5, Nest health and failure states

### Goal
Make nests strategic assets instead of just drop-off points.

### Deliverables
- nest HP
- damage from enemy fighters
- health restoration via food
- collapse behavior
- one-third ant death on collapse
- migration to nearest friendly nest
- defeat when final player nest is lost
- game over stats display

### Implementation tasks
1. Add nest HP state and damage model
2. Add repair model tied to food
3. Add collapse event logic
4. Add ant migration or death fallback
5. Add defeat trigger
6. Add game over UI content

### Done when
- a level can be lost through nest destruction and the loss loop feels complete

---

## Milestone 6, Upgrade cards and economy loop

### Goal
Turn food into player-facing decisions.

### Deliverables
- nest-local food thresholds
- 3-option upgrade card presentation
- spawn worker/fighter batches
- approx 20-ant batch default
- upgrade availability tied to selected nest

### Implementation tasks
1. Define threshold table for early nests
2. Add upgrade option generation rules
3. Add touch-friendly card UI
4. Add purchase/apply pipeline
5. Add visual feedback for successful upgrade

### Done when
- gathering food leads to meaningful upgrade choices, not just passive hidden growth

---

## Milestone 7, Enemy colony loop

### Goal
Give levels actual strategic opposition.

### Deliverables
- enemy nests gather food
- enemy colonies spawn units
- enemy fighters defend and attack
- faction AI biases
- difficulty scaling by level

### Implementation tasks
1. Add enemy nest production logic
2. Add simple enemy strategic focus selection
3. Add faction behavior profile system
4. Tune early levels for one enemy colony
5. Add scaling hooks for later multi-faction maps

### Done when
- a level feels like a real colony-vs-colony encounter rather than a sandbox

---

## Milestone 8, Seeded level system

### Goal
Move from ad hoc scenarios to deterministic campaign generation.

### Deliverables
- level definition model
- deterministic seed handling
- terrain parameter ranges per level
- faction placement generation
- food placement generation
- map size and complexity scaling

### Implementation tasks
1. Create level-definition schema
2. Add seeded random utility
   - shared helper should support derived per-system substreams so food placement, starting ant placement, runtime ant decisions, combat aftermath effects, and other replay-sensitive rolls can stay isolated per level
3. Add level generator entry point
4. Bind level select to generated levels
5. Add first pass difficulty ramp table

### Done when
- level number reliably maps to repeatable terrain/setup/progression values

---

## Milestone 9, Reachable terrain, rivers, ponds

### Goal
Increase terrain variety without creating broken maps.

### Deliverables
- water features
- traversability map
- reachability validation
- repair or regen for invalid maps

### Implementation tasks
1. Add water classification to terrain generation
2. Mark blocked vs traversable cells
3. Validate nest/food/faction connectivity
4. Add fallback repair or regenerate logic
5. Tune river/pond frequency by level range

### Done when
- maps can include water while remaining fair and fully playable

---

## Milestone 10, Queen and multi-nest expansion

### Goal
Unlock true colony-scale strategy.

### Deliverables
- queen unlock condition
- queen creation upgrade
- queen travel/founding logic
- second and later player nests
- nearest-friendly-nest migration support
- per-nest upgrades and food stores

### Implementation tasks
1. Define queen data model
2. Add valid expansion target selection
3. Add founding animation/event
4. Add multi-nest selection support
5. Add per-nest command focus independence

### Done when
- player can control multiple nests and expansion changes strategy meaningfully

---

## Milestone 11, Visual battlefield aftermath

### Goal
Make combat leave persistent, scalable marks.

### Deliverables
- death breakup/fall animation
- corpse and green blood terrain overlay stamps
- persistent battlefield texture layer

### Implementation tasks
1. Design overlay texture/decal system
2. Add event stamping from ant deaths
3. Add faction-aware corpse tint handling if desired
4. Tune persistence and density limits

### Done when
- battlefields visibly accumulate history without excessive mesh cost

---

## Milestone 12, Time of day and atmosphere

### Goal
Add seeded mood variety without harming readability.

### Deliverables
- seeded time-of-day choice
- lighting variation
- palette variation
- nest radiance/glow at darker times

### Implementation tasks
1. Add time-of-day parameter to level definition
2. Add palette presets
3. Tune light/fog/background by time
4. Add nest light emission cues

### Done when
- levels feel visually varied while maintaining gameplay clarity

---

## Milestone 13, Multi-faction escalation

### Goal
Scale later levels into larger strategic conflicts.

### Deliverables
- up to 5 factions by later campaign
- faction strength scaling
- faction profile variance
- later-level pressure tuning

### Implementation tasks
1. Add multi-faction generation rules
2. Add spawn scaling tables by level band
3. Ensure enemy strength generally stays within target bounds
4. Tune readability with more colors/factions on map

### Done when
- later levels feel more complex without becoming unreadable chaos

---

## Milestone 14, Wasp levels

### Goal
Introduce every-tenth-level boss-style encounters.

### Deliverables
- wasp nest type
- wasp unit type
- flight logic
- stronger combat stats
- special level templates for 10, 20, 30, etc.

### Implementation tasks
1. Define wasp faction/unit model
2. Add airborne pathing/movement rules
3. Add attack logic and siege behavior
4. Create special progression tuning for wasp levels

### Done when
- every tenth level feels distinct and memorable

---

## Milestone 15, Campaign fill and balance

### Goal
Bring the game from system-complete to campaign-complete.

### Deliverables
- full 1–100 campaign tuning
- unlock flow verified
- difficulty progression smoothed
- enemy/faction pacing tuned
- stats tracking refined

### Implementation tasks
1. Fill level bands with parameter tables
2. Tune economy and combat pacing
3. Verify no impossible level seeds
4. Add polish to victory/defeat UX
5. Improve telemetry-style balancing notes if needed

### Done when
- campaign is complete, fair, and consistently deployable

---

## 4. Cross-cutting engineering work

These tasks run across milestones.

## 4.1 Performance
Track performance continuously.

Watch especially:
- mobile FPS under high ant counts
- pathfinding/reachability cost
- combat target selection scale
- overlay texture update cost
- multi-nest and multi-faction CPU growth

### Rules
- keep simulation/render decoupled
- extend current LOD system instead of discarding it
- prefer faction/nest-level steering over per-ant expensive planning
- use texture stamping for aftermath instead of corpse mesh accumulation

## 4.2 Testing
Add tests as systems solidify.

Recommended buckets:
- unit tests for level generation and progression logic
- unit tests for combat and collapse rules
- e2e smoke for title → level select → gameplay boot
- deterministic seed tests for terrain/faction setup

## 4.3 Deploy safety
Every milestone should preserve:
- local build
- CI build
- Pages deploy

---

## 5. Suggested file/doc sequencing

Create these next, in order:

1. `UI_UX_SPEC.md`
   - required now for Milestone 1 and 2
2. `COMBAT_AND_NEST_SPEC.md`
   - needed for Milestone 4 and 5
3. `LEVEL_SYSTEM_SPEC.md`
   - needed before Milestone 8
4. `FACTION_AND_UNIT_SPEC.md`
   - needed before Milestone 3 and later balancing

---

## 6. Recommended first coding sprint

If implementation started now, the first sprint should target only this:

### Sprint A
- title screen
- level select shell
- app state machine
- gameplay boot behind level launch
- save unlocked level in local storage

### Why
This creates the game shell immediately and gives every later system a place to live.

### Explicitly do not include in Sprint A
- combat
- queens
- multi-nest
- wasps
- rivers
- detailed upgrade economy

Keep it narrow.

---

## 7. Definition of success

The roadmap is successful if:
- the project remains deployable after each milestone
- each milestone produces a testable playable state
- late systems build on early systems cleanly
- the game can be continued by future implementation passes without needing design rediscovery

---

## 8. Immediate next action

Next recommended step:
- author `UI_UX_SPEC.md`

That is the best next document because it directly shapes the first implementation milestone and removes ambiguity around title screen, level select, gameplay HUD, selection cues, and upgrade card layout.
