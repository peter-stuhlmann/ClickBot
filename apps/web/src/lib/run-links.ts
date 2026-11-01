/**
 * Where "Jetzt ausführen" leads: the report of the start when it has several runs (every device
 * and browser of the job), the report of the run itself when there is only one.
 */
export function testRunHref({ runId, runIds }: { runId: string; runIds: string[] }): string {
  return runIds.length > 1 ? `/laeufe/welle/${runId}` : `/laeufe/${runId}`;
}
