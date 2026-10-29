import type { ReactNode } from 'react';
import { Toggle } from '@/components/atoms/Toggle';

export type SwitchRowProps = {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onToggle: () => void;
};

/** A setting that is on or off: switch, title and a sentence about what it does. */
export function SwitchRow({ label, description, checked, onToggle }: SwitchRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Toggle checked={checked} label={label} onClick={onToggle} className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-text">{label}</span>
        {description && <span className="text-meta text-text-muted">{description}</span>}
      </div>
    </div>
  );
}
