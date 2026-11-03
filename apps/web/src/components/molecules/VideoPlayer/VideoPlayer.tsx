export type VideoPlayerProps = {
  url: string;
  /** WebVTT with the step that ran at each moment. */
  captionsUrl: string;
};

/** The video of a run with the browser's controls, the steps as captions (on by default). */
export function VideoPlayer({ url, captionsUrl }: VideoPlayerProps) {
  return (
    <video
      src={url}
      controls
      preload="metadata"
      playsInline
      className="block aspect-8/5 w-full rounded-input border border-border bg-subtle"
    >
      <track kind="captions" src={captionsUrl} srcLang="de" label="Schritte" default />
    </video>
  );
}
