import { describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { blockAds, isAdRequest } from './ad-blocking';

describe('isAdRequest', () => {
  it.each([
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
    'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
    'https://www.googleadservices.com/pagead/conversion/123/',
    'https://adservice.google.de/adsid/integrator.js',
    'https://ep1.adtrafficquality.google/getconfig/sodar',
    'https://ws-eu.amazon-adsystem.com/widgets/q?ASIN=3825247074',
    'https://static.criteo.net/js/ld/publishertag.js',
    'https://cdn.taboola.com/libtrc/loader.js',
    'https://widgets.outbrain.com/outbrain.js',
    'https://ib.adnxs.com/ut/v3/prebid',
  ])('blocks the ad network %s', (url) => {
    expect(isAdRequest(url)).toBe(true);
  });

  it.each([
    // GA4 and the tag manager: marked, never blocked.
    'https://www.googletagmanager.com/gtag/js?id=G-TEST',
    'https://region1.google-analytics.com/g/collect?v=2&tid=G-TEST',
    'https://stats.g.doubleclick.net/g/collect?v=2&tid=G-TEST',
    // Google's consent banner: tests must see it like visitors do.
    'https://fundingchoicesmessages.google.com/i/pub-123?ers=1',
    'https://fonts.gstatic.com/s/inter.woff2',
    'https://www.google.com/recaptcha/api.js',
    'https://romanische-sprachen.de/wp-content/ads.css',
    'https://notdoubleclick.net/x.js',
    'kein url',
  ])('lets %s through', (url) => {
    expect(isAdRequest(url)).toBe(false);
  });
});

describe('blockAds', () => {
  const browser = useBrowser();

  it('stops the requests to ad networks of a context and counts them', async () => {
    const context = await browser.newContext();
    try {
      const blocked = await blockAds(context);
      const page = await context.newPage();
      await page.goto(`${browser.origin()}/anzeigen.html`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => blocked()).toBe(1);
    } finally {
      await context.close();
    }
  });
});
