'use client';

import { useState } from 'react';
import { AiProviderForm, type AiProviderActions } from '@/components/organisms/AiProviderForm';
import type { AiProviderView } from '@/lib/views';

export type AiProviderListProps = {
  providers: AiProviderView[];
  /** Only for admins; the others see the state only. */
  actions?: AiProviderActions;
};

/** The providers as an accordion: all closed at first, opening one closes the other. */
export function AiProviderList({ providers, actions }: AiProviderListProps) {
  const [open, setOpen] = useState<string | null>(null);
  return providers.map((provider) => (
    <AiProviderForm
      key={provider.kind}
      provider={provider}
      actions={actions}
      open={open === provider.kind}
      onToggle={() => setOpen((current) => (current === provider.kind ? null : provider.kind))}
    />
  ));
}
