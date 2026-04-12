# Ant Battle Combat and Nest Spec

## Purpose

This document defines combat rules, HP systems, nest damage, collapse behavior, migration, and loss conditions.

The goal is to keep combat readable, scalable, and compatible with large ant counts.

---

## 1. Combat philosophy

- combat should be systemic, not cinematic per unit
- fighter ants do the fighting
- workers and scouts are vulnerable but do not retaliate
- nests are strategic objectives, not decoration
- collapse events should matter materially and emotionally

---

## 2. Unit combat roles

## Worker
- can be attacked
- can die
- does not attack
- does not retaliate

## Scout
- can be attacked
- can die
- does not attack
- does not retaliate

## Fighter
- can attack enemy ants
- can retaliate when engaged
- can attack enemy nests

## Queen
- combat-light or non-combat by default
- can be killed
- should not be a frontline fighter

---

## 3. Unit health model

Each ant unit has:
- max HP
- current HP
- faction owner
- class
- optional attack cooldown
- optional death state timer

## Relative durability
Default tuning direction:
- scout: lowest HP
- worker: low HP, slightly sturdier than scout or similar
- fighter: clearly highest ant HP
- queen: high HP but not strong attacker

Exact values are tuning data, not design constants.

---

## 4. Attack model

Recommended base model:
- melee attack range
- attack cooldown per fighter
- fixed or lightly varied damage per hit
- nearest valid target priority

## Fighter targeting priority
Suggested default:
1. enemy fighters threatening same area
2. enemy workers/scouts if in range
3. enemy nest if siege state reached and no higher-priority target nearby

This can be faction-biased later.

---

## 5. Ant death handling

When an ant reaches 0 HP:
1. mark as dead immediately for gameplay logic
2. remove from active simulation or combat participation
3. play short death/fall-apart animation if visible nearby
4. stamp corpse/blood aftermath into battlefield overlay system
5. remove live mesh once death presentation completes

## Stats impact
Deaths should contribute to:
- enemy ants defeated count
- current colony population reduction

---

## 6. Nest health model

Each nest has:
- max health
- current health
- food storage
- faction owner
- collapse state

## Nest damage source
- enemy fighters damage nests slowly when they reach siege range
- workers/scouts should not damage nests meaningfully
- wasps may use separate stronger siege values later

## Siege model
Recommended:
- continuous attack cycle by nearby enemy fighters
- per-fighter attack cadence
- total siege damage scales with number of attackers but should remain balanceable

---

## 7. Nest repair model

Nest health can be restored via food.

Recommended first implementation:
- passive repair is too opaque
- prefer explicit or semi-explicit repair tied to upgrade/action economy

Preferred baseline:
- selected nest can receive a repair option when damaged and sufficiently stocked with food
- later, optional slow passive repair may be added on top

---

## 8. Nest collapse

When nest health reaches zero:
- nest enters collapsed state
- collapsed nest stops functioning as active colony structure
- it can no longer spawn upgrades or route ants normally

## Immediate collapse consequences
- one third of ants belonging to that nest die immediately
- surviving ants attempt to migrate to nearest friendly active nest

## Rounding rule
Recommended:
- use floor for deaths, minimum 1 if population > 0 and collapse occurs
- exact implementation can be adjusted for fairness

---

## 9. Migration after collapse

When a nest collapses, surviving ants:
1. find nearest friendly active nest
2. transfer allegiance/home nesting to that nest
3. travel or rebind according to performance-friendly implementation

## Recommended first implementation
Use immediate reassignment rather than literal migration travel.

Reason:
- simpler
- clearer
- less likely to create edge-case failures

Implementation note:
- keep deterministic live-runtime coverage around siege-triggered collapse so the killed subset, fallback reassignments, and collapse-state updates remain replay-stable for a level seed
- keep collapse-side splats, corpse remains, and hit presentation isolated on the dedicated effects stream so presentation can vary without perturbing structural outcomes

Later, a visual migration effect can be added.

## If no friendly nest exists
- all surviving ants are lost
- this typically coincides with game over for the player

---

## 10. Player defeat

Player loses when:
- their final active nest collapses

## Defeat sequence requirements
- stop normal gameplay
- show game over overlay
- show at least:
  - max ants reached
  - enemy ants defeated
- show retry prompt: `Tap to try again`

---

## 11. Player victory

Standard colony levels:
- win when all required enemy nests are destroyed

Wasp levels:
- win when the wasp nest is destroyed

---

## 12. Combat scalability rules

To keep combat scalable:
- avoid expensive pairwise combat checks across all ants
- use local spatial partitioning already present in the simulation
- keep attack logic near local-neighbor scale
- do not use heavy per-unit pathfinding for combat micro
- keep death aftermath in textures/overlays instead of persistent corpse meshes

---

## 13. Suggested first-pass tuning direction

These are design directions, not final values.

### Worker
- low HP
- no attack

### Scout
- very low HP
- no attack
- faster movement

### Fighter
- highest ant HP
- moderate melee damage
- short attack cooldown
- moderate nest siege damage

### Nest
- enough HP to survive small raids
- not so much HP that siege feels pointless

### Repair
- meaningful food cost
- should feel like a strategic tradeoff vs spawning more ants

---

## 14. Edge case rules

### If a nest is under attack while selected
- selection remains active until collapse
- if it collapses, selection clears or moves to nearest surviving friendly nest

### If multiple nests collapse at once
- process collapse events deterministically, recommended by stable nest id order

### If ants are carrying food when their home nest collapses
- reroute them to nearest friendly nest if available
- otherwise food is dropped or lost, recommended: drop to world for clarity if easy, else discard for simplicity

---

## 15. First implementation scope

First combat+nest pass should include only:
- HP for ants
- fighters attack and retaliate
- nest HP
- fighter siege damage
- nest collapse
- one-third ant death
- nearest-friendly-nest reassignment
- defeat screen stats

Do not block first pass on:
- fancy death effects
- queen combat nuances
- repair polish
- wasp combat
- detailed per-class special abilities
