import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AiProviderView, FormState } from '@/lib/views';
import { AiProviderForm, type AiProviderActions } from './AiProviderForm';

const openai: AiProviderView = {
  kind: 'openai',
  label: 'OpenAI',
  keyHelp: 'platform.openai.com → API keys',
  configured: false,
  isDefault: false,
  model: '',
  needsBaseUrl: false,
  baseUrl: '',
  keyRequired: true,
  keyHint: null,
  modelSuggestions: [],
};

function actions(overrides: Partial<AiProviderActions> = {}): AiProviderActions {
  return {
    save: vi.fn(async (): Promise<FormState> => ({ notice: 'Gespeichert.' })),
    test: vi.fn(async () => ({ tone: 'success' as const, message: 'Verbindung steht.' })),
    makeDefault: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
}

const card = (name: string) => within(screen.getByRole('region', { name }));

describe('AiProviderForm', () => {
  it('asks a provider that is not set up for key and model', () => {
    render(<AiProviderForm provider={openai} actions={actions()} />);
    const openAi = card('OpenAI');
    expect(openAi.getByText('Nicht eingerichtet')).toBeInTheDocument();
    expect(openAi.getByLabelText('API-Schlüssel')).toHaveAttribute('type', 'password');
    expect(openAi.getByLabelText('API-Schlüssel')).toHaveValue('');
    expect(openAi.getByRole('combobox', { name: 'Modell' })).toHaveValue('');
    expect(openAi.queryByLabelText('Adresse der API')).toBeNull();
    // Nothing to remove or make the default yet.
    expect(openAi.queryByRole('button', { name: /entfernen|Standard/ })).toBeNull();
  });

  it('never puts the stored key into the form, only its last characters as a hint', () => {
    render(
      <AiProviderForm
        provider={{ ...openai, configured: true, model: 'gpt-a', keyHint: '…1234' }}
        actions={actions()}
      />,
    );
    const key = card('OpenAI').getByLabelText('API-Schlüssel');
    expect(key).toHaveValue('');
    expect(key).toHaveAttribute(
      'placeholder',
      'Gespeichert (…1234) – leer lassen, um ihn zu behalten',
    );
    expect(card('OpenAI').getByRole('combobox', { name: 'Modell' })).toHaveValue('gpt-a');
  });

  it('saves what was entered and confirms it', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (_state: FormState, _data: FormData) => ({ notice: 'Gespeichert.' }));
    render(<AiProviderForm provider={openai} actions={actions({ save })} />);

    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-neu');
    await user.type(screen.getByRole('combobox', { name: 'Modell' }), 'gpt-a');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.');
    const data = save.mock.calls[0]?.[1];
    expect(Object.fromEntries(data?.entries() ?? [])).toEqual({
      kind: 'openai',
      apiKey: 'sk-neu',
      model: 'gpt-a',
    });
  });

  it('shows problems at their fields', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => ({
      fieldErrors: { apiKey: 'Bitte den API-Schlüssel eintragen.', model: 'Bitte ausfüllen.' },
    }));
    render(<AiProviderForm provider={openai} actions={actions({ save })} />);
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(screen.getByLabelText('API-Schlüssel')).toHaveAccessibleDescription(
        /Bitte den API-Schlüssel eintragen/,
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Modell' })).toHaveAccessibleDescription(
      /Bitte ausfüllen/,
    );
  });

  it('tests the connection with what is typed and offers the models it finds', async () => {
    const user = userEvent.setup();
    const test = vi.fn(async (_data: FormData) => ({
      tone: 'success' as const,
      message: 'Verbindung steht. 2 Modelle verfügbar, Auswahl im Feld „Modell“.',
      models: ['gpt-a', 'gpt-b'],
    }));
    render(<AiProviderForm provider={openai} actions={actions({ test })} />);

    await user.type(screen.getByLabelText('API-Schlüssel'), 'sk-test');
    await user.click(screen.getByRole('button', { name: 'Verbindung testen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('2 Modelle verfügbar');
    expect(test.mock.calls[0]?.[0].get('apiKey')).toBe('sk-test');
    const options = document.querySelectorAll('datalist option');
    expect([...options].map((option) => option.getAttribute('value'))).toEqual(['gpt-a', 'gpt-b']);
  });

  it('shows a failed test in red', async () => {
    const user = userEvent.setup();
    const test = vi.fn(async () => ({
      tone: 'danger' as const,
      message: 'OpenAI lehnt den API-Schlüssel ab (HTTP 401).',
    }));
    render(<AiProviderForm provider={openai} actions={actions({ test })} />);
    await user.click(screen.getByRole('button', { name: 'Verbindung testen' }));
    expect(await screen.findByRole('status')).toHaveClass('text-danger');
  });

  it('offers the suggestions of a provider that cannot list its models', () => {
    render(
      <AiProviderForm
        provider={{
          ...openai,
          kind: 'perplexity',
          label: 'Perplexity',
          modelSuggestions: ['sonar'],
        }}
        actions={actions()}
      />,
    );
    expect(document.querySelector('datalist option')).toHaveAttribute('value', 'sonar');
  });

  it('asks a custom endpoint for its address, with an optional key', () => {
    render(
      <AiProviderForm
        provider={{
          ...openai,
          kind: 'custom',
          label: 'Custom',
          needsBaseUrl: true,
          keyRequired: false,
        }}
        actions={actions()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Adresse der API' })).toBeInTheDocument();
    expect(screen.getByLabelText('API-Schlüssel (optional)')).toBeInTheDocument();
  });

  it('makes a configured provider the default or removes it', async () => {
    const user = userEvent.setup();
    const makeDefault = vi.fn(async (_data: FormData) => {});
    const remove = vi.fn(async (_data: FormData) => {});
    render(
      <AiProviderForm
        provider={{ ...openai, configured: true, model: 'gpt-a', keyHint: '…1234' }}
        actions={actions({ makeDefault, remove })}
      />,
    );
    expect(screen.getByText('Eingerichtet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Als Standard verwenden' }));
    await waitFor(() => expect(makeDefault).toHaveBeenCalled());
    expect(makeDefault.mock.calls[0]?.[0].get('kind')).toBe('openai');

    await user.click(screen.getByRole('button', { name: 'OpenAI entfernen' }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(remove.mock.calls[0]?.[0].get('kind')).toBe('openai');
  });

  it('marks the default provider and does not offer to make it the default again', () => {
    render(
      <AiProviderForm
        provider={{ ...openai, configured: true, isDefault: true, model: 'gpt-a', keyHint: '…1' }}
        actions={actions()}
      />,
    );
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Als Standard verwenden' })).toBeNull();
  });

  describe('without actions (members)', () => {
    it('shows model and key hint, but no form', () => {
      render(
        <AiProviderForm
          provider={{ ...openai, configured: true, model: 'gpt-a', keyHint: '…1234' }}
        />,
      );
      expect(screen.queryByRole('form')).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(card('OpenAI').getByText('gpt-a')).toBeInTheDocument();
      expect(card('OpenAI').getByText('…1234')).toBeInTheDocument();
    });

    it('says who can set up a provider', () => {
      render(<AiProviderForm provider={openai} />);
      expect(screen.getByText('Einrichten können nur Admins.')).toBeInTheDocument();
    });

    it('shows the address of a custom endpoint', () => {
      render(
        <AiProviderForm
          provider={{
            ...openai,
            kind: 'custom',
            label: 'Custom',
            configured: true,
            model: 'llama',
            needsBaseUrl: true,
            baseUrl: 'http://localhost:11434/v1',
          }}
        />,
      );
      expect(screen.getByText('http://localhost:11434/v1')).toBeInTheDocument();
      expect(screen.getByText('keiner')).toBeInTheDocument();
    });
  });
});
