import { Suspense } from 'react';
import { getCities } from '@/lib/admin-data';
import { CitiesClient } from './cities-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function CitiesContent(): Promise<React.ReactElement> {
  const cities = await getCities();
  return <CitiesClient initialCities={cities} />;
}

export default function CitiesPage(): React.ReactElement {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">
          City Management
        </h1>
        <p className="font-body text-neutral-500">
          Manage the cities available for weather market creation.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <CitiesContent />
      </Suspense>
    </div>
  );
}

