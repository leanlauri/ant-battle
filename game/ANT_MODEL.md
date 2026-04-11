# Ant Model

## Overview

Each ant is a lightweight local agent with:
- a simulated body position on the terrain
- a visual 3D ant mesh (or impostor at distance)
- local state such as role, action, target, timers, and carrying state

The current system is designed for large numbers of ants rather than detailed per-ant physics.

## Ant state

Implemented in `src/ant-system.js`.

Each ant tracks:
- `position`, `velocity`, `heading`
- `role`
- `action`
- `target`
- `targetFoodId`
- `carryingFoodId`
- `queuedNestSlot`
- brain and logic cooldowns
- LOD band (`near`, `mid`, `far`)

## Roles

Current roles:
- `scout`
- `forager`
- `worker`

Roles are simple biases, not fully separate behavior trees yet.

At the moment they mainly affect:
- wandering tendencies
- how strongly ants behave as explorers vs practical workers

## Core behavior loop

Ants operate with action persistence:
- the **brain** chooses or updates an action less frequently
- the **movement/logic** layer continues executing the current action between brain ticks

This keeps motion smooth even when distant ants update less often.

## Main actions

Current actions include:
- `wander`
- `idle`
- `seek-food`
- `carry-food`
- `follow-pheromone`

## Food behavior

Implemented across `src/food-system.js` and `src/ant-system.js`.

Behavior:
1. Ant senses nearby food directly
2. Multiple ants may pursue the same food
3. First ant to physically reach it picks it up
4. Carrying ant slows down
5. Carrying ant moves toward a reserved nest queue slot
6. At the nest, food is dropped and added to nest storage
7. Delivered food regrows later at a new random position

## Nest model

The nest currently has:
- a central location
- a visual mesh
- stored food count
- queue slots around the entrance area

Queue slots are used so carrying ants do not all try to enter the exact same point.

## Pheromones

Implemented in `src/pheromone-system.js`.

Current pheromone model:
- grid-based field, not per-particle trails
- food pheromones are deposited by ants carrying food
- home pheromones are deposited by workers
- pheromones evaporate over time
- ants can sample nearby cells to bias movement direction

This is intentionally lightweight so it scales to many ants.

## Terrain interaction

Ants are grounded by sampling terrain height from `src/terrain.js`.
They do not use full rigid-body collision.
The ant body is approximated as a sphere-style body for simple movement and separation.

## Performance model

To support many ants, the simulation uses:
- distance-based simulation LOD (`near`, `mid`, `far`)
- spatial hash for local neighbor queries
- fixed-step simulation updates
- full ant meshes nearby
- instanced impostors farther away
- view/distance culling

## Main implementation files

- `src/ant-system.js`
  - ant state, actions, movement, food carrying, nest delivery, LOD
- `src/food-system.js`
  - food spawning, pickup/drop, regrowth, nest state, queue slots
- `src/pheromone-system.js`
  - pheromone storage, evaporation, directional sampling
- `src/main.js`
  - scene bootstrap and system wiring
- `ARCHITECTURE.md`
  - higher-level project architecture summary
