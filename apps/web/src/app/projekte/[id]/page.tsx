import { getCampaignStats, getCustomer } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CustomerForm } from '@/components/organisms/CustomerForm';
import { DeleteSection } from '@/components/organisms/DeleteSection';
import { PageHeader } from '@/components/organisms/PageHeader';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { deleteProjectAction, selectProjectAction, updateProjectAction } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Projekt bearbeiten · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/** "Projekt bearbeiten": rename the project, or delete it once it has no jobs. */
export default async function ProjectPage({ params }: Props) {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db, now);
  const { id } = await params;
  const project = await getCustomer(db, id);
  if (!project) notFound();
  const stats = await getCampaignStats(db, project.id, now);
  const jobs = stats.jobs.total;

  return (
    <AppShell active="kampagnen" {...shell} selectProject={selectProjectAction}>
      <PageHeader
        title={project.name}
        description="Projekt bearbeiten"
        breadcrumb={[{ label: 'Kampagnen', href: '/kampagnen' }, { label: project.name }]}
      />
      <CustomerForm
        key={project.id}
        project={{ id: project.id, name: project.name }}
        action={updateProjectAction}
      />
      <div className="max-w-xl">
        <DeleteSection
          title="Projekt löschen"
          description="Das Projekt verschwindet mit seinen Kampagnen und Zugangsdaten."
          buttonLabel="Projekt löschen"
          fields={{ id: project.id }}
          action={deleteProjectAction}
          blocked={
            jobs > 0
              ? `Das Projekt hat noch ${jobs === 1 ? '1 Job' : `${jobs} Jobs`}. Lösche sie zuerst im Editor.`
              : undefined
          }
        />
      </div>
    </AppShell>
  );
}
