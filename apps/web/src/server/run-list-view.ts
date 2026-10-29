import 'server-only';
import type { RunListRow } from '@click-bot/db';
import { browserLabel, deviceLabel } from '@/lib/devices';
import { formatDuration, formatShortDateTime } from '@/lib/format';
import type { RunListRowView } from '@/lib/views';
import { RUN_BADGE } from './jobs-view';

/** Screen 14: one run in the list of all runs. */
export function toRunListRow(row: RunListRow): RunListRowView {
  const startedOrPlanned = row.startedAt ?? row.scheduledAt;
  return {
    id: row.id,
    href: `/laeufe/${row.id}`,
    jobName: row.jobName,
    detail: `Lauf #${row.runNr} · ${deviceLabel(row.device)} · ${browserLabel(row.browser)} · Bot ${row.botNr}`,
    testRun: row.slotIndex === null,
    campaign: row.campaignName,
    when: formatShortDateTime(startedOrPlanned),
    duration:
      row.startedAt && row.finishedAt
        ? formatDuration(row.finishedAt.getTime() - row.startedAt.getTime())
        : '–',
    status: RUN_BADGE[row.status],
    failed: row.status === 'failed',
  };
}
