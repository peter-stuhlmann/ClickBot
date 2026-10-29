import { describe, expect, it } from 'vitest';
import { basicAuthHeader, isSameOrigin } from './basic-auth';

describe('basicAuthHeader', () => {
  it('encodes user name and password as HTTP Basic Auth', () => {
    expect(basicAuthHeader('demo', 'geheim-123')).toBe(
      `Basic ${Buffer.from('demo:geheim-123').toString('base64')}`,
    );
  });

  it('keeps umlauts and colons in the password intact (UTF-8)', () => {
    const header = basicAuthHeader('müller', 'pa:ss');
    expect(Buffer.from(header.slice(6), 'base64').toString('utf8')).toBe('müller:pa:ss');
  });
});

describe('isSameOrigin', () => {
  const origin = 'https://staging.beispiel.de';

  it.each([
    ['https://staging.beispiel.de/kontakt', true],
    ['https://staging.beispiel.de:443/bild.png', true],
    // Never to other hosts, subdomains, schemes or ports: trackers, CDNs, ad servers.
    ['https://www.google-analytics.com/g/collect', false],
    ['https://cdn.beispiel.de/app.js', false],
    ['http://staging.beispiel.de/', false],
    ['https://staging.beispiel.de:8443/', false],
  ])('%s → %s', (url, expected) => {
    expect(isSameOrigin(new URL(url), origin)).toBe(expected);
  });
});
