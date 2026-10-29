import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db, insertCustomer } from '../test/db';
import { createCipher } from './crypto';
import { secrets } from './schema';
import { resolveSecretsForRun } from './secrets';
import { secureStepPasswords } from './step-secrets';

const cipher = createCipher(randomBytes(32));
const now = new Date('2026-11-05T12:30:00Z');
const startUrl = 'https://staging.beispiel.de/kontakt';

const flowWith = (password: string) => ({
  version: 1,
  steps: [
    { id: 'auth', type: 'basicAuth', username: 'kunde', password },
    { id: 'open', type: 'open', url: '/' },
  ],
});

describe('secureStepPasswords', () => {
  it('stores a typed .htaccess password encrypted and puts a reference into the flow', async () => {
    const customer = await insertCustomer();
    const flow = await secureStepPasswords(db, cipher, {
      customerId: customer.id,
      startUrl,
      flow: flowWith('geheim-123'),
    });

    expect(flow).toEqual(flowWith('{{secret.htaccess-staging-beispiel-de}}'));
    expect(JSON.stringify(flow)).not.toContain('geheim-123');
    const [stored] = await db.select().from(secrets);
    expect(stored).toMatchObject({
      customerId: customer.id,
      name: 'htaccess-staging-beispiel-de',
      allowedDomains: ['staging.beispiel.de'],
    });
    expect(stored?.valueEnc).not.toContain('geheim-123');
    // A run on the job's domain gets the password back.
    expect(
      await resolveSecretsForRun(db, cipher, { customerId: customer.id, url: startUrl, now }),
    ).toEqual({ 'htaccess-staging-beispiel-de': 'geheim-123' });
  });

  it('replaces the stored password when a new one is typed', async () => {
    const customer = await insertCustomer();
    const input = { customerId: customer.id, startUrl };
    await secureStepPasswords(db, cipher, { ...input, flow: flowWith('alt-passwort') });
    await secureStepPasswords(db, cipher, { ...input, flow: flowWith('neu-passwort') });

    expect(await db.select().from(secrets)).toHaveLength(1);
    expect(
      await resolveSecretsForRun(db, cipher, { customerId: customer.id, url: startUrl, now }),
    ).toEqual({ 'htaccess-staging-beispiel-de': 'neu-passwort' });
  });

  it('leaves a reference to a stored password as it is', async () => {
    const customer = await insertCustomer();
    const flow = flowWith('{{secret.mein-zugang}}');
    expect(
      await secureStepPasswords(db, cipher, { customerId: customer.id, startUrl, flow }),
    ).toEqual(flow);
    expect(await db.select().from(secrets)).toHaveLength(0);
  });

  it.each([
    ['no flow', null],
    ['no steps', { version: 1 }],
    ['an empty password', flowWith('')],
  ])('changes nothing for %s, which the validation reports later', async (_case, flow) => {
    const customer = await insertCustomer();
    expect(
      await secureStepPasswords(db, cipher, { customerId: customer.id, startUrl, flow }),
    ).toEqual(flow);
    expect(await db.select().from(secrets)).toHaveLength(0);
  });

  it.each([
    ['an unknown customer', '00000000-0000-4000-8000-000000000000'],
    ['a customer id that is no UUID', 'kein-kunde'],
  ])('changes nothing for %s, which createJob reports', async (_case, customerId) => {
    const flow = flowWith('geheim-123');
    expect(await secureStepPasswords(db, cipher, { customerId, startUrl, flow })).toEqual(flow);
    expect(await db.select().from(secrets)).toHaveLength(0);
  });

  it('changes nothing without a valid start URL', async () => {
    const customer = await insertCustomer();
    const flow = flowWith('geheim-123');
    expect(
      await secureStepPasswords(db, cipher, { customerId: customer.id, startUrl: 'kaputt', flow }),
    ).toEqual(flow);
  });
});
