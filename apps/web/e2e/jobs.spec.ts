import { expect, test, type Page } from '@playwright/test';

const statValue = (page: Page, label: string) =>
  page.getByRole('region', { name: label }).locator('p').first();

test.describe('Jobs overview', () => {
  test('shows the demo jobs with their figures', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page');
    await expect(statValue(page, 'Aktive Jobs')).toHaveText('3');

    // Header row plus the four demo jobs.
    await expect(page.getByRole('row')).toHaveCount(5);
    const login = page.getByRole('row', { name: /Login & Bestellstatus/ });
    await expect(login).toContainText('31 / 48 Läufe');
    await expect(login).toContainText('Fehlgeschlagen');
    await expect(login).toContainText('87,1 %');
  });

  test('pauses a job and resumes it again', async ({ page }) => {
    await page.goto('/');
    const row = page.getByRole('row', { name: /Kontaktformular-Test/ });

    await row.getByRole('switch', { name: 'Kontaktformular-Test pausieren' }).click();
    await expect(row.getByText('Pausiert')).toBeVisible();
    await expect(statValue(page, 'Aktive Jobs')).toHaveText('2');

    await row.getByRole('switch', { name: 'Kontaktformular-Test fortsetzen' }).click();
    await expect(row.getByText('Aktiv', { exact: true })).toBeVisible();
    await expect(statValue(page, 'Aktive Jobs')).toHaveText('3');
  });

  test('pausing also works without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    const row = page.getByRole('row', { name: /Newsletter-Anmeldung/ });

    await row.getByRole('switch', { name: 'Newsletter-Anmeldung pausieren' }).click();
    await expect(row.getByText('Pausiert')).toBeVisible();

    await row.getByRole('switch', { name: 'Newsletter-Anmeldung fortsetzen' }).click();
    await expect(row.getByText('Aktiv', { exact: true })).toBeVisible();
    await context.close();
  });

  test('does not offer to toggle a finished job', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('switch', { name: 'Preis-Check Produktseite: Beendet' });
    await expect(toggle).toBeDisabled();
  });
});
