/* eslint-env node */
/* global document, window */
const { test, expect } = require('@playwright/test');

const detectWebGLSupport = async (page) => page.evaluate(() => {
  const fatalOverlay = document.getElementById('fatalOverlay');
  const fatalVisible = fatalOverlay && window.getComputedStyle(fatalOverlay).display !== 'none';
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  return {
    available: !!gl && !fatalVisible,
    fatalVisible,
  };
});

test('boots through title, level select, gameplay, and shell victory flow', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');

  await expect(page.locator('h1')).toHaveText('Ant Battle');
  await expect(page.locator('#startButton')).toHaveText('Tap to Start');
  await expect(page.locator('#titleBuildBadge')).toContainText('Build:');

  await page.locator('#startButton').click();
  await expect(page.locator('#levelPageLabel')).toHaveText('Levels 1–20');
  await expect(page.locator('[data-level="1"]')).toContainText('open');
  await expect(page.locator('[data-level="2"]')).toContainText('locked');

  await page.locator('[data-level="1"]').click();

  const webgl = await detectWebGLSupport(page);
  test.skip(!webgl.available, 'Skipping WebGL-dependent test because this browser context cannot create a usable WebGL context.');

  await expect(page.locator('#gameplayHud')).toBeVisible();
  await expect(page.locator('#gameplayLevelLabel')).toContainText('Level 1');
  await expect(page.locator('#antInfo')).toContainText('Ants: 200 total');
  await expect(page.locator('#antInfo')).toContainText('classes S/W/F');
  await expect(page.locator('#selectedNestInfo')).toContainText('Selected nest: Home Nest');
  await expect(page.locator('body canvas')).toBeVisible();
  await expect(page.locator('#fatalOverlay')).toBeHidden();

  await page.locator('body canvas').click({ position: { x: 520, y: 420 } });
  await expect(page.locator('#focusInfo')).not.toHaveText('Focus: none');

  await page.locator('#debugWinButton').click();
  await expect(page.locator('#victoryLevelLabel')).toHaveText('Level 1 complete');
  await expect(page.locator('#nextLevelButton')).toContainText('Play Level 2');

  await page.locator('#victoryLevelSelectButton').click();
  await expect(page.locator('[data-level="1"]')).toContainText('completed');
  await expect(page.locator('[data-level="2"]')).toContainText('open');

  expect(pageErrors, `Unhandled page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
