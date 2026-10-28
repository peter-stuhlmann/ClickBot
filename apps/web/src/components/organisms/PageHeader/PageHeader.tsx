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
    <header className="flex items-center justify-between gap-6">
      <div className="flex flex-col gap-1">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 font-semibold text-text">{title}</h1>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
        {description && <p className="text-body text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}
