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

### Immediate UI fixes

### Level generation and campaign progression

- [ ] Continue sweeping any remaining replay-sensitive runtime paths beyond the currently covered live simulation interactions.
  - Keep follow-up slices narrow and focused on one live simulation interaction at a time.
  - Remaining thin slices should target specific uncovered live decision branches, not broad audit-only passes.
  - Remaining gaps should prioritize post-spawn runtime behavior, so reinforcement placement stays on `ants-spawn` while later live decisions stay on `ants-runtime`.
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

- [x] Add live-runtime deterministic coverage for spawned worker focus-target routing and spawned enemy fighter pressure decisions.
  - Thin slice under the broader replay-sensitive runtime sweep.
  - Added a live-runtime harness that manually spawns a player worker reinforcement and enemy fighter reinforcements, then snapshots their first post-spawn focus-target and near-hostile pressure decisions during the normal gameplay update order.
  - Confirmed those spawned branch choices stay stable when only `food`, `enemy-economy`, `ants-spawn`, or `ants-effects` seeds change, while `ants-runtime` changes still diverge them.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this post-spawn focus/pressure coverage.


- [x] Add live-runtime deterministic coverage for the enemy fighter pressure-roll fallback branch when a hostile nest still exists.
  - Added a live-runtime harness that keeps a hostile player nest available while placing an enemy fighter inside pressure radius, then snapshots the first seeded patrol-versus-pressure decision during the normal gameplay update order.
  - Confirmed that this near-hostile pressure fallback stays isolated from `food`, `enemy-economy`, `ants-spawn`, and `ants-effects`, while `ants-runtime` changes still flip the branch between patrol and direct pressure.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this near-hostile enemy-pressure fallback coverage.

- [x] Add live-runtime deterministic coverage for target-arrival fallback reselection.
  - Added a live-runtime harness that forces a player worker and fighter to complete their current movement targets during the normal gameplay update order, immediately exercising the logic-path `chooseNextAction` fallback that follows target arrival.
  - Confirmed those arrival-driven reselections stay stable when unrelated `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` seeds change, while `ants-runtime` changes still diverge them as expected.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this target-arrival fallback coverage.

- [x] Add live-runtime deterministic coverage for invalidated worker food-target and assist-carry fallback reselection.
  - Added a live-runtime harness that forces workers to lose a tracked food target and an assist-carry target during the normal gameplay update order, then snapshots their immediate seeded fallback choices.
  - Fixed both runtime fallback branches so they keep using the seeded `ants-runtime` stream instead of silently falling back to unseeded randomness.
  - Confirmed those fallback outcomes stay stable when unrelated `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` seeds change, while `ants-runtime` changes still diverge them.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this invalidated-target worker coverage.

- [x] Add live-runtime deterministic coverage for worker idle-versus-wander fallback and fighter patrol fallback decisions.
  - Added a live-runtime harness that runs the normal gameplay update order while an unfocused player worker resolves its idle-versus-wander fallback and an unfocused player fighter resolves its patrol fallback.
  - Confirmed those background brain-path outcomes stay stable when unrelated `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` seeds change, while `ants-runtime` changes still diverge them as expected.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this fallback-decision coverage.

- [x] Add live-runtime deterministic coverage for enemy fighter patrol fallback when no hostile nest remains.
  - Added a live-runtime harness that collapses the only hostile nest before the normal gameplay update order runs, forcing an enemy fighter onto its no-target patrol fallback while food regrowth and enemy production still tick.
  - Confirmed that fallback patrol outcome stays stable when unrelated `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` seeds change, while `ants-runtime` changes still diverge it as expected.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this enemy-fighter patrol-fallback coverage.

- [x] Add live-runtime deterministic coverage for siege-driven nest collapse and migration aftermath.
  - Added a live-runtime harness that drives a real fighter siege into enemy nest collapse while food regrowth and enemy production still run in the normal gameplay update order.
  - Confirmed the killed subset, fallback colony reassignment, and collapse outcome stats stay stable when unrelated `food`, `enemy-economy`, `ants-spawn`, and `ants-runtime` seeds change, while collapse-side presentation still diverges only on `ants-effects`.
  - Updated `LEVEL_SYSTEM_SPEC.md`, `COMBAT_AND_NEST_SPEC.md`, and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this collapse-and-migration coverage.

- [x] Keep spawned reinforcement ants on `ants-runtime` for their first live fallback decisions.
  - Thin slice under the broader replay-sensitive runtime sweep.
  - Fixed spawned reinforcements so `ants-spawn` still owns placement and spawn-time variation, but later live fallback decisions come from per-ant `ants-runtime` substreams instead of continuing to consume spawn-placement randomness.
  - Added deterministic live-runtime coverage that proves spawned-ant fallback decisions diverge with `ants-runtime` changes and stay stable when only `ants-spawn` changes.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to document the post-spawn runtime split.

- [x] Add live-runtime deterministic coverage for player focus-target routing and enemy fighter pressure decisions.
  - Added a live-runtime harness that exercises real player focus-target influence plus seeded enemy fighter pressure-versus-patrol choice under the normal gameplay update order while food regrowth and enemy production also run.
  - Confirmed those decision-path outcomes stay stable when unrelated `food`, `enemy-economy`, `ants-spawn`, and `ants-effects` seeds change, while `ants-runtime` changes still diverge them as expected.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this focus-and-pressure coverage.

- [x] Add live-runtime deterministic coverage for carried-food support and delivery interactions.
  - Added a live-runtime harness that exercises real worker claim, assist-carry, and nest delivery flow under the normal gameplay update order while enemy production also runs.
  - Confirmed those carried-food interactions stay stable when unrelated `enemy-economy`, `ants-spawn`, `ants-runtime`, and `ants-effects` seeds change, while delivery-triggered regrow timing still diverges on the `food` stream.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so the replay model now explicitly includes this carry-and-delivery coverage.

- [x] Fix battlefield camera foreground occlusion from terrain or horizon geometry.
  - Softened terrain relief near the outer rim so the raised white horizon geometry no longer swells into the lower battlefield view during tactical zoom.
  - Tightened battlefield edge clamping as orthographic zoom increases, preserving the current 45 degree tilt, rotation, targeting, and close-inspection feel while keeping the camera off problematic foreground edges.
  - Added terrain coverage for the new rim attenuation behavior and updated `UI_UX_SPEC.md` plus `IMPLEMENTATION_ROADMAP.md` so the camera-safe horizon treatment is documented.

- [x] Fix battlefield camera clipping at the bottom of the screen.
  - Re-biased the orthographic battlefield frustum slightly toward the lower screen edge instead of keeping it perfectly centered, so close tactical zoom keeps more foreground battlefield visible.
  - Expanded the orthographic near/far safety range to reduce projection clipping during close inspection and target-focused camera movement.
  - Added end-to-end coverage that asserts the tactical camera keeps the new lower-screen frustum bias and clipping-plane range while preserving the existing 45 degree tilt, zoom, and rotation behavior.
  - Updated `UI_UX_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to describe the foreground-safe tactical framing.

- [x] Add live-runtime deterministic coverage for ant decisions and combat aftermath stream isolation.
  - Added a seeded live-runtime harness that runs the normal gameplay update order while a worker consumes real `ants-runtime` decision rolls and a fighter kill triggers real `ants-effects` aftermath.
  - Confirmed `ants-runtime` and `ants-effects` remain isolated from `food`, `enemy-economy`, and `ants-spawn` seed changes, while the relevant owning streams still diverge as expected.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to document the broader live-runtime replay coverage.

- [x] Refine battlefield camera controls for tactical play.
  - Battlefield mode now locks to a true 45 degree downward orthographic tactical tilt instead of the earlier shallower offset.
  - Two-finger battlefield gestures can rotate around the current camera target while keeping target stability, pinch zoom, and tap targeting intact.
  - Increased the maximum close-in battlefield zoom so players can inspect combat much nearer to the ants.
  - Added end-to-end coverage for fixed 45 degree pitch, target-stable battlefield rotation, and the tighter close-zoom clamp.
  - Updated `UI_UX_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to document the refined controls.

- [x] Add deterministic integration coverage for remaining runtime stream interactions.
  - Thin slice shipped: a live runtime integration test now runs delivered-food regrowth alongside enemy production timing and seeded reinforcement spawning, mirroring the gameplay update order.
  - Verified that changing the `food` seed only changes regrowth results, while changing the `ants-spawn` seed only changes spawned ant placement, keeping the streams isolated during live simulation.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to document the broader cross-stream runtime coverage.

- [x] Correct battlefield camera diagonal framing to use x-axis tilt, not y-axis yaw.
  - Replaced the sideways battlefield-camera offset with a plan-aligned orthographic tilt so the tactical view no longer yaws across the map.
  - Kept the closer zoom range, stable pan clamping, and tap-targeting behavior intact while making the framing read as a forward tilt instead of an angled orbit.
  - Updated the Playwright camera assertion and refreshed `UI_UX_SPEC.md` plus `IMPLEMENTATION_ROADMAP.md` to describe the corrected plan-aligned tilt.

- [x] Show the active player nest food count in the gameplay HUD and upgrade UI.
  - Added a dedicated gameplay top-bar readout for the selected player nest's stored food instead of leaving it only in the expanded HUD copy.
  - Mirrored that same stored-food value in the nest upgrade panel so affordability is visible before reading per-card detail text.
  - Extended Playwright coverage to assert both HUD and upgrade-panel food readouts update as nest storage changes, and hardened the smoke tests by clearing persisted campaign progress at boot.
  - Updated `UI_UX_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to document the explicit stored-food readouts.

- [x] Make enemy nest selection visibly readable.
  - Tapping an enemy nest as the active focus target now also lights that nest with a clear world-space target ring, instead of only dropping a generic focus marker nearby.
  - Raised the ring presentation above terrain with depth-disabled rendering and stronger opacity so enemy target feedback stays readable on varied ground.
  - Added automated coverage for focused enemy-nest ring visibility and documented the expected enemy-target highlight behavior in `UI_UX_SPEC.md`.

- [x] Refine the orthographic battlefield camera framing.
  - Tilted the battlefield camera into a slight diagonal orthographic view instead of a near-straight top-down look.
  - Extended the battlefield zoom range so players can get closer without giving up targeting or HUD flow.
  - Added zoom-aware battlefield pan bounds tied to the active terrain footprint so close mobile framing stays stable on the map.
  - Added e2e coverage for the diagonal framing plus close-zoom clamp behavior, and updated `UI_UX_SPEC.md` plus `IMPLEMENTATION_ROADMAP.md` to document the refined camera behavior.

- [x] Refine the battlefield camera into a steeper orthographic tactical view.
  - Switched the gameplay HUD battlefield mode from a locked perspective view to a steeper orthographic tactical camera, improving map readability.
  - Re-tuned battlefield framing and zoom bounds around the orthographic projection while keeping tap targeting and focus assignment working through the active camera.
  - Added e2e coverage that asserts battlefield mode now flips the live gameplay camera to orthographic, and updated `UI_UX_SPEC.md` plus `IMPLEMENTATION_ROADMAP.md` to document the new camera behavior.

- [x] Make the alternative camera toggle visible and reachable in the UI.
  - Moved the battlefield/orbit camera switch into the always-visible gameplay top bar instead of leaving it behind the hidden debug menu.
  - Added a readable live camera-mode label to the status card so players/testers can confirm the current mode at a glance.
  - Updated the gameplay smoke test to switch cameras through the real HUD control and documented the player-facing camera access expectation in `UI_UX_SPEC.md` and `IMPLEMENTATION_ROADMAP.md`.

- [x] Add deterministic integration coverage for remaining runtime stream interactions.
  - Thin slice shipped: live enemy production plus real `AntSystem.spawnAntBatch` wiring is now covered by deterministic tests.
  - Confirmed production timing stays locked to the `enemy-economy` stream while spawned-ant placement remains isolated on `ants-spawn`.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to document the new integration coverage.

- [x] Add deterministic gameplay-session coverage for seeded enemy economy runtime paths.
  - Extracted the runtime enemy production step into a shared module so gameplay-session behavior can be replay-tested without browser scaffolding.
  - Added deterministic coverage for seeded enemy production cooldown timing and initial cooldown derivation, keeping enemy colony growth locked to the `enemy-economy` stream.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` to document the replay-stable enemy economy coverage.


- [x] Add deterministic runtime coverage for seeded food regrowth paths.
  - Added unit coverage that replays delivered food regrowth from the same level `food` stream and verifies different seeds diverge.
  - Updated `LEVEL_SYSTEM_SPEC.md` and `IMPLEMENTATION_ROADMAP.md` so food regrowth is explicitly documented as part of the seeded replay model.

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
