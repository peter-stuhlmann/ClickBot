import { listCampaigns, listTemplates } from '@click-bot/db';
import type { Metadata } from 'next';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getShell, projectScope } from '@/server/shell';
import { toTemplateView } from '@/server/templates-view';
import { createJobAction, selectProjectAction, startRecordingAction } from '../../actions';
import { NewJobWizard } from './new-job-wizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Neuer Job · Click-Bot' };

/** Screen 05 "Neuer Job", in a campaign of the current project. */
export default async function NewJobPage() {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db, now);
  const [campaigns, templates] = await Promise.all([
    listCampaigns(db, projectScope(shell.project).customerId),
    listTemplates(db),
  ]);

  return (
    <AppShell active="jobs" {...shell} selectProject={selectProjectAction}>
      {/* A new key per project: switching the project starts the wizard afresh. */}
      <NewJobWizard
        key={shell.project?.id ?? 'none'}
        campaigns={campaigns}
        now={now.toISOString()}
        createAction={createJobAction}
        startRecording={startRecordingAction}
        templates={templates.map((template) => ({
          view: toTemplateView(template, now),
          flow: template.flow,
        }))}
      />
    </AppShell>
  );
}
