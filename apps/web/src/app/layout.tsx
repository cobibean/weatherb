import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'WeatherB',
  description: 'Weather prediction markets on Flare',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
