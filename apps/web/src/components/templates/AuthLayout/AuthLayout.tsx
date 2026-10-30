import type { ReactNode } from 'react';
import { LogoMark } from '@/components/atoms/LogoMark';

export type AuthLayoutProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

/** Login, 2FA, registration and invitation (screen 09): one centred card, no sidebar. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-4 py-12">
      <main className="w-full max-w-107.5 rounded-dialog border border-border bg-surface p-9 shadow-dialog">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark />
          <span className="text-h2 font-semibold text-text">Click-Bot</span>
        </div>
        <h1 className="text-h1 font-semibold text-text">{title}</h1>
        {description && <p className="mt-3 text-body text-text-muted">{description}</p>}
        <div className="mt-6 flex flex-col gap-4">{children}</div>
      </main>
      <p className="text-meta text-text-muted">
        Click-Bot · Testwerkzeug für eigene und freigegebene Websites
      </p>
    </div>
  );
}
