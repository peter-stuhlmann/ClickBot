import 'server-only';
import { getWorkerStatus, listCustomers, type CustomerOption, type Database } from '@click-bot/db';
import { cookies } from 'next/headers';
import { getCurrentUser } from './session';

/** The project the user chose in the sidebar; per browser, like the language of a shop. */
export const PROJECT_COOKIE = 'clickbot_project';

/** The chosen project if it still exists, else the first by name; null without projects. */
export function pickProject(
  projects: CustomerOption[],
  chosen: string | undefined,
): CustomerOption | null {
  return projects.find((project) => project.id === chosen) ?? projects[0] ?? null;
}

// Matches no project: without a current project the pages show nothing instead of everything.
const NO_PROJECT = '00000000-0000-0000-0000-000000000000';

/** Restricts lists and figures to the current project. */
export function projectScope(project: CustomerOption | null): { customerId: string } {
  return { customerId: project?.id ?? NO_PROJECT };
}

/** What every page with the sidebar needs: user, worker, projects and the current project. */
export async function getShell(db: Database, now: Date) {
  // Auth first: nothing is read for someone who is not signed in.
  const user = await getCurrentUser();
  const [projects, worker, store] = await Promise.all([
    listCustomers(db),
    getWorkerStatus(db, now),
    cookies(),
  ]);
  return {
    user,
    worker,
    projects,
    project: pickProject(projects, store.get(PROJECT_COOKIE)?.value),
  };
}
