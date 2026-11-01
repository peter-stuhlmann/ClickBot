import { getBrowserLimit, listCalendarJobs } from '@click-bot/db';
import type { Metadata } from 'next';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { WeekSwitcher } from '@/components/molecules/WeekSwitcher';
import { LoadPanel } from '@/components/organisms/LoadPanel';
import { PageHeader } from '@/components/organisms/PageHeader';
import { WeekCalendar } from '@/components/organisms/WeekCalendar';
import { todayIn } from '@/lib/calendar';
import { weekOf } from '@/lib/week-plan';
import { browserLimit, toCalendarView } from '@/server/calendar-view';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { moveSlotAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Kalender · Click-Bot' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

/** Screen 13 "Kalender": the planned runs of a week, and whether the browsers suffice. */
export default async function CalendarPage({ searchParams }: Props) {
  // Auth first: nothing is read for someone who is not signed in.
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db);
  const params = await searchParams;
  const [jobs, reported] = await Promise.all([listCalendarJobs(db, now), getBrowserLimit(db)]);
  const view = toCalendarView(jobs, {
    monday: weekOf(one(params.woche), todayIn(now)),
    selected: one(params.tag),
    now,
    limit: browserLimit(reported, process.env.MAX_CONCURRENT_BROWSERS),
    project: shell.project?.id ?? null,
  });

  return (
    <>
      <PageHeader
        title="Kalender"
        description={`${shell.project?.name ?? 'Kein Projekt'} · Wann die Tests dieser Woche laufen und ob es dabei eng wird.`}
        actions={
          <>
            <WeekSwitcher {...view.nav} />
            <Button href="/jobs/neu" icon={<Icon name="plus" size={16} />}>
              Termin planen
            </Button>
          </>
        }
      />
      <WeekCalendar title={view.title} days={view.days} />
      <LoadPanel {...view.load} moveAction={moveSlotAction} />
    </>
  );
}
