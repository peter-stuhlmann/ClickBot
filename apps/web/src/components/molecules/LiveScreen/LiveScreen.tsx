export type LiveScreenProps = {
  /** The newest picture of the page (data URL); null while there is none to show. */
  frame: string | null;
  /** Instead of the picture, e.g. "Wartet auf einen freien Browser …". */
  overlay: string | null;
  /** Below the picture, e.g. "Schritt 3 von 13 · Klicke auf „Kurse“". */
  caption: string | null;
};

/** "Live zuschauen": what the bot sees right now, and the step it is at. */
export function LiveScreen({ frame, overlay, caption }: LiveScreenProps) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-8/5 w-full overflow-hidden rounded-input border border-border bg-subtle">
        {frame && (
          // A live JPEG stream: next/image cannot optimise it, and the frames change constantly.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frame}
            alt="Live-Bild des Durchlaufs"
            draggable={false}
            className="size-full object-contain select-none"
          />
        )}
        {overlay && (
          <p className="absolute inset-0 flex items-center justify-center bg-subtle px-4 text-center text-body text-text-muted">
            {overlay}
          </p>
        )}
      </div>
      {caption && (
        <figcaption aria-live="polite" className="text-meta font-medium text-text">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
