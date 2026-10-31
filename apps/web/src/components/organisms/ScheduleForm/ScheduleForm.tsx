'use client';

import { weekdaysIn, WEEKDAYS, FLAT_CURVE, type Weekday } from '@click-bot/shared';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { SegmentedControl } from '@/components/atoms/SegmentedControl';
import { Select } from '@/components/molecules/Select';
import { Toggle } from '@/components/atoms/Toggle';
import { CurveEditor } from '@/components/molecules/CurveEditor';
import { DatePicker, type DatePickerHandle } from '@/components/molecules/DatePicker';
import { Field } from '@/components/molecules/Field';
import { SlotRow } from '@/components/molecules/SlotRow';
import { earliestEnd, endAfterNewStart } from '@/lib/calendar';
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
  { value: 'random', label: 'Zufall' },
] as const;

const DAYS: Record<Weekday, { short: string; long: string }> = {
  mon: { short: 'Mo', long: 'Montag' },
  tue: { short: 'Di', long: 'Dienstag' },
  wed: { short: 'Mi', long: 'Mittwoch' },
  thu: { short: 'Do', long: 'Donnerstag' },
  fri: { short: 'Fr', long: 'Freitag' },
  sat: { short: 'Sa', long: 'Samstag' },
  sun: { short: 'So', long: 'Sonntag' },
};

const START_OPTIONS = [
  { value: 'now', label: 'Sofort nach dem Anlegen' },
  { value: 'at', label: 'Zu einem Zeitpunkt' },
];

/**
 * "Zufall": a period, how many runs it gets, and per weekday a curve of how likely a start is
 * over the day. Only the weekdays the period touches can be set.
 */
function RandomFields({
  schedule,
  errors,
  set,
}: {
  schedule: ScheduleDraft;
  errors: ScheduleErrors;
  set: (patch: Partial<ScheduleDraft>) => void;
}) {
  const days = weekdaysIn(schedule.randomFrom, schedule.randomTo);
  const offered = days.length > 0 ? days : [...WEEKDAYS];
  const [chosen, setChosen] = useState<Weekday>(offered[0] as Weekday);
  const day = offered.includes(chosen) ? chosen : (offered[0] as Weekday);
  const points = schedule.curves[day];
  const setCurves = (curves: Partial<Record<Weekday, number[]>>) =>
    set({ curves: { ...schedule.curves, ...curves } });

  // The period: a start chosen in the calendar opens the end, which never lies before it.
  const endPicker = useRef<DatePickerHandle>(null);
  const [startsPicked, setStartsPicked] = useState(0);
  useEffect(() => {
    if (startsPicked > 0) endPicker.current?.open();
  }, [startsPicked]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="schedule-random-from" label="Von" error={errors.fields.from}>
          {(control) => (
            <DatePicker
              {...control}
              label="Von"
              required
              value={schedule.randomFrom}
              onChange={(randomFrom) => set({ randomFrom })}
              onPick={(randomFrom) => {
                set({ randomFrom, randomTo: endAfterNewStart(randomFrom, schedule.randomTo) });
                setStartsPicked((count) => count + 1);
              }}
            />
          )}
        </Field>
        <Field id="schedule-random-to" label="Bis" error={errors.fields.to}>
          {(control) => (
            <DatePicker
              {...control}
              ref={endPicker}
              label="Bis"
              required
              min={earliestEnd(schedule.randomFrom)}
              value={schedule.randomTo}
              onChange={(randomTo) => set({ randomTo })}
            />
          )}
        </Field>
      </div>
      <Field
        id="schedule-random-runs"
        label="Durchläufe im Zeitraum"
        hint="Jeder Durchlauf startet zu einer zufälligen Zeit. Die Kurven legen fest, wann das wahrscheinlicher ist."
        error={errors.fields.runs}
      >
        {(control) => (
          <Input
            {...control}
            inputMode="numeric"
            value={schedule.randomRuns}
            onChange={(event) => set({ randomRuns: event.target.value })}
          />
        )}
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-body font-medium text-text">Verteilung über den Tag</span>
          <span className="text-meta text-text-muted">
            Mitte ist normal, oben doppelt so häufig, ganz unten nie. Ein Tag mit höherer Kurve
            bekommt mehr Durchläufe.
          </span>
        </div>
        <SegmentedControl
          label="Wochentag"
          options={offered.map((value) => ({ value, label: DAYS[value].short }))}
          value={day}
          onChange={setChosen}
        />
        <CurveEditor
          label={`Verteilung am ${DAYS[day].long}`}
          points={points}
          onChange={(next) => setCurves({ [day]: next })}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCurves({ [day]: [...FLAT_CURVE] })}>
            {`${DAYS[day].long} gleichmäßig`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCurves(Object.fromEntries(WEEKDAYS.map((other) => [other, [...points]])))
            }
          >
            Für alle Wochentage übernehmen
          </Button>
        </div>
        {errors.fields.curves && <p className="text-small text-danger">{errors.fields.curves}</p>}
      </div>
    </>
  );
}

/** Step 3 of the job wizard: a fixed interval, explicit dates, or random starts in a period. */
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
      title="Wann soll der Test laufen?"
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
          Der Test hat schon Durchläufe, deshalb bleibt die Art des Zeitplans.
        </p>
      )}
      {errors.fields.type && <p className="text-small text-danger">{errors.fields.type}</p>}

      {schedule.type === 'interval' && (
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
            <Field id="schedule-max-runs" label="Max. Durchläufe" error={errors.fields.maxRuns}>
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
                onChange={(startMode) =>
                  set({ startMode: startMode as ScheduleDraft['startMode'] })
                }
              />
            )}
          </Field>
          {schedule.startMode === 'at' && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="schedule-start-date" label="Startdatum" error={startError}>
                {(control) => (
                  <DatePicker
                    {...control}
                    label="Startdatum"
                    required
                    value={schedule.startDate}
                    onChange={(startDate) => set({ startDate })}
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
      )}

      {schedule.type === 'times' && (
        <>
          <div className="flex flex-col gap-2">
            <div
              aria-hidden="true"
              className="flex gap-2 text-label font-medium text-text-muted uppercase"
            >
              <span className="flex-1">Datum &amp; Uhrzeit</span>
              <span className="w-36">Browser</span>
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
              >
                {(date) => <DatePicker {...date} />}
              </SlotRow>
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
                Mehrere Durchläufe eines Termins starten im Abstand von {schedule.staggerSeconds} s
                statt alle in derselben Sekunde.
              </span>
            </div>
          </div>
        </>
      )}

      {schedule.type === 'random' && <RandomFields schedule={schedule} errors={errors} set={set} />}

      {note && (
        <p className="rounded-input bg-subtle px-3 py-2.5 text-small text-text-muted">{note}</p>
      )}
    </Card>
  );
}
