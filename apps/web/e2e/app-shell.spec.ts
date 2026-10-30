import { expect, test, type Locator } from '@playwright/test';

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

  test('shows the hand on everything clickable, and no hand on what is disabled', async ({
    page,
  }) => {
    const cursor = (locator: Locator) =>
      locator.evaluate((element) => getComputedStyle(element).cursor);

    await page.goto('/laeufe');
    await expect.poll(() => cursor(page.getByRole('button', { name: 'Abmelden' }))).toBe('pointer');
    await expect
      .poll(() => cursor(page.getByRole('button', { name: /^Projekt: / })))
      .toBe('pointer');
    await expect.poll(() => cursor(page.getByRole('combobox').first())).toBe('pointer');
    await expect
      .poll(() => cursor(page.getByRole('link', { name: 'Läufe', exact: true })))
      .toBe('pointer');

    await page.goto('/kampagnen');
    await page.getByRole('link', { name: 'Allgemein', exact: true }).click();
    const blocked = page.getByRole('button', { name: 'Kampagne löschen' });
    await expect(blocked).toBeDisabled();
    await expect.poll(() => cursor(blocked)).toBe('not-allowed');

    // While a button saves, Button sets disabled and aria-busy: the cursor shows waiting.
    const busy = await blocked.evaluate((button) => {
      button.setAttribute('aria-busy', 'true');
      return getComputedStyle(button).cursor;
    });
    expect(busy).toBe('progress');
  });
});
