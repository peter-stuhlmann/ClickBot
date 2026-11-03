import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction, ModelPriceView } from '@/lib/views';
import { ModelPriceForm } from './ModelPriceForm';

const claude: ModelPriceView = {
  provider: 'anthropic',
  providerLabel: 'Claude',
  model: 'claude-x',
  input: '3',
  output: '15',
  cached: '',
  priced: true,
};
const gemini: ModelPriceView = {
  provider: 'gemini',
  providerLabel: 'Gemini',
  model: 'gemini-x',
  input: '',
  output: '',
  cached: '',
  priced: false,
};

describe('ModelPriceForm', () => {
  it('explains the unit and says what to do while there is no model', () => {
    render(<ModelPriceForm models={[]} action={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Preise je Modell' })).toHaveTextContent(
      'US-Dollar pro 1 Million Token',
    );
    expect(screen.getByText(/Noch kein Modell/)).toBeInTheDocument();
  });

  it('shows a form per model, filled with its price', () => {
    render(<ModelPriceForm models={[claude, gemini]} action={vi.fn()} />);
    const form = screen.getByRole('form', { name: 'Preis von Claude claude-x' });
    expect(form).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Preis von Gemini gemini-x' })).toBeInTheDocument();
    const inputs = screen.getAllByLabelText('Eingabe') as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(['3', '']);
    expect((screen.getAllByLabelText('Ausgabe') as HTMLInputElement[])[0]?.value).toBe('15');
  });

  it('sends what was typed with provider and model, and confirms', async () => {
    const user = userEvent.setup();
    const action = vi.fn<FormAction>(async () => ({ notice: 'Gespeichert.' }));
    render(<ModelPriceForm models={[gemini]} action={action} />);
    await user.type(screen.getByLabelText('Eingabe'), '1,25');
    await user.type(screen.getByLabelText('Ausgabe'), '10');
    await user.type(screen.getByLabelText('Zwischengespeichert'), '0,3');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    const data = action.mock.calls[0]?.[1] as FormData;
    expect(Object.fromEntries(data.entries())).toEqual({
      kind: 'gemini',
      model: 'gemini-x',
      input: '1,25',
      output: '10',
      cached: '0,3',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.');
  });

  it('shows the error at the field and keeps what was typed', async () => {
    const user = userEvent.setup();
    const action: FormAction = async () => ({
      fieldErrors: { output: 'Bitte ausfüllen.' },
      values: { input: '3', output: '', cached: '' },
    });
    render(<ModelPriceForm models={[gemini]} action={action} />);
    await user.type(screen.getByLabelText('Eingabe'), '3');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeInTheDocument();
    expect(screen.getByLabelText('Ausgabe')).toHaveAccessibleDescription('Bitte ausfüllen.');
    expect((screen.getByLabelText('Eingabe') as HTMLInputElement).value).toBe('3');
  });

  it('only shows the prices to someone who may not change them', () => {
    render(<ModelPriceForm models={[claude, gemini]} />);
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Eingabe 3 \$ · Ausgabe 15 \$ · Zwischengespeichert wie Eingabe/),
    ).toBeInTheDocument();
    expect(screen.getByText('Kein Preis hinterlegt.')).toBeInTheDocument();
  });
});
