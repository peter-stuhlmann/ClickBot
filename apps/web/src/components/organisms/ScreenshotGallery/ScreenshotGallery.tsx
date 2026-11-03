'use client';

import { useEffect, useEffectEvent, useState, type MouseEvent } from 'react';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Lightbox } from '@/components/molecules/Lightbox';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { screenshotAnchor, screenshotStepOf } from '@/lib/screenshots';
import type { ScreenshotView } from '@/lib/views';

export type ScreenshotGalleryProps = {
  /** In the order of the steps; the last one is shown large first. */
  screenshots: ScreenshotView[];
};

const caption = ({ step, title }: ScreenshotView) => `Schritt ${step} · ${title}`;

/** A plain click; with Ctrl, Shift or the middle button the browser opens the link itself. */
const plainClick = (
  event: { button: number } & Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
) => event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

/**
 * The screenshots of a run: one large in a browser frame, all of them small below. A click on a
 * thumbnail shows it large, a click on the large one opens the lightbox. Links to
 * `#bildschirmfoto-<step>` anywhere on the page (the step list) open it at that step. Without
 * JavaScript the links still lead to the pictures.
 */
export function ScreenshotGallery({ screenshots }: ScreenshotGalleryProps) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const found = screenshots.findIndex((shot) => shot.step === selectedStep);
  const selected = found === -1 ? screenshots.length - 1 : found;
  const current = screenshots[selected];
  const several = screenshots.length > 1;

  const openStep = useEffectEvent((step: number) => {
    if (!screenshots.some((shot) => shot.step === step)) return false;
    setSelectedStep(step);
    setZoomed(true);
    return true;
  });

  // The links of the step list are anchors on the thumbnails; with JavaScript they open the lightbox.
  useEffect(() => {
    const onClick = (event: globalThis.MouseEvent) => {
      if (!plainClick(event) || !(event.target instanceof Element)) return;
      const link = event.target.closest('a[href^="#"]');
      const step = screenshotStepOf(link?.getAttribute('href') ?? '');
      if (step !== null && openStep(step)) event.preventDefault();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (!current) return null;

  return (
    <Card
      title={several ? 'Bildschirmfotos' : 'Bildschirmfoto'}
      aside={
        several ? (
          <span className="shrink-0 text-meta text-text-muted">
            {plural(screenshots.length, 'Bild', 'Bilder')}
          </span>
        ) : undefined
      }
    >
      <figure
        id={several ? undefined : screenshotAnchor(current.step)}
        className="flex flex-col gap-2"
      >
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          aria-haspopup="dialog"
          onClick={(event) => {
            if (!plainClick(event)) return;
            event.preventDefault();
            setZoomed(true);
          }}
          className="group relative block overflow-hidden rounded-input border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          <img
            src={current.url}
            alt={`${caption(current)}, vergrößern`}
            className="block h-auto max-h-160 w-full bg-subtle object-contain"
          />
          <span
            aria-hidden="true"
            className="absolute top-10 right-2 flex size-8 items-center justify-center rounded-full bg-sidebar text-surface opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <Icon name="expand" size={16} />
          </span>
        </a>
        <figcaption className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-meta font-medium text-text">{caption(current)}</span>
          {several && (
            <span className="shrink-0 text-small text-text-muted tabular-nums">
              {selected + 1} / {screenshots.length}
            </span>
          )}
        </figcaption>
      </figure>

      {several && (
        <ul
          aria-label="Alle Bildschirmfotos"
          className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-4"
        >
          {screenshots.map((shot, index) => {
            const active = index === selected;
            return (
              <li key={shot.step} id={screenshotAnchor(shot.step)}>
                <a
                  href={shot.url}
                  aria-current={active ? 'true' : undefined}
                  onClick={(event) => {
                    if (!plainClick(event)) return;
                    event.preventDefault();
                    setSelectedStep(shot.step);
                  }}
                  className={cn(
                    'relative block overflow-hidden rounded-input border bg-subtle transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    active
                      ? 'border-primary ring-2 ring-primary'
                      : 'border-border hover:border-border-strong',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.url}
                    alt={caption(shot)}
                    loading="lazy"
                    className="block aspect-8/5 w-full object-cover object-top"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1 rounded-chip bg-sidebar px-1.5 font-mono text-label text-surface"
                  >
                    {shot.step}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <Lightbox
        images={screenshots.map((shot) => ({
          url: shot.url,
          alt: `Bildschirmfoto von Schritt ${shot.step}: ${shot.title}`,
          caption: caption(shot),
        }))}
        index={zoomed ? selected : null}
        onIndexChange={(index) => {
          const shot = screenshots[index];
          if (shot) setSelectedStep(shot.step);
        }}
        onClose={() => setZoomed(false)}
      />
    </Card>
  );
}
