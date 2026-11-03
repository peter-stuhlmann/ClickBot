import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useBrowser } from '../test/browser';
import { concealSecrets } from './conceal';
import { createRunWatchRegistry, type RunTap } from './run-watch';
import { encodeVideo, ffmpegBinary, jpegSize, recordRun, type Recording } from './video';

const SLOW = { timeout: 15_000 };

/** What ffmpeg itself reads from a file: the video stream and the duration in seconds. */
async function probe(file: string): Promise<{ video: string; seconds: number }> {
  // `ffmpeg -i` without an output exits with 1 and describes the input on stderr.
  const result = await promisify(execFile)(ffmpegBinary(), ['-hide_banner', '-i', file]).catch(
    (error: { stderr: string }) => error,
  );
  const text = result.stderr;
  const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  return {
    video: /Video: (\S+)/.exec(text)?.[1] ?? '',
    seconds: duration
      ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
      : 0,
  };
}

describe('jpegSize', () => {
  it('reads width and height from the frame header, and nothing from other data', () => {
    // SOI, an APP0 segment of 4 bytes, then SOF0: precision 8, height 2, width 3.
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02,
      0x00, 0x03, 0x01, 0x01, 0x11, 0x00,
    ]);
    expect(jpegSize(jpeg)).toEqual({ width: 3, height: 2 });
    expect(jpegSize(Buffer.from('kein Bild'))).toBeNull();
    expect(jpegSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBeNull();
  });
});

describe('recordRun', () => {
  const browser = useBrowser();
  let out: string;

  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'click-bot-video-test-'));
  });
  afterAll(async () => {
    await rm(out, { recursive: true, force: true });
  });

  async function watched(secrets: string[] = []): Promise<{
    page: Page;
    tap: RunTap;
    close: () => Promise<void>;
    run: ReturnType<ReturnType<typeof createRunWatchRegistry>['find']>;
  }> {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    await concealSecrets(context, secrets);
    const page = await context.newPage();
    await page.goto(`${browser.origin()}/lang.html`);
    const runs = createRunWatchRegistry();
    const tap = runs.start('run-1', { engine: 'chromium', secrets, total: 2 });
    tap.page(page);
    return { page, tap, run: runs.find('run-1'), close: () => context.close() };
  }

  it('records a run as an MP4, and when each step ran', SLOW, async () => {
    const { page, tap, run, close } = await watched();
    if (!run) throw new Error('Kein Lauf.');
    const recorder = await recordRun(run);
    const framesAfter = async (count: number) =>
      expect.poll(() => recorder.peek().frames, SLOW).toBeGreaterThan(count);
    tap.step(0, 'running');
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
    await framesAfter(0);
    tap.step(0, 'passed');
    tap.step(1, 'running');
    const shown = recorder.peek().frames;
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
    await framesAfter(shown);
    tap.step(1, 'failed');
    const recording = (await recorder.stop()) as Recording;
    await close();

    expect(recording.frames.length).toBeGreaterThan(1);
    expect(recording.cues.map((cue) => cue.step)).toEqual([0, 1]);
    const [first, second] = recording.cues;
    expect(first && second && first.from <= first.to && first.to <= second.from).toBe(true);

    const file = join(out, 'video.mp4');
    await encodeVideo(recording, file);
    const { video, seconds } = await probe(file);
    expect(video).toBe('h264');
    // The last picture stays a moment, so the end can be seen.
    expect(seconds).toBeGreaterThan(1);
    expect((await stat(file)).size).toBeGreaterThan(1_000);
    // The frames were only needed for the encoding.
    await expect(stat(recording.dir)).rejects.toThrow();
  });

  it('takes at most 10 pictures a second, the newest of each tenth', SLOW, async () => {
    const { page, run, close } = await watched();
    if (!run) throw new Error('Kein Lauf.');
    const recorder = await recordRun(run);
    // Scrolling paints a new frame every animation frame, about 60 a second.
    for (let y = 0; recorder.peek().frames < 5 && y < 20_000; y += 20) {
      await page.evaluate((top) => window.scrollTo({ top: top % 2500, behavior: 'instant' }), y);
    }
    const recording = (await recorder.stop()) as Recording;
    await close();
    const gaps = recording.frames
      .slice(1)
      .map((frame, index) => frame.at - (recording.frames[index]?.at ?? 0));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(99);
    await rm(recording.dir, { recursive: true, force: true });
  });

  it('marks the time a secret was in the clear, and has no picture of it', SLOW, async () => {
    const { page, run, close } = await watched(['geheim-123']);
    if (!run) throw new Error('Kein Lauf.');
    const recorder = await recordRun(run);
    await expect.poll(() => recorder.peek().frames, SLOW).toBeGreaterThan(0);
    await page.evaluate(() => {
      const split = document.createElement('p');
      split.id = 'getrennt';
      split.innerHTML = '<b>geheim</b>-123';
      document.body.prepend(split);
    });
    await expect.poll(() => recorder.peek().hidden, SLOW).toBe(true);
    const shown = recorder.peek().frames;
    await page.evaluate(() => document.querySelector('#getrennt')?.remove());
    await expect.poll(() => recorder.peek().frames, SLOW).toBeGreaterThan(shown);
    const recording = (await recorder.stop()) as Recording;
    await close();

    const hidden = recording.cues.filter((cue) => cue.step === null);
    expect(hidden).toHaveLength(1);
    const [span] = hidden;
    // No picture from the time it was in the clear.
    expect(recording.frames.filter((f) => span && f.at > span.from && f.at < span.to)).toEqual([]);
    await rm(recording.dir, { recursive: true, force: true });
  });

  it('has nothing to encode for a run without a single picture', async () => {
    const runs = createRunWatchRegistry();
    runs.start('run-2', { engine: 'chromium', secrets: [], total: 1 });
    const recorder = await recordRun(
      runs.find('run-2') as NonNullable<ReturnType<typeof runs.find>>,
    );
    expect(await recorder.stop()).toBeNull();
  });
});
