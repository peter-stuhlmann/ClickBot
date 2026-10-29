import { expect, test } from '@playwright/test';

test.describe('Projekte', () => {
  test('lists the projects with their jobs and runs', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Projekte' })
      .click();

    await expect(page).toHaveURL('/projekte');
    await expect(page.getByRole('heading', { level: 1, name: 'Projekte' })).toBeVisible();
    const row = page.getByRole('row', { name: /Beispiel GmbH/ });
    await expect(row).toContainText('127.0.0.1:4100 · 1 Website');
    await expect(row).toContainText(/\d+ Jobs/);
    await expect(row.getByRole('link', { name: /^Letzter Lauf von Beispiel GmbH/ })).toBeVisible();
  });

  test('sends old links to the customer list on to the projects', async ({ page }) => {
    await page.goto('/kunden');
    await expect(page).toHaveURL('/projekte');
    await page.goto('/kunden/neu');
    await expect(page).toHaveURL('/projekte/neu');
  });

  test('creates a project, refuses a duplicate and offers it in the job wizard', async ({
    page,
  }) => {
    await page.goto('/projekte');
    await page.getByRole('link', { name: 'Projekt anlegen' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Müller Shop');
    await page.getByRole('button', { name: 'Projekt anlegen' }).click();

    await expect(page).toHaveURL('/projekte');
    const row = page.getByRole('row', { name: /E2E Müller Shop/ });
    await expect(row).toContainText('noch keine Website');
    await expect(row).toContainText('noch kein Lauf');

    await page.goto('/projekte/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('e2e müller shop');
    await page.getByRole('button', { name: 'Projekt anlegen' }).click();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      'Dieses Projekt gibt es schon.',
    );

    await page.goto('/jobs/neu');
    await expect(
      page
        .getByRole('combobox', { name: 'Projekt' })
        .getByRole('option', { name: 'E2E Müller Shop' }),
    ).toBeAttached();
  });
});
