'use server';

import { AiError, createAiClient, suggestFlow, testAiConnection } from '@click-bot/ai';
import {
  deleteAiProvider,
  getAiConfig,
  getWorkerStatus,
  requestPageAnalysis,
  saveAiProvider,
  setDefaultAiProvider,
  ValidationError,
  waitForPageAnalysis,
  type Database,
} from '@click-bot/db';
import type { PageFacts } from '@click-bot/shared';
import { AI_PROVIDER_KINDS, AI_PROVIDERS, type AiProviderKind } from '@click-bot/shared';
import { revalidatePath } from 'next/cache';
import { describeConnection } from '@/lib/ai-settings';
import { field, toFormState } from '@/lib/form-state';
import { normaliseUrl, toStepDraft, type StepDraft } from '@/lib/job-draft';
import type {
  ConnectionCheck,
  FlowSuggestionResult,
  FormState,
  SuggestFlowAction,
} from '@/lib/views';
import { requireAdmin, requireUser } from '@/server/auth';
import { getCipher } from '@/server/cipher';
import { getDb } from '@/server/db';
import { analysisNotice, toPageFactRows } from '@/server/flow-suggestion-view';

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

const MAX_DESCRIPTION = 4_000;
const MAX_ANSWERS = 10;
/** The worker opens the page in a few seconds; longer means it is busy or the page hangs. */
const ANALYSIS_WAIT_MS = 45_000;
const ANALYSIS_POLL_MS = 500;
/** Local models (Custom) can take a while for a long flow. */
const SUGGESTION_TIMEOUT_MS = 120_000;

/** Lets the worker open the page once; without a worker or a page the model has to guess. */
async function readPage(
  db: Database,
  url: string,
): Promise<{ facts: PageFacts | null; notice: string | null }> {
  const now = new Date();
  if (!(await getWorkerStatus(db, now)).online) {
    return { facts: null, notice: analysisNotice({ kind: 'offline' }) };
  }
  const id = await requestPageAnalysis(db, url, now);
  const state = await waitForPageAnalysis(db, id, {
    deadline: new Date(now.getTime() + ANALYSIS_WAIT_MS),
    now: () => new Date(),
    pause: () => new Promise((resolve) => setTimeout(resolve, ANALYSIS_POLL_MS)),
  });
  if (!state) return { facts: null, notice: analysisNotice({ kind: 'timeout' }) };
  if (state.status !== 'done' || !state.result) {
    const error = state.error ?? 'unbekannter Fehler.';
    return { facts: null, notice: analysisNotice({ kind: 'failed', error }) };
  }
  return { facts: state.result, notice: null };
}

const isAnswer = (value: unknown): value is { question: string; answer: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { question?: unknown }).question === 'string' &&
  typeof (value as { answer?: unknown }).answer === 'string';

/**
 * "Mit KI beschreiben" (screen 06): the default AI provider suggests steps for the description,
 * knowing the page if the worker could open it. Nothing is saved; the wizard takes the steps over.
 */
export async function suggestFlowAction(
  input: Parameters<SuggestFlowAction>[0],
): Promise<FlowSuggestionResult> {
  await requireUser();
  const description = String(input?.description ?? '').trim();
  if (!description) return { ok: false, message: 'Bitte beschreiben, was der Bot tun soll.' };
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, message: `Höchstens ${MAX_DESCRIPTION} Zeichen.` };
  }
  const startUrl = normaliseUrl(String(input?.startUrl ?? ''));
  if (!/^https?:\/\/\S+$/.test(startUrl)) {
    return { ok: false, message: 'Bitte zuerst in Schritt 1 die Website angeben.' };
  }
  const answers = (Array.isArray(input?.answers) ? input.answers : [])
    .filter(isAnswer)
    .slice(0, MAX_ANSWERS);

  const db = getDb();
  const config = await getAiConfig(db, getCipher());
  if (!config) {
    return {
      ok: false,
      message: 'Es ist noch kein KI-Anbieter eingerichtet: Einstellungen → KI & API.',
    };
  }
  const { facts, notice } = await readPage(db, startUrl);
  try {
    const client = createAiClient(config, { timeoutMs: SUGGESTION_TIMEOUT_MS });
    const suggestion = await suggestFlow(client, { startUrl, description, answers, page: facts });
    return {
      ok: true,
      steps: suggestion.steps.map(toStepDraft).filter((step): step is StepDraft => step !== null),
      questions: suggestion.questions,
      facts: facts ? toPageFactRows(facts) : [],
      notice,
    };
  } catch (error) {
    if (error instanceof AiError) return { ok: false, message: error.message };
    throw error;
  }
}
