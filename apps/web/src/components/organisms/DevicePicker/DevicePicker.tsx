import type { DeviceBrowsers } from '@click-bot/shared';
import { Card } from '@/components/atoms/Card';
import type { IconName } from '@/components/atoms/Icon';
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
};

const ICONS: Record<DeviceKey, IconName> = {
  desktop: 'desktop',
  iphone: 'phone',
  android: 'phone',
  ipad: 'tablet',
};

const IOS_ONLY = 'Auf iOS ist jeder Browser Safari (WebKit).';
const NO_BROWSER = 'Mindestens einen Browser wählen.';

/** The devices to test on, each with its own browsers (wizard and editor). */
export function DevicePicker({
  selected,
  deviceBrowsers,
  error,
  browserErrors = {},
  onToggle,
  onToggleBrowser,
}: DevicePickerProps) {
  return (
    <>
      <Card
        title="Auf welchen Geräten testen?"
        description="Du kannst mehrere wählen. Jedes Gerät läuft in den Browsern, die du bei ihm anhakst, und bekommt eine eigene Zeile im Report."
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
          Jedes Gerät läuft mit echter Bildschirmgröße und Touch. Auf iPhone und iPad ist jeder
          Browser Safari.
        </p>
      </Card>
    </>
  );
}
