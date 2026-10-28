import { describe, expect, it, vi } from 'vitest';
import { createDb } from './client';

describe('createDb', () => {
  it('survives a dropped idle connection instead of crashing the process', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const connection = createDb('postgres://clickbot:clickbot@localhost:5443/clickbot_test');

    // pg emits this when the server closes an idle connection (e.g. database restart).
    expect(() => connection.pool.emit('error', new Error('terminating connection'))).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      'Datenbank-Verbindung unterbrochen, sie wird neu aufgebaut:',
      'terminating connection',
    );

    warn.mockRestore();
    await connection.close();
  });
});
