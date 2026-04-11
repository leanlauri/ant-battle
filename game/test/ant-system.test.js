import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { ANT_CONFIG, ANT_LOD, ANT_ROLE, AntSystem, PLAYER_STARTING_COUNTS, buildSpatialHash, createAntVisual, createRandomAntStates, findCombatTarget, findSiegeTargetNest, getBrainIntervalForDistance, getLodBandForDistance, getMaxHpForRole, querySpatialHash, resolveNestCollapse } from '../src/ant-system.js';
import { COLONY, FoodSystem } from '../src/food-system.js';
import { TERRAIN_CONFIG } from '../src/terrain.js';

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

  test('fighters prioritize hostile food carriers over other enemies', () => {
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

    expect(findCombatTarget(fighter, [fighter, enemyFighter, enemyCarrier])?.id).toBe(enemyCarrier.id);
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
});
