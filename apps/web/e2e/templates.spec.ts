import { expect, test } from '@playwright/test';

test.describe('Vorlagen', () => {
  test('makes a template, takes it over in the wizard and deletes it again', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Vorlagen' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Vorlagen' })).toBeVisible();
    await page.getByRole('link', { name: 'Neue Vorlage' }).click();

    // A template starts with a click: every job opens its own start page.
    await page.getByRole('textbox', { name: 'Name der Vorlage' }).fill('E2E Kontakt absenden');
    await page.getByRole('textbox', { name: 'Beschreibung (optional)' }).fill('Für jede Website.');
    await page.getByRole('button', { name: 'Schritt hinzufügen' }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Absenden');
    // Password protection belongs to one website.
    await page.getByRole('combobox', { name: 'Aktion' }).click();
    await expect(page.getByRole('option', { name: 'Passwortschutz (.htaccess)' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Vorlage anlegen' }).click();

    await expect(page).toHaveURL('/vorlagen');
    const card = page.getByRole('listitem').filter({ hasText: 'E2E Kontakt absenden' });
    await expect(card).toContainText('Für jede Website.');
    await expect(card).toContainText('1 Schritt');

    // In the wizard: the steps come after opening the start page.
    await page.goto('/jobs/neu');
    await page
      .getByRole('textbox', { name: 'Adresse der Website' })
      .fill('http://127.0.0.1:4100/kontakt.html');
    await page.getByRole('button', { name: /Aus Vorlage übernehmen/ }).click();
    await page.getByRole('button', { name: /E2E Kontakt absenden/ }).click();
    await page.getByRole('button', { name: 'Schritte übernehmen' }).click();
    await expect(
      page.getByRole('button', { name: 'Schritt 1: Öffne 127.0.0.1:4100/kontakt.html' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Schritt 2: Klicke auf „Absenden“' }),
    ).toBeVisible();

    // Deleting the template changes no job.
    await page.goto('/vorlagen');
    await page.getByRole('link', { name: 'E2E Kontakt absenden' }).click();
    await page.getByRole('button', { name: 'Vorlage löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/vorlagen');
    await expect(page.getByText('E2E Kontakt absenden')).toHaveCount(0);
  });

  test('saves the flow of a job as a template', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Newsletter-Anmeldung', exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Newsletter-Anmeldung' }),
    ).toBeVisible();

    await page.getByRole('textbox', { name: 'Name der Vorlage' }).fill('E2E Newsletter');
    await page.getByRole('button', { name: 'Vorlage erstellen' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Vorlage „E2E Newsletter“ gespeichert.' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Vorlage öffnen' }).click();

    // Without opening the start page; the rest as in the job.
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Newsletter' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Schritt 1: Öffne/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Schritt 1:/ })).toBeVisible();

    // A second time with the same name is refused.
    await page.goBack();
    await page.getByRole('textbox', { name: 'Name der Vorlage' }).fill('e2e newsletter');
    await page.getByRole('button', { name: 'Vorlage erstellen' }).click();
    await expect(
      page.getByRole('textbox', { name: 'Name der Vorlage' }),
    ).toHaveAccessibleDescription('Eine Vorlage mit diesem Namen gibt es schon.');

    await page.goto('/vorlagen');
    await page.getByRole('link', { name: 'E2E Newsletter' }).click();
    await page.getByRole('button', { name: 'Vorlage löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/vorlagen');
  });
});
