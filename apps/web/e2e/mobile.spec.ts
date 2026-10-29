import { expect, test, type Page } from '@playwright/test';

// A small Android phone; iPhones are 375 to 430 px wide.
const PHONE = { width: 360, height: 780 };
test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

/**
 * Visible elements that stick out of the window to the side, e.g. a table cut off by its card.
 * Content inside a container that scrolls sideways on purpose does not count.
 */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollsSideways = (element: Element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) return true;
      }
      return false;
    };
    // Only for screen readers (sr-only), e.g. the column headers of a table shown as cards.
    const clippedAway = (element: Element) => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (getComputedStyle(node).clipPath !== 'none') return true;
      }
      return false;
    };
    const found: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      if (!element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || (box.left >= -1 && box.right <= width + 1)) continue;
      if (scrollsSideways(element) || clippedAway(element)) continue;
      const text = (element.textContent ?? '').trim().slice(0, 40);
      found.push(`<${element.tagName.toLowerCase()} class="${element.className}"> ${text}`);
    }
    if (document.documentElement.scrollWidth > width) found.unshift('page scrolls sideways');
    return found.slice(0, 5);
  });
}

/** The address a link on the page points to, e.g. the editor of a demo job. */
async function hrefOf(page: Page, name: string | RegExp) {
  const href = await page.getByRole('link', { name, exact: true }).getAttribute('href');
  if (!href) throw new Error(`Link ${String(name)} fehlt.`);
  return href;
}

async function expectFits(page: Page) {
  await expect.poll(() => overflowing(page), { timeout: 2000 }).toEqual([]);
}

test.describe('Auf dem Handy', () => {
  test('every page fits the width of a phone', async ({ page }) => {
    await page.goto('/');
    const job = await hrefOf(page, 'Login & Bestellstatus');
    const run = await hrefOf(page, /^Letzter Lauf von Login & Bestellstatus/);

    for (const path of [
      '/',
      job,
      '/laeufe',
      run,
      '/kunden',
      '/kunden/neu',
      '/einstellungen/team',
      '/einstellungen/ki',
    ]) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectFits(page);
      });
    }
  });

  test('the job editor fits with a step open', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Login & Bestellstatus', exact: true }).click();
    await page.getByRole('button', { name: /^Schritt 2:/ }).click();
    await expect(page.getByRole('combobox', { name: 'Aktion' })).toBeVisible();
    await expectFits(page);
  });

  test('saving stays at hand at the end of the long editor page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Login & Bestellstatus', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.mouse.wheel(0, 10_000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Speichern' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Testlauf starten' })).toBeInViewport();
  });

  test('every step of the new-job wizard fits', async ({ page }) => {
    await page.goto('/jobs/neu');
    await expectFits(page);
    await page.getByRole('combobox', { name: 'Kunde' }).selectOption({ label: 'Beispiel GmbH' });
    await page
      .getByRole('textbox', { name: 'Website (Start-URL)' })
      .fill('http://127.0.0.1:4100/kontakt.html');
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('Handy-Test');
    await page.getByRole('checkbox', { name: /Test freigegeben/ }).check();
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.getByRole('button', { name: /^Schritt 1: Öffne/ })).toBeVisible();
    await page.getByRole('button', { name: 'Schritt hinzufügen' }).click();
    await expectFits(page);
    await page.getByRole('combobox', { name: 'Aktion' }).selectOption({ label: 'Prüfen' });
    await page.getByRole('textbox', { name: 'Text' }).fill('Kontakt');
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.getByRole('textbox', { name: 'Alle (Minuten)' })).toBeVisible();
    await expectFits(page);
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.getByRole('button', { name: /iPhone 15/ })).toBeVisible();
    await expectFits(page);
  });

  test('the wizard buttons stay at hand at the end of a long step', async ({ page }) => {
    await page.goto('/jobs/neu');
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Abbrechen' })).toBeInViewport();
  });

  test('the navigation sits behind the menu button', async ({ page }) => {
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    const menu = page.getByRole('button', { name: 'Menü öffnen' });
    await expect(navigation).toBeHidden();

    await menu.click();
    await expect(navigation).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeInViewport();

    await navigation.getByRole('link', { name: 'Läufe' }).click();
    await expect(page).toHaveURL('/laeufe');
    await expect(page.getByRole('heading', { level: 1, name: 'Läufe' })).toBeVisible();
    await expect(navigation).toBeHidden();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Auf Tablet und kleinem Laptop', () => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    test(`every page fits ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const job = await hrefOf(page, 'Login & Bestellstatus');
      for (const path of ['/', job, '/jobs/neu', '/laeufe', '/kunden', '/einstellungen/ki']) {
        await test.step(path, async () => {
          await page.goto(path);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expectFits(page);
        });
      }
    });
  }
});

test.describe('Anmeldung auf dem Handy', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the login and an invitation link fit the width of a phone', async ({ page }) => {
    for (const path of ['/anmelden', '/einladung/unbekannt']) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectFits(page);
      });
    }
  });
});
