---
title: Ant Battle backlog
purpose: Remaining implementation work for the Ant Battle project, used as the source of truth for autonomous development passes.
repo: /home/lauri/.openclaw/workspace/coding/ant-battle
branch: main
main_game_dir: game
primary_docs:
  - ANT_BATTLE_SPEC.md
  - IMPLEMENTATION_ROADMAP.md
  - LEVEL_SYSTEM_SPEC.md
  - COMBAT_AND_NEST_SPEC.md
  - UI_UX_SPEC.md
  - FACTION_AND_UNIT_SPEC.md
working_rules:
  - Keep main playable at all times.
  - Prefer small vertical slices over wide rewrites.
  - Before coding, move exactly one top Todo item into In Progress unless another item is already there.
  - If an item is too large, split it into smaller Todo items and only take the first thin slice.
  - Run relevant checks before finishing. Prefer `npm run validate` and `npm run test:e2e` from `game/` when gameplay code changes.
  - Commit and push finished work to `origin/main`.
  - After completion, move the item to Complete and add any newly discovered follow-up work back into Todo.
notes:
  - Current project state is past the first upgrade-card/economy pass, with player nest selection, combat, nest health, defeat/victory states, deterministic level bands, and world-anchored nest upgrade UI already in place.
  - Near-term direction from the roadmap is: make objectives change real rules, remove remaining debug-flavoured presentation, and add boss-level scaffolding for every tenth level.
  - Key code areas: `game/src/main.js`, `game/src/gameplay-session.js`, `game/src/ant-system.js`, `game/src/food-system.js`, `game/src/level-definition.js`, `game/src/level-setup.js`, `game/src/terrain.js`.
---

# Ant Battle backlog

This file tracks the remaining work needed to bring Ant Battle from the current playable prototype into a fuller campaign game.

Use this as the canonical queue for autonomous work. The top item in **Todo** is the next thing to pick up, unless something already sits in **In Progress**.

## Todo

### Immediate gameplay and UX slices

- [ ] Make objective text correspond to real gameplay rule differences, not only flavor text.
  - Add an explicit objective/rules model to level definitions.
  - Drive victory conditions and scenario rules from that model.
  - Ensure HUD/objective copy reflects the real rules in play.
  - Docs: `IMPLEMENTATION_ROADMAP.md`, `LEVEL_SYSTEM_SPEC.md`

- [ ] Add first boss-level scaffolding for every 10th level.
  - Replace the current boss placeholder with a real special-case ruleset.
  - Give boss levels distinct objective copy, setup pressure, and presentation cues.
  - Do this in a way that can later evolve into a real wasp faction.
  - Docs: `IMPLEMENTATION_ROADMAP.md`, `LEVEL_SYSTEM_SPEC.md`, `FACTION_AND_UNIT_SPEC.md`

- [ ] Remove remaining debug-flavoured gameplay presentation from the player-facing HUD.
  - Audit labels, copy, panel names, hidden test hooks, and shell text.
  - Keep dev/test affordances only where they are invisible to normal play.
  - Docs: `IMPLEMENTATION_ROADMAP.md`, `UI_UX_SPEC.md`

- [ ] Improve upgrade purchase feedback.
  - Add clear success feedback when an upgrade is confirmed.
  - Make unavailable states and shortfalls read clearly in the compact overlay.
  - Check mobile readability and touch behavior.
  - Docs: `IMPLEMENTATION_ROADMAP.md`, `UI_UX_SPEC.md`

- [ ] Add level-card special iconography and shell treatment for every 10th level.
  - Mark boss levels in level select.
  - Distinguish them in victory/defeat/title-to-level-select presentation where useful.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `UI_UX_SPEC.md`

### Level generation and campaign progression

- [ ] Add deterministic seeded randomness utilities and route level setup through them.
  - Remove accidental nondeterminism from level generation/setup where practical.
  - Make the same level number reproduce the same base scenario.
  - Add tests that verify determinism.
  - Docs: `LEVEL_SYSTEM_SPEC.md`

- [ ] Replace coarse level bands with a richer deterministic level-definition model.
  - Expand per-level generated fields beyond enemy nest count, budget, and atmosphere.
  - Add explicit map size tiers, terrain complexity ramps, and food distribution settings.
  - Keep level replays deterministic by seed.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Add campaign-safe terrain scaling.
  - Scale map footprint, relief complexity, choke points, and key resource regions across level progression.
  - Keep early levels simpler and later ones broader.
  - Docs: `LEVEL_SYSTEM_SPEC.md`

- [ ] Add water features with reachability safeguards.
  - Introduce ponds and rivers gradually.
  - Mark blocked vs traversable terrain for ants.
  - Validate that player nest, enemy nests, and key food remain connected.
  - Repair or regenerate invalid maps.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

### Enemy AI, factions, and strategic variety

- [ ] Tune enemy economy and production pacing across the campaign.
  - Revisit worker/fighter ratios, spawn timing, starting budgets, and snowball behavior.
  - Keep early levels teachable and late levels intense but fair.
  - Docs: `IMPLEMENTATION_ROADMAP.md`

- [ ] Introduce explicit enemy faction behavior profiles.
  - Move from a single simple enemy doctrine to named profile data with biases.
  - Support aggression, economy, exploration, and defense differences.
  - Keep it lightweight and scalable.
  - Docs: `FACTION_AND_UNIT_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Make enemy strategic behavior respond to faction profiles.
  - Production mix, defense timing, attack timing, and target preferences should vary by profile.
  - Avoid expensive per-ant planning.
  - Docs: `FACTION_AND_UNIT_SPEC.md`, `COMBAT_AND_NEST_SPEC.md`

- [ ] Expand later levels into true multi-faction encounters.
  - Scale from early one-enemy maps toward later 3 to 5 faction maps.
  - Preserve readability with curated palettes and pressure tuning.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `FACTION_AND_UNIT_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

### Combat, aftermath, and nest systems

- [ ] Add visible death/aftermath presentation for ant combat.
  - Add lightweight death breakup or fall animation.
  - Stamp corpse/blood aftermath into a persistent battlefield overlay instead of leaving live meshes.
  - Docs: `COMBAT_AND_NEST_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Refine combat targeting priorities and siege behavior.
  - Better reflect the intended fighter target ordering.
  - Make nest sieges readable and balanceable.
  - Docs: `COMBAT_AND_NEST_SPEC.md`

- [ ] Improve nest collapse presentation and migration feedback.
  - Make collapse events feel visible and consequential.
  - Consider selection handoff, migration cues, and dropped/lost food behavior.
  - Docs: `COMBAT_AND_NEST_SPEC.md`

- [ ] Add optional slow passive repair or richer repair decisions if the explicit repair baseline feels too opaque or too fiddly.
  - Reassess after more campaign tuning.
  - Docs: `COMBAT_AND_NEST_SPEC.md`

### Colony expansion and unit roster

- [ ] Reintroduce scouts only if they earn a real gameplay role.
  - If restored, give them meaningful exploration pressure and readable differentiation.
  - If not, update specs/docs to reflect the permanent roster.
  - Docs: `FACTION_AND_UNIT_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Add queen unlocks and queen creation upgrade.
  - Define unlock conditions and upgrade presentation.
  - Keep first implementation explicit and rare.
  - Docs: `FACTION_AND_UNIT_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Add multi-nest player expansion.
  - Queen travel/founding or an equivalent controlled founding model.
  - Support multiple player nests, per-nest upgrades, and selection clarity.
  - Docs: `FACTION_AND_UNIT_SPEC.md`, `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Strengthen per-nest command independence once multi-nest play exists.
  - Preserve clear focus targeting and upgrade ownership per nest.
  - Docs: `IMPLEMENTATION_ROADMAP.md`, `UI_UX_SPEC.md`

### Boss content and campaign completion

- [ ] Implement the real wasp faction and wasp nest.
  - Add wasp unit model, stronger combat stats, and aerial behavior.
  - Boss levels should target the wasp nest explicitly.
  - Docs: `FACTION_AND_UNIT_SPEC.md`, `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Add airborne movement/pathing rules for wasps.
  - Wasps should ignore normal ant terrain restrictions.
  - Preserve clarity and performance.
  - Docs: `FACTION_AND_UNIT_SPEC.md`

- [ ] Create escalating boss-level templates for levels 10, 20, 30, and onward.
  - Make them distinct in threat shape, map setup, and spectacle.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Fill and tune the full 1 to 100 campaign.
  - Smooth progression bands.
  - Verify unlock flow and level pacing.
  - Ensure no impossible or obviously unfair seeds.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

### Presentation, atmosphere, and shell polish

- [ ] Add time-of-day-driven palette and lighting variation beyond the current baseline.
  - Improve atmosphere while keeping readability.
  - Add nest glow/radiance where useful at darker times.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Add a real pause/menu overlay.
  - Keep it mobile-friendly and unobtrusive.
  - Docs: `UI_UX_SPEC.md`

- [ ] Polish title, level-select, victory, and defeat shell content.
  - Make the game feel fully game-facing instead of prototype-facing.
  - Improve stats summaries and action wording.
  - Docs: `UI_UX_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

### Testing, balancing, and engineering quality

- [ ] Add deterministic seed tests for level generation and scenario setup.
  - Cover terrain/setup generation paths, not only level-definition data.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

- [ ] Expand e2e coverage beyond the current smoke test.
  - Cover gameplay loss, upgrade flow, and at least one boss-level flow once scaffolding exists.
  - Docs: `IMPLEMENTATION_ROADMAP.md`

- [ ] Add combat and collapse rule tests for edge cases.
  - Target nest destruction, reassignment, defeat triggers, and siege behavior.
  - Docs: `COMBAT_AND_NEST_SPEC.md`

- [ ] Track and improve performance under larger colony sizes.
  - Watch mobile FPS, combat targeting cost, overlay update cost, and later multi-faction growth.
  - Prefer scalable systems over expensive micro logic.
  - Docs: `IMPLEMENTATION_ROADMAP.md`

- [ ] Add balancing notes and telemetry-style tuning support if needed.
  - Make it easier to tune campaign pacing without guesswork.
  - Docs: `IMPLEMENTATION_ROADMAP.md`

## In Progress

- [ ] Make objective text correspond to real gameplay rule differences, not only flavor text.
  - Add an explicit objective/rules model to level definitions.
  - Drive victory conditions and scenario rules from that model.
  - Ensure HUD/objective copy reflects the real rules in play.
  - Docs: `IMPLEMENTATION_ROADMAP.md`, `LEVEL_SYSTEM_SPEC.md`

## Complete

_None tracked here yet. Earlier completed work remains documented in `IMPLEMENTATION_ROADMAP.md` and git history._
