import { createDb } from './client';
import { seedDemoData } from './seed';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL fehlt (siehe .env.example).');
  process.exit(1);
}

const connection = createDb(url);
try {
  const seeded = await seedDemoData(connection.db, new Date());
  process.stdout.write(
    seeded
      ? 'Demo-Daten angelegt.\n'
      : 'Datenbank enthält schon Daten – nichts geändert. Zum Zurücksetzen: pnpm db:reset\n',
  );
} finally {
  await connection.close();
}
