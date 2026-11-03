import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VideoPlayer } from './VideoPlayer';

describe('VideoPlayer', () => {
  it('plays the video with the steps as captions, shown by default', () => {
    const { container } = render(
      <VideoPlayer url="/artifacts/runs/r/video.mp4" captionsUrl="/laeufe/r/untertitel" />,
    );
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', '/artifacts/runs/r/video.mp4');
    expect(video).toHaveAttribute('controls');
    const track = video?.querySelector('track');
    expect(track).toHaveAttribute('src', '/laeufe/r/untertitel');
    expect(track).toHaveAttribute('kind', 'captions');
    expect(track).toHaveAttribute('default');
  });

  function videoOf(container: HTMLElement, width: number, height: number) {
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
    fireEvent.loadedMetadata(video);
    return video;
  }

  it('is 16:9 before the video says how big it is', () => {
    const { container } = render(<VideoPlayer url="/v.mp4" captionsUrl="/c" />);
    expect(container.querySelector('video')).toHaveClass('aspect-video');
  });

  it('takes the shape of a landscape video: full width, 16:9', () => {
    const { container } = render(<VideoPlayer url="/v.mp4" captionsUrl="/c" />);
    const video = videoOf(container, 1920, 1080);
    expect(video).toHaveStyle({ aspectRatio: '1920 / 1080' });
    expect(video).toHaveClass('w-full');
    expect(video).not.toHaveClass('max-w-sm');
  });

  it('takes the shape of a portrait video: 9:16, narrower and centred', () => {
    const { container } = render(<VideoPlayer url="/v.mp4" captionsUrl="/c" />);
    const video = videoOf(container, 1080, 1920);
    expect(video).toHaveStyle({ aspectRatio: '1080 / 1920' });
    expect(video).toHaveClass('max-w-sm', 'mx-auto');
  });
});
