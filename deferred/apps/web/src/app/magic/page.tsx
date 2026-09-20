import { Suspense } from 'react';
import { MagicLinkConfirmationClient } from './magic-link-confirmation';

export default function MagicLinkConfirmation(): React.ReactElement {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MagicLinkConfirmationClient />
    </Suspense>
  );
}
