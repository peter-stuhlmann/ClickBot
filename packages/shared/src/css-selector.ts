// Element names of HTML, SVG and MathML a selector may name. Custom elements always contain a
// hyphen, so a word without one that is not in this list matches nothing on a real page.
const KNOWN_TAGS = new Set(
  `a abbr address area article aside audio b base bdi bdo blockquote body br button canvas
  caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed
  fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe
  img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol
  optgroup option output p param picture pre progress q rp rt ruby s samp script search section
  select slot small source span strong style sub summary sup table tbody td template textarea
  tfoot th thead time title tr track u ul var video wbr center font marquee frame frameset
  svg g path circle ellipse line polyline polygon rect text tspan textpath use defs symbol
  clippath mask pattern image lineargradient radialgradient stop filter foreignobject marker
  desc math mi mn mo ms mtext mrow mfrac msqrt mroot msub msup`.split(/\s+/),
);

/**
 * A hint when a CSS selector names an element that does not exist, e.g. „decline“ where
 * `.decline` or `#decline` was meant. Null when every element name in it is real.
 */
export function unknownTagHint(selector: string): string | null {
  // Attribute brackets and quoted strings may contain any words; they are not element names.
  const outside = selector.replace(/\[[^\]]*\]|"[^"]*"|'[^']*'/g, ' ');
  // An element name starts the selector or follows a combinator, a comma or "(" (e.g. :not(p)).
  for (const match of outside.matchAll(/(?:^|[\s>+~,(])([a-zA-Z][a-zA-Z0-9]*)(?![\w-])/g)) {
    const word = match[1] as string;
    if (!KNOWN_TAGS.has(word.toLowerCase())) {
      return `„${word}“ sucht ein Element <${word}>, das es in HTML nicht gibt. Gemeint ist wohl .${word} (Klasse) oder #${word} (ID).`;
    }
  }
  return null;
}
