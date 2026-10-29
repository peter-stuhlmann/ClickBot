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

/**
 * Absolute path of a stored screenshot from URL segments, or null for anything that is not a
 * PNG below `root`. The URL is user input: this is the only way from a request to the disk.
 */
export function resolveArtifact(root: string, segments: string[]): string | null {
  if (segments.length === 0 || !segments.every((segment) => SEGMENT.test(segment))) return null;
  if (!segments.at(-1)?.endsWith('.png')) return null;
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
