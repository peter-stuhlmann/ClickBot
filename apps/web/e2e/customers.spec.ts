import { expect, test } from '@playwright/test';

test.describe('Kunden', () => {
  test('lists the customers with their jobs and runs', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Kunden' })
      .click();

    await expect(page.getByRole('heading', { level: 1, name: 'Kunden' })).toBeVisible();
    const row = page.getByRole('row', { name: /Beispiel GmbH/ });
    await expect(row).toContainText('127.0.0.1:4100 · 1 Website');
    await expect(row).toContainText(/\d+ Jobs/);
    await expect(row.getByRole('link', { name: /^Letzter Lauf von Beispiel GmbH/ })).toBeVisible();
  });

  test('creates a customer, refuses a duplicate and offers it in the job wizard', async ({
    page,
  }) => {
    await page.goto('/kunden');
    await page.getByRole('link', { name: 'Kunde anlegen' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Müller Shop');
    await page.getByRole('button', { name: 'Kunde anlegen' }).click();

    await expect(page).toHaveURL('/kunden');
    const row = page.getByRole('row', { name: /E2E Müller Shop/ });
    await expect(row).toContainText('noch keine Website');
    await expect(row).toContainText('noch kein Lauf');

    await page.goto('/kunden/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('e2e müller shop');
    await page.getByRole('button', { name: 'Kunde anlegen' }).click();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      'Diesen Kunden gibt es schon.',
    );

    await page.goto('/jobs/neu');
    await expect(
      page
        .getByRole('combobox', { name: 'Kunde' })
        .getByRole('option', { name: 'E2E Müller Shop' }),
    ).toBeAttached();
  });
});
