const PREFIX = 'bildschirmfoto-';

/** "bildschirmfoto-5": where the screenshot of step 5 sits in the gallery of a run report. */
export function screenshotAnchor(step: number): string {
  return `${PREFIX}${step}`;
}

/** The step of a link to a screenshot ("#bildschirmfoto-5" → 5), otherwise null. */
export function screenshotStepOf(href: string): number | null {
  const match = new RegExp(`^#${PREFIX}([1-9][0-9]*)$`).exec(href);
  return match ? Number(match[1]) : null;
}
