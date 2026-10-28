import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { Icon } from '@/components/atoms/Icon';

const notice = cva('flex flex-col gap-2 rounded-card border p-5', {
  variants: {
    tone: {
      danger: 'border-danger/30 bg-danger-soft',
      warning: 'border-warning/30 bg-warning-soft',
    },
  },
});

const heading = cva('flex items-center gap-2 text-body font-semibold', {
  variants: { tone: { danger: 'text-danger', warning: 'text-warning' } },
});

export type NoticeProps = {
  tone: 'danger' | 'warning';
  title: string;
  children: ReactNode;
};

/** Coloured box for something that needs attention, e.g. why a run failed. */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <section aria-label={title} className={notice({ tone })}>
      <h2 className={heading({ tone })}>
        <Icon name={tone === 'danger' ? 'close' : 'alert'} size={16} />
        {title}
      </h2>
      <div className="text-body text-text">{children}</div>
    </section>
  );
}
