import type { ReactNode } from 'react';
import { Sidebar, type SidebarProps } from '@/components/organisms/Sidebar';

export type AppShellProps = SidebarProps & { children: ReactNode };

/** Sidebar on the left, page content on the right (padding and gaps as in Figma "Main"). */
export function AppShell({ children, ...sidebar }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar {...sidebar} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-10 py-8">{children}</main>
    </div>
  );
}
