import { expect, test } from '@playwright/test';
import { chooseOption } from './select';

// Runs after jobs.spec.ts (one worker, files in name order), which expects only the demo jobs.
test.describe('Neuer Test', () => {
  test('creates an active job with the wizard and lists it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Neuer Test' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Neuer Test' })).toBeVisible();

    // 1 · Job
    // The start address is asked for with the flow.
    await page
      .getByRole('textbox', { name: 'Adresse der Website' })
      .fill('http://127.0.0.1:4100/kontakt.html');

    // 1 · Website & Test: a free test, only its goal.
    await page.getByRole('button', { name: /Frei mit KI/ }).click();
    await page
      .getByRole('textbox', { name: 'Was soll auf der Website gelten?' })
      .fill('Es gibt ein Kontaktformular mit Feldern für Name und E-Mail.');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 2 · Wann
    await chooseOption(page.getByRole('combobox', { name: 'Wie oft?' }), 'Eigener Abstand');
    await page.getByRole('textbox', { name: 'Abstand in Minuten' }).fill('30');
    await page.getByRole('textbox', { name: 'Wie oft insgesamt?' }).fill('2');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 3 · Geräte & Freigabe: beside the summary the card is narrow, so the devices take two
    // rows of two.
    // The cards, not their buttons: a chosen card has a thicker border.
    const top = async (name: RegExp) =>
      (await page.getByRole('button', { name }).locator('..').boundingBox())?.y ?? Number.NaN;
    expect(await top(/^Desktop/)).toBe(await top(/iPhone 15/));
    expect(await top(/Android/)).toBeGreaterThan(await top(/^Desktop/));
    await page.getByRole('button', { name: /iPhone 15/ }).click();
    await expect(page.getByText(/2 Starts × 2 Geräte = 4 Durchläufe/)).toBeVisible();
    // Each device in its own browsers: the desktop also in Firefox, Android only in Firefox,
    // the iPhone always in Safari.
    const browsersOf = (device: string) =>
      page.getByRole('group', { name: `Browser für ${device}` });
    await browsersOf('Desktop').getByRole('button', { name: 'Firefox' }).click();
    await page.getByRole('button', { name: /^Android/ }).click();
    await browsersOf('Android (Pixel 8)').getByRole('button', { name: 'Firefox' }).click();
    await browsersOf('Android (Pixel 8)').getByRole('button', { name: 'Chrome' }).click();
    await expect(browsersOf('iPhone 15').getByRole('button', { name: 'Safari' })).toBeDisabled();
    await expect(page.getByText(/2 Starts × 4 Kombinationen = 8 Durchläufe/)).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Zusammenfassung' })).toContainText(
      'Desktop (Chrome), Desktop (Firefox), iPhone 15 (Safari), Android (Pixel 8) (Firefox)',
    );
    // The name is suggested from the goal.
    await expect(page.getByRole('textbox', { name: 'Name des Tests' })).toHaveValue(
      'Es gibt ein Kontaktformular mit Feldern für Name und E-Mail',
    );
    await page.getByRole('textbox', { name: 'Name des Tests' }).fill('E2E Kontaktseite');
    await page.getByRole('checkbox', { name: /Test freigegeben/ }).check();
    await page.getByRole('button', { name: 'Test anlegen' }).click();

    await expect(page).toHaveURL('/');
    const row = page.getByRole('row', { name: /E2E Kontaktseite/ });
    await expect(row).toContainText('127.0.0.1:4100/kontakt.html');
    await expect(row).toContainText('alle 30 Min.');
    await expect(row.getByText('Aktiv', { exact: true })).toBeVisible();

    // "Jetzt ausführen" starts every device in every browser at once and shows them together.
    await row.getByRole('button', { name: 'Jetzt ausführen' }).click();
    await expect(page).toHaveURL(/\/laeufe\/welle\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /^Start \d\d:\d\d Uhr$/ }),
    ).toBeVisible();
    await expect(page.getByText('4 Durchläufe auf 3 Geräten')).toBeVisible();
    const table = page.getByRole('region', { name: 'Durchläufe dieses Starts' });
    const cells = table.getByRole('row').filter({ has: page.getByRole('link') });
    await expect(cells).toHaveCount(4);
    await expect(table).toContainText('Firefox');
    await expect(table).toContainText('iPhone 15');
    // No worker runs during the e2e tests: everything waits.
    await expect(
      page.getByRole('status').filter({ hasText: 'Das Testsystem ist nicht verbunden.' }),
    ).toBeVisible();

    // A single run links back to its start.
    await table.getByRole('link', { name: 'iPhone 15' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /manuell gestartet/ })).toBeVisible();
    await page.getByRole('link', { name: 'Alle 4 Durchläufe dieses Starts' }).click();
    await expect(page).toHaveURL(/\/laeufe\/welle\//);
  });

  test('creates a job with random starts, shaped by a curve per weekday', async ({ page }) => {
    await page.goto('/jobs/neu');
    await page
      .getByRole('textbox', { name: 'Adresse der Website' })
      .fill('http://127.0.0.1:4100/kontakt.html');
    await page.getByRole('button', { name: /Frei mit KI/ }).click();
    await page
      .getByRole('textbox', { name: 'Was soll auf der Website gelten?' })
      .fill('Die Seite lädt.');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 2 · Wann: random, 40 runs in the week from today, no starts in the early morning.
    await page.getByRole('radio', { name: 'Zufällig verteilt' }).click();
    await page.getByRole('textbox', { name: 'Durchläufe im Zeitraum' }).fill('40');
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
    await expect(page.getByText(/40 Starts × 1 Gerät = 40 Durchläufe/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();

    await page.getByRole('textbox', { name: 'Name des Tests' }).fill('E2E Zufall');
    await page.getByRole('checkbox', { name: /Test freigegeben/ }).check();
    await page.getByRole('button', { name: 'Test anlegen' }).click();
    await expect(page).toHaveURL('/');
    const row = page.getByRole('row', { name: /E2E Zufall/ });
    await expect(row).toContainText(/zufällig \d{2}\.\d{2}\.\d{4}–\d{2}\.\d{2}\.\d{4}/);
    await expect(row).toContainText('40 Durchläufe');
  });

  test('creates no job without the confirmation that testing is allowed', async ({ page }) => {
    await page.goto('/jobs/neu');
    await page.getByRole('textbox', { name: 'Adresse der Website' }).fill('beispiel.de');
    await page.getByRole('button', { name: /Frei mit KI/ }).click();
    await page
      .getByRole('textbox', { name: 'Was soll auf der Website gelten?' })
      .fill('Die Seite lädt.');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Test anlegen' }).click();

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
    await page.getByRole('button', { name: 'Test löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('row', { name: /E2E Kontaktseite/ })).toHaveCount(0);
  });
});
