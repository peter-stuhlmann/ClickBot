import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsLayout } from './SettingsLayout';

describe('SettingsLayout', () => {
  it('shows header, tabs, content and the hint column in this order', () => {
    render(
      <SettingsLayout header={<h1>Einstellungen</h1>} tabs={<nav>Tabs</nav>} aside={<p>Hinweis</p>}>
        <p>Inhalt</p>
      </SettingsLayout>,
    );
    expect(document.body.textContent).toBe('EinstellungenTabsInhaltHinweis');
    expect(screen.getByRole('complementary', { name: 'Hinweise' })).toHaveTextContent('Hinweis');
  });

  it('leaves the hint column out when there are no hints', () => {
    render(
      <SettingsLayout header={<h1>Einstellungen</h1>} tabs={null}>
        <p>Inhalt</p>
      </SettingsLayout>,
    );
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
