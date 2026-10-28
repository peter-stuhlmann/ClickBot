import Link from 'next/link';

export type BreadcrumbItem = { label: string; href?: string };

export type BreadcrumbProps = { items: BreadcrumbItem[] };

/** "Jobs / Kontaktformular-Test / Lauf #7"; the last item is the current page. */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Pfad">
      <ol className="flex flex-wrap items-center gap-1.5 text-meta text-text-muted">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {item.href && !current ? (
                <Link href={item.href} className="hover:text-text hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={current ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
