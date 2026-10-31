import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  it('names its control by the label', () => {
    render(
      <Field id="name" label="Name des Tests">
        {(control) => <input {...control} />}
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Name des Tests' })).toBeValid();
  });

  it('describes the control with its hint', () => {
    render(
      <Field id="url" label="Adresse der Website" hint="z. B. https://beispiel.de">
        {(control) => <input {...control} />}
      </Field>,
    );
    expect(
      screen.getByRole('textbox', { name: 'Adresse der Website' }),
    ).toHaveAccessibleDescription('z. B. https://beispiel.de');
  });

  it('marks the control invalid and reads the error first', () => {
    render(
      <Field
        id="url"
        label="Adresse der Website"
        hint="z. B. https://beispiel.de"
        error="Ungültige URL."
      >
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Adresse der Website' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Ungültige URL. z. B. https://beispiel.de');
  });
});
