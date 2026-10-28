import { getWorkerStatus, listCustomers } from '@click-bot/db';
import type { Metadata } from 'next';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getCurrentUser } from '@/server/session';
import { createJobAction } from '../../actions';
import { NewJobWizard } from './new-job-wizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Neuer Job · Click-Bot' };

export default async function NewJobPage() {
  // Auth first: nothing is read for someone who is not signed in.
  const user = await getCurrentUser();
  const db = getDb();
  const now = new Date();
  const [customers, worker] = await Promise.all([listCustomers(db), getWorkerStatus(db, now)]);

  return (
    <AppShell active="jobs" user={user} worker={worker}>
      <NewJobWizard customers={customers} now={now.toISOString()} createAction={createJobAction} />
    </AppShell>
  );
}
