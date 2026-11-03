import { buttonVariants } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';

export type RunVideoProps = {
  url: string;
  /** WebVTT with the step that ran at each moment. */
  captionsUrl: string;
  /** Name of the downloaded file, e.g. "kontaktformular-test-durchlauf-7.mp4". */
  fileName: string;
};

/** The video of a run: played in the report with the steps as captions, or downloaded as MP4. */
export function RunVideo({ url, captionsUrl, fileName }: RunVideoProps) {
  return (
    <Card
      title="Video"
      aside={
        <a
          href={url}
          download={fileName}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          <Icon name="download" size={16} />
          Video herunterladen
        </a>
      }
    >
      <video
        src={url}
        controls
        preload="metadata"
        playsInline
        className="block aspect-8/5 w-full rounded-input border border-border bg-subtle"
      >
        <track kind="captions" src={captionsUrl} srcLang="de" label="Schritte" default />
      </video>
      <p className="text-small text-text-muted">
        Zugangsdaten sind abgedeckt. Das Video bleibt 30 Tage, der Report bleibt.
      </p>
    </Card>
  );
}
