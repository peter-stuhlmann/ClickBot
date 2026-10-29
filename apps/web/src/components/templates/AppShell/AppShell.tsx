import type { ReactNode } from 'react';
import { Sidebar, type SidebarProps } from '@/components/organisms/Sidebar';

export type AppShellProps = SidebarProps & { children: ReactNode };

/**
 * Sidebar on the left, page content on the right (padding and gaps as in Figma "Main"). Below
 * `lg` the sidebar is a top bar with a menu, and the page gets narrower margins.
 */
export function AppShell({ children, ...sidebar }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar {...sidebar} />
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
