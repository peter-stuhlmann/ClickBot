import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AiFlowPanel, type AiFlowPanelProps } from './AiFlowPanel';

const suggestion: NonNullable<AiFlowPanelProps['suggestion']> = {
  steps: [
    { typeLabel: 'Öffnen', tone: 'neutral', title: 'Öffne beispiel.de/kontakt', detail: 'url' },
    { typeLabel: 'Klicken', tone: 'primary', title: 'Klicke auf „Absenden“', detail: 'role' },
  ],
  questions: [{ question: 'Welches Event?', options: ['generate_lead', 'form_submit'] }],
  facts: [{ label: 'Cookie-Banner', value: 'Usercentrics' }],
  notice: null,
};

function props(overrides: Partial<AiFlowPanelProps> = {}): AiFlowPanelProps {
  return {
    description: '',
    onDescriptionChange: vi.fn(),
    onGenerate: vi.fn(),
    generating: false,
    answers: {},
    onAnswer: vi.fn(),
    onAccept: vi.fn(),
    ...overrides,
  };
}

describe('AiFlowPanel', () => {
  it('asks for a description and sends it to the AI', async () => {
    const user = userEvent.setup();
    const onDescriptionChange = vi.fn();
    const onGenerate = vi.fn();
    render(<AiFlowPanel {...props({ onDescriptionChange, onGenerate })} />);

    await user.type(screen.getByRole('textbox', { name: 'Was soll der Bot tun?' }), 'K');
    expect(onDescriptionChange).toHaveBeenCalledWith('K');
    await user.click(screen.getByRole('button', { name: 'Vorschlag erzeugen' }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it('says that the page is opened once and nothing runs before the steps are taken over', () => {
    render(<AiFlowPanel {...props()} />);
    expect(
      screen.getByRole('textbox', { name: 'Was soll der Bot tun?' }),
    ).toHaveAccessibleDescription(
      /öffnet die Seite dafür einmal .* Nichts läuft, bevor du die Schritte übernimmst/,
    );
  });

  it('shows that it is working and what went wrong', () => {
    const { rerender } = render(<AiFlowPanel {...props({ generating: true })} />);
    expect(screen.getByRole('button', { name: 'Vorschlag erzeugen' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('bis zu einer Minute');

    rerender(<AiFlowPanel {...props({ error: 'Custom ist nicht erreichbar.' })} />);
    expect(screen.getByText('Custom ist nicht erreichbar.')).toBeVisible();
  });

  it('shows the suggested steps, what it found on the page, and takes the steps over', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(<AiFlowPanel {...props({ suggestion, onAccept })} />);

    const steps = screen.getByRole('region', { name: 'Vorschlag der KI' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(2);
    expect(steps).toHaveTextContent('Klicke auf „Absenden“');
    expect(screen.getByRole('region', { name: 'Auf der Seite erkannt' })).toHaveTextContent(
      'Usercentrics',
    );
    expect(screen.getByRole('button', { name: 'Neu erzeugen' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: '2 Schritte übernehmen' }));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('lets the user answer the questions of the AI', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(
      <AiFlowPanel
        {...props({ suggestion, answers: { 'Welches Event?': 'form_submit' }, onAnswer })}
      />,
    );
    const questions = screen.getByRole('region', { name: 'Rückfragen der KI' });
    expect(within(questions).getByRole('button', { name: 'form_submit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(questions).getByRole('button', { name: 'generate_lead' }));
    expect(onAnswer).toHaveBeenCalledWith('Welches Event?', 'generate_lead');
  });

  it('warns when the AI did not know the page', () => {
    render(
      <AiFlowPanel
        {...props({ suggestion: { ...suggestion, notice: 'Der Worker ist offline.' } })}
      />,
    );
    expect(screen.getByRole('region', { name: 'Seite nicht gelesen' })).toHaveTextContent(
      'Der Worker ist offline.',
    );
  });
});
