import { Suspense } from 'react';
import { MagicLinkConfirmationClient } from './magic-link-confirmation';

export default function MagicLinkConfirmation(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500">
              Loading...
            </div>
          </div>
        </div>
      }
    >
      <MagicLinkConfirmationClient />
    </Suspense>
  );
}
