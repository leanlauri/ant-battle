import { ANT_ROLE } from './ant-system.js';

export const createEnemyRolePicker = (workerRatio = 0.82, random = Math.random) => () => (random() < workerRatio ? ANT_ROLE.worker : ANT_ROLE.fighter);

export const normalizeLevelSetup = (setup = {}) => ({
  playerStartingCounts: {
    workers: setup.playerStartingCounts?.workers ?? 24,
    fighters: setup.playerStartingCounts?.fighters ?? 1,
  },
  enemyStartingPerNest: setup.enemyStartingPerNest ?? 14,
  enemyWorkerRatio: setup.enemyWorkerRatio ?? 0.82,
});
