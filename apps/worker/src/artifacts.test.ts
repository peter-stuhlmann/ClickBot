import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileArtifactStore } from './artifacts';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'click-bot-artifacts-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('createFileArtifactStore', () => {
  it('stores a screenshot under the run and returns its path relative to the root', async () => {
    const store = createFileArtifactStore(root);
    const path = await store.saveScreenshot('run-1', 2, 'send', Buffer.from('png-bytes'));

    expect(path).toBe('runs/run-1/2-send.png');
    expect(await readFile(join(root, path), 'utf8')).toBe('png-bytes');
  });

  it('turns step ids into safe file names, so a step cannot write outside its folder', async () => {
    const store = createFileArtifactStore(root);
    expect(await store.saveScreenshot('run-1', 0, '../../etc/passwd', Buffer.from('x'))).toBe(
      'runs/run-1/0-______etc_passwd.png',
    );
  });

  it('keeps steps with the same id apart by their position', async () => {
    const store = createFileArtifactStore(root);
    const a = await store.saveScreenshot('run-1', 0, 'shot', Buffer.from('a'));
    const b = await store.saveScreenshot('run-1', 3, 'shot', Buffer.from('b'));
    expect(a).not.toBe(b);
  });

  it('removes a stored file by its path, and nothing outside the store', async () => {
    const store = createFileArtifactStore(root);
    const path = await store.saveScreenshot('run-1', 0, 'shot', Buffer.from('a'));
    const outside = join(root, '..', `draussen-${Date.now()}.txt`);
    await writeFile(outside, 'bleibt');

    await store.remove(path);
    await store.remove(`../${basename(outside)}`);
    await store.remove('');
    expect(existsSync(join(root, path))).toBe(false);
    expect(existsSync(outside)).toBe(true);
    await rm(outside);
  });
});
