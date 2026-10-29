import { otpauthUri, startTotpSetup } from '@click-bot/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { Button } from '@/components/atoms/Button';
import { TotpQr } from '@/components/molecules/TotpQr';
import { CodeForm } from '@/components/organisms/CodeForm';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { currentSession, nextAuthStep, sessionToken } from '@/server/auth';
import { getCipher } from '@/server/cipher';
import { getDb } from '@/server/db';
import { skipTotpSetupAction, totpSetupAction } from '../../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '2FA einrichten · Click-Bot' };

/** Set up the authenticator app: after the password (skippable) or later from the team page. */
export default async function TotpSetupPage() {
  const session = await currentSession();
  const token = await sessionToken();
  // Right after the password, or later from a signed-in account that skipped the setup.
  if (!session || session.hasTotp || !token) redirect(nextAuthStep(session));

  const setup = await startTotpSetup(getDb(), getCipher(), token, new Date());
  if (!setup) redirect('/anmelden');
  const qrDataUrl = await QRCode.toDataURL(otpauthUri(setup.secret, setup.email), {
    margin: 1,
    width: 176,
  });

  return (
    <AuthLayout
      title="2FA einrichten"
      description="Scanne den QR-Code mit einer Authenticator-App (z. B. Google Authenticator, 1Password oder Authy) und gib den Code ein, den sie anzeigt."
    >
      <TotpQr qrDataUrl={qrDataUrl} secret={setup.secret} />
      <CodeForm action={totpSetupAction} submitLabel="2FA aktivieren" />
      {session.complete ? (
        <Button variant="ghost" fullWidth href="/einstellungen/team">
          Abbrechen
        </Button>
      ) : (
        <form action={skipTotpSetupAction} className="flex flex-col gap-2">
          <Button type="submit" variant="ghost" fullWidth>
            Später einrichten
          </Button>
          <p className="text-center text-small text-text-muted">
            Ohne 2FA schützt nur dein Passwort das Konto. Click-Bot fragt bei jeder Anmeldung
            wieder.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
