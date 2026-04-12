import * as THREE from 'three';
import { ENEMY_ECONOMY_CONFIG } from './food-system.js';

export const createEnemyProductionCooldown = ({ levelDefinition, random }) => {
  const multiplier = levelDefinition?.scenarioRules?.enemyProductionRateMultiplier ?? 1;
  return THREE.MathUtils.lerp(
    ENEMY_ECONOMY_CONFIG.productionCooldownMin,
    ENEMY_ECONOMY_CONFIG.productionCooldownMax,
    random(),
  ) / Math.max(0.1, multiplier);
};

export const runEnemyProductionStep = ({ dt, foodSystem, antSystem, enemyProductionCooldowns, levelDefinition, random }) => {
  if (!foodSystem || !antSystem) return;

  for (const nest of foodSystem.nests) {
    if (nest.faction !== 'enemy' || nest.collapsed) continue;

    const cooldown = (enemyProductionCooldowns.get(nest.id) ?? createEnemyProductionCooldown({ levelDefinition, random })) - dt;
    if (cooldown > 0) {
      enemyProductionCooldowns.set(nest.id, cooldown);
      continue;
    }

    const stored = foodSystem.getNestStored(nest.id);
    const roster = antSystem.getNestRosterSummary(nest.id);
    let produced = false;

    const shouldSpawnFighters = stored >= ENEMY_ECONOMY_CONFIG.fighterBatch.cost
      && (roster.fighters < 2 || roster.workers - roster.fighters >= ENEMY_ECONOMY_CONFIG.fighterPressureThreshold);

    if (shouldSpawnFighters && foodSystem.spendNestFood(nest.id, ENEMY_ECONOMY_CONFIG.fighterBatch.cost)) {
      antSystem.spawnAntBatch({ nestId: nest.id, role: 'fighter', count: ENEMY_ECONOMY_CONFIG.fighterBatch.count });
      produced = true;
    } else if (stored >= ENEMY_ECONOMY_CONFIG.workerBatch.cost && foodSystem.spendNestFood(nest.id, ENEMY_ECONOMY_CONFIG.workerBatch.cost)) {
      antSystem.spawnAntBatch({ nestId: nest.id, role: 'worker', count: ENEMY_ECONOMY_CONFIG.workerBatch.count });
      produced = true;
    }

    enemyProductionCooldowns.set(
      nest.id,
      produced ? createEnemyProductionCooldown({ levelDefinition, random }) : 2.5,
    );
  }
};
