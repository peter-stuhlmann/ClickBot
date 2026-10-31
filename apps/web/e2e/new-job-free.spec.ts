import { expect, test } from '@playwright/test';

test.describe('Neuer Job – Frei mit KI', () => {
  test('creates a free test with only its goal, which the editor shows again', async ({ page }) => {
    await page.goto('/jobs/neu');
    await page
      .getByRole('textbox', { name: 'Website (Start-URL)' })
      .fill('http://127.0.0.1:4100/newsletter.html');

    await page.getByRole('button', { name: /Frei mit KI/ }).click();
    const goal = 'Es gibt ein Feld für die E-Mail. Ungültige Adressen werden abgelehnt.';
    await page.getByRole('textbox', { name: 'Was soll auf der Website gelten?' }).fill(goal);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('E2E Freier Test');
    await page.getByRole('checkbox', { name: /Test freigegeben/ }).check();
    await page.getByRole('button', { name: 'Job anlegen' }).click();
    await expect(page).toHaveURL('/');

    await page.getByRole('link', { name: 'E2E Freier Test', exact: true }).click();
    await page.getByRole('button', { name: /^Schritt 2:/ }).click();
    await expect(page.getByRole('textbox', { name: 'Ziel des Tests' })).toHaveValue(goal);

    await page.getByRole('button', { name: 'Job löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL('/');
  });
});
