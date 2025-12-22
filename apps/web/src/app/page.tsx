'use client';

import { useState } from 'react';
import type { Market } from '@weatherb/shared/types';
import { Header, Footer } from '@/components/layout';
import { HeroCarousel, MarketGrid } from '@/components/markets';
import { mockMarkets } from '@/lib/mock-data';

export default function HomePage() {
  const [selectedMarket, setSelectedMarket] = useState<{ market: Market; side: 'yes' | 'no' } | null>(null);

  const handleBetYes = (market: Market) => {
    setSelectedMarket({ market, side: 'yes' });
    // TODO: Open bet modal
    console.log('Bet YES on', market.cityName);
  };

  const handleBetNo = (market: Market) => {
    setSelectedMarket({ market, side: 'no' });
    // TODO: Open bet modal
    console.log('Bet NO on', market.cityName);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Main content - header floats over hero */}
      <main className="flex-1">
        {/* Hero Carousel Section */}
        <HeroCarousel
          markets={mockMarkets}
          onBetYes={handleBetYes}
          onBetNo={handleBetNo}
        />

        {/* Market Grid Section */}
        <MarketGrid
          markets={mockMarkets}
          onBetYes={handleBetYes}
          onBetNo={handleBetNo}
          className="bg-cloud-off"
        />
      </main>

      <Footer />
    </div>
  );
}
