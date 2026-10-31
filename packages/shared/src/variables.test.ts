import { describe, expect, it } from 'vitest';
import {
  UnknownVariableError,
  interpolate,
  listVariables,
  maskSecrets,
  type VariableContext,
} from './variables';

const ctx: VariableContext = {
  runNr: 7,
  botNr: 3,
  faker: (key) => ({ email: 'lena.schmidt@example.org', name: 'Lena Schmidt' })[key],
  secrets: { staging: 's3cr3t-pw', empty: '' },
};

describe('listVariables', () => {
  it('returns each variable once, in order of first use, without whitespace', () => {
    expect(listVariables('{{ faker.email }} {{run_nr}} {{faker.email}}')).toEqual([
      'faker.email',
      'run_nr',
    ]);
  });

  it('returns nothing for plain text and single braces', () => {
    expect(listVariables('Hallo {Welt} {{}}')).toEqual([]);
  });
});

describe('interpolate', () => {
  it('replaces run and bot numbers', () => {
    expect(interpolate('Manuell #{{run_nr}} / Browser {{bot_nr}}', ctx).value).toBe(
      'Manuell #7 / Browser 3',
    );
  });

  it('resolves faker values via the context', () => {
    expect(interpolate('{{faker.name}} <{{faker.email}}>', ctx).value).toBe(
      'Lena Schmidt <lena.schmidt@example.org>',
    );
  });

  it('resolves secrets and reports which ones were used, so the report can mask them', () => {
    const result = interpolate('pw={{secret.staging}}', ctx);
    expect(result.value).toBe('pw=s3cr3t-pw');
    expect(result.secretsUsed).toEqual(['staging']);
  });

  it('keeps text without variables unchanged and uses no secrets', () => {
    expect(interpolate('Nur Text', ctx)).toEqual({ value: 'Nur Text', secretsUsed: [] });
  });

  it('collects all unknown variables in one error instead of failing on the first', () => {
    const run = () => interpolate('{{faker.iban}} {{secret.missing}} {{foo}} {{run_nr}}', ctx);
    expect(run).toThrow(UnknownVariableError);
    try {
      run();
    } catch (error) {
      expect((error as UnknownVariableError).names).toEqual([
        'faker.iban',
        'secret.missing',
        'foo',
      ]);
      expect((error as Error).message).toBe(
        'Unbekannte Variablen: {{faker.iban}}, {{secret.missing}}, {{foo}}',
      );
    }
  });

  it('lists an unknown variable only once even if it is used several times', () => {
    expect(() => interpolate('{{foo}} und nochmal {{ foo }}', ctx)).toThrow(
      'Unbekannte Variable: {{foo}}',
    );
  });

  it('uses the singular in the error message for a single unknown variable', () => {
    expect(() => interpolate('{{foo}}', ctx)).toThrow('Unbekannte Variable: {{foo}}');
  });

  it('allows a secret whose value is an empty string', () => {
    expect(interpolate('[{{secret.empty}}]', ctx).value).toBe('[]');
  });

  it('does not treat inherited object keys as secrets', () => {
    expect(() => interpolate('{{secret.toString}}', ctx)).toThrow(UnknownVariableError);
  });

  it('does not interpolate values that themselves look like variables', () => {
    const tricky: VariableContext = { ...ctx, faker: () => '{{secret.staging}}' };
    expect(interpolate('{{faker.name}}', tricky)).toEqual({
      value: '{{secret.staging}}',
      secretsUsed: [],
    });
  });
});

describe('maskSecrets', () => {
  it('replaces every occurrence of each secret value', () => {
    expect(maskSecrets('login s3cr3t-pw, again s3cr3t-pw', ['s3cr3t-pw'])).toBe(
      'login ••••, again ••••',
    );
  });

  it('masks the longer secret first when one secret contains another', () => {
    expect(maskSecrets('token=abc123', ['abc', 'abc123'])).toBe('token=••••');
  });

  it('ignores empty secret values instead of masking everything', () => {
    expect(maskSecrets('nichts geheim', [''])).toBe('nichts geheim');
  });

  it('treats regex characters in secrets literally', () => {
    expect(maskSecrets('pw=a.b*c', ['a.b*c'])).toBe('pw=••••');
  });
});
