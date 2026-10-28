import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' });

export const metadata: Metadata = {
  title: 'Click-Bot',
  description: 'Automatisierte Tests für eigene Websites und Kundenseiten.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
