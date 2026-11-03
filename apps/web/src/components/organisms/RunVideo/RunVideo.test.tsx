import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunVideo } from './RunVideo';

describe('RunVideo', () => {
  it('plays the video with the steps as captions and offers it as a download', () => {
    const { container } = render(
      <RunVideo
        url="/artifacts/runs/r/video.mp4"
        captionsUrl="/laeufe/r/untertitel"
        fileName="kontakt-durchlauf-7.mp4"
      />,
    );
    expect(screen.getByRole('region', { name: 'Video' })).toBeVisible();
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', '/artifacts/runs/r/video.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video?.querySelector('track')).toHaveAttribute('src', '/laeufe/r/untertitel');

    const download = screen.getByRole('link', { name: 'Video herunterladen' });
    expect(download).toHaveAttribute('href', '/artifacts/runs/r/video.mp4');
    expect(download).toHaveAttribute('download', 'kontakt-durchlauf-7.mp4');
    expect(screen.getByText(/Zugangsdaten sind abgedeckt/)).toBeVisible();
  });
});
