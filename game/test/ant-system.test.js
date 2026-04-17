import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { ANT_CONFIG, ANT_LOD, ANT_ROLE, AntSystem, PLAYER_STARTING_COUNTS, buildSpatialHash, createAntVisual, createRandomAntStates, findCombatTarget, findSiegeTargetNest, getBrainIntervalForDistance, getLodBandForDistance, getMaxHpForRole, querySpatialHash, resolveNestCollapse } from '../src/ant-system.js';
import { COLONY, FoodSystem } from '../src/food-system.js';
import { createSeededRandom, deriveSeed } from '../src/seeded-random.js';
import { TERRAIN_CONFIG } from '../src/terrain.js';

const createTestPheromoneSystem = () => ({
  update() {},
  deposit() {},
  sample() { return new THREE.Vector3(); },
});

const createSeededAntSystem = ({
  setupSeed = 'test-setup',
  spawnSeed = 'test-spawn',
  decisionSeed = 'test-runtime',
  effectSeed = 'test-effects',
} = {}) => {
  const scene = new THREE.Scene();
  const foodSystem = new FoodSystem({ scene, count: 0, enemyNestCount: 0 });
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 16, 18);
  camera.lookAt(0, 0, 0);

  return new AntSystem({
    scene,
    camera,
    foodSystem,
    pheromoneSystem: createTestPheromoneSystem(),
    foods: foodSystem.items,
    nests: foodSystem.nests,
    count: 1,
    levelSetup: {
      playerStartingCounts: { workers: 1, fighters: 0 },
      enemyStartingPerNest: 0,
      enemyWorkerRatio: 1,
    },
    setupRandom: createSeededRandom(setupSeed),
    spawnRandom: createSeededRandom(spawnSeed),
    decisionSeed,
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
  });
};

const snapshotDecisionAnt = (ant) => ({
  action: ant.action,
  targetX: Number(ant.target.x.toFixed(4)),
  targetZ: Number(ant.target.z.toFixed(4)),
  desiredX: Number(ant.desiredVelocity.x.toFixed(4)),
  desiredZ: Number(ant.desiredVelocity.z.toFixed(4)),
  headingX: Number(ant.heading.x.toFixed(4)),
  headingZ: Number(ant.heading.z.toFixed(4)),
});

const snapshotSpawnedAnts = (ants) => ants.map((ant) => ({
  id: ant.id,
  role: ant.role,
  homeNestId: ant.homeNestId,
  x: Number(ant.position.x.toFixed(4)),
  z: Number(ant.position.z.toFixed(4)),
  brainCooldown: Number(ant.brainCooldown.toFixed(4)),
  logicCooldown: Number(ant.logicCooldown.toFixed(4)),
  gaitPhase: Number(ant.gaitPhase.toFixed(4)),
}));

const round = (value) => Number(value.toFixed(4));

const snapshotEffectState = (antSystem) => ({
  groundSplats: antSystem.groundSplats.map((splat) => ({
    rotationY: round(splat.mesh.rotation.y),
    pieces: splat.mesh.children.map((child) => ({
      x: round(child.position.x),
      z: round(child.position.z),
      scaleX: round(child.scale.x),
      scaleY: round(child.scale.y),
      opacity: round(child.material.opacity),
    })),
  })),
  corpses: antSystem.corpseRemains.map((corpse) => ({
    rotationY: round(corpse.mesh.rotation.y),
    rotationZ: round(corpse.mesh.rotation.z),
  })),
  hitEffects: antSystem.hitEffects.map((effect) => ({
    particles: effect.particles.map((particle) => ({
      x: round(particle.mesh.position.x),
      y: round(particle.mesh.position.y),
      z: round(particle.mesh.position.z),
      velocityX: round(particle.velocity.x),
      velocityY: round(particle.velocity.y),
      velocityZ: round(particle.velocity.z),
    })),
  })),
});

describe('ant system helpers', () => {
  test('creates the starting colony within the terrain bounds', () => {
    const ants = createRandomAntStates(ANT_CONFIG.count);

    expect(ants).toHaveLength(PLAYER_STARTING_COUNTS.workers + PLAYER_STARTING_COUNTS.fighters);
    for (const ant of ants) {
      expect(ant.position.x).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.width / 2);
      expect(ant.position.x).toBeLessThanOrEqual(TERRAIN_CONFIG.width / 2);
      expect(ant.position.z).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.depth / 2);
      expect(ant.position.z).toBeLessThanOrEqual(TERRAIN_CONFIG.depth / 2);
      expect(ant.position.y).toBeGreaterThanOrEqual(ant.radius - TERRAIN_CONFIG.maxHeight - 0.001);
      expect(ant.position.y).toBeLessThanOrEqual(ant.radius + TERRAIN_CONFIG.maxHeight + 0.001);
      expect(ANT_CONFIG.renderOffsetY).toBeLessThan(0);
      expect([ANT_ROLE.worker, ANT_ROLE.fighter]).toContain(ant.role);
      expect(ant.faction).toBe('player');
      expect(ant.homeNestId).toBe('player-1');
      expect(ant.carryingFoodId).toBeNull();
      expect(ant.action).toBe('wander');
    }
  });

  test('assigns role-specific HP budgets', () => {
    expect(getMaxHpForRole(ANT_ROLE.worker)).toBeLessThan(getMaxHpForRole(ANT_ROLE.fighter));
  });

  test('fighters prefer nearby enemy fighters as combat targets', () => {
    const fighter = createRandomAntStates(1)[0];
    fighter.role = ANT_ROLE.fighter;
    fighter.faction = 'player';
    fighter.colonyId = COLONY.player;
    fighter.position.set(0, fighter.position.y, 0);

    const enemyWorker = createRandomAntStates(1)[0];
    enemyWorker.role = ANT_ROLE.worker;
    enemyWorker.faction = 'enemy';
    enemyWorker.colonyId = COLONY.enemyAlpha;
    enemyWorker.position.set(1.4, enemyWorker.position.y, 0);

    const enemyFighter = createRandomAntStates(1)[0];
    enemyFighter.role = ANT_ROLE.fighter;
    enemyFighter.faction = 'enemy';
    enemyFighter.colonyId = COLONY.enemyAlpha;
    enemyFighter.position.set(2.2, enemyFighter.position.y, 0);

    expect(findCombatTarget(fighter, [fighter, enemyWorker, enemyFighter])?.role).toBe(ANT_ROLE.fighter);
  });

  test('fighters prioritize hostile fighters over hostile carriers', () => {
    const fighter = createRandomAntStates(1)[0];
    fighter.role = ANT_ROLE.fighter;
    fighter.faction = 'player';
    fighter.colonyId = COLONY.player;
    fighter.position.set(0, fighter.position.y, 0);

    const enemyFighter = createRandomAntStates(1)[0];
    enemyFighter.role = ANT_ROLE.fighter;
    enemyFighter.faction = 'enemy';
    enemyFighter.colonyId = COLONY.enemyAlpha;
    enemyFighter.position.set(2.2, enemyFighter.position.y, 0);

    const enemyCarrier = createRandomAntStates(1)[0];
    enemyCarrier.role = ANT_ROLE.worker;
    enemyCarrier.faction = 'enemy';
    enemyCarrier.colonyId = COLONY.enemyAlpha;
    enemyCarrier.carryingFoodId = 1;
    enemyCarrier.position.set(2.8, enemyCarrier.position.y, 0);

    expect(findCombatTarget(fighter, [fighter, enemyFighter, enemyCarrier])?.id).toBe(enemyFighter.id);
  });

  test('fighters prioritize enemy fighters threatening nearby friendly workers', () => {
    const fighter = createRandomAntStates(1)[0];
    fighter.role = ANT_ROLE.fighter;
    fighter.faction = 'player';
    fighter.colonyId = COLONY.player;
    fighter.position.set(0, fighter.position.y, 0);

    const friendlyWorker = createRandomAntStates(1)[0];
    friendlyWorker.role = ANT_ROLE.worker;
    friendlyWorker.faction = 'player';
    friendlyWorker.colonyId = COLONY.player;
    friendlyWorker.position.set(6.4, friendlyWorker.position.y, 0);

    const nearbyEnemyFighter = createRandomAntStates(1)[0];
    nearbyEnemyFighter.role = ANT_ROLE.fighter;
    nearbyEnemyFighter.faction = 'enemy';
    nearbyEnemyFighter.colonyId = COLONY.enemyAlpha;
    nearbyEnemyFighter.position.set(3.2, nearbyEnemyFighter.position.y, 0);

    const threateningEnemyFighter = createRandomAntStates(1)[0];
    threateningEnemyFighter.role = ANT_ROLE.fighter;
    threateningEnemyFighter.faction = 'enemy';
    threateningEnemyFighter.colonyId = COLONY.enemyAlpha;
    threateningEnemyFighter.position.set(7.1, threateningEnemyFighter.position.y, 0);

    expect(findCombatTarget(fighter, [fighter, friendlyWorker, nearbyEnemyFighter, threateningEnemyFighter])?.id).toBe(threateningEnemyFighter.id);
  });

  test('workers only target hostile fighters when defending', () => {
    const worker = createRandomAntStates(1)[0];
    worker.role = ANT_ROLE.worker;
    worker.faction = 'player';
    worker.colonyId = COLONY.player;
    worker.position.set(0, worker.position.y, 0);

    const enemyWorker = createRandomAntStates(1)[0];
    enemyWorker.role = ANT_ROLE.worker;
    enemyWorker.faction = 'enemy';
    enemyWorker.colonyId = COLONY.enemyAlpha;
    enemyWorker.position.set(1.2, enemyWorker.position.y, 0);

    const enemyFighter = createRandomAntStates(1)[0];
    enemyFighter.role = ANT_ROLE.fighter;
    enemyFighter.faction = 'enemy';
    enemyFighter.colonyId = COLONY.enemyAlpha;
    enemyFighter.position.set(2.2, enemyFighter.position.y, 0);

    expect(findCombatTarget(worker, [worker, enemyWorker, enemyFighter])?.role).toBe(ANT_ROLE.fighter);
  });

  test('spawns enemy ants when enemy nests exist', () => {
    const nests = [
      { id: 'player-1', faction: 'player', colonyId: COLONY.player, position: new THREE.Vector3(0, 0, 0) },
      { id: 'enemy-1', faction: 'enemy', colonyId: COLONY.enemyAlpha, position: new THREE.Vector3(10, 0, 10) },
      { id: 'enemy-2', faction: 'enemy', colonyId: COLONY.enemyBeta, position: new THREE.Vector3(-10, 0, -10) },
    ];
    const ants = createRandomAntStates(120, nests);

    expect(ants.some((ant) => ant.faction === 'enemy')).toBe(true);
    expect(ants.some((ant) => ant.homeNestId === 'enemy-1')).toBe(true);
    expect(ants.some((ant) => ant.homeNestId === 'enemy-2')).toBe(true);
    expect(ants.some((ant) => ant.colonyId === COLONY.enemyAlpha)).toBe(true);
    expect(ants.some((ant) => ant.colonyId === COLONY.enemyBeta)).toBe(true);
    expect(ants.some((ant) => ant.faction === 'enemy' && ant.role === ANT_ROLE.worker)).toBe(true);
  });

  test('supports level-specific opening setups and enemy doctrine', () => {
    const nests = [
      { id: 'player-1', faction: 'player', colonyId: COLONY.player, position: new THREE.Vector3(0, 0, 0) },
      { id: 'enemy-1', faction: 'enemy', colonyId: COLONY.enemyAlpha, position: new THREE.Vector3(10, 0, 10) },
    ];

    const ants = createRandomAntStates(160, nests, {
      playerStartingCounts: { workers: 6, fighters: 4 },
      enemyStartingPerNest: 12,
      enemyWorkerRatio: 0,
    });

    expect(ants.filter((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker)).toHaveLength(6);
    expect(ants.filter((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.fighter)).toHaveLength(4);
    expect(ants.filter((ant) => ant.faction === 'enemy')).toHaveLength(12);
    expect(ants.filter((ant) => ant.faction === 'enemy' && ant.role === ANT_ROLE.fighter)).toHaveLength(12);
  });

  test('fighters can select the nearest hostile active nest for siege', () => {
    const fighter = createRandomAntStates(1)[0];
    fighter.role = ANT_ROLE.fighter;
    fighter.faction = 'player';
    fighter.colonyId = COLONY.player;
    fighter.position.set(0, fighter.position.y, 0);

    const nests = [
      { id: 'enemy-1', faction: 'enemy', colonyId: COLONY.enemyAlpha, position: new THREE.Vector3(8, 0, 0), collapsed: false },
      { id: 'enemy-2', faction: 'enemy', colonyId: COLONY.enemyBeta, position: new THREE.Vector3(4, 0, 0), collapsed: true },
      { id: 'player-1', faction: 'player', colonyId: COLONY.player, position: new THREE.Vector3(-2, 0, 0), collapsed: false },
    ];

    expect(findSiegeTargetNest(fighter, nests)?.id).toBe('enemy-1');
  });

  test('fighters prefer weakened hostile nests when choosing siege targets', () => {
    const fighter = createRandomAntStates(1)[0];
    fighter.role = ANT_ROLE.fighter;
    fighter.faction = 'player';
    fighter.colonyId = COLONY.player;
    fighter.position.set(0, fighter.position.y, 0);

    const nests = [
      { id: 'enemy-1', faction: 'enemy', colonyId: COLONY.enemyAlpha, position: new THREE.Vector3(4.4, 0, 0), collapsed: false, hp: 260, maxHp: 260 },
      { id: 'enemy-2', faction: 'enemy', colonyId: COLONY.enemyBeta, position: new THREE.Vector3(6.2, 0, 0), collapsed: false, hp: 92, maxHp: 260 },
    ];

    expect(findSiegeTargetNest(fighter, nests)?.id).toBe('enemy-2');
  });

  test('nest collapse kills part of the colony and reassigns survivors when possible', () => {
    const ants = createRandomAntStates(3);
    ants[0].homeNestId = 'enemy-1';
    ants[0].faction = 'enemy';
    ants[0].colonyId = COLONY.enemyAlpha;
    ants[1].homeNestId = 'enemy-1';
    ants[1].faction = 'enemy';
    ants[1].colonyId = COLONY.enemyAlpha;
    ants[2].homeNestId = 'enemy-1';
    ants[2].faction = 'enemy';
    ants[2].colonyId = COLONY.enemyAlpha;

    const nests = [
      { id: 'enemy-1', faction: 'enemy', colonyId: COLONY.enemyAlpha, position: new THREE.Vector3(0, 0, 0), collapsed: true },
      { id: 'enemy-2', faction: 'enemy', colonyId: COLONY.enemyAlpha, position: new THREE.Vector3(10, 0, 0), collapsed: false },
    ];

    const result = resolveNestCollapse(nests[0], ants, nests);

    expect(result.killedIds).toHaveLength(1);
    expect(result.reassignedIds).toHaveLength(2);
  });

  test('uses the requested starting class counts for the player colony', () => {
    const ants = createRandomAntStates();

    expect(ants.filter((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker)).toHaveLength(PLAYER_STARTING_COUNTS.workers);
    expect(ants.filter((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.fighter)).toHaveLength(PLAYER_STARTING_COUNTS.fighters);
  });

  test('slows brain cadence for distant ants', () => {
    expect(getBrainIntervalForDistance(5)).toBe(ANT_CONFIG.closeBrainInterval);
    expect(getBrainIntervalForDistance(40)).toBe(ANT_CONFIG.midBrainInterval);
    expect(getBrainIntervalForDistance(80)).toBe(ANT_CONFIG.farBrainInterval);
  });

  test('assigns explicit simulation LOD bands by camera distance', () => {
    expect(getLodBandForDistance(5)).toBe(ANT_LOD.near);
    expect(getLodBandForDistance(40)).toBe(ANT_LOD.mid);
    expect(getLodBandForDistance(80)).toBe(ANT_LOD.far);
  });

  test('uses a spatial hash to retrieve nearby ants', () => {
    const ants = createRandomAntStates(3);
    ants[0].position.set(0, ants[0].position.y, 0);
    ants[1].position.set(1.2, ants[1].position.y, 0.6);
    ants[2].position.set(20, ants[2].position.y, 20);

    const hash = buildSpatialHash(ants, ANT_CONFIG.cellSize);
    const neighbors = querySpatialHash(hash, 0, 0, ANT_CONFIG.cellSize);

    expect(neighbors).toContain(ants[0]);
    expect(neighbors).toContain(ants[1]);
    expect(neighbors).not.toContain(ants[2]);
  });

  test('rendered impostor body is smaller than the full collision sphere', () => {
    expect(ANT_CONFIG.impostorFrontRadius).toBeLessThan(ANT_CONFIG.bodyRadius);
    expect(ANT_CONFIG.impostorRearRadius).toBeLessThan(ANT_CONFIG.bodyRadius);
    expect(ANT_CONFIG.impostorRearRadius).toBeGreaterThan(ANT_CONFIG.impostorFrontRadius);
    expect(new THREE.Vector3(0, ANT_CONFIG.renderOffsetY, 0).y).toBeLessThan(0);
  });

  test('full ant visual keeps six animatable leg meshes', () => {
    const visual = createAntVisual();

    expect(visual.userData.legs).toHaveLength(6);
    for (const leg of visual.userData.legs) {
      expect(leg.userData.baseRotation).toBeTruthy();
    }
  });

  test('player and enemy workers use distinct tinted materials', () => {
    const playerWorker = createAntVisual(ANT_ROLE.worker, COLONY.player);
    const enemyWorker = createAntVisual(ANT_ROLE.worker, COLONY.enemyAlpha);
    const enemyWorkerBeta = createAntVisual(ANT_ROLE.worker, COLONY.enemyBeta);

    expect(playerWorker.children[0].material.color.getHex()).not.toBe(enemyWorker.children[0].material.color.getHex());
    expect(enemyWorker.children[0].material.color.getHex()).not.toBe(enemyWorkerBeta.children[0].material.color.getHex());
  });

  test('can spawn an ant batch at a nest for upgrades', () => {
    const scene = new THREE.Scene();
    const foodSystem = new FoodSystem({ scene, count: 0 });
    const camera = new THREE.PerspectiveCamera();
    const pheromoneSystem = {
      update() {},
      deposit() {},
      sample() { return new THREE.Vector3(); },
    };
    const antSystem = new AntSystem({ scene, camera, foodSystem, pheromoneSystem, foods: foodSystem.items, nests: foodSystem.nests, count: 80 });
    const before = antSystem.ants.length;

    const spawned = antSystem.spawnAntBatch({ nestId: 'player-1', role: ANT_ROLE.worker, count: 4 });

    expect(spawned).toBe(4);
    expect(antSystem.ants).toHaveLength(before + 4);
    expect(antSystem.ants.slice(-4).every((ant) => ant.homeNestId === 'player-1' && ant.role === ANT_ROLE.worker)).toBe(true);
  });

  test('reports live roster counts for a specific nest', () => {
    const scene = new THREE.Scene();
    const foodSystem = new FoodSystem({ scene, count: 0 });
    const camera = new THREE.PerspectiveCamera();
    const pheromoneSystem = {
      update() {},
      deposit() {},
      sample() { return new THREE.Vector3(); },
    };
    const antSystem = new AntSystem({ scene, camera, foodSystem, pheromoneSystem, foods: foodSystem.items, nests: foodSystem.nests, count: 80 });
    antSystem.spawnAntBatch({ nestId: 'enemy-1', role: ANT_ROLE.worker, count: 2 });
    antSystem.spawnAntBatch({ nestId: 'enemy-1', role: ANT_ROLE.fighter, count: 1 });

    const roster = antSystem.getNestRosterSummary('enemy-1');

    expect(roster.workers).toBeGreaterThanOrEqual(2);
    expect(roster.fighters).toBeGreaterThanOrEqual(1);
    expect(roster.total).toBe(roster.workers + roster.fighters);
  });

  test('replays runtime ant decisions from the same seeded stream', () => {
    const runtimeSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const first = createSeededAntSystem({ decisionSeed: runtimeSeed });
    const second = createSeededAntSystem({ decisionSeed: runtimeSeed });
    const third = createSeededAntSystem({ decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime') });

    for (const system of [first, second, third]) {
      const ant = system.ants[0];
      ant.position.set(0, ant.position.y, 0);
      ant.heading.set(1, 0, 0);
      ant.target.set(0, 0, 0);
      ant.velocity.setScalar(0);
      ant.desiredVelocity.setScalar(0);
      ant.brainCooldown = 0;
      ant.logicCooldown = 0;
      system.update(0.2);
    }

    expect(snapshotDecisionAnt(first.ants[0])).toEqual(snapshotDecisionAnt(second.ants[0]));
    expect(snapshotDecisionAnt(first.ants[0])).not.toEqual(snapshotDecisionAnt(third.ants[0]));
  });

  test('replays spawned reinforcement batches from the same seeded spawn stream', () => {
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const first = createSeededAntSystem({ spawnSeed, decisionSeed: deriveSeed('ant-battle-level-12', 'ants-runtime-a') });
    const second = createSeededAntSystem({ spawnSeed, decisionSeed: deriveSeed('ant-battle-level-12', 'ants-runtime-b') });
    const third = createSeededAntSystem({ spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn') });

    for (const system of [first, second, third]) {
      system.spawnAntBatch({ nestId: 'player-1', role: ANT_ROLE.worker, count: 3 });
    }

    expect(snapshotSpawnedAnts(first.ants.slice(-3))).toEqual(snapshotSpawnedAnts(second.ants.slice(-3)));
    expect(snapshotSpawnedAnts(first.ants.slice(-3))).not.toEqual(snapshotSpawnedAnts(third.ants.slice(-3)));
  });

  test('replays combat aftermath presentation from the same seeded effects stream', () => {
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');
    const first = createSeededAntSystem({ effectSeed });
    const second = createSeededAntSystem({ effectSeed });
    const third = createSeededAntSystem({ effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects') });
    const position = new THREE.Vector3(2, 0, -1);

    for (const system of [first, second, third]) {
      system.spawnGroundSplat(position, COLONY.enemyAlpha, 0.9);
      system.spawnCorpseRemains(position, COLONY.enemyAlpha, ANT_ROLE.fighter);
      system.spawnHitEffect(position, COLONY.enemyAlpha, 1.1);
    }

    expect(snapshotEffectState(first)).toEqual(snapshotEffectState(second));
    expect(snapshotEffectState(first)).not.toEqual(snapshotEffectState(third));
  });
});
