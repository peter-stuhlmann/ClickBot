import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { Button, buttonVariants } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { CostPopover } from '@/components/molecules/CostPopover';
import { LiveScreen, type LiveScreenProps } from '@/components/molecules/LiveScreen';
import { VideoPlayer } from '@/components/molecules/VideoPlayer';
import type { TestRunView } from '@/lib/views';

export type TestRunCardProps = {
  /** The last test run of the draft; null before the first. */
  run: TestRunView | null;
  /** Where it runs, e.g. "Einmal auf Desktop in Chrome, sofort." */
  hint: string;
  /** The draft is being saved and the run queued. */
  busy: boolean;
  /** Why nothing was started, e.g. a step that is not complete. */
  error?: string;
  /** "Live zuschauen" while the run waits or runs: the picture and the step it is at. */
  live?: LiveScreenProps | null;
  onStart: () => void;
};

/** "Testlauf": plays the flow of a draft once, right away, and shows how it went. */
export function TestRunCard({ run, hint, busy, error, live, onStart }: TestRunCardProps) {
  return (
    <Card
      title="Testlauf"
      description={hint}
      aside={
        <Button
          variant="secondary"
          icon={<Icon name="play" size={16} />}
          loading={busy}
          disabled={run?.open}
          onClick={onStart}
        >
          {run ? 'Erneut testen' : 'Testlauf'}
        </Button>
      }
    >
      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
      {run && (
        <div role="status" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={run.status.tone}>{run.status.label}</Badge>
            <span className="text-meta text-text-muted">{run.where}</span>
            <Link
              href={run.href}
              target="_blank"
              rel="noopener"
              className="text-meta font-medium text-primary underline"
            >
              Report öffnen
            </Link>
            <CostPopover label="KI-Kosten dieses Testlaufs" cost={run.cost} />
          </div>
          <p className="text-body text-text">{run.message}</p>
          {run.summary && (
            <p className="rounded-input bg-neutral-soft px-3 py-2 text-body text-text">
              <span className="font-semibold">Testergebnis:</span> {run.summary}
            </p>
          )}
          {run.failedStep && <p className="text-body font-medium text-text">{run.failedStep}</p>}
          {run.reason && <p className="text-body break-words text-danger">{run.reason}</p>}
          {run.open && <p className="text-meta text-text-muted">Wird als Video aufgenommen.</p>}
        </div>
      )}
      {run?.video && !run.open && (
        <div className="flex flex-col gap-2">
          <VideoPlayer url={run.video.url} captionsUrl={run.video.captionsUrl} />
          <a
            href={run.video.url}
            download={run.video.fileName}
            className={buttonVariants({
              variant: 'secondary',
              size: 'sm',
              className: 'self-start',
            })}
          >
            <Icon name="download" size={16} />
            Video herunterladen
          </a>
        </div>
      )}
      {live && <LiveScreen {...live} />}
    </Card>
  );
}
