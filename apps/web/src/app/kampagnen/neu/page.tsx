import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CampaignForm } from '@/components/organisms/CampaignForm';
import { PageHeader } from '@/components/organisms/PageHeader';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { createCampaignAction, selectProjectAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Kampagne anlegen · Click-Bot' };

/** "Kampagne anlegen" in the current project. */
export default async function NewCampaignPage() {
  const shell = await getShell(getDb(), new Date());
  // A campaign needs a project; without one, the first step is creating it.
  if (!shell.project) redirect('/projekte/neu');

  return (
    <AppShell active="kampagnen" {...shell} selectProject={selectProjectAction}>
      <PageHeader
        title="Kampagne anlegen"
        breadcrumb={[{ label: 'Kampagnen', href: '/kampagnen' }, { label: 'Kampagne anlegen' }]}
      />
      {/* A new key per project: switching the project shows a fresh form for it. */}
      <CampaignForm
        key={shell.project.id}
        projectName={shell.project.name}
        action={createCampaignAction}
      />
    </AppShell>
  );
}
