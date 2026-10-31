import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('puts navigation and page content into their landmarks', () => {
    render(
      <AppShell
        active="jobs"
        worker={{ online: false, activeRuns: 0 }}
        user={null}
        projects={[]}
        project={null}
        selectProject={() => {}}
      >
        <h1>Tests</h1>
      </AppShell>,
    );
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Tests');
  });
});
