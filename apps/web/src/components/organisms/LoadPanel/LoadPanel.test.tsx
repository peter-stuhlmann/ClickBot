import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LoadView } from '@/lib/views';
import { LoadPanel } from './LoadPanel';

const busy: LoadView = {
  title: 'Auslastung Do, 05.11.',
  summary: null,
  note: 'Das Testsystem hat 6 Browser.',
  overloads: [
    {
      key: 'a',
      title: '13:38 Uhr: 12 Durchläufe für 6 Browser',
      text: '6 Durchläufe warten in der Warteschlange.',
      suggestion: {
        title: 'Vorschlag: „Newsletter“ auf 13:39 verschieben',
        text: 'Dann laufen höchstens 6 von 6 Browsern gleichzeitig.',
        fields: { jobId: 'job-1', toTime: '13:39' },
      },
    },
  ],
};

describe('LoadPanel', () => {
  it('explains the overload and takes over the suggestion with one click', async () => {
    const user = userEvent.setup();
    const moveAction = vi.fn(async () => ({}));
    render(<LoadPanel {...busy} moveAction={moveAction} />);

    expect(screen.getByRole('region', { name: 'Auslastung Do, 05.11.' })).toHaveTextContent(
      '13:38 Uhr: 12 Durchläufe für 6 Browser',
    );
    expect(screen.getByText('Das Testsystem hat 6 Browser.')).toBeInTheDocument();
    const form = screen.getByRole('form', {
      name: 'Vorschlag: „Newsletter“ auf 13:39 verschieben',
    });
    expect(form).toHaveFormValues({ jobId: 'job-1', toTime: '13:39' });

    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(moveAction).toHaveBeenCalledOnce();
  });

  it('says why a suggestion could not be taken over', async () => {
    const user = userEvent.setup();
    const moveAction = vi.fn(async () => ({ error: 'Der Termin hat sich inzwischen geändert.' }));
    render(<LoadPanel {...busy} moveAction={moveAction} />);
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Termin hat sich inzwischen geändert.',
    );
  });

  it('shows how busy a quiet day gets, without suggestions', () => {
    render(
      <LoadPanel
        title="Auslastung Di, 03.11."
        summary="Keine Engpässe: höchstens 2 von 6 Browsern gleichzeitig belegt."
        overloads={busy.overloads.map((overload) => ({ ...overload, suggestion: null }))}
        note="Hinweis"
        moveAction={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Keine Engpässe: höchstens 2 von 6 Browsern gleichzeitig belegt.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).not.toBeInTheDocument();
  });
});
