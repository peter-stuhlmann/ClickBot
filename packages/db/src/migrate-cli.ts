import { createDb } from './client';
import { runMigrations } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL fehlt (siehe .env.example).');
  process.exit(1);
}

const connection = createDb(url);
try {
  await runMigrations(connection.db);
  process.stdout.write('Migrationen angewendet.\n');
} finally {
  await connection.close();
}
