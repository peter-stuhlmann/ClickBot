import { getTemplate, NotFoundError } from '@click-bot/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/templates/AppShell';
import { templateToDraft } from '@/lib/template-draft';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { deleteTemplateAction, selectProjectAction, updateTemplateAction } from '../../actions';
import { TemplateEditor } from '../template-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Vorlage bearbeiten · Click-Bot' };

type Props = { params: Promise<{ id: string }> };

/** Changes or deletes a template. */
export default async function TemplatePage({ params }: Props) {
  // Auth first: nothing is read for someone who is not signed in.
  const db = getDb();
  const shell = await getShell(db, new Date());
  const { id } = await params;
  const template = await getTemplate(db, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!template) notFound();

  return (
    <AppShell active="vorlagen" {...shell} selectProject={selectProjectAction}>
      <TemplateEditor
        templateId={template.id}
        initial={templateToDraft(template)}
        updateAction={updateTemplateAction}
        deleteAction={deleteTemplateAction}
      />
    </AppShell>
  );
}
