import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { ANT_CONFIG, ANT_ROLE, AntSystem } from '../src/ant-system.js';
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

const createLiveFocusPressureHarness = ({
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
    count: 18,
    levelSetup: {
      playerStartingCounts: { workers: 1, fighters: 0 },
      enemyStartingPerNest: 1,
      enemyWorkerRatio: 0,
    },
    setupRandom: createSeededRandom('live-focus-pressure-setup'),
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  const playerNest = foodSystem.nests.find((nest) => nest.faction === 'player');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  const regrowthFood = foodSystem.items[0];
  foodSystem.pickUpFood(regrowthFood.id, 77, COLONY.player);
  foodSystem.dropFoodInNest(regrowthFood.id, 77, playerNest.id);

  const playerWorker = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker);
  const enemyFighter = antSystem.ants.find((ant) => ant.faction === 'enemy' && ant.role === ANT_ROLE.fighter);

  playerWorker.position.set(-22, playerWorker.position.y, -20);
  playerWorker.heading.set(1, 0, 0);
  playerWorker.target.set(-22, 0, -20);
  playerWorker.velocity.setScalar(0);
  playerWorker.desiredVelocity.setScalar(0);
  playerWorker.brainCooldown = 0;
  playerWorker.logicCooldown = 999;

  enemyFighter.position.set(9.5, enemyFighter.position.y, 0.8);
  enemyFighter.heading.set(-1, 0, 0);
  enemyFighter.target.set(enemyFighter.position.x, 0, enemyFighter.position.z);
  enemyFighter.velocity.setScalar(0);
  enemyFighter.desiredVelocity.setScalar(0);
  enemyFighter.brainCooldown = 0;
  enemyFighter.logicCooldown = 999;

  antSystem.setFocusTarget(new THREE.Vector3(26, 0, 24));

  return {
    enemyNest,
    regrowthFood,
    playerWorker,
    enemyFighter,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
  };
};

const simulateLiveFocusPressureIntegration = ({
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
  const harness = createLiveFocusPressureHarness({
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
    playerWorker: snapshotDecisionAnt(harness.playerWorker),
    enemyFighter: snapshotDecisionAnt(harness.enemyFighter),
    effects: snapshotEffectState(harness.antSystem),
  };
};

const createLiveFallbackDecisionHarness = ({
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
      enemyStartingPerNest: 0,
      enemyWorkerRatio: 1,
    },
    setupRandom: createSeededRandom('live-fallback-decisions-setup'),
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  const playerNest = foodSystem.nests.find((nest) => nest.faction === 'player');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  const regrowthFood = foodSystem.items[0];
  foodSystem.pickUpFood(regrowthFood.id, 311, COLONY.player);
  foodSystem.dropFoodInNest(regrowthFood.id, 311, playerNest.id);

  const playerWorker = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker);
  const playerFighter = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.fighter);

  playerWorker.position.set(-14, playerWorker.position.y, -12);
  playerWorker.heading.set(1, 0, 0);
  playerWorker.target.set(playerWorker.position.x, 0, playerWorker.position.z);
  playerWorker.velocity.setScalar(0);
  playerWorker.desiredVelocity.setScalar(0);
  playerWorker.brainCooldown = 0;
  playerWorker.logicCooldown = 999;

  playerFighter.position.set(8, playerFighter.position.y, 6);
  playerFighter.heading.set(0, 0, 1);
  playerFighter.target.set(playerFighter.position.x, 0, playerFighter.position.z);
  playerFighter.velocity.setScalar(0);
  playerFighter.desiredVelocity.setScalar(0);
  playerFighter.brainCooldown = 0;
  playerFighter.logicCooldown = 999;

  return {
    enemyNest,
    regrowthFood,
    playerWorker,
    playerFighter,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
  };
};

const simulateLiveFallbackDecisionIntegration = ({
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
  const harness = createLiveFallbackDecisionHarness({
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
    playerWorker: snapshotDecisionAnt(harness.playerWorker),
    playerFighter: snapshotDecisionAnt(harness.playerFighter),
    effects: snapshotEffectState(harness.antSystem),
  };
};

const createLiveArrivalFallbackHarness = ({
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
      enemyStartingPerNest: 0,
      enemyWorkerRatio: 1,
    },
    setupRandom: createSeededRandom('live-arrival-fallback-setup'),
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  const playerNest = foodSystem.nests.find((nest) => nest.faction === 'player');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  const regrowthFood = foodSystem.items[0];
  foodSystem.pickUpFood(regrowthFood.id, 611, COLONY.player);
  foodSystem.dropFoodInNest(regrowthFood.id, 611, playerNest.id);

  const playerWorker = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker);
  const playerFighter = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.fighter);

  playerWorker.position.set(-11, playerWorker.position.y, -9);
  playerWorker.heading.set(1, 0, 0);
  playerWorker.target.set(playerWorker.position.x, 0, playerWorker.position.z);
  playerWorker.velocity.setScalar(0);
  playerWorker.desiredVelocity.setScalar(0);
  playerWorker.action = 'wander';
  playerWorker.brainCooldown = 999;
  playerWorker.logicCooldown = 0;

  playerFighter.position.set(7, playerFighter.position.y, 5);
  playerFighter.heading.set(0, 0, 1);
  playerFighter.target.set(playerFighter.position.x, 0, playerFighter.position.z);
  playerFighter.velocity.setScalar(0);
  playerFighter.desiredVelocity.setScalar(0);
  playerFighter.action = 'patrol';
  playerFighter.brainCooldown = 999;
  playerFighter.logicCooldown = 0;

  return {
    enemyNest,
    regrowthFood,
    playerWorker,
    playerFighter,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
  };
};

const simulateLiveArrivalFallbackIntegration = ({
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
  const harness = createLiveArrivalFallbackHarness({
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
  let arrivalSummary = null;

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

    if (arrivalSummary == null) {
      arrivalSummary = {
        playerWorker: snapshotDecisionAnt(harness.playerWorker),
        playerFighter: snapshotDecisionAnt(harness.playerFighter),
      };
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
    arrivalSummary,
    timeline,
    spawnedAnts: snapshotEnemySpawnedAnts(harness.antSystem, harness.enemyNest.id),
    regrownFood: simplifyFood(harness.regrowthFood),
    effects: snapshotEffectState(harness.antSystem),
  };
};

const createLiveInvalidatedWorkerFallbackHarness = ({
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
      playerStartingCounts: { workers: 2, fighters: 0 },
      enemyStartingPerNest: 0,
      enemyWorkerRatio: 1,
    },
    setupRandom: createSeededRandom('live-invalidated-worker-fallback-setup'),
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  const playerNest = foodSystem.nests.find((nest) => nest.faction === 'player');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  const staleFood = foodSystem.items[0];
  foodSystem.pickUpFood(staleFood.id, 411, COLONY.player);
  foodSystem.dropFoodInNest(staleFood.id, 411, playerNest.id);

  const [foodTargetWorker, assistWorker] = antSystem.ants.filter((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker);

  foodTargetWorker.position.set(-9, foodTargetWorker.position.y, -5);
  foodTargetWorker.heading.set(1, 0, 0);
  foodTargetWorker.target.set(staleFood.position.x, 0, staleFood.position.z);
  foodTargetWorker.velocity.setScalar(0);
  foodTargetWorker.desiredVelocity.setScalar(0);
  foodTargetWorker.action = 'seek-food';
  foodTargetWorker.targetFoodId = staleFood.id;
  foodTargetWorker.assistingFoodId = null;
  foodTargetWorker.carryingFoodId = null;
  foodTargetWorker.brainCooldown = 999;
  foodTargetWorker.logicCooldown = 0;

  assistWorker.position.set(-6, assistWorker.position.y, 4);
  assistWorker.heading.set(0, 0, 1);
  assistWorker.target.set(staleFood.position.x, 0, staleFood.position.z);
  assistWorker.velocity.setScalar(0);
  assistWorker.desiredVelocity.setScalar(0);
  assistWorker.action = 'assist-carry';
  assistWorker.targetFoodId = staleFood.id;
  assistWorker.assistingFoodId = staleFood.id;
  assistWorker.carryingFoodId = null;
  assistWorker.brainCooldown = 999;
  assistWorker.logicCooldown = 0;

  return {
    enemyNest,
    staleFood,
    foodTargetWorker,
    assistWorker,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
  };
};

const simulateLiveInvalidatedWorkerFallbackIntegration = ({
  foodSeed,
  economySeed,
  spawnSeed,
  decisionSeed,
  effectSeed,
  steps = 18,
  dt = 1,
  stored,
  scenarioRules,
} = {}) => {
  const harness = createLiveInvalidatedWorkerFallbackHarness({
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
  let fallbackSummary = null;

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

    if (fallbackSummary == null) {
      fallbackSummary = {
        foodTargetWorker: snapshotDecisionAnt(harness.foodTargetWorker),
        assistWorker: snapshotDecisionAnt(harness.assistWorker),
      };
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
    fallbackSummary,
    timeline,
    spawnedAnts: snapshotEnemySpawnedAnts(harness.antSystem, harness.enemyNest.id),
    regrownFood: simplifyFood(harness.staleFood),
    effects: snapshotEffectState(harness.antSystem),
  };
};

const createLiveCarryDeliveryHarness = ({
  foodSeed,
  economySeed,
  spawnSeed,
  decisionSeed,
  effectSeed,
  stored = 80,
  scenarioRules = { enemyProductionRateMultiplier: 2 },
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
      playerStartingCounts: { workers: 2, fighters: 0 },
      enemyStartingPerNest: 0,
      enemyWorkerRatio: 1,
    },
    setupRandom: createSeededRandom('live-carry-delivery-setup'),
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const enemyNest = foodSystem.nests.find((nest) => nest.faction === 'enemy');
  foodSystem.nestStoredById.set(enemyNest.id, stored);

  const carryFood = foodSystem.items[0];
  carryFood.delivered = false;
  carryFood.carried = false;
  carryFood.carriedBy = null;
  carryFood.carriedByColonyId = null;
  carryFood.claimedBy = null;
  carryFood.claimedByColonyId = null;
  carryFood.supportAntIds = [];
  carryFood.regrowAt = null;
  carryFood.weight = 2;
  carryFood.requiredCarriers = 2;

  const playerWorkers = antSystem.ants.filter((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker);
  const carrier = playerWorkers[0];
  const helper = playerWorkers[1];

  carryFood.position.set(4.2, carrier.position.y, 0.25);

  carrier.position.set(carryFood.position.x, carryFood.position.y, carryFood.position.z);
  carrier.heading.set(-1, 0, 0);
  carrier.target.set(carryFood.position.x, 0, carryFood.position.z);
  carrier.velocity.setScalar(0);
  carrier.desiredVelocity.setScalar(0);
  carrier.action = 'seek-food';
  carrier.targetFoodId = carryFood.id;
  carrier.assistingFoodId = null;
  carrier.carryingFoodId = null;
  carrier.brainCooldown = 999;
  carrier.logicCooldown = 0;

  helper.position.set(carryFood.position.x + 0.45, carryFood.position.y, carryFood.position.z + 0.1);
  helper.heading.set(-1, 0, 0);
  helper.target.set(carryFood.position.x, 0, carryFood.position.z);
  helper.velocity.setScalar(0);
  helper.desiredVelocity.setScalar(0);
  helper.action = 'assist-carry';
  helper.targetFoodId = carryFood.id;
  helper.assistingFoodId = carryFood.id;
  helper.carryingFoodId = null;
  helper.brainCooldown = 999;
  helper.logicCooldown = 0;

  return {
    enemyNest,
    carryFood,
    carrier,
    helper,
    enemyProductionCooldowns: new Map(),
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
  };
};

const simulateLiveCarryDeliveryIntegration = ({
  foodSeed,
  economySeed,
  spawnSeed,
  decisionSeed,
  effectSeed,
  steps = 16,
  dt = 1,
  stored,
  scenarioRules,
} = {}) => {
  const harness = createLiveCarryDeliveryHarness({
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
  let deliveryStep = null;
  let sawPickup = false;
  let maxSupportCount = 0;

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

    if (harness.carryFood.carried) sawPickup = true;
    maxSupportCount = Math.max(maxSupportCount, harness.carryFood.supportAntIds.length);
    if (deliveryStep == null && harness.carryFood.delivered) deliveryStep = step;

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
    carrySummary: {
      sawPickup,
      maxSupportCount,
      delivered: harness.carryFood.delivered,
      deliveryStep,
      carrierAction: harness.carrier.action,
      helperAction: harness.helper.action,
      storedFood: round(harness.foodSystem.getNestStored('player-1')),
      regrowAt: round(harness.carryFood.regrowAt ?? 0),
    },
  };
};

const createLiveCollapseHarness = ({
  foodSeed,
  economySeed,
  spawnSeed,
  decisionSeed,
  effectSeed,
  stored = 80,
  scenarioRules = { enemyProductionRateMultiplier: 2 },
} = {}) => {
  const scene = new THREE.Scene();
  const foodSystem = new FoodSystem({ scene, count: 1, enemyNestCount: 2, random: createSeededRandom(foodSeed) });
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
      enemyStartingPerNest: 0,
      enemyWorkerRatio: 1,
    },
    setupRandom: createSeededRandom('live-collapse-setup'),
    decisionRandom: createSeededRandom(decisionSeed),
    effectRandom: createSeededRandom(effectSeed),
    spawnRandom: createSeededRandom(spawnSeed),
  });

  const playerNest = foodSystem.nests.find((nest) => nest.faction === 'player');
  const enemyNests = foodSystem.nests.filter((nest) => nest.faction === 'enemy');
  const targetEnemyNest = enemyNests[0];
  const fallbackEnemyNest = enemyNests[1];
  fallbackEnemyNest.colonyId = targetEnemyNest.colonyId;

  foodSystem.nestStoredById.set(targetEnemyNest.id, 0);
  foodSystem.nestStoredById.set(fallbackEnemyNest.id, stored);
  targetEnemyNest.hp = ANT_CONFIG.fighterNestAttackDamage;

  const regrowthFood = foodSystem.items[0];
  foodSystem.pickUpFood(regrowthFood.id, 991, COLONY.player);
  foodSystem.dropFoodInNest(regrowthFood.id, 991, playerNest.id);

  antSystem.spawnAntBatch({ nestId: targetEnemyNest.id, role: ANT_ROLE.worker, count: 3 });
  const collapseColonyAnts = antSystem.ants
    .filter((ant) => ant.homeNestId === targetEnemyNest.id)
    .sort((a, b) => a.id - b.id);

  for (const [index, ant] of collapseColonyAnts.entries()) {
    ant.position.set(
      fallbackEnemyNest.position.x + 3 + index * 0.7,
      ant.position.y,
      fallbackEnemyNest.position.z + 2 + index * 0.4,
    );
    ant.target.set(ant.position.x, 0, ant.position.z);
    ant.velocity.setScalar(0);
    ant.desiredVelocity.setScalar(0);
    ant.brainCooldown = 999;
    ant.logicCooldown = 999;
  }

  const decisionAnt = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.worker);
  decisionAnt.position.set(-20, decisionAnt.position.y, -18);
  decisionAnt.heading.set(1, 0, 0);
  decisionAnt.target.set(-20, 0, -18);
  decisionAnt.velocity.setScalar(0);
  decisionAnt.desiredVelocity.setScalar(0);
  decisionAnt.brainCooldown = 0;
  decisionAnt.logicCooldown = 999;

  const attacker = antSystem.ants.find((ant) => ant.faction === 'player' && ant.role === ANT_ROLE.fighter);
  attacker.position.set(targetEnemyNest.position.x - 1.1, attacker.position.y, targetEnemyNest.position.z);
  attacker.heading.set(1, 0, 0);
  attacker.target.set(targetEnemyNest.position.x, 0, targetEnemyNest.position.z);
  attacker.velocity.setScalar(0);
  attacker.desiredVelocity.setScalar(0);
  attacker.brainCooldown = 999;
  attacker.logicCooldown = 0;
  attacker.attackCooldownRemaining = 0;

  return {
    attacker,
    collapseColonyAnts,
    decisionAnt,
    enemyProductionCooldowns: new Map(),
    fallbackEnemyNest,
    foodSystem,
    antSystem,
    levelDefinition: { scenarioRules },
    economyRandom: createSeededRandom(economySeed),
    regrowthFood,
    targetEnemyNest,
  };
};

const simulateLiveCollapseIntegration = ({
  foodSeed,
  economySeed,
  spawnSeed,
  decisionSeed,
  effectSeed,
  steps = 16,
  dt = 1,
  stored,
  scenarioRules,
} = {}) => {
  const harness = createLiveCollapseHarness({
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
  let collapseStep = null;
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

    if (collapseStep == null && harness.targetEnemyNest.collapsed) {
      collapseStep = step;
      effectsSnapshot = snapshotEffectState(harness.antSystem);
    }

    if (harness.antSystem.ants.length > previousAntCount) {
      const latestAnts = harness.antSystem.ants.slice(previousAntCount);
      timeline.push({
        step,
        role: latestAnts[0]?.role ?? ANT_ROLE.worker,
        count: latestAnts.length,
        stored: round(harness.foodSystem.getNestStored(harness.fallbackEnemyNest.id)),
        nextCooldown: round(harness.enemyProductionCooldowns.get(harness.fallbackEnemyNest.id) ?? 0),
      });
      previousAntCount = harness.antSystem.ants.length;
    }
  }

  const killedIds = harness.collapseColonyAnts
    .filter((ant) => ant.dead)
    .map((ant) => ant.id)
    .sort((a, b) => a - b);
  const reassignedAnts = harness.collapseColonyAnts
    .filter((ant) => !ant.dead)
    .map((ant) => ({
      id: ant.id,
      homeNestId: ant.homeNestId,
      action: ant.action,
      dead: ant.dead,
    }))
    .sort((a, b) => a.id - b.id);

  return {
    timeline,
    spawnedAnts: snapshotEnemySpawnedAnts(harness.antSystem, harness.fallbackEnemyNest.id),
    regrownFood: simplifyFood(harness.regrowthFood),
    decisionAnt: snapshotDecisionAnt(harness.decisionAnt),
    effects: effectsSnapshot ?? snapshotEffectState(harness.antSystem),
    collapseSummary: {
      collapseStep,
      targetNestId: harness.targetEnemyNest.id,
      targetNestCollapsed: harness.targetEnemyNest.collapsed,
      fallbackNestId: harness.fallbackEnemyNest.id,
      enemyNestsDestroyed: harness.antSystem.stats.enemyNestsDestroyed,
      playerNestsLost: harness.antSystem.stats.playerNestsLost,
      killedIds,
      reassignedAnts,
    },
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

  test('keeps live carry, assist-carry, and delivery interactions isolated from unrelated seeded runtime streams', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const decisionSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');

    const baseline = simulateLiveCarryDeliveryIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const repeat = simulateLiveCarryDeliveryIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const foodVariant = simulateLiveCarryDeliveryIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const economyVariant = simulateLiveCarryDeliveryIntegration({
      foodSeed,
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const spawnVariant = simulateLiveCarryDeliveryIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
      decisionSeed,
      effectSeed,
    });
    const runtimeVariant = simulateLiveCarryDeliveryIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime'),
      effectSeed,
    });
    const effectsVariant = simulateLiveCarryDeliveryIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects'),
    });

    expect(baseline).toEqual(repeat);
    expect(baseline.carrySummary.sawPickup).toBe(true);
    expect(baseline.carrySummary.maxSupportCount).toBeGreaterThanOrEqual(2);
    expect(baseline.carrySummary.delivered).toBe(true);
    expect(baseline.carrySummary.storedFood).toBeGreaterThanOrEqual(2);

    expect(baseline.carrySummary.deliveryStep).toBe(foodVariant.carrySummary.deliveryStep);
    expect(baseline.carrySummary.storedFood).toBe(foodVariant.carrySummary.storedFood);
    expect(baseline.carrySummary.maxSupportCount).toBe(foodVariant.carrySummary.maxSupportCount);
    expect(baseline.carrySummary.regrowAt).not.toBe(foodVariant.carrySummary.regrowAt);

    expect(baseline.carrySummary).toEqual(economyVariant.carrySummary);
    expect(baseline.timeline).not.toEqual(economyVariant.timeline);

    expect(baseline.carrySummary).toEqual(spawnVariant.carrySummary);
    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);

    expect(baseline.carrySummary).toEqual(runtimeVariant.carrySummary);
    expect(baseline.timeline).toEqual(runtimeVariant.timeline);

    expect(baseline.carrySummary).toEqual(effectsVariant.carrySummary);
    expect(baseline.timeline).toEqual(effectsVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(effectsVariant.spawnedAnts);
  });

  test('keeps live focus-target routing and enemy pressure decisions isolated from unrelated seeded runtime streams', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const decisionSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');

    const baseline = simulateLiveFocusPressureIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const repeat = simulateLiveFocusPressureIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const runtimeVariant = simulateLiveFocusPressureIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime'),
      effectSeed,
    });
    const foodVariant = simulateLiveFocusPressureIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const economyVariant = simulateLiveFocusPressureIntegration({
      foodSeed,
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const spawnVariant = simulateLiveFocusPressureIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
      decisionSeed,
      effectSeed,
    });
    const effectsVariant = simulateLiveFocusPressureIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects'),
    });

    expect(baseline).toEqual(repeat);

    expect(baseline.playerWorker).not.toEqual(runtimeVariant.playerWorker);
    expect(baseline.enemyFighter).not.toEqual(runtimeVariant.enemyFighter);
    expect(baseline.timeline).toEqual(runtimeVariant.timeline);
    expect(baseline.regrownFood).toEqual(runtimeVariant.regrownFood);
    expect(baseline.effects).toEqual(runtimeVariant.effects);

    expect(baseline.playerWorker).toEqual(foodVariant.playerWorker);
    expect(baseline.enemyFighter).toEqual(foodVariant.enemyFighter);
    expect(baseline.timeline).toEqual(foodVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(foodVariant.spawnedAnts);
    expect(baseline.regrownFood).not.toEqual(foodVariant.regrownFood);

    expect(baseline.playerWorker).toEqual(economyVariant.playerWorker);
    expect(baseline.enemyFighter).toEqual(economyVariant.enemyFighter);
    expect(baseline.regrownFood).toEqual(economyVariant.regrownFood);
    expect(baseline.timeline).not.toEqual(economyVariant.timeline);

    expect(baseline.playerWorker).toEqual(spawnVariant.playerWorker);
    expect(baseline.enemyFighter).toEqual(spawnVariant.enemyFighter);
    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.regrownFood).toEqual(spawnVariant.regrownFood);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);

    expect(baseline.playerWorker).toEqual(effectsVariant.playerWorker);
    expect(baseline.enemyFighter).toEqual(effectsVariant.enemyFighter);
    expect(baseline.timeline).toEqual(effectsVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(effectsVariant.spawnedAnts);
    expect(baseline.regrownFood).toEqual(effectsVariant.regrownFood);
    expect(baseline.effects).toEqual(effectsVariant.effects);
  });

  test('keeps live fallback worker and fighter decisions isolated from unrelated seeded runtime streams', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const decisionSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');

    const baseline = simulateLiveFallbackDecisionIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const repeat = simulateLiveFallbackDecisionIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const runtimeVariant = simulateLiveFallbackDecisionIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime'),
      effectSeed,
    });
    const foodVariant = simulateLiveFallbackDecisionIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const economyVariant = simulateLiveFallbackDecisionIntegration({
      foodSeed,
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const spawnVariant = simulateLiveFallbackDecisionIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
      decisionSeed,
      effectSeed,
    });
    const effectsVariant = simulateLiveFallbackDecisionIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects'),
    });

    expect(baseline).toEqual(repeat);

    expect(baseline.playerWorker).not.toEqual(runtimeVariant.playerWorker);
    expect(baseline.playerFighter).not.toEqual(runtimeVariant.playerFighter);
    expect(baseline.timeline).toEqual(runtimeVariant.timeline);
    expect(baseline.regrownFood).toEqual(runtimeVariant.regrownFood);
    expect(baseline.effects).toEqual(runtimeVariant.effects);

    expect(baseline.playerWorker).toEqual(foodVariant.playerWorker);
    expect(baseline.playerFighter).toEqual(foodVariant.playerFighter);
    expect(baseline.timeline).toEqual(foodVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(foodVariant.spawnedAnts);
    expect(baseline.regrownFood).not.toEqual(foodVariant.regrownFood);

    expect(baseline.playerWorker).toEqual(economyVariant.playerWorker);
    expect(baseline.playerFighter).toEqual(economyVariant.playerFighter);
    expect(baseline.regrownFood).toEqual(economyVariant.regrownFood);
    expect(baseline.timeline).not.toEqual(economyVariant.timeline);

    expect(baseline.playerWorker).toEqual(spawnVariant.playerWorker);
    expect(baseline.playerFighter).toEqual(spawnVariant.playerFighter);
    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.regrownFood).toEqual(spawnVariant.regrownFood);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);

    expect(baseline.playerWorker).toEqual(effectsVariant.playerWorker);
    expect(baseline.playerFighter).toEqual(effectsVariant.playerFighter);
    expect(baseline.timeline).toEqual(effectsVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(effectsVariant.spawnedAnts);
    expect(baseline.regrownFood).toEqual(effectsVariant.regrownFood);
    expect(baseline.effects).toEqual(effectsVariant.effects);
  });

  test('keeps live target-arrival fallback reselection isolated from unrelated seeded runtime streams', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const decisionSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');

    const baseline = simulateLiveArrivalFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const repeat = simulateLiveArrivalFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const runtimeVariant = simulateLiveArrivalFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime'),
      effectSeed,
    });
    const foodVariant = simulateLiveArrivalFallbackIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const economyVariant = simulateLiveArrivalFallbackIntegration({
      foodSeed,
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const spawnVariant = simulateLiveArrivalFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
      decisionSeed,
      effectSeed,
    });
    const effectsVariant = simulateLiveArrivalFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects'),
    });

    expect(baseline).toEqual(repeat);

    expect(baseline.arrivalSummary).not.toEqual(runtimeVariant.arrivalSummary);
    expect(baseline.timeline).toEqual(runtimeVariant.timeline);
    expect(baseline.regrownFood).toEqual(runtimeVariant.regrownFood);
    expect(baseline.effects).toEqual(runtimeVariant.effects);

    expect(baseline.arrivalSummary).toEqual(foodVariant.arrivalSummary);
    expect(baseline.timeline).toEqual(foodVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(foodVariant.spawnedAnts);
    expect(baseline.regrownFood).not.toEqual(foodVariant.regrownFood);

    expect(baseline.arrivalSummary).toEqual(economyVariant.arrivalSummary);
    expect(baseline.regrownFood).toEqual(economyVariant.regrownFood);
    expect(baseline.timeline).not.toEqual(economyVariant.timeline);

    expect(baseline.arrivalSummary).toEqual(spawnVariant.arrivalSummary);
    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.regrownFood).toEqual(spawnVariant.regrownFood);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);

    expect(baseline.arrivalSummary).toEqual(effectsVariant.arrivalSummary);
    expect(baseline.timeline).toEqual(effectsVariant.timeline);
    expect(baseline.regrownFood).toEqual(effectsVariant.regrownFood);
    expect(baseline.spawnedAnts).toEqual(effectsVariant.spawnedAnts);
    expect(baseline.effects).toEqual(effectsVariant.effects);
  });

  test('keeps live invalidated worker food-target and assist-carry fallback reselection isolated from unrelated seeded runtime streams', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const decisionSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');

    const baseline = simulateLiveInvalidatedWorkerFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const repeat = simulateLiveInvalidatedWorkerFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const runtimeVariant = simulateLiveInvalidatedWorkerFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime'),
      effectSeed,
    });
    const foodVariant = simulateLiveInvalidatedWorkerFallbackIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const economyVariant = simulateLiveInvalidatedWorkerFallbackIntegration({
      foodSeed,
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const spawnVariant = simulateLiveInvalidatedWorkerFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
      decisionSeed,
      effectSeed,
    });
    const effectsVariant = simulateLiveInvalidatedWorkerFallbackIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects'),
    });

    expect(baseline).toEqual(repeat);
    expect(baseline.fallbackSummary.foodTargetWorker).not.toEqual(runtimeVariant.fallbackSummary.foodTargetWorker);
    expect(baseline.fallbackSummary.assistWorker).not.toEqual(runtimeVariant.fallbackSummary.assistWorker);
    expect(baseline.timeline).toEqual(runtimeVariant.timeline);
    expect(baseline.regrownFood).toEqual(runtimeVariant.regrownFood);
    expect(baseline.effects).toEqual(runtimeVariant.effects);

    expect(baseline.fallbackSummary).toEqual(foodVariant.fallbackSummary);
    expect(baseline.timeline).toEqual(foodVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(foodVariant.spawnedAnts);
    expect(baseline.regrownFood).not.toEqual(foodVariant.regrownFood);

    expect(baseline.fallbackSummary).toEqual(economyVariant.fallbackSummary);
    expect(baseline.regrownFood).toEqual(economyVariant.regrownFood);
    expect(baseline.timeline).not.toEqual(economyVariant.timeline);

    expect(baseline.fallbackSummary).toEqual(spawnVariant.fallbackSummary);
    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.regrownFood).toEqual(spawnVariant.regrownFood);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);

    expect(baseline.fallbackSummary).toEqual(effectsVariant.fallbackSummary);
    expect(baseline.timeline).toEqual(effectsVariant.timeline);
    expect(baseline.regrownFood).toEqual(effectsVariant.regrownFood);
    expect(baseline.spawnedAnts).toEqual(effectsVariant.spawnedAnts);
    expect(baseline.effects).toEqual(effectsVariant.effects);
  });

  test('keeps live siege-driven nest collapse and migration aftermath isolated from unrelated seeded runtime streams', () => {
    const foodSeed = deriveSeed('ant-battle-level-12', 'food');
    const economySeed = deriveSeed('ant-battle-level-12', 'enemy-economy');
    const spawnSeed = deriveSeed('ant-battle-level-12', 'ants-spawn');
    const decisionSeed = deriveSeed('ant-battle-level-12', 'ants-runtime');
    const effectSeed = deriveSeed('ant-battle-level-12', 'ants-effects');

    const baseline = simulateLiveCollapseIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const repeat = simulateLiveCollapseIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const runtimeVariant = simulateLiveCollapseIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed: deriveSeed('ant-battle-level-13', 'ants-runtime'),
      effectSeed,
    });
    const foodVariant = simulateLiveCollapseIntegration({
      foodSeed: deriveSeed('ant-battle-level-13', 'food'),
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const economyVariant = simulateLiveCollapseIntegration({
      foodSeed,
      economySeed: deriveSeed('ant-battle-level-13', 'enemy-economy'),
      spawnSeed,
      decisionSeed,
      effectSeed,
    });
    const spawnVariant = simulateLiveCollapseIntegration({
      foodSeed,
      economySeed,
      spawnSeed: deriveSeed('ant-battle-level-13', 'ants-spawn'),
      decisionSeed,
      effectSeed,
    });
    const effectsVariant = simulateLiveCollapseIntegration({
      foodSeed,
      economySeed,
      spawnSeed,
      decisionSeed,
      effectSeed: deriveSeed('ant-battle-level-13', 'ants-effects'),
    });

    expect(baseline).toEqual(repeat);
    expect(baseline.collapseSummary.targetNestCollapsed).toBe(true);
    expect(baseline.collapseSummary.enemyNestsDestroyed).toBe(1);
    expect(baseline.collapseSummary.playerNestsLost).toBe(0);
    expect(baseline.collapseSummary.killedIds).toHaveLength(1);
    expect(baseline.collapseSummary.reassignedAnts).toHaveLength(2);
    expect(baseline.collapseSummary.reassignedAnts.every((ant) => ant.homeNestId === baseline.collapseSummary.fallbackNestId)).toBe(true);

    expect(baseline.decisionAnt).not.toEqual(runtimeVariant.decisionAnt);
    expect(baseline.collapseSummary).toEqual(runtimeVariant.collapseSummary);
    expect(baseline.timeline).toEqual(runtimeVariant.timeline);
    expect(baseline.regrownFood).toEqual(runtimeVariant.regrownFood);
    expect(baseline.effects).toEqual(runtimeVariant.effects);

    expect(baseline.collapseSummary).toEqual(foodVariant.collapseSummary);
    expect(baseline.decisionAnt).toEqual(foodVariant.decisionAnt);
    expect(baseline.timeline).toEqual(foodVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(foodVariant.spawnedAnts);
    expect(baseline.regrownFood).not.toEqual(foodVariant.regrownFood);

    expect(baseline.collapseSummary).toEqual(economyVariant.collapseSummary);
    expect(baseline.decisionAnt).toEqual(economyVariant.decisionAnt);
    expect(baseline.regrownFood).toEqual(economyVariant.regrownFood);
    expect(baseline.timeline).not.toEqual(economyVariant.timeline);

    expect(baseline.collapseSummary).toEqual(spawnVariant.collapseSummary);
    expect(baseline.decisionAnt).toEqual(spawnVariant.decisionAnt);
    expect(baseline.timeline).toEqual(spawnVariant.timeline);
    expect(baseline.regrownFood).toEqual(spawnVariant.regrownFood);
    expect(baseline.spawnedAnts).not.toEqual(spawnVariant.spawnedAnts);

    expect(baseline.collapseSummary).toEqual(effectsVariant.collapseSummary);
    expect(baseline.decisionAnt).toEqual(effectsVariant.decisionAnt);
    expect(baseline.timeline).toEqual(effectsVariant.timeline);
    expect(baseline.spawnedAnts).toEqual(effectsVariant.spawnedAnts);
    expect(baseline.regrownFood).toEqual(effectsVariant.regrownFood);
    expect(baseline.effects).not.toEqual(effectsVariant.effects);
  });
});
