import { expect, test } from '@playwright/test';
import { chooseOption } from './select';

test.describe('Durchläufe', () => {
  test('lists the runs of all jobs, newest first, in pages of 50', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Durchläufe' })
      .click();

    await expect(page.getByRole('heading', { level: 1, name: 'Durchläufe' })).toBeVisible();
    const table = page.getByRole('region', { name: 'Durchläufe' });
    // The demo data has more than 50 runs in the last 7 days.
    await expect(table).toContainText(/1–50 von \d+ · neueste zuerst/);
    await expect(table.getByRole('row')).toHaveCount(51);

    await page.getByRole('link', { name: 'Ältere' }).click();
    await expect(page).toHaveURL('/laeufe?seite=2');
    await expect(table).toContainText(/51–\d+ von \d+/);
    await expect(page.getByRole('link', { name: 'Neuere' })).toBeVisible();
  });

  test('filters by result and opens the report of a run', async ({ page }) => {
    await page.goto('/laeufe');
    // A changed filter applies itself; empty filters stay out of the address.
    await chooseOption(page.getByRole('combobox', { name: 'Ergebnis' }), 'Fehlgeschlagen');
    await expect(page).toHaveURL(/[?&]ergebnis=fehlgeschlagen(&|$)/);
    expect(page.url()).not.toMatch(/kampagne=|geraet=/);
    await expect(page.getByRole('combobox', { name: 'Ergebnis' })).toHaveText('Fehlgeschlagen');
    const rows = page.getByRole('region', { name: 'Durchläufe' }).getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    for (let index = 1; index < count; index++) {
      await expect(rows.nth(index)).toContainText('Fehlgeschlagen');
    }

    await rows.nth(1).getByRole('link').click();
    await expect(page).toHaveURL(/\/laeufe\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: /^Durchlauf \d+/ })).toBeVisible();
  });

  test('says so when no run matches, and resets the filters', async ({ page }) => {
    await page.goto('/laeufe?geraet=ipad');
    await expect(page.getByText('Keine Durchläufe für diese Filter.')).toBeVisible();

    await page.getByRole('link', { name: 'Filter zurücksetzen' }).click();
    await expect(page).toHaveURL('/laeufe');
    await expect(page.getByRole('combobox', { name: 'Gerät' })).toHaveText('Alle Geräte');
  });

  test('keeps the filters in view while the list scrolls', async ({ page }) => {
    await page.goto('/laeufe');
    await page.mouse.wheel(0, 3000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    await expect(page.getByRole('form', { name: 'Durchläufe filtern' })).toBeInViewport({
      ratio: 1,
    });
  });

  test('never wraps a value of a run in the middle, also on a small laptop', async ({ page }) => {
    for (const width of [768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/laeufe');
      const row = page.getByRole('row').nth(1);
      await expect(row.getByRole('cell').nth(2)).toHaveText(
        // A run that still waits has no duration yet (–).
        /^\d\d\.\d\d\. \d\d:\d\d( · )?([\d,]+ s|–)$/,
      );
      // Each piece of text (time, duration, result, project) sits on a single line.
      const wrapped = await row.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const broken: string[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue;
          // Shortened with "…" on purpose (a long job name next to "Testlauf"): one line too.
          const parent = node.parentElement;
          if (parent && getComputedStyle(parent).textOverflow === 'ellipsis') continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          if (range.getClientRects().length > 1) broken.push(node.textContent.trim());
        }
        return broken;
      });
      expect(wrapped, `bei ${width} px`).toEqual([]);
      // Time and duration together on one line.
      const lines = await row
        .getByRole('cell')
        .nth(2)
        .evaluate((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
        });
      expect(lines, `Zeitpunkt · Dauer bei ${width} px`).toBe(1);
    }
  });
});
