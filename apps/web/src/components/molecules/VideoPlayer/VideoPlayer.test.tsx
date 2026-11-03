import { render } from '@testing-library/react';
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
});
