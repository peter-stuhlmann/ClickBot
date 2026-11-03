import 'server-only';
import {
  getRunUsage,
  listJobUsage,
  listModelPrices,
  listRunsUsage,
  type Database,
} from '@click-bot/db';
import { toCostView } from '@/lib/cost';
import type { CostView } from '@/lib/views';

/** What the AI of one run cost, with the prices as they are kept now. */
export async function loadRunCost(db: Database, runId: string): Promise<CostView> {
  const [usage, prices] = await Promise.all([getRunUsage(db, runId), listModelPrices(db)]);
  return toCostView(usage ? [usage] : [], prices);
}

/** What the AI of all runs of each job cost; every job gets a view, also one without AI. */
export async function loadJobCosts(
  db: Database,
  jobIds: readonly string[],
): Promise<Map<string, CostView>> {
  const [usage, prices] = await Promise.all([listJobUsage(db, jobIds), listModelPrices(db)]);
  return new Map(jobIds.map((id) => [id, toCostView(usage.get(id) ?? [], prices)]));
}

/** What the AI of each of the given runs cost; every run gets a view, also one without AI. */
export async function loadRunCosts(
  db: Database,
  runIds: readonly string[],
): Promise<Map<string, CostView>> {
  const [usage, prices] = await Promise.all([listRunsUsage(db, runIds), listModelPrices(db)]);
  return new Map(
    runIds.map((id) => {
      const entry = usage.get(id);
      return [id, toCostView(entry ? [entry] : [], prices)];
    }),
  );
}
