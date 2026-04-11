# Ant Battle Faction and Unit Spec

## Purpose

This document defines unit classes, faction identity, enemy behavior profiles, queen behavior, and wasp faction rules.

---

## 1. Unit design goals

Units should be:
- readable at a glance
- behaviorally distinct
- scalable in large numbers
- simple enough for systemic control rather than heavy per-unit micro

---

## 2. Core unit classes

## Worker

### Role
- food gathering
- economy backbone
- non-combatant

### Behavior
- prioritizes nearby food and hauling
- avoids extended combat if possible
- routes food back to home nest

### Combat
- can die
- does not retaliate

### Visual cues
- practical silhouette
- modest body size
- possibly more pronounced hauling posture

---

## 3. Scout

### Role
- exploration
- map discovery pressure
- identifying distant opportunities and threats

### Behavior
- explores more aggressively than workers
- longer-range attention bias
- helps uncover food/enemy presence for nest focus systems

### Combat
- can die
- does not retaliate

### Visual cues
- lighter/faster silhouette
- agile look

---

## 4. Fighter

### Role
- frontline combat and siege

### Behavior
- responds to enemy presence
- attacks enemy ants
- damages enemy nests in siege range
- acts as nest defender and attacker

### Combat
- attacks and retaliates
- highest standard ant HP

### Visual cues
- chunkier silhouette
- stronger head/mandible feel
- visually obvious combat class

---

## 5. Queen

### Role
- colony expansion
- enables creation of new nests

### Behavior
- created from mature nest via upgrade
- moves to valid settlement point or founds new nest through controlled system
- should not be used as general frontline combatant

### Combat
- can be killed
- may have high HP but weak or minimal attack

### Visual cues
- much larger silhouette
- unmistakable body profile

---

## 6. Player faction

### Identity goals
- easy to track amid chaos
- optimistic readable color treatment
- selected structures especially clear

### Requirements
- player ants use a distinct tint/color
- selected nest outlined in bold light green
- player faction color should remain readable across all times of day

---

## 7. Enemy factions

Enemy factions should share core colony rules but differ in bias.

## Faction profile system
Each faction should have:
- base tint palette
- aggression bias
- production bias
- exploration bias
- defensive bias
- preferred unit mix

### Suggested archetypes
1. **Aggressive raiders**
   - favor fighters
   - attack earlier

2. **Expansionists**
   - prioritize growth and extra nests

3. **Gatherers**
   - economy-heavy, later military surge

4. **Scouting swarm**
   - higher mobility and pressure spread

5. **Defenders**
   - slower, more resilient, hard to crack

These are behavior profiles, not necessarily named lore factions.

---

## 8. Faction count progression

- early campaign: usually 1 enemy faction
- mid campaign: sometimes 2 or 3
- later campaign: up to 5

Readability rule:
- more factions must not create color confusion
- faction palette set should be curated, not random

---

## 9. Unit ownership rules

Each ant belongs to:
- a faction
- a home nest
- a class

This should allow:
- nest-local population counts
- collapse migration handling
- faction-level AI rules

---

## 10. Queen expansion rules

### Unlock condition
- queen becomes available only once nest reaches sufficient maturity/food threshold

### Founding rules
- queen can establish a new friendly nest
- founding location must be traversably valid
- new nest becomes independent for selection and upgrades

### Design preference
For first implementation, queen creation should be explicit and rare.

---

## 11. Wasp faction

## Design goals
- boss-like alternative to ant colony levels
- fewer but stronger units
- aerial threat that ignores many ant constraints

## Wasp properties
- high HP relative to standard ants
- high damage
- can fly over terrain and ant traffic
- may choose not to engage every ant swarm directly

## Wasp behavior
- strike priority targets
- pressure nests directly
- can disengage and reposition quickly

## Wasp nest
- special enemy structure
- objective focus for every tenth level

---

## 12. Visual differentiation rules

Every class and faction combination does not need a fully unique model.

Instead, use a layered visual identity:
- silhouette by class
- tint by faction
- selected-state FX by ownership/selection

This is important for performance and production scope.

---

## 13. First implementation scope

First unit/faction implementation should include only:
- worker / scout / fighter class separation
- player tint vs enemy tint
- one or two enemy faction behavior profiles
- selected nest outline

Do not block first pass on:
- queen implementation
- 5 faction balancing
- wasps
- advanced faction personalities
