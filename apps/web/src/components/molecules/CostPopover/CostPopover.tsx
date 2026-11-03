'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import type { CostView } from '@/lib/views';

export type CostPopoverProps = {
  /** Names the button, e.g. "KI-Kosten von Kontaktformular-Test". */
  label: string;
  cost: CostView;
};

type Place = { top: number; right: number };

/**
 * A coin button that opens what the AI of a test cost: tokens and price for input, output and
 * cached tokens, and the total. Drawn on the page's edge (a portal) so a table that clips its
 * content does not cut it off. Escape and a click outside close it.
 */
export function CostPopover({ label, cost }: CostPopoverProps) {
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const open = place !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPlace(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    // The panel is placed once; it would drift away from its button when the page moves.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggle() {
    if (open || !button.current) return setPlace(null);
    const box = button.current.getBoundingClientRect();
    setPlace({ top: box.bottom + 8, right: Math.max(8, window.innerWidth - box.right) });
  }

  return (
    <>
      <Button
        ref={button}
        variant="ghost"
        size="sm"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        icon={<Icon name="coins" size={16} />}
        onClick={toggle}
      />
      {place &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={label}
            style={{ top: place.top, right: place.right }}
            className="fixed z-50 flex w-80 max-w-full flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-dialog"
          >
            <p className="text-body font-semibold text-text">KI-Kosten</p>
            {cost.model && <p className="text-small text-text-muted">{cost.model}</p>}
            {cost.rows.length > 0 && (
              <table className="w-full border-collapse text-meta">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Art</th>
                    <th scope="col">Token</th>
                    <th scope="col">Preis</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.rows.map((row) => (
                    <tr key={row.label} className="border-b border-divider">
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal text-text">
                        {row.label}
                      </th>
                      <td className="py-1.5 pr-2 text-right text-text-muted tabular-nums">
                        {row.tokens} Token
                      </td>
                      <td className="py-1.5 text-right text-text tabular-nums">{row.price}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="pt-2 pr-2 text-left font-semibold text-text">
                      Gesamt
                    </th>
                    <td />
                    <td className="pt-2 text-right font-semibold text-text tabular-nums">
                      {cost.total}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            {cost.note && <p className="text-small text-text-secondary">{cost.note}</p>}
          </div>,
          document.body,
        )}
    </>
  );
}
