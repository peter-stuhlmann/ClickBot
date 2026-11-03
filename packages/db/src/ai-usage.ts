import {
  AI_PROVIDER_KINDS,
  MAX_PRICE_PER_MILLION,
  type AiProviderKind,
  type AiUsage,
  type ModelPrice,
} from '@click-bot/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from './client';
import { ValidationError, type ValidationIssue } from './errors';
import { aiModelPrices, aiProviders, jobs, runAiUsage, runs } from './schema';

/** The model a run called and the tokens it used. */
export type ModelUsage = { provider: AiProviderKind; model: string; usage: AiUsage };

export type ModelPriceRow = ModelPrice & {
  provider: AiProviderKind;
  model: string;
  updatedAt: Date;
};

export type ModelPriceInput = {
  provider: string;
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cachedPerMillion: number | null;
};

const priceOk = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= MAX_PRICE_PER_MILLION;

/** Creates or replaces the price of a model. Every problem is reported at once. */
export async function saveModelPrice(db: Database, input: ModelPriceInput): Promise<void> {
  const issues: ValidationIssue[] = [];
  const provider = AI_PROVIDER_KINDS.find((kind) => kind === input.provider);
  const model = input.model.trim();
  if (!provider) issues.push({ path: 'provider', message: 'Unbekannter Anbieter.' });
  if (!model || model.length > 200) {
    issues.push({ path: 'model', message: 'Bitte ein Modell angeben (höchstens 200 Zeichen).' });
  }
  const range = `Bitte eine Zahl zwischen 0 und ${MAX_PRICE_PER_MILLION.toLocaleString('de-DE')} eingeben.`;
  if (!priceOk(input.inputPerMillion)) issues.push({ path: 'inputPerMillion', message: range });
  if (!priceOk(input.outputPerMillion)) issues.push({ path: 'outputPerMillion', message: range });
  if (input.cachedPerMillion !== null && !priceOk(input.cachedPerMillion)) {
    issues.push({ path: 'cachedPerMillion', message: range });
  }
  if (issues.length > 0 || !provider) throw new ValidationError(issues);

  const values = {
    inputPerMillion: input.inputPerMillion,
    outputPerMillion: input.outputPerMillion,
    cachedPerMillion: input.cachedPerMillion,
    updatedAt: sql`now()`,
  };
  await db
    .insert(aiModelPrices)
    .values({ provider, model, ...values })
    .onConflictDoUpdate({ target: [aiModelPrices.provider, aiModelPrices.model], set: values });
}

export async function deleteModelPrice(
  db: Database,
  provider: AiProviderKind,
  model: string,
): Promise<void> {
  await db
    .delete(aiModelPrices)
    .where(and(eq(aiModelPrices.provider, provider), eq(aiModelPrices.model, model)));
}

export async function listModelPrices(db: Database): Promise<ModelPriceRow[]> {
  return db
    .select({
      provider: aiModelPrices.provider,
      model: aiModelPrices.model,
      inputPerMillion: aiModelPrices.inputPerMillion,
      outputPerMillion: aiModelPrices.outputPerMillion,
      cachedPerMillion: aiModelPrices.cachedPerMillion,
      updatedAt: aiModelPrices.updatedAt,
    })
    .from(aiModelPrices)
    .orderBy(asc(aiModelPrices.provider), asc(aiModelPrices.model));
}

/**
 * Every model a price can be kept for: those set up as a provider and those a run has used (an
 * old model may still be in old runs). Sorted by provider, then model.
 */
export async function listKnownModels(
  db: Database,
): Promise<{ provider: AiProviderKind; model: string }[]> {
  const result = await db.execute<{ provider: AiProviderKind; model: string }>(sql`
    SELECT kind AS provider, model FROM ${aiProviders}
    UNION
    SELECT provider, model FROM ${runAiUsage}
    ORDER BY provider, model
  `);
  return result.rows;
}

/** Stores the tokens of a run; nothing to store without any. Called by completeRun. */
export async function insertRunUsage(
  db: Pick<Database, 'insert'>,
  runId: string,
  { provider, model, usage }: ModelUsage,
): Promise<void> {
  await db.insert(runAiUsage).values({
    runId,
    provider,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedTokens: usage.cachedTokens,
  });
}

/** The tokens of one run, or null if it used no AI. */
export async function getRunUsage(db: Database, runId: string): Promise<ModelUsage | null> {
  const [row] = await db.select().from(runAiUsage).where(eq(runAiUsage.runId, runId));
  return row
    ? {
        provider: row.provider,
        model: row.model,
        usage: {
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          cachedTokens: row.cachedTokens,
        },
      }
    : null;
}

/** The tokens of each of the given runs; a run without AI has no entry. */
export async function listRunsUsage(
  db: Database,
  runIds: readonly string[],
): Promise<Map<string, ModelUsage>> {
  const result = new Map<string, ModelUsage>();
  if (runIds.length === 0) return result;
  const rows = await db
    .select()
    .from(runAiUsage)
    .where(inArray(runAiUsage.runId, [...runIds]));
  for (const row of rows) {
    result.set(row.runId, {
      provider: row.provider,
      model: row.model,
      usage: {
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cachedTokens: row.cachedTokens,
      },
    });
  }
  return result;
}

/** The tokens of all runs of each job, per model (a job may have run with different models). */
export async function listJobUsage(
  db: Database,
  jobIds: readonly string[],
): Promise<Map<string, ModelUsage[]>> {
  const result = new Map<string, ModelUsage[]>();
  if (jobIds.length === 0) return result;
  const rows = await db
    .select({
      jobId: runs.jobId,
      provider: runAiUsage.provider,
      model: runAiUsage.model,
      input: sql<number>`sum(${runAiUsage.inputTokens})`.mapWith(Number),
      output: sql<number>`sum(${runAiUsage.outputTokens})`.mapWith(Number),
      cached: sql<number>`sum(${runAiUsage.cachedTokens})`.mapWith(Number),
    })
    .from(runAiUsage)
    .innerJoin(runs, eq(runs.id, runAiUsage.runId))
    .innerJoin(jobs, eq(jobs.id, runs.jobId))
    .where(inArray(runs.jobId, [...jobIds]))
    .groupBy(runs.jobId, runAiUsage.provider, runAiUsage.model)
    .orderBy(asc(runAiUsage.provider), asc(runAiUsage.model));
  for (const row of rows) {
    const list = result.get(row.jobId) ?? [];
    list.push({
      provider: row.provider,
      model: row.model,
      usage: { inputTokens: row.input, outputTokens: row.output, cachedTokens: row.cached },
    });
    result.set(row.jobId, list);
  }
  return result;
}
