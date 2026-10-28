import { Card } from '@/components/atoms/Card';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { ChoiceCard } from '@/components/molecules/ChoiceCard';
import { cn } from '@/lib/cn';
import { DEVICE_OPTIONS, type DeviceKey } from '@/lib/devices';

export type DevicePickerProps = {
  selected: DeviceKey[];
  error?: string;
  onToggle: (device: DeviceKey) => void;
  /** Narrow column (editor): two cards per row, without the location card. */
  compact?: boolean;
};

const ICONS: Record<DeviceKey, IconName> = {
  desktop: 'desktop',
  iphone: 'phone',
  android: 'phone',
  ipad: 'tablet',
};

/** Step 4 of the job wizard: devices to test on. Location profiles are not built yet. */
export function DevicePicker({ selected, error, onToggle, compact = false }: DevicePickerProps) {
  return (
    <>
      <Card
        title="Auf welchen Geräten testen?"
        description="Mehrfachauswahl möglich – jedes Gerät läuft als eigener Bot und bekommt eine eigene Zeile im Report."
      >
        <div className={cn('grid grid-cols-2 gap-3', !compact && 'xl:grid-cols-4')}>
          {DEVICE_OPTIONS.map((device) => (
            <ChoiceCard
              key={device.key}
              icon={ICONS[device.key]}
              title={device.label}
              description={device.spec}
              selected={selected.includes(device.key)}
              onClick={() => onToggle(device.key)}
            />
          ))}
        </div>
        {error && <p className="text-small text-danger">{error}</p>}
        <p className="text-small text-text-muted">
          Alle Geräte laufen in Chromium mit echter Bildschirmgröße, Touch und Gerätekennung. Echtes
          Safari (WebKit) für iPhone und iPad ist geplant.
        </p>
      </Card>
      {!compact && (
        <Card
          title="Von wo aus testen?"
          description="Standort-Profile setzen IP (Proxy), GPS-Koordinaten, Sprache und Zeitzone passend zusammen."
          aside={
            <span className="rounded-chip bg-neutral-soft px-2 py-0.5 text-small text-text-muted">
              geplant
            </span>
          }
        >
          <p className="flex items-start gap-2 text-body text-text">
            <Icon name="location" className="text-text-muted" />
            Bis es Standort-Profile gibt, laufen alle Bots ohne Proxy, mit deutscher Sprache und
            Zeitzone Europe/Berlin.
          </p>
        </Card>
      )}
    </>
  );
}
