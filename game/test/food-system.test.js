import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { Scene } from 'three';
import { FACTION, FOOD_CONFIG, NEST_CONFIG, createFoodItems, createNestDefinitions, findNearestCarryAssistFood, findNearestFood, getFoodById, getFoodCarryFactor, getNestPosition } from '../src/food-system.js';
import { FoodSystem } from '../src/food-system.js';
import { TERRAIN_CONFIG } from '../src/terrain.js';

describe('food system helpers', () => {
  test('creates food items within terrain bounds', () => {
    const foods = createFoodItems(FOOD_CONFIG.count);
    expect(foods).toHaveLength(FOOD_CONFIG.count);
    for (const food of foods) {
      expect(food.position.x).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.width / 2);
      expect(food.position.x).toBeLessThanOrEqual(TERRAIN_CONFIG.width / 2);
      expect(food.position.z).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.depth / 2);
      expect(food.position.z).toBeLessThanOrEqual(TERRAIN_CONFIG.depth / 2);
      expect(food.requiredCarriers).toBeGreaterThanOrEqual(1);
      expect(food.requiredCarriers).toBeLessThanOrEqual(4);
      expect(food.sizeScale).toBeGreaterThanOrEqual(FOOD_CONFIG.sizeMinScale);
      expect(food.sizeScale).toBeLessThanOrEqual(FOOD_CONFIG.sizeMaxScale);
    }
  });

  test('finds the nearest food within sensing range', () => {
    const foods = [
      { id: 1, position: new THREE.Vector3(2, 0, 2), claimedBy: null, delivered: false, carried: false },
      { id: 2, position: new THREE.Vector3(8, 0, 8), claimedBy: null, delivered: false, carried: false },
    ];
    expect(findNearestFood(foods, new THREE.Vector3(0, 0, 0), 5)?.id).toBe(1);
    expect(findNearestFood(foods, new THREE.Vector3(0, 0, 0), 1)).toBeNull();
  });

  test('finds carried food that still needs helper ants', () => {
    const foods = [
      { id: 1, position: new THREE.Vector3(3, 0, 0), carried: true, delivered: false, supportAntIds: [10], requiredCarriers: 3 },
      { id: 2, position: new THREE.Vector3(5, 0, 0), carried: true, delivered: false, supportAntIds: [10, 11, 12], requiredCarriers: 3 },
    ];
    expect(findNearestCarryAssistFood(foods, new THREE.Vector3(0, 0, 0), 6)?.id).toBe(1);
  });

  test('carry factor improves with more ant support', () => {
    const smallSupport = getFoodCarryFactor({ supportAntIds: [1], requiredCarriers: 4 });
    const largeSupport = getFoodCarryFactor({ supportAntIds: [1, 2, 3, 4], requiredCarriers: 4 });
    expect(smallSupport).toBeLessThan(largeSupport);
  });

  test('can look up a specific food by id', () => {
    const foods = [{ id: 3, position: new THREE.Vector3(1, 0, 1), claimedBy: 7, delivered: false, carried: false }];
    expect(getFoodById(foods, 3)?.claimedBy).toBe(7);
    expect(getFoodById(foods, 999)).toBeNull();
  });

  test('provides a nest location anchored to terrain height', () => {
    const nest = getNestPosition();
    expect(nest.x).toBe(NEST_CONFIG.position.x);
    expect(nest.z).toBe(NEST_CONFIG.position.z);
    expect(nest.y).toBeTypeOf('number');
  });

  test('nest grows as food is stored', () => {
    const system = new FoodSystem({ scene: new Scene(), count: 0 });
    const before = system.nestMesh.scale.x;
    system.nestStored = 20;
    system.updateNestVisual();
    expect(system.nestMesh.scale.x).toBeGreaterThan(before);
    expect(system.nestMesh.scale.y).toBeGreaterThan(before);
  });

  test('creates one player nest and enemy faction nests', () => {
    const nests = createNestDefinitions();
    expect(nests.find((nest) => nest.faction === FACTION.player)?.id).toBe('player-1');
    expect(nests.filter((nest) => nest.faction === FACTION.enemy)).toHaveLength(2);
  });

  test('reserves queue slots and stores food against the requested nest', () => {
    const system = new FoodSystem({ scene: new Scene(), count: 1 });
    const food = system.items[0];

    system.pickUpFood(food.id, 77);
    const slot = system.reserveNestSlot(77, new THREE.Vector3(0, 0, 0), 'enemy-1');
    const dropped = system.dropFoodInNest(food.id, 77, 'enemy-1');

    expect(slot.nestId).toBe('enemy-1');
    expect(dropped).toBe(true);
    expect(system.getNestStored('enemy-1')).toBeGreaterThan(0);
    expect(system.nestStored).toBe(0);
  });

  test('tracks nest health and collapse state per nest', () => {
    const system = new FoodSystem({ scene: new Scene(), count: 0 });

    const damaged = system.damageNest('enemy-1', 25);
    const destroyed = system.damageNest('enemy-1', NEST_CONFIG.maxHp);

    expect(damaged?.hp).toBe(NEST_CONFIG.maxHp - 25);
    expect(destroyed?.collapsed).toBe(true);
    expect(system.getActiveEnemyNestCount()).toBe(1);
  });

  test('keeps selection on the player nest and records focus targets', () => {
    const system = new FoodSystem({ scene: new Scene(), count: 0 });

    expect(system.getSelectedNest()?.id).toBe('player-1');
    expect(system.setSelectedNest('enemy-1')).toBe(false);
    expect(system.getSelectedNest()?.id).toBe('player-1');

    system.setFocusTarget(new THREE.Vector3(12, 0, -8));
    expect(system.getFocusTarget()?.x).toBeCloseTo(12);
    expect(system.focusMarker.visible).toBe(true);
  });
});
