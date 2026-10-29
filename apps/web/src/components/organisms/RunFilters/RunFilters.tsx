import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Select, type SelectOption } from '@/components/atoms/Select';
import { Field } from '@/components/molecules/Field';

export type RunFiltersProps = {
  /** Current filter values, as in the address. */
  values: { projekt: string; ergebnis: string; zeitraum: string; geraet: string };
  customers: SelectOption[];
  results: readonly SelectOption[];
  periods: readonly SelectOption[];
  devices: readonly SelectOption[];
};

/**
 * Filters of the run list as a plain GET form: the result is a link that can be bookmarked,
 * and it works without JavaScript.
 */
export function RunFilters({ values, customers, results, periods, devices }: RunFiltersProps) {
  return (
    <Card title="Filter">
      {/*
        The selects keep their own value (defaultValue). A new key per filter state rebuilds
        them after a navigation within the app, e.g. "Filter zurücksetzen".
      */}
      <form
        key={JSON.stringify(values)}
        method="get"
        action="/laeufe"
        aria-label="Läufe filtern"
        // Beside the table (xl) one column; above it two or four, so the runs stay in view.
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:flex xl:flex-col"
      >
        <Field id="filter-project" label="Projekt">
          {(control) => (
            <Select
              {...control}
              name="projekt"
              options={customers}
              placeholder="Alle Projekte"
              defaultValue={values.projekt}
            />
          )}
        </Field>
        <Field id="filter-result" label="Ergebnis">
          {(control) => (
            <Select
              {...control}
              name="ergebnis"
              options={results}
              placeholder="Alle"
              defaultValue={values.ergebnis}
            />
          )}
        </Field>
        <Field id="filter-period" label="Zeitraum">
          {(control) => (
            <Select {...control} name="zeitraum" options={periods} defaultValue={values.zeitraum} />
          )}
        </Field>
        <Field id="filter-device" label="Gerät">
          {(control) => (
            <Select
              {...control}
              name="geraet"
              options={devices}
              placeholder="Alle Geräte"
              defaultValue={values.geraet}
            />
          )}
        </Field>
        <div className="col-span-2 flex flex-col gap-2 sm:flex-row md:col-span-4 xl:flex-col">
          <Button type="submit" fullWidth>
            Filter anwenden
          </Button>
          <Button variant="secondary" fullWidth href="/laeufe">
            Filter zurücksetzen
          </Button>
        </div>
      </form>
    </Card>
  );
}
