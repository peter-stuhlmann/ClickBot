import { listTemplates } from '@click-bot/db';
import type { Metadata } from 'next';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { PageHeader } from '@/components/organisms/PageHeader';
import { TemplateList } from '@/components/organisms/TemplateList';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { toTemplateView } from '@/server/templates-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Vorlagen · Click-Bot' };

/** "Vorlagen": flows for any website, for every project. */
export default async function TemplatesPage() {
  // Auth first: nothing is read for someone who is not signed in.
  const db = getDb();
  const now = new Date();
  await requireUser();
  const templates = await listTemplates(db);

  return (
    <>
      <PageHeader
        title="Vorlagen"
        description="Aufgenommene Abläufe, die für jede Website passen. Beim Anlegen eines Tests mit „Aus Vorlage übernehmen“."
        actions={
          templates.length > 0 && (
            <Button href="/vorlagen/neu" icon={<Icon name="plus" size={16} />}>
              Neue Vorlage
            </Button>
          )
        }
      />
      <TemplateList templates={templates.map((template) => toTemplateView(template, now))} />
    </>
  );
}
