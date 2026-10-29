import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Select, type SelectOption } from '@/components/atoms/Select';
import { Field } from '@/components/molecules/Field';

export type RunFiltersProps = {
  /** Current filter values, as in the address. */
  values: { kampagne: string; ergebnis: string; zeitraum: string; geraet: string };
  /** The campaigns of the current project. */
  campaigns: SelectOption[];
  results: readonly SelectOption[];
  periods: readonly SelectOption[];
  devices: readonly SelectOption[];
};

/**
 * Filters of the run list as a plain GET form: the result is a link that can be bookmarked,
 * and it works without JavaScript.
 */
export function RunFilters({ values, campaigns, results, periods, devices }: RunFiltersProps) {
  return (
    // No title: the bar stays at the top while the runs scroll, so it is kept low.
    <Card>
      {/*
        The selects keep their own value (defaultValue). A new key per filter state rebuilds
        them after a navigation within the app, e.g. "Filter zurücksetzen".
      */}
      <form
        key={JSON.stringify(values)}
        method="get"
        action="/laeufe"
        aria-label="Läufe filtern"
        // Two or four columns above the table; from xl one row with the buttons at the end.
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
              />
            )}
          </Field>
        </div>
        <div className="col-span-2 flex flex-col gap-2 sm:flex-row md:col-span-4 xl:shrink-0">
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
