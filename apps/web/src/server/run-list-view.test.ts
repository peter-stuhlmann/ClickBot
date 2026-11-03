// @vitest-environment node
import type { RunListRow } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { NO_AI_COST } from '@/lib/cost';
import { toRunListRow } from './run-list-view';

// 14:30:00 in Berlin.
const scheduled = new Date('2026-11-05T13:30:00Z');

const row = (overrides: Partial<RunListRow> = {}): RunListRow => ({
  id: 'run-7',
  runNr: 7,
  slotIndex: 6,
  botNr: 2,
  device: 'iphone',
  browser: 'webkit',
  status: 'warning',
  scheduledAt: scheduled,
  startedAt: new Date(scheduled.getTime() + 1_000),
  finishedAt: new Date(scheduled.getTime() + 9_400),
  jobId: 'job-1',
  jobName: 'Kontaktformular-Test',
  customerName: 'Beispiel GmbH',
  campaignName: 'Black Friday',
  ...overrides,
});

describe('toRunListRow', () => {
  it('builds one row of the run list', () => {
    expect(toRunListRow(row(), NO_AI_COST)).toEqual({
      id: 'run-7',
      href: '/laeufe/run-7',
      jobName: 'Kontaktformular-Test',
      detail: 'Durchlauf 7 · iPhone 15 · Safari · Browser 2',
      testRun: false,
      campaign: 'Black Friday',
      when: '05.11. 14:30',
      duration: '8,4 s',
      status: { tone: 'warning', label: 'Mit Hinweis' },
      failed: false,
      cost: NO_AI_COST,
    });
  });

  it('marks test runs and failed runs', () => {
    expect(toRunListRow(row({ slotIndex: null, status: 'failed' }), NO_AI_COST)).toMatchObject({
      testRun: true,
      failed: true,
      status: { tone: 'danger', label: 'Fehlgeschlagen' },
    });
  });

  it('shows no duration before a run has finished, and its planned time', () => {
    expect(
      toRunListRow(row({ status: 'queued', startedAt: null, finishedAt: null }), NO_AI_COST),
    ).toMatchObject({
      when: '05.11. 14:30',
      duration: '–',
      status: { tone: 'neutral', label: 'Geplant' },
    });
  });
});
