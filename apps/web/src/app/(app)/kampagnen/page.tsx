import { getCampaignStats, listCampaignOverview } from '@click-bot/db';
import type { Metadata } from 'next';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { CampaignsTable } from '@/components/organisms/CampaignsTable';
import { PageHeader } from '@/components/organisms/PageHeader';
import { StatGrid } from '@/components/organisms/StatGrid';
import { toCampaignRow, toCampaignStatCards } from '@/server/campaigns-view';
import { getDb } from '@/server/db';
import { getShell, projectScope } from '@/server/shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Kampagnen · Click-Bot' };

/** "Kampagnen": the campaigns of the current project with their jobs and runs. */
export default async function CampaignsPage() {
  const db = getDb();
  const now = new Date();
  const shell = await getShell(db);
  const { customerId } = projectScope(shell.project);
  const [rows, stats] = await Promise.all([
    listCampaignOverview(db, customerId, now),
    getCampaignStats(db, customerId, now),
  ]);

  return (
    <>
      <PageHeader
        title="Kampagnen"
        description={
          shell.project
            ? `${shell.project.name} · Alle Kampagnen mit ihren Tests und Durchläufen.`
            : 'Noch kein Projekt. Lege oben in der Seitenleiste das erste an.'
        }
        actions={
          shell.project ? (
            <>
              <Button variant="secondary" href={`/projekte/${shell.project.id}`}>
                Projekt bearbeiten
              </Button>
              <Button href="/kampagnen/neu" icon={<Icon name="plus" size={16} />}>
                Kampagne anlegen
              </Button>
            </>
          ) : (
            <Button href="/projekte/neu" icon={<Icon name="plus" size={16} />}>
              Projekt anlegen
            </Button>
          )
        }
      />
      <StatGrid cards={toCampaignStatCards(stats)} />
      <CampaignsTable rows={rows.map((row) => toCampaignRow(row, now))} />
    </>
  );
}
