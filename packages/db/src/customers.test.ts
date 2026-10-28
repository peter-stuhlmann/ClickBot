import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import { listCustomers } from './customers';
import { customers } from './schema';

describe('listCustomers', () => {
  it('lists every customer by name for the job wizard', async () => {
    await db.insert(customers).values([
      { name: 'Zahnarzt Müller', slug: 'zahnarzt-mueller' },
      { name: 'Beispiel GmbH', slug: 'beispiel' },
    ]);

    expect((await listCustomers(db)).map((customer) => customer.name)).toEqual([
      'Beispiel GmbH',
      'Zahnarzt Müller',
    ]);
  });

  it('returns an empty list when there are no customers yet', async () => {
    expect(await listCustomers(db)).toEqual([]);
  });
});
