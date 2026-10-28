import { describe, expect, it } from 'vitest';
import { field, toFormState } from './form-state';

describe('toFormState', () => {
  it('puts form problems on top and field problems at their fields', () => {
    expect(
      toFormState(
        [
          { path: 'form', message: 'Es gibt schon ein Konto.' },
          { path: 'name', message: 'Name fehlt.' },
          { path: 'password', message: 'Mindestens 10 Zeichen.' },
          { path: 'password', message: 'second' },
          { path: 'form', message: 'second form problem' },
        ],
        { name: '' },
      ),
    ).toEqual({
      error: 'Es gibt schon ein Konto.',
      fieldErrors: { name: 'Name fehlt.', password: 'Mindestens 10 Zeichen.' },
      values: { name: '' },
    });
  });

  it('maps nested paths to their top-level field', () => {
    expect(toFormState([{ path: 'email.0', message: 'x' }]).fieldErrors).toEqual({ email: 'x' });
  });

  it('leaves out field errors when there are none', () => {
    expect(toFormState([{ path: 'form', message: 'x' }])).toEqual({ error: 'x', values: {} });
  });
});

describe('field', () => {
  it('reads text fields and treats missing ones and files as empty', () => {
    const data = new FormData();
    data.set('email', 'peter@agentur.de');
    data.set('file', new Blob(['x']));
    expect(field(data, 'email')).toBe('peter@agentur.de');
    expect(field(data, 'missing')).toBe('');
    expect(field(data, 'file')).toBe('');
  });
});
