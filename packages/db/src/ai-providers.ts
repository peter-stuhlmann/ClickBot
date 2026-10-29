import {
  AI_PROVIDER_KINDS,
  AI_PROVIDERS,
  aiProviderInputSchema,
  keyHint,
  type AiProviderInput,
  type AiProviderKind,
} from '@click-bot/shared';
import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from './client';
import type { Cipher } from './crypto';
import { issuesFromZod, NotFoundError, ValidationError } from './errors';
import { aiProviders } from './schema';

/** A provider as the settings page shows it: never with the key, only its hint. */
export type AiProviderListing = {
  kind: AiProviderKind;
  model: string;
  baseUrl: string | null;
  /** "…1234", or null without a key (custom endpoint). */
  keyHint: string | null;
  isDefault: boolean;
  updatedAt: Date;
};

/** A provider ready to call, with the decrypted key. Server only, never log it. */
export type StoredAiConfig = {
  kind: AiProviderKind;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
};

export async function listAiProviders(db: Database): Promise<AiProviderListing[]> {
  const rows = await db
    .select({
      kind: aiProviders.kind,
      model: aiProviders.model,
      baseUrl: aiProviders.baseUrl,
      keyHint: aiProviders.apiKeyHint,
      isDefault: aiProviders.isDefault,
      updatedAt: aiProviders.updatedAt,
    })
    .from(aiProviders)
    .orderBy(asc(aiProviders.kind));
  return rows;
}

/**
 * Creates or changes the provider of `input.kind`. An empty key keeps the stored one. The first
 * provider becomes the default.
 */
export async function saveAiProvider(
  db: Database,
  cipher: Cipher,
  input: AiProviderInput,
): Promise<void> {
  const parsed = aiProviderInputSchema.safeParse(input);
  const issues = parsed.success ? [] : issuesFromZod('', parsed.error).map(unprefix);
  const knownKind = AI_PROVIDER_KINDS.find((kind) => kind === input.kind);

  await db.transaction(async (tx) => {
    const [stored] = knownKind
      ? await tx
          .select({ apiKeyEnc: aiProviders.apiKeyEnc })
          .from(aiProviders)
          .where(eq(aiProviders.kind, knownKind))
          .for('update')
      : [];
    // Checked even when other fields are wrong, so the form shows every problem at once.
    const typedKey = (input.apiKey ?? '').trim();
    if (knownKind && !typedKey && !stored?.apiKeyEnc && AI_PROVIDERS[knownKind].keyRequired) {
      issues.push({ path: 'apiKey', message: 'Bitte den API-Schlüssel eintragen.' });
    }
    if (!parsed.success || issues.length > 0) throw new ValidationError(issues);
    const { kind, model, baseUrl, apiKey } = parsed.data;

    const key = apiKey ? { apiKeyEnc: cipher.encrypt(apiKey), apiKeyHint: keyHint(apiKey) } : {};
    if (stored) {
      await tx
        .update(aiProviders)
        .set({ model, baseUrl, ...key, updatedAt: new Date() })
        .where(eq(aiProviders.kind, kind));
      return;
    }
    const [{ defaults } = { defaults: 0 }] = await tx
      .select({ defaults: sql<number>`count(*)::int` })
      .from(aiProviders)
      .where(eq(aiProviders.isDefault, true));
    await tx
      .insert(aiProviders)
      .values({ kind, model, baseUrl, ...key, isDefault: defaults === 0 });
  });
}

// issuesFromZod('') yields ".model"; the form wants "model".
function unprefix(issue: { path: string; message: string }) {
  return { ...issue, path: issue.path.replace(/^\./, '') };
}

export async function setDefaultAiProvider(db: Database, kind: AiProviderKind): Promise<void> {
  await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ kind: aiProviders.kind })
      .from(aiProviders)
      .where(eq(aiProviders.kind, kind))
      .for('update');
    if (!found) throw new NotFoundError('KI-Anbieter', kind);
    // Two statements: the partial unique index allows only one default at any time.
    await tx.update(aiProviders).set({ isDefault: false }).where(eq(aiProviders.isDefault, true));
    await tx.update(aiProviders).set({ isDefault: true }).where(eq(aiProviders.kind, kind));
  });
}

/** Removes the provider and its key. If it was the default, the next one in the list takes over. */
export async function deleteAiProvider(db: Database, kind: AiProviderKind): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(aiProviders)
      .where(eq(aiProviders.kind, kind))
      .returning({ isDefault: aiProviders.isDefault });
    if (!deleted?.isDefault) return;
    const remaining = await tx.select({ kind: aiProviders.kind }).from(aiProviders);
    const next = AI_PROVIDER_KINDS.find((candidate) =>
      remaining.some((row) => row.kind === candidate),
    );
    if (next) {
      await tx.update(aiProviders).set({ isDefault: true }).where(eq(aiProviders.kind, next));
    }
  });
}

/** The provider to call: `kind`, or the default one. Null if it is not set up. */
export async function getAiConfig(
  db: Database,
  cipher: Cipher,
  kind?: AiProviderKind,
): Promise<StoredAiConfig | null> {
  const [row] = await db
    .select()
    .from(aiProviders)
    .where(kind ? eq(aiProviders.kind, kind) : eq(aiProviders.isDefault, true));
  if (!row) return null;
  return {
    kind: row.kind,
    model: row.model,
    apiKey: row.apiKeyEnc ? cipher.decrypt(row.apiKeyEnc) : null,
    baseUrl: row.baseUrl,
  };
}
