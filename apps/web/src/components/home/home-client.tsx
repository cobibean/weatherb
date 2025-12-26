'use client';

import { useState, useMemo } from 'react';
import type { Market } from '@weatherb/shared/types';
import { Header, Footer } from '@/components/layout';
import { HeroCarousel, MarketGrid, BetModal } from '@/components/markets';
import { TemperatureDisplay } from '@/components/ui/temperature-display';
import type { SerializedMarket } from '@/lib/contract-data';

interface HomeClientProps {
  markets: SerializedMarket[];
}

export function HomeClient({ markets: serializedMarkets }: HomeClientProps) {
  const [pastMarkets, setPastMarkets] = useState<Market[] | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState<string | null>(null);

  const deserializeMarkets = (items: SerializedMarket[]): Market[] => {
    return items.map((market) => ({
      ...market,
      yesPool: BigInt(market.yesPool),
      noPool: BigInt(market.noPool),
    }));
  };

  const markets: Market[] = useMemo(
    () => deserializeMarkets(serializedMarkets),
    [serializedMarkets]
  );
  const activeMarkets = useMemo(
    () => markets.filter((market) => market.status === 'open'),
    [markets]
  );
  const [selectedMarket, setSelectedMarket] = useState<{ market: Market; side: 'yes' | 'no' } | null>(null);

  const handleBetYes = (market: Market) => {
    setSelectedMarket({ market, side: 'yes' });
  };

  const handleBetNo = (market: Market) => {
    setSelectedMarket({ market, side: 'no' });
  };

  const handleCloseModal = () => {
    setSelectedMarket(null);
  };

  const handleTogglePastMarkets = async (): Promise<void> => {
    if (pastOpen) {
      setPastOpen(false);
      return;
    }

    setPastOpen(true);
    if (pastMarkets) return;

    setPastLoading(true);
    setPastError(null);

    try {
      const res = await fetch('/api/markets?status=past');
      if (!res.ok) {
        throw new Error('Failed to load past markets');
      }

      const data = (await res.json()) as { markets?: SerializedMarket[] };
      const nextMarkets = deserializeMarkets(data.markets ?? []).sort(
        (a, b) => b.resolveTime - a.resolveTime
      );
      setPastMarkets(nextMarkets);
    } catch (error) {
      setPastError(error instanceof Error ? error.message : 'Failed to load past markets');
    } finally {
      setPastLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Main content - header floats over hero */}
      <main className="flex-1">
        {/* Hero Carousel Section */}
        <HeroCarousel
          markets={activeMarkets}
          onBetYes={handleBetYes}
          onBetNo={handleBetNo}
        />

        {/* Market Grid Section */}
        <MarketGrid
          markets={activeMarkets}
          onBetYes={handleBetYes}
          onBetNo={handleBetNo}
          className="bg-cloud-off"
        />

        {/* Past Markets Section */}
        <section className="py-12 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={handleTogglePastMarkets}
              className="w-full flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-left transition hover:bg-neutral-50"
              aria-expanded={pastOpen}
              aria-controls="past-markets-panel"
            >
              <div>
                <h3 className="font-display text-lg font-bold text-neutral-800">
                  Past Markets
                </h3>
                <p className="font-body text-sm text-neutral-500">
                  View resolved and cancelled markets on demand.
                </p>
              </div>
              <span className="font-body text-sm text-neutral-500">
                {pastOpen ? 'Hide' : 'Show'}
              </span>
            </button>

            {pastOpen && (
              <div id="past-markets-panel" className="mt-6 space-y-4">
                {pastLoading && (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
                    <p className="font-body text-sm text-neutral-500">Loading past markets...</p>
                  </div>
                )}
                {pastError && (
                  <div className="rounded-2xl border border-error-soft/40 bg-error-soft/10 p-6 text-center">
                    <p className="font-body text-sm text-error-soft">{pastError}</p>
                  </div>
                )}
                {!pastLoading && !pastError && pastMarkets && pastMarkets.length === 0 && (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
                    <p className="font-body text-sm text-neutral-500">No past markets yet.</p>
                  </div>
                )}
                {!pastLoading && !pastError && pastMarkets && pastMarkets.length > 0 && (
                  <div className="space-y-3">
                    {pastMarkets.map((market) => {
                      const thresholdValue = Math.round(market.thresholdF_tenths / 10);
                      const resolvedTempValue =
                        market.resolvedTempF_tenths !== undefined
                          ? Math.round(market.resolvedTempF_tenths / 10)
                          : null;
                      return (
                        <div
                          key={market.id}
                          className="rounded-2xl border border-neutral-200 bg-white p-5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-display text-lg font-bold text-neutral-800">
                                {market.cityName}
                              </p>
                              <p className="font-body text-sm text-neutral-500">
                                Threshold:{' '}
                                <TemperatureDisplay fahrenheit={thresholdValue} size="sm" />
                                {' '} -{' '}
                                {market.status === 'resolved'
                                  ? market.outcome
                                    ? 'YES Won'
                                    : 'NO Won'
                                  : 'Cancelled'}
                              </p>
                            </div>
                            <div className="text-sm text-neutral-500">
                              {new Date(market.resolveTime).toLocaleString()}
                            </div>
                          </div>
                          {resolvedTempValue !== null && (
                            <p className="mt-3 text-sm text-neutral-600">
                              Observed:{' '}
                              <TemperatureDisplay fahrenheit={resolvedTempValue} size="sm" />
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />

      {/* Bet Modal */}
      {selectedMarket && (
        <BetModal
          market={selectedMarket.market}
          side={selectedMarket.side}
          isOpen={true}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
