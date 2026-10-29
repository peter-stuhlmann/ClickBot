import { expect, test } from '@playwright/test';

// Never talks to a real AI provider: saving needs no connection, and the connection test goes to
// a local port where nothing answers.
test.describe('Einstellungen → KI & API', () => {
  test('stores a key without ever showing it again and makes the provider the default', async ({
    page,
  }) => {
    await page.goto('/einstellungen');
    await page
      .getByRole('navigation', { name: 'Einstellungen' })
      .getByRole('link', { name: 'KI & API' })
      .click();
    await expect(page).toHaveURL(/\/einstellungen\/ki$/);

    const claude = page.getByRole('region', { name: 'Claude', exact: true });
    await expect(claude.getByText('Nicht eingerichtet')).toBeVisible();
    await claude.getByLabel('API-Schlüssel').fill('sk-ant-e2e-geheim-9876');
    await claude.getByRole('combobox', { name: 'Modell' }).fill('claude-sonnet-5-5');
    await claude.getByRole('button', { name: 'Speichern' }).click();
    await expect(claude.getByRole('status')).toHaveText('Gespeichert.');

    await page.reload();
    await expect(claude.getByText('Standard', { exact: true })).toBeVisible();
    await expect(claude.getByLabel('API-Schlüssel')).toHaveValue('');
    await expect(claude.getByLabel('API-Schlüssel')).toHaveAttribute(
      'placeholder',
      'Gespeichert (…9876) – leer lassen, um ihn zu behalten',
    );
    await expect(claude.getByRole('combobox', { name: 'Modell' })).toHaveValue('claude-sonnet-5-5');
    expect(await page.content()).not.toContain('e2e-geheim');
  });

  test('says when a provider cannot be reached', async ({ page }) => {
    await page.goto('/einstellungen/ki');
    const custom = page.getByRole('region', { name: 'Custom', exact: true });
    // Port 9 (discard) has no HTTP server.
    await custom.getByRole('textbox', { name: 'Adresse der API' }).fill('http://127.0.0.1:9/v1');
    await custom.getByRole('combobox', { name: 'Modell' }).fill('llama');
    await custom.getByRole('button', { name: 'Verbindung testen' }).click();
    await expect(custom.getByRole('status')).toContainText('Custom ist nicht erreichbar');
  });

  test('asks for the missing fields instead of saving', async ({ page }) => {
    await page.goto('/einstellungen/ki');
    const gemini = page.getByRole('region', { name: 'Gemini', exact: true });
    await gemini.getByRole('button', { name: 'Speichern' }).click();
    await expect(gemini.getByLabel('API-Schlüssel')).toHaveAccessibleDescription(
      /Bitte den API-Schlüssel eintragen/,
    );
    await expect(gemini.getByRole('combobox', { name: 'Modell' })).toHaveAccessibleDescription(
      /Bitte ausfüllen/,
    );
  });
});
