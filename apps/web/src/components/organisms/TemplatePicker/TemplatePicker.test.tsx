import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TemplateView } from '@/lib/views';
import { TemplatePicker } from './TemplatePicker';

const template = (id: string, name: string, titles: string[]): TemplateView => ({
  id,
  name,
  description: `${name} für jede Website.`,
  href: `/vorlagen/${id}`,
  meta: `${titles.length} Schritte`,
  steps: titles.map((title) => ({ typeLabel: 'Klicken', tone: 'primary', title, detail: '' })),
});

const templates = [
  template('a', 'Kontaktformular', ['Öffne /kontakt', 'Klicke auf „Absenden“']),
  template('b', 'Newsletter', ['Fülle „E-Mail“ aus']),
];

describe('TemplatePicker', () => {
  it('shows the steps of the chosen template and takes them over', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<TemplatePicker templates={templates} onApply={onApply} />);

    expect(screen.getByRole('button', { name: /Kontaktformular/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      within(screen.getByRole('list', { name: 'Schritte von Kontaktformular' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Newsletter/ }));
    expect(screen.getByRole('list', { name: 'Schritte von Newsletter' })).toHaveTextContent(
      'Fülle „E-Mail“ aus',
    );
    await user.click(screen.getByRole('button', { name: 'Schritte übernehmen' }));
    expect(onApply).toHaveBeenCalledWith('b');
  });

  it('leads to the templates page while there are none', () => {
    render(<TemplatePicker templates={[]} onApply={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Zu den Vorlagen' })).toHaveAttribute(
      'href',
      '/vorlagen',
    );
    expect(screen.queryByRole('button', { name: 'Schritte übernehmen' })).not.toBeInTheDocument();
  });
});
