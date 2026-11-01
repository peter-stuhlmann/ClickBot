/** The sections of the sidebar; 'profil' marks the user card at the bottom instead. */
export type NavKey = 'jobs' | 'laeufe' | 'kalender' | 'kampagnen' | 'vorlagen' | 'einstellungen';

// First path segment → section. Projects are edited from "Kampagnen", so they count as that.
const SECTIONS: Record<string, NavKey | 'profil'> = {
  '': 'jobs',
  jobs: 'jobs',
  laeufe: 'laeufe',
  kalender: 'kalender',
  kampagnen: 'kampagnen',
  projekte: 'kampagnen',
  vorlagen: 'vorlagen',
  einstellungen: 'einstellungen',
  profil: 'profil',
};

/** The section a page belongs to, from its path; null for a path outside the app. */
export function navKeyFor(pathname: string): NavKey | 'profil' | null {
  if (!pathname.startsWith('/')) return null;
  const [first = ''] = pathname.slice(1).split(/[/?#]/);
  return SECTIONS[first] ?? null;
}
