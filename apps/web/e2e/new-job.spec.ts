import { expect, test } from '@playwright/test';

// Runs after jobs.spec.ts (one worker, files in name order), which expects only the demo jobs.
test.describe('Neuer Job', () => {
  test('creates an active job with the wizard and lists it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Neuer Job' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Neuer Job' })).toBeVisible();

    // 1 · Website
    await page.getByRole('combobox', { name: 'Kunde' }).selectOption({ label: 'Beispiel GmbH' });
    await page
      .getByRole('textbox', { name: 'Website (Start-URL)' })
      .fill('http://127.0.0.1:4100/kontakt.html');
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('E2E Kontaktseite');
    await page.getByRole('checkbox', { name: /Test freigegeben/ }).check();
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 2 · Ablauf: the open step is there, add a check.
    await expect(page.getByRole('button', { name: /^Schritt 1: Öffne/ })).toBeVisible();
    await page.getByRole('button', { name: 'Schritt hinzufügen' }).click();
    await page.getByRole('combobox', { name: 'Aktion' }).selectOption({ label: 'Prüfen' });
    await page.getByRole('textbox', { name: 'Text' }).fill('Kontakt');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 3 · Zeitplan
    await page.getByRole('textbox', { name: 'Alle (Minuten)' }).fill('30');
    await page.getByRole('textbox', { name: 'Max. Läufe' }).fill('2');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 4 · Geräte
    await page.getByRole('button', { name: /iPhone 15/ }).click();
    await expect(page.getByText(/2 Starts × 2 Geräte = 4 Läufe/)).toBeVisible();
    await page.getByRole('button', { name: 'Job anlegen' }).click();

    await expect(page).toHaveURL('/');
    const row = page.getByRole('row', { name: /E2E Kontaktseite/ });
    await expect(row).toContainText('127.0.0.1:4100/kontakt.html');
    await expect(row).toContainText('alle 30 Min.');
    await expect(row.getByText('Aktiv', { exact: true })).toBeVisible();
  });

  test('refuses to continue without the confirmation that testing is allowed', async ({ page }) => {
    await page.goto('/jobs/neu');
    await page.getByRole('combobox', { name: 'Kunde' }).selectOption({ label: 'Beispiel GmbH' });
    await page.getByRole('textbox', { name: 'Website (Start-URL)' }).fill('beispiel.de');
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('Ohne Freigabe');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // Next.js has its own role="alert" (route announcer), so filter by text.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Bitte die markierten Angaben prüfen.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: /Test freigegeben/ }),
    ).toHaveAccessibleDescription('Bitte bestätigen, dass ihr diese Website testen dürft.');
  });
});
