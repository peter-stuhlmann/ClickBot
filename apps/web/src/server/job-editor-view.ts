import 'server-only';
import type { Job } from '@click-bot/db';
import { describeTargets } from '@/lib/devices';
import { describeSchedule } from '@/lib/format';
import type { JobHeaderView, Tone } from '@/lib/views';

const STATUS: Record<Job['status'], { tone: Tone; label: string }> = {
  active: { tone: 'success', label: 'Aktiv' },
  paused: { tone: 'warning', label: 'Pausiert' },
  draft: { tone: 'neutral', label: 'Entwurf' },
  finished: { tone: 'neutral', label: 'Beendet' },
};

/** Title line of the editor (screen 02). */
export function toJobHeader(
  job: Pick<Job, 'name' | 'status' | 'schedule' | 'devices' | 'browsers'>,
): JobHeaderView {
  const { primary, secondary } = describeSchedule(job.schedule);
  return {
    title: job.name,
    status: STATUS[job.status],
    description: [primary, secondary, describeTargets(job.devices, job.browsers)].join(' · '),
  };
}
