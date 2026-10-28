import { afterAll, beforeEach } from 'vitest';
import { resetDb, testConnection } from './db';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await testConnection.close();
});
