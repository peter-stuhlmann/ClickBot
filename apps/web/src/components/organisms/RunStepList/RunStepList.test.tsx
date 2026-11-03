import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunStepList } from './RunStepList';

describe('RunStepList', () => {
  it('lists the steps in order under a summary', () => {
    render(
      <RunStepList
        summary="2 Schritte · 1,8 s"
        steps={[
          {
            number: 1,
            status: 'passed',
            title: 'Öffne beispiel.de',
            detail: '',
            duration: '1,2 s',
            screenshotHref: null,
          },
          {
            number: 2,
            status: 'failed',
            title: 'Klicke auf „Absenden“',
            detail: 'Element nicht gefunden.',
            duration: '0,6 s',
            screenshotHref: null,
          },
        ]}
      />,
    );
    const card = within(screen.getByRole('region', { name: 'Ablauf' }));
    expect(card.getByText('2 Schritte · 1,8 s')).toBeVisible();
    expect(card.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Öffne beispiel.de'),
      expect.stringContaining('Klicke auf „Absenden“'),
    ]);
  });
});
