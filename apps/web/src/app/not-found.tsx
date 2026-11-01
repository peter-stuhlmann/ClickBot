import type { Metadata } from 'next';
import { Button } from '@/components/atoms/Button';

export const metadata: Metadata = { title: 'Nicht gefunden · Click-Bot' };

/** An address outside the app, e.g. a typo; also for visitors who are not signed in. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <h1 className="text-h1 font-semibold text-text">Nicht gefunden</h1>
      <p className="max-w-md text-body text-text-muted">
        Diese Seite gibt es nicht. Vielleicht stimmt der Link nicht mehr.
      </p>
      <Button href="/">Zur Startseite</Button>
    </main>
  );
}
