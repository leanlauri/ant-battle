const LEVEL_BANDS = Object.freeze([
  { maxLevel: 10, enemyNestCount: 1, foodCount: 20, antBudget: 120, label: 'Opening skirmish' },
  { maxLevel: 25, enemyNestCount: 1, foodCount: 24, antBudget: 160, label: 'Foraging pressure' },
  { maxLevel: 50, enemyNestCount: 2, foodCount: 28, antBudget: 200, label: 'Split-front battle' },
  { maxLevel: 75, enemyNestCount: 2, foodCount: 32, antBudget: 240, label: 'War of attrition' },
  { maxLevel: 100, enemyNestCount: 2, foodCount: 36, antBudget: 280, label: 'Late campaign swarm' },
]);

export const getLevelDefinition = (levelNumber = 1) => {
  const normalizedLevel = Math.max(1, Math.floor(levelNumber));
  const band = LEVEL_BANDS.find((entry) => normalizedLevel <= entry.maxLevel) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1];
  const isBossLevel = normalizedLevel % 10 === 0;

  return {
    levelNumber: normalizedLevel,
    seed: `ant-battle-level-${normalizedLevel}`,
    isBossLevel,
    enemyNestCount: isBossLevel ? Math.min(2, band.enemyNestCount + 1) : band.enemyNestCount,
    foodCount: band.foodCount + (isBossLevel ? 2 : 0),
    antBudget: band.antBudget + (isBossLevel ? 20 : 0),
    label: isBossLevel ? 'Wasp pressure placeholder' : band.label,
  };
};
