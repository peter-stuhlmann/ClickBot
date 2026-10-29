import { asc, eq, like, or, sql } from 'drizzle-orm';
import { DEFAULT_CAMPAIGN } from './campaigns';
import type { Database } from './client';
import { ValidationError } from './errors';
import { campaigns, customers } from './schema';

export type Customer = typeof customers.$inferSelect;
export type CustomerOption = { id: string; name: string };

const MAX_NAME = 120;

/** All customers by name, e.g. for the customer choice in the job wizard. */
export async function listCustomers(db: Database): Promise<CustomerOption[]> {
  return db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .orderBy(asc(customers.name));
}

/** "Müller Shop" → "mueller-shop": the short name used in URLs and file names. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'projekt';
}

/** The slug of `name`, numbered (-2, -3, …) if it is taken. */
async function freeSlug(db: Database, name: string): Promise<string> {
  const base = slugify(name);
  const taken = await db
    .select({ slug: customers.slug })
    .from(customers)
    .where(or(eq(customers.slug, base), like(customers.slug, `${base}-%`)));
  const slugs = new Set(taken.map((row) => row.slug));
  if (!slugs.has(base)) return base;
  let number = 2;
  while (slugs.has(`${base}-${number}`)) number += 1;
  return `${base}-${number}`;
}

/**
 * Creates a customer (project) with its first campaign, "Allgemein"; the slug comes from the
 * name. Names are unique, ignoring case.
 */
export async function createCustomer(db: Database, input: { name: string }): Promise<Customer> {
  const name = input.name.trim();
  const fail = (message: string) => new ValidationError([{ path: 'name', message }]);
  if (!name) throw fail('Name fehlt.');
  if (name.length > MAX_NAME) throw fail(`Name ist zu lang (höchstens ${MAX_NAME} Zeichen).`);

  const [twin] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`lower(${customers.name}) = lower(${name})`)
    .limit(1);
  if (twin) throw fail('Dieses Projekt gibt es schon.');

  const slug = await freeSlug(db, name);
  return db.transaction(async (tx) => {
    const [customer] = await tx.insert(customers).values({ name, slug }).returning();
    // Every job belongs to a campaign; a new project can take jobs right away.
    await tx
      .insert(campaigns)
      .values({ customerId: (customer as Customer).id, name: DEFAULT_CAMPAIGN });
    return customer as Customer;
  });
}
