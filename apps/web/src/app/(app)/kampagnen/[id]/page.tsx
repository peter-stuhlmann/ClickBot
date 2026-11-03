import { campaignDeletePhrase, getCampaign, getCustomer, listJobOverview } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Dialog } from '@/components/molecules/Dialog';
import { CampaignForm } from '@/components/organisms/CampaignForm';
import { DeleteSection } from '@/components/organisms/DeleteSection';
import { JobsTable } from '@/components/organisms/JobsTable';
import { PageHeader } from '@/components/organisms/PageHeader';
import { describePeriod } from '@/server/campaigns-view';
import { requireUser } from '@/server/auth';
import { loadJobCosts } from '@/server/cost-data';
import { getDb } from '@/server/db';
import { NO_AI_COST } from '@/lib/cost';
import { toJobRow } from '@/server/jobs-view';
import {
  deleteCampaignAction,
  runJobNowAction,
  toggleJobAction,
  updateCampaignAction,
} from '@/app/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Kampagne · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/**
 * One campaign: its jobs. Changing it, and deleting it once it has no jobs, sit behind the
 * settings button next to its name.
 */
export default async function CampaignPage({ params }: Props) {
  const db = getDb();
  const now = new Date();
  await requireUser();
  const { id } = await params;
  const campaign = await getCampaign(db, id);
  if (!campaign) notFound();
  const [project, rows] = await Promise.all([
    getCustomer(db, campaign.customerId),
    listJobOverview(db, { campaignId: campaign.id }),
  ]);
  const costs = await loadJobCosts(
    db,
    rows.map((row) => row.id),
  );
  const period = describePeriod(campaign.startsOn, campaign.endsOn);

  return (
    <>
      <PageHeader
        title={campaign.name}
        titleAside={
          <Dialog label="Kampagne bearbeiten" title="Kampagne bearbeiten">
            <CampaignForm
              key={campaign.id}
              projectName={project?.name ?? ''}
              campaign={campaign}
              action={updateCampaignAction}
            />
            <DeleteSection
              title="Kampagne löschen"
              description={
                rows.length === 0
                  ? 'Die Kampagne verschwindet aus dem Projekt.'
                  : `Die Kampagne verschwindet aus dem Projekt, mit ${rows.length === 1 ? 'ihrem Test' : `ihren ${rows.length} Tests`} und allen Durchläufen und Reports. Tests, die bleiben sollen, vorher im Editor in eine andere Kampagne verschieben.`
              }
              buttonLabel="Kampagne löschen"
              fields={{ id: campaign.id }}
              action={deleteCampaignAction}
              confirmPhrase={rows.length > 0 ? campaignDeletePhrase(campaign.name) : undefined}
            />
          </Dialog>
        }
        description={[project?.name, period].filter(Boolean).join(' · ')}
        breadcrumb={[{ label: 'Kampagnen', href: '/kampagnen' }, { label: campaign.name }]}
        actions={
          <Button href="/jobs/neu" icon={<Icon name="plus" size={16} />}>
            Neuer Test
          </Button>
        }
      />
      <JobsTable
        rows={rows.map((row) => toJobRow(row, now, costs.get(row.id) ?? NO_AI_COST))}
        toggleAction={toggleJobAction}
        runAction={runJobNowAction}
      />
    </>
  );
}
