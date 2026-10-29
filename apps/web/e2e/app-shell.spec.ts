import { expect, test } from '@playwright/test';

test.describe('App shell', () => {
  test('keeps the whole sidebar in view while a long page scrolls', async ({ page }) => {
    // Shorter than the list of runs, tall enough for the whole sidebar.
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto('/laeufe');
    const logout = page.getByRole('button', { name: 'Abmelden' });
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(logout).toBeInViewport();

    await page.mouse.wheel(0, 5000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await expect(logout).toBeInViewport();
    await expect(navigation).toBeInViewport();
  });
});
