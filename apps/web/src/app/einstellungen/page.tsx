import { redirect } from 'next/navigation';

/** "Einstellungen" opens on its first tab, the team. */
export default function SettingsPage() {
  redirect('/einstellungen/team');
}
