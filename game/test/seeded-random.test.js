import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { createRandomAntStates } from '../src/ant-system.js';
import { createFoodItems } from '../src/food-system.js';
import { createSeededRandom, deriveSeed, hashSeed } from '../src/seeded-random.js';

const simplifyFoods = (foods) => foods.map((food) => ({
  id: food.id,
  x: Number(food.position.x.toFixed(4)),
  y: Number(food.position.y.toFixed(4)),
  z: Number(food.position.z.toFixed(4)),
  sizeScale: Number(food.sizeScale.toFixed(4)),
  weight: Number(food.weight.toFixed(4)),
  requiredCarriers: food.requiredCarriers,
}));

const simplifyAnts = (ants) => ants.map((ant) => ({
  id: ant.id,
  faction: ant.faction,
  colonyId: ant.colonyId,
  homeNestId: ant.homeNestId,
  role: ant.role,
  x: Number(ant.position.x.toFixed(4)),
  y: Number(ant.position.y.toFixed(4)),
  z: Number(ant.position.z.toFixed(4)),
  brainCooldown: Number(ant.brainCooldown.toFixed(4)),
  logicCooldown: Number(ant.logicCooldown.toFixed(4)),
  gaitPhase: Number(ant.gaitPhase.toFixed(4)),
}));

describe('seeded randomness utilities', () => {
  test('hashes seed text deterministically', () => {
    expect(hashSeed('ant-battle-level-10')).toBe(hashSeed('ant-battle-level-10'));
    expect(hashSeed('ant-battle-level-10')).not.toBe(hashSeed('ant-battle-level-11'));
  });

  test('seeded generators replay the same sequence for the same seed', () => {
    const first = createSeededRandom('level-7');
    const second = createSeededRandom('level-7');

    expect(Array.from({ length: 5 }, () => first())).toEqual(Array.from({ length: 5 }, () => second()));
  });

  test('derived sub-seeds keep setup streams isolated', () => {
    expect(deriveSeed('level-3', 'food')).not.toBe(deriveSeed('level-3', 'ants-setup'));
    expect(deriveSeed('level-3', 'ants-setup')).not.toBe(deriveSeed('level-3', 'ants-runtime'));
    expect(deriveSeed('level-3', 'ants-runtime')).not.toBe(deriveSeed('level-3', 'ants-effects'));
  });
});

describe('seeded level setup paths', () => {
  test('food placement is deterministic for a level seed', () => {
    const seed = deriveSeed('ant-battle-level-12', 'food');
    const first = createFoodItems(6, { random: createSeededRandom(seed) });
    const second = createFoodItems(6, { random: createSeededRandom(seed) });
    const third = createFoodItems(6, { random: createSeededRandom(deriveSeed('ant-battle-level-13', 'food')) });

    expect(simplifyFoods(first)).toEqual(simplifyFoods(second));
    expect(simplifyFoods(first)).not.toEqual(simplifyFoods(third));
  });

  test('starting ant setup is deterministic for a level seed', () => {
    const nests = [
      { id: 'player-1', faction: 'player', colonyId: 'player', position: new THREE.Vector3(0, 0, 0) },
      { id: 'enemy-1', faction: 'enemy', colonyId: 'enemy-alpha', position: new THREE.Vector3(12, 0, -8) },
    ];
    const levelSetup = {
      playerStartingCounts: { workers: 4, fighters: 2 },
      enemyStartingPerNest: 6,
      enemyWorkerRatio: 0.5,
    };
    const seed = deriveSeed('ant-battle-level-12', 'ants-setup');

    const first = createRandomAntStates(80, nests, levelSetup, createSeededRandom(seed));
    const second = createRandomAntStates(80, nests, levelSetup, createSeededRandom(seed));
    const third = createRandomAntStates(80, nests, levelSetup, createSeededRandom(deriveSeed('ant-battle-level-13', 'ants-setup')));

    expect(simplifyAnts(first)).toEqual(simplifyAnts(second));
    expect(simplifyAnts(first)).not.toEqual(simplifyAnts(third));
  });
});
