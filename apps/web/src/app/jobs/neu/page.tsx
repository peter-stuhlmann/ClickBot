import { DEFAULT_CAMPAIGN, listAiProviders, listCampaigns, listTemplates } from '@click-bot/db';
import type { Metadata } from 'next';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getShell, projectScope } from '@/server/shell';
import { toTemplateView } from '@/server/templates-view';
import { createJobAction, selectProjectAction, startRecordingAction } from '../../actions';
import { NewJobWizard } from './new-job-wizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Neuer Test · Click-Bot' };

/** Screen 05 "Neuer Job", in a campaign of the current project. */
export default async function NewJobPage() {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db, now);
  const [campaigns, templates, providers] = await Promise.all([
    listCampaigns(db, projectScope(shell.project).customerId),
    listTemplates(db),
    listAiProviders(db),
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
        aiReady={providers.some((provider) => provider.isDefault)}
        workerOnline={shell.worker.online}
        defaultCampaignId={
          (campaigns.find((campaign) => campaign.name === DEFAULT_CAMPAIGN) ?? campaigns[0])?.id ??
          ''
        }
      />
    </AppShell>
  );
}
