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

test('renders the ants terrain prototype without runtime errors', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');

  const webgl = await detectWebGLSupport(page);
  test.skip(!webgl.available, 'Skipping WebGL-dependent test because this browser context cannot create a usable WebGL context.');

  await expect(page.locator('#hudTitle')).toHaveText('Ants Prototype');
  await expect(page.locator('#axisInfo')).toContainText('Axes: +X right, +Y up, +Z forward');
  await expect(page.locator('#cameraInfo')).toContainText('drag to orbit');
  await expect(page.locator('#meshInfo')).toContainText('Terrain: 20000 tris');
  await expect(page.locator('#meshInfo')).toContainText('x/z [-50, 50]');
  await expect(page.locator('#meshInfo')).toContainText('y [-5, 5]');
  await expect(page.locator('#antInfo')).toContainText('Ants: 200 total');
  await expect(page.locator('#antInfo')).toContainText('roles S/F/W');
  await expect(page.locator('#antInfo')).toContainText('render');
  await expect(page.locator('#foodInfo')).toContainText('Food:');
  await expect(page.locator('#foodInfo')).toContainText('nest stored');
  await expect(page.locator('#foodInfo')).toContainText('max carriers');
  await expect(page.locator('#foodInfo')).toContainText('sense');
  await expect(page.locator('body > canvas').first()).toBeVisible();
  await expect(page.locator('#fatalOverlay')).toBeHidden();

  expect(pageErrors, `Unhandled page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
