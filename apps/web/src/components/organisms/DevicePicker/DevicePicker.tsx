import type { DeviceBrowsers } from '@click-bot/shared';
import { Card } from '@/components/atoms/Card';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { DeviceChoice } from '@/components/molecules/DeviceChoice';
import { browserChoices, DEVICE_OPTIONS, type BrowserKey, type DeviceKey } from '@/lib/devices';

export type DevicePickerProps = {
  selected: DeviceKey[];
  /** The browsers of each device. */
  deviceBrowsers: DeviceBrowsers;
  error?: string;
  /** What a device is missing, e.g. a browser. */
  browserErrors?: Partial<Record<DeviceKey, string>>;
  onToggle: (device: DeviceKey) => void;
  onToggleBrowser: (device: DeviceKey, browser: BrowserKey) => void;
  /** Narrow column (editor): without the location card. */
  compact?: boolean;
};

const ICONS: Record<DeviceKey, IconName> = {
  desktop: 'desktop',
  iphone: 'phone',
  android: 'phone',
  ipad: 'tablet',
};

const IOS_ONLY = 'Auf iOS ist jeder Browser Safari (WebKit).';
const NO_BROWSER = 'Mindestens einen Browser wählen.';

/**
 * Step 4 of the job wizard: the devices to test on, each with its own browsers. Location profiles
 * are not built yet.
 */
export function DevicePicker({
  selected,
  deviceBrowsers,
  error,
  browserErrors = {},
  onToggle,
  onToggleBrowser,
  compact = false,
}: DevicePickerProps) {
  return (
    <>
      <Card
        title="Auf welchen Geräten testen?"
        description="Mehrfachauswahl möglich – jedes Gerät läuft in den Browsern, die du bei ihm wählst. Jede Kombination ist ein eigener Bot mit einer eigenen Zeile im Report."
      >
        {/* Columns by the width of the card, not of the window: beside the summary it is narrow. */}
        <div className="@container">
          <div className="grid grid-cols-2 items-start gap-3 @3xl:grid-cols-4">
            {DEVICE_OPTIONS.map((device) => {
              const choices = browserChoices(device.key, deviceBrowsers);
              const chosen = selected.includes(device.key);
              // Said at once, not only when the step is checked: the device would not run.
              const missing =
                chosen && !choices.browsers.some((browser) => browser.chosen)
                  ? NO_BROWSER
                  : undefined;
              return (
                <DeviceChoice
                  key={device.key}
                  icon={ICONS[device.key]}
                  title={device.label}
                  description={device.spec}
                  selected={chosen}
                  onToggle={() => onToggle(device.key)}
                  browsers={choices.browsers}
                  onToggleBrowser={(browser) => onToggleBrowser(device.key, browser)}
                  locked={choices.locked ? IOS_ONLY : undefined}
                  error={browserErrors[device.key] ?? missing}
                />
              );
            })}
          </div>
        </div>
        {error && <p className="text-small text-danger">{error}</p>}
        <p className="text-small text-text-muted">
          Jedes Gerät läuft mit echter Bildschirmgröße, Touch und Gerätekennung. Android gibt es mit
          Chrome oder Firefox, Safari nur auf Desktop, iPhone und iPad.
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
