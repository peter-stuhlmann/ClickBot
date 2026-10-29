import { expect, test, type Page } from '@playwright/test';

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
    await page.getByLabel('Start (optional)').fill('2026-11-20');
    await page.getByLabel('Ende (optional)').fill('2026-11-30');
    await page.getByRole('button', { name: 'Kampagne anlegen' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /Black Friday/ })).toContainText(
      '20.11.–30.11.2026',
    );

    // The wizard offers the campaigns of this project only.
    await page.goto('/jobs/neu');
    await expect(page.getByRole('combobox', { name: 'Kampagne' }).getByRole('option')).toHaveText([
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

  test('changes a campaign and deletes an empty one, but not one that has jobs', async ({
    page,
  }) => {
    await page.goto('/kampagnen/neu');
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Sommer');
    await page.getByRole('button', { name: 'Kampagne anlegen' }).click();

    await page.getByRole('link', { name: 'E2E Sommer' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Sommer' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Spätsommer');
    await page.getByLabel('Start (optional)').fill('2026-09-01');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /E2E Spätsommer/ })).toContainText('ab 01.09.2026');

    await page.getByRole('link', { name: 'E2E Spätsommer' }).click();
    await page.getByRole('button', { name: 'Kampagne löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/kampagnen');
    await expect(page.getByRole('row', { name: /E2E Spätsommer/ })).toHaveCount(0);

    await page.getByRole('link', { name: 'Allgemein', exact: true }).click();
    await expect(page.getByRole('row', { name: /Login & Bestellstatus/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kampagne löschen' })).toBeDisabled();
  });
});
