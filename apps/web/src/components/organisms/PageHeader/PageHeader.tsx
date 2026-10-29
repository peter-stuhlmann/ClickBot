import type { ReactNode } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Breadcrumb, type BreadcrumbItem } from '@/components/molecules/Breadcrumb';
import type { Tone } from '@/lib/views';

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Buttons on the right, e.g. "Neuer Job". */
  actions?: ReactNode;
  /** Way back above the title, e.g. Jobs / Kontaktformular-Test / Lauf #7. */
  breadcrumb?: BreadcrumbItem[];
  /** Badge next to the title, e.g. the verdict of a run. */
  status?: { tone: Tone; label: string };
};

export function PageHeader({ title, description, actions, breadcrumb, status }: PageHeaderProps) {
  return (
    // Below `sm` the buttons go under the title, so a long title keeps its width.
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 font-semibold break-words text-text">{title}</h1>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
        {description && <p className="text-body text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
