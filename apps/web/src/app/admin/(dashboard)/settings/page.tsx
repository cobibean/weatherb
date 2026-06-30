import { Suspense } from 'react';
import { getSystemConfig } from '@/lib/admin-data';
import { SettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function SettingsContent(): Promise<React.ReactElement> {
  const config = await getSystemConfig();
  return <SettingsClient initialConfig={config} />;
}

export default function SettingsPage(): React.ReactElement {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">
          Settings
        </h1>
        <p className="font-body text-neutral-500">
          Configure system parameters and operational settings.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}

