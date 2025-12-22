'use client';

import { Header, Footer } from '@/components/layout';

/**
 * Positions page placeholder
 * Will show user's active bets and historical positions
 */
export default function PositionsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Main content with padding for floating header */}
      <main className="flex-1 pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gradient mb-4">
              My Positions
            </h1>
            <p className="text-neutral-600 text-lg">
              Track your active bets and view historical positions
            </p>
          </div>

          {/* Empty State */}
          <div className="card-hero text-center py-16 max-w-2xl mx-auto">
            <div className="text-6xl mb-6">📊</div>
            <h2 className="text-2xl font-bold text-neutral-800 mb-3">
              No Positions Yet
            </h2>
            <p className="text-neutral-600 mb-8">
              Connect your wallet and place your first bet to see your positions here.
            </p>
            <a
              href="/"
              className="btn-primary inline-block"
            >
              Browse Markets
            </a>
          </div>

          {/* Coming Soon Features */}
          <div className="mt-16 grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                icon: '⏳',
                title: 'Active Bets',
                description: 'View pending bets awaiting resolution',
              },
              {
                icon: '📈',
                title: 'Performance',
                description: 'Track your win/loss history and ROI',
              },
              {
                icon: '💰',
                title: 'Claim Winnings',
                description: 'Collect payouts from resolved markets',
              },
            ].map((feature) => (
              <div key={feature.title} className="card text-center">
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-neutral-800 mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-neutral-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

