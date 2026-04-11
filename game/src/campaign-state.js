export const CAMPAIGN_STORAGE_KEY = 'ant-battle-campaign-v1';
export const CAMPAIGN_VERSION = 1;
export const TOTAL_LEVELS = 100;
export const LEVELS_PER_PAGE = 20;

export const createDefaultCampaignProgress = () => ({
  version: CAMPAIGN_VERSION,
  unlockedLevel: 1,
  completedLevels: [],
});

export const createLevelDefinition = (levelNumber) => ({
  levelNumber,
  seed: `ant-battle-level-${levelNumber}`,
  pageIndex: Math.floor((levelNumber - 1) / LEVELS_PER_PAGE),
  isBossLevel: levelNumber % 10 === 0,
});

export const createLevelCatalog = (totalLevels = TOTAL_LEVELS) => Array.from(
  { length: totalLevels },
  (_, index) => createLevelDefinition(index + 1),
);

export const getPageCount = (totalLevels = TOTAL_LEVELS) => Math.ceil(totalLevels / LEVELS_PER_PAGE);

export const getPageRange = (pageIndex, totalLevels = TOTAL_LEVELS) => {
  const start = pageIndex * LEVELS_PER_PAGE + 1;
  const end = Math.min(totalLevels, start + LEVELS_PER_PAGE - 1);
  return { start, end };
};

export const sanitizeCampaignProgress = (value, totalLevels = TOTAL_LEVELS) => {
  const fallback = createDefaultCampaignProgress();
  if (!value || typeof value !== 'object') return fallback;

  const requestedUnlockedLevel = Number.isInteger(value.unlockedLevel)
    ? Math.max(1, Math.min(totalLevels, value.unlockedLevel))
    : 1;

  const completedLevels = Array.isArray(value.completedLevels)
    ? [...new Set(value.completedLevels.filter((level) => Number.isInteger(level) && level >= 1 && level <= totalLevels))].sort((a, b) => a - b)
    : [];

  const derivedUnlockedLevel = completedLevels.length
    ? Math.min(totalLevels, Math.max(...completedLevels) + 1)
    : requestedUnlockedLevel;

  return {
    version: CAMPAIGN_VERSION,
    unlockedLevel: completedLevels.length ? derivedUnlockedLevel : requestedUnlockedLevel,
    completedLevels,
  };
};

export const loadCampaignProgress = (storage = globalThis.localStorage, totalLevels = TOTAL_LEVELS) => {
  if (!storage) return createDefaultCampaignProgress();

  try {
    const raw = storage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return createDefaultCampaignProgress();
    return sanitizeCampaignProgress(JSON.parse(raw), totalLevels);
  } catch {
    return createDefaultCampaignProgress();
  }
};

export const saveCampaignProgress = (progress, storage = globalThis.localStorage) => {
  if (!storage) return;
  storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(progress));
};

export const completeLevel = (progress, levelNumber, totalLevels = TOTAL_LEVELS) => {
  const current = sanitizeCampaignProgress(progress, totalLevels);
  const completedLevels = [...new Set([...current.completedLevels, levelNumber])].sort((a, b) => a - b);
  return {
    version: CAMPAIGN_VERSION,
    completedLevels,
    unlockedLevel: Math.max(current.unlockedLevel, Math.min(totalLevels, levelNumber + 1)),
  };
};

export const getLevelState = (levelNumber, progress) => {
  const current = sanitizeCampaignProgress(progress);
  if (current.completedLevels.includes(levelNumber)) return 'completed';
  if (levelNumber <= current.unlockedLevel) return 'open';
  return 'locked';
};

export const getLevelsForPage = (pageIndex, progress, totalLevels = TOTAL_LEVELS) => {
  const { start, end } = getPageRange(pageIndex, totalLevels);
  const current = sanitizeCampaignProgress(progress, totalLevels);
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const levelNumber = start + offset;
    return {
      ...createLevelDefinition(levelNumber),
      state: getLevelState(levelNumber, current),
    };
  });
};
