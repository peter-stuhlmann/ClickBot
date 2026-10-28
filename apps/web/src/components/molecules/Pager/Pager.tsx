import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';

export type PagerProps = {
  /** "Seite 2 von 25" */
  label: string;
  /** Newer entries; omitted on the first page. */
  previousHref?: string;
  /** Older entries; omitted on the last page. */
  nextHref?: string;
};

/** Paging below a list that shows the newest entries first. */
export function Pager({ label, previousHref, nextHref }: PagerProps) {
  if (!previousHref && !nextHref) return null;
  return (
    <nav aria-label="Seiten" className="flex items-center justify-between gap-4">
      {previousHref ? (
        <Button
          variant="secondary"
          size="sm"
          href={previousHref}
          icon={<Icon name="arrowLeft" size={16} />}
        >
          Neuere
        </Button>
      ) : (
        <span />
      )}
      <span className="text-meta text-text-muted">{label}</span>
      {nextHref ? (
        <Button variant="secondary" size="sm" href={nextHref}>
          Ältere
          <Icon name="arrowRight" size={16} />
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
