'use client';

import type { ReactNode } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';

export function Providers({ children }: { children: ReactNode }): React.ReactElement {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
