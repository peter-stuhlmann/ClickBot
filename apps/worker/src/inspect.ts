import { type Target } from '@click-bot/shared';
import { findTarget, describeTarget, type PageSource } from './targets';

const toHex = (channels: number[]) =>
  `#${channels.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/**
 * A computed CSS colour as the report shows it: the value the browser reports and its #HEX, e.g.
 * "rgb(200, 0, 0) / #C80000". Transparent and half transparent colours say so. Anything that is
 * not an rgb or sRGB colour is shown as it is.
 */
export function describeColor(css: string): string {
  const text = css.trim();
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(text);
  const srgb =
    /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i.exec(text);
  const match = rgb ?? srgb;
  if (!match) return text;
  const scale = srgb ? 255 : 1;
  const channels = [match[1], match[2], match[3]].map((value) =>
    Math.min(255, Math.round(Number(value) * scale)),
  );
  const alphaText = match[4];
  const alpha =
    alphaText === undefined
      ? 1
      : Number.parseFloat(alphaText) / (alphaText.endsWith('%') ? 100 : 1);
  if (alpha === 0) return 'transparent';
  const hex = toHex(channels);
  if (alpha >= 1) return `rgb(${channels.join(', ')}) / ${hex}`;
  const percent = Math.round(alpha * 100);
  return `rgba(${channels.join(', ')}, ${alpha}) / ${hex} bei ${percent} % Deckkraft`;
}

/** What the browser computed for an element, as the page reports it. */
type Computed = {
  text: string;
  color: string;
  background: string;
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
};

/**
 * Reads the computed style of the one element `target` finds (also in an iframe): text, font
 * colour, the background that is really seen (the first one that is not transparent, up the
 * parents), size, weight and font. A line of German text for the AI and the report. Changes nothing.
 */
export async function inspectTarget(
  page: PageSource,
  target: Target,
  timeoutMs: number,
): Promise<string> {
  const locator = await findTarget(page, target, timeoutMs);
  // No named inner functions in here: tsx wraps them in __name(), which the page does not have.
  const computed: Computed = await locator.evaluate(
    (element) => {
      const style = getComputedStyle(element);
      let background = style.backgroundColor;
      let owner: Element | null = element;
      while (owner && (background === 'transparent' || /^rgba\(.*,\s*0\)$/.test(background))) {
        owner = owner.parentElement;
        if (owner) background = getComputedStyle(owner).backgroundColor;
      }
      return {
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
        color: style.color,
        background,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
      };
    },
    undefined,
    { timeout: timeoutMs },
  );
  const family =
    computed.fontFamily
      .split(',')[0]
      ?.trim()
      .replace(/^["']|["']$/g, '') ?? '';
  return [
    `${describeTarget(target)}`,
    `Text „${computed.text}“`,
    `Schriftfarbe ${describeColor(computed.color)}`,
    `Hintergrund ${describeColor(computed.background)}`,
    `Schriftgröße ${computed.fontSize}`,
    `Schriftstärke ${computed.fontWeight}`,
    `Schriftart ${family}`,
  ].join(' · ');
}
