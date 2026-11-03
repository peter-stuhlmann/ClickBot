// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  artifactType,
  artifactsDir,
  byteRange,
  removeRunArtifacts,
  resolveArtifact,
} from './artifacts';

const root = resolve('/srv/click-bot/artifacts');

describe('resolveArtifact', () => {
  it('finds a stored screenshot below the root', () => {
    expect(resolveArtifact(root, ['runs', 'abc-123', '1-send.png'])).toBe(
      join(root, 'runs', 'abc-123', '1-send.png'),
    );
  });

  it('finds the video of a run, and knows its type', () => {
    const file = resolveArtifact(root, ['runs', 'abc-123', 'video.mp4']);
    expect(file).toBe(join(root, 'runs', 'abc-123', 'video.mp4'));
    expect(artifactType(file ?? '')).toBe('video/mp4');
    expect(artifactType(join(root, 'runs', 'abc-123', '1-send.png'))).toBe('image/png');
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

describe('byteRange', () => {
  it('sends the whole file without a Range header', () => {
    expect(byteRange(null, 1_000)).toBeNull();
  });

  it.each([
    ['bytes=0-99', { start: 0, end: 99 }],
    ['bytes=900-', { start: 900, end: 999 }],
    // The last 100 bytes, which Safari asks for.
    ['bytes=-100', { start: 900, end: 999 }],
    // Past the end is cut to the end.
    ['bytes=500-5000', { start: 500, end: 999 }],
  ])('reads %s', (header, range) => {
    expect(byteRange(header, 1_000)).toEqual(range);
  });

  it.each(['bytes=1000-', 'bytes=50-10', 'bytes=0-1,5-9', 'items=0-1', 'bytes=-0', 'bytes=x-'])(
    'refuses %s',
    (header) => {
      expect(byteRange(header, 1_000)).toBe('invalid');
    },
  );
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
