import { expect, test } from '@playwright/test';

test.describe('Durchlauf-Report', () => {
  test('opens the report of the last run from the job list', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Letzter Durchlauf von Login & Bestellstatus/ }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Durchlauf 31 von 48' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pfad' })).toContainText(
      'Login & Bestellstatus',
    );
    await expect(page.getByRole('main').getByText('Fehlgeschlagen').first()).toBeVisible();

    const steps = page.getByRole('region', { name: 'Ablauf' }).getByRole('listitem');
    await expect(steps.first()).toContainText('Öffne 127.0.0.1:4100/login.html');
    await expect(steps.last()).toContainText('Element nicht gefunden (Demo-Daten).');

    const failure = page.getByRole('region', { name: /fehlgeschlagen$/ });
    await expect(failure).toContainText('Element nicht gefunden (Demo-Daten).');

    await page.getByRole('link', { name: 'Tests' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tests' })).toBeVisible();
  });

  test('shows a not-found page for an unknown run', async ({ page }) => {
    const response = await page.goto('/laeufe/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Nicht gefunden' })).toBeVisible();
  });

  test('serves stored screenshots and nothing else', async ({ request }) => {
    const image = await request.get('/artifacts/runs/e2e/0-open.png');
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');

    for (const path of [
      '/artifacts/runs/e2e/missing.png',
      '/artifacts/..%2F..%2F..%2Fpackage.json',
      '/artifacts/runs/%2E%2E/%2E%2E/playwright.config.ts',
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});
