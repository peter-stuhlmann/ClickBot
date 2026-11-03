import 'server-only';
import { rm } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

// Letters, digits, "-", "_" and dots, but no leading dot: no "..", no hidden files.
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

/** Folder the worker writes screenshots to (next.config.ts sets the default). */
export function artifactsDir(): string {
  const dir = process.env.ARTIFACTS_DIR;
  if (!dir) throw new Error('ARTIFACTS_DIR fehlt (siehe .env.example).');
  return resolve(dir);
}

const TYPES = { '.png': 'image/png', '.mp4': 'video/mp4' } as const;

/** The media type of a file `resolveArtifact` found: a screenshot or the video of a run. */
export function artifactType(file: string): (typeof TYPES)[keyof typeof TYPES] {
  return file.endsWith('.mp4') ? TYPES['.mp4'] : TYPES['.png'];
}

/**
 * Absolute path of a stored screenshot or video from URL segments, or null for anything that is
 * not a PNG or MP4 below `root`. The URL is user input: this is the only way from a request to
 * the disk.
 */
export function resolveArtifact(root: string, segments: string[]): string | null {
  if (segments.length === 0 || !segments.every((segment) => SEGMENT.test(segment))) return null;
  const name = segments.at(-1) ?? '';
  if (!Object.keys(TYPES).some((extension) => name.endsWith(extension))) return null;
  const file = resolve(root, ...segments);
  const inside = relative(resolve(root), file);
  return inside && !inside.startsWith('..') && !isAbsolute(inside) ? file : null;
}

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Removes the screenshot folders of deleted runs (runs/<id>, as the worker stores them). Only
 * well-formed run ids are used, so no other path below or above `root` can be reached.
 */
export async function removeRunArtifacts(root: string, runIds: string[]): Promise<void> {
  await Promise.all(
    runIds
      .filter((id) => RUN_ID.test(id))
      .map((id) => rm(join(resolve(root), 'runs', id), { recursive: true, force: true })),
  );
}

/**
 * The part of a file a Range header asks for (one range, as browsers ask for videos), inclusive;
 * null without a header, 'invalid' for one that cannot be served (416).
 */
export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'invalid' | null {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  const [, from = '', to = ''] = match;
  if (from === '') {
    const last = Number(to);
    if (last === 0) return 'invalid';
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  const start = Number(from);
  const end = to === '' ? size - 1 : Math.min(Number(to), size - 1);
  if (start >= size || end < start) return 'invalid';
  return { start, end };
}
