import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { ANT_ROLE, AntSystem } from '../src/ant-system.js';
import { createEnemyProductionCooldown, runEnemyProductionStep } from '../src/enemy-economy.js';
import { FoodSystem } from '../src/food-system.js';
import { createSeededRandom, deriveSeed } from '../src/seeded-random.js';

const round = (value) => Number(value.toFixed(4));

const createEnemyEconomyHarness = ({ seed, stored = 80, scenarioRules = { enemyProductionRateMultiplier: 1 } } = {}) => {
  const enemyProductionCooldowns = new Map();
  const random = createSeededRandom(seed);
  const rosterByNest = new Map([
    ['enemy-1', { workers: 16, fighters: 0, total: 16 }],
  ]);
  const storedByNest = new Map([
    ['enemy-1', stored],
  ]);
  const events = [];

  const foodSystem = {
    nests: [
      { id: 'player-1', faction: 'player', collapsed: false },
      { id: 'enemy-1', faction: 'enemy', collapsed: false },
    ],
    getNestStored: (nestId) => storedByNest.get(nestId) ?? 0,
    spendNestFood: (nestId, amount) => {
      const available = storedByNest.get(nestId) ?? 0;
      if (available < amount) return false;
      storedByNest.set(nestId, available - amount);
      return true;
    },
  };

  const antSystem = {
    getNestRosterSummary: (nestId) => ({ ...(rosterByNest.get(nestId) ?? { workers: 0, fighters: 0, total: 0 }) }),
    spawnAntBatch: ({ nestId, role, count }) => {
      const roster = rosterByNest.get(nestId) ?? { workers: 0, fighters: 0, total: 0 };
      if (role === 'worker') roster.workers += count;
      if (role === 'fighter') roster.fighters += count;
      roster.total += count;
      rosterByNest.set(nestId, roster);
      events.push({
        nestId,
        role,
        count,
      });
      return count;
    },
  };

  const levelDefinition = { scenarioRules };

  return {
    enemyProductionCooldowns,
    random,
    foodSystem,
    antSystem,
    levelDefinition,
    events,
    storedByNest,
  };
};

const simulateEnemyEconomy = ({ seed, steps = 40, dt = 1, stored, scenarioRules } = {}) => {
  const harness = createEnemyEconomyHarness({ seed, stored, scenarioRules });
  const timeline = [];

  for (let step = 0; step < steps; step += 1) {
    runEnemyProductionStep({
      dt,
      foodSystem: harness.foodSystem,
      antSystem: harness.antSystem,
      enemyProductionCooldowns: harness.enemyProductionCooldowns,
      levelDefinition: harness.levelDefinition,
      random: harness.random,
    });

    if (harness.events.length > timeline.length) {
      const event = harness.events[harness.events.length - 1];
      timeline.push({
        step,
        role: event.role,
        count: event.count,
        stored: round(harness.storedByNest.get(event.nestId) ?? 0),
        nextCooldown: round(harness.enemyProductionCooldowns.get(event.nestId) ?? 0),
      });
    }
  }

  return timeline;
};

const createIntegrationHarness = ({
  economySeed,
  spawnSeed = 'test-spawn',
  stored = 80,
  scenarioRules = { enemyProductionRateMultiplier: 1 },
} = {}) => {
  const scene = new THREE.Scene();
  const foodSystem = new FoodSystem({ scene, count: 0, enemyNestCount: 1 });
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 16, 18);
  camera.lookAt(0, 0, 0);

  const antSystem = new AntSystem({
    scene,
    camera,
    foodSystem,
    pheromoneSystem: {
      update() {},
      deposit() {},
      sample() { return new THREE.Vector3(); },
    },
    foods: foodSystem.items,
    nests: foodSystem.nests,
    count: 0,
    levelSetup: {
      playerStartingCounts: { workers: 0, fighters: 0 },
      enemyStartingPerNest: 0,
      enemyWorkerRatio: 1,
    },
    setupRandom: createSeededRandom('integration-setup'),
    decisionRandom: createSeededRandom('integration-runtime'),
    effectRandom: createSeededRandom('integration-effects'),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  return {
    enemyNest,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    random: createSeededRandom(economySeed),
  };
};

const snapshotEnemySpawnedAnts = (antSystem, nestId) => antSystem.ants
  .filter((ant) => ant.homeNestId === nestId)
  .map((ant) => ({
    role: ant.role,
    x: round(ant.position.x),
    z: round(ant.position.z),
    brainCooldown: round(ant.brainCooldown),
    logicCooldown: round(ant.logicCooldown),
    gaitPhase: round(ant.gaitPhase),
  }));

const simulateIntegratedEnemyEconomy = ({ economySeed, spawnSeed, steps = 40, dt = 1, stored, scenarioRules } = {}) => {
  const harness = createIntegrationHarness({ economySeed, spawnSeed, stored, scenarioRules });
  const timeline = [];
  let previousAntCount = harness.antSystem.ants.length;

  for (let step = 0; step < steps; step += 1) {
    runEnemyProductionStep({
      dt,
      foodSystem: harness.foodSystem,
      antSystem: harness.antSystem,
      enemyProductionCooldowns: harness.enemyProductionCooldowns,
      levelDefinition: harness.levelDefinition,
      random: harness.random,
    });

    if (harness.antSystem.ants.length > previousAntCount) {
      const latestAnts = harness.antSystem.ants.slice(previousAntCount);
      timeline.push({
        step,
        role: latestAnts[0]?.role ?? ANT_ROLE.worker,
        count: latestAnts.length,
        stored: round(harness.foodSystem.getNestStored(harness.enemyNest.id)),
        nextCooldown: round(harness.enemyProductionCooldowns.get(harness.enemyNest.id) ?? 0),
      });
      previousAntCount = harness.antSystem.ants.length;
    }
  }

  return {
    timeline,
    spawnedAnts: snapshotEnemySpawnedAnts(harness.antSystem, harness.enemyNest.id),
  };
};

describe('enemy economy seeded runtime paths', () => {
  test('replays enemy production timing from the same seeded enemy-economy stream', () => {
    const seed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const first = simulateEnemyEconomy({ seed });
    const second = simulateEnemyEconomy({ seed });
    const third = simulateEnemyEconomy({ seed: deriveSeed('ant-battle-level-13', 'enemy-economy') });

    expect(first).toEqual(second);
    expect(first).not.toEqual(third);
  });

  test('derives initial production cooldowns deterministically from the enemy-economy stream', () => {
    const seed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const first = createEnemyProductionCooldown({
      levelDefinition: { scenarioRules: { enemyProductionRateMultiplier: 1.4 } },
      random: createSeededRandom(seed),
    });
    const second = createEnemyProductionCooldown({
      levelDefinition: { scenarioRules: { enemyProductionRateMultiplier: 1.4 } },
      random: createSeededRandom(seed),
    });
    const third = createEnemyProductionCooldown({
      levelDefinition: { scenarioRules: { enemyProductionRateMultiplier: 1.4 } },
      random: createSeededRandom(deriveSeed('ant-battle-level-13', 'enemy-economy')),
    });

    expect(round(first)).toBe(round(second));
    expect(round(first)).not.toBe(round(third));
  });

  test('keeps enemy production timing deterministic while spawned ant placement stays on the ants-spawn stream', () => {
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const first = simulateIntegratedEnemyEconomy({
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-12', 'ants-spawn'),
    });
    const second = simulateIntegratedEnemyEconomy({
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-12', 'ants-spawn'),
    });
    const third = simulateIntegratedEnemyEconomy({
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
    });
    const fourth = simulateIntegratedEnemyEconomy({
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed: deriveSeed('ant-battle-level-12', 'ants-spawn'),
    });

    expect(first.timeline).toEqual(second.timeline);
    expect(first.spawnedAnts).toEqual(second.spawnedAnts);

    expect(first.timeline).toEqual(third.timeline);
    expect(first.spawnedAnts).not.toEqual(third.spawnedAnts);

    expect(first.timeline).not.toEqual(fourth.timeline);
  });
});
