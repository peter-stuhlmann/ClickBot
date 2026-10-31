import type { Target } from '@click-bot/shared';
import type { BrowserContext, Frame } from 'playwright';
import { locate } from './targets';

/** A recorded step, before it gets its id in the flow (input of stepSchema). */
export type RecordedStep =
  | { type: 'open'; url: string }
  | { type: 'click'; target: Target }
  | { type: 'fill'; target: Target; value: string }
  | { type: 'select'; target: Target; option: string }
  | { type: 'assert'; assertion: { kind: 'elementVisible'; target: Target } }
  | { type: 'press'; key: string; target?: Target }
  | { type: 'scroll'; to: { kind: 'position'; y: number; x?: number } }
  | { type: 'screenshot' }
  | {
      type: 'wait';
      until:
        | { kind: 'duration'; ms: number }
        | { kind: 'networkIdle' }
        | { kind: 'element'; target: Target };
    };

/**
 * Everything is recorded from start to end. assert: the next click becomes a check instead;
 * wait: it becomes waiting for that element. The page does not react to that click.
 */
export type RecorderMode = 'record' | 'assert' | 'wait';

type Action =
  | { kind: 'click'; candidates: Target[] }
  | { kind: 'assert'; candidates: Target[] }
  | { kind: 'wait'; candidates: Target[] }
  | { kind: 'fill'; candidates: Target[]; value: string; secret: boolean }
  | { kind: 'select'; candidates: Target[]; option: string }
  // Without candidates the key goes to the page, not to an element.
  | { kind: 'press'; candidates: Target[]; key: string }
  // x only on a page wider than the window.
  | { kind: 'scroll'; y: number; x?: number };

export type Recorder = {
  setMode(mode: RecorderMode): Promise<void>;
  mode(): RecorderMode;
  /** Adds a step the user asks for (a photo, an address), after the actions before it. */
  insert(step: RecordedStep): Promise<void>;
};

const BINDING = '__clickbotRecord';
/** A password is never recorded; the step asks for the secret of this name instead. */
const PASSWORD_PLACEHOLDER = '{{secret.passwort}}';

/**
 * Runs in every document and iframe. Suggests targets for the element a user acted on, best
 * first; the worker keeps the first one that matches exactly one element. Kept as plain
 * JavaScript, because it is sent to the browser as text.
 */
const PAGE_SCRIPT = `(() => {
  if (window.__clickbotRecorder) return;
  window.__clickbotRecorder = true;
  window.__clickbotMode = window.__clickbotMode || 'record';
  const send = (action) => window.${BINDING} && window.${BINDING}(action);
  const clean = (text) => (text || '').replace(/\\s+/g, ' ').trim();
  const TEXT_TYPES = ['text', 'email', 'tel', 'url', 'search', 'password', 'number', 'date',
    'datetime-local', 'month', 'week', 'time', ''];
  const isTextField = (el) => el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && TEXT_TYPES.includes((el.getAttribute('type') || '').toLowerCase()));
  const CLICKABLE = 'a[href], button, input[type=submit], input[type=button], input[type=reset],' +
    ' input[type=checkbox], input[type=radio], input[type=image], [role=button], [role=link],' +
    ' [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=switch], [role=option],' +
    ' summary, label';

  function roleOf(el) {
    const explicit = (el.getAttribute('role') || '').split(' ')[0];
    if (explicit) return explicit;
    const tag = el.tagName;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'A' && el.hasAttribute('href')) return 'link';
    if (tag === 'BUTTON') return 'button';
    if (tag === 'INPUT') {
      if (['submit', 'button', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type !== 'password' && isTextField(el)) return 'textbox';
    }
    if (tag === 'TEXTAREA') return 'textbox';
    if (tag === 'SELECT') return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
    if (/^H[1-6]$/.test(tag)) return 'heading';
    if (tag === 'SUMMARY') return null;
    return null;
  }

  function labelOf(el) {
    const ids = el.getAttribute('aria-labelledby');
    if (ids) {
      return clean(ids.split(/\\s+/).map((id) => document.getElementById(id)?.textContent).join(' '));
    }
    if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
    if (el.labels && el.labels.length > 0) return clean(el.labels[0].textContent);
    return '';
  }

  function nameOf(el) {
    const label = labelOf(el);
    if (label) return label;
    if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type)) {
      return clean(el.value);
    }
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      return clean(el.getAttribute('placeholder') || el.getAttribute('title'));
    }
    const text = clean(el.textContent);
    if (text) return text;
    const img = el.querySelector && el.querySelector('img[alt]');
    return clean((img && img.getAttribute('alt')) || el.getAttribute('title'));
  }

  function cssPath(el) {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement;
      node = node.parentElement) {
      if (node.id && /^[A-Za-z][\\w-]*$/.test(node.id)) {
        parts.unshift('#' + node.id);
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      const same = parent ? [...parent.children].filter((c) => c.tagName === node.tagName) : [];
      if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      parts.unshift(part);
    }
    return parts.join(' > ');
  }

  function candidates(el, field) {
    const list = [];
    const name = nameOf(el);
    const role = roleOf(el);
    if (field) {
      const label = labelOf(el);
      if (label) list.push({ by: 'label', label });
    }
    if (role && name && name.length <= 80) list.push({ by: 'role', role, name });
    const testId = el.getAttribute('data-testid');
    if (testId) list.push({ by: 'testId', testId });
    if (!field && name && name.length <= 80) list.push({ by: 'text', text: name, exact: true });
    if (el.id && /^[A-Za-z][\\w-]*$/.test(el.id)) list.push({ by: 'css', selector: '#' + el.id });
    const fieldName = el.getAttribute('name');
    if (fieldName && /^[\\w-]+$/.test(fieldName)) {
      list.push({ by: 'css', selector: el.tagName.toLowerCase() + '[name="' + fieldName + '"]' });
    }
    list.push({ by: 'css', selector: cssPath(el) });
    return list;
  }

  // The last value sent per field, so change and submit do not report a value twice.
  const sent = new WeakMap();
  function sendField(el) {
    if (window.__clickbotMode !== 'record') return;
    if (el.tagName === 'SELECT') {
      const option = clean(el.selectedOptions[0] && el.selectedOptions[0].textContent);
      if (sent.get(el) === option) return;
      sent.set(el, option);
      send({ kind: 'select', candidates: candidates(el, true), option });
      return;
    }
    // Unchanged since the page set it (or since it was sent): nothing was typed.
    if (!isTextField(el) || (sent.has(el) ? sent.get(el) : el.defaultValue) === el.value) return;
    sent.set(el, el.value);
    const secret = el.type === 'password';
    send({ kind: 'fill', candidates: candidates(el, true), value: secret ? '' : el.value, secret });
  }

  let last = { el: null, at: 0 };
  function clicked(target) {
    let el = target.closest ? target.closest(CLICKABLE) : null;
    el = el || target;
    if (el.tagName === 'LABEL') {
      const control = el.control;
      if (control && (control.type === 'checkbox' || control.type === 'radio')) el = control;
      else if (control) return null;
    }
    if (isTextField(el) || el.tagName === 'SELECT' || el.tagName === 'OPTION') return null;
    return el;
  }

  // While choosing an element to check or to wait for, the page must not react to the click.
  const choosing = () => window.__clickbotMode === 'assert' || window.__clickbotMode === 'wait';
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    document.addEventListener(type, (event) => {
      if (choosing() && event.isTrusted) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  document.addEventListener('click', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    if (choosing()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const kind = window.__clickbotMode;
      window.__clickbotMode = 'record';
      send({ kind, candidates: candidates(event.target.closest(CLICKABLE) || event.target, false) });
      return;
    }
    if (window.__clickbotMode !== 'record') return;
    const el = clicked(event.target);
    if (!el) return;
    // A label forwards its click to the checkbox: one step, not two.
    const now = Date.now();
    if (last.el === el && now - last.at < 500) return;
    last = { el, at: now };
    if (document.activeElement && document.activeElement !== el) sendField(document.activeElement);
    send({ kind: 'click', candidates: candidates(el, false) });
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target instanceof Element) sendField(event.target);
  }, true);

  // Enter in a field submits without a click: record the submit button the browser used.
  let pendingEnter = null;
  document.addEventListener('submit', (event) => {
    clearTimeout(pendingEnter);
    if (window.__clickbotMode !== 'record') return;
    if (document.activeElement) sendField(document.activeElement);
    const button = event.submitter;
    if (!button || (last.el === button && Date.now() - last.at < 500)) return;
    last = { el: button, at: Date.now() };
    send({ kind: 'click', candidates: candidates(button, false) });
  }, true);

  // Keys no other step covers: Tab, Escape, shortcuts, keys on an element that has the focus.
  // Typing in a field is its fill step, Enter in a form the click on its submit button, a key
  // on a button or link its click, and a key that only scrolls the page the scroll step.
  const SCROLL_KEYS = ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
    'ArrowRight', ' '];
  let userScroll = 0;
  function combo(event) {
    const key = event.key === ' ' ? 'Space' : event.key;
    const command = event.ctrlKey || event.altKey || event.metaKey;
    // A capital letter carries its Shift already, unless a shortcut needs it spelled out.
    const shift = event.shiftKey && (key.length > 1 || command);
    return [event.ctrlKey && 'Control', event.altKey && 'Alt', shift && 'Shift',
      event.metaKey && 'Meta', key].filter(Boolean).join('+');
  }
  document.addEventListener('keydown', (event) => {
    if (!event.isTrusted || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    const el = event.target instanceof Element ? event.target : document.documentElement;
    const onPage = el === document.body || el === document.documentElement;
    const typing = isTextField(el) || el.isContentEditable || el.tagName === 'SELECT';
    if (onPage && SCROLL_KEYS.includes(event.key)) userScroll = Date.now();
    if (window.__clickbotMode !== 'record') return;
    const press = () => send({ kind: 'press', key: combo(event),
      candidates: onPage ? [] : candidates(el, typing) });
    if (event.ctrlKey || event.altKey || event.metaKey || ['Tab', 'Escape'].includes(event.key)) {
      if (typing) sendField(el);
      press();
      return;
    }
    if (event.key === 'Enter' && typing && el.tagName !== 'TEXTAREA') {
      sendField(el);
      // Unless the browser submits a form right away, which records the submit click.
      pendingEnter = setTimeout(press, 0);
      return;
    }
    if (typing || (onPage && SCROLL_KEYS.includes(event.key))) return;
    if ((event.key === 'Enter' || event.key === ' ') && el.closest(CLICKABLE)) return;
    press();
  }, true);

  // Scrolling the page, by wheel or keys: one step where the page comes to rest. A page that
  // scrolls itself (after a click on an anchor) is no step: the click does that again.
  let scrollTimer = null;
  addEventListener('wheel', (event) => {
    if (event.isTrusted) userScroll = Date.now();
  }, { capture: true, passive: true });
  if (window === window.top) {
    addEventListener('scroll', () => {
      if (window.__clickbotMode !== 'record' || Date.now() - userScroll > 1500) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const root = document.scrollingElement || document.documentElement;
        const sideways = root.scrollWidth > root.clientWidth ? { x: Math.round(window.scrollX) } : {};
        send({ kind: 'scroll', y: Math.round(window.scrollY), ...sideways });
      }, 400);
    }, { passive: true });
  }
})();`;

/** Matches of a target across the page and all its iframes, as findTarget counts them. */
async function countEverywhere(frames: Frame[], target: Target): Promise<number> {
  const counts = await Promise.all(
    frames.map((frame) =>
      locate(frame, target)
        .count()
        .catch(() => 0),
    ),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

function toStep(action: Exclude<Action, { kind: 'scroll' }>, target: Target): RecordedStep {
  switch (action.kind) {
    case 'click':
      return { type: 'click', target };
    case 'assert':
      return { type: 'assert', assertion: { kind: 'elementVisible', target } };
    case 'wait':
      return { type: 'wait', until: { kind: 'element', target } };
    case 'fill':
      return { type: 'fill', target, value: action.secret ? PASSWORD_PLACEHOLDER : action.value };
    case 'select':
      return { type: 'select', target, option: action.option };
    case 'press':
      return { type: 'press', key: action.key, target };
  }
}

/**
 * Records what a user does in the pages of `context` as steps ("Im Browser aufnehmen"). Each
 * step's target is the first suggestion that finds exactly one element, as the bot will search
 * for it later. Steps arrive in the order the user acted.
 */
export async function startRecorder(
  context: BrowserContext,
  onStep: (step: RecordedStep) => void,
): Promise<Recorder> {
  let mode: RecorderMode = 'record';
  // Checking targets takes a moment; a queue keeps the steps in the order of the actions.
  let queue = Promise.resolve();

  await context.exposeBinding(BINDING, ({ frame }, action: Action) => {
    queue = queue.then(async () => {
      if (action.kind === 'assert' || action.kind === 'wait') mode = 'record';
      if (action.kind === 'scroll') {
        const { y, x } = action;
        return onStep({
          type: 'scroll',
          to: { kind: 'position', y, ...(x === undefined ? {} : { x }) },
        });
      }
      if (action.kind === 'press' && action.candidates.length === 0) {
        return onStep({ type: 'press', key: action.key });
      }
      const frames = frame.page().frames();
      // An element that removed itself on the click (a cookie banner, often with its iframe)
      // matches nothing any more: then the best suggestion that was not ambiguous wins.
      let gone: Target | undefined;
      for (const candidate of action.candidates) {
        const count = await countEverywhere(frames, candidate);
        if (count === 1) return onStep(toStep(action, candidate));
        if (count === 0) gone ??= candidate;
      }
      const fallback = gone ?? action.candidates.at(-1);
      if (fallback) onStep(toStep(action, fallback));
    });
    return queue;
  });
  await context.addInitScript(PAGE_SCRIPT);

  const applyMode = async () => {
    const frames = context.pages().flatMap((page) => page.frames());
    await Promise.all(
      frames.map((frame) =>
        frame
          .evaluate((value) => {
            (window as unknown as { __clickbotMode: string }).__clickbotMode = value;
          }, mode)
          .catch(() => undefined),
      ),
    );
  };

  return {
    async setMode(next) {
      mode = next;
      await applyMode();
    },
    mode: () => mode,
    async insert(step) {
      // One round trip through every frame first: actions the pages reported before arrive
      // before it, so the step lands after them.
      const frames = context.pages().flatMap((page) => page.frames());
      await Promise.all(frames.map((f) => f.evaluate(() => 0).catch(() => undefined)));
      queue = queue.then(() => onStep(step));
      await queue;
    },
  };
}
