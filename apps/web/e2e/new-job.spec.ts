import { expect, test } from '@playwright/test';
import { chooseOption } from './select';

// Runs after jobs.spec.ts (one worker, files in name order), which expects only the demo jobs.
test.describe('Neuer Job', () => {
  test('creates an active job with the wizard and lists it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Neuer Job' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Neuer Job' })).toBeVisible();

    // 1 · Job
    await chooseOption(page.getByRole('combobox', { name: 'Kampagne' }), 'Allgemein');
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('E2E Kontaktseite');
    await page.getByRole('button', { name: 'Weiter' }).click();
    // The start address is asked for with the flow.
    await page
      .getByRole('textbox', { name: 'Website (Start-URL)' })
      .fill('http://127.0.0.1:4100/kontakt.html');

    // 2 · Ablauf: the open step is there, add a check.
    await expect(page.getByRole('button', { name: /^Schritt 1: Öffne/ })).toBeVisible();
    await page.getByRole('button', { name: 'Schritt hinzufügen' }).click();
    await chooseOption(page.getByRole('combobox', { name: 'Aktion' }), 'Prüfen');
    await page.getByRole('textbox', { name: 'Text' }).fill('Kontakt');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 3 · Zeitplan
    await page.getByRole('textbox', { name: 'Alle (Minuten)' }).fill('30');
    await page.getByRole('textbox', { name: 'Max. Läufe' }).fill('2');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 4 · Geräte: beside the summary the card is narrow, so the devices take two rows of two.
    // The cards, not their buttons: a chosen card has a thicker border.
    const top = async (name: RegExp) =>
      (await page.getByRole('button', { name }).locator('..').boundingBox())?.y ?? Number.NaN;
    expect(await top(/^Desktop/)).toBe(await top(/iPhone 15/));
    expect(await top(/Android/)).toBeGreaterThan(await top(/^Desktop/));
    await page.getByRole('button', { name: /iPhone 15/ }).click();
    await expect(page.getByText(/2 Starts × 2 Geräte = 4 Läufe/)).toBeVisible();
    // Each device in its own browsers: the desktop also in Firefox, Android only in Firefox,
    // the iPhone always in Safari.
    const browsersOf = (device: string) =>
      page.getByRole('group', { name: `Browser für ${device}` });
    await browsersOf('Desktop').getByRole('button', { name: 'Firefox' }).click();
    await page.getByRole('button', { name: /^Android/ }).click();
    await browsersOf('Android (Pixel 8)').getByRole('button', { name: 'Firefox' }).click();
    await browsersOf('Android (Pixel 8)').getByRole('button', { name: 'Chrome' }).click();
    await expect(browsersOf('iPhone 15').getByRole('button', { name: 'Safari' })).toBeDisabled();
    await expect(page.getByText(/2 Starts × 4 Kombinationen = 8 Läufe/)).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Zusammenfassung' })).toContainText(
      'Desktop (Chrome), Desktop (Firefox), iPhone 15 (Safari), Android (Pixel 8) (Firefox)',
    );
    await page.getByRole('checkbox', { name: /Test freigegeben/ }).check();
    await page.getByRole('button', { name: 'Job anlegen' }).click();

    await expect(page).toHaveURL('/');
    const row = page.getByRole('row', { name: /E2E Kontaktseite/ });
    await expect(row).toContainText('127.0.0.1:4100/kontakt.html');
    await expect(row).toContainText('alle 30 Min.');
    await expect(row.getByText('Aktiv', { exact: true })).toBeVisible();
  });

  test('creates a job with random starts, shaped by a curve per weekday', async ({ page }) => {
    await page.goto('/jobs/neu');
    await chooseOption(page.getByRole('combobox', { name: 'Kampagne' }), 'Allgemein');
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('E2E Zufall');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page
      .getByRole('textbox', { name: 'Website (Start-URL)' })
      .fill('http://127.0.0.1:4100/kontakt.html');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 3 · Zeitplan: random, 40 runs in the week from today, no starts in the early morning.
    await page.getByRole('radio', { name: 'Zufall' }).click();
    await page.getByRole('textbox', { name: 'Läufe im Zeitraum' }).fill('40');
    const curve = page.getByRole('slider', { name: /^Verteilung am / });
    const box = await curve.boundingBox();
    if (!box) throw new Error('no curve');
    // Drag along the bottom from 2 to 5 o'clock: „nie“ there.
    await page.mouse.move(box.x + (box.width * 2) / 24, box.y + box.height - 1);
    await page.mouse.down();
    await page.mouse.move(box.x + (box.width * 5) / 24, box.y + box.height - 1, { steps: 6 });
    await page.mouse.up();
    await expect(curve).toHaveAttribute('aria-valuetext', '5 Uhr: nie');
    await page.getByRole('button', { name: 'Für alle Wochentage übernehmen' }).click();
    await expect(page.getByText(/40 Starts × 1 Gerät = 40 Läufe/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();

    await page.getByRole('checkbox', { name: /Test freigegeben/ }).check();
    await page.getByRole('button', { name: 'Job anlegen' }).click();
    await expect(page).toHaveURL('/');
    const row = page.getByRole('row', { name: /E2E Zufall/ });
    await expect(row).toContainText(/zufällig \d{2}\.\d{2}\.\d{4}–\d{2}\.\d{2}\.\d{4}/);
    await expect(row).toContainText('40 Läufe');
  });

  test('creates no job without the confirmation that testing is allowed', async ({ page }) => {
    await page.goto('/jobs/neu');
    await chooseOption(page.getByRole('combobox', { name: 'Kampagne' }), 'Allgemein');
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('Ohne Freigabe');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('textbox', { name: 'Website (Start-URL)' }).fill('beispiel.de');
    for (let step = 2; step <= 3; step += 1) {
      await page.getByRole('button', { name: 'Weiter' }).click();
    }
    await page.getByRole('button', { name: 'Job anlegen' }).click();

    // Next.js has its own role="alert" (route announcer), so filter by text.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Bitte die markierten Angaben prüfen.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: /Test freigegeben/ }),
    ).toHaveAccessibleDescription('Bitte bestätigen, dass ihr diese Website testen dürft.');
    await expect(page).toHaveURL('/jobs/neu');
  });

  // Uses the job created above.
  test('moves a job to another campaign and deletes it', async ({ page }) => {
    await page.goto('/kampagnen/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Verschoben');
    await page.getByRole('button', { name: 'Kampagne anlegen' }).click();

    await page.goto('/');
    await page.getByRole('link', { name: 'E2E Kontaktseite', exact: true }).click();
    await chooseOption(page.getByRole('combobox', { name: 'Kampagne' }), 'E2E Verschoben');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('row', { name: /E2E Kontaktseite/ })).toContainText(
      'E2E Verschoben',
    );

    await page.getByRole('link', { name: 'E2E Kontaktseite', exact: true }).click();
    await page.getByRole('button', { name: 'Job löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('row', { name: /E2E Kontaktseite/ })).toHaveCount(0);
  });
});
