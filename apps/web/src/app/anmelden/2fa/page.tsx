import { otpauthUri, startTotpSetup } from '@click-bot/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { TotpQr } from '@/components/molecules/TotpQr';
import { CodeForm } from '@/components/organisms/CodeForm';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { currentSession, nextAuthStep, sessionToken } from '@/server/auth';
import { getCipher } from '@/server/cipher';
import { getDb } from '@/server/db';
import { totpSetupAction } from '../../auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '2FA einrichten · Click-Bot' };

/** First login: set up the authenticator app. 2FA is required for every account. */
export default async function TotpSetupPage() {
  const session = await currentSession();
  const step = nextAuthStep(session);
  const token = await sessionToken();
  if (step !== '/anmelden/2fa' || !token) redirect(step);

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
    </AuthLayout>
  );
}
