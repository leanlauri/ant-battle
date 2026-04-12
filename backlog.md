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

### Level generation and campaign progression

- [ ] Add broader determinism coverage for runtime simulation paths.
  - Grow tests beyond setup generation so replay-sensitive ant and presentation systems stay locked to level seeds.
  - Docs: `LEVEL_SYSTEM_SPEC.md`, `IMPLEMENTATION_ROADMAP.md`

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

_None._

## Complete

- [x] Extend deterministic runtime randomness coverage beyond the initial ant/effects slice.
  - Thin slice shipped: ant reinforcement spawning now uses its own deterministic `ants-spawn` substream instead of consuming the runtime AI decision stream.
  - Routed upgrade/enemy-production spawn placement and initial per-ant cooldown rolls through that isolated stream, so new runtime ant creation no longer perturbs ongoing AI decision rolls.
  - Added deterministic coverage for seeded spawned batches and updated roadmap/level-system docs to describe the new substream split.

- [x] Route the first ant runtime/effects slice through deterministic level seeds.
  - Split ant randomness into dedicated `ants-setup`, `ants-runtime`, and `ants-effects` substreams so setup stability no longer shifts when moment-to-moment logic changes.
  - Routed idle/wander/patrol-style ant decision rolls and combat aftermath presentation rolls off raw `Math.random` and onto seeded streams.
  - Added automated coverage that replays seeded runtime ant decisions and aftermath effects, and updated level-system/roadmap docs to describe the broader substream model.

- [x] Add deterministic seeded randomness utilities and route initial level setup through them.
  - Added a shared seeded RNG helper with named sub-seeds so level setup systems can consume stable, isolated random streams.
  - Routed food placement/regrowth, enemy role picks, starting ant spawn placement, spawned-ant placement, and enemy production cooldowns through level-derived seeds.
  - Added seed-focused tests that verify identical seeds reproduce identical food and starting-ant setup, and updated roadmap/spec notes to describe substream usage.
  - Left deeper moment-to-moment AI and presentation randomness on the follow-up Todo item.

- [x] Improve upgrade purchase feedback.
  - Added explicit ready, shortfall, and already-active messaging in the compact upgrade detail overlay instead of generic disabled states.
  - Added a short success confirmation toast/status after upgrade confirmation and kept worker/fighter call-up feedback visible.
  - Improved mobile readability by letting upgrade chips wrap and by covering the flow in Playwright on a phone-sized viewport.
  - Updated docs in `IMPLEMENTATION_ROADMAP.md` and `UI_UX_SPEC.md`.

- [x] Add an alternative camera mode, toggleable from the debug menu.
  - Added a hidden debug menu section that can be revealed through the dev API without restoring player-facing debug clutter.
  - Added a battlefield camera mode alongside the existing orbit camera, with one-finger pan, pinch zoom, two-finger orbit, and fixed-pitch constraints.
  - Kept tap targeting reliable by suppressing selection/command clicks during multi-touch gestures.
  - Added e2e coverage for revealing the debug menu and switching camera mode.

- [x] Remove remaining debug-flavoured gameplay presentation from the player-facing HUD.
  - Rewrote title and victory shell copy to sound game-facing instead of prototype-facing.
  - Removed gameplay HUD telemetry rows for camera, terrain, render counts, and build/debug controls, keeping the panel focused on nest state, focus, objective, battle, and food.
  - Kept debug visuals available only through the hidden `window.__ANT_BATTLE_DEV_API__` hook instead of a player-facing toggle.
  - Updated the Playwright smoke test to cover the slimmer HUD and assert the visible debug control is gone.

- [x] Add first boss-level scaffolding for every 10th level.
  - Boss levels now resolve to a deterministic brood-assault profile with tiered pressure values, distinct copy, and shell-facing labels.
  - The target brood nest now gets per-level presentation/HP overrides, while escort nests stay optional victory-agnostic pressure sources.
  - Level select and victory/defeat shell now visibly mark boss stages so every 10th level reads differently even before real wasps exist.
  - Added unit coverage for boss scaling and nest overrides, plus smoke coverage for level-select boss markers.

- [x] Make objective text correspond to real gameplay rule differences, not only flavor text.
  - Added an explicit objective/rules model to level definitions.
  - Wired victory checks and boss pressure rules through that model.
  - Updated HUD and victory copy to reflect the real active objective.
  - Added coverage for normal and boss objective behavior.
