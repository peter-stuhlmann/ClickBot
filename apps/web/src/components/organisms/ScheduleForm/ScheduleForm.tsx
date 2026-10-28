import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { SegmentedControl } from '@/components/atoms/SegmentedControl';
import { Select } from '@/components/atoms/Select';
import { Toggle } from '@/components/atoms/Toggle';
import { Field } from '@/components/molecules/Field';
import { SlotRow } from '@/components/molecules/SlotRow';
import { addSlot, type ScheduleDraft, type ScheduleErrors } from '@/lib/job-draft';

export type ScheduleFormProps = {
  schedule: ScheduleDraft;
  errors: ScheduleErrors;
  /** Summary below the form, e.g. "3 Termine · 10 Bots gesamt". */
  note?: string | null;
  onChange: (schedule: ScheduleDraft) => void;
  /** Positions of dates that already have runs (editor); they cannot move. */
  lockedSlots?: readonly number[];
  /** The job already has runs, so interval/dates may not switch. */
  typeLocked?: boolean;
};

const TYPE_OPTIONS = [
  { value: 'interval', label: 'Intervall' },
  { value: 'times', label: 'Termine' },
] as const;

const START_OPTIONS = [
  { value: 'now', label: 'Sofort nach dem Anlegen' },
  { value: 'at', label: 'Zu einem Zeitpunkt' },
];

/** Step 3 of the job wizard: a fixed interval or explicit dates with a wave of bots each. */
export function ScheduleForm({
  schedule,
  errors,
  note,
  onChange,
  lockedSlots = [],
  typeLocked = false,
}: ScheduleFormProps) {
  const set = (patch: Partial<ScheduleDraft>) => onChange({ ...schedule, ...patch });
  const startError = errors.fields.startAt;
  // Removing a date before one with runs would move that one, so only later dates can go.
  const lastLocked = Math.max(-1, ...lockedSlots);

  return (
    <Card
      title="Wann soll der Bot laufen?"
      description="Alle Zeiten in deutscher Zeit (Europe/Berlin)."
    >
      <SegmentedControl
        label="Art des Zeitplans"
        options={TYPE_OPTIONS}
        value={schedule.type}
        onChange={(type) => set({ type })}
        disabled={typeLocked}
      />
      {typeLocked && (
        <p className="text-small text-text-muted">
          Der Job hat schon Läufe, deshalb bleibt die Art des Zeitplans.
        </p>
      )}
      {errors.fields.type && <p className="text-small text-danger">{errors.fields.type}</p>}

      {schedule.type === 'interval' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field id="schedule-every" label="Alle (Minuten)" error={errors.fields.everyMinutes}>
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  value={schedule.everyMinutes}
                  onChange={(event) => set({ everyMinutes: event.target.value })}
                />
              )}
            </Field>
            <Field id="schedule-max-runs" label="Max. Läufe" error={errors.fields.maxRuns}>
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  value={schedule.maxRuns}
                  onChange={(event) => set({ maxRuns: event.target.value })}
                />
              )}
            </Field>
          </div>
          <Field
            id="schedule-start"
            label="Start"
            error={schedule.startMode === 'now' ? startError : undefined}
          >
            {(control) => (
              <Select
                {...control}
                options={START_OPTIONS}
                value={schedule.startMode}
                onChange={(event) =>
                  set({ startMode: event.target.value as ScheduleDraft['startMode'] })
                }
              />
            )}
          </Field>
          {schedule.startMode === 'at' && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="schedule-start-date" label="Startdatum" error={startError}>
                {(control) => (
                  <Input
                    {...control}
                    type="date"
                    value={schedule.startDate}
                    onChange={(event) => set({ startDate: event.target.value })}
                  />
                )}
              </Field>
              <Field id="schedule-start-time" label="Startzeit">
                {(control) => (
                  <Input
                    {...control}
                    type="time"
                    value={schedule.startTime}
                    onChange={(event) => set({ startTime: event.target.value })}
                  />
                )}
              </Field>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div
              aria-hidden="true"
              className="flex gap-2 text-label font-medium text-text-muted uppercase"
            >
              <span className="flex-1">Datum &amp; Uhrzeit</span>
              <span className="w-36">Bots</span>
            </div>
            {schedule.slots.map((slot, index) => (
              <SlotRow
                key={slot.key}
                index={index}
                slot={slot}
                locked={lockedSlots.includes(index)}
                error={errors.slots[index]}
                onChange={(value) =>
                  set({
                    slots: schedule.slots.map((other) =>
                      other.key === slot.key ? { ...other, ...value } : other,
                    ),
                  })
                }
                onRemove={
                  schedule.slots.length > 1 && index > lastLocked
                    ? () => set({ slots: schedule.slots.filter((other) => other.key !== slot.key) })
                    : undefined
                }
              />
            ))}
            {errors.fields.slots && <p className="text-small text-danger">{errors.fields.slots}</p>}
          </div>
          <Button
            variant="secondary"
            fullWidth
            className="border-dashed text-text-muted"
            icon={<Icon name="plus" size={16} />}
            onClick={() => set({ slots: addSlot(schedule.slots) })}
          >
            Termin hinzufügen
          </Button>
          <div className="flex items-start gap-3">
            <Toggle
              checked={schedule.stagger}
              label="Gestaffelt starten"
              onClick={() => set({ stagger: !schedule.stagger })}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-text">Gestaffelt starten</span>
              <span className="text-meta text-text-muted">
                Bots eines Termins starten im Abstand von {schedule.staggerSeconds} s statt alle in
                derselben Sekunde.
              </span>
            </div>
          </div>
        </>
      )}

      {note && (
        <p className="rounded-input bg-subtle px-3 py-2.5 text-small text-text-muted">{note}</p>
      )}
    </Card>
  );
}
