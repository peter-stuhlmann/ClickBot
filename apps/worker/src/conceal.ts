import type { BrowserContext, Page } from 'playwright';

/** Where a page finds the concealment of its frame; a symbol, so it clashes with nothing. */
const API = 'click-bot.conceal';

/**
 * Runs in every page and iframe of a run with secrets, before the page's own scripts. It lays an
 * opaque, blurred-looking box over every place that shows a secret: text with a value (exactly
 * the value, via a Range), a field holding one (not a password field: its dots show nothing), and
 * the field with the focus while a secret is typed into it letter by letter. The boxes live in a
 * shadow root of their own, take no clicks and change no layout; as a popover they stay above
 * modal dialogs too.
 *
 * Timing: changes are caught by a MutationObserver and the input events, both before the browser
 * paints again; positions follow every frame while a box is shown. So a frame, a screenshot or a
 * video never shows a secret in the clear, also not for one frame.
 */
const PAGE_SCRIPT = String.raw`(values) => {
  const KEY = Symbol.for('${API}');
  const PAD = 4;
  if (values.length === 0) return;
  // Per document: Firefox runs this once in an iframe's about:blank, and the page then comes
  // into the same window. Its DOMContentLoaded reaches the window, and the page gets its own.
  const start = () => {
    if (document[KEY]) return;
    let host = null;
    let layer = null;
    let fields = [];
    let ranges = [];
    let following = false;

    const holds = (value) => values.some((secret) => value.includes(secret));
    const typing = (value) => value.length > 0 && values.some((secret) => secret.startsWith(value));

    const scan = () => {
      fields = [];
      for (const field of document.querySelectorAll('input, textarea')) {
        const value = field.value || '';
        // A password field shows dots: that something is in it, not what. Shown as text, it counts.
        if (field.type === 'password') continue;
        if (holds(value) || (field === document.activeElement && typing(value))) {
          fields.push(field);
        }
      }
      ranges = [];
      if (!document.body) return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const secret of values) {
          for (let at = node.data.indexOf(secret); at !== -1; at = node.data.indexOf(secret, at + 1)) {
            ranges.push([node, at, at + secret.length]);
          }
        }
      }
    };

    const rects = () => {
      const found = [];
      for (const field of fields) if (field.isConnected) found.push(...field.getClientRects());
      for (const [node, start, end] of ranges) {
        if (!node.isConnected || end > node.data.length) continue;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        found.push(...range.getClientRects());
      }
      return found.filter((rect) => rect.width > 0 && rect.height > 0);
    };

    // Above everything the page shows, also a modal dialog or a popover opened later.
    const raise = () => {
      if (!host || typeof host.showPopover !== 'function') return;
      try {
        if (host.matches(':popover-open')) host.hidePopover();
        host.showPopover();
      } catch {
        // Not shown as a popover: still on top of everything outside the top layer.
      }
    };

    const paint = () => {
      const found = rects();
      if (found.length === 0) {
        host?.remove();
        host = null;
        layer = null;
        return;
      }
      if (!host) {
        host = document.createElement('click-bot-conceal');
        host.setAttribute('popover', 'manual');
        host.style.cssText =
          'all: initial !important; position: absolute !important; inset: 0 auto auto 0 !important;' +
          'width: 0 !important; height: 0 !important; overflow: visible !important;' +
          'margin: 0 !important; padding: 0 !important; border: 0 !important;' +
          'background: none !important; z-index: 2147483647 !important; pointer-events: none !important;';
        layer = host.attachShadow({ mode: 'open' });
      }
      if (!host.isConnected) {
        document.documentElement.appendChild(host);
        raise();
      }
      while (layer.childElementCount > found.length) layer.lastElementChild.remove();
      while (layer.childElementCount < found.length) layer.appendChild(document.createElement('div'));
      // Absolute in the page, so they scroll with it; relative to the window in the top layer.
      const shown = host.matches(':popover-open');
      const dx = shown ? 0 : window.scrollX;
      const dy = shown ? 0 : window.scrollY;
      found.forEach((rect, index) => {
        layer.children[index].style.cssText =
          'position: ' + (shown ? 'fixed' : 'absolute') + '; pointer-events: none;' +
          'left: ' + (rect.left + dx - PAD) + 'px; top: ' + (rect.top + dy - PAD) + 'px;' +
          'width: ' + (rect.width + 2 * PAD) + 'px; height: ' + (rect.height + 2 * PAD) + 'px;' +
          // Opaque, like frosted glass: Firefox and WebKit paint no backdrop-filter in screenshots.
          'border-radius: 4px; background: linear-gradient(100deg, #cbd5e1, #e2e8f0 45%, #cbd5e1);' +
          'box-shadow: 0 0 6px 2px rgba(203, 213, 225, 0.9);';
      });
      if (!following) {
        following = true;
        const follow = () => {
          if (!host) {
            following = false;
            return;
          }
          paint();
          requestAnimationFrame(follow);
        };
        requestAnimationFrame(follow);
      }
    };

    const update = () => {
      scan();
      paint();
    };

    new MutationObserver((records) => {
      update();
      // A dialog or popover that opens goes above everything: the boxes go above it again.
      if (records.some((record) => record.attributeName === 'open')) raise();
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open', 'type', 'value'],
    });
    for (const type of ['input', 'change', 'focusin', 'focusout']) {
      document.addEventListener(type, update, true);
    }
    document.addEventListener('toggle', raise, true);
    document.addEventListener('DOMContentLoaded', update);

    /** Whether a secret is shown that no box covers: in text split over elements, for example. */
    const exposed = () => {
      update();
      const text = document.body ? document.body.innerText : '';
      let shown = 0;
      for (const secret of values) {
        for (let at = text.indexOf(secret); at !== -1; at = text.indexOf(secret, at + 1)) shown++;
      }
      // Only places the page shows count as covered, as only those are in innerText.
      const covered = ranges.filter(([node]) => {
        const parent = node.parentElement;
        if (!parent) return false;
        if (typeof parent.checkVisibility === 'function') {
          return parent.checkVisibility({ visibilityProperty: true });
        }
        return parent.getClientRects().length > 0;
      }).length;
      return shown > covered;
    };
    Object.defineProperty(document, KEY, { value: { exposed } });
    update();
  };
  start();
  addEventListener('DOMContentLoaded', start, true);
}`;

/**
 * Product rule: secrets never appear in pictures. Blurs every place of every page of the context
 * that shows one (see PAGE_SCRIPT), for screenshots, the live view and videos alike.
 */
export async function concealSecrets(context: BrowserContext, secrets: string[]): Promise<void> {
  const values = [...new Set(secrets.filter(Boolean))];
  if (values.length === 0) return;
  await context.addInitScript({ content: `(${PAGE_SCRIPT})(${JSON.stringify(values)});` });
}

/**
 * Whether a picture of the page now could show a secret in the clear. With the concealment the
 * page itself knows; a frame without it (or one that cannot be read) counts its text and fields.
 */
export async function exposesSecret(page: Page, secrets: string[]): Promise<boolean> {
  const values = secrets.filter(Boolean);
  if (values.length === 0) return false;
  for (const frame of page.frames()) {
    const exposed = await frame
      .evaluate(
        ([key, list]) => {
          const concealment = (document as unknown as Record<symbol, { exposed(): boolean }>)[
            Symbol.for(key)
          ];
          if (concealment) return concealment.exposed();
          const fields = [...document.querySelectorAll('input, textarea')].map(
            (field) => (field as HTMLInputElement).value,
          );
          const text = [document.body?.innerText ?? '', ...fields].join('\n');
          return list.some((value) => text.includes(value));
        },
        [API, values] as const,
      )
      .catch(() => true);
    if (exposed) return true;
  }
  return false;
}
