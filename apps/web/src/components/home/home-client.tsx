'use client';

import { useState, useMemo } from 'react';
import type { Market } from '@weatherb/shared/types';
import { Header, Footer } from '@/components/layout';
import { HeroCarousel, MarketGrid, BetModal } from '@/components/markets';
import type { SerializedMarket } from '@/lib/contract-data';

interface HomeClientProps {
  markets: SerializedMarket[];
}

export function HomeClient({ markets: serializedMarkets }: HomeClientProps) {
  // Convert serialized string pools back to bigints for components
  const markets: Market[] = useMemo(() => 
    serializedMarkets.map(m => ({
      ...m,
      yesPool: BigInt(m.yesPool),
      noPool: BigInt(m.noPool),
    })),
    [serializedMarkets]
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Main content - header floats over hero */}
      <main className="flex-1">
        {/* Hero Carousel Section */}
        <HeroCarousel
          markets={markets}
          onBetYes={handleBetYes}
          onBetNo={handleBetNo}
        />

        {/* Market Grid Section */}
        <MarketGrid
          markets={markets}
          onBetYes={handleBetYes}
          onBetNo={handleBetNo}
          className="bg-cloud-off"
        />
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

