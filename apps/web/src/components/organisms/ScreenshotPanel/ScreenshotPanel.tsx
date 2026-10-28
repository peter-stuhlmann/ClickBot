import { Card } from '@/components/atoms/Card';

export type ScreenshotPanelProps = {
  url: string;
  /** "Bildschirmfoto · Schritt 5" */
  caption: string;
};

/** The screenshot of a run in a browser frame; a click opens it in full size. */
export function ScreenshotPanel({ url, caption }: ScreenshotPanelProps) {
  return (
    <Card title={caption}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-input border border-border focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span
          aria-hidden="true"
          className="flex gap-1.5 border-b border-border bg-subtle px-3 py-2"
        >
          <span className="size-2 rounded-full bg-danger-dot" />
          <span className="size-2 rounded-full bg-warning-dot" />
          <span className="size-2 rounded-full bg-success-dot" />
        </span>
        {/* Screenshots are local files of any size; next/image would need fixed dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${caption}, in voller Größe öffnen`} className="block h-auto w-full" />
      </a>
    </Card>
  );
}
