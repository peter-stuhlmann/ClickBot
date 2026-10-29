import { eq } from 'drizzle-orm';
import type { Database } from './client';
import type { Cipher } from './crypto';
import { isUuid } from './ids';
import { customers } from './schema';
import { saveSecret } from './secrets';

const SECRET_REFERENCE = /^\{\{\s*secret\.[a-z0-9_-]+\s*\}\}$/;

type StepLike = { type?: unknown; password?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** "staging.beispiel.de" → "htaccess-staging-beispiel-de". */
function secretNameFor(host: string): string {
  return `htaccess-${host
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

/**
 * Passwords typed into a ".htaccess" step (basicAuth) must not be stored in the flow as plain
 * text (product rule). Each one becomes an encrypted secret of the customer, allowed on the host
 * of the start URL only, and the flow refers to it as `{{secret.htaccess-<host>}}`. References
 * to stored secrets stay as they are; anything malformed, or an unknown customer, is left to the
 * validation of createJob/updateJob.
 */
export async function secureStepPasswords(
  db: Database,
  cipher: Cipher,
  input: { customerId: string; startUrl: string; flow: unknown },
): Promise<unknown> {
  const { flow } = input;
  if (!isObject(flow) || !Array.isArray(flow.steps)) return flow;
  let host: string;
  try {
    host = new URL(input.startUrl).hostname;
  } catch {
    return flow;
  }
  const customer =
    isUuid(input.customerId) &&
    (await db.query.customers.findFirst({
      where: eq(customers.id, input.customerId),
      columns: { id: true },
    }));
  if (!customer) return flow;

  const name = secretNameFor(host);
  const steps: unknown[] = [];
  for (const step of flow.steps as unknown[]) {
    const { type, password } = (isObject(step) ? step : {}) as StepLike;
    if (type !== 'basicAuth' || typeof password !== 'string' || password === '') {
      steps.push(step);
      continue;
    }
    if (SECRET_REFERENCE.test(password)) {
      steps.push(step);
      continue;
    }
    await saveSecret(db, cipher, {
      customerId: input.customerId,
      name,
      value: password,
      allowedDomains: [host],
    });
    steps.push({ ...(step as object), password: `{{secret.${name}}}` });
  }
  return { ...flow, steps };
}
