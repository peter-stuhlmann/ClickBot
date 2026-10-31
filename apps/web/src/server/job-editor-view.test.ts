// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toJobHeader } from './job-editor-view';

const job = {
  name: 'Kontaktformular-Test',
  status: 'active' as const,
  schedule: {
    type: 'interval' as const,
    everyMinutes: 15,
    maxRuns: 20,
    startAt: '2026-11-05T10:00:00Z',
  },
  devices: ['desktop' as const, 'iphone' as const],
  deviceBrowsers: { desktop: ['chromium' as const] },
};

describe('toJobHeader', () => {
  it('names the job with its status, schedule and devices', () => {
    expect(toJobHeader(job)).toEqual({
      title: 'Kontaktformular-Test',
      status: { tone: 'success', label: 'Aktiv' },
      description: 'alle 15 Min. · 20-mal · Desktop (Chrome), iPhone 15 (Safari)',
    });
  });

  it.each([
    ['paused', 'warning', 'Pausiert'],
    ['draft', 'neutral', 'Entwurf'],
    ['finished', 'neutral', 'Beendet'],
  ] as const)('shows the status %s', (status, tone, label) => {
    expect(toJobHeader({ ...job, status }).status).toEqual({ tone, label });
  });
});
