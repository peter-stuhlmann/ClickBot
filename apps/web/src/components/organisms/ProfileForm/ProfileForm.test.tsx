import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AvatarLib from '@/lib/avatar';
import type { FormState } from '@/lib/views';
import { ProfileForm } from './ProfileForm';

// jsdom has no canvas: the shrinking itself runs in the browser (e2e/profile.spec.ts).
const squareImage = vi.hoisted(() => vi.fn());
vi.mock('@/lib/avatar', async (original) => ({
  ...(await original<typeof AvatarLib>()),
  squareImage,
}));

const SHRUNK = new Blob(['klein'], { type: 'image/webp' });
const photo = () => new File(['gross'], 'urlaub.heic', { type: 'image/heic' });

const props = {
  name: 'Peter Stuhlmann',
  email: 'peter@agentur.de',
  role: 'Admin',
  avatarSrc: null,
};

type Action = (state: FormState, data: FormData) => Promise<FormState>;
const saving = () => vi.fn<Action>(async () => ({ notice: 'Gespeichert.' }));
const sent = (action: ReturnType<typeof saving>) => action.mock.calls[0]?.[1] as FormData;

beforeEach(() => {
  squareImage.mockReset();
  squareImage.mockResolvedValue(SHRUNK);
  URL.createObjectURL = vi.fn(() => 'blob:vorschau');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.clearAllMocks());

describe('ProfileForm', () => {
  it('shows e-mail and role as text that cannot be changed', () => {
    render(<ProfileForm {...props} action={saving()} />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Peter Stuhlmann');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    const text = (elements: HTMLElement[]) => elements.map((element) => element.textContent);
    expect(text(screen.getAllByRole('term'))).toEqual(['E-Mail', 'Rolle']);
    expect(text(screen.getAllByRole('definition'))).toEqual(['peter@agentur.de', 'Admin']);
  });

  it('saves a new name, without a picture or its removal', async () => {
    const user = userEvent.setup();
    const action = saving();
    render(<ProfileForm {...props} action={action} />);
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Peter S.');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    const data = sent(action);
    expect(data.get('name')).toBe('Peter S.');
    expect(data.get('removeAvatar')).toBeNull();
    expect((data.get('avatar') as File).size).toBe(0);
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert.');
  });

  it('shows the chosen picture before saving and sends it shrunk', async () => {
    const user = userEvent.setup();
    const action = saving();
    const { container } = render(<ProfileForm {...props} action={action} />);
    await user.upload(screen.getByLabelText('Bild wählen'), photo());

    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'blob:vorschau'),
    );
    expect(squareImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'urlaub.heic' }));
    expect(screen.getByText(/Neues Bild/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    const avatar = sent(action).get('avatar') as File;
    expect(avatar.type).toBe('image/webp');
    expect(await avatar.text()).toBe('klein');
  });

  it('says so when the browser cannot read the picture, and sends none', async () => {
    const user = userEvent.setup();
    squareImage.mockRejectedValue(new Error('kaputt'));
    const action = saving();
    const { container } = render(<ProfileForm {...props} action={action} />);
    const input = screen.getByLabelText('Bild wählen');
    await user.upload(input, photo());

    expect(
      await screen.findByText(
        'Dieses Bild kann der Browser nicht lesen. Bitte ein PNG, JPEG oder WebP wählen.',
      ),
    ).toBeVisible();
    expect(input).toHaveAccessibleDescription(/nicht lesen/);
    expect(container.querySelector('img')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((sent(action).get('avatar') as File).size).toBe(0);
  });

  it('removes the stored picture: initials show, and the form says to remove it', async () => {
    const user = userEvent.setup();
    const action = saving();
    const { container } = render(
      <ProfileForm {...props} avatarSrc="/avatar/u1?v=1" action={action} />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', '/avatar/u1?v=1');
    await user.click(screen.getByRole('button', { name: 'Bild entfernen' }));

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('PS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bild entfernen' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sent(action).get('removeAvatar')).toBe('1');
  });

  it('offers no removal without a picture', () => {
    render(<ProfileForm {...props} action={saving()} />);
    expect(screen.queryByRole('button', { name: 'Bild entfernen' })).not.toBeInTheDocument();
  });

  it('shows the problems at their fields and keeps the typed name', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        {...props}
        action={async () => ({
          fieldErrors: { name: 'Name fehlt.', avatar: 'Das Bild ist zu groß (höchstens 512 KB).' },
          values: { name: ' ' },
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(
      await screen.findByRole('textbox', { name: 'Name', description: 'Name fehlt.' }),
    ).toHaveValue(' ');
    expect(screen.getByLabelText('Bild wählen')).toHaveAccessibleDescription(
      /Das Bild ist zu groß/,
    );
  });
});
