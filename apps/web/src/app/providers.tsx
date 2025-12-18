'use client';

import type { ReactNode } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
