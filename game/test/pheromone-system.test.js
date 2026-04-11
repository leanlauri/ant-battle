import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { PheromoneSystem } from '../src/pheromone-system.js';

describe('pheromone system', () => {
  test('returns a directional pull toward deposited pheromone', () => {
    const system = new PheromoneSystem();
    system.deposit('food', new THREE.Vector3(6, 0, 0), 1);
    const sample = system.sample('food', new THREE.Vector3(0, 0, 0));
    expect(sample.x).toBeGreaterThan(0);
  });

  test('evaporates pheromones over time', () => {
    const system = new PheromoneSystem();
    system.deposit('food', new THREE.Vector3(0, 0, 0), 1);
    const before = system.sample('food', new THREE.Vector3(0, 0, 0)).length();
    system.update(10);
    const after = system.sample('food', new THREE.Vector3(0, 0, 0)).length();
    expect(after).toBeLessThan(before);
  });
});
