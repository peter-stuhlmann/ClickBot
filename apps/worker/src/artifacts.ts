import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ArtifactStore = {
  /** Stores a PNG and returns its path relative to the store root (saved in run_steps). */
  saveScreenshot(runId: string, stepIndex: number, stepId: string, image: Buffer): Promise<string>;
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
  };
}
