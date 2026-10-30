import type { Locator } from '@playwright/test';

/** Picks an entry of a Select like a user: opens the box and clicks the entry in its list. */
export async function chooseOption(box: Locator, label: string): Promise<void> {
  await box.click();
  await box.page().getByRole('listbox').getByRole('option', { name: label, exact: true }).click();
}
