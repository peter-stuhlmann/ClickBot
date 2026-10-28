const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function normalise(host: string): string {
  return host.toLowerCase().replace(/\.$/, '');
}

/**
 * A rule is either an exact host (`staging.beispiel.de`) or a wildcard for its subdomains
 * (`*.beispiel.de`). Wildcards need at least two labels, so `*.de` is not allowed.
 */
export function isValidDomainRule(rule: string): boolean {
  const wildcard = rule.startsWith('*.');
  const labels = normalise(wildcard ? rule.slice(2) : rule).split('.');
  if (wildcard && labels.length < 2) return false;
  return labels.every((label) => LABEL.test(label));
}

/** Whether a secret restricted to `rules` may be used on `host`. */
export function isHostAllowed(host: string, rules: readonly string[]): boolean {
  const target = normalise(host);
  return rules.some((rule) => {
    const normalised = normalise(rule);
    if (normalised.startsWith('*.')) return target.endsWith(normalised.slice(1));
    return target === normalised;
  });
}
