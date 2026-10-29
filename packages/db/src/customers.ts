import { and, asc, eq, like, ne, or, sql } from 'drizzle-orm';
import { DEFAULT_CAMPAIGN } from './campaigns';
import type { Database } from './client';
import { NotFoundError, ValidationError } from './errors';
import { isUuid } from './ids';
import { campaigns, customers, jobs } from './schema';

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

/** The checked name, or throws ValidationError. Unique ignoring case; `except` is the own row. */
async function checkedName(db: Database, input: string, except?: string): Promise<string> {
  const name = input.trim();
  const fail = (message: string) => new ValidationError([{ path: 'name', message }]);
  if (!name) throw fail('Name fehlt.');
  if (name.length > MAX_NAME) throw fail(`Name ist zu lang (höchstens ${MAX_NAME} Zeichen).`);

  const sameName = sql`lower(${customers.name}) = lower(${name})`;
  const [twin] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(except ? and(sameName, ne(customers.id, except)) : sameName)
    .limit(1);
  if (twin) throw fail('Dieses Projekt gibt es schon.');
  return name;
}

/**
 * Creates a customer (project) with its first campaign, "Allgemein"; the slug comes from the
 * name. Names are unique, ignoring case.
 */
export async function createCustomer(db: Database, input: { name: string }): Promise<Customer> {
  const name = await checkedName(db, input.name);
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

export async function getCustomer(db: Database, id: string): Promise<Customer | null> {
  if (!isUuid(id)) return null;
  return (await db.query.customers.findFirst({ where: eq(customers.id, id) })) ?? null;
}

/** Renames a project. The slug stays, so addresses and file names built from it keep working. */
export async function updateCustomer(
  db: Database,
  id: string,
  input: { name: string },
): Promise<Customer> {
  if (!(await getCustomer(db, id))) throw new NotFoundError('Projekt', id);
  const name = await checkedName(db, input.name, id);
  const [customer] = await db
    .update(customers)
    .set({ name })
    .where(eq(customers.id, id))
    .returning();
  return customer as Customer;
}

/**
 * Deletes a project with its campaigns and secrets, but only once it has no jobs: jobs carry
 * runs and reports, which must not disappear as a side effect.
 */
export async function deleteCustomer(db: Database, id: string): Promise<void> {
  if (!(await getCustomer(db, id))) throw new NotFoundError('Projekt', id);
  await db.transaction(async (tx) => {
    // The row lock keeps a job from being created in the project while it is deleted.
    await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).for('update');
    const [{ count } = { count: 0 }] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(jobs)
      .where(eq(jobs.customerId, id));
    if (count > 0) {
      const what = count === 1 ? '1 Job' : `${count} Jobs`;
      throw new ValidationError([
        { path: 'form', message: `Das Projekt hat noch ${what}. Lösche sie zuerst.` },
      ]);
    }
    await tx.delete(campaigns).where(eq(campaigns.customerId, id));
    // Secrets go with the project (foreign key with ON DELETE CASCADE).
    await tx.delete(customers).where(eq(customers.id, id));
  });
}
