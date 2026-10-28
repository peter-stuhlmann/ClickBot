export type VariableContext = {
  runNr: number;
  botNr: number;
  /** Resolves `faker.<key>`; returns undefined for keys it does not know. */
  faker: (key: string) => string | undefined;
  secrets: Readonly<Record<string, string>>;
};

export type Interpolated = {
  value: string;
  /** Names of secrets that went into `value`; the caller must mask them in reports and logs. */
  secretsUsed: string[];
};

export class UnknownVariableError extends Error {
  constructor(readonly names: string[]) {
    const label = names.length === 1 ? 'Unbekannte Variable' : 'Unbekannte Variablen';
    super(`${label}: ${names.map((name) => `{{${name}}}`).join(', ')}`);
    this.name = 'UnknownVariableError';
  }
}

const VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function listVariables(template: string): string[] {
  const names = [...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1] as string);
  return [...new Set(names)];
}

type Resolved = { value: string; secret?: string } | undefined;

function resolve(name: string, ctx: VariableContext): Resolved {
  if (name === 'run_nr') return { value: String(ctx.runNr) };
  if (name === 'bot_nr') return { value: String(ctx.botNr) };
  if (name.startsWith('faker.')) {
    const value = ctx.faker(name.slice('faker.'.length));
    return value === undefined ? undefined : { value };
  }
  if (name.startsWith('secret.')) {
    const key = name.slice('secret.'.length);
    return Object.hasOwn(ctx.secrets, key)
      ? { value: ctx.secrets[key] as string, secret: key }
      : undefined;
  }
  return undefined;
}

/**
 * Replaces all `{{…}}` variables in one pass. Inserted values are never interpolated again,
 * so a faker value or secret that happens to contain `{{…}}` cannot pull in other secrets.
 */
export function interpolate(template: string, ctx: VariableContext): Interpolated {
  const unknown: string[] = [];
  const secretsUsed = new Set<string>();

  const value = template.replace(VARIABLE_PATTERN, (match, name: string) => {
    const resolved = resolve(name, ctx);
    if (!resolved) {
      if (!unknown.includes(name)) unknown.push(name);
      return match;
    }
    if (resolved.secret !== undefined) secretsUsed.add(resolved.secret);
    return resolved.value;
  });

  if (unknown.length > 0) throw new UnknownVariableError(unknown);
  return { value, secretsUsed: [...secretsUsed] };
}

export const SECRET_MASK = '••••';

/** Replaces secret values in free text (logs, error messages, extracted values). */
export function maskSecrets(text: string, secretValues: readonly string[]): string {
  return secretValues
    .filter((secret) => secret.length > 0)
    .toSorted((a, b) => b.length - a.length)
    .reduce((masked, secret) => masked.split(secret).join(SECRET_MASK), text);
}
