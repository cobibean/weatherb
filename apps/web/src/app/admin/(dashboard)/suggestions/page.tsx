import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';
import { getAdminSuggestions } from '@/lib/admin-suggestions';
import { SuggestionsTabs } from '@/components/admin/suggestions-tabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function SuggestionsContent(): Promise<React.ReactElement> {
  const suggestions = await getAdminSuggestions();

  return (
    <SuggestionsTabs
      pending={suggestions.pending}
      testing={suggestions.testing}
      live={suggestions.live}
      rejected={suggestions.rejected}
    />
  );
}

export default async function SuggestionsPage(): Promise<React.ReactElement> {
  // Check admin authentication
  const session = await getAdminSession();
  if (!session) {
    redirect('/admin/login?redirect=/admin/suggestions');
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">
          City Suggestions
        </h1>
        <p className="font-body text-neutral-500">
          Manage and review city suggestions from the community.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <SuggestionsContent />
      </Suspense>
    </div>
  );
}
