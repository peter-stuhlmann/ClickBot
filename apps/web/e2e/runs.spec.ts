import { expect, test } from '@playwright/test';

test.describe('Läufe', () => {
  test('lists the runs of all jobs, newest first, in pages of 50', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Läufe' })
      .click();

    await expect(page.getByRole('heading', { level: 1, name: 'Läufe' })).toBeVisible();
    const table = page.getByRole('region', { name: 'Läufe' });
    // The demo data has more than 50 runs in the last 7 days.
    await expect(table).toContainText(/1–50 von \d+ · neueste zuerst/);
    await expect(table.getByRole('row')).toHaveCount(51);

    await page.getByRole('link', { name: 'Ältere' }).click();
    await expect(page).toHaveURL('/laeufe?seite=2');
    await expect(table).toContainText(/51–\d+ von \d+/);
    await expect(page.getByRole('link', { name: 'Neuere' })).toBeVisible();
  });

  test('filters by result and opens the report of a run', async ({ page }) => {
    await page.goto('/laeufe');
    await page
      .getByRole('combobox', { name: 'Ergebnis' })
      .selectOption({ label: 'Fehlgeschlagen' });
    await page.getByRole('button', { name: 'Filter anwenden' }).click();

    // A plain GET form also sends the empty fields.
    await expect(page).toHaveURL(/[?&]ergebnis=fehlgeschlagen(&|$)/);
    await expect(page.getByRole('combobox', { name: 'Ergebnis' })).toHaveValue('fehlgeschlagen');
    const rows = page.getByRole('region', { name: 'Läufe' }).getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    for (let index = 1; index < count; index++) {
      await expect(rows.nth(index)).toContainText('Fehlgeschlagen');
    }

    await rows.nth(1).getByRole('link').click();
    await expect(page).toHaveURL(/\/laeufe\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: /^Lauf #\d+/ })).toBeVisible();
  });

  test('says so when no run matches, and resets the filters', async ({ page }) => {
    await page.goto('/laeufe?geraet=ipad');
    await expect(page.getByText('Keine Läufe für diese Filter.')).toBeVisible();

    await page.getByRole('link', { name: 'Filter zurücksetzen' }).click();
    await expect(page).toHaveURL('/laeufe');
    await expect(page.getByRole('combobox', { name: 'Gerät' })).toHaveValue('');
  });
});
