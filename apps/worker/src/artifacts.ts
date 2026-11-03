import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { encodeVideo, type Recording } from './video';

export type ArtifactStore = {
  /** Stores a PNG and returns its path relative to the store root (saved in run_steps). */
  saveScreenshot(runId: string, stepIndex: number, stepId: string, image: Buffer): Promise<string>;
  /** Encodes a recorded run as MP4 next to its screenshots; returns its path like saveScreenshot. */
  saveVideo(runId: string, recording: Recording): Promise<string>;
  /** Removes a stored file by the path the store returned, e.g. an expired video. */
  remove(path: string): Promise<void>;
};

/** Step ids come from user-defined flows; only letters, digits, - and _ reach the file system. */
function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function createFileArtifactStore(root: string): ArtifactStore {
  return {
    async saveScreenshot(runId, stepIndex, stepId, image) {
      const folder = ['runs', safeName(runId)];
      const file = `${stepIndex}-${safeName(stepId)}.png`;
      await mkdir(join(root, ...folder), { recursive: true });
      await writeFile(join(root, ...folder, file), image);
      return [...folder, file].join('/');
    },

    async saveVideo(runId, recording) {
      const folder = ['runs', safeName(runId)];
      await mkdir(join(root, ...folder), { recursive: true });
      await encodeVideo(recording, join(root, ...folder, 'video.mp4'));
      return [...folder, 'video.mp4'].join('/');
    },

    async remove(path) {
      const file = resolve(root, path);
      const inside = relative(resolve(root), file);
      // Only below the store: a path from the database never reaches anything else.
      if (!inside || inside.startsWith('..') || isAbsolute(inside)) return;
      await rm(file, { force: true });
    },
  };
}
