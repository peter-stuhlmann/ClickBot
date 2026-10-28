import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CodeForm } from '@/components/organisms/CodeForm';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { currentSession, nextAuthStep } from '@/server/auth';
import { loginCodeAction } from '../../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '2FA-Code · Click-Bot' };

/** Second step of the login: the code from the authenticator app. */
export default async function LoginCodePage() {
  const session = await currentSession();
  const step = nextAuthStep(session);
  if (step !== '/anmelden/code') redirect(step);

  return (
    <AuthLayout
      title="2FA-Code"
      description="Gib den 6-stelligen Code aus deiner Authenticator-App ein."
    >
      <CodeForm action={loginCodeAction} submitLabel="Anmelden" />
    </AuthLayout>
  );
}
