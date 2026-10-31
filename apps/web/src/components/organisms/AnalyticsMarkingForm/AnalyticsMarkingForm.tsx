import {
  ALL_MARKINGS_ON,
  describeMarking,
  markingState,
  type AnalyticsMarking,
  type MarkingKey,
} from '@click-bot/shared';
import { Card } from '@/components/atoms/Card';
import { Notice } from '@/components/molecules/Notice';
import { SwitchRow } from '@/components/molecules/SwitchRow';

export type AnalyticsMarkingFormProps = {
  marking: AnalyticsMarking;
  onChange: (marking: AnalyticsMarking) => void;
};

const SWITCHES: { key: MarkingKey; label: string; description: string }[] = [
  {
    key: 'debugMode',
    label: 'Debug-Modus',
    description: 'Ereignisse nur in der GA4-DebugView, nie in den normalen Berichten (_dbg=1).',
  },
  {
    key: 'internalTraffic',
    label: 'Interner Traffic',
    description:
      'Ein aktiver GA4-Filter „Interner Traffic“ schließt die Ereignisse aus (traffic_type=internal).',
  },
  {
    key: 'botFlag',
    label: 'Bot-Kennung',
    description: 'Macht Test-Ereignisse in GA4 und BigQuery herausfilterbar (click_bot=1).',
  },
  {
    key: 'runNumber',
    label: 'Laufnummer',
    description: 'Zeigt, von welchem Durchlauf ein Ereignis stammt (click_bot_run).',
  },
];

const ALL_OFF: AnalyticsMarking = {
  debugMode: false,
  internalTraffic: false,
  botFlag: false,
  runNumber: false,
};

/**
 * How bot runs of a job mark their GA4 requests. Everything is on by default; switching
 * markings off shows what it means, and every report of a run notes it.
 */
export function AnalyticsMarkingForm({ marking, onChange }: AnalyticsMarkingFormProps) {
  const state = markingState(marking);
  return (
    <Card
      title="Markierung in GA4"
      description="Testdurchläufe sollen keine Kennzahlen verfälschen. Click-Bot markiert deshalb jede GA4-Anfrage eines Durchlaufs."
    >
      <SwitchRow
        label="Testdurchläufe in GA4 markieren"
        description="Schaltet alle vier Markierungen gemeinsam. Empfohlen: an."
        checked={state === 'on'}
        onToggle={() => onChange(state === 'on' ? ALL_OFF : ALL_MARKINGS_ON)}
      />
      <div className="flex flex-col gap-3 border-l-2 border-divider pl-4">
        {SWITCHES.map(({ key, label, description }) => (
          <SwitchRow
            key={key}
            label={label}
            description={description}
            checked={marking[key]}
            onToggle={() => onChange({ ...marking, [key]: !marking[key] })}
          />
        ))}
      </div>
      {state === 'off' && (
        <Notice tone="danger" title="Testdurchläufe zählen in GA4 wie echte Besuche">
          Ohne Markierung sind die Durchläufe dieses Tests nicht von echten Besuchern zu
          unterscheiden und verändern die Kennzahlen. Nur für eigene Websites oder mit Zustimmung
          des Kunden. Jeder Report vermerkt es.
        </Notice>
      )}
      {state === 'partial' && (
        <Notice tone="warning" title="Markierung eingeschränkt">
          {describeMarking(marking)}.{' '}
          {!marking.debugMode && 'Die Ereignisse erscheinen in den normalen GA4-Berichten. '}
          Jeder Report vermerkt es.
        </Notice>
      )}
    </Card>
  );
}
