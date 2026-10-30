import { useId } from 'react';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';
import type { BrowserChoice, BrowserKey } from '@/lib/devices';

export type DeviceChoiceProps = {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
  /** The browsers the device can run in; shown while it is chosen. */
  browsers: BrowserChoice[];
  onToggleBrowser: (browser: BrowserKey) => void;
  /** Why the browser cannot change, e.g. on iOS; the only browser is then shown fixed. */
  locked?: string;
  error?: string;
};

/**
 * A device to test on as a card: pressing it chooses the device, and a chosen device shows its
 * browsers as chips to switch on and off below.
 */
export function DeviceChoice({
  icon,
  title,
  description,
  selected,
  onToggle,
  browsers,
  onToggleBrowser,
  locked,
  error,
}: DeviceChoiceProps) {
  const id = useId();
  return (
    <div
      className={cn(
        'flex flex-col rounded-card transition-colors',
        selected
          ? 'border-2 border-primary bg-primary-soft'
          : 'border border-border bg-surface hover:border-border-strong',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex flex-col items-start gap-3 rounded-card p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name={icon} className={selected ? 'text-primary' : 'text-text-muted'} />
        <span className="flex max-w-full items-start gap-1.5 text-card font-medium text-text">
          {selected && <Icon name="check" size={16} className="mt-0.75 text-primary" />}
          <span className="min-w-0 hyphens-auto">{title}</span>
        </span>
        <span className="text-meta text-text-muted">{description}</span>
      </button>

      {selected && (
        <div className="flex flex-col gap-2 px-5 pb-5">
          <div
            role="group"
            aria-label={`Browser für ${title}`}
            aria-describedby={error ? `${id}-error` : locked ? `${id}-locked` : undefined}
            className="flex flex-wrap gap-1.5"
          >
            {browsers.map((browser) => (
              <button
                key={browser.key}
                type="button"
                aria-pressed={browser.chosen}
                disabled={locked !== undefined}
                onClick={() => onToggleBrowser(browser.key)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-chip border bg-surface px-2.5 py-1 text-meta transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  browser.chosen
                    ? 'border-primary font-medium text-primary'
                    : 'border-border text-text-muted hover:border-border-strong hover:text-text',
                  'disabled:opacity-80',
                )}
              >
                {browser.chosen && <Icon name="check" size={12} />}
                {browser.label}
              </button>
            ))}
          </div>
          {locked && !error && (
            <p id={`${id}-locked`} className="text-small text-text-muted">
              {locked}
            </p>
          )}
          {error && (
            <p id={`${id}-error`} className="text-small text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
