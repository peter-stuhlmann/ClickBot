// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pickProject, projectScope } from './shell';

const projects = [
  { id: 'p1', name: 'Beispiel GmbH' },
  { id: 'p2', name: 'Müller Shop' },
];

describe('projectScope', () => {
  it('limits lists to the current project, and to nothing without one', () => {
    expect(projectScope(projects[0] ?? null)).toEqual({ customerId: 'p1' });
    expect(projectScope(null)).toEqual({ customerId: '00000000-0000-0000-0000-000000000000' });
  });
});

describe('pickProject', () => {
  it('keeps the project chosen last', () => {
    expect(pickProject(projects, 'p2')).toEqual(projects[1]);
  });

  it('falls back to the first project when none or a deleted one was chosen', () => {
    expect(pickProject(projects, undefined)).toEqual(projects[0]);
    expect(pickProject(projects, 'geloescht')).toEqual(projects[0]);
  });

  it('is null while there is no project', () => {
    expect(pickProject([], 'p1')).toBeNull();
  });
});
