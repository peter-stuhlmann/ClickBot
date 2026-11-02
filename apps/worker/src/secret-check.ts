import type { Page } from 'playwright';

/**
 * Whether a secret value is anywhere on the page: in its address, its text or a field, also in
 * iframes. Then no picture of the page may leave the worker (AI step, live view).
 */
export async function showsSecret(page: Page, secrets: string[]): Promise<boolean> {
  const values = secrets.filter(Boolean);
  if (values.length === 0) return false;
  if (values.some((value) => page.url().includes(value))) return true;
  for (const frame of page.frames()) {
    const found = await frame
      .evaluate((list) => {
        const fields = [...document.querySelectorAll('input, textarea')].map(
          (field) => (field as HTMLInputElement).value,
        );
        const text = [document.body?.innerText ?? '', ...fields].join('\n');
        return list.some((value) => text.includes(value));
      }, values)
      // A frame that cannot be read might show anything: no picture then.
      .catch(() => true);
    if (found) return true;
  }
  return false;
}
