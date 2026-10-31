import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TemplateView } from '@/lib/views';
import { TemplateList } from './TemplateList';

const step = (title: string) => ({
  typeLabel: 'Klicken',
  tone: 'primary' as const,
  title,
  detail: '',
});

const template = (overrides: Partial<TemplateView> = {}): TemplateView => ({
  id: 'a',
  name: 'Kontaktformular',
  description: 'Füllt das Formular aus.',
  href: '/vorlagen/a',
  meta: '2 Schritte · geändert vor 2 Std.',
  steps: [step('Öffne /kontakt'), step('Klicke auf „Absenden“')],
  ...overrides,
});

describe('TemplateList', () => {
  it('shows each template with its note, its steps and a link to change it', () => {
    render(<TemplateList templates={[template()]} />);
    expect(screen.getByRole('link', { name: 'Kontaktformular' })).toHaveAttribute(
      'href',
      '/vorlagen/a',
    );
    expect(screen.getByText('Füllt das Formular aus.')).toBeInTheDocument();
    expect(screen.getByText('2 Schritte · geändert vor 2 Std.')).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Schritte von Kontaktformular' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the first four steps and counts the rest', () => {
    const steps = ['A', 'B', 'C', 'D', 'E', 'F'].map(step);
    render(<TemplateList templates={[template({ steps, description: null })]} />);
    const list = screen.getByRole('list', { name: 'Schritte von Kontaktformular' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('… und 2 weitere')).toBeInTheDocument();
  });

  it('explains templates while there are none', () => {
    render(<TemplateList templates={[]} />);
    expect(screen.getByRole('region', { name: 'Noch keine Vorlagen' })).toHaveTextContent(
      'Ablauf als Vorlage',
    );
    expect(screen.getByRole('link', { name: 'Neue Vorlage' })).toHaveAttribute(
      'href',
      '/vorlagen/neu',
    );
  });
});
