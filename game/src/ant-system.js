import * as THREE from 'three';
import { COLONY, FOOD_CONFIG, NEST_CONFIG, findNearestCarryAssistFood, findNearestFood, getFoodById, getFoodCarryFactor } from './food-system.js';
import { createEnemyRolePicker, normalizeLevelSetup } from './level-setup.js';
import { PHEROMONE_CONFIG } from './pheromone-system.js';
import { resolveObjectiveOutcome } from './objective-rules.js';
import { createRandomRange, createSeededRandom, deriveSeed, DEFAULT_RANDOM_SOURCE } from './seeded-random.js';
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
  workerDefenseSenseDistance: 4.8,
  workerRaidSenseDistance: 6,
  workerFoodContestRadius: 2.8,
  fighterThreatenedAreaRadius: 7.2,
  fighterAttackRange: 0.95,
  fighterAttackDamage: 14,
  fighterAttackCooldown: 0.72,
  workerAttackRange: 0.85,
  workerAttackDamage: 3.5,
  workerAttackCooldown: 0.96,
  fighterNestAttackRange: 2.1,
  fighterNestAttackDamage: 4,
  enemyNestSiegeStoredThreshold: 14,
  workerHp: 28,
  fighterHp: 46,
  deathVisualDuration: 0.32,
  pheromoneTrailMinInterval: 0.12,
  pheromoneTrailMaxInterval: 0.34,
  pheromoneTrailSpeedSqThreshold: 0.04,
});

export const ANT_LOD = Object.freeze({ near: 'near', mid: 'mid', far: 'far' });
export const ANT_ROLE = Object.freeze({ worker: 'worker', fighter: 'fighter' });
export const ANT_FACTION = Object.freeze({ player: 'player', enemy: 'enemy' });
export const PLAYER_STARTING_COUNTS = Object.freeze({
  workers: 24,
  fighters: 1,
});

const ANT_COLONY_PALETTES = Object.freeze({
  [COLONY.player]: {
    [ANT_ROLE.worker]: { body: 0x4f6f2f, accent: 0xa6ee5a },
    [ANT_ROLE.fighter]: { body: 0x5b3a22, accent: 0x29a354 },
    blood: 0x8ed946,
  },
  [COLONY.enemyAlpha]: {
    [ANT_ROLE.worker]: { body: 0xd18aa9, accent: 0x7c3455 },
    [ANT_ROLE.fighter]: { body: 0x7d364d, accent: 0x4d1225 },
    blood: 0xff6f9a,
  },
  [COLONY.enemyBeta]: {
    [ANT_ROLE.worker]: { body: 0x8ba4d6, accent: 0x3a5387 },
    [ANT_ROLE.fighter]: { body: 0x516db2, accent: 0x25396a },
    blood: 0x8fb7ff,
  },
});

const clampToTerrainBounds = (value, extent, padding = 1) => THREE.MathUtils.clamp(value, -extent / 2 + padding, extent / 2 - padding);
const randomRangeWith = (random = DEFAULT_RANDOM_SOURCE) => createRandomRange(random);
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

const chooseRole = (random = DEFAULT_RANDOM_SOURCE) => {
  const roll = random();
  if (roll < 0.68) return ANT_ROLE.worker;
  return ANT_ROLE.fighter;
};

const findClosestHostileNestPosition = (ant, nestLookup) => {
  let bestNest = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const nest of nestLookup.values()) {
    if (nest.colonyId === ant.colonyId || nest.collapsed) continue;
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
  let bestScore = Number.POSITIVE_INFINITY;
  for (const nest of nests) {
    if (nest.colonyId === ant.colonyId || nest.collapsed) continue;
    const distanceSq = ant.position.distanceToSquared(nest.position);
    if (distanceSq > maxDistance * maxDistance) continue;
    const distanceRatio = THREE.MathUtils.clamp(Math.sqrt(distanceSq) / Math.max(0.001, maxDistance), 0, 1);
    const hpRatio = nest.maxHp > 0 ? THREE.MathUtils.clamp(nest.hp / nest.maxHp, 0, 1) : 1;
    const score = hpRatio * 0.86 + distanceRatio * 0.14;
    if (!bestNest || score < bestScore) {
      bestNest = nest;
      bestScore = score;
    }
  }
  return bestNest;
};

const getNestImpactPoint = (ant, nest) => {
  const offset = new THREE.Vector3(ant.position.x - nest.position.x, 0, ant.position.z - nest.position.z);
  if (offset.lengthSq() <= 0.0001) offset.set(1, 0, 0);
  offset.normalize().multiplyScalar(NEST_CONFIG.radius * 1.05);
  const x = nest.position.x + offset.x;
  const z = nest.position.z + offset.z;
  return new THREE.Vector3(x, sampleHeight(x, z) + 0.18, z);
};

const getAntPalette = (role, faction) => {
  const colonyPalette = ANT_COLONY_PALETTES[faction] ?? ANT_COLONY_PALETTES[COLONY.player];
  return colonyPalette[role] ?? colonyPalette[ANT_ROLE.worker];
};

const getBloodColor = (colonyId) => ANT_COLONY_PALETTES[colonyId]?.blood ?? ANT_COLONY_PALETTES[COLONY.player].blood;

const DAMAGE_TEXT_CONFIG = Object.freeze({
  life: 0.72,
  riseMin: 0.95,
  riseMax: 1.45,
  driftMin: 0.08,
  driftMax: 0.26,
  width: 256,
  height: 128,
  scaleX: 1.45,
  scaleY: 0.72,
  largeScaleX: 2.05,
  largeScaleY: 1.02,
});

const createDamageTextSprite = (text, {
  fillStyle = '#ff3f3f',
  strokeStyle = 'rgba(64, 0, 0, 0.98)',
  font = '700 72px Inter, Arial Black, sans-serif',
  lineWidth = 12,
  scaleX = DAMAGE_TEXT_CONFIG.scaleX,
  scaleY = DAMAGE_TEXT_CONFIG.scaleY,
} = {}) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = DAMAGE_TEXT_CONFIG.width;
  canvas.height = DAMAGE_TEXT_CONFIG.height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = font;
  context.lineWidth = lineWidth;
  context.strokeStyle = strokeStyle;
  context.fillStyle = fillStyle;
  context.strokeText(text, canvas.width / 2, canvas.height * 0.52);
  context.fillText(text, canvas.width / 2, canvas.height * 0.52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  material.userData.baseOpacity = 0.98;

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.renderOrder = 28;
  return sprite;
};

const getHomeNestPosition = (ant, nestLookup) => nestLookup.get(ant.homeNestId)?.position ?? NEST_CONFIG.position;

const findNearestFriendlyActiveNest = (ant, nests, excludeNestId = null) => {
  let bestNest = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const nest of nests) {
    if (nest.colonyId !== ant.colonyId || nest.collapsed || nest.id === excludeNestId) continue;
    const distanceSq = ant.position.distanceToSquared(nest.position);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestNest = nest;
    }
  }
  return bestNest;
};

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

export const createAntState = (id, x, z, overrides = {}, random = DEFAULT_RANDOM_SOURCE) => {
  const role = overrides.role ?? chooseRole(random);
  const maxHp = overrides.maxHp ?? getMaxHpForRole(role);
  const colonyId = overrides.colonyId ?? overrides.faction ?? COLONY.player;

  return {
    id,
    faction: ANT_FACTION.player,
    colonyId,
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
    brainCooldown: random() * 0.6,
    brainInterval: ANT_CONFIG.closeBrainInterval,
    logicCooldown: random() * ANT_CONFIG.closeLogicInterval,
    logicInterval: ANT_CONFIG.closeLogicInterval,
    gaitPhase: random() * Math.PI * 2,
    hp: maxHp,
    maxHp,
    attackCooldownRemaining: 0,
    combatTargetId: null,
    workerAggroTargetId: null,
    dead: false,
    deathVisualTime: 0,
    deathVisualDuration: ANT_CONFIG.deathVisualDuration,
    deathTiltDirection: 1,
    deathSpin: 0,
    deathStampPlaced: false,
    deathStampScale: 1,
    visible: true,
    lodBand: ANT_LOD.near,
    pheromoneTrailCooldown: 0.08 + ((id % 7) / 7) * 0.18,
    random,
    ...overrides,
  };
};

const spawnAroundNest = (nest, rolePicker, count, startId = 0, random = DEFAULT_RANDOM_SOURCE) => {
  const ants = [];
  const randomRange = randomRangeWith(random);
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = randomRange(1.4, 7.8);
    const x = clampToTerrainBounds(nest.position.x + Math.cos(angle) * distance, TERRAIN_CONFIG.width);
    const z = clampToTerrainBounds(nest.position.z + Math.sin(angle) * distance, TERRAIN_CONFIG.depth);
    ants.push(createAntState(startId + i, x, z, {
      faction: nest.faction,
      colonyId: nest.colonyId,
      homeNestId: nest.id,
      role: rolePicker(),
    }, random));
  }
  return ants;
};

const spawnPlayerStartingColony = (playerNest, startId = 0, playerStartingCounts = PLAYER_STARTING_COUNTS, random = DEFAULT_RANDOM_SOURCE) => {
  const ants = [];
  let nextId = startId;
  const roleGroups = [
    [ANT_ROLE.worker, playerStartingCounts.workers],
    [ANT_ROLE.fighter, playerStartingCounts.fighters],
  ];

  for (const [role, count] of roleGroups) {
    ants.push(...spawnAroundNest(playerNest, () => role, count, nextId, random));
    nextId += count;
  }

  return ants;
};

export const createRandomAntStates = (count = ANT_CONFIG.count, nests = [{ id: 'player-1', faction: ANT_FACTION.player, position: new THREE.Vector3(0, 0, 0) }], levelSetup = {}, random = DEFAULT_RANDOM_SOURCE) => {
  const setup = normalizeLevelSetup(levelSetup);
  const playerNest = nests.find((nest) => nest.faction === ANT_FACTION.player) ?? nests[0];
  const enemyNests = nests.filter((nest) => nest.faction === ANT_FACTION.enemy);
  const enemyPerNest = enemyNests.length ? Math.min(setup.enemyStartingPerNest, Math.floor(count * 0.18)) : 0;
  const enemyRolePicker = createEnemyRolePicker(setup.enemyWorkerRatio, random);
  let nextId = 0;
  const ants = spawnPlayerStartingColony(playerNest, nextId, setup.playerStartingCounts, random);
  nextId += ants.length;

  for (const enemyNest of enemyNests) {
    ants.push(...spawnAroundNest(enemyNest, enemyRolePicker, enemyPerNest, nextId, random));
    nextId += enemyPerNest;
  }

  return ants;
};

const chooseNextAction = (ant, random = DEFAULT_RANDOM_SOURCE) => {
  const randomRange = randomRangeWith(random);
  ant.targetFoodId = null;
  ant.carryingFoodId = null;
  ant.assistingFoodId = null;
  ant.queuedNestSlot = null;
  ant.nestApproachStage = 'queue';
  if (random() < ANT_CONFIG.idleChance && ant.role !== ANT_ROLE.fighter) {
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

const choosePatrolAction = (ant, homeNestPosition, random = DEFAULT_RANDOM_SOURCE) => {
  const randomRange = randomRangeWith(random);
  ant.action = 'patrol';
  const patrolRadius = ant.role === ANT_ROLE.fighter ? randomRange(5, 11) : randomRange(4, 8);
  const angle = random() * Math.PI * 2;
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
    const nestDistance = ant.position.distanceTo(nestPosition);
    if (queueDistance <= 0.9 || nestDistance <= NEST_CONFIG.queueRadius + 0.45) {
      ant.nestApproachStage = 'entrance';
    }
  }
  if (ant.nestApproachStage !== 'entrance') return ant.queuedNestSlot.queuePosition;
  return ant.queuedNestSlot.entrancePosition;
};

const findWorkerContestTarget = (ant, ants, foodTarget, maxDistance = ANT_CONFIG.workerRaidSenseDistance) => {
  if (!foodTarget) return null;

  let bestTarget = null;
  let bestDistanceSq = maxDistance * maxDistance;
  for (const other of ants) {
    if (other === ant || other.dead || other.colonyId === ant.colonyId) continue;
    if (other.role !== ANT_ROLE.worker) continue;
    const distanceToFoodSq = other.position.distanceToSquared(foodTarget.position);
    if (distanceToFoodSq > ANT_CONFIG.workerFoodContestRadius * ANT_CONFIG.workerFoodContestRadius) continue;

    const distanceSq = ant.position.distanceToSquared(other.position);
    if (distanceSq > maxDistance * maxDistance) continue;
    if (!bestTarget || distanceSq < bestDistanceSq) {
      bestTarget = other;
      bestDistanceSq = distanceSq;
    }
  }

  return bestTarget;
};

const findWorkerRaidTarget = (ant, ants, maxDistance = ANT_CONFIG.workerRaidSenseDistance) => {
  let bestTarget = null;
  let bestDistanceSq = maxDistance * maxDistance;
  let bestPriority = -1;
  for (const other of ants) {
    if (other === ant || other.dead || other.colonyId === ant.colonyId) continue;
    const distanceSq = ant.position.distanceToSquared(other.position);
    if (distanceSq > maxDistance * maxDistance) continue;

    const priority = other.carryingFoodId != null
      ? 3
      : other.role === ANT_ROLE.worker
        ? 2
        : 1;

    if (!bestTarget || priority > bestPriority || (priority === bestPriority && distanceSq < bestDistanceSq)) {
      bestTarget = other;
      bestDistanceSq = distanceSq;
      bestPriority = priority;
    }
  }

  return bestTarget;
};

const updateBrain = (ant, distanceToCamera, foods, ants, pheromoneSystem, colonyFocusTarget, nestLookup, random = DEFAULT_RANDOM_SOURCE) => {
  ant.lodBand = getLodBandForDistance(distanceToCamera);
  ant.brainInterval = getBrainIntervalForDistance(distanceToCamera);
  ant.logicInterval = getLogicIntervalForDistance(distanceToCamera);

  const homeNestPosition = getHomeNestPosition(ant, nestLookup);

  ant.workerAggroTargetId = null;
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
        if (pressureDistance > pressureRadius || random() < pressureChance) {
          chooseFocusAction(ant, hostileNestPosition);
          return;
        }
      }
    }

    choosePatrolAction(ant, homeNestPosition, random);
    return;
  }

  if (ant.assistingFoodId != null) {
    const assistedFood = getFoodById(foods, ant.assistingFoodId);
    if (assistedFood && assistedFood.carried && !assistedFood.delivered && assistedFood.carriedByColonyId === ant.colonyId) {
      chooseAssistCarryAction(ant, assistedFood);
      return;
    }
  }

  if (ant.targetFoodId != null) {
    const trackedFood = getFoodById(foods, ant.targetFoodId);
    if (trackedFood && !trackedFood.delivered && !trackedFood.carried) {
      const contestTarget = ant.faction === ANT_FACTION.player
        ? findWorkerContestTarget(ant, ants, trackedFood)
        : null;
      if (contestTarget) {
        ant.workerAggroTargetId = contestTarget.id;
        chooseFocusAction(ant, contestTarget.position, 1);
        return;
      }
      chooseFoodAction(ant, trackedFood);
      return;
    }
  }

  const assistFood = findNearestCarryAssistFood(foods, ant.position, ant.colonyId, FOOD_CONFIG.senseDistance);
  if (assistFood) {
    chooseAssistCarryAction(ant, assistFood);
    return;
  }

  const sensedFood = findNearestFood(foods, ant.position, FOOD_CONFIG.senseDistance);
  if (sensedFood) {
    const contestTarget = ant.faction === ANT_FACTION.player
      ? findWorkerContestTarget(ant, ants, sensedFood)
      : null;
    if (contestTarget) {
      ant.workerAggroTargetId = contestTarget.id;
      chooseFocusAction(ant, contestTarget.position, 1);
      return;
    }
    chooseFoodAction(ant, sensedFood);
    return;
  }

  if (colonyFocusTarget) {
    const focusDistance = ant.position.distanceTo(colonyFocusTarget);
    const focusRadius = 17;
    const focusChance = 0.58;
    if (ant.faction === ANT_FACTION.player && focusDistance > focusRadius && random() < focusChance) {
      chooseFocusAction(ant, colonyFocusTarget);
      return;
    }
  }

  if (ant.faction === ANT_FACTION.player) {
    const raidTarget = findWorkerRaidTarget(ant, ants);
    if (raidTarget) {
      ant.workerAggroTargetId = raidTarget.id;
      chooseFocusAction(ant, raidTarget.position, 1);
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

  chooseNextAction(ant, random);
};

const updateActionVelocity = (ant, foodSystem, foods) => {
  if (ant.action === 'idle') {
    ant.desiredVelocity.lerp(new THREE.Vector3(0, 0, 0), 0.3);
    return;
  }

  if (ant.action === 'assist-carry' && ant.assistingFoodId != null) {
    const food = getFoodById(foods, ant.assistingFoodId);
    if (!food || !food.carried || food.delivered || food.carriedByColonyId !== ant.colonyId) {
      chooseNextAction(ant, ant.random);
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
    chooseNextAction(ant, ant.random);
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

const getEffectiveCameraDistance = (camera, worldPosition, cameraWorldPosition) => {
  const rawDistance = worldPosition.distanceTo(cameraWorldPosition);
  if (!camera?.isOrthographicCamera) return rawDistance;
  return rawDistance / Math.max(0.001, camera.zoom || 1);
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
  if (ant.dead) return null;

  const canAttackFighters = ant.role === ANT_ROLE.fighter || ant.role === ANT_ROLE.worker;
  if (!canAttackFighters) return null;
  const senseDistance = ant.role === ANT_ROLE.worker ? ANT_CONFIG.workerDefenseSenseDistance : maxDistance;

  let bestTarget = null;
  let bestDistanceSq = senseDistance * senseDistance;
  let bestPriority = -1;

  const isThreateningSameArea = (candidate) => {
    if (ant.role !== ANT_ROLE.fighter || candidate.role !== ANT_ROLE.fighter) return false;
    const threatenedRadiusSq = ANT_CONFIG.fighterThreatenedAreaRadius * ANT_CONFIG.fighterThreatenedAreaRadius;
    for (const ally of ants) {
      if (ally.dead || ally.colonyId !== ant.colonyId || ally.id === ant.id) continue;
      const allyIsValuable = ally.role === ANT_ROLE.worker || ally.carryingFoodId != null || ally.assistingFoodId != null;
      if (!allyIsValuable) continue;
      const candidateToAllySq = candidate.position.distanceToSquared(ally.position);
      if (candidateToAllySq <= threatenedRadiusSq) return true;
    }
    return false;
  };

  for (const other of ants) {
    if (other === ant || other.dead || other.colonyId === ant.colonyId) continue;
    const distanceSq = ant.position.distanceToSquared(other.position);
    if (ant.role === ANT_ROLE.worker) {
      const isWorkerDefenseTarget = other.role === ANT_ROLE.fighter && distanceSq <= ANT_CONFIG.workerDefenseSenseDistance * ANT_CONFIG.workerDefenseSenseDistance;
      const isAggroTarget = ant.workerAggroTargetId != null
        && other.id === ant.workerAggroTargetId
        && distanceSq <= ANT_CONFIG.workerRaidSenseDistance * ANT_CONFIG.workerRaidSenseDistance;
      if (!isWorkerDefenseTarget && !isAggroTarget) continue;
    }
    if (ant.role !== ANT_ROLE.worker && distanceSq > senseDistance * senseDistance) continue;

    let priority = other.carryingFoodId != null ? 3 : other.role === ANT_ROLE.fighter ? 2 : 1;
    if (ant.role === ANT_ROLE.fighter) {
      if (other.role === ANT_ROLE.fighter) {
        priority = isThreateningSameArea(other) ? 4 : 3;
      } else {
        priority = 2;
      }
    }
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
      carriedFood.carriedByColonyId = null;
      carriedFood.claimedBy = null;
      carriedFood.claimedByColonyId = null;
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
  ant.workerAggroTargetId = null;
};

export const resolveNestCollapse = (collapsedNest, ants, nests) => {
  const affectedAnts = ants.filter((ant) => !ant.dead && ant.homeNestId === collapsedNest.id);
  if (!affectedAnts.length) return { killedIds: [], reassignedIds: [] };

  const killCount = Math.min(
    affectedAnts.length,
    Math.max(1, Math.floor(affectedAnts.length / 3)),
  );
  const sorted = [...affectedAnts].sort((a, b) => a.id - b.id);
  const killed = sorted.slice(0, killCount);
  const survivors = sorted.slice(killCount);
  const killedIds = killed.map((ant) => ant.id);
  const reassignedIds = [];

  for (const ant of survivors) {
    const fallbackNest = findNearestFriendlyActiveNest(ant, nests, collapsedNest.id);
    if (fallbackNest) {
      ant.homeNestId = fallbackNest.id;
      reassignedIds.push(ant.id);
    } else {
      killedIds.push(ant.id);
    }
  }

  return { killedIds, reassignedIds };
};

export class AntSystem {
  constructor({
    scene,
    camera,
    foodSystem,
    pheromoneSystem,
    foods = [],
    nests = [],
    count = ANT_CONFIG.count,
    levelSetup = {},
    objective = null,
    random = DEFAULT_RANDOM_SOURCE,
    setupRandom = random,
    decisionSeed = null,
    decisionRandom = random,
    effectRandom = random,
    spawnRandom = decisionRandom,
  } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.foodSystem = foodSystem;
    this.pheromoneSystem = pheromoneSystem;
    this.foods = foods;
    this.nests = nests;
    this.nestLookup = new Map(nests.map((nest) => [nest.id, nest]));
    this.random = random;
    this.setupRandom = setupRandom;
    this.decisionSeed = decisionSeed;
    this.decisionRandom = decisionRandom;
    this.effectRandom = effectRandom;
    this.spawnRandom = spawnRandom;
    this.randomRange = randomRangeWith(this.decisionRandom);
    this.spawnRandomRange = randomRangeWith(this.spawnRandom);
    this.createAntDecisionRandom = decisionSeed == null
      ? () => this.decisionRandom
      : (antId) => createSeededRandom(deriveSeed(decisionSeed, `ant-${antId}`));
    this.ants = createRandomAntStates(count, nests, levelSetup, this.setupRandom);
    for (const ant of this.ants) ant.random = this.createAntDecisionRandom(ant.id);
    this.nextAntId = this.ants.reduce((max, ant) => Math.max(max, ant.id), -1) + 1;
    this.maxRenderAnts = Math.max(count, 320);
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
    this.tmpLungeOffset = new THREE.Vector3();
    this.spatialHash = new Map();
    this.farInstanceCount = 0;
    this.focusTarget = null;
    this.hitEffects = [];
    this.hitEffectGroup = new THREE.Group();
    this.damageTexts = [];
    this.damageTextGroup = new THREE.Group();
    this.groundSplats = [];
    this.groundSplatGroup = new THREE.Group();
    this.corpseRemains = [];
    this.objective = objective;
    this.stats = {
      enemyAntsDefeated: 0,
      playerAntsLost: 0,
      enemyNestsDestroyed: 0,
      playerNestsLost: 0,
      maxPlayerAnts: this.ants.filter((ant) => ant.faction === ANT_FACTION.player && !ant.dead).length,
    };
    this.outcome = null;
    this.scene.add(this.hitEffectGroup);
    this.scene.add(this.damageTextGroup);
    this.scene.add(this.groundSplatGroup);

    const rearGeometry = new THREE.SphereGeometry(ANT_CONFIG.impostorRearRadius, 8, 6);
    const frontGeometry = new THREE.SphereGeometry(ANT_CONFIG.impostorFrontRadius, 8, 6);
    const rearMaterial = new THREE.MeshToonMaterial({ color: 0xffffff });
    const frontMaterial = new THREE.MeshToonMaterial({ color: 0xffffff });
    this.farRearInstances = new THREE.InstancedMesh(rearGeometry, rearMaterial, this.maxRenderAnts);
    this.farFrontInstances = new THREE.InstancedMesh(frontGeometry, frontMaterial, this.maxRenderAnts);
    for (const instanced of [this.farRearInstances, this.farFrontInstances]) {
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      instanced.frustumCulled = false;
      instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(instanced);
    }

    for (const ant of this.ants) {
      const mesh = createAntVisual(ant.role, ant.colonyId);
      mesh.position.copy(ant.position);
      mesh.rotation.y = Math.atan2(ant.heading.x, ant.heading.z);
      mesh.userData.baseY = ANT_CONFIG.renderOffsetY;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  setCamera(camera) {
    if (!camera) return false;
    this.camera = camera;
    return true;
  }

  spawnAntBatch({ nestId, role, count }) {
    const nest = this.nestLookup.get(nestId);
    if (!nest || nest.collapsed || count <= 0) return 0;

    for (let i = 0; i < count; i += 1) {
      const angle = this.spawnRandom() * Math.PI * 2;
      const distance = this.spawnRandomRange(1.2, 4.6);
      const x = clampToTerrainBounds(nest.position.x + Math.cos(angle) * distance, TERRAIN_CONFIG.width);
      const z = clampToTerrainBounds(nest.position.z + Math.sin(angle) * distance, TERRAIN_CONFIG.depth);
      const ant = createAntState(this.nextAntId, x, z, {
        faction: nest.faction,
        colonyId: nest.colonyId,
        homeNestId: nest.id,
        role,
      }, this.spawnRandom);
      ant.random = this.createAntDecisionRandom(ant.id);
      this.nextAntId += 1;
      this.ants.push(ant);

      const mesh = createAntVisual(ant.role, ant.colonyId);
      mesh.position.copy(ant.position);
      mesh.rotation.y = Math.atan2(ant.heading.x, ant.heading.z);
      mesh.userData.baseY = ANT_CONFIG.renderOffsetY;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    return count;
  }

  getNestRosterSummary(nestId) {
    let workers = 0;
    let fighters = 0;
    let total = 0;

    for (const ant of this.ants) {
      if (ant.dead || ant.homeNestId !== nestId) continue;
      total += 1;
      if (ant.role === ANT_ROLE.worker) workers += 1;
      else if (ant.role === ANT_ROLE.fighter) fighters += 1;
    }

    return { nestId, total, workers, fighters };
  }

  findAntHit(raycaster, { includePlayer = false } = {}) {
    const hits = [];
    for (let i = 0; i < this.ants.length; i += 1) {
      const ant = this.ants[i];
      const mesh = this.meshes[i];
      if (!ant || ant.dead || !mesh?.visible) continue;
      if (!includePlayer && ant.faction === ANT_FACTION.player) continue;
      const intersections = raycaster.intersectObject(mesh, true);
      if (intersections[0]) hits.push({ ant, distance: intersections[0].distance });
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0]?.ant ?? null;
  }

  spawnGroundSplat(position, colonyId, scale = 1) {
    const random = this.effectRandom;
    const group = new THREE.Group();
    const splatCount = 2 + Math.floor(random() * 3);
    for (let i = 0; i < splatCount; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: getBloodColor(colonyId),
        transparent: true,
        opacity: 0.34 + random() * 0.12,
        depthWrite: false,
      });
      material.userData.baseOpacity = material.opacity;
      const radius = (0.1 + random() * 0.12) * scale;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 10), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        (random() - 0.5) * 0.28 * scale,
        0,
        (random() - 0.5) * 0.28 * scale,
      );
      mesh.scale.set(1 + random() * 0.35, 1 + random() * 0.2, 1);
      group.add(mesh);
    }
    group.rotation.y = random() * Math.PI * 2;
    group.position.set(position.x, sampleHeight(position.x, position.z) + 0.03, position.z);
    this.groundSplatGroup.add(group);
    this.groundSplats.push({ mesh: group, life: 18, maxLife: 18 });
  }

  spawnCorpseRemains(position, colonyId, role = ANT_ROLE.worker, scale = 1) {
    const random = this.effectRandom;
    const palette = getAntPalette(role, colonyId);
    const group = new THREE.Group();
    const baseScale = Math.max(0.8, scale);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: palette.body,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    bodyMaterial.userData.baseOpacity = bodyMaterial.opacity;
    const accentMaterial = new THREE.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    accentMaterial.userData.baseOpacity = accentMaterial.opacity;
    const bloodMaterial = new THREE.MeshBasicMaterial({
      color: getBloodColor(colonyId),
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    bloodMaterial.userData.baseOpacity = bloodMaterial.opacity;

    const abdomen = new THREE.Mesh(new THREE.CircleGeometry((role === ANT_ROLE.fighter ? 0.2 : 0.16) * baseScale, 12), bodyMaterial);
    abdomen.rotation.x = -Math.PI / 2;
    abdomen.position.set(-0.08 * baseScale, 0.002, 0);
    abdomen.scale.set(1.2, 0.78, 1);
    group.add(abdomen);

    const thorax = new THREE.Mesh(new THREE.CircleGeometry((role === ANT_ROLE.fighter ? 0.15 : 0.13) * baseScale, 12), accentMaterial);
    thorax.rotation.x = -Math.PI / 2;
    thorax.position.set(0.08 * baseScale, 0.004, 0.02 * baseScale);
    thorax.scale.set(0.95, 0.72, 1);
    group.add(thorax);

    const blood = new THREE.Mesh(new THREE.CircleGeometry(0.21 * baseScale + random() * 0.08, 12), bloodMaterial);
    blood.rotation.x = -Math.PI / 2;
    blood.position.set((random() - 0.5) * 0.08, 0, (random() - 0.5) * 0.08);
    blood.scale.set(1.4 + random() * 0.45, 0.82 + random() * 0.2, 1);
    group.add(blood);

    group.rotation.y = random() * Math.PI * 2;
    group.position.set(position.x, sampleHeight(position.x, position.z) + 0.028, position.z);
    this.groundSplatGroup.add(group);
    const corpseRecord = { mesh: group, life: 26, maxLife: 26, type: 'corpse' };
    this.groundSplats.push(corpseRecord);
    this.corpseRemains.push(corpseRecord);
  }

  spawnPheromoneFootprint(ant, pheromoneType) {
    if (!ant || ant.dead) return;
    const color = pheromoneType === 'food' ? 0x8edb72 : 0x84b9ff;
    const baseOpacity = pheromoneType === 'food' ? 0.2 : 0.16;
    const forward = new THREE.Vector3(ant.heading.x, 0, ant.heading.z);
    if (forward.lengthSq() < 0.0001) forward.set(1, 0, 0);
    forward.normalize();
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    const strideSign = Math.sin((ant.gaitPhase ?? 0) + ant.id * 0.41) >= 0 ? 1 : -1;
    const strideOffset = 0.045 * strideSign;

    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
    });
    material.userData.baseOpacity = baseOpacity;

    for (const sideSign of [-1, 1]) {
      const mark = new THREE.Mesh(new THREE.CircleGeometry(0.068, 10), material);
      mark.rotation.x = -Math.PI / 2;
      mark.scale.set(1.26, 0.72, 1);
      mark.position.copy(side).multiplyScalar(sideSign * 0.075).addScaledVector(forward, strideOffset);
      group.add(mark);
    }

    group.position.set(ant.position.x, sampleHeight(ant.position.x, ant.position.z) + 0.022, ant.position.z);
    group.rotation.y = Math.atan2(forward.x, forward.z);
    this.groundSplatGroup.add(group);
    this.groundSplats.push({ mesh: group, life: 10.5, maxLife: 10.5, type: 'pheromone-trail' });
  }

  markAntDead(ant, { stampScale = 1 } = {}) {
    if (!ant || ant.dead) return false;
    ant.dead = true;
    clearAntAssignments(ant, this.foodSystem, this.foods);
    ant.velocity.setScalar(0);
    ant.desiredVelocity.setScalar(0);
    ant.action = 'dead';
    ant.deathVisualDuration = ANT_CONFIG.deathVisualDuration;
    ant.deathVisualTime = ANT_CONFIG.deathVisualDuration;
    ant.deathTiltDirection = this.effectRandom() < 0.5 ? -1 : 1;
    ant.deathSpin = (this.effectRandom() - 0.5) * 2.8;
    ant.deathStampPlaced = false;
    ant.deathStampScale = stampScale;
    this.spawnGroundSplat(ant.position, ant.colonyId, stampScale);
    return true;
  }

  spawnHitEffect(position, colonyId, intensity = 1) {
    const random = this.effectRandom;
    const particles = [];
    for (let i = 0; i < 4; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: getBloodColor(colonyId),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      material.userData.baseOpacity = 0.9;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.06 * intensity, 8), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(position);
      mesh.position.y += 0.12 + random() * 0.12;
      const angle = (i / 4) * Math.PI * 2 + random() * 0.35;
      const speed = 0.8 + random() * 1.1;
      particles.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 0.6 + random() * 0.7, Math.sin(angle) * speed),
      });
      this.hitEffectGroup.add(mesh);
    }
    this.hitEffects.push({ particles, life: 0.35, maxLife: 0.35 });
    this.spawnGroundSplat(position, colonyId, 0.7 * intensity);
  }

  spawnDamageText(position, damageValue, { large = false } = {}) {
    const roundedDamage = Math.max(0, Math.round(damageValue));
    if (roundedDamage <= 0) return;
    const baseScaleX = large ? DAMAGE_TEXT_CONFIG.largeScaleX : DAMAGE_TEXT_CONFIG.scaleX;
    const baseScaleY = large ? DAMAGE_TEXT_CONFIG.largeScaleY : DAMAGE_TEXT_CONFIG.scaleY;
    const sprite = createDamageTextSprite(`-${roundedDamage}`, {
      scaleX: baseScaleX,
      scaleY: baseScaleY,
    });
    if (!sprite) return;

    const random = this.effectRandom;
    sprite.position.copy(position);
    sprite.position.y += 0.42 + random() * 0.2;
    this.damageTextGroup.add(sprite);

    const driftAngle = random() * Math.PI * 2;
    const driftSpeed = THREE.MathUtils.lerp(DAMAGE_TEXT_CONFIG.driftMin, DAMAGE_TEXT_CONFIG.driftMax, random());
    const riseSpeed = THREE.MathUtils.lerp(DAMAGE_TEXT_CONFIG.riseMin, DAMAGE_TEXT_CONFIG.riseMax, random());
    this.damageTexts.push({
      sprite,
      life: DAMAGE_TEXT_CONFIG.life,
      maxLife: DAMAGE_TEXT_CONFIG.life,
      velocity: new THREE.Vector3(Math.cos(driftAngle) * driftSpeed, riseSpeed, Math.sin(driftAngle) * driftSpeed),
      baseScaleX,
      baseScaleY,
    });
  }

  spawnFoodGainText(position, foodValue) {
    const roundedFood = Math.max(0, Math.round(foodValue));
    if (roundedFood <= 0) return;
    const baseScaleX = DAMAGE_TEXT_CONFIG.largeScaleX;
    const baseScaleY = DAMAGE_TEXT_CONFIG.largeScaleY;
    const sprite = createDamageTextSprite(`+${roundedFood}`, {
      fillStyle: '#6eff75',
      strokeStyle: 'rgba(8, 48, 12, 0.98)',
      scaleX: baseScaleX,
      scaleY: baseScaleY,
    });
    if (!sprite) return;

    const random = this.effectRandom;
    sprite.position.copy(position);
    sprite.position.y += 0.48 + random() * 0.22;
    this.damageTextGroup.add(sprite);

    const driftAngle = random() * Math.PI * 2;
    const driftSpeed = THREE.MathUtils.lerp(DAMAGE_TEXT_CONFIG.driftMin, DAMAGE_TEXT_CONFIG.driftMax, random());
    const riseSpeed = THREE.MathUtils.lerp(DAMAGE_TEXT_CONFIG.riseMin, DAMAGE_TEXT_CONFIG.riseMax, random());
    this.damageTexts.push({
      sprite,
      life: DAMAGE_TEXT_CONFIG.life,
      maxLife: DAMAGE_TEXT_CONFIG.life,
      velocity: new THREE.Vector3(Math.cos(driftAngle) * driftSpeed, riseSpeed, Math.sin(driftAngle) * driftSpeed),
      baseScaleX,
      baseScaleY,
    });
  }

  spawnPurchaseText(position, label) {
    if (!label || typeof label !== 'string') return;
    const baseScaleX = DAMAGE_TEXT_CONFIG.largeScaleX * 1.2;
    const baseScaleY = DAMAGE_TEXT_CONFIG.largeScaleY * 1.2;
    const sprite = createDamageTextSprite(label, {
      fillStyle: '#f8f3a4',
      strokeStyle: 'rgba(72, 58, 8, 0.98)',
      font: '700 66px Inter, Arial Black, sans-serif',
      lineWidth: 10,
      scaleX: baseScaleX,
      scaleY: baseScaleY,
    });
    if (!sprite) return;

    const random = this.effectRandom;
    sprite.position.copy(position);
    sprite.position.y += 1.1 + random() * 0.2;
    this.damageTextGroup.add(sprite);

    const driftAngle = random() * Math.PI * 2;
    const driftSpeed = THREE.MathUtils.lerp(DAMAGE_TEXT_CONFIG.driftMin * 0.6, DAMAGE_TEXT_CONFIG.driftMax * 0.85, random());
    const riseSpeed = THREE.MathUtils.lerp(DAMAGE_TEXT_CONFIG.riseMin * 1.05, DAMAGE_TEXT_CONFIG.riseMax * 1.2, random());
    const life = DAMAGE_TEXT_CONFIG.life * 1.35;
    this.damageTexts.push({
      sprite,
      life,
      maxLife: life,
      velocity: new THREE.Vector3(Math.cos(driftAngle) * driftSpeed, riseSpeed, Math.sin(driftAngle) * driftSpeed),
      baseScaleX,
      baseScaleY,
    });
  }

  updateEffects(dt) {
    this.hitEffects = this.hitEffects.filter((effect) => {
      effect.life -= dt;
      const lifeRatio = Math.max(0, effect.life / effect.maxLife);
      for (const particle of effect.particles) {
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= 4.4 * dt;
        particle.mesh.material.opacity = 0.9 * lifeRatio;
        particle.mesh.scale.setScalar(0.75 + (1 - lifeRatio) * 1.2);
      }
      if (effect.life > 0) return true;
      for (const particle of effect.particles) {
        this.hitEffectGroup.remove(particle.mesh);
        particle.mesh.material.dispose();
        particle.mesh.geometry.dispose();
      }
      return false;
    });

    this.groundSplats = this.groundSplats.filter((splat) => {
      splat.life -= dt;
      const lifeRatio = Math.max(0, splat.life / splat.maxLife);
      splat.mesh.scale.setScalar(1 + (1 - lifeRatio) * 0.35);
      splat.mesh.traverse((child) => {
        if (child.isMesh && child.material) child.material.opacity = (child.material.userData?.baseOpacity ?? 0.4) * lifeRatio;
      });
      if (splat.life > 0) return true;
      this.groundSplatGroup.remove(splat.mesh);
      splat.mesh.traverse((child) => {
        if (child.isMesh) {
          child.material?.dispose?.();
          child.geometry?.dispose?.();
        }
      });
      return false;
    });

    this.corpseRemains = this.corpseRemains.filter((corpse) => corpse.life > 0);

    this.damageTexts = this.damageTexts.filter((textEffect) => {
      textEffect.life -= dt;
      const lifeRatio = Math.max(0, textEffect.life / textEffect.maxLife);
      textEffect.sprite.position.addScaledVector(textEffect.velocity, dt);
      textEffect.velocity.y = Math.max(0.2, textEffect.velocity.y - 1.5 * dt);
      textEffect.sprite.material.opacity = (textEffect.sprite.material.userData?.baseOpacity ?? 0.98) * lifeRatio;
      const scale = 1 + (1 - lifeRatio) * 0.2;
      const baseScaleX = textEffect.baseScaleX ?? DAMAGE_TEXT_CONFIG.scaleX;
      const baseScaleY = textEffect.baseScaleY ?? DAMAGE_TEXT_CONFIG.scaleY;
      textEffect.sprite.scale.set(
        baseScaleX * scale,
        baseScaleY * scale,
        1,
      );

      if (textEffect.life > 0) return true;
      this.damageTextGroup.remove(textEffect.sprite);
      textEffect.sprite.material.map?.dispose?.();
      textEffect.sprite.material.dispose?.();
      return false;
    });

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
        if ((ant.deathVisualTime ?? 0) > 0) {
          ant.deathVisualTime = Math.max(0, ant.deathVisualTime - dt);
          const duration = Math.max(0.0001, ant.deathVisualDuration ?? ANT_CONFIG.deathVisualDuration);
          const ratio = 1 - (ant.deathVisualTime / duration);
          mesh.visible = true;
          ant.visible = true;
          mesh.position.copy(ant.position);
          mesh.position.y += ANT_CONFIG.renderOffsetY - ratio * 0.06;
          mesh.rotation.x = (ant.deathTiltDirection ?? 1) * THREE.MathUtils.lerp(0.1, 1.42, ratio);
          mesh.rotation.y = Math.atan2(ant.heading.x, ant.heading.z) + (ant.deathSpin ?? 0) * ratio;
          mesh.rotation.z = (ant.deathTiltDirection ?? 1) * ratio * 0.24;
          mesh.scale.setScalar(1 - ratio * 0.16);
          if (ant.deathVisualTime <= 0 && !ant.deathStampPlaced) {
            this.spawnCorpseRemains(ant.position, ant.colonyId, ant.role, ant.deathStampScale ?? 1);
            ant.deathStampPlaced = true;
          }
        } else {
          if (!ant.deathStampPlaced) {
            this.spawnCorpseRemains(ant.position, ant.colonyId, ant.role, ant.deathStampScale ?? 1);
            ant.deathStampPlaced = true;
          }
          mesh.visible = false;
          ant.visible = false;
        }
        continue;
      }

      const distanceToCamera = getEffectiveCameraDistance(this.camera, ant.position, this.cameraWorldPosition);

      ant.lodBand = getLodBandForDistance(distanceToCamera);
      ant.brainInterval = getBrainIntervalForDistance(distanceToCamera);
      ant.logicInterval = getLogicIntervalForDistance(distanceToCamera);

      ant.brainCooldown -= dt;
      if (ant.brainCooldown <= 0) {
        updateBrain(ant, distanceToCamera, this.foods, this.ants, this.pheromoneSystem, this.focusTarget, this.nestLookup, ant.random ?? this.decisionRandom);
        ant.brainCooldown = ant.brainInterval;
      }

      ant.logicCooldown -= dt;
      ant.attackCooldownRemaining = Math.max(0, ant.attackCooldownRemaining - dt);
      if (ant.logicCooldown <= 0) {
        if (ant.role === ANT_ROLE.fighter || ant.role === ANT_ROLE.worker) {
          const target = findCombatTarget(ant, this.ants);
          if (target) {
            ant.combatTargetId = target.id;
            ant.target.set(target.position.x, 0, target.position.z);
            const targetDistance = ant.position.distanceTo(target.position);
            const attackRange = ant.role === ANT_ROLE.worker ? ANT_CONFIG.workerAttackRange : ANT_CONFIG.fighterAttackRange;
            const attackCooldown = ant.role === ANT_ROLE.worker ? ANT_CONFIG.workerAttackCooldown : ANT_CONFIG.fighterAttackCooldown;
            const attackDamage = ant.role === ANT_ROLE.worker ? ANT_CONFIG.workerAttackDamage : ANT_CONFIG.fighterAttackDamage;
            if (targetDistance <= attackRange) {
              ant.action = 'attack';
              ant.desiredVelocity.setScalar(0);
              ant.attackVisualTime = attackCooldown * 0.65;
              if (ant.attackCooldownRemaining <= 0) {
                ant.attackCooldownRemaining = attackCooldown;
                const previousHp = target.hp;
                target.hp = Math.max(0, target.hp - attackDamage);
                const damageApplied = Math.max(0, previousHp - target.hp);
                target.hitFlashTime = 0.2;
                this.spawnHitEffect(target.position, target.colonyId, target.hp <= 0 ? 1.4 : 1);
                this.spawnDamageText(target.position, damageApplied);
                if (target.hp <= 0 && !target.dead) {
                  this.markAntDead(target, { stampScale: 1.6 });
                  if (target.faction === ANT_FACTION.enemy) this.stats.enemyAntsDefeated += 1;
                  if (target.faction === ANT_FACTION.player) this.stats.playerAntsLost += 1;
                }
              }
            }
          } else if (ant.role === ANT_ROLE.fighter) {
            const siegeNest = findSiegeTargetNest(ant, this.nests);
            if (siegeNest) {
              const canSiege = ant.faction !== ANT_FACTION.enemy
                || this.foodSystem.getNestStored(ant.homeNestId) >= ANT_CONFIG.enemyNestSiegeStoredThreshold;
              if (!canSiege) {
                ant.combatTargetId = null;
              } else {
                ant.combatTargetId = siegeNest.id;
                ant.target.set(siegeNest.position.x, 0, siegeNest.position.z);
                const siegeDistance = ant.position.distanceTo(siegeNest.position);
                if (siegeDistance <= ANT_CONFIG.fighterNestAttackRange) {
                  ant.action = 'attack-nest';
                  ant.desiredVelocity.setScalar(0);
                  ant.attackVisualTime = ANT_CONFIG.fighterAttackCooldown * 0.65;
                  if (ant.attackCooldownRemaining <= 0) {
                    ant.attackCooldownRemaining = ANT_CONFIG.fighterAttackCooldown;
                    const damageResult = this.foodSystem.damageNest(siegeNest.id, ANT_CONFIG.fighterNestAttackDamage);
                    const impactPoint = getNestImpactPoint(ant, siegeNest);
                    this.spawnHitEffect(impactPoint, siegeNest.colonyId, 0.85);
                    this.spawnDamageText(impactPoint, damageResult?.damageApplied ?? 0, { large: true });
                    if (damageResult?.justCollapsed) {
                      if (siegeNest.faction === ANT_FACTION.enemy) this.stats.enemyNestsDestroyed += 1;
                      if (siegeNest.faction === ANT_FACTION.player) this.stats.playerNestsLost += 1;
                      const collapseResult = resolveNestCollapse(siegeNest, this.ants, this.nests);
                      const killedAntIds = new Set(collapseResult.killedIds);
                      for (const collapsedAnt of this.ants) {
                        if (!killedAntIds.has(collapsedAnt.id)) continue;
                        if (!collapsedAnt.dead) {
                          this.markAntDead(collapsedAnt, { stampScale: 1.8 });
                          if (collapsedAnt.faction === ANT_FACTION.enemy) this.stats.enemyAntsDefeated += 1;
                          if (collapsedAnt.faction === ANT_FACTION.player) this.stats.playerAntsLost += 1;
                        }
                      }
                      for (const reassignedAnt of this.ants) {
                        if (!collapseResult.reassignedIds.includes(reassignedAnt.id)) continue;
                        clearAntAssignments(reassignedAnt, this.foodSystem, this.foods);
                        reassignedAnt.action = 'wander';
                        reassignedAnt.nestApproachStage = 'queue';
                      }
                    }
                  }
                }
              }
            } else {
              ant.combatTargetId = null;
            }
          } else {
            ant.combatTargetId = null;
          }
        }

        if (ant.action === 'seek-food' && ant.targetFoodId != null) {
          const food = getFoodById(this.foods, ant.targetFoodId);
          if (!food || food.delivered || food.carried) chooseNextAction(ant, ant.random ?? this.decisionRandom);
        }

        if (ant.action !== 'attack' && ant.action !== 'attack-nest') updateActionVelocity(ant, this.foodSystem, this.foods);

        if (ant.action === 'seek-food' && ant.targetFoodId != null) {
          const food = getFoodById(this.foods, ant.targetFoodId);
          if (food && ant.position.distanceTo(food.position) <= FOOD_CONFIG.pickupDistance) {
            this.foodSystem.claimFood(food.id, ant.id, ant.colonyId);
            const pickedUp = this.foodSystem.pickUpFood(food.id, ant.id, ant.colonyId);
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
            chooseNextAction(ant, ant.random ?? this.decisionRandom);
          } else if (ant.position.distanceTo(food.position) <= ANT_CONFIG.assistCarryDistance * 1.15) {
            this.foodSystem.joinCarry(food.id, ant.id, ant.colonyId);
          } else {
            this.foodSystem.leaveCarry(food.id, ant.id);
          }
        }

        if (ant.action === 'carry-food' && ant.carryingFoodId != null) {
          const carriedFood = getFoodById(this.foods, ant.carryingFoodId);
          const carryStateInvalid = !carriedFood
            || carriedFood.delivered
            || !carriedFood.carried
            || carriedFood.carriedBy !== ant.id;
          if (carryStateInvalid) {
            clearAntAssignments(ant, this.foodSystem, this.foods);
            chooseNextAction(ant, ant.random ?? this.decisionRandom);
            ant.logicCooldown = ant.logicInterval;
            continue;
          }

          const homeNestPosition = getHomeNestPosition(ant, this.nestLookup);
          ant.queuedNestSlot ??= this.foodSystem.reserveNestSlot(ant.id, ant.position, ant.homeNestId);
          const approachTarget = getCarryApproachTarget(ant, homeNestPosition);
          ant.target.set(approachTarget.x, 0, approachTarget.z);
          if (ant.position.distanceTo(homeNestPosition) <= NEST_CONFIG.dropoffDistance) {
            const dropped = this.foodSystem.dropFoodInNest(ant.carryingFoodId, ant.id, ant.homeNestId);
            if (dropped) {
              this.spawnFoodGainText(homeNestPosition, carriedFood.weight);
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
      ant.attackVisualTime = Math.max(0, (ant.attackVisualTime ?? 0) - dt);
      ant.hitFlashTime = Math.max(0, (ant.hitFlashTime ?? 0) - dt);
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

      const pheromoneType = ant.carryingFoodId != null
        ? 'food'
        : (ant.role === ANT_ROLE.worker ? 'home' : null);
      if (pheromoneType === 'food') this.pheromoneSystem.deposit('food', ant.position, PHEROMONE_CONFIG.depositFood * dt * 6);
      else if (pheromoneType === 'home') this.pheromoneSystem.deposit('home', ant.position, PHEROMONE_CONFIG.depositHome * dt * 4);

      if (pheromoneType && ant.velocity.lengthSq() >= ANT_CONFIG.pheromoneTrailSpeedSqThreshold) {
        ant.pheromoneTrailCooldown = Math.max(0, (ant.pheromoneTrailCooldown ?? 0) - dt);
        if (ant.pheromoneTrailCooldown <= 0) {
          this.spawnPheromoneFootprint(ant, pheromoneType);
          const cadence = Math.abs(Math.sin((ant.gaitPhase ?? 0) + ant.id * 0.23));
          ant.pheromoneTrailCooldown = THREE.MathUtils.lerp(
            ANT_CONFIG.pheromoneTrailMinInterval,
            ANT_CONFIG.pheromoneTrailMaxInterval,
            cadence,
          );
        }
      }

      ant.gaitPhase += dt * (2.5 + ant.velocity.length() * 1.8);
      const bobY = Math.sin(ant.gaitPhase) * 0.04;
      const rotationY = Math.atan2(ant.heading.x, ant.heading.z);
      const rollZ = Math.sin(ant.gaitPhase) * 0.05;

      updateVisibility(ant, mesh, distanceToCamera, this.frustum);
      const useFullMesh = ant.visible && distanceToCamera <= ANT_CONFIG.fullMeshDistance;
      if (useFullMesh) {
        mesh.visible = true;
        mesh.position.copy(ant.position);
        let attackTilt = 0;
        if (ant.attackVisualTime > 0) {
          const attackCycle = Math.max(0.0001, (ant.role === ANT_ROLE.worker ? ANT_CONFIG.workerAttackCooldown : ANT_CONFIG.fighterAttackCooldown) * 0.65);
          const thrustRatio = Math.sin((1 - ant.attackVisualTime / attackCycle) * Math.PI);
          this.tmpLungeOffset.copy(ant.heading).multiplyScalar(0.28 * thrustRatio);
          mesh.position.add(this.tmpLungeOffset);
          attackTilt = -0.22 * thrustRatio;
        }
        if (ant.hitFlashTime > 0) {
          const hitRatio = ant.hitFlashTime / 0.2;
          this.tmpLungeOffset.copy(ant.heading).multiplyScalar(-0.1 * hitRatio);
          mesh.position.add(this.tmpLungeOffset);
          mesh.position.y += Math.sin(hitRatio * Math.PI) * 0.05;
        }
        mesh.position.y += ANT_CONFIG.renderOffsetY + bobY;
        mesh.rotation.x = attackTilt;
        mesh.rotation.y = rotationY;
        mesh.rotation.z = rollZ;
        mesh.scale.setScalar(ant.hitFlashTime > 0 ? 1 + (ant.hitFlashTime / 0.2) * 0.08 : 1);
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
        const palette = getAntPalette(ant.role, ant.colonyId);
        this.farRearInstances.setColorAt(this.farInstanceCount, new THREE.Color(palette.body));
        this.farFrontInstances.setColorAt(this.farInstanceCount, new THREE.Color(palette.accent));
        this.farInstanceCount += 1;
      }
    }

    this.stats.maxPlayerAnts = Math.max(
      this.stats.maxPlayerAnts,
      this.ants.filter((ant) => ant.faction === ANT_FACTION.player && !ant.dead).length,
    );

    if (!this.outcome) {
      this.outcome = resolveObjectiveOutcome({ objective: this.objective, foodSystem: this.foodSystem });
    }

    this.updateEffects(dt);

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

  getOutcome() {
    return this.outcome;
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
