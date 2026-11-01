import type { ReactNode } from 'react';
import { AppShell } from '@/components/templates/AppShell';
import { getDb } from '@/server/db';
import { getShell } from '@/server/shell';
import { selectProjectAction } from '@/app/actions';

/**
 * The sidebar around every page of the app. As a layout it stays on screen while a page
 * loads, and a click in the sidebar answers at once with loading.tsx. The pages read
 * `getShell` too; React's cache gives them the same result within one request.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const shell = await getShell(getDb());
  return (
    <AppShell {...shell} selectProject={selectProjectAction}>
      {children}
    </AppShell>
  );
}
