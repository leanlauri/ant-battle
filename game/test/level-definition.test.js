import { describe, expect, test } from 'vitest';
import { getLevelDefinition } from '../src/level-definition.js';

describe('level definition', () => {
  test('early levels use a single enemy nest and lighter budgets', () => {
    const level = getLevelDefinition(1);
    expect(level.enemyNestCount).toBe(1);
    expect(level.foodCount).toBe(20);
    expect(level.antBudget).toBe(120);
  });

  test('mid campaign levels escalate to split-front battles', () => {
    const level = getLevelDefinition(30);
    expect(level.enemyNestCount).toBe(2);
    expect(level.foodCount).toBeGreaterThan(24);
    expect(level.antBudget).toBeGreaterThan(160);
  });

  test('boss levels get extra pressure while staying deterministic', () => {
    const first = getLevelDefinition(10);
    const second = getLevelDefinition(10);
    expect(first).toEqual(second);
    expect(first.isBossLevel).toBe(true);
    expect(first.foodCount).toBeGreaterThan(getLevelDefinition(9).foodCount);
  });
});
