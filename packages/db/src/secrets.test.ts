import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db, insertCustomer, single } from '../test/db';
import { createCipher } from './crypto';
import { ValidationError } from './errors';
import { schema } from './index';
import { createSecret, resolveSecretsForRun } from './secrets';

const cipher = createCipher(randomBytes(32));
const now = new Date('2026-11-05T12:00:00Z');

describe('createSecret', () => {
  it('stores only the encrypted value', async () => {
    const customer = await insertCustomer();
    await createSecret(db, cipher, {
      customerId: customer.id,
      name: 'staging',
      value: 's3cr3t-pw',
      allowedDomains: ['staging.beispiel.de'],
    });

    const row = single(await db.select().from(schema.secrets));
    expect(row.valueEnc).not.toContain('s3cr3t-pw');
    expect(cipher.decrypt(row.valueEnc)).toBe('s3cr3t-pw');
  });

  it.each([
    ['name', { name: 'Staging Login' }],
    ['name', { name: '' }],
    ['allowedDomains', { allowedDomains: [] }],
    ['allowedDomains.1', { allowedDomains: ['beispiel.de', 'https://evil.com'] }],
    ['value', { value: '' }],
  ])('rejects an invalid %s', async (path, overrides) => {
    const error = await createSecret(db, cipher, {
      name: 'staging',
      value: 'pw',
      allowedDomains: ['beispiel.de'],
      ...overrides,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues.map((issue) => issue.path)).toEqual([path]);
  });

  it('allows the same name for two customers, but not twice for one', async () => {
    const a = await insertCustomer('A', 'a');
    const b = await insertCustomer('B', 'b');
    const input = { name: 'staging', value: 'pw', allowedDomains: ['beispiel.de'] };

    await createSecret(db, cipher, { ...input, customerId: a.id });
    await createSecret(db, cipher, { ...input, customerId: b.id });
    await expect(createSecret(db, cipher, { ...input, customerId: a.id })).rejects.toThrow();
  });

  it('allows a shared secret name only once', async () => {
    const input = { name: 'ga4-api', value: 'key', allowedDomains: ['*.google.com'] };
    await createSecret(db, cipher, input);
    await expect(createSecret(db, cipher, input)).rejects.toThrow();
  });
});

describe('resolveSecretsForRun', () => {
  async function setup() {
    const customer = await insertCustomer();
    const other = await insertCustomer('Müller Shop', 'mueller');
    await createSecret(db, cipher, {
      customerId: customer.id,
      name: 'staging',
      value: 'beispiel-pw',
      allowedDomains: ['staging.beispiel.de'],
    });
    await createSecret(db, cipher, {
      customerId: other.id,
      name: 'shop',
      value: 'mueller-pw',
      allowedDomains: ['*.mueller-shop.de'],
    });
    await createSecret(db, cipher, {
      name: 'ga4-api',
      value: 'shared-key',
      allowedDomains: ['staging.beispiel.de', '*.mueller-shop.de'],
    });
    return { customer, other };
  }

  it("returns the customer's and the shared secrets that are allowed on the URL", async () => {
    const { customer } = await setup();
    const resolved = await resolveSecretsForRun(db, cipher, {
      customerId: customer.id,
      url: 'https://staging.beispiel.de/login',
      now,
    });
    expect(resolved).toEqual({ staging: 'beispiel-pw', 'ga4-api': 'shared-key' });
  });

  it("never returns another customer's secret", async () => {
    const { customer } = await setup();
    const resolved = await resolveSecretsForRun(db, cipher, {
      customerId: customer.id,
      url: 'https://www.mueller-shop.de/',
      now,
    });
    expect(resolved).toEqual({ 'ga4-api': 'shared-key' });
  });

  it('withholds secrets on a domain they are not allowed on', async () => {
    const { customer } = await setup();
    const resolved = await resolveSecretsForRun(db, cipher, {
      customerId: customer.id,
      url: 'https://www.beispiel.de/',
      now,
    });
    expect(resolved).toEqual({});
  });

  it('lets a customer secret override a shared secret with the same name', async () => {
    const { customer } = await setup();
    await createSecret(db, cipher, {
      customerId: customer.id,
      name: 'ga4-api',
      value: 'customer-key',
      allowedDomains: ['staging.beispiel.de'],
    });
    const resolved = await resolveSecretsForRun(db, cipher, {
      customerId: customer.id,
      url: 'https://staging.beispiel.de/',
      now,
    });
    expect(resolved['ga4-api']).toBe('customer-key');
  });

  it('skips expired secrets', async () => {
    const customer = await insertCustomer();
    await createSecret(db, cipher, {
      customerId: customer.id,
      name: 'cms',
      value: 'old',
      allowedDomains: ['beispiel.de'],
      expiresAt: new Date('2026-11-05T11:59:59Z'),
    });
    await createSecret(db, cipher, {
      customerId: customer.id,
      name: 'cms-neu',
      value: 'new',
      allowedDomains: ['beispiel.de'],
      expiresAt: new Date('2026-11-06T00:00:00Z'),
    });
    const resolved = await resolveSecretsForRun(db, cipher, {
      customerId: customer.id,
      url: 'https://beispiel.de/',
      now,
    });
    expect(resolved).toEqual({ 'cms-neu': 'new' });
  });
});
