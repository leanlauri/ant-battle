import { describe, expect, it } from 'vitest';
import { getLevelDefinition } from '../src/level-definition.js';
import { getObjectiveStatus, resolveObjectiveOutcome } from '../src/objective-rules.js';

describe('level objective rules', () => {
  it('uses destroy-all-nests rules for normal levels', () => {
    const level = getLevelDefinition(1);

    expect(level.objective.type).toBe('destroy-all-enemy-nests');
    expect(level.objectiveText).toBe('Destroy the rival colony nest.');
    expect(level.scenarioRules.enemyProductionRateMultiplier).toBe(1);
  });

  it('uses target-nest rules and faster pressure for boss levels', () => {
    const level = getLevelDefinition(10);

    expect(level.objective.type).toBe('destroy-target-nest');
    expect(level.objective.targetNestId).toBe('enemy-1');
    expect(level.objectiveText).toContain('Destroy Brood Nest.');
    expect(level.scenarioRules.enemyProductionRateMultiplier).toBeGreaterThan(1.2);
    expect(level.scenarioRules.targetNestHpMultiplier).toBeGreaterThan(1);
  });

  it('reports progress for destroy-all objectives from active nest count', () => {
    const level = getLevelDefinition(31);
    const status = getObjectiveStatus({
      objective: level.objective,
      foodSystem: {
        getActiveEnemyNestCount: () => 2,
        getActivePlayerNestCount: () => 1,
      },
    });

    expect(status.complete).toBe(false);
    expect(status.hudText).toContain('Destroy all hostile nests.');
    expect(status.battleSuffix).toContain('2 enemy nests still active.');
    expect(resolveObjectiveOutcome({
      objective: level.objective,
      foodSystem: {
        getActiveEnemyNestCount: () => 2,
        getActivePlayerNestCount: () => 1,
      },
    })).toBe(null);
  });

  it('allows boss victory once the target nest collapses', () => {
    const bossLevel = getLevelDefinition(10);
    const bossFoodSystem = {
      getActiveEnemyNestCount: () => 1,
      getActivePlayerNestCount: () => 1,
      getNestById: () => ({ id: 'enemy-1', collapsed: true, label: 'Enemy Nest Alpha' }),
    };

    const status = getObjectiveStatus({ objective: bossLevel.objective, foodSystem: bossFoodSystem });

    expect(status.complete).toBe(true);
    expect(status.completionText).toBe('Destroyed Brood Nest.');
    expect(resolveObjectiveOutcome({ objective: bossLevel.objective, foodSystem: bossFoodSystem })).toBe('victory');
  });
});
