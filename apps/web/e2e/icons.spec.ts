import { expect, test } from '@playwright/test';

// The login page needs its icons too, so without a session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Favicon und App-Icons', () => {
  test('every page links the icons and the manifest', async ({ page }) => {
    await page.goto('/anmelden');
    const head = page.locator('head');
    await expect(head.locator('link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
    await expect(head.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');
    await expect(head.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );
    await expect(head.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0f172a');
  });

  test('serves the icons in all sizes without signing in', async ({ request }) => {
    const types: Record<string, RegExp> = {
      '/favicon.ico': /image\/(x-icon|vnd\.microsoft\.icon)/,
      '/icon.svg': /image\/svg\+xml/,
      '/apple-icon.png': /image\/png/,
    };
    for (const [path, type] of Object.entries(types)) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toMatch(type);
    }

    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.status()).toBe(200);
    const { name, icons } = (await manifest.json()) as {
      name: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(name).toBe('Click-Bot');
    expect(icons.map((icon) => [icon.sizes, icon.purpose ?? 'any'])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
    for (const icon of icons) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type'], icon.src).toBe('image/png');
    }
  });
});
