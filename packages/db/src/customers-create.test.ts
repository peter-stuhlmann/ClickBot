import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import { createCustomer, slugify } from './customers';
import { ValidationError } from './errors';
import { customers } from './schema';

describe('createCustomer', () => {
  it('creates a customer with a short name for URLs', async () => {
    const customer = await createCustomer(db, { name: '  Müller Shop ' });
    expect(customer).toMatchObject({ name: 'Müller Shop', slug: 'mueller-shop' });
  });

  it('numbers the short name when it is taken', async () => {
    await createCustomer(db, { name: 'Nordlicht Hotel' });
    await db.insert(customers).values({ name: 'Nordlicht', slug: 'nordlicht-hotel-2' });
    expect((await createCustomer(db, { name: 'Nordlicht-Hotel' })).slug).toBe('nordlicht-hotel-3');
  });

  it.each([
    ['   ', 'Name fehlt.'],
    ['x'.repeat(121), 'Name ist zu lang (höchstens 120 Zeichen).'],
  ])('rejects the name %j', async (name, message) => {
    const error = await createCustomer(db, { name }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues).toEqual([{ path: 'name', message }]);
  });

  it('rejects a second customer with the same name, whatever the case', async () => {
    await createCustomer(db, { name: 'Stadtwerke Süd' });
    const error = await createCustomer(db, { name: 'stadtwerke süd' }).catch((e: unknown) => e);
    expect((error as ValidationError).issues).toEqual([
      { path: 'name', message: 'Dieses Projekt gibt es schon.' },
    ]);
  });
});

describe('slugify', () => {
  it.each([
    ['Müller Shop', 'mueller-shop'],
    ['Straße & Söhne GmbH', 'strasse-soehne-gmbh'],
    ['Café Crème', 'cafe-creme'],
    ['  --  ', 'projekt'],
  ])('%j → %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});
