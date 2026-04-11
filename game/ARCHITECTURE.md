# Ants Architecture

## Key decisions

- **Terrain is a large X/Z ground plane**
  - Extent: `x,z ∈ [-50, 50]`
  - Height varies in `y ∈ [-5, 5]`
  - Heightfield uses smooth layered noise

- **Ants are independent local agents**
  - Each ant has its own local state: position, velocity, heading, action, target, timers, and LOD band
  - Current actions persist between brain updates so behavior stays visually smooth

- **Simple physics model**
  - Each ant is simulated as a simple sphere-style body for grounding/movement
  - Terrain height is sampled from the heightfield rather than using full rigid-body physics

- **Render and simulation are decoupled**
  - Brain updates run less often than movement
  - Simulation uses a fixed-step loop for stability under load

- **Distance-based simulation LOD**
  - Ants are classified into `near`, `mid`, and `far`
  - Distant ants run brain/steering less often
  - Far ants continue their previous action until the next logic tick

- **Spatial partitioning for local interactions**
  - Neighbor queries use a spatial hash grid instead of all-to-all checks
  - Separation/avoidance work is limited to nearby ants

- **Render LOD**
  - Near ants use full 3D ant meshes
  - Far visible ants use lightweight instanced impostors
  - Off-screen / too-distant ants are hidden

- **Camera is player-controlled**
  - Mouse/touch orbit camera using `OrbitControls`
  - No automatic camera rotation

## Main implementation files

- `src/main.js`
  - scene bootstrap, camera, controls, fixed-step loop, HUD wiring

- `src/terrain.js`
  - terrain config, noise-based height sampling, terrain mesh/material

- `src/ant-system.js`
  - ant state model, behavior loop, LOD logic, spatial hash, visibility, render tiers

- `test/terrain.test.js`
  - terrain shape and material checks

- `test/ant-system.test.js`
  - ant spawning, LOD, and spatial-hash behavior checks

- `tests/e2e/smoke.spec.js`
  - basic runtime/render smoke coverage
