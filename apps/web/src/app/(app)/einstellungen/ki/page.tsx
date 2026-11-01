import { listAiProviders } from '@click-bot/db';
import type { Metadata } from 'next';
import { InfoCard } from '@/components/molecules/InfoCard';
import { Tabs } from '@/components/molecules/Tabs';
import { PageHeader } from '@/components/organisms/PageHeader';
import { SettingsLayout } from '@/components/templates/SettingsLayout';
import { SETTINGS_TABS } from '@/lib/settings-tabs';
import { toAiProviderViews } from '@/server/ai-settings-view';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import {
  deleteAiProviderAction,
  saveAiProviderAction,
  setDefaultAiProviderAction,
  testAiProviderAction,
} from '@/app/ai-actions';
import { AiProviderList } from './ai-provider-list';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'KI & API · Click-Bot' };

const ACTIONS = {
  save: saveAiProviderAction,
  test: testAiProviderAction,
  makeDefault: setDefaultAiProviderAction,
  remove: deleteAiProviderAction,
};

const FACTS = [
  {
    title: 'Verschlüsselt gespeichert',
    text: 'AES-256 mit dem SECRETS_KEY des Servers. Ein Schlüssel wird nie wieder angezeigt, nur seine letzten vier Zeichen.',
  },
  {
    title: 'Nur für Admins',
    text: 'Andere im Team sehen, welcher Anbieter eingerichtet ist, aber keine Schlüssel.',
  },
  {
    title: 'Ein Standard-Anbieter',
    text: 'Ihn nutzen KI-Schritte, die KI-Suche nach Elementen und „Ablauf mit KI“, sobald es sie gibt.',
  },
];

/** "Einstellungen → KI & API": the AI providers and their keys. */
export default async function AiSettingsPage() {
  const signedIn = await requireUser();
  const isAdmin = signedIn.role === 'admin';
  const db = getDb();
  const providers = await listAiProviders(db);

  return (
    <>
      <SettingsLayout
        header={
          <PageHeader
            title="Einstellungen"
            description="KI & API – Anbieter für KI-Schritte und die KI-Suche nach Elementen."
          />
        }
        tabs={<Tabs label="Einstellungen" items={SETTINGS_TABS} current="/einstellungen/ki" />}
        aside={<InfoCard title="Sicherheit" items={FACTS} />}
      >
        <AiProviderList
          providers={toAiProviderViews(providers)}
          actions={isAdmin ? ACTIONS : undefined}
        />
      </SettingsLayout>
    </>
  );
}
