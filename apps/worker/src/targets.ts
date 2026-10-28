import type { Target } from '@click-bot/shared';
import type { Locator, Page } from 'playwright';

type AriaRole = Parameters<Page['getByRole']>[0];

/**
 * Turns a step target into a Playwright locator. Names and labels match exactly, so
 * „Absenden“ never hits a button called „Absenden und weiter“.
 */
export function locate(page: Page, target: Target): Locator {
  switch (target.by) {
    case 'role':
      return page.getByRole(
        target.role as AriaRole,
        target.name ? { name: target.name, exact: true } : {},
      );
    case 'label':
      return page.getByLabel(target.label, { exact: true });
    case 'text':
      return page.getByText(target.text, { exact: target.exact });
    case 'css':
      return page.locator(target.selector);
    case 'testId':
      return page.getByTestId(target.testId);
  }
}

/** Human-readable description for step messages and reports. */
export function describeTarget(target: Target): string {
  switch (target.by) {
    case 'role':
      return target.name
        ? `Rolle „${target.role}“ mit Name „${target.name}“`
        : `Rolle „${target.role}“`;
    case 'label':
      return `Feld „${target.label}“`;
    case 'text':
      return `Text „${target.text}“`;
    case 'css':
      return `CSS „${target.selector}“`;
    case 'testId':
      return `Test-ID „${target.testId}“`;
  }
}
