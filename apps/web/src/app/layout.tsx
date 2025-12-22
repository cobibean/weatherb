import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Sora, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Bold, geometric display font for headings
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
});

// Clean, modern body font with personality
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'WeatherB | Call the Temp',
  description: 'YES/NO bets on weather. Powered by Flare.',
  keywords: ['weather', 'prediction market', 'betting', 'temperature', 'flare', 'blockchain'],
  authors: [{ name: 'WeatherB Team' }],
  openGraph: {
    title: 'WeatherB | Call the Temp',
    description: 'YES/NO bets on weather. Powered by Flare.',
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
