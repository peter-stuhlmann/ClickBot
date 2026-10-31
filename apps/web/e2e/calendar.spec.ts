import {
  createDb,
  createJob,
  deleteJob,
  listCampaigns,
  listCustomers,
  type DbConnection,
} from '@click-bot/db';
import { expect, test } from '@playwright/test';

const url =
  process.env.DATABASE_URL_TEST ?? 'postgres://clickbot:clickbot@localhost:5443/clickbot_test';

/** A day of next week as "2026-11-12", plus days. */
function nextWeek(weekday: number): string {
  const date = new Date();
  const monday = date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 7;
  date.setUTCDate(monday + weekday);
  return date.toISOString().slice(0, 10);
}

const MONDAY = nextWeek(0);
const THURSDAY = nextWeek(3);
const label = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

let connection: DbConnection;
const jobIds: string[] = [];

test.beforeAll(async () => {
  connection = createDb(url);
  // The project the app shows without a choice: the first by name.
  const [project] = await listCustomers(connection.db);
  if (!project) throw new Error('Die Demo-Daten haben kein Projekt.');
  const [campaign] = await listCampaigns(connection.db, project.id);
  if (!campaign) throw new Error('Das Projekt hat keine Kampagne.');
  for (const name of ['Kalender A', 'Kalender B']) {
    const job = await createJob(connection.db, {
      campaignId: campaign.id,
      name,
      startUrl: 'http://127.0.0.1:4100',
      flow: { version: 1, steps: [{ id: 'open', type: 'open', url: 'http://127.0.0.1:4100' }] },
      schedule: {
        type: 'times',
        slots: [{ date: THURSDAY, time: '13:38', bots: 4 }],
        staggerSeconds: 0,
      },
      status: 'active',
    });
    jobIds.push(job.id);
  }
});

test.afterAll(async () => {
  for (const id of jobIds) await deleteJob(connection.db, id);
  await connection.close();
});

test.describe('Kalender', () => {
  test('shows the waves of a week and moves one when the browsers run out', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Kalender' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kalender' })).toBeVisible();

    await page.getByRole('link', { name: 'Nächste Woche' }).click();
    await expect(page).toHaveURL(`/kalender?woche=${MONDAY}`);

    const thursday = page.getByRole('region', { name: `Do ${label(THURSDAY)}` });
    await expect(
      thursday.getByRole('link', { name: '13:38 Kalender A, 4 Läufe, Limit überschritten' }),
    ).toBeVisible();
    // Without a worker the limit comes from MAX_CONCURRENT_BROWSERS, 6 in .env.example.
    const load = page.getByRole('region', { name: `Auslastung Do, ${label(THURSDAY)}` });
    await expect(load).toContainText('13:38 Uhr: 8 Läufe für 6 Browser');
    await expect(load).toContainText('2 Läufe warten in der Warteschlange');

    const suggestion = load.getByRole('form', {
      name: 'Vorschlag: „Kalender B“ auf 13:39 verschieben',
    });
    await suggestion.getByRole('button', { name: 'Übernehmen' }).click();

    await expect(thursday.getByRole('link', { name: '13:39 Kalender B, 4 Läufe' })).toBeVisible();
    await expect(load).toContainText(
      'Keine Engpässe: höchstens 4 von 6 Browsern gleichzeitig belegt.',
    );

    // The entry leads to the job, where the date has moved.
    await thursday.getByRole('link', { name: '13:39 Kalender B, 4 Läufe' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kalender B' })).toBeVisible();
  });

  test('shows the load of another day and goes back to this week', async ({ page }) => {
    await page.goto(`/kalender?woche=${MONDAY}`);
    await page.getByRole('link', { name: `Mo ${label(MONDAY)}: Auslastung zeigen` }).click();
    await expect(page).toHaveURL(`/kalender?woche=${MONDAY}&tag=${MONDAY}`);
    await expect(
      page.getByRole('link', { name: `Mo ${label(MONDAY)}: Auslastung zeigen` }),
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      page.getByRole('region', { name: `Auslastung Mo, ${label(MONDAY)}` }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Diese Woche' }).click();
    await expect(page).toHaveURL('/kalender');
  });
});
