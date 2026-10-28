import { isHostAllowed, isValidDomainRule } from '@click-bot/shared';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import type { Database } from './client';
import type { Cipher } from './crypto';
import { ValidationError, type ValidationIssue } from './errors';
import { secrets } from './schema';

export type NewSecretInput = {
  /** Omit for a secret shared by all customers. */
  customerId?: string | null;
  name: string;
  value: string;
  allowedDomains: string[];
  expiresAt?: Date | null;
};

// Same rule as the secrets_name_format check; used in flows as {{secret.<name>}}.
const SECRET_NAME = /^[a-z0-9]+([-_][a-z0-9]+)*$/;

export async function createSecret(db: Database, cipher: Cipher, input: NewSecretInput) {
  const issues: ValidationIssue[] = [];
  if (!SECRET_NAME.test(input.name)) {
    issues.push({
      path: 'name',
      message: 'Nur Kleinbuchstaben, Ziffern, - und _ (z. B. „staging-login“).',
    });
  }
  if (input.value === '') issues.push({ path: 'value', message: 'Wert fehlt.' });
  if (input.allowedDomains.length === 0) {
    issues.push({ path: 'allowedDomains', message: 'Mindestens eine Domain angeben.' });
  }
  input.allowedDomains.forEach((rule, index) => {
    if (!isValidDomainRule(rule)) {
      issues.push({
        path: `allowedDomains.${index}`,
        message: `„${rule}“ ist keine gültige Domain (z. B. „beispiel.de“ oder „*.beispiel.de“).`,
      });
    }
  });
  if (issues.length > 0) throw new ValidationError(issues);

  const [secret] = await db
    .insert(secrets)
    .values({
      customerId: input.customerId ?? null,
      name: input.name,
      valueEnc: cipher.encrypt(input.value),
      allowedDomains: input.allowedDomains,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({ id: secrets.id, name: secrets.name });
  return secret;
}

/**
 * The secrets a run may use: the customer's own and the shared ones, not expired and allowed
 * on the host of `url`. A customer's secret wins over a shared one with the same name.
 */
export async function resolveSecretsForRun(
  db: Database,
  cipher: Cipher,
  { customerId, url, now }: { customerId: string; url: string; now: Date },
): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(secrets)
    .where(
      and(
        or(eq(secrets.customerId, customerId), isNull(secrets.customerId)),
        or(isNull(secrets.expiresAt), gt(secrets.expiresAt, now)),
      ),
    );

  const host = new URL(url).hostname;
  const resolved: Record<string, string> = {};
  // Shared secrets first, so the customer's own ones overwrite them.
  const ordered = rows.toSorted(
    (a, b) => Number(a.customerId !== null) - Number(b.customerId !== null),
  );
  for (const row of ordered) {
    if (isHostAllowed(host, row.allowedDomains)) resolved[row.name] = cipher.decrypt(row.valueEnc);
  }
  return resolved;
}
