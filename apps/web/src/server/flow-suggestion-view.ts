import 'server-only';
import type { PageFacts } from '@click-bot/shared';
import { displayUrl } from '@/lib/format';
import type { SummaryRowView } from '@/lib/views';

const none = (count: number) => (count > 0 ? String(count) : 'keine');

/** "Auf der Seite erkannt" (screen 06). */
export function toPageFactRows(facts: PageFacts): SummaryRowView[] {
  return [
    { label: 'Seite', value: facts.title || displayUrl(facts.url) },
    { label: 'Formulare', value: none(facts.forms) },
    { label: 'Pflichtfelder', value: none(facts.requiredFields) },
    { label: 'Cookie-Banner', value: facts.cookieBanner ?? 'keins erkannt' },
    {
      label: 'Analytics',
      value: facts.ga4.length > 0 ? `GA4 · ${facts.ga4.join(', ')}` : 'kein GA4 gefunden',
    },
  ];
}

export type AnalysisOutcome =
  { kind: 'offline' } | { kind: 'failed'; error: string } | { kind: 'timeout' };

const GUESSED =
  'Die KI rät die Beschriftungen. Bitte die Beschriftungen in den Schritten genau prüfen.';

/** Why the model had to suggest steps without knowing the page. */
export function analysisNotice(outcome: AnalysisOutcome): string {
  switch (outcome.kind) {
    case 'offline':
      return `Der Worker ist offline, deshalb kennt die KI die Seite nicht. ${GUESSED}`;
    case 'failed':
      return `Die Seite ließ sich nicht öffnen: ${outcome.error} ${GUESSED}`;
    case 'timeout':
      return `Die Seite wurde nicht rechtzeitig geöffnet. ${GUESSED}`;
  }
}
