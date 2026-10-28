import { fileURLToPath } from 'node:url';

/**
 * Fixed values for the e2e runs. The key exists only for the test database; the admin is created
 * by global-setup.ts, whose session the other specs use (storageState).
 */
export const E2E_SECRETS_KEY = Buffer.alloc(32, 7).toString('base64');

export const E2E_ADMIN = {
  name: 'E2E Admin',
  email: 'admin@e2e.test',
  password: 'e2e-sicheres-passwort-1',
};

export const STORAGE_STATE = fileURLToPath(new URL('./.auth/admin.json', import.meta.url));
/** E-mail, password and 2FA secret of the admin, for the login test. */
export const CREDENTIALS = fileURLToPath(new URL('./.auth/credentials.json', import.meta.url));
