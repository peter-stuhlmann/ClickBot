import type { Page } from 'playwright';

/** Elements shown at most; the count of all matches is always given. */
export const QUERY_LIMIT = 40;
const MAX_VALUE_CHARS = 120;
const MAX_TEXT_CHARS = 60;

/** The attributes of an element that matter most for the common questions. */
const DEFAULT_ATTRIBUTES: Record<string, string[]> = {
  img: ['alt', 'src', 'title', 'aria-label', 'loading'],
  a: ['href', 'aria-label', 'title', 'target', 'rel'],
  input: ['type', 'name', 'id', 'placeholder', 'aria-label', 'autocomplete'],
  button: ['type', 'aria-label', 'title'],
};
const GENERIC_ATTRIBUTES = ['id', 'class', 'aria-label', 'role'];

export type QueriedElement = {
  tag: string;
  /** null: the attribute is not there; '': it is there and empty. */
  attributes: Record<string, string | null>;
  text: string;
  visible: boolean;
};

export type QueryResult = { total: number; elements: QueriedElement[] };

const shorten = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

/** One German line for the AI: "alt fehlt", "alt leer" and `alt=„…“` are told apart. */
function describeElement(element: QueriedElement, index: number): string {
  const parts = Object.entries(element.attributes).map(([name, value]) => {
    if (value === null) return `${name} fehlt`;
    if (value === '') return `${name} leer`;
    return `${name}=„${shorten(value, MAX_VALUE_CHARS)}“`;
  });
  if (element.text) parts.push(`Text „${shorten(element.text, MAX_TEXT_CHARS)}“`);
  if (!element.visible) parts.push('versteckt');
  return `${index + 1}. <${element.tag}> ${parts.join(' · ')}`;
}

/**
 * The text for the AI: how many elements the selector matched in total, and each of the first
 * ones with its attributes. A missing attribute and an empty one are told apart, because for an
 * `alt` it is the difference between an error and a decorative image.
 */
export function describeQuery(selector: string, result: QueryResult): string {
  if (result.total === 0) return `Keine Treffer für „${selector}“.`;
  const shown = result.elements.length;
  const head =
    shown < result.total
      ? `${result.total} Treffer für „${selector}“, die ersten ${shown}:`
      : `${result.total} Treffer für „${selector}“:`;
  return [head, ...result.elements.map(describeElement)].join('\n');
}

/**
 * Lists the elements a CSS selector matches in the page and its iframes, with their attributes
 * (the usual ones for the tag unless `attributes` says which). Changes nothing. An invalid
 * selector is reported as text, so the AI can correct it.
 */
export async function queryElements(
  page: Page,
  selector: string,
  attributes: readonly string[] | undefined,
): Promise<string> {
  const total: QueryResult = { total: 0, elements: [] };
  for (const frame of page.frames()) {
    // No named inner functions in here: tsx wraps them in __name(), which the page does not have.
    const found = await frame
      .evaluate(
        (args) => {
          let matches: Element[];
          try {
            matches = [...document.querySelectorAll(args.selector)];
          } catch {
            return { invalid: true as const };
          }
          const elements = [];
          for (const element of matches.slice(0, args.limit)) {
            const tag = element.tagName.toLowerCase();
            const names = args.attributes ?? args.defaults[tag] ?? args.generic;
            const values: Record<string, string | null> = {};
            for (const name of names) values[name] = element.getAttribute(name);
            elements.push({
              tag,
              attributes: values,
              text: tag === 'img' ? '' : (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
              visible:
                typeof element.checkVisibility === 'function' ? element.checkVisibility() : true,
            });
          }
          return { invalid: false as const, total: matches.length, elements };
        },
        {
          selector,
          attributes: attributes ? [...attributes] : null,
          limit: QUERY_LIMIT,
          defaults: DEFAULT_ATTRIBUTES,
          generic: GENERIC_ATTRIBUTES,
        },
      )
      .catch(() => null);
    if (!found) continue;
    if (found.invalid) return `Ungültiger CSS-Selektor: „${selector}“.`;
    total.total += found.total;
    total.elements.push(...found.elements.slice(0, QUERY_LIMIT - total.elements.length));
  }
  return describeQuery(selector, total);
}
