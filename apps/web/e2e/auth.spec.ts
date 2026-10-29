import { readFileSync } from 'node:fs';
import { totpCode, totpStep } from '@click-bot/db';
import { expect, test, type Page } from '@playwright/test';
import { CREDENTIALS } from './auth-setup';

type Credentials = { name: string; email: string; password: string; secret: string };
const admin = JSON.parse(readFileSync(CREDENTIALS, 'utf8')) as Credentials;

/**
 * A code the server accepts once: global-setup used the code of its own time step, and every
 * code works only once, so the code of the next step (allowed for clocks that are a bit off).
 */
const nextCode = (secret: string) => totpCode(secret, totpStep(new Date()) + 1);

const alert = (page: Page, text: string | RegExp) =>
  // Next.js has its own role="alert" (route announcer), so filter by text.
  page.getByRole('alert').filter({ hasText: text });

// Without the admin session from global-setup.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Anmeldung', () => {
  test('lets nobody in without signing in, not even to screenshots', async ({ page, request }) => {
    await page.goto('/kunden');
    await expect(page).toHaveURL('/anmelden');
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();

    expect((await request.get('/artifacts/runs/e2e/0-open.png')).status()).toBe(401);
  });

  test('signs in with password and 2FA code, and out again', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(admin.email);
    await page.getByLabel('Passwort').fill('falsches-passwort-1');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(alert(page, 'E-Mail oder Passwort ist falsch.')).toBeVisible();

    await page.getByLabel('Passwort').fill(admin.password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/anmelden/code');

    await page.getByLabel('Code aus der Authenticator-App').fill('000000');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(alert(page, 'Der Code stimmt nicht.')).toBeVisible();

    await page.getByLabel('Code aus der Authenticator-App').fill(nextCode(admin.secret));
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('complementary')).toContainText(admin.name);

    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL('/anmelden');
    await page.goto('/');
    await expect(page).toHaveURL('/anmelden');
  });

  test('keeps the registration closed once an account exists', async ({ page }) => {
    await page.goto('/registrieren');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Registrierung geschlossen' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });

  test('brings a new person in by invitation, with 2FA from the start', async ({
    page,
    browser,
  }) => {
    // The admin creates the link.
    const adminContext = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/einstellungen/team');
    await adminPage.getByLabel('E-Mail').fill('anna@e2e.test');
    await adminPage.getByRole('button', { name: 'Einladungslink erstellen' }).click();
    const link = await adminPage.getByRole('textbox', { name: 'Einladungslink' }).inputValue();
    expect(link).toMatch(/\/einladung\/[\w-]{40,}$/);
    await expect(adminPage.getByRole('region', { name: 'Offene Einladungen' })).toContainText(
      'anna@e2e.test',
    );
    await adminContext.close();

    // The new person accepts it and sets up 2FA.
    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1, name: 'Einladung annehmen' })).toBeVisible();
    await expect(page.getByText('anna@e2e.test')).toBeVisible();
    await page.getByLabel('Name').fill('Anna E2E');
    await page.getByLabel('Passwort').fill('regen-bogen-passwort-2');
    await page.getByRole('button', { name: 'Einladung annehmen' }).click();

    await expect(page).toHaveURL('/anmelden/2fa');
    await expect(
      page.getByRole('img', { name: 'QR-Code für die Authenticator-App' }),
    ).toBeVisible();
    const secret = (await page.locator('code').innerText()).replace(/\s/g, '');
    await page
      .getByLabel('Code aus der Authenticator-App')
      .fill(totpCode(secret, totpStep(new Date())));
    await page.getByRole('button', { name: '2FA aktivieren' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('complementary')).toContainText('Anna E2E');
    await expect(page.getByRole('complementary')).toContainText('Mitglied');

    // Members see the team, but cannot invite.
    await page.goto('/einstellungen/team');
    await expect(page.getByRole('region', { name: 'Team' })).toContainText('Anna E2E');
    await expect(page.getByRole('button', { name: 'Einladungslink erstellen' })).toHaveCount(0);

    // The link works only once.
    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1, name: 'Einladung ungültig' })).toBeVisible();
  });

  test('lets a person skip the 2FA setup and asks again at the next login', async ({
    page,
    browser,
  }) => {
    const adminContext = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/einstellungen/team');
    await adminPage.getByLabel('E-Mail').fill('ben@e2e.test');
    await adminPage.getByRole('button', { name: 'Einladungslink erstellen' }).click();
    const link = await adminPage.getByRole('textbox', { name: 'Einladungslink' }).inputValue();
    await adminContext.close();

    await page.goto(link);
    await page.getByLabel('Name').fill('Ben E2E');
    await page.getByLabel('Passwort').fill('wolken-himmel-blau-3');
    await page.getByRole('button', { name: 'Einladung annehmen' }).click();
    await expect(page).toHaveURL('/anmelden/2fa');

    await page.getByRole('button', { name: 'Später einrichten' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('complementary')).toContainText('Ben E2E');

    // A reminder on the team page, with the way to set it up later.
    await page.goto('/einstellungen/team');
    await expect(page.getByRole('region', { name: 'Dein Konto hat keine 2FA' })).toBeVisible();
    await page.getByRole('link', { name: '2FA jetzt einrichten' }).click();
    await expect(page).toHaveURL('/anmelden/2fa');
    await expect(page.getByRole('button', { name: 'Später einrichten' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Abbrechen' }).click();
    await expect(page).toHaveURL('/einstellungen/team');

    // The next login offers the setup again.
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await page.getByLabel('E-Mail').fill('ben@e2e.test');
    await page.getByLabel('Passwort').fill('wolken-himmel-blau-3');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL('/anmelden/2fa');
    await expect(page.getByRole('button', { name: 'Später einrichten' })).toBeVisible();
  });
});
