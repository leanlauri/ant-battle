# Ant Battle Level System Spec

## Purpose

This document defines level progression, seeded generation, unlock flow, difficulty ramping, and level composition rules for the Ant Battle campaign.

---

## 1. Campaign structure

Planned campaign size:
- `100` levels

Levels should unlock one at a time:
- completed levels remain replayable
- exactly one new undefeated level becomes available after the previous one is cleared

---

## 2. Level select rules

- levels are presented in pages of 20
- pages are grouped as `1–20`, `21–40`, `41–60`, `61–80`, `81–100`
- every level has one of three states:
  - completed
  - open
  - locked

Special marker:
- every 10th level is a wasp level and should have special iconography

---

## 3. Level definition model

Each level should resolve into a deterministic definition object.

Suggested fields:
- levelNumber
- seed
- biome / palette profile
- timeOfDay
- mapSize tier
- terrain complexity
- water feature settings
- player starting nest definition
- enemy faction definitions
- food distribution settings
- objective type
- special flags, e.g. wasp level

The exact implementation format may be JSON-like data or generated at runtime from parameter tables.

---

## 4. Seed model

Each level should map to a deterministic seed.

The seed controls at least:
- terrain shape
- water placement
- faction placement
- food placement
- time of day
- palette variation
- initial setup substreams, such as starting ant placement, enemy role mix, and repeatable enemy-economy cooldown rolls
- runtime replay-sensitive substreams where practical, such as ant decision rolls and combat aftermath presentation

### Rule
Replaying the same level number should generate the same base scenario unless explicit future modifiers are introduced.

Implementation note:
- derive named sub-seeds from the level seed so setup systems can stay deterministic without sharing one giant global random stream
- keep the `food` stream responsible for both initial placement and later regrowth so replenished food stays replay-stable for a seed
- keep setup, runtime ant logic, combat aftermath effects, and enemy-economy rolls on separate substreams so adding one system does not silently perturb another
- keep reinforcement / upgrade ant spawning on its own `ants-spawn` substream so runtime batch creation does not perturb ongoing ant decision rolls
- keep regression coverage around replay-sensitive enemy production cooldown rolls so enemy colony growth remains seed-stable across replays
- keep integration coverage around live enemy production plus spawned-ant batch creation so `enemy-economy` timing and `ants-spawn` placement stay isolated from each other
- keep a live-runtime integration test where delivered-food regrowth runs alongside enemy production and spawned reinforcements, so `food`, `enemy-economy`, and `ants-spawn` streams do not perturb one another
- keep live-runtime coverage around a real ant decision roll and combat-death aftermath so `ants-runtime` and `ants-effects` stay isolated from `food`, `enemy-economy`, and `ants-spawn` seed changes during the normal gameplay update order
- keep live-runtime coverage around carried-food claim, assist-carry, delivery, and delivery-triggered regrow timers so those interactions stay stable when unrelated `enemy-economy`, `ants-spawn`, `ants-runtime`, or `ants-effects` seeds change
- keep live-runtime coverage around player focus-target routing and seeded enemy pressure/patrol decisions so those AI paths stay isolated from `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` seed changes
- keep live-runtime coverage around unfocused worker idle-versus-wander fallback and player-fighter patrol fallback so those background brain paths stay isolated from `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` seed changes, while `ants-runtime` changes still diverge them
- keep live-runtime coverage around siege-driven nest collapse, dead-ant fallout, and immediate colony reassignment so collapse aftermath stays structurally stable when unrelated `food`, `enemy-economy`, `ants-spawn`, or `ants-runtime` seeds change, while collapse-side presentation remains isolated on `ants-effects`

---

## 5. Difficulty progression bands

## Levels 1–10
Focus:
- basic colony control
- basic enemy colony combat
- simple terrain
- low nest count
- first wasp level at 10

## Levels 11–25
Focus:
- stronger enemy pressure
- more food spread
- mild terrain complexity
- first meaningful need for fighters

## Levels 26–50
Focus:
- multi-front pressure
- some levels with multiple enemy factions
- more terrain variation
- queen/multi-nest play becomes relevant

## Levels 51–75
Focus:
- broader terrain
- more factions
- more aggressive timing pressure
- more advanced faction mixes

## Levels 76–100
Focus:
- late-campaign scale
- complex terrain and enemy arrangements
- high pressure but still readable and fair

---

## 6. Terrain scaling

Level generation should scale these dimensions over progression:
- map footprint
- terrain relief complexity
- choke point frequency
- water frequency
- number of key resource regions

## Terrain rule
No critical gameplay zone may be isolated beyond reach for ground ants.

That means:
- player nest
- enemy nests
- meaningful food clusters
- key objectives
must all be on traversably connected land regions

---

## 7. Water features

Water includes:
- rivers
- ponds

Rules:
- introduced gradually, not in earliest levels except perhaps tiny safe examples
- blocks ants
- does not block wasps
- should create tactical variety, not broken maps

Generation requirement:
- validate land connectivity after water placement
- repair or regenerate invalid maps

---

## 8. Faction scaling per level

Enemy faction count ramps up over time.

Recommended progression:
- 1 enemy faction early
- 2 factions in some mid levels
- 3+ in later levels
- up to 5 factions around higher-level play

Strength rule:
- enemy starting strength should usually not exceed about 3x the human player's starting ant count per faction unless the level is intentionally special

---

## 9. Player starting state

Default assumptions:
- one starting nest
- small initial ant population
- no queen initially
- no multi-nest setup in early levels

Later levels may vary this if needed, but default campaign structure should begin from one controllable nest.

---

## 10. Food distribution rules

Food should scale by:
- map size
- level difficulty
- number of factions
- expected expansion needs

Design rule:
- food scarcity creates pressure, but starvation should not make levels feel random or hopeless
- there should generally be at least one viable growth route on every level

---

## 11. Time of day

Time of day should be derived from the level seed.

Possible profiles:
- bright day
- warm evening
- overcast daylight
- dusk
- readable night

Night rule:
- never fully dark
- maintain gameplay readability
- nests may radiate light for clarity and mood

---

## 12. Objective rules

### Standard levels
- destroy all required enemy nests

### Wasp levels
- destroy the wasp nest

Future optional objectives can exist later, but the first campaign should keep objective structure simple and consistent.

---

## 13. Wasp level schedule

Every tenth level:
- 10, 20, 30, ... 100
is a wasp battle level.

Wasp level goals:
- provide boss-like cadence
- break up colony-vs-colony rhythm
- raise spectacle and tension

Wasp levels should not all feel identical. Later ones should scale in map complexity and wasp threat.

---

## 14. Persistence rules

At minimum persist:
- highest unlocked level
- completed levels

Optional later:
- best completion stats
- stars/ranks if ever added

Recommended storage:
- browser local storage, versioned

---

## 15. Generation pipeline recommendation

For each level:
1. derive seed from level number
2. derive progression band parameters
3. generate terrain
4. apply water features if enabled
5. compute traversability map
6. validate reachability
7. place player start nest
8. place enemy nests/factions
9. place food clusters
10. assign time of day / palette
11. finalize level definition

If validation fails:
- repair if easy
- otherwise regenerate from seed-derived sub-variation or retry policy

---

## 16. First implementation scope

The first level-system implementation should include only:
- deterministic mapping from level number to seed
- level metadata for 1–100
- size/complexity scaling hooks
- one enemy-faction standard levels
- simple level select unlock flow

Do not block first pass on:
- rivers and ponds
- 5-faction late levels
- advanced objective types
- sophisticated biome variety
