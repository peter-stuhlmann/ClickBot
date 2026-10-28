import { asc } from 'drizzle-orm';
import type { Database } from './client';
import { customers } from './schema';

export type CustomerOption = { id: string; name: string };

/** All customers by name, e.g. for the customer choice in the job wizard. */
export async function listCustomers(db: Database): Promise<CustomerOption[]> {
  return db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .orderBy(asc(customers.name));
}
