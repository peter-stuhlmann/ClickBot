import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Picks an entry of a Select like a user: opens the box and clicks the entry. */
export async function chooseOption(user: UserEvent, box: HTMLElement, label: string) {
  await user.click(box);
  await user.click(screen.getByRole('option', { name: label }));
}
