// @vitest-environment node
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { artifactsDir, resolveArtifact } from './artifacts';

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
