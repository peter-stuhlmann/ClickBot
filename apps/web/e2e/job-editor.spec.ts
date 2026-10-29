import { expect, test } from '@playwright/test';

// Changes only the flow of "Newsletter-Anmeldung": the other specs rely on names and figures.
test.describe('Job-Editor', () => {
  test('adds a step to a job and keeps it after reloading', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Newsletter-Anmeldung', exact: true }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Newsletter-Anmeldung' }),
    ).toBeVisible();
    const save = page.getByRole('button', { name: 'Speichern' });
    await expect(save).toBeDisabled();
    const steps = page.getByRole('button', { name: /^Schritt \d+:/ });
    const before = await steps.count();

    await page.getByRole('button', { name: 'Schritt hinzufügen' }).click();
    await page.getByRole('combobox', { name: 'Aktion' }).selectOption({ label: 'Prüfen' });
    await page.getByRole('textbox', { name: 'Text' }).fill('Newsletter');
    await save.click();

    // The sidebar has its own status (worker online), so filter by text.
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert.' })).toBeVisible();
    await expect(save).toBeDisabled();

    await page.reload();
    await expect(steps).toHaveCount(before + 1);
    await expect(steps.last()).toHaveAccessibleName(
      `Schritt ${before + 1}: Prüfe: „Newsletter“ ist sichtbar`,
    );
  });

  test('does not save an invalid job', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Newsletter-Anmeldung', exact: true }).click();
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Nicht gespeichert' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Job-Name' })).toHaveValue(
      'Newsletter-Anmeldung',
    );
  });

  test('shows a not-found page for an unknown job', async ({ page }) => {
    const response = await page.goto('/jobs/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(404);
  });

  test('starts a test run and shows it while it waits, without queuing it twice', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Newsletter-Anmeldung', exact: true }).click();
    await page.getByRole('button', { name: 'Testlauf starten' }).click();

    await expect(page).toHaveURL(/\/laeufe\//);
    const reportUrl = page.url();
    await expect(page.getByRole('heading', { level: 1, name: /^Lauf #\d+/ })).toBeVisible();
    await expect(page.getByText('manuell gestartet', { exact: false })).toBeVisible();
    // No worker runs during the e2e tests.
    await expect(
      page.getByRole('status').filter({ hasText: 'Der Worker ist offline.' }),
    ).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Pfad' })
      .getByRole('link', { name: 'Newsletter-Anmeldung' })
      .click();
    await page.getByRole('button', { name: 'Testlauf starten' }).click();
    await expect(page).toHaveURL(reportUrl);
  });

  test('switches the GA4 marking of a job off, with a warning, and keeps it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Kontaktformular-Test', exact: true }).click();
    const main = page.getByRole('switch', { name: 'Bot-Läufe in GA4 markieren' });
    await expect(main).toBeChecked();

    await main.click();
    await expect(page.getByRole('switch', { name: 'Debug-Modus' })).not.toBeChecked();
    await expect(
      page.getByRole('region', { name: 'Bot-Läufe zählen in GA4 wie echte Besuche' }),
    ).toBeVisible();

    await page.getByRole('switch', { name: 'Bot-Kennung' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert.' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('switch', { name: 'Bot-Kennung' })).toBeChecked();
    await expect(page.getByRole('switch', { name: 'Debug-Modus' })).not.toBeChecked();
    await expect(page.getByRole('region', { name: 'Markierung eingeschränkt' })).toContainText(
      'Aus: Debug-Modus, Interner Traffic, Laufnummer',
    );
  });
});
