'use client';

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { Button, buttonVariants } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Field } from '@/components/molecules/Field';
import { squareImage } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import type { FormAction } from '@/lib/views';

export type ProfileFormProps = {
  name: string;
  email: string;
  role: string;
  avatarSrc: string | null;
  /** Server action; reads name, avatar (a file) and removeAvatar ("1"). */
  action: FormAction;
};

const UNREADABLE =
  'Dieses Bild kann der Browser nicht lesen. Bitte ein PNG, JPEG oder WebP wählen.';

/** A value that is shown, not edited: looks like a locked field. */
function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-body font-medium text-text">{label}</dt>
      <dd className="truncate rounded-input bg-neutral-soft px-3.5 py-2.5 text-body text-text-muted">
        {value}
      </dd>
    </div>
  );
}

/**
 * The own profile: name and picture can change, e-mail and role are only shown. A chosen picture
 * is cut to a square and shrunk in the browser before it is sent.
 */
export function ProfileForm({ name, email, role, avatarSrc, action }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [pickError, setPickError] = useState<string>();
  const [answered, setAnswered] = useState(state);
  const fileInput = useRef<HTMLInputElement>(null);
  const errors = state.fieldErrors ?? {};

  // React empties the form after every submit, the file input too: the choice starts over.
  if (state !== answered) {
    setAnswered(state);
    setPicked(null);
    setRemoved(false);
    setPickError(undefined);
  }

  useEffect(
    () => () => {
      if (picked) URL.revokeObjectURL(picked.url);
    },
    [picked],
  );

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const blob = await squareImage(file);
      setPicked({ blob, url: URL.createObjectURL(blob) });
      setRemoved(false);
      setPickError(undefined);
    } catch {
      input.value = '';
      setPicked(null);
      setPickError(UNREADABLE);
    }
  }

  function remove() {
    if (fileInput.current) fileInput.current.value = '';
    setPicked(null);
    setRemoved(true);
    setPickError(undefined);
  }

  function submit(data: FormData) {
    if (picked) data.set('avatar', picked.blob, 'avatar');
    return formAction(data);
  }

  const preview = removed ? null : (picked?.url ?? avatarSrc);
  const avatarError = pickError ?? errors.avatar;
  const describedBy = cn(avatarError && 'profile-avatar-error', 'profile-avatar-hint');

  return (
    <form action={submit} aria-label="Profil" className="max-w-xl">
      {removed && <input type="hidden" name="removeAvatar" value="1" />}
      <Card
        title="Profil"
        description="Name und Bild sieht dein Team in der Seitenleiste und unter Einstellungen → Team."
      >
        {state.error && <p className="text-small text-danger">{state.error}</p>}

        <div className="flex items-center gap-4">
          <Avatar name={name} src={preview} size="lg" />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                id="profile-avatar"
                type="file"
                name="avatar"
                accept="image/*"
                onChange={pick}
                aria-invalid={avatarError ? true : undefined}
                aria-describedby={describedBy}
                className="peer sr-only"
              />
              <label
                htmlFor="profile-avatar"
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'sm' }),
                  'cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
                )}
              >
                Bild wählen
              </label>
              {preview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={remove}
                  icon={<Icon name="trash" size={16} />}
                >
                  Bild entfernen
                </Button>
              )}
            </div>
            {avatarError && (
              <p id="profile-avatar-error" className="text-small text-danger">
                {avatarError}
              </p>
            )}
            <p id="profile-avatar-hint" className="text-small text-text-muted">
              {picked
                ? 'Neues Bild – „Speichern“ übernimmt es.'
                : removed
                  ? 'Ohne Bild – „Speichern“ entfernt es.'
                  : 'Ein Foto oder Logo. Es wird quadratisch zugeschnitten.'}
            </p>
          </div>
        </div>

        <Field id="profile-name" label="Name" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              name="name"
              autoComplete="name"
              required
              maxLength={120}
              defaultValue={state.values?.name ?? name}
            />
          )}
        </Field>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Fixed label="E-Mail" value={email} />
          <Fixed label="Rolle" value={role} />
        </dl>
        <p className="-mt-2 text-small text-text-muted">
          Die E-Mail ist deine Anmeldung, die Rolle legt die Einladung fest. Beides lässt sich hier
          nicht ändern.
        </p>

        <div className="flex items-center justify-end gap-3">
          {state.notice && !pending && (
            <p role="status" className="text-meta text-success">
              {state.notice}
            </p>
          )}
          <Button type="submit" loading={pending} icon={<Icon name="check" size={16} />}>
            Speichern
          </Button>
        </div>
      </Card>
    </form>
  );
}
