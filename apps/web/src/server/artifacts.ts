import 'server-only';
import { isAbsolute, relative, resolve } from 'node:path';

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
