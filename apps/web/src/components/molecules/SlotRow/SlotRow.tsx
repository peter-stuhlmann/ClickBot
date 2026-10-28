import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';

export const MAX_BOTS_PER_SLOT = 50;

export type SlotValue = { date: string; time: string; bots: number };

export type SlotRowProps = {
  /** 0-based position; labels count from 1. */
  index: number;
  slot: SlotValue;
  error?: string;
  onChange: (slot: SlotValue) => void;
  /** Omitted while this is the only slot. */
  onRemove?: () => void;
};

/** One date of a "Termine" schedule: date, time and the number of bots of its wave. */
export function SlotRow({ index, slot, error, onChange, onRemove }: SlotRowProps) {
  const name = `Termin ${index + 1}`;
  const errorId = `slot-${index}-error`;
  const invalid = error ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {};
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={`Datum ${name}`}
          value={slot.date}
          onChange={(event) => onChange({ ...slot, date: event.target.value })}
          className="flex-1"
          {...invalid}
        />
        <Input
          type="time"
          aria-label={`Uhrzeit ${name}`}
          value={slot.time}
          onChange={(event) => onChange({ ...slot, time: event.target.value })}
          className="w-28"
          {...invalid}
        />
        <div className="flex items-center rounded-input border border-border-strong">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Ein Bot weniger (${name})`}
            disabled={slot.bots <= 1}
            onClick={() => onChange({ ...slot, bots: slot.bots - 1 })}
            icon={<Icon name="minus" size={16} />}
          />
          <span className="w-8 text-center text-body font-medium text-text" aria-live="polite">
            {slot.bots}
            <span className="sr-only"> {slot.bots === 1 ? 'Bot' : 'Bots'}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-primary"
            aria-label={`Ein Bot mehr (${name})`}
            disabled={slot.bots >= MAX_BOTS_PER_SLOT}
            onClick={() => onChange({ ...slot, bots: slot.bots + 1 })}
            icon={<Icon name="plus" size={16} />}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          aria-label={`${name} entfernen`}
          disabled={!onRemove}
          onClick={onRemove}
          icon={<Icon name="close" size={16} />}
        />
      </div>
      {error && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
