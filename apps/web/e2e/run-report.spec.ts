import { expect, test } from '@playwright/test';

test.describe('Durchlauf-Report', () => {
  test('opens the report of the last run from the job list', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Letzter Durchlauf von Login & Bestellstatus/ }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Durchlauf 31 von 48' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pfad' })).toContainText(
      'Login & Bestellstatus',
    );
    await expect(page.getByRole('main').getByText('Fehlgeschlagen').first()).toBeVisible();

    const steps = page.getByRole('region', { name: 'Ablauf' }).getByRole('listitem');
    await expect(steps.first()).toContainText('Öffne 127.0.0.1:4100/login.html');
    await expect(steps.last()).toContainText('Element nicht gefunden (Demo-Daten).');

    const failure = page.getByRole('region', { name: /fehlgeschlagen$/ });
    await expect(failure).toContainText('Element nicht gefunden (Demo-Daten).');

    await page.getByRole('link', { name: 'Tests' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tests' })).toBeVisible();
  });

  test('shows every screenshot in a gallery and large in a lightbox', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Letzter Durchlauf von Login & Bestellstatus/ }).click();

    const gallery = page.getByRole('region', { name: 'Bildschirmfotos' });
    await expect(gallery).toContainText('3 Bilder');
    const thumbnails = gallery
      .getByRole('list', { name: 'Alle Bildschirmfotos' })
      .getByRole('link');
    await expect(thumbnails).toHaveCount(3);
    await expect(thumbnails.last()).toHaveAttribute('aria-current', 'true');

    await thumbnails.nth(1).click();
    await expect(gallery.getByText('2 / 3')).toBeVisible();
    await gallery.getByRole('link', { name: /vergrößern$/ }).click();

    const lightbox = page.getByRole('dialog');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.getByRole('button', { name: 'Schließen' })).toBeFocused();
    const picture = lightbox.getByRole('img');
    await expect(picture).toHaveAttribute('src', '/artifacts/runs/e2e/1-desktop.png');
    // The picture fits the window.
    const box = await picture.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width <= viewport.width && box.height <= viewport.height).toBe(
      true,
    );

    await page.keyboard.press('ArrowRight');
    await expect(picture).toHaveAttribute('src', '/artifacts/runs/e2e/2-phone.png');
    await expect(lightbox.getByRole('button', { name: 'Nächstes Bild' })).toBeDisabled();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(picture).toHaveAttribute('src', '/artifacts/runs/e2e/0-open.png');
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    await expect(gallery.getByText('1 / 3')).toBeVisible();

    // The link of a step in the step list opens its screenshot.
    await page
      .getByRole('region', { name: 'Ablauf' })
      .getByRole('link', { name: /^Bildschirmfoto von Schritt/ })
      .last()
      .click();
    await expect(lightbox.getByRole('img')).toHaveAttribute(
      'src',
      '/artifacts/runs/e2e/2-phone.png',
    );
    await page.mouse.click(5, (page.viewportSize()?.height ?? 600) / 2);
    await expect(lightbox).toBeHidden();
  });

  test('plays the video of a run with the steps as captions, and offers it as a download', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Letzter Durchlauf von Login & Bestellstatus/ }).click();

    const card = page.getByRole('region', { name: 'Video' });
    const video = card.locator('video');
    await expect(video).toHaveAttribute('src', '/artifacts/runs/e2e/video.mp4');
    // The browser loads it: metadata and the captions of the steps.
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(2);
    await expect
      .poll(() =>
        video.evaluate((v: HTMLVideoElement) => {
          const track = v.textTracks[0];
          if (!track) return [];
          track.mode = 'hidden';
          return [...(track.cues ?? [])].map((cue) => (cue as VTTCue).text);
        }),
      )
      .toEqual([
        'Schritt 1 von 5 · Öffne 127.0.0.1:4100/login.html',
        'Schritt 2 von 5 · Fülle „Benutzername“ aus',
      ]);

    const download = card.getByRole('link', { name: 'Video herunterladen' });
    await expect(download).toHaveAttribute('download', 'login-bestellstatus-durchlauf-31.mp4');
  });

  test('serves a video in parts, as browsers ask for it to play and seek', async ({ request }) => {
    const whole = await request.get('/artifacts/runs/e2e/video.mp4');
    expect(whole.status()).toBe(200);
    expect(whole.headers()['content-type']).toBe('video/mp4');
    expect(whole.headers()['accept-ranges']).toBe('bytes');
    const size = (await whole.body()).length;

    const part = await request.get('/artifacts/runs/e2e/video.mp4', {
      headers: { Range: 'bytes=0-99' },
    });
    expect(part.status()).toBe(206);
    expect(part.headers()['content-range']).toBe(`bytes 0-99/${size}`);
    expect((await part.body()).length).toBe(100);

    const beyond = await request.get('/artifacts/runs/e2e/video.mp4', {
      headers: { Range: `bytes=${size}-` },
    });
    expect(beyond.status()).toBe(416);
  });

  test('shows a not-found page for an unknown run', async ({ page }) => {
    const response = await page.goto('/laeufe/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Nicht gefunden' })).toBeVisible();
  });

  test('serves stored screenshots and nothing else', async ({ request }) => {
    const image = await request.get('/artifacts/runs/e2e/0-open.png');
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');

    for (const path of [
      '/artifacts/runs/e2e/missing.png',
      '/artifacts/..%2F..%2F..%2Fpackage.json',
      '/artifacts/runs/%2E%2E/%2E%2E/playwright.config.ts',
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});
