import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { ANT_ROLE, AntSystem } from '../src/ant-system.js';
import { createEnemyProductionCooldown, runEnemyProductionStep } from '../src/enemy-economy.js';
import { COLONY, FoodSystem } from '../src/food-system.js';
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

const snapshotDecisionAnt = (ant) => ({
  action: ant.action,
  targetX: round(ant.target.x),
  targetZ: round(ant.target.z),
  desiredX: round(ant.desiredVelocity.x),
  desiredZ: round(ant.desiredVelocity.z),
  headingX: round(ant.heading.x),
  headingZ: round(ant.heading.z),
});

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

const simplifyFood = (food) => ({
  delivered: food.delivered,
  carried: food.carried,
  regrowAt: food.regrowAt,
  sizeScale: round(food.sizeScale),
  weight: round(food.weight),
  requiredCarriers: food.requiredCarriers,
  x: round(food.position.x),
  y: round(food.position.y),
  z: round(food.position.z),
});

const createLiveRuntimeHarness = ({
  foodSeed,
  economySeed,
  spawnSeed,
  stored = 80,
  scenarioRules = { enemyProductionRateMultiplier: 1 },
} = {}) => {
  const scene = new THREE.Scene();
  const foodSystem = new FoodSystem({ scene, count: 1, enemyNestCount: 1, random: createSeededRandom(foodSeed) });
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
    setupRandom: createSeededRandom('live-runtime-setup'),
    decisionRandom: createSeededRandom('live-runtime-runtime'),
    effectRandom: createSeededRandom('live-runtime-effects'),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  const regrowthFood = foodSystem.items[0];
  foodSystem.pickUpFood(regrowthFood.id, 77, COLONY.player);
  foodSystem.dropFoodInNest(regrowthFood.id, 77, 'player-1');

  return {
    enemyNest,
    regrowthFood,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
  };
};

const simulateLiveRuntimeIntegration = ({
  foodSeed,
  economySeed,
  spawnSeed,
  steps = 24,
  dt = 1,
  stored,
  scenarioRules,
} = {}) => {
  const harness = createLiveRuntimeHarness({ foodSeed, economySeed, spawnSeed, stored, scenarioRules });
  const timeline = [];
  let previousAntCount = harness.antSystem.ants.length;

  for (let step = 0; step < steps; step += 1) {
    harness.foodSystem.update(dt);
    runEnemyProductionStep({
      dt,
      foodSystem: harness.foodSystem,
      antSystem: harness.antSystem,
      enemyProductionCooldowns: harness.enemyProductionCooldowns,
      levelDefinition: harness.levelDefinition,
      random: harness.economyRandom,
    });
    harness.antSystem.update(dt);

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
    regrownFood: simplifyFood(harness.regrowthFood),
  };
};

const createLiveDecisionEffectsHarness = ({
  foodSeed,
  economySeed,
  spawnSeed,
  decisionSeed,
  effectSeed,
  stored = 80,
  scenarioRules = { enemyProductionRateMultiplier: 1 },
} = {}) => {
  const scene = new THREE.Scene();
  const foodSystem = new FoodSystem({ scene, count: 1, enemyNestCount: 1, random: createSeededRandom(foodSeed) });
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
    count: 12,
    levelSetup: {
      playerStartingCounts: { workers: 1, fighters: 1 },
      enemyStartingPerNest: 1,
      enemyWorkerRatio: 0,
    },
    setupRandom: createSeededRandom('live-decision-effects-setup'),
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  const regrowthFood = foodSystem.items[0];
  foodSystem.pickUpFood(regrowthFood.id, 77, COLONY.player);
  foodSystem.dropFoodInNest(regrowthFood.id, 77, 'player-1');

  const decisionAnt = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker);
  const playerFighter = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.fighter);
  const enemyFighter = antSystem.ants.find((ant) => ant.faction === 'enemy' && ant.role === ANT_ROLE.fighter);

  decisionAnt.position.set(-18, decisionAnt.position.y, -18);
  decisionAnt.heading.set(1, 0, 0);
  decisionAnt.target.set(-18, 0, -18);
  decisionAnt.velocity.setScalar(0);
  decisionAnt.desiredVelocity.setScalar(0);
  decisionAnt.brainCooldown = 0;
  decisionAnt.logicCooldown = 999;

  playerFighter.position.set(6, playerFighter.position.y, 0);
  playerFighter.heading.set(1, 0, 0);
  playerFighter.target.set(enemyFighter.position.x, 0, enemyFighter.position.z);
  playerFighter.velocity.setScalar(0);
  playerFighter.desiredVelocity.setScalar(0);
  playerFighter.brainCooldown = 999;
  playerFighter.logicCooldown = 0;
  playerFighter.attackCooldownRemaining = 0;

  enemyFighter.position.set(6.45, enemyFighter.position.y, 0);
  enemyFighter.heading.set(-1, 0, 0);
  enemyFighter.target.set(playerFighter.position.x, 0, playerFighter.position.z);
  enemyFighter.velocity.setScalar(0);
  enemyFighter.desiredVelocity.setScalar(0);
  enemyFighter.brainCooldown = 999;
  enemyFighter.logicCooldown = 999;
  enemyFighter.attackCooldownRemaining = 999;
  enemyFighter.hp = 10;

  return {
    enemyNest,
    regrowthFood,
    decisionAnt,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
  };
};

const simulateLiveDecisionEffectsIntegration = ({
  foodSeed,
  economySeed,
  spawnSeed,
  decisionSeed,
  effectSeed,
  steps = 24,
  dt = 1,
  stored,
  scenarioRules,
} = {}) => {
  const harness = createLiveDecisionEffectsHarness({
    foodSeed,
    economySeed,
    spawnSeed,
    decisionSeed,
    effectSeed,
    stored,
    scenarioRules,
  });
  const timeline = [];
  let previousAntCount = harness.antSystem.ants.length;
  let effectsSnapshot = null;

  for (let step = 0; step < steps; step += 1) {
    harness.foodSystem.update(dt);
    runEnemyProductionStep({
      dt,
      foodSystem: harness.foodSystem,
      antSystem: harness.antSystem,
      enemyProductionCooldowns: harness.enemyProductionCooldowns,
      levelDefinition: harness.levelDefinition,
      random: harness.economyRandom,
    });
    harness.antSystem.update(dt);

    if (!effectsSnapshot && (harness.antSystem.hitEffects.length || harness.antSystem.groundSplats.length || harness.antSystem.corpseRemains.length)) {
      effectsSnapshot = snapshotEffectState(harness.antSystem);
    }

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
    regrownFood: simplifyFood(harness.regrowthFood),
    decisionAnt: snapshotDecisionAnt(harness.decisionAnt),
    effects: effectsSnapshot ?? snapshotEffectState(harness.antSystem),
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

  test('keeps live food regrowth isolated from enemy economy timing and spawned ant placement', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');

    const baseline = simulateLiveRuntimeIntegration({ foodSeed, economySeed, spawnSeed });
    const repeat = simulateLiveRuntimeIntegration({ foodSeed, economySeed, spawnSeed });
    const foodVariant = simulateLiveRuntimeIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
    });
    const spawnVariant = simulateLiveRuntimeIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
    });

    expect(baseline).toEqual(repeat);

    expect(baseline.timeline).toEqual(foodVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(foodVariant.spawnedAnts);
    expect(baseline.regrownFood).not.toEqual(foodVariant.regrownFood);

    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.regrownFood).toEqual(spawnVariant.regrownFood);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);
  });

  test('keeps live ant decisions and combat aftermath isolated from other seeded runtime streams', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const decisionSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');

    const baseline = simulateLiveDecisionEffectsIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const repeat = simulateLiveDecisionEffectsIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const runtimeVariant = simulateLiveDecisionEffectsIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime'),
      effectSeed,
    });
    const effectsVariant = simulateLiveDecisionEffectsIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects'),
    });
    const foodVariant = simulateLiveDecisionEffectsIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const economyVariant = simulateLiveDecisionEffectsIntegration({
      foodSeed,
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const spawnVariant = simulateLiveDecisionEffectsIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
      decisionSeed,
      effectSeed,
    });

    expect(baseline).toEqual(repeat);

    expect(baseline.decisionAnt).not.toEqual(runtimeVariant.decisionAnt);
    expect(baseline.effects).toEqual(runtimeVariant.effects);
    expect(baseline.timeline).toEqual(runtimeVariant.timeline);
    expect(baseline.regrownFood).toEqual(runtimeVariant.regrownFood);

    expect(baseline.effects).not.toEqual(effectsVariant.effects);
    expect(baseline.decisionAnt).toEqual(effectsVariant.decisionAnt);
    expect(baseline.timeline).toEqual(effectsVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(effectsVariant.spawnedAnts);
    expect(baseline.regrownFood).toEqual(effectsVariant.regrownFood);

    expect(baseline.decisionAnt).toEqual(foodVariant.decisionAnt);
    expect(baseline.effects).toEqual(foodVariant.effects);
    expect(baseline.timeline).toEqual(foodVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(foodVariant.spawnedAnts);
    expect(baseline.regrownFood).not.toEqual(foodVariant.regrownFood);

    expect(baseline.decisionAnt).toEqual(economyVariant.decisionAnt);
    expect(baseline.effects).toEqual(economyVariant.effects);
    expect(baseline.regrownFood).toEqual(economyVariant.regrownFood);
    expect(baseline.timeline).not.toEqual(economyVariant.timeline);

    expect(baseline.decisionAnt).toEqual(spawnVariant.decisionAnt);
    expect(baseline.effects).toEqual(spawnVariant.effects);
    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.regrownFood).toEqual(spawnVariant.regrownFood);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);
  });
});
