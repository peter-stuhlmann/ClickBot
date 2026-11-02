import { expect, test } from '@playwright/test';

// Runs after jobs.spec.ts (files in name order) and removes its draft again, so the job list of
// later specs is as they expect it.
test.describe('Neuer Test – Entwurf und Testlauf', () => {
  test('keeps the flow as a draft through a reload, test-runs it once and deletes it', async ({
    page,
  }) => {
    await page.goto('/jobs/neu');
    await page
      .getByRole('textbox', { name: 'Adresse der Website' })
      .fill('http://127.0.0.1:4100/kontakt.html');
    await page.getByRole('button', { name: /Frei mit KI/ }).click();
    const goal = 'Das Kontaktformular hat Felder für Name und E-Mail.';
    await page.getByRole('textbox', { name: 'Was soll auf der Website gelten?' }).fill(goal);

    // Saved on its own, and the address names the draft.
    await expect(page).toHaveURL(/\/jobs\/neu\?entwurf=[0-9a-f-]{36}$/);
    await expect(page.getByText(/Als Entwurf gespeichert um/)).toBeVisible();
    const draftUrl = page.url();

    await page.reload();
    await expect(
      page.getByRole('textbox', { name: 'Was soll auf der Website gelten?' }),
    ).toHaveValue(goal);
    await expect(page.getByRole('textbox', { name: 'Adresse der Website' })).toHaveValue(
      'http://127.0.0.1:4100/kontakt.html',
    );

    // "Testlauf": one run right away. No worker runs in these tests, so it waits.
    const card = page.getByRole('region', { name: 'Testlauf' });
    await card.getByRole('button', { name: 'Testlauf' }).click();
    await expect(card.getByRole('status')).toContainText('Wartet');
    await expect(card.getByRole('status')).toContainText('Das Testsystem ist nicht verbunden.');
    await expect(card.getByRole('link', { name: 'Report öffnen' })).toHaveAttribute(
      'href',
      /^\/laeufe\/[0-9a-f-]{36}$/,
    );
    await expect(card.getByRole('button', { name: 'Erneut testen' })).toBeDisabled();

    // The draft is in the job list and leads back into the wizard, with its test run.
    await page.goto('/');
    const row = page.getByRole('row', { name: /Das Kontaktformular hat Felder/ });
    await expect(row).toContainText('Entwurf');
    await row
      .getByRole('link', { name: 'Das Kontaktformular hat Felder für Name und E-Mail' })
      .click();
    await expect(page).toHaveURL(draftUrl);
    await expect(page.getByRole('region', { name: 'Testlauf' }).getByRole('status')).toContainText(
      'Wartet',
    );

    await page.getByRole('button', { name: 'Entwurf löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('row', { name: /Das Kontaktformular hat Felder/ })).toHaveCount(0);
  });
});
