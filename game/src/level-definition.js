import { OBJECTIVE_TYPE } from './objective-rules.js';

const LEVEL_BANDS = Object.freeze([
  {
    maxLevel: 10,
    enemyNestCount: 1,
    foodCount: 20,
    antBudget: 120,
    label: 'Opening skirmish',
    objectiveText: 'Break the first rival colony before it can snowball.',
    timeOfDay: 'bright day',
    setup: {
      playerStartingCounts: { workers: 24, fighters: 1 },
      enemyStartingPerNest: 10,
      enemyWorkerRatio: 0.88,
    },
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
    setup: {
      playerStartingCounts: { workers: 22, fighters: 3 },
      enemyStartingPerNest: 14,
      enemyWorkerRatio: 0.82,
    },
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
    setup: {
      playerStartingCounts: { workers: 20, fighters: 5 },
      enemyStartingPerNest: 16,
      enemyWorkerRatio: 0.74,
    },
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
    setup: {
      playerStartingCounts: { workers: 18, fighters: 7 },
      enemyStartingPerNest: 18,
      enemyWorkerRatio: 0.66,
    },
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
    setup: {
      playerStartingCounts: { workers: 16, fighters: 9 },
      enemyStartingPerNest: 20,
      enemyWorkerRatio: 0.58,
    },
    terrain: { maxHeight: 6, noiseScale: 0.072, octaves: 5 },
    atmosphere: { background: 0x1f2940, fog: 0x1f2940, sun: 0xcdd8ff, hemiSky: 0x45597d, hemiGround: 0x141d2f },
  },
]);

const createBossProfile = (normalizedLevel, band) => {
  if (normalizedLevel % 10 !== 0) return null;

  const bossTier = Math.max(1, normalizedLevel / 10);
  const targetLabel = 'Brood Nest';
  const escortNestCount = Math.min(2, Math.max(0, band.enemyNestCount));
  const productionMultiplier = 1.2 + bossTier * 0.08;
  const targetNestHpMultiplier = 1.2 + bossTier * 0.1;
  const bonusFood = bossTier >= 3 ? 4 : 2;
  const bonusBudget = 16 + bossTier * 8;

  return {
    tier: bossTier,
    icon: '👑',
    title: `${targetLabel} assault`,
    shellLabel: `Boss Level ${normalizedLevel}`,
    levelCardLabel: `Boss ${bossTier}`,
    introText: `Break the ${targetLabel.toLowerCase()} before the escort colonies and fast hatch cycles bury the map in defenders.`,
    objectiveText: `Destroy ${targetLabel}. Escort nests can survive, but the brood nest hatches reinforcements faster and can absorb more punishment.`,
    victorySummary: `The ${targetLabel.toLowerCase()} cracked and the brood surge collapsed.`,
    defeatSummary: `The brood nest held long enough for the escort colonies to overwhelm your line.`,
    objective: {
      type: OBJECTIVE_TYPE.destroyTargetNest,
      targetNestId: 'enemy-1',
      targetLabel,
      rulesText: 'Escort nests can survive, but the brood nest hatches reinforcements faster and can absorb more punishment.',
      completionText: `Destroyed ${targetLabel}.`,
    },
    nestOverrides: {
      'enemy-1': {
        label: targetLabel,
        maxHpMultiplier: targetNestHpMultiplier,
      },
      'enemy-2': escortNestCount > 0
        ? {
            label: 'Escort Nest',
          }
        : undefined,
    },
    scenarioRules: {
      enemyProductionRateMultiplier: productionMultiplier,
      targetNestHpMultiplier,
      escortNestCount,
    },
    enemyNestCount: Math.min(2, escortNestCount + 1),
    bonusFood,
    bonusBudget,
    setupModifiers: {
      enemyStartingPerNestDelta: 1 + bossTier,
      enemyWorkerRatioDelta: -0.08,
      playerStartingFighterDelta: bossTier >= 2 ? 1 : 0,
    },
  };
};

const createObjectiveModel = ({ bossProfile, enemyNestCount }) => {
  if (bossProfile) return bossProfile.objective;

  return {
    type: OBJECTIVE_TYPE.destroyAllEnemyNests,
    rulesText: enemyNestCount > 1 ? 'Every hostile nest must fall to win.' : '',
    completionText: enemyNestCount > 1 ? 'All hostile nests destroyed.' : 'Rival nest destroyed.',
  };
};

export const getLevelDefinition = (levelNumber = 1) => {
  const normalizedLevel = Math.max(1, Math.floor(levelNumber));
  const band = LEVEL_BANDS.find((entry) => normalizedLevel <= entry.maxLevel) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1];
  const bossProfile = createBossProfile(normalizedLevel, band);
  const isBossLevel = !!bossProfile;
  const enemyNestCount = bossProfile?.enemyNestCount ?? band.enemyNestCount;
  const objective = createObjectiveModel({ bossProfile, enemyNestCount });
  const scenarioRules = {
    enemyProductionRateMultiplier: 1,
    ...(bossProfile?.scenarioRules ?? {}),
  };

  return {
    levelNumber: normalizedLevel,
    seed: `ant-battle-level-${normalizedLevel}`,
    isBossLevel,
    boss: bossProfile,
    enemyNestCount,
    foodCount: band.foodCount + (bossProfile?.bonusFood ?? 0),
    antBudget: band.antBudget + (bossProfile?.bonusBudget ?? 0),
    label: bossProfile?.title ?? band.label,
    objective,
    objectiveText: bossProfile?.objectiveText ?? (enemyNestCount > 1
      ? `Destroy all hostile nests. ${objective.rulesText}`.trim()
      : 'Destroy the rival colony nest.'),
    introText: bossProfile?.introText ?? band.objectiveText,
    timeOfDay: band.timeOfDay,
    setup: {
      ...band.setup,
      playerStartingCounts: {
        ...band.setup.playerStartingCounts,
        fighters: Math.max(1, (band.setup.playerStartingCounts?.fighters ?? 0) + (bossProfile?.setupModifiers?.playerStartingFighterDelta ?? 0)),
      },
      enemyStartingPerNest: (band.setup?.enemyStartingPerNest ?? 14) + (bossProfile?.setupModifiers?.enemyStartingPerNestDelta ?? 0),
      enemyWorkerRatio: Math.max(0.45, (band.setup?.enemyWorkerRatio ?? 0.82) + (bossProfile?.setupModifiers?.enemyWorkerRatioDelta ?? 0)),
    },
    nestOverrides: bossProfile?.nestOverrides ?? null,
    scenarioRules,
    terrain: { ...band.terrain },
    atmosphere: { ...band.atmosphere },
  };
};
