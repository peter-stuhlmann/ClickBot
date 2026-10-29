import type { Target } from '@click-bot/shared';
import type { BrowserContext, Frame } from 'playwright';
import { locate } from './targets';

/** A recorded step, before it gets its id in the flow (input of stepSchema). */
export type RecordedStep =
  | { type: 'click'; target: Target }
  | { type: 'fill'; target: Target; value: string }
  | { type: 'select'; target: Target; option: string }
  | { type: 'assert'; assertion: { kind: 'elementVisible'; target: Target } };

/** record: actions become steps; browse: nothing is recorded; assert: the next click checks. */
export type RecorderMode = 'record' | 'browse' | 'assert';

type Action =
  | { kind: 'click'; candidates: Target[] }
  | { kind: 'assert'; candidates: Target[] }
  | { kind: 'fill'; candidates: Target[]; value: string; secret: boolean }
  | { kind: 'select'; candidates: Target[]; option: string };

export type Recorder = {
  setMode(mode: RecorderMode): Promise<void>;
  mode(): RecorderMode;
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
    if (!isTextField(el) || sent.get(el) === el.value) return;
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

  // While checking, the page must not react to the click.
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    document.addEventListener(type, (event) => {
      if (window.__clickbotMode === 'assert' && event.isTrusted) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  document.addEventListener('click', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    if (window.__clickbotMode === 'assert') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.__clickbotMode = 'record';
      send({ kind: 'assert', candidates: candidates(event.target.closest(CLICKABLE) || event.target, false) });
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
  document.addEventListener('submit', (event) => {
    if (window.__clickbotMode !== 'record') return;
    if (document.activeElement) sendField(document.activeElement);
    const button = event.submitter;
    if (!button || (last.el === button && Date.now() - last.at < 500)) return;
    last = { el: button, at: Date.now() };
    send({ kind: 'click', candidates: candidates(button, false) });
  }, true);
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

function toStep(action: Action, target: Target): RecordedStep {
  switch (action.kind) {
    case 'click':
      return { type: 'click', target };
    case 'assert':
      return { type: 'assert', assertion: { kind: 'elementVisible', target } };
    case 'fill':
      return { type: 'fill', target, value: action.secret ? PASSWORD_PLACEHOLDER : action.value };
    case 'select':
      return { type: 'select', target, option: action.option };
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
      if (mode === 'browse') return;
      if (action.kind === 'assert') mode = 'record';
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
  };
}
