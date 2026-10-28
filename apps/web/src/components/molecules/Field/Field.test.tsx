import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  it('names its control by the label', () => {
    render(
      <Field id="name" label="Job-Name">
        {(control) => <input {...control} />}
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Job-Name' })).toBeValid();
  });

  it('describes the control with its hint', () => {
    render(
      <Field id="url" label="Start-URL" hint="z. B. https://beispiel.de">
        {(control) => <input {...control} />}
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Start-URL' })).toHaveAccessibleDescription(
      'z. B. https://beispiel.de',
    );
  });

  it('marks the control invalid and reads the error first', () => {
    render(
      <Field id="url" label="Start-URL" hint="z. B. https://beispiel.de" error="Ungültige URL.">
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Start-URL' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Ungültige URL. z. B. https://beispiel.de');
  });
});
