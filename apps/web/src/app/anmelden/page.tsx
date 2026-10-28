import { hasUsers } from '@click-bot/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/organisms/LoginForm';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { currentSession } from '@/server/auth';
import { getDb } from '@/server/db';
import { loginAction } from '../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Anmelden · Click-Bot' };

/** Screen 09 "Login". */
export default async function LoginPage() {
  if ((await currentSession())?.complete) redirect('/');
  // A new installation starts with the registration of the first admin.
  if (!(await hasUsers(getDb()))) redirect('/registrieren');

  return (
    <AuthLayout
      title="Anmelden"
      description="Willkommen zurück. Melde dich mit deinem Team-Konto an."
    >
      <LoginForm action={loginAction} />
      <p className="rounded-input bg-subtle px-3 py-2.5 text-small text-text-muted">
        Zugang nur auf Einladung – es gibt keine öffentliche Registrierung. Nach dem Passwort fragt
        Click-Bot nach deinem 2FA-Code. Passwort vergessen oder Handy verloren? Dein Admin schickt
        dir einen neuen Einladungslink.
      </p>
    </AuthLayout>
  );
}
