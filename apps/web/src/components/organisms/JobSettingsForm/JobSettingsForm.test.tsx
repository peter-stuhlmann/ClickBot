import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JobSettingsForm } from './JobSettingsForm';

const values = {
  name: 'Kontaktformular-Test',
  startUrl: 'https://beispiel.de/kontakt',
  campaignId: 'k1',
};
const campaigns = [
  { id: 'k1', name: 'Allgemein' },
  { id: 'k2', name: 'Black Friday' },
];

describe('JobSettingsForm', () => {
  it('shows and reports name and start address', () => {
    const onChange = vi.fn();
    render(
      <JobSettingsForm values={values} campaigns={campaigns} errors={{}} onChange={onChange} />,
    );

    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveValue('Kontaktformular-Test');
    fireEvent.change(screen.getByRole('textbox', { name: 'Job-Name' }), {
      target: { value: 'Kontakt neu' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Website (Start-URL)' }), {
      target: { value: 'https://beispiel.de/neu' },
    });

    expect(onChange.mock.calls).toEqual([
      [{ name: 'Kontakt neu' }],
      [{ startUrl: 'https://beispiel.de/neu' }],
    ]);
  });

  it('shows errors at the fields', () => {
    render(
      <JobSettingsForm
        values={{ name: '', startUrl: 'ftp://x', campaignId: 'k1' }}
        campaigns={campaigns}
        errors={{
          name: 'Name fehlt.',
          startUrl: 'Start-URL muss mit http:// oder https:// beginnen.',
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toHaveAccessibleDescription(
      'Name fehlt.',
    );
    expect(screen.getByRole('textbox', { name: 'Website (Start-URL)' })).toBeInvalid();
  });

  it('moves the job to another campaign of its project', () => {
    const onChange = vi.fn();
    render(
      <JobSettingsForm values={values} campaigns={campaigns} errors={{}} onChange={onChange} />,
    );
    const campaign = screen.getByRole('combobox', { name: 'Kampagne' });
    expect(campaign).toHaveValue('k1');
    fireEvent.change(campaign, { target: { value: 'k2' } });
    expect(onChange).toHaveBeenCalledWith({ campaignId: 'k2' });
  });
});
