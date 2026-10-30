import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AiProviderView } from '@/lib/views';
import { AiProviderList } from './ai-provider-list';

const provider = (kind: string, label: string): AiProviderView => ({
  kind,
  label,
  keyHelp: '',
  configured: false,
  isDefault: false,
  model: '',
  needsBaseUrl: false,
  baseUrl: '',
  keyRequired: true,
  keyHint: null,
  modelSuggestions: [],
});

const providers = [provider('openai', 'OpenAI'), provider('claude', 'Claude')];
const expanded = () =>
  screen
    .getAllByRole('button', { expanded: true })
    .map((button) => button.getAttribute('aria-controls'));

describe('AiProviderList', () => {
  it('starts with every provider closed', () => {
    render(<AiProviderList providers={providers} />);
    expect(screen.getByRole('button', { name: 'OpenAI' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Claude' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps at most one provider open', async () => {
    const user = userEvent.setup();
    render(<AiProviderList providers={providers} />);

    await user.click(screen.getByRole('button', { name: 'OpenAI' }));
    expect(expanded()).toEqual(['ai-openai-panel']);

    await user.click(screen.getByRole('button', { name: 'Claude' }));
    expect(expanded()).toEqual(['ai-claude-panel']);

    await user.click(screen.getByRole('button', { name: 'Claude' }));
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
  });
});
