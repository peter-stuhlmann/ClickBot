import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { createRunWatchRegistry, type RunEvent } from './run-watch';

const page = { url: () => 'https://beispiel.de' } as unknown as Page;

describe('createRunWatchRegistry', () => {
  it('knows a run from its start to its end, with its page and its last step', () => {
    const runs = createRunWatchRegistry();
    const tap = runs.start('run-1', { engine: 'firefox', secrets: ['geheim', ''], total: 3 });
    const watched = runs.find('run-1');
    const events: RunEvent[] = [];
    watched?.subscribe((event) => events.push(event));

    tap.page(page);
    tap.step(0, 'running', true);
    tap.step(0, 'passed');
    expect(watched).toMatchObject({ runId: 'run-1', engine: 'firefox', secrets: ['geheim'] });
    expect(watched?.page()).toBe(page);
    expect(watched?.lastStep()).toEqual({
      type: 'step',
      index: 0,
      total: 3,
      status: 'passed',
      usesSecret: false,
    });

    tap.end('failed');
    expect(events.map((event) => [event.type, 'status' in event ? event.status : ''])).toEqual([
      ['page', ''],
      ['step', 'running'],
      ['step', 'passed'],
      ['end', 'failed'],
    ]);
    expect(runs.find('run-1')).toBeUndefined();
  });

  it('lets a watcher wait for a run that has not started yet, or stop waiting', async () => {
    const runs = createRunWatchRegistry();
    const waiting = runs.started('run-1');
    const leaving = new AbortController();
    let left = false;
    void runs.started('run-1', leaving.signal).then(() => (left = true));
    leaving.abort();

    runs.start('run-1', { engine: 'chromium', secrets: [], total: 1 });
    expect((await waiting).runId).toBe('run-1');
    expect(await runs.started('run-1')).toBe(runs.find('run-1'));
    await Promise.resolve();
    expect(left).toBe(false);
  });
});
