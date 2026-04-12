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

test('boots through title, level select, gameplay, and victory progression flow', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  await page.addInitScript(() => window.localStorage.clear());

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
  await expect(page.locator('[data-level="10"]')).toContainText('Boss Level 10');
  await expect(page.locator('[data-level="10"] .levelBossBadge')).toContainText('Boss 1');

  await page.locator('[data-level="1"]').click();

  const webgl = await detectWebGLSupport(page);
  test.skip(!webgl.available, 'Skipping WebGL-dependent test because this browser context cannot create a usable WebGL context.');

  await expect(page.locator('#gameplayHud')).toBeVisible();
  await expect(page.locator('#gameplayLevelLabel')).toContainText('Level 1');
  await expect(page.locator('#antCountValue')).toHaveText('25');
  await expect(page.locator('#selectedNestFoodValue')).toContainText('Selected nest food');
  await expect(page.locator('#selectedNestFoodValue')).toContainText('0.0');
  await expect(page.locator('#selectedNestInfo')).toContainText('Home Nest');
  await expect(page.locator('#selectedNestInfo')).toContainText('Stored food');
  await expect(page.locator('#battleInfo')).toContainText('Battle:');
  await expect(page.locator('#debugVisualsToggle')).toHaveCount(0);
  await expect(page.locator('#debugMenu')).toBeHidden();
  await expect(page.locator('#cameraModeValue')).toHaveText('Orbit camera');
  await expect(page.locator('#cameraModeButton')).toHaveText('Switch to battlefield camera');
  await expect(page.locator('body canvas')).toBeVisible();
  await expect(page.locator('#fatalOverlay')).toBeHidden();

  await page.locator('#cameraModeButton').click();
  await expect(page.locator('#cameraModeValue')).toHaveText('Battlefield camera');
  await expect(page.locator('#cameraModeButton')).toHaveText('Switch to orbit camera');
  await expect.poll(() => page.evaluate(() => window.__ANT_BATTLE_TEST_API__?.getCameraMode?.())).toBe('battlefield');
  await expect.poll(() => page.evaluate(() => window.__ANT_BATTLE_TEST_API__?.getCameraProjectionType?.())).toBe('orthographic');

  const battlefieldCameraState = await page.evaluate(() => window.__ANT_BATTLE_TEST_API__?.getCameraState?.());
  expect(Math.abs(battlefieldCameraState.position.x - battlefieldCameraState.target.x)).toBeLessThan(0.001);
  expect(Math.abs(battlefieldCameraState.position.z - battlefieldCameraState.target.z)).toBeGreaterThan(5);

  await page.evaluate(() => {
    window.__ANT_BATTLE_TEST_API__?.setBattlefieldCameraZoom?.(3.5);
    return window.__ANT_BATTLE_TEST_API__?.setBattlefieldCameraTarget?.({ x: 999, z: 999 });
  });
  const clampedBattlefieldState = await page.evaluate(() => window.__ANT_BATTLE_TEST_API__?.getCameraState?.());
  expect(clampedBattlefieldState.zoom).toBeLessThanOrEqual(3.2);
  expect(clampedBattlefieldState.zoom).toBeGreaterThan(3);
  expect(clampedBattlefieldState.target.x).toBeLessThan(35);
  expect(clampedBattlefieldState.target.z).toBeLessThan(38);

  await page.locator('body canvas').click({ position: { x: 520, y: 420 } });
  await expect(page.locator('#focusInfo')).not.toHaveText('Focus: No rally point set');

  await page.evaluate(() => window.__ANT_BATTLE_TEST_API__?.forceOutcome?.('victory'));
  await expect(page.locator('#victoryLevelLabel')).toHaveText('Level 1 complete');
  await expect(page.locator('#nextLevelButton')).toContainText('Play Level 2');

  await page.locator('#victoryLevelSelectButton').click({ force: true });
  await expect(page.locator('[data-level="1"]')).toContainText('completed');
  await expect(page.locator('[data-level="2"]')).toContainText('open');

  expect(pageErrors, `Unhandled page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});

test('upgrade overlay shows clear shortfall and success feedback on a mobile-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.locator('#startButton').click();
  await page.locator('[data-level="1"]').click();

  const webgl = await detectWebGLSupport(page);
  test.skip(!webgl.available, 'Skipping WebGL-dependent test because this browser context cannot create a usable WebGL context.');

  await expect(page.locator('#gameplayHud')).toBeVisible();

  await page.evaluate(() => {
    window.__ANT_BATTLE_TEST_API__?.setSelectedNest?.('player-1');
    window.__ANT_BATTLE_TEST_API__?.setNestStored?.('player-1', 5);
  });

  await expect(page.locator('#nestUpgradePanel')).toBeVisible();
  await expect(page.locator('#selectedNestFoodValue')).toContainText('5.0');
  await expect(page.locator('#nestUpgradeFoodInfo')).toContainText('Stored food: 5.0');
  await page.evaluate(() => {
    window.__ANT_BATTLE_TEST_API__?.selectUpgrade?.('spawn-workers');
  });
  await expect(page.locator('#upgradeDetailStatus')).toContainText('Need 7.0 more food');
  await expect(page.locator('#upgradeConfirmButton')).toHaveText('Need 7.0 more food');

  await page.evaluate(() => {
    window.__ANT_BATTLE_TEST_API__?.setNestStored?.('player-1', 20);
  });

  await expect(page.locator('#selectedNestFoodValue')).toContainText('20.0');
  await expect(page.locator('#nestUpgradeFoodInfo')).toContainText('Stored food: 20.0');
  await expect(page.locator('#upgradeDetailStatus')).toContainText('Ready. Spend 12 food');
  await page.locator('#upgradeConfirmButton').click({ force: true });
  await expect(page.locator('#upgradeDetailStatus')).toContainText('Worker reinforcements called up');
  await expect(page.locator('#upgradeFeedbackToast')).toContainText('Worker reinforcements called up');

  const panelBox = await page.locator('#nestUpgradePanel').boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox.x).toBeGreaterThanOrEqual(0);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390);
});
