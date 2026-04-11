const LEVEL_BANDS = Object.freeze([
  {
    maxLevel: 10,
    enemyNestCount: 1,
    foodCount: 20,
    antBudget: 120,
    label: 'Opening skirmish',
    objectiveText: 'Break the first rival colony before it can snowball.',
    timeOfDay: 'bright day',
    terrain: { maxHeight: 3.2, noiseScale: 0.042, octaves: 3 },
    atmosphere: { background: 0xdfeaf6, fog: 0xdfeaf6, sun: 0xffffff, hemiSky: 0xf3f8ff, hemiGround: 0x88a0b2 },
  },
  {
    maxLevel: 25,
    enemyNestCount: 1,
    foodCount: 24,
    antBudget: 160,
    label: 'Foraging pressure',
    objectiveText: 'Secure enough food to outgrow the defending nest.',
    timeOfDay: 'warm evening',
    terrain: { maxHeight: 4.2, noiseScale: 0.05, octaves: 4 },
    atmosphere: { background: 0xf0dfcf, fog: 0xf0dfcf, sun: 0xfff1d4, hemiSky: 0xffefd8, hemiGround: 0xa58872 },
  },
  {
    maxLevel: 50,
    enemyNestCount: 2,
    foodCount: 28,
    antBudget: 200,
    label: 'Split-front battle',
    objectiveText: 'Hold the center while two colonies contest the map edges.',
    timeOfDay: 'overcast daylight',
    terrain: { maxHeight: 4.8, noiseScale: 0.06, octaves: 4 },
    atmosphere: { background: 0xcfd9e4, fog: 0xcfd9e4, sun: 0xf6fbff, hemiSky: 0xe9f1f8, hemiGround: 0x74889a },
  },
  {
    maxLevel: 75,
    enemyNestCount: 2,
    foodCount: 32,
    antBudget: 240,
    label: 'War of attrition',
    objectiveText: 'Survive long enough to turn repeated enemy waves into collapse.',
    timeOfDay: 'dusk',
    terrain: { maxHeight: 5.4, noiseScale: 0.066, octaves: 5 },
    atmosphere: { background: 0xcbb8d6, fog: 0xcbb8d6, sun: 0xffe2c2, hemiSky: 0xe3d5ef, hemiGround: 0x6f627e },
  },
  {
    maxLevel: 100,
    enemyNestCount: 2,
    foodCount: 36,
    antBudget: 280,
    label: 'Late campaign swarm',
    objectiveText: 'Push through high-pressure fronts and dismantle entrenched colonies.',
    timeOfDay: 'readable night',
    terrain: { maxHeight: 6, noiseScale: 0.072, octaves: 5 },
    atmosphere: { background: 0x1f2940, fog: 0x1f2940, sun: 0xcdd8ff, hemiSky: 0x45597d, hemiGround: 0x141d2f },
  },
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
    objectiveText: isBossLevel ? 'Boss placeholder: survive the pressure spike and break the swarm nest.' : band.objectiveText,
    timeOfDay: band.timeOfDay,
    terrain: { ...band.terrain },
    atmosphere: { ...band.atmosphere },
  };
};
