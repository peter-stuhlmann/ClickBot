import { redirect } from 'next/navigation';

/** "Einstellungen" has one page so far: the team. */
export default function SettingsPage() {
  redirect('/einstellungen/team');
}
