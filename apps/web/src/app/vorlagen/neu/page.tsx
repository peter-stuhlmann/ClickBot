import type { Metadata } from 'next';
import { AppShell } from '@/components/templates/AppShell';
import { emptyTemplateDraft } from '@/lib/template-draft';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { createTemplateAction, selectProjectAction } from '../../actions';
import { TemplateEditor } from '../template-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Neue Vorlage · Click-Bot' };

/** "Neue Vorlage": name, note and steps. */
export default async function NewTemplatePage() {
  // Auth first.
  const shell = await getShell(getDb(), new Date());
  return (
    <AppShell active="vorlagen" {...shell} selectProject={selectProjectAction}>
      <TemplateEditor initial={emptyTemplateDraft()} createAction={createTemplateAction} />
    </AppShell>
  );
}
