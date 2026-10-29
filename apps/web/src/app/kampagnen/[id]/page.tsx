import { getCampaign, getCustomer, listJobOverview } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { CampaignForm } from '@/components/organisms/CampaignForm';
import { DeleteSection } from '@/components/organisms/DeleteSection';
import { JobsTable } from '@/components/organisms/JobsTable';
import { PageHeader } from '@/components/organisms/PageHeader';
import { AppShell } from '@/components/templates/AppShell';
import { describePeriod } from '@/server/campaigns-view';
import { getDb } from '@/server/db';
import { toJobRow } from '@/server/jobs-view';
import { getShell } from '@/server/shell';
import {
  deleteCampaignAction,
  selectProjectAction,
  toggleJobAction,
  updateCampaignAction,
} from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Kampagne · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/** One campaign: its jobs, changing it, and deleting it once it has no jobs. */
export default async function CampaignPage({ params }: Props) {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db, now);
  const { id } = await params;
  const campaign = await getCampaign(db, id);
  if (!campaign) notFound();
  const [project, rows] = await Promise.all([
    getCustomer(db, campaign.customerId),
    listJobOverview(db, { campaignId: campaign.id }),
  ]);
  const period = describePeriod(campaign.startsOn, campaign.endsOn);

  return (
    <AppShell active="kampagnen" {...shell} selectProject={selectProjectAction}>
      <PageHeader
        title={campaign.name}
        description={[project?.name, period].filter(Boolean).join(' · ')}
        breadcrumb={[{ label: 'Kampagnen', href: '/kampagnen' }, { label: campaign.name }]}
        actions={
          <Button href="/jobs/neu" icon={<Icon name="plus" size={16} />}>
            Neuer Job
          </Button>
        }
      />
      <JobsTable rows={rows.map((row) => toJobRow(row, now))} toggleAction={toggleJobAction} />
      <CampaignForm
        key={campaign.id}
        projectName={project?.name ?? ''}
        campaign={campaign}
        action={updateCampaignAction}
      />
      <div className="max-w-xl">
        <DeleteSection
          title="Kampagne löschen"
          description="Die Kampagne verschwindet aus dem Projekt."
          buttonLabel="Kampagne löschen"
          fields={{ id: campaign.id }}
          action={deleteCampaignAction}
          blocked={
            rows.length > 0
              ? `Die Kampagne hat noch ${rows.length === 1 ? '1 Job' : `${rows.length} Jobs`}. Verschiebe sie im Editor in eine andere Kampagne oder lösche sie.`
              : undefined
          }
        />
      </div>
    </AppShell>
  );
}
