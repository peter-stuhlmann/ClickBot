import { createDb, createJob, listCampaigns, listCustomers } from '@click-bot/db';
import { expect, test, type Page } from '@playwright/test';

const url =
  process.env.DATABASE_URL_TEST ?? 'postgres://clickbot:clickbot@localhost:5443/clickbot_test';

const switcher = (page: Page) => page.getByRole('button', { name: /^Projekt: / });

test.describe('Projekte und Kampagnen', () => {
  test('lists the campaigns of the current project', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Kampagnen' })
      .click();

    await expect(page).toHaveURL('/kampagnen');
    await expect(switcher(page)).toHaveAccessibleName('Projekt: Beispiel GmbH');
    const row = page.getByRole('row', { name: /Allgemein/ });
    await expect(row).toContainText('127.0.0.1:4100 · 1 Website');
    await expect(row).toContainText(/\d+ Jobs/);
  });

  test('sends old links to the project list on to the campaigns', async ({ page }) => {
    await page.goto('/projekte');
    await expect(page).toHaveURL('/kampagnen');
    await page.goto('/kunden');
    await expect(page).toHaveURL('/kampagnen');
    await page.goto('/kunden/neu');
    await expect(page).toHaveURL('/projekte/neu');
  });

  test('creates a project from the switcher, with a campaign, and switches back by searching', async ({
    page,
  }) => {
    await page.goto('/kampagnen');
    await switcher(page).click();
    await page.getByRole('link', { name: 'Neues Projekt' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Müller Shop');
    await page.getByRole('button', { name: 'Projekt anlegen' }).click();

    // The new project is the current one and starts with the campaign "Allgemein".
    await expect(page).toHaveURL('/kampagnen');
    await expect(switcher(page)).toHaveAccessibleName('Projekt: E2E Müller Shop');
    await expect(page.getByRole('row', { name: /Allgemein/ })).toContainText('noch keine Website');

    await page.getByRole('link', { name: 'Kampagne anlegen' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Black Friday');
    await page.getByLabel('Start (optional)').fill('20.11.2026');
    await page.getByLabel('Ende (optional)').fill('30.11.2026');
    await page.getByRole('button', { name: 'Kampagne anlegen' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /Black Friday/ })).toContainText(
      '20.11.–30.11.2026',
    );

    // The wizard offers the campaigns of this project only.
    await page.goto('/jobs/neu');
    await page.getByRole('combobox', { name: 'Kampagne' }).click();
    await expect(page.getByRole('listbox', { name: 'Kampagne' }).getByRole('option')).toHaveText([
      'Kampagne wählen',
      'Allgemein',
      'Black Friday',
    ]);

    await switcher(page).click();
    await page.getByRole('searchbox', { name: 'Projekt suchen' }).fill('beisp');
    await expect(
      page.getByRole('dialog', { name: 'Projekt wechseln' }).getByRole('option'),
    ).toHaveText(['Beispiel GmbH']);
    await page.keyboard.press('Enter');
    await expect(switcher(page)).toHaveAccessibleName('Projekt: Beispiel GmbH');
  });

  test('refuses a project or a campaign that exists already', async ({ page }) => {
    await page.goto('/projekte/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('beispiel gmbh');
    await page.getByRole('button', { name: 'Projekt anlegen' }).click();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      'Dieses Projekt gibt es schon.',
    );

    await page.goto('/kampagnen/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('allgemein');
    await page.getByRole('button', { name: 'Kampagne anlegen' }).click();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      'Diese Kampagne gibt es in diesem Projekt schon.',
    );
  });

  test('renames and deletes a project, but not one that has jobs', async ({ page }) => {
    await page.goto('/projekte/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Kurzlebig');
    await page.getByRole('button', { name: 'Projekt anlegen' }).click();
    await expect(switcher(page)).toHaveAccessibleName('Projekt: E2E Kurzlebig');

    await page.getByRole('link', { name: 'Projekt bearbeiten' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Umbenannt');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(switcher(page)).toHaveAccessibleName('Projekt: E2E Umbenannt');

    await page.getByRole('link', { name: 'Projekt bearbeiten' }).click();
    await page.getByRole('button', { name: 'Projekt löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await switcher(page).click();
    await expect(
      page
        .getByRole('dialog', { name: 'Projekt wechseln' })
        .getByRole('option', { name: 'E2E Umbenannt' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The demo project has jobs: it stays, and the page says why.
    await expect(switcher(page)).toHaveAccessibleName('Projekt: Beispiel GmbH');
    await page.getByRole('link', { name: 'Projekt bearbeiten' }).click();
    await expect(page.getByRole('button', { name: 'Projekt löschen' })).toBeDisabled();
    await expect(page.getByText(/Das Projekt hat noch \d+ Jobs/)).toBeVisible();
  });

  test('changes a campaign and deletes an empty one, one with jobs only after typing', async ({
    page,
  }) => {
    await page.goto('/kampagnen/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Sommer');
    await page.getByRole('button', { name: 'Kampagne anlegen' }).click();

    await page.getByRole('link', { name: 'E2E Sommer' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Sommer' })).toBeVisible();
    // The settings wait behind the button next to the name; Escape closes them again.
    await expect(page.getByRole('form', { name: 'Kampagne bearbeiten' })).toHaveCount(0);
    const settings = page.getByRole('button', { name: 'Kampagne bearbeiten' });
    await settings.click();
    const dialog = page.getByRole('dialog', { name: 'Kampagne bearbeiten' });
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(settings).toBeFocused();
    await settings.click();
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialog).toBeHidden();

    await settings.click();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Spätsommer');
    await page.getByLabel('Start (optional)').fill('01.09.2026');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /E2E Spätsommer/ })).toContainText('ab 01.09.2026');

    await page.getByRole('link', { name: 'E2E Spätsommer' }).click();
    await page.getByRole('button', { name: 'Kampagne bearbeiten' }).click();
    await page.getByRole('button', { name: 'Kampagne löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /E2E Spätsommer/ })).toHaveCount(0);

    // With jobs, the final button waits for "<name> löschen"; here it is called off.
    await page.getByRole('link', { name: 'Allgemein', exact: true }).click();
    await expect(page.getByRole('row', { name: /Login & Bestellstatus/ })).toBeVisible();
    await page.getByRole('button', { name: 'Kampagne bearbeiten' }).click();
    await page.getByRole('button', { name: 'Kampagne löschen' }).click();
    const typed = page.getByRole('textbox', {
      name: 'Zum Bestätigen „Allgemein löschen“ eintippen',
    });
    await typed.fill('allgemein löschen');
    await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toBeDisabled();
    await page.getByRole('button', { name: 'Abbrechen' }).last().click();
    await expect(typed).toHaveCount(0);
  });

  test('deletes a campaign together with its jobs', async ({ page }) => {
    const connection = createDb(url);
    try {
      const [project] = await listCustomers(connection.db);
      if (!project) throw new Error('Die Demo-Daten haben kein Projekt.');
      await page.goto('/kampagnen/neu');
      await page.getByRole('textbox', { name: 'Name' }).fill('E2E Ausverkauf');
      await page.getByRole('button', { name: 'Kampagne anlegen' }).click();
      await expect(page).toHaveURL('/kampagnen');
      const campaign = (await listCampaigns(connection.db, project.id)).find(
        (option) => option.name === 'E2E Ausverkauf',
      );
      if (!campaign) throw new Error('Die Kampagne fehlt.');
      await createJob(connection.db, {
        campaignId: campaign.id,
        name: 'E2E Ausverkauf-Job',
        startUrl: 'http://127.0.0.1:4100',
        flow: { version: 1, steps: [{ id: 'open', type: 'open', url: 'http://127.0.0.1:4100' }] },
        schedule: {
          type: 'interval',
          everyMinutes: 60,
          maxRuns: 1,
          startAt: '2030-01-01T10:00:00Z',
        },
      });
    } finally {
      await connection.close();
    }

    await page.getByRole('link', { name: 'E2E Ausverkauf' }).click();
    await page.getByRole('button', { name: 'Kampagne bearbeiten' }).click();
    await expect(page.getByRole('dialog')).toContainText('mit ihrem Job und allen Läufen');
    await page.getByRole('button', { name: 'Kampagne löschen' }).click();
    await page
      .getByRole('textbox', { name: 'Zum Bestätigen „E2E Ausverkauf löschen“ eintippen' })
      .fill('E2E Ausverkauf löschen');
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /E2E Ausverkauf/ })).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByText('E2E Ausverkauf-Job')).toHaveCount(0);
  });

  test('opens the settings of a campaign as a dialog that fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/kampagnen');
    await page.getByRole('link', { name: 'Allgemein', exact: true }).click();
    await page.getByRole('button', { name: 'Kampagne bearbeiten' }).click();
    const dialog = page.getByRole('dialog', { name: 'Kampagne bearbeiten' });
    const box = await dialog.boundingBox();
    expect(box && box.x > 0 && box.x + box.width < 360).toBe(true);
    // The calendar of a date field opens inside the dialog.
    await dialog.getByRole('button', { name: 'Kalender für Start' }).click();
    await expect(page.getByRole('dialog', { name: 'Start wählen' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Start wählen' })).toBeHidden();
  });

  test('chooses the period in the calendar, also on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/kampagnen/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Kalender');
    // The calendar opens on the month of the date in the field (without one: today).
    await page.getByLabel('Start (optional)').fill('01.11.2026');
    await page.getByRole('button', { name: 'Kalender für Start' }).click();
    const start = page.getByRole('dialog', { name: 'Start wählen' });
    await expect(start).toContainText('November 2026');
    const box = await start.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 360).toBe(true);
    await start.getByRole('button', { name: 'Freitag, 20. November 2026' }).click();

    // Once the start is chosen, the end follows: no day before the start can be chosen.
    const end = page.getByRole('dialog', { name: 'Ende wählen' });
    await expect(end).toContainText('November 2026');
    await expect(end.getByRole('button', { name: 'Donnerstag, 19. November 2026' })).toBeDisabled();
    await end.getByRole('button', { name: 'Nächster Monat' }).click();
    await end.getByRole('button', { name: 'Montag, 7. Dezember 2026' }).click();
    await expect(end).toBeHidden();
    await expect(page.getByLabel('Start (optional)')).toHaveValue('20.11.2026');
    await expect(page.getByLabel('Ende (optional)')).toHaveValue('07.12.2026');

    await page.getByRole('button', { name: 'Kampagne anlegen' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /E2E Kalender/ })).toContainText(
      '20.11.–07.12.2026',
    );
  });
});
