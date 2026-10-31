import { Card } from '@/components/atoms/Card';
import { Notice } from '@/components/molecules/Notice';
import { SwitchRow } from '@/components/molecules/SwitchRow';

export type AdBlockingFormProps = {
  blockAds: boolean;
  onChange: (blockAds: boolean) => void;
};

/**
 * Whether the bot runs of a job load ads. Blocked by default (product rule: no fake ad
 * impressions); allowing them shows what it means, and every report of a run notes it.
 */
export function AdBlockingForm({ blockAds, onChange }: AdBlockingFormProps) {
  return (
    <Card
      title="Werbung"
      description="Werbenetzwerke können Browser nicht herausfiltern. Click-Bot blockiert ihre Anfragen deshalb wie ein Werbeblocker."
    >
      <SwitchRow
        label="Werbung blockieren"
        description="Google Ads, AdSense, Amazon, Criteo, Taboola und weitere. GA4 und Einwilligungs-Banner bleiben. Empfohlen: an."
        checked={blockAds}
        onToggle={() => onChange(!blockAds)}
      />
      {!blockAds && (
        <Notice tone="danger" title="Anzeigen zählen als Impressionen">
          Die Durchläufe dieses Tests laden Anzeigen wie echte Besucher. Werbenetzwerke werten das
          als ungültige Zugriffe; das kann dem Werbekonto der Website schaden. Nur für eigene
          Websites oder mit Zustimmung des Kunden. Jeder Report vermerkt es.
        </Notice>
      )}
    </Card>
  );
}
