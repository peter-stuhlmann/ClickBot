import { expect, test, type Page } from '@playwright/test';

const userCard = (page: Page, name: string) =>
  page
    .getByRole('complementary')
    .getByRole('link', { name: `Profil: ${name}` })
    .last();

/** A real 600 × 300 PNG, drawn in the browser, so the shrinking runs on a real picture. */
async function landscapePng(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = '#4f46e5';
    context.fillRect(0, 0, 600, 300);
    return canvas.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1] as string, 'base64');
}

test.describe('Profil', () => {
  test('changes name and picture; e-mail and role are only shown', async ({ page }) => {
    await page.goto('/');
    await userCard(page, 'E2E Admin').click();
    await expect(page).toHaveURL('/profil');
    await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
    await expect(userCard(page, 'E2E Admin')).toHaveAttribute('aria-current', 'page');

    const form = page.getByRole('form', { name: 'Profil' });
    await expect(form.getByRole('definition')).toHaveText(['admin@e2e.test', 'Admin']);
    await expect(form.getByRole('textbox')).toHaveCount(1);

    await form.getByLabel('Bild wählen').setInputFiles({
      name: 'banner.png',
      mimeType: 'image/png',
      buffer: await landscapePng(page),
    });
    await expect(form.getByText('Neues Bild – „Speichern“ übernimmt es.')).toBeVisible();
    await form.getByRole('textbox', { name: 'Name' }).fill('E2E Profil');
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(form.getByRole('status')).toHaveText('Gespeichert.');

    // The sidebar shows the new name and the picture, cut square and shrunk in the browser.
    const picture = userCard(page, 'E2E Profil').locator('img');
    await expect(picture).toHaveJSProperty('naturalWidth', 256);
    await expect(picture).toHaveJSProperty('naturalHeight', 256);
    const response = await page.request.get((await picture.getAttribute('src')) as string);
    expect(response.headers()['content-type']).toBe('image/webp');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');

    await page.goto('/einstellungen/team');
    await expect(
      page.getByRole('region', { name: 'Team' }).getByRole('listitem').locator('img'),
    ).toHaveCount(1);

    await page.goto('/profil');
    await form.getByRole('button', { name: 'Bild entfernen' }).click();
    await form.getByRole('textbox', { name: 'Name' }).fill('E2E Admin');
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(form.getByRole('status')).toHaveText('Gespeichert.');
    await expect(userCard(page, 'E2E Admin')).toContainText('EA');
    await expect(userCard(page, 'E2E Admin').locator('img')).toHaveCount(0);
  });

  test('refuses an empty name', async ({ page }) => {
    await page.goto('/profil');
    const name = page.getByRole('textbox', { name: 'Name' });
    await name.fill('   ');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(name).toHaveAccessibleDescription('Name fehlt.');
    await expect(userCard(page, 'E2E Admin')).toBeVisible();
  });

  test('shows profile pictures to signed-in users only', async ({ playwright, baseURL }) => {
    // Without storageState the context would take the signed-in session from the config.
    const anonymous = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await anonymous.get('/avatar/00000000-0000-0000-0000-000000000000?v=1');
    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });
});
