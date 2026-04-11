import { describe, expect, test } from 'vitest';
import {
  CAMPAIGN_STORAGE_KEY,
  LEVELS_PER_PAGE,
  TOTAL_LEVELS,
  completeLevel,
  createDefaultCampaignProgress,
  createLevelCatalog,
  getLevelState,
  getLevelsForPage,
  getPageCount,
  getPageRange,
  loadCampaignProgress,
  sanitizeCampaignProgress,
  saveCampaignProgress,
} from '../src/campaign-state.js';

const createMemoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
};

describe('campaign state', () => {
  test('creates a 100-level catalog with boss markers every tenth level', () => {
    const catalog = createLevelCatalog();

    expect(catalog).toHaveLength(TOTAL_LEVELS);
    expect(catalog[0]).toMatchObject({ levelNumber: 1, pageIndex: 0, isBossLevel: false, seed: 'ant-battle-level-1' });
    expect(catalog[9]).toMatchObject({ levelNumber: 10, pageIndex: 0, isBossLevel: true, seed: 'ant-battle-level-10' });
    expect(catalog[99]).toMatchObject({ levelNumber: 100, pageIndex: 4, isBossLevel: true, seed: 'ant-battle-level-100' });
  });

  test('reports 5 pages of 20 levels', () => {
    expect(LEVELS_PER_PAGE).toBe(20);
    expect(getPageCount()).toBe(5);
    expect(getPageRange(0)).toEqual({ start: 1, end: 20 });
    expect(getPageRange(4)).toEqual({ start: 81, end: 100 });
  });

  test('defaults progress to only level 1 open', () => {
    const progress = createDefaultCampaignProgress();
    const firstPage = getLevelsForPage(0, progress);

    expect(progress).toEqual({ version: 1, unlockedLevel: 1, completedLevels: [] });
    expect(firstPage[0].state).toBe('open');
    expect(firstPage[1].state).toBe('locked');
  });

  test('marks completed levels and unlocks exactly one next level', () => {
    const progress = completeLevel(createDefaultCampaignProgress(), 1);
    const page = getLevelsForPage(0, progress);

    expect(progress.completedLevels).toEqual([1]);
    expect(progress.unlockedLevel).toBe(2);
    expect(page[0].state).toBe('completed');
    expect(page[1].state).toBe('open');
    expect(page[2].state).toBe('locked');
    expect(getLevelState(2, progress)).toBe('open');
  });

  test('sanitizes malformed stored progress', () => {
    const sanitized = sanitizeCampaignProgress({ unlockedLevel: 999, completedLevels: [3, 'bad', 2, 3, 200] });

    expect(sanitized).toEqual({
      version: 1,
      unlockedLevel: 4,
      completedLevels: [2, 3],
    });
  });

  test('loads and saves progress through storage', () => {
    const storage = createMemoryStorage();
    const progress = completeLevel(createDefaultCampaignProgress(), 4);

    saveCampaignProgress(progress, storage);
    expect(storage.getItem(CAMPAIGN_STORAGE_KEY)).toBeTruthy();
    expect(loadCampaignProgress(storage)).toEqual({
      version: 1,
      unlockedLevel: 5,
      completedLevels: [4],
    });
  });
});
