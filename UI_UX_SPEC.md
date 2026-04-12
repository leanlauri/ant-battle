# Ant Battle UI / UX Spec

## Purpose

This document defines the player-facing interface and interaction model for Ant Battle.

It is intentionally mobile-first. Desktop support should exist, but mobile clarity drives the design.

---

## 1. UX principles

1. **Tap-first clarity**
   - primary interactions must work with large touch targets
   - avoid tiny controls and dense HUDs

2. **Few modes, obvious state**
   - player should always know whether they are on title, level select, gameplay, victory, or defeat
   - selected nest and actionable upgrades must be unmistakable

3. **Minimal text during gameplay**
   - use icons, counts, outlines, and large cards
   - reserve explanatory text for menus and overlays

4. **Readable over beautiful**
   - if an effect hurts gameplay legibility, reduce it

---

## 2. Screen map

The game should have these top-level screens:

1. Title screen
2. Level select screen
3. Gameplay HUD
4. Pause/menu overlay (later)
5. Victory screen
6. Game over screen

---

## 3. Title screen

## Goals
- establish identity immediately
- launch with one tap
- look alive even before gameplay begins

## Required elements
- title text: `Ant Battle`
- large CTA: `Tap to Start`
- animated or semi-animated background
- optional subtle version/build label in a corner

## Layout
- center title vertically in upper-middle region
- center CTA below it with generous spacing
- keep layout safe for portrait mobile screens

## Behavior
- tap anywhere or tap CTA starts level select
- no extra confirmation

---

## 4. Level select screen

## Goals
- make campaign progression obvious
- keep 100 levels readable without overwhelming the player

## Structure
- show 20 levels per page
- support page groups: `1–20`, `21–40`, `41–60`, etc.
- left/right arrows for page switching
- swipe navigation is optional later

## Level card states

### Completed
- visually marked as defeated/completed
- remains selectable

### Open
- the next undefeated level
- selectable
- visually highlighted

### Locked
- future levels not yet available
- visible but disabled

## Required elements
- page title or range label
- level grid
- page navigation arrows
- back button to title screen or not needed if app flow is simple, optional

## Mobile layout guidance
- grid should favor large tap targets over density
- likely 4 columns × 5 rows in portrait if readable
- if that is too dense, use 3 columns with scrolling, but prefer no scroll if possible

## Recommended level card contents
- level number
- completion mark if beaten
- optional special icon for wasp levels every tenth level

---

## 5. Gameplay HUD

## Goals
- show only important information
- stay out of the way of the battlefield
- keep selected-nest actions easy to reach

## Required persistent HUD elements

### Top right
- prominent player ant count

Recommended format:
- large number
- ant icon or simple label
- optional secondary line later for fighters or food

### Top center / upper area
- upgrade cards when selected nest has options available
- cards should appear only when actionable

### Selected nest feedback
- selected nest gets bold light-green outline
- optional glow ring and soft pulse

### Focus target feedback
- when player taps terrain after selecting nest, show a visible focus marker
- marker should be readable on all terrain palettes

## Optional later HUD additions
- pause/menu button
- current level label
- enemy ant defeated count
- selected nest food amount

## Camera access
- the alternative battlefield camera must be reachable from the normal gameplay HUD, not only through hidden developer controls
- show the current camera mode in readable text
- provide a large tap target that switches between orbit and battlefield camera without opening a debug menu
- the battlefield camera should favor a steeper tactical read than the orbit camera, and may use orthographic projection if that improves map legibility without harming touch targeting

---

## 6. Upgrade card UI

## Goals
- make upgrades feel meaningful and exciting
- keep actions easy to tap quickly

## Rules
- show at most 3 upgrade choices at once
- cards/icons must be large enough for thumbs
- cards appear only when selected nest qualifies

## Required card content
- icon
- short title
- one-line benefit summary
- cost or threshold cue

## Examples
- `+20 Workers`
- `+20 Scouts`
- `+20 Fighters`
- `Create Queen`
- `Restore Nest`

## Placement
- near the top of the screen
- not covering the selected nest itself if possible
- should not obscure top-right ant count

## Behavior
- tapping card applies upgrade immediately
- card disappears if no longer affordable/available
- use short confirmation feedback, visual pulse or pop
- when a card is selected, the compact detail overlay should explain whether it is ready, short on food, or already active
- unavailable states should say exactly what is missing rather than only disabling the confirm button

---

## 7. Nest selection interaction

## Primary interaction flow
1. Tap a player nest
2. Nest becomes selected
3. If upgrades are available, show cards
4. Tap terrain to assign nest focus there

## Selection rules
- only one nest selected at a time
- tapping another player nest switches selection
- tapping empty world does not deselect if command is valid, it issues a focus command
- tapping non-interactive HUD should not affect selection

## Invalid taps
- tapping enemy nest should not select it as player-owned
- may optionally show enemy highlight or info later

---

## 8. Camera interaction

## Mobile
Recommended baseline:
- tap on nest or terrain for game commands
- pinch to zoom
- orbit camera may use two-finger drag for orbiting if needed
- battlefield camera should prioritize simple tactical movement, with one-finger pan and pinch zoom over free rotation

Avoid single-finger camera drag at first if it conflicts with tap-to-command clarity.

If single-finger drag is added later, it must be carefully separated from tap gestures.

## Desktop
- click for selection and commands
- drag to orbit/pan
- wheel to zoom

---

## 9. Victory screen

## Required elements
- message: `Level Complete` or similar
- summary stats
- next level CTA
- level select CTA

## Minimum stats
- ants survived or max ants reached
- enemy ants defeated
- level number

---

## 10. Game over screen

## Required elements
- message indicating defeat
- `Tap to try again`
- stats block

## Required stats
- max number of ants reached
- enemy ants defeated

## Behavior
- tap anywhere retries current level or returns to retry CTA if desired
- should feel fast, not punitive

---

## 11. Accessibility and readability

## Requirements
- strong contrast on text over backgrounds
- touch targets large enough for phones
- color should not be sole indicator of state
- selected nest should use both color and shape/outline
- completed/open/locked level states should differ by iconography and opacity, not just hue

---

## 12. Visual hierarchy summary

During gameplay, priority order is:
1. selected nest and its upgrades
2. player ant count
3. battlefield threats and targets
4. atmospheric visuals
5. secondary debug or informational UI

---

## 13. First implementation scope

The first UI implementation pass should include only:
- title screen
- level select screen
- top-right ant count
- selected nest outline
- focus target marker
- simple upgrade card layout shell
- victory/game over overlays

Do not block first UI pass on:
- animation polish
- full icon set
- audio
- pause menu
- advanced gesture handling
