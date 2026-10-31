import 'server-only';
import type { TemplateRow } from '@click-bot/db';
import { formatRelative } from '@/lib/format';
import { describeStep } from '@/lib/step-view';
import { templateToDraft } from '@/lib/template-draft';
import type { TemplateView } from '@/lib/views';

/** A stored template for the templates page and the wizard. */
export function toTemplateView(row: TemplateRow, now: Date): TemplateView {
  const steps = row.steps === 1 ? '1 Schritt' : `${row.steps} Schritte`;
  const by = row.createdByName ? ` von ${row.createdByName}` : '';
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    href: `/vorlagen/${row.id}`,
    meta: `${steps} · geändert ${formatRelative(row.updatedAt, now)}${by}`,
    steps: templateToDraft(row).steps.map(describeStep),
  };
}
