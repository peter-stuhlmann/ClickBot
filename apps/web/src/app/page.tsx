import { Button } from '@/components/atoms/Button';

// Placeholder until the AppShell template and the jobs overview exist.
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-start gap-4 p-10">
      <h1 className="text-h1 font-semibold">Click-Bot</h1>
      <p className="text-text-muted">Das Grundgerüst läuft. Die Screens folgen.</p>
      <Button>+ Neuer Job</Button>
    </main>
  );
}
