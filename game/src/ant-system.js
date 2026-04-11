import * as THREE from 'three';
import { FOOD_CONFIG, NEST_CONFIG, findNearestCarryAssistFood, findNearestFood, getFoodById, getFoodCarryFactor } from './food-system.js';
import { PHEROMONE_CONFIG } from './pheromone-system.js';
import { TERRAIN_CONFIG, sampleHeight } from './terrain.js';

export const ANT_CONFIG = Object.freeze({
  count: 200,
  bodyRadius: 0.24,
  renderOffsetY: -0.19,
  impostorFrontRadius: 0.21,
  impostorRearRadius: 0.22,
  impostorSpacing: 0.25,
  impostorSpeedStretch: 0.06,
  speed: 2.4,
  carryingSpeedFactor: 0.72,
  wanderJitter: 0.9,
  idleChance: 0.12,
  closeBrainInterval: 0.2,
  midBrainInterval: 0.55,
  farBrainInterval: 1.3,
  closeLogicInterval: 1 / 30,
  midLogicInterval: 1 / 12,
  farLogicInterval: 1 / 5,
  farDistance: 55,
  midDistance: 28,
  cullDistance: 95,
  cellSize: 3,
  fullMeshDistance: 42,
  foodInterestBoost: 1.12,
  foodPheromoneInfluence: 1.35,
  homePheromoneInfluence: 0.95,
  assistCarryDistance: 1.1,
  assistCarryTetherDistance: 0.85,
  nestYieldRadius: 7,
  nestYieldSpeedFactor: 0.9,
  legMaxSwing: 0.68,
  legLiftSwing: 0.22,
  legStrideSpeed: 2.4,
  legMoveThreshold: 0.08,
  legCarryMinRatio: 0.22,
  fighterSenseDistance: 12,
  fighterAttackRange: 0.95,
  fighterAttackDamage: 14,
  fighterAttackCooldown: 0.72,
  fighterNestAttackRange: 2.1,
  fighterNestAttackDamage: 4,
  workerHp: 28,
  fighterHp: 46,
});

export const ANT_LOD = Object.freeze({ near: 'near', mid: 'mid', far: 'far' });
export const ANT_ROLE = Object.freeze({ worker: 'worker', fighter: 'fighter' });
export const ANT_FACTION = Object.freeze({ player: 'player', enemy: 'enemy' });
export const PLAYER_STARTING_COUNTS = Object.freeze({
  workers: 20,
  fighters: 5,
});

const clampToTerrainBounds = (value, extent, padding = 1) => THREE.MathUtils.clamp(value, -extent / 2 + padding, extent / 2 - padding);
const randomRange = (min, max) => min + Math.random() * (max - min);
const cellCoord = (value, size) => Math.floor(value / size);
const cellKey = (x, z) => `${x},${z}`;

export const getMaxHpForRole = (role) => {
  if (role === ANT_ROLE.fighter) return ANT_CONFIG.fighterHp;
  return ANT_CONFIG.workerHp;
};

export const getLodBandForDistance = (distanceToCamera) => {
  if (distanceToCamera > ANT_CONFIG.farDistance) return ANT_LOD.far;
  if (distanceToCamera > ANT_CONFIG.midDistance) return ANT_LOD.mid;
  return ANT_LOD.near;
};

export const getBrainIntervalForDistance = (distanceToCamera) => {
  const band = getLodBandForDistance(distanceToCamera);
  if (band === ANT_LOD.far) return ANT_CONFIG.farBrainInterval;
  if (band === ANT_LOD.mid) return ANT_CONFIG.midBrainInterval;
  return ANT_CONFIG.closeBrainInterval;
};

export const getLogicIntervalForDistance = (distanceToCamera) => {
  const band = getLodBandForDistance(distanceToCamera);
  if (band === ANT_LOD.far) return ANT_CONFIG.farLogicInterval;
  if (band === ANT_LOD.mid) return ANT_CONFIG.midLogicInterval;
  return ANT_CONFIG.closeLogicInterval;
};

export const buildSpatialHash = (ants, cellSize = ANT_CONFIG.cellSize) => {
  const grid = new Map();
  for (const ant of ants) {
    const key = cellKey(cellCoord(ant.position.x, cellSize), cellCoord(ant.position.z, cellSize));
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(ant);
  }
  return grid;
};

export const querySpatialHash = (grid, x, z, cellSize = ANT_CONFIG.cellSize) => {
  const originX = cellCoord(x, cellSize);
  const originZ = cellCoord(z, cellSize);
  const neighbors = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const bucket = grid.get(cellKey(originX + dx, originZ + dz));
      if (bucket) neighbors.push(...bucket);
    }
  }
  return neighbors;
};

const chooseRole = () => {
  const roll = Math.random();
  if (roll < 0.68) return ANT_ROLE.worker;
  return ANT_ROLE.fighter;
};

const chooseEnemyRole = () => {
  const roll = Math.random();
  if (roll < 0.56) return ANT_ROLE.worker;
  return ANT_ROLE.fighter;
};

const findClosestHostileNestPosition = (ant, nestLookup) => {
  let bestNest = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const nest of nestLookup.values()) {
    if (nest.faction === ant.faction) continue;
    const distanceSq = ant.position.distanceToSquared(nest.position);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestNest = nest;
    }
  }
  return bestNest?.position ?? null;
};

export const findSiegeTargetNest = (ant, nests, maxDistance = ANT_CONFIG.fighterSenseDistance) => {
  if (ant.dead || ant.role !== ANT_ROLE.fighter) return null;

  let bestNest = null;
  let bestDistanceSq = maxDistance * maxDistance;
  for (const nest of nests) {
    if (nest.faction === ant.faction || nest.collapsed) continue;
    const distanceSq = ant.position.distanceToSquared(nest.position);
    if (distanceSq <= bestDistanceSq) {
      bestNest = nest;
      bestDistanceSq = distanceSq;
    }
  }
  return bestNest;
};

const getAntPalette = (role, faction) => {
  if (faction === ANT_FACTION.enemy) {
    if (role === ANT_ROLE.fighter) return { body: 0x7d364d, accent: 0x4d1225 };
    return { body: 0xd18aa9, accent: 0x7c3455 };
  }

  if (role === ANT_ROLE.fighter) return { body: 0x5b3a22, accent: 0x29a354 };
  return { body: 0x4f6f2f, accent: 0xa6ee5a };
};

const getHomeNestPosition = (ant, nestLookup) => nestLookup.get(ant.homeNestId)?.position ?? NEST_CONFIG.position;

export const createAntVisual = (role = ANT_ROLE.worker, faction = ANT_FACTION.player) => {
  const group = new THREE.Group();
  const palette = getAntPalette(role, faction);
  const material = new THREE.MeshToonMaterial({ color: palette.body });
  const accentMaterial = new THREE.MeshToonMaterial({ color: palette.accent });
  const legs = [];

  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), material);
  abdomen.scale.set(0.92, 0.82, 1.02);
  abdomen.position.set(0, 0.23, -0.24);
  group.add(abdomen);

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), material);
  thorax.scale.set(0.95, 0.96, 1.02);
  thorax.position.set(0, 0.24, 0.01);
  group.add(thorax);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), accentMaterial);
  head.position.set(0, 0.25, 0.38);
  group.add(head);

  if (role === ANT_ROLE.fighter) {
    abdomen.scale.multiplyScalar(1.08);
    thorax.scale.set(1.08, 1.04, 1.12);
    head.scale.setScalar(1.18);
  }

  const legGeometry = new THREE.CapsuleGeometry(0.03, 0.4, 2, 6);
  for (let i = 0; i < 3; i += 1) {
    const z = -0.2 + i * 0.22;
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeometry, accentMaterial);
      const baseRotation = {
        x: Math.PI * 0.44,
        y: 0,
        z: side * Math.PI * 0.32,
      };
      leg.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
      leg.position.set(side * 0.22, 0.18, z);
      leg.userData.baseRotation = baseRotation;
      leg.userData.gaitOffset = i * Math.PI * 0.82 + (side < 0 ? 0 : Math.PI);
      leg.userData.side = side;
      legs.push(leg);
      group.add(leg);
    }
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  group.userData.legs = legs;

  return group;
};

const animateAntLegs = (mesh, ant) => {
  const legs = mesh.userData.legs;
  if (!legs?.length) return;

  const rawSpeedRatio = Math.max(ant.velocity.length(), ant.desiredVelocity.length()) / ANT_CONFIG.speed;
  const speedRatio = ant.action === 'carry-food' || ant.action === 'assist-carry'
    ? Math.max(ANT_CONFIG.legCarryMinRatio, rawSpeedRatio)
    : rawSpeedRatio;
  const clampedSpeedRatio = THREE.MathUtils.clamp(speedRatio, 0, 1);
  const strideStrength = clampedSpeedRatio <= ANT_CONFIG.legMoveThreshold
    ? 0
    : (clampedSpeedRatio - ANT_CONFIG.legMoveThreshold) / (1 - ANT_CONFIG.legMoveThreshold);

  for (const leg of legs) {
    const baseRotation = leg.userData.baseRotation;
    if (!baseRotation) continue;
    const phase = ant.gaitPhase * ANT_CONFIG.legStrideSpeed + (leg.userData.gaitOffset ?? 0);
    const swing = Math.sin(phase) * ANT_CONFIG.legMaxSwing * strideStrength;
    const lift = Math.max(0, Math.cos(phase)) * ANT_CONFIG.legLiftSwing * strideStrength;
    leg.rotation.x = baseRotation.x + swing;
    leg.rotation.y = baseRotation.y + (leg.userData.side ?? 1) * lift;
    leg.rotation.z = baseRotation.z - (leg.userData.side ?? 1) * swing * 0.12;
  }
};

export const createAntState = (id, x, z, overrides = {}) => {
  const role = overrides.role ?? chooseRole();
  const maxHp = overrides.maxHp ?? getMaxHpForRole(role);

  return {
    id,
    faction: ANT_FACTION.player,
    homeNestId: 'player-1',
    role,
    radius: ANT_CONFIG.bodyRadius,
    position: new THREE.Vector3(x, sampleHeight(x, z) + ANT_CONFIG.bodyRadius, z),
    velocity: new THREE.Vector3(),
    desiredVelocity: new THREE.Vector3(),
    heading: new THREE.Vector3(1, 0, 0),
    action: 'wander',
    target: new THREE.Vector3(x, 0, z),
    targetFoodId: null,
    carryingFoodId: null,
    assistingFoodId: null,
    queuedNestSlot: null,
    nestApproachStage: 'queue',
    brainCooldown: Math.random() * 0.6,
    brainInterval: ANT_CONFIG.closeBrainInterval,
    logicCooldown: Math.random() * ANT_CONFIG.closeLogicInterval,
    logicInterval: ANT_CONFIG.closeLogicInterval,
    gaitPhase: Math.random() * Math.PI * 2,
    hp: maxHp,
    maxHp,
    attackCooldownRemaining: 0,
    combatTargetId: null,
    dead: false,
    visible: true,
    lodBand: ANT_LOD.near,
    ...overrides,
  };
};

const spawnAroundNest = (nest, rolePicker, count, startId = 0) => {
  const ants = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = randomRange(1.4, 7.8);
    const x = clampToTerrainBounds(nest.position.x + Math.cos(angle) * distance, TERRAIN_CONFIG.width);
    const z = clampToTerrainBounds(nest.position.z + Math.sin(angle) * distance, TERRAIN_CONFIG.depth);
    ants.push(createAntState(startId + i, x, z, {
      faction: nest.faction,
      homeNestId: nest.id,
      role: rolePicker(),
    }));
  }
  return ants;
};

const spawnPlayerStartingColony = (playerNest, startId = 0) => {
  const ants = [];
  let nextId = startId;
  const roleGroups = [
    [ANT_ROLE.worker, PLAYER_STARTING_COUNTS.workers],
    [ANT_ROLE.fighter, PLAYER_STARTING_COUNTS.fighters],
  ];

  for (const [role, count] of roleGroups) {
    ants.push(...spawnAroundNest(playerNest, () => role, count, nextId));
    nextId += count;
  }

  return ants;
};

export const createRandomAntStates = (count = ANT_CONFIG.count, nests = [{ id: 'player-1', faction: ANT_FACTION.player, position: new THREE.Vector3(0, 0, 0) }]) => {
  const playerNest = nests.find((nest) => nest.faction === ANT_FACTION.player) ?? nests[0];
  const enemyNests = nests.filter((nest) => nest.faction === ANT_FACTION.enemy);
  const enemyPerNest = enemyNests.length ? Math.min(24, Math.floor(count * 0.12)) : 0;
  let nextId = 0;
  const ants = spawnPlayerStartingColony(playerNest, nextId);
  nextId += ants.length;

  for (const enemyNest of enemyNests) {
    ants.push(...spawnAroundNest(enemyNest, chooseEnemyRole, enemyPerNest, nextId));
    nextId += enemyPerNest;
  }

  return ants;
};

const chooseNextAction = (ant) => {
  ant.targetFoodId = null;
  ant.carryingFoodId = null;
  ant.assistingFoodId = null;
  ant.queuedNestSlot = null;
  ant.nestApproachStage = 'queue';
  if (Math.random() < ANT_CONFIG.idleChance && ant.role !== ANT_ROLE.fighter) {
    ant.action = 'idle';
    ant.desiredVelocity.setScalar(0);
    return;
  }
  ant.action = 'wander';
  const jitter = ant.role === ANT_ROLE.fighter ? ANT_CONFIG.wanderJitter * 0.85 : ANT_CONFIG.wanderJitter;
  const angle = Math.atan2(ant.heading.z, ant.heading.x) + randomRange(-jitter, jitter);
  ant.heading.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
  const distance = ant.role === ANT_ROLE.worker ? randomRange(2.5, 6) : randomRange(4, 9);
  ant.target.set(
    clampToTerrainBounds(ant.position.x + ant.heading.x * distance, TERRAIN_CONFIG.width),
    0,
    clampToTerrainBounds(ant.position.z + ant.heading.z * distance, TERRAIN_CONFIG.depth),
  );
  ant.desiredVelocity.copy(ant.heading).multiplyScalar(ANT_CONFIG.speed * randomRange(0.55, 1.1));
};

const chooseFoodAction = (ant, food) => {
  ant.action = 'seek-food';
  ant.targetFoodId = food.id;
  ant.assistingFoodId = null;
  ant.target.set(food.position.x, 0, food.position.z);
  const direction = new THREE.Vector3(food.position.x - ant.position.x, 0, food.position.z - ant.position.z);
  if (direction.lengthSq() > 0.0001) {
    direction.normalize();
    ant.heading.copy(direction);
    ant.desiredVelocity.copy(direction).multiplyScalar(ANT_CONFIG.speed * ANT_CONFIG.foodInterestBoost);
  }
};

const chooseAssistCarryAction = (ant, food) => {
  ant.action = 'assist-carry';
  ant.assistingFoodId = food.id;
  ant.targetFoodId = food.id;
  ant.target.set(food.position.x, 0, food.position.z);
};

const chooseCarryToNestAction = (ant, dropTarget) => {
  ant.action = 'carry-food';
  ant.target.set(dropTarget.x, 0, dropTarget.z);
  const direction = new THREE.Vector3(dropTarget.x - ant.position.x, 0, dropTarget.z - ant.position.z);
  if (direction.lengthSq() > 0.0001) {
    direction.normalize();
    ant.heading.copy(direction);
    ant.desiredVelocity.copy(direction).multiplyScalar(ANT_CONFIG.speed * ANT_CONFIG.carryingSpeedFactor);
  }
};

const chooseFocusAction = (ant, focusTarget) => {
  ant.action = 'focus-target';
  ant.target.set(focusTarget.x, 0, focusTarget.z);
  const direction = new THREE.Vector3(focusTarget.x - ant.position.x, 0, focusTarget.z - ant.position.z);
  if (direction.lengthSq() <= 0.0001) return;

  direction.normalize();
  ant.heading.copy(direction);
  const speedFactor = ant.role === ANT_ROLE.worker ? 1 : 0.92;
  ant.desiredVelocity.copy(direction).multiplyScalar(ANT_CONFIG.speed * speedFactor);
};

const choosePatrolAction = (ant, homeNestPosition) => {
  ant.action = 'patrol';
  const patrolRadius = ant.role === ANT_ROLE.fighter ? randomRange(5, 11) : randomRange(4, 8);
  const angle = Math.random() * Math.PI * 2;
  ant.target.set(
    clampToTerrainBounds(homeNestPosition.x + Math.cos(angle) * patrolRadius, TERRAIN_CONFIG.width),
    0,
    clampToTerrainBounds(homeNestPosition.z + Math.sin(angle) * patrolRadius, TERRAIN_CONFIG.depth),
  );
  const direction = new THREE.Vector3(ant.target.x - ant.position.x, 0, ant.target.z - ant.position.z);
  if (direction.lengthSq() <= 0.0001) return;
  direction.normalize();
  ant.heading.copy(direction);
  const speedFactor = ant.role === ANT_ROLE.fighter ? 0.94 : 0.9;
  ant.desiredVelocity.copy(direction).multiplyScalar(ANT_CONFIG.speed * speedFactor);
};

const getCarryApproachTarget = (ant, nestPosition) => {
  if (!ant.queuedNestSlot) return nestPosition;
  if (ant.nestApproachStage !== 'entrance') {
    const queueDistance = ant.position.distanceTo(ant.queuedNestSlot.queuePosition);
    if (queueDistance <= 0.9) {
      ant.nestApproachStage = 'entrance';
    }
  }
  if (ant.nestApproachStage !== 'entrance') return ant.queuedNestSlot.queuePosition;
  return ant.queuedNestSlot.entrancePosition;
};

const updateBrain = (ant, distanceToCamera, foods, pheromoneSystem, colonyFocusTarget, nestLookup) => {
  ant.lodBand = getLodBandForDistance(distanceToCamera);
  ant.brainInterval = getBrainIntervalForDistance(distanceToCamera);
  ant.logicInterval = getLogicIntervalForDistance(distanceToCamera);

  const homeNestPosition = getHomeNestPosition(ant, nestLookup);

  if (ant.carryingFoodId != null) return;

  if (ant.role === ANT_ROLE.fighter) {
    if (ant.faction === ANT_FACTION.player && colonyFocusTarget) {
      chooseFocusAction(ant, colonyFocusTarget);
      return;
    }

    if (ant.faction === ANT_FACTION.enemy) {
      const hostileNestPosition = findClosestHostileNestPosition(ant, nestLookup);
      if (hostileNestPosition) {
        const pressureDistance = ant.position.distanceTo(hostileNestPosition);
        const pressureRadius = 14;
        const pressureChance = 0.72;
        if (pressureDistance > pressureRadius || Math.random() < pressureChance) {
          chooseFocusAction(ant, hostileNestPosition);
          return;
        }
      }
    }

    choosePatrolAction(ant, homeNestPosition);
    return;
  }

  if (ant.assistingFoodId != null) {
    const assistedFood = getFoodById(foods, ant.assistingFoodId);
    if (assistedFood && assistedFood.carried && !assistedFood.delivered) {
      chooseAssistCarryAction(ant, assistedFood);
      return;
    }
  }

  if (ant.targetFoodId != null) {
    const trackedFood = getFoodById(foods, ant.targetFoodId);
    if (trackedFood && !trackedFood.delivered && !trackedFood.carried) {
      chooseFoodAction(ant, trackedFood);
      return;
    }
  }

  const assistFood = findNearestCarryAssistFood(foods, ant.position, FOOD_CONFIG.senseDistance);
  if (assistFood) {
    chooseAssistCarryAction(ant, assistFood);
    return;
  }

  const sensedFood = findNearestFood(foods, ant.position, FOOD_CONFIG.senseDistance);
  if (sensedFood) {
    chooseFoodAction(ant, sensedFood);
    return;
  }

  if (colonyFocusTarget) {
    const focusDistance = ant.position.distanceTo(colonyFocusTarget);
    const focusRadius = 17;
    const focusChance = 0.58;
    if (ant.faction === ANT_FACTION.player && focusDistance > focusRadius && Math.random() < focusChance) {
      chooseFocusAction(ant, colonyFocusTarget);
      return;
    }
  }

  const pheromoneVector = pheromoneSystem.sample('food', ant.position);
  if (pheromoneVector.lengthSq() > 0.0001) {
    pheromoneVector.normalize();
    ant.action = 'follow-pheromone';
    ant.heading.lerp(pheromoneVector, 0.5).normalize();
    ant.target.set(
      clampToTerrainBounds(ant.position.x + ant.heading.x * 6, TERRAIN_CONFIG.width),
      0,
      clampToTerrainBounds(ant.position.z + ant.heading.z * 6, TERRAIN_CONFIG.depth),
    );
    ant.desiredVelocity.copy(ant.heading).multiplyScalar(ANT_CONFIG.speed * ANT_CONFIG.foodPheromoneInfluence);
    return;
  }

  chooseNextAction(ant);
};

const updateActionVelocity = (ant, foodSystem, foods) => {
  if (ant.action === 'idle') {
    ant.desiredVelocity.lerp(new THREE.Vector3(0, 0, 0), 0.3);
    return;
  }

  if (ant.action === 'assist-carry' && ant.assistingFoodId != null) {
    const food = getFoodById(foods, ant.assistingFoodId);
    if (!food || !food.carried || food.delivered) {
      chooseNextAction(ant);
      return;
    }
    const helperIndex = Math.max(0, food.supportAntIds.indexOf(ant.id));
    const angle = helperIndex * 1.1 + ant.id * 0.17;
    ant.target.set(
      food.position.x + Math.cos(angle) * ANT_CONFIG.assistCarryDistance,
      0,
      food.position.z + Math.sin(angle) * ANT_CONFIG.assistCarryDistance,
    );
  }

  const toTarget = new THREE.Vector3(ant.target.x - ant.position.x, 0, ant.target.z - ant.position.z);
  if (toTarget.lengthSq() < 0.8 * 0.8) {
    if (ant.action === 'seek-food' || ant.action === 'carry-food' || ant.action === 'assist-carry') return;
    chooseNextAction(ant);
    return;
  }

  toTarget.normalize();
  ant.heading.lerp(toTarget, 0.18).normalize();

  let speed = ANT_CONFIG.speed;
  if (ant.action === 'carry-food' && ant.carryingFoodId != null) {
    const food = getFoodById(foods, ant.carryingFoodId);
    speed *= ANT_CONFIG.carryingSpeedFactor * (food ? getFoodCarryFactor(food) : 1);
  } else if (ant.action === 'assist-carry') {
    speed *= 0.85;
  }

  ant.desiredVelocity.lerp(toTarget.multiplyScalar(speed), 0.18);
};

const applySeparation = (ant, grid) => {
  const neighbors = querySpatialHash(grid, ant.position.x, ant.position.z);
  const push = new THREE.Vector3();
  for (const other of neighbors) {
    if (other === ant) continue;
    const dx = ant.position.x - other.position.x;
    const dz = ant.position.z - other.position.z;
    const distanceSq = dx * dx + dz * dz;
    const minDistance = ant.radius + other.radius + 0.2;
    if (distanceSq === 0 || distanceSq > minDistance * minDistance) continue;
    const distance = Math.sqrt(distanceSq);
    const strength = (minDistance - distance) / minDistance;
    push.x += (dx / distance) * strength;
    push.z += (dz / distance) * strength;
  }
  if (push.lengthSq() > 0) {
    push.normalize().multiplyScalar(ANT_CONFIG.speed * 0.7);
    ant.desiredVelocity.add(push);
  }
};

const applyNestYield = (ant, grid, nestPosition) => {
  const distanceToNest = ant.position.distanceTo(nestPosition);
  if (distanceToNest > ANT_CONFIG.nestYieldRadius) return false;

  const neighbors = querySpatialHash(grid, ant.position.x, ant.position.z);
  const yieldVector = new THREE.Vector3();
  let shouldYield = false;

  for (const other of neighbors) {
    if (other === ant) continue;
    const otherHasPriority = other.action === 'carry-food' || other.action === 'assist-carry' || other.carryingFoodId != null;
    if (!otherHasPriority) continue;

    const offset = new THREE.Vector3(ant.position.x - other.position.x, 0, ant.position.z - other.position.z);
    const distanceSq = offset.lengthSq();
    if (distanceSq > 3.2 * 3.2) continue;
    shouldYield = true;
    if (distanceSq > 0.0001) yieldVector.add(offset.normalize().multiplyScalar(1 / Math.sqrt(distanceSq)));
  }

  if (!shouldYield) return false;

  const awayFromNest = new THREE.Vector3(ant.position.x - nestPosition.x, 0, ant.position.z - nestPosition.z);
  if (awayFromNest.lengthSq() > 0.0001) {
    awayFromNest.normalize();
    yieldVector.add(awayFromNest.multiplyScalar(0.9));
  }

  if (yieldVector.lengthSq() <= 0.0001) return false;
  yieldVector.normalize();
  ant.desiredVelocity.lerp(yieldVector.multiplyScalar(ANT_CONFIG.speed * ANT_CONFIG.nestYieldSpeedFactor), 0.45);
  ant.action = 'yield-nest-lane';
  return true;
};

const updateVisibility = (ant, mesh, distance, frustum) => {
  const inFrustum = frustum.containsPoint(ant.position);
  ant.visible = inFrustum || distance < ANT_CONFIG.cullDistance;
  mesh.visible = ant.visible;
};

const attachHelperToFood = (ant, food, supportIndex) => {
  const angle = supportIndex * 1.25 + ant.id * 0.17;
  const targetX = food.position.x + Math.cos(angle) * ANT_CONFIG.assistCarryTetherDistance;
  const targetZ = food.position.z + Math.sin(angle) * ANT_CONFIG.assistCarryTetherDistance;
  ant.position.x = targetX;
  ant.position.z = targetZ;
  ant.position.y = sampleHeight(targetX, targetZ) + ant.radius;
  ant.velocity.setScalar(0);

  const toFood = new THREE.Vector3(food.position.x - ant.position.x, 0, food.position.z - ant.position.z);
  if (toFood.lengthSq() > 0.0001) {
    toFood.normalize();
    ant.heading.lerp(toFood, 0.35).normalize();
  }
};

export const findCombatTarget = (ant, ants, maxDistance = ANT_CONFIG.fighterSenseDistance) => {
  if (ant.dead || ant.role !== ANT_ROLE.fighter) return null;

  let bestTarget = null;
  let bestDistanceSq = maxDistance * maxDistance;
  let bestPriority = -1;
  for (const other of ants) {
    if (other === ant || other.dead || other.faction === ant.faction) continue;
    const distanceSq = ant.position.distanceToSquared(other.position);
    if (distanceSq > maxDistance * maxDistance) continue;

    const priority = other.role === ANT_ROLE.fighter ? 2 : 1;
    if (!bestTarget || priority > bestPriority || (priority === bestPriority && distanceSq < bestDistanceSq)) {
      bestTarget = other;
      bestDistanceSq = distanceSq;
      bestPriority = priority;
    }
  }

  return bestTarget;
};

const clearAntAssignments = (ant, foodSystem, foods) => {
  if (ant.assistingFoodId != null) foodSystem.leaveCarry(ant.assistingFoodId, ant.id);
  if (ant.carryingFoodId != null) {
    const carriedFood = getFoodById(foods, ant.carryingFoodId);
    if (carriedFood) {
      carriedFood.carried = false;
      carriedFood.carriedBy = null;
      carriedFood.claimedBy = null;
      carriedFood.supportAntIds = [];
      carriedFood.position.set(ant.position.x, sampleHeight(ant.position.x, ant.position.z) + FOOD_CONFIG.size * carriedFood.sizeScale * 0.55, ant.position.z);
    }
  }
  if (ant.queuedNestSlot) foodSystem.releaseNestSlot(ant.id);
  ant.targetFoodId = null;
  ant.carryingFoodId = null;
  ant.assistingFoodId = null;
  ant.queuedNestSlot = null;
  ant.combatTargetId = null;
};

export class AntSystem {
  constructor({ scene, camera, foodSystem, pheromoneSystem, foods = [], nests = [], count = ANT_CONFIG.count } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.foodSystem = foodSystem;
    this.pheromoneSystem = pheromoneSystem;
    this.foods = foods;
    this.nests = nests;
    this.nestLookup = new Map(nests.map((nest) => [nest.id, nest]));
    this.ants = createRandomAntStates(count, nests);
    this.meshes = [];
    this.frustum = new THREE.Frustum();
    this.projectionMatrix = new THREE.Matrix4();
    this.tmpVec = new THREE.Vector3();
    this.cameraWorldPosition = new THREE.Vector3();
    this.tmpMatrix = new THREE.Matrix4();
    this.tmpQuaternion = new THREE.Quaternion();
    this.tmpEuler = new THREE.Euler();
    this.tmpScale = new THREE.Vector3(1, 1, 1);
    this.tmpForward = new THREE.Vector3();
    this.tmpRearPosition = new THREE.Vector3();
    this.tmpFrontPosition = new THREE.Vector3();
    this.spatialHash = new Map();
    this.farInstanceCount = 0;
    this.focusTarget = null;
    this.stats = {
      enemyAntsDefeated: 0,
      playerAntsLost: 0,
      enemyNestsDestroyed: 0,
      playerNestsLost: 0,
      maxPlayerAnts: this.ants.filter((ant) => ant.faction === ANT_FACTION.player && !ant.dead).length,
    };

    const rearGeometry = new THREE.SphereGeometry(ANT_CONFIG.impostorRearRadius, 8, 6);
    const frontGeometry = new THREE.SphereGeometry(ANT_CONFIG.impostorFrontRadius, 8, 6);
    const rearMaterial = new THREE.MeshToonMaterial({ color: 0xffffff });
    const frontMaterial = new THREE.MeshToonMaterial({ color: 0xffffff });
    this.farRearInstances = new THREE.InstancedMesh(rearGeometry, rearMaterial, this.ants.length);
    this.farFrontInstances = new THREE.InstancedMesh(frontGeometry, frontMaterial, this.ants.length);
    for (const instanced of [this.farRearInstances, this.farFrontInstances]) {
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      instanced.frustumCulled = false;
      instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(instanced);
    }

    for (const ant of this.ants) {
      const mesh = createAntVisual(ant.role, ant.faction);
      mesh.position.copy(ant.position);
      mesh.rotation.y = Math.atan2(ant.heading.x, ant.heading.z);
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  update(dt) {
    this.camera.updateWorldMatrix(true, false);
    this.camera.getWorldPosition(this.cameraWorldPosition);
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    this.projectionMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projectionMatrix);
    this.spatialHash = buildSpatialHash(this.ants.filter((ant) => !ant.dead));
    this.farInstanceCount = 0;

    for (let i = 0; i < this.ants.length; i += 1) {
      const ant = this.ants[i];
      const mesh = this.meshes[i];

      if (ant.dead) {
        mesh.visible = false;
        ant.visible = false;
        continue;
      }

      const distanceToCamera = ant.position.distanceTo(this.cameraWorldPosition);

      ant.lodBand = getLodBandForDistance(distanceToCamera);
      ant.brainInterval = getBrainIntervalForDistance(distanceToCamera);
      ant.logicInterval = getLogicIntervalForDistance(distanceToCamera);

      ant.brainCooldown -= dt;
      if (ant.brainCooldown <= 0) {
        updateBrain(ant, distanceToCamera, this.foods, this.pheromoneSystem, this.focusTarget, this.nestLookup);
        ant.brainCooldown = ant.brainInterval;
      }

      ant.logicCooldown -= dt;
      ant.attackCooldownRemaining = Math.max(0, ant.attackCooldownRemaining - dt);
      if (ant.logicCooldown <= 0) {
        if (ant.role === ANT_ROLE.fighter) {
          const target = findCombatTarget(ant, this.ants);
          if (target) {
            ant.combatTargetId = target.id;
            ant.target.set(target.position.x, 0, target.position.z);
            const targetDistance = ant.position.distanceTo(target.position);
            if (targetDistance <= ANT_CONFIG.fighterAttackRange) {
              ant.action = 'attack';
              ant.desiredVelocity.setScalar(0);
              if (ant.attackCooldownRemaining <= 0) {
                ant.attackCooldownRemaining = ANT_CONFIG.fighterAttackCooldown;
                target.hp -= ANT_CONFIG.fighterAttackDamage;
                if (target.hp <= 0 && !target.dead) {
                  target.dead = true;
                  clearAntAssignments(target, this.foodSystem, this.foods);
                  target.velocity.setScalar(0);
                  target.desiredVelocity.setScalar(0);
                  target.action = 'dead';
                  if (target.faction === ANT_FACTION.enemy) this.stats.enemyAntsDefeated += 1;
                  if (target.faction === ANT_FACTION.player) this.stats.playerAntsLost += 1;
                }
              }
            }
          } else {
            const siegeNest = findSiegeTargetNest(ant, this.nests);
            if (siegeNest) {
              ant.combatTargetId = siegeNest.id;
              ant.target.set(siegeNest.position.x, 0, siegeNest.position.z);
              const siegeDistance = ant.position.distanceTo(siegeNest.position);
              if (siegeDistance <= ANT_CONFIG.fighterNestAttackRange) {
                ant.action = 'attack-nest';
                ant.desiredVelocity.setScalar(0);
                if (ant.attackCooldownRemaining <= 0) {
                  ant.attackCooldownRemaining = ANT_CONFIG.fighterAttackCooldown;
                  const damageResult = this.foodSystem.damageNest(siegeNest.id, ANT_CONFIG.fighterNestAttackDamage);
                  if (damageResult?.collapsed) {
                    if (siegeNest.faction === ANT_FACTION.enemy) this.stats.enemyNestsDestroyed += 1;
                    if (siegeNest.faction === ANT_FACTION.player) this.stats.playerNestsLost += 1;
                  }
                }
              }
            } else {
              ant.combatTargetId = null;
            }
          }
        }

        if (ant.action === 'seek-food' && ant.targetFoodId != null) {
          const food = getFoodById(this.foods, ant.targetFoodId);
          if (!food || food.delivered || food.carried) chooseNextAction(ant);
        }

        if (ant.action !== 'attack' && ant.action !== 'attack-nest') updateActionVelocity(ant, this.foodSystem, this.foods);

        if (ant.action === 'seek-food' && ant.targetFoodId != null) {
          const food = getFoodById(this.foods, ant.targetFoodId);
          if (food && ant.position.distanceTo(food.position) <= FOOD_CONFIG.pickupDistance) {
            this.foodSystem.claimFood(food.id, ant.id);
            const pickedUp = this.foodSystem.pickUpFood(food.id, ant.id);
            if (pickedUp) {
              ant.carryingFoodId = food.id;
              const homeNestPosition = getHomeNestPosition(ant, this.nestLookup);
              ant.queuedNestSlot = this.foodSystem.reserveNestSlot(ant.id, ant.position, ant.homeNestId);
              ant.nestApproachStage = 'queue';
              chooseCarryToNestAction(ant, getCarryApproachTarget(ant, homeNestPosition));
            }
          }
        }

        if (ant.action === 'assist-carry' && ant.assistingFoodId != null) {
          const food = getFoodById(this.foods, ant.assistingFoodId);
          if (!food || !food.carried || food.delivered) {
            chooseNextAction(ant);
          } else if (ant.position.distanceTo(food.position) <= ANT_CONFIG.assistCarryDistance * 1.15) {
            this.foodSystem.joinCarry(food.id, ant.id);
          } else {
            this.foodSystem.leaveCarry(food.id, ant.id);
          }
        }

        if (ant.action === 'carry-food' && ant.carryingFoodId != null) {
          const homeNestPosition = getHomeNestPosition(ant, this.nestLookup);
          ant.queuedNestSlot ??= this.foodSystem.reserveNestSlot(ant.id, ant.position, ant.homeNestId);
          const approachTarget = getCarryApproachTarget(ant, homeNestPosition);
          ant.target.set(approachTarget.x, 0, approachTarget.z);
          if (ant.position.distanceTo(homeNestPosition) <= NEST_CONFIG.dropoffDistance) {
            const dropped = this.foodSystem.dropFoodInNest(ant.carryingFoodId, ant.id, ant.homeNestId);
            if (dropped) {
              ant.carryingFoodId = null;
              ant.targetFoodId = null;
              ant.queuedNestSlot = null;
              ant.nestApproachStage = 'queue';
              ant.action = 'idle';
              ant.desiredVelocity.setScalar(0);
            }
          }
        }

        const isCarrierGroup = ant.action === 'carry-food' || ant.action === 'assist-carry';
        const shouldSeparate = ant.lodBand !== ANT_LOD.far && !isCarrierGroup;
        if (shouldSeparate) {
          const yielded = applyNestYield(ant, this.spatialHash, getHomeNestPosition(ant, this.nestLookup));
          if (!yielded) applySeparation(ant, this.spatialHash);
        }
        ant.logicCooldown = ant.logicInterval;
      }

      ant.velocity.lerp(ant.desiredVelocity, ant.lodBand === ANT_LOD.near ? 0.16 : ant.lodBand === ANT_LOD.mid ? 0.12 : 0.08);
      ant.position.x = clampToTerrainBounds(ant.position.x + ant.velocity.x * dt, TERRAIN_CONFIG.width);
      ant.position.z = clampToTerrainBounds(ant.position.z + ant.velocity.z * dt, TERRAIN_CONFIG.depth);
      ant.position.y = sampleHeight(ant.position.x, ant.position.z) + ant.radius;

      if (ant.action === 'assist-carry' && ant.assistingFoodId != null) {
        const food = getFoodById(this.foods, ant.assistingFoodId);
        if (food && food.carried && !food.delivered) {
          const supportIndex = Math.max(1, food.supportAntIds.indexOf(ant.id));
          attachHelperToFood(ant, food, supportIndex);
        }
      }

      if (ant.velocity.lengthSq() > 0.001) {
        this.tmpVec.copy(ant.velocity).normalize();
        ant.heading.lerp(this.tmpVec, ant.lodBand === ANT_LOD.far ? 0.12 : 0.22).normalize();
      }

      if (ant.carryingFoodId != null) this.pheromoneSystem.deposit('food', ant.position, PHEROMONE_CONFIG.depositFood * dt * 6);
      else if (ant.role === ANT_ROLE.worker) this.pheromoneSystem.deposit('home', ant.position, PHEROMONE_CONFIG.depositHome * dt * 4);

      ant.gaitPhase += dt * (2.5 + ant.velocity.length() * 1.8);
      const bobY = Math.sin(ant.gaitPhase) * 0.04;
      const rotationY = Math.atan2(ant.heading.x, ant.heading.z);
      const rollZ = Math.sin(ant.gaitPhase) * 0.05;

      updateVisibility(ant, mesh, distanceToCamera, this.frustum);
      const useFullMesh = ant.visible && distanceToCamera <= ANT_CONFIG.fullMeshDistance;
      if (useFullMesh) {
        mesh.visible = true;
        mesh.position.copy(ant.position);
        mesh.position.y += ANT_CONFIG.renderOffsetY + bobY;
        mesh.rotation.y = rotationY;
        mesh.rotation.z = rollZ;
        animateAntLegs(mesh, ant);
      } else {
        mesh.visible = false;
      }

      if (ant.carryingFoodId != null) {
        const carrierPosition = useFullMesh ? mesh.position : ant.position;
        this.foodSystem.syncCarriedFood(ant.carryingFoodId, carrierPosition);
      }

      if (ant.visible && !useFullMesh) {
        this.tmpForward.set(ant.heading.x, 0, ant.heading.z).normalize();
        const speedStretch = Math.min(ANT_CONFIG.impostorSpeedStretch, ant.velocity.length() * 0.015);
        this.tmpRearPosition.set(
          ant.position.x - this.tmpForward.x * (ANT_CONFIG.impostorSpacing * 0.5 + speedStretch),
          ant.position.y + (ANT_CONFIG.impostorRearRadius - ANT_CONFIG.bodyRadius) + bobY,
          ant.position.z - this.tmpForward.z * (ANT_CONFIG.impostorSpacing * 0.5 + speedStretch),
        );
        this.tmpFrontPosition.set(
          ant.position.x + this.tmpForward.x * (ANT_CONFIG.impostorSpacing * 0.5 + speedStretch),
          ant.position.y + (ANT_CONFIG.impostorFrontRadius - ANT_CONFIG.bodyRadius) + bobY,
          ant.position.z + this.tmpForward.z * (ANT_CONFIG.impostorSpacing * 0.5 + speedStretch),
        );
        this.tmpMatrix.compose(this.tmpRearPosition, this.tmpQuaternion.identity(), this.tmpScale);
        this.farRearInstances.setMatrixAt(this.farInstanceCount, this.tmpMatrix);
        this.tmpMatrix.compose(this.tmpFrontPosition, this.tmpQuaternion.identity(), this.tmpScale);
        this.farFrontInstances.setMatrixAt(this.farInstanceCount, this.tmpMatrix);
        const palette = getAntPalette(ant.role, ant.faction);
        this.farRearInstances.setColorAt(this.farInstanceCount, new THREE.Color(palette.body));
        this.farFrontInstances.setColorAt(this.farInstanceCount, new THREE.Color(palette.accent));
        this.farInstanceCount += 1;
      }
    }

    this.stats.maxPlayerAnts = Math.max(
      this.stats.maxPlayerAnts,
      this.ants.filter((ant) => ant.faction === ANT_FACTION.player && !ant.dead).length,
    );

    this.farRearInstances.count = this.farInstanceCount;
    this.farFrontInstances.count = this.farInstanceCount;
    this.farRearInstances.instanceMatrix.needsUpdate = true;
    this.farFrontInstances.instanceMatrix.needsUpdate = true;
    if (this.farRearInstances.instanceColor) this.farRearInstances.instanceColor.needsUpdate = true;
    if (this.farFrontInstances.instanceColor) this.farFrontInstances.instanceColor.needsUpdate = true;
  }

  setFocusTarget(target) {
    this.focusTarget = target ? target.clone() : null;
  }

  getBattleStats() {
    return { ...this.stats };
  }

  getSummary() {
    let visible = 0;
    let idle = 0;
    let near = 0;
    let mid = 0;
    let far = 0;
    let fullMesh = 0;
    let workers = 0;
    let fighters = 0;
    for (let i = 0; i < this.ants.length; i += 1) {
      const ant = this.ants[i];
      if (ant.dead) continue;
      if (ant.visible) visible += 1;
      if (ant.action === 'idle') idle += 1;
      if (ant.lodBand === ANT_LOD.near) near += 1;
      else if (ant.lodBand === ANT_LOD.mid) mid += 1;
      else far += 1;
      if (this.meshes[i]?.visible) fullMesh += 1;
      if (ant.role === ANT_ROLE.worker) workers += 1;
      else fighters += 1;
    }
    return {
      total: this.ants.filter((ant) => !ant.dead).length,
      playerTotal: this.ants.filter((ant) => ant.faction === ANT_FACTION.player && !ant.dead).length,
      enemyTotal: this.ants.filter((ant) => ant.faction === ANT_FACTION.enemy && !ant.dead).length,
      visible,
      active: this.ants.filter((ant) => !ant.dead).length - idle,
      idle,
      carrying: this.ants.filter((ant) => ant.carryingFoodId != null && !ant.dead).length,
      near,
      mid,
      far,
      fullMesh,
      impostor: this.farInstanceCount,
      workers,
      fighters,
      enemyAntsDefeated: this.stats.enemyAntsDefeated,
      enemyNestsDestroyed: this.stats.enemyNestsDestroyed,
      playerNestsLost: this.stats.playerNestsLost,
      playerAntsLost: this.stats.playerAntsLost,
      maxPlayerAnts: this.stats.maxPlayerAnts,
    };
  }
}
