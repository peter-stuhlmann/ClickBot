// @vitest-environment node
import type { DbConnection } from '@click-bot/db';
import { describe, expect, it, vi } from 'vitest';
import { connectionFor } from './db';

function fakeConnection(): DbConnection {
  return { db: {}, pool: {}, close: vi.fn(async () => {}) } as unknown as DbConnection;
}

describe('connectionFor', () => {
  it('reuses one connection while the schema stays the same', () => {
    const slot = {};
    const schema = {};
    const create = vi.fn(fakeConnection);

    const first = connectionFor(slot, schema, create);
    expect(connectionFor(slot, schema, create)).toBe(first);
    expect(create).toHaveBeenCalledOnce();
  });

  it('opens a new connection when the schema module was reloaded, and closes the old one', () => {
    // In development Next reloads @click-bot/db after a change: a connection made with the old
    // schema would not know new columns (e.g. jobs.analytics_marking) and return undefined.
    const slot = {};
    const create = vi.fn(fakeConnection);
    const old = connectionFor(slot, { version: 1 }, create);

    const fresh = connectionFor(slot, { version: 2 }, create);

    expect(fresh).not.toBe(old);
    expect(old.close).toHaveBeenCalledOnce();
    expect(connectionFor(slot, { version: 2 }, create)).not.toBe(old);
  });
});
