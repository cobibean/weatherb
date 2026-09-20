import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import '@/components/home/afterglow.css';
import '@/components/layout/afterglow-interiors.css';
import { Providers } from './providers';

// Bold, geometric display font for headings
const sora = localFont({
  src: '../fonts/sora.ttf',
  variable: '--font-sora',
  display: 'swap',
  weight: '100 800',
});

// Clean, modern body font with personality
const jakarta = localFont({
  src: '../fonts/plus-jakarta-sans.ttf',
  variable: '--font-jakarta',
  display: 'swap',
  weight: '200 800',
});

export const metadata: Metadata = {
  title: 'weatherB | Call the Temp',
  description: 'YES/NO bets on weather. Powered by Arc.',
  keywords: ['weather', 'prediction market', 'betting', 'temperature', 'arc', 'blockchain'],
  authors: [{ name: 'weatherB Team' }],
  openGraph: {
    title: 'weatherB | Call the Temp',
    description: 'YES/NO bets on weather. Powered by Arc.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <html lang="en" className={`scroll-smooth ${sora.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-cloud-off antialiased font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
// Trigger rebuild
