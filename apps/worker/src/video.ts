import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VideoCue } from '@click-bot/db';
import ffmpegStatic from 'ffmpeg-static';
import type { WatchedRun } from './run-watch';
import { streamRun } from './watch-stream';

/** At most ten pictures a second: smooth enough to follow a run, small enough to keep. */
const MIN_FRAME_GAP_MS = 100;
/** A longer run is recorded up to here. */
const MAX_VIDEO_MS = 30 * 60_000;
/** The last picture stays this long, so the end of the run can be seen. */
const LAST_FRAME_MS = 1_500;
/** Larger pictures (a phone at three device pixels per point) are scaled down to this side. */
const MAX_SIDE = 1280;

/** The pictures of a run in a temporary folder, and when each step ran (ms from the start). */
export type Recording = {
  dir: string;
  frames: { file: string; at: number }[];
  cues: VideoCue[];
  durationMs: number;
};

export type VideoRecorder = {
  /** What is recorded so far, e.g. for tests. */
  peek(): { frames: number; hidden: boolean };
  /** Ends the recording; null if not a single picture came. */
  stop(): Promise<Recording | null>;
};

/** ffmpeg with H.264: FFMPEG_PATH, otherwise the binary of the ffmpeg-static package. */
export function ffmpegBinary(): string {
  const binary = process.env.FFMPEG_PATH || ffmpegStatic;
  if (!binary) throw new Error('ffmpeg fehlt: FFMPEG_PATH setzen.');
  return binary;
}

/** Width and height from the frame header (SOF) of a JPEG, or null for anything else. */
export function jpegSize(image: Buffer): { width: number; height: number } | null {
  if (image[0] !== 0xff || image[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 <= image.length) {
    if (image[at] !== 0xff) return null;
    const marker = image[at + 1] ?? 0;
    // SOF0–SOF15, without DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: image.readUInt16BE(at + 5), width: image.readUInt16BE(at + 7) };
    }
    at += 2 + image.readUInt16BE(at + 2);
  }
  return null;
}

/**
 * Records a running run as pictures, from the same stream as "Live zuschauen": the pages blur
 * secrets, and a picture that could show one in the clear never comes (product rule). Such a time
 * becomes a cue without a step ("Ausgeblendet"); the video shows the last clean picture meanwhile.
 */
export async function recordRun(
  run: WatchedRun,
  clock: () => number = () => performance.now(),
): Promise<VideoRecorder> {
  const dir = await mkdtemp(join(tmpdir(), 'click-bot-video-'));
  const start = clock();
  const elapsed = () => Math.round(clock() - start);
  const frames: Recording['frames'] = [];
  const cues: VideoCue[] = [];
  const open = new Map<number | null, number>();
  let lastAt = -Infinity;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = Promise.resolve();
  let done = false;

  const keep = (data: string, at: number) => {
    const file = `${String(frames.length).padStart(6, '0')}.jpg`;
    frames.push({ file, at });
    lastAt = at;
    writing = writing.then(() => writeFile(join(dir, file), Buffer.from(data, 'base64')));
  };
  /** The newest picture within a tenth goes in when the tenth is over. */
  const frame = (data: string) => {
    const at = elapsed();
    if (done || at > MAX_VIDEO_MS) return;
    clearTimeout(timer);
    if (at - lastAt >= MIN_FRAME_GAP_MS) {
      pending = null;
      return keep(data, at);
    }
    pending = data;
    timer = setTimeout(
      () => {
        if (pending === null || done) return;
        keep(pending, lastAt + MIN_FRAME_GAP_MS);
        pending = null;
      },
      lastAt + MIN_FRAME_GAP_MS - at,
    );
  };
  const close = (key: number | null, at: number) => {
    const from = open.get(key);
    if (from === undefined) return;
    cues.push({ step: key, from, to: at });
    open.delete(key);
  };

  const stopStream = streamRun(run, (message) => {
    if (done) return;
    switch (message.type) {
      case 'frame':
        close(null, elapsed());
        return frame(message.data);
      case 'hidden':
        if (!open.has(null)) open.set(null, elapsed());
        return;
      case 'step':
        if (message.status === 'running') open.set(message.index, elapsed());
        else close(message.index, elapsed());
        return;
      default:
        return;
    }
  });

  return {
    peek: () => ({ frames: frames.length, hidden: open.has(null) }),

    async stop() {
      const end = elapsed();
      done = true;
      clearTimeout(timer);
      await stopStream();
      if (pending !== null) keep(pending, Math.min(end, lastAt + MIN_FRAME_GAP_MS));
      for (const key of [...open.keys()]) close(key, end);
      await writing;
      if (frames.length === 0) {
        await rm(dir, { recursive: true, force: true });
        return null;
      }
      cues.sort((a, b) => a.from - b.from);
      return { dir, frames, cues, durationMs: Math.max(end, lastAt) + LAST_FRAME_MS };
    },
  };
}

const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', (chunk: Buffer) => (errors += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg: ${errors.trim().split('\n')[0] || `Exit-Code ${code}`}`)),
    );
  });
}

/**
 * Writes the recording as an MP4 (H.264, plays everywhere, also on phones) to `file` and
 * removes its pictures. Each picture stays until the next one; the size is the first picture's,
 * at most MAX_SIDE, so a picture of another size is fitted in.
 */
export async function encodeVideo(recording: Recording, file: string): Promise<void> {
  try {
    const { dir, frames, durationMs } = recording;
    const first = frames[0];
    if (!first) throw new Error('Keine Bilder.');
    const size = jpegSize(await readFile(join(dir, first.file))) ?? { width: 1280, height: 800 };
    const scale = Math.min(1, MAX_SIDE / Math.max(size.width, size.height));
    const width = even(size.width * scale);
    const height = even(size.height * scale);

    // The concat demuxer: each picture with how long it stays, the last one named twice.
    const lines = frames.flatMap((frame, index) => {
      const from = index === 0 ? 0 : frame.at;
      const to = frames[index + 1]?.at ?? durationMs;
      return [`file '${frame.file}'`, `duration ${(Math.max(1, to - from) / 1000).toFixed(3)}`];
    });
    lines.push(`file '${frames.at(-1)?.file ?? first.file}'`);
    const list = join(dir, 'frames.txt');
    await writeFile(list, `${lines.join('\n')}\n`);

    await runFfmpeg([
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-vf',
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p`,
      '-fps_mode',
      'vfr',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '28',
      '-movflags',
      '+faststart',
      file,
    ]);
  } finally {
    await rm(recording.dir, { recursive: true, force: true });
  }
}
