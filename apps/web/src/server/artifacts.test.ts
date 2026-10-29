// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { artifactsDir, removeRunArtifacts, resolveArtifact } from './artifacts';

const root = resolve('/srv/click-bot/artifacts');

describe('resolveArtifact', () => {
  it('finds a stored screenshot below the root', () => {
    expect(resolveArtifact(root, ['runs', 'abc-123', '1-send.png'])).toBe(
      join(root, 'runs', 'abc-123', '1-send.png'),
    );
  });

  it.each([
    ['a parent directory', ['..', 'secrets.png']],
    ['a hidden file', ['runs', '.env.png']],
    ['a backslash path', ['runs\\..\\..\\x.png']],
    ['a drive letter', ['C:', 'x.png']],
    ['an empty path', []],
    ['another file type', ['runs', 'abc', 'notes.txt']],
    ['an empty segment', ['runs', '', 'x.png']],
  ])('refuses %s', (_case, segments) => {
    expect(resolveArtifact(root, segments)).toBeNull();
  });
});

describe('artifactsDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses ARTIFACTS_DIR', () => {
    vi.stubEnv('ARTIFACTS_DIR', '/srv/click-bot/artifacts');
    expect(artifactsDir()).toBe(root);
  });

  it('fails clearly without ARTIFACTS_DIR', () => {
    vi.stubEnv('ARTIFACTS_DIR', '');
    expect(() => artifactsDir()).toThrow('ARTIFACTS_DIR fehlt');
  });
});

describe('removeRunArtifacts', () => {
  const RUN = '2a31afe6-bde5-4531-bf34-6680d73d8862';
  const OTHER = '3d83b0ff-af56-441d-a6b7-56707fd501a3';

  it('removes the screenshots of deleted runs and nothing else', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'click-bot-artifacts-'));
    try {
      for (const run of [RUN, OTHER]) {
        await mkdir(join(dir, 'runs', run), { recursive: true });
        await writeFile(join(dir, 'runs', run, '1-send.png'), 'png');
      }
      await removeRunArtifacts(dir, [RUN, '../..', 'runs']);
      expect(existsSync(join(dir, 'runs', RUN))).toBe(false);
      expect(existsSync(join(dir, 'runs', OTHER, '1-send.png'))).toBe(true);
      expect(existsSync(dir)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not mind runs without screenshots', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'click-bot-artifacts-'));
    try {
      await expect(removeRunArtifacts(dir, [RUN])).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
