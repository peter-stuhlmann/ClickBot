import type { ReactNode } from 'react';

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Buttons on the right, e.g. "Neuer Job". */
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-semibold text-text">{title}</h1>
        {description && <p className="text-body text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}
