'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type VideoPlayerProps = {
  url: string;
  /** WebVTT with the step that ran at each moment. */
  captionsUrl: string;
};

type Size = { width: number; height: number };

/**
 * The video of a run with the browser's controls, the steps as captions (on by default). The
 * frame takes the shape of the video: 16:9 for a desktop run, 9:16 (narrower) for a phone. Until
 * the video says how big it is, the frame is 16:9.
 */
export function VideoPlayer({ url, captionsUrl }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState<Size | null>(null);

  function measure(video: HTMLVideoElement) {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setSize({ width: video.videoWidth, height: video.videoHeight });
    }
  }

  // The metadata may arrive before React has attached the handler.
  useEffect(() => {
    if (ref.current && ref.current.readyState >= 1) measure(ref.current);
  }, []);

  const portrait = size !== null && size.height > size.width;

  return (
    <video
      ref={ref}
      src={url}
      controls
      preload="metadata"
      playsInline
      onLoadedMetadata={(event) => measure(event.currentTarget)}
      style={size ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
      className={cn(
        'block w-full rounded-input border border-border bg-subtle',
        size ? '' : 'aspect-video',
        portrait && 'mx-auto max-w-sm',
      )}
    >
      <track kind="captions" src={captionsUrl} srcLang="de" label="Schritte" default />
    </video>
  );
}
