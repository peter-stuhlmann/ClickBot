import type { Metadata, Viewport } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' });

// Icons come from the files in this folder (favicon.ico, icon.svg, apple-icon.png) and
// manifest.ts; scripts/make-icons.mjs makes them from the logo mark.
export const metadata: Metadata = {
  title: 'Click-Bot',
  description: 'Automatisierte Tests für eigene Websites und Kundenseiten.',
  applicationName: 'Click-Bot',
  appleWebApp: { title: 'Click-Bot' },
};

/** The colour of the sidebar, for the browser bar on phones. */
export const viewport: Viewport = { themeColor: '#0f172a' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
