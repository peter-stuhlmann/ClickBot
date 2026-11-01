import type { Metadata } from 'next';
import { emptyTemplateDraft } from '@/lib/template-draft';
import { requireUser } from '@/server/auth';
import { createTemplateAction } from '@/app/actions';
import { TemplateEditor } from '../template-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Neue Vorlage · Click-Bot' };

/** "Neue Vorlage": name, note and steps. */
export default async function NewTemplatePage() {
  // Auth first.
  await requireUser();
  return (
    <>
      <TemplateEditor initial={emptyTemplateDraft()} createAction={createTemplateAction} />
    </>
  );
}
