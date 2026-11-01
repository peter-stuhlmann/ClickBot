'use client';

import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Select, type SelectOption } from '@/components/molecules/Select';
import { Field } from '@/components/molecules/Field';
import { cn } from '@/lib/cn';

export type RunFiltersProps = {
  /** Current filter values, as in the address. */
  values: { kampagne: string; ergebnis: string; zeitraum: string; geraet: string };
  /** The campaigns of the current project. */
  campaigns: SelectOption[];
  results: readonly SelectOption[];
  periods: readonly SelectOption[];
  devices: readonly SelectOption[];
};

/** The address for the form's values, with `name` set to `value`; empty filters are left out. */
export function filterHref(form: HTMLFormElement, name: string, value: string): string {
  const params = new URLSearchParams();
  for (const [key, entry] of new FormData(form)) {
    if (typeof entry === 'string' && entry !== '') params.set(key, entry);
  }
  if (value === '') params.delete(name);
  else params.set(name, value);
  const query = params.toString();
  return query ? `/laeufe?${query}` : '/laeufe';
}

/**
 * Filters of the run list. A change applies at once, as a navigation within the app, so the
 * result is an address that can be bookmarked. Without JavaScript the same form sends itself
 * as a plain GET request.
 */
export function RunFilters({ values, campaigns, results, periods, devices }: RunFiltersProps) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  // A transition keeps the filters and the old list on screen until the new list is there.
  const [pending, startTransition] = useTransition();

  const apply = (name: string) => (value: string) => {
    if (!form.current) return;
    const href = filterHref(form.current, name, value);
    startTransition(() => router.push(href));
  };

  return (
    // No title: the bar stays at the top while the runs scroll, so it is kept low.
    <Card className={cn('transition-opacity', pending && 'opacity-70')}>
      {/*
        The selects keep their own value (defaultValue). A new key per filter state rebuilds
        them after a navigation within the app, e.g. "Filter zurücksetzen".
      */}
      <form
        key={JSON.stringify(values)}
        ref={form}
        method="get"
        action="/laeufe"
        aria-label="Durchläufe filtern"
        aria-busy={pending || undefined}
        // Two or four columns above the table; from xl one row with the reset at the end.
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:flex xl:items-end"
      >
        <div className="min-w-0 xl:flex-1">
          <Field id="filter-campaign" label="Kampagne">
            {(control) => (
              <Select
                {...control}
                name="kampagne"
                options={campaigns}
                placeholder="Alle Kampagnen"
                defaultValue={values.kampagne}
                onChange={apply('kampagne')}
              />
            )}
          </Field>
        </div>
        <div className="min-w-0 xl:flex-1">
          <Field id="filter-result" label="Ergebnis">
            {(control) => (
              <Select
                {...control}
                name="ergebnis"
                options={results}
                placeholder="Alle"
                defaultValue={values.ergebnis}
                onChange={apply('ergebnis')}
              />
            )}
          </Field>
        </div>
        <div className="min-w-0 xl:flex-1">
          <Field id="filter-period" label="Zeitraum">
            {(control) => (
              <Select
                {...control}
                name="zeitraum"
                options={periods}
                defaultValue={values.zeitraum}
                onChange={apply('zeitraum')}
              />
            )}
          </Field>
        </div>
        <div className="min-w-0 xl:flex-1">
          <Field id="filter-device" label="Gerät">
            {(control) => (
              <Select
                {...control}
                name="geraet"
                options={devices}
                placeholder="Alle Geräte"
                defaultValue={values.geraet}
                onChange={apply('geraet')}
              />
            )}
          </Field>
        </div>
        <div className="col-span-2 flex flex-col gap-2 sm:flex-row md:col-span-4 xl:shrink-0">
          {/* Only without JavaScript: with it, every change applies itself. */}
          <noscript>
            <Button type="submit" fullWidth>
              Filter anwenden
            </Button>
          </noscript>
          <Button variant="secondary" fullWidth href="/laeufe">
            Filter zurücksetzen
          </Button>
        </div>
      </form>
    </Card>
  );
}
