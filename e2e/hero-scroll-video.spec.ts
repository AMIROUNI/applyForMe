import { test, expect } from '@playwright/test';

test.describe('Hero scroll video', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const video = page.locator('.hero-scroll-video__video');
    await expect(video).toBeVisible();
  });

  test('scrub mode: video currentTime increases when scrolling down', async ({ page }) => {
    const video = page.locator('.hero-scroll-video__video');
    await video.waitForElementState('attached');

    const initialTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);

    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(500);

    const afterScrollTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
    expect(afterScrollTime).toBeGreaterThan(initialTime);
  });

  test('scrub mode: video currentTime decreases when scrolling up', async ({ page }) => {
    const video = page.locator('.hero-scroll-video__video');

    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(500);
    const midTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);

    await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(500);
    const afterScrollUpTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);

    expect(afterScrollUpTime).toBeLessThan(midTime);
  });

  test('hero text fades out when scrolling past 60%', async ({ page }) => {
    const content = page.locator('.hero-scroll-video__content');
    await expect(content).toBeVisible();

    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(500);

    const opacity = await content.evaluate((el: HTMLElement) => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(1);
  });

  test('CTA button is visible and clickable', async ({ page }) => {
    const cta = page.locator('.hero-scroll-video__cta app-button');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText('Get started');
  });
});

test.describe('Theme modes', () => {
  test('light mode screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toHaveScreenshot('landing-light-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('dark mode screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toHaveScreenshot('landing-dark-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile light mode screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toHaveScreenshot('landing-light-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('mobile dark mode screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toHaveScreenshot('landing-dark-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});