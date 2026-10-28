import { createDb } from './client';
import { createInvitation } from './invitations';

/**
 * `pnpm auth:invite <email> [--admin]`: prints an invitation link. The way in on a new server, and
 * back in when the only admin lost password or phone (the link resets both).
 */
const url = process.env.DATABASE_URL;
const [email, flag] = process.argv.slice(2);
if (!url || !email) {
  console.error('Aufruf: pnpm auth:invite <email> [--admin]   (liest DATABASE_URL aus .env)');
  process.exit(1);
}

const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const connection = createDb(url);
try {
  const role = flag === '--admin' ? 'admin' : 'member';
  const { token } = await createInvitation(
    connection.db,
    { email, role, createdBy: null },
    new Date(),
  );
  const label = role === 'admin' ? 'Admin' : 'Mitglied';
  process.stdout.write(`Einladung für ${email} (${label}), 7 Tage gültig:\n`);
  process.stdout.write(`${appUrl}/einladung/${token}\n`);
} finally {
  await connection.close();
}
