import { describe, expect, it } from 'vitest';
import { navKeyFor } from './navigation';

describe('navKeyFor', () => {
  it('marks "Tests" on the start page, the wizard and the editor', () => {
    expect(navKeyFor('/')).toBe('jobs');
    expect(navKeyFor('/jobs/neu')).toBe('jobs');
    expect(navKeyFor('/jobs/9e7aeb1d-0000-4000-8000-000000000000')).toBe('jobs');
  });

  it('marks the section of every page below it', () => {
    expect(navKeyFor('/laeufe')).toBe('laeufe');
    expect(navKeyFor('/laeufe/abc')).toBe('laeufe');
    expect(navKeyFor('/kalender?woche=2026-11-02')).toBe('kalender');
    expect(navKeyFor('/vorlagen/neu')).toBe('vorlagen');
    expect(navKeyFor('/einstellungen/ki')).toBe('einstellungen');
  });

  it('counts projects as part of "Kampagnen", where they are edited', () => {
    expect(navKeyFor('/kampagnen')).toBe('kampagnen');
    expect(navKeyFor('/kampagnen/neu')).toBe('kampagnen');
    expect(navKeyFor('/projekte/neu')).toBe('kampagnen');
    expect(navKeyFor('/projekte/abc')).toBe('kampagnen');
  });

  it('marks the user card on the profile page', () => {
    expect(navKeyFor('/profil')).toBe('profil');
  });

  it('marks nothing on an unknown page', () => {
    expect(navKeyFor('/irgendwas')).toBeNull();
    expect(navKeyFor('')).toBeNull();
  });
});
