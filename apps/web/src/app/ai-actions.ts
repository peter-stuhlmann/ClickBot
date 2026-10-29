'use server';

import { AiError, testAiConnection } from '@click-bot/ai';
import {
  deleteAiProvider,
  getAiConfig,
  saveAiProvider,
  setDefaultAiProvider,
  ValidationError,
} from '@click-bot/db';
import { AI_PROVIDER_KINDS, AI_PROVIDERS, type AiProviderKind } from '@click-bot/shared';
import { revalidatePath } from 'next/cache';
import { describeConnection } from '@/lib/ai-settings';
import { field, toFormState } from '@/lib/form-state';
import type { ConnectionCheck, FormState } from '@/lib/views';
import { requireAdmin } from '@/server/auth';
import { getCipher } from '@/server/cipher';
import { getDb } from '@/server/db';

const PAGE = '/einstellungen/ki';

function kindOf(data: FormData): AiProviderKind {
  const kind = field(data, 'kind');
  if (!(AI_PROVIDER_KINDS as readonly string[]).includes(kind)) throw new Error('kind fehlt.');
  return kind as AiProviderKind;
}

/** "Speichern" of a provider card. Admins only; the key never goes back to the form. */
export async function saveAiProviderAction(_state: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = kindOf(data);
  const values = { model: field(data, 'model'), baseUrl: field(data, 'baseUrl') };
  try {
    await saveAiProvider(getDb(), getCipher(), { kind, ...values, apiKey: field(data, 'apiKey') });
  } catch (error) {
    if (error instanceof ValidationError) return toFormState(error.issues, values);
    throw error;
  }
  revalidatePath(PAGE);
  return { notice: 'Gespeichert.', values };
}

/**
 * "Verbindung testen" with what the form shows: a typed key, else the stored one. Nothing is
 * saved. Admins only, because the test uses the stored key.
 */
export async function testAiProviderAction(data: FormData): Promise<ConnectionCheck> {
  await requireAdmin();
  const kind = kindOf(data);
  const { label, keyRequired } = AI_PROVIDERS[kind];
  const model = field(data, 'model').trim();
  const stored = await getAiConfig(getDb(), getCipher(), kind);
  const apiKey = field(data, 'apiKey').trim() || stored?.apiKey || null;
  if (!apiKey && keyRequired) {
    return { tone: 'danger', message: 'Bitte zuerst den API-Schlüssel eintragen.' };
  }
  try {
    const findings = await testAiConnection(
      {
        kind,
        apiKey,
        model,
        baseUrl: field(data, 'baseUrl').trim().replace(/\/+$/, '') || stored?.baseUrl,
      },
      { timeoutMs: 20_000 },
    );
    return describeConnection(label, model, findings);
  } catch (error) {
    if (error instanceof AiError) return { tone: 'danger', message: error.message };
    throw error;
  }
}

export async function setDefaultAiProviderAction(data: FormData): Promise<void> {
  await requireAdmin();
  await setDefaultAiProvider(getDb(), kindOf(data));
  revalidatePath(PAGE);
}

/** Removes a provider together with its key. */
export async function deleteAiProviderAction(data: FormData): Promise<void> {
  await requireAdmin();
  await deleteAiProvider(getDb(), kindOf(data));
  revalidatePath(PAGE);
}
