'use client';

import { useState, useEffect, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Header, Footer } from '@/components/layout';
import { StatsCards } from '@/components/positions/stats-cards';
import { PositionCard } from '@/components/positions/position-card';
import { ClaimModal } from '@/components/positions/claim-modal';
import { BulkClaimModal } from '@/components/positions/bulk-claim-modal';
import { EmptyState } from '@/components/positions/empty-state';
import { MarketSummaryModal } from '@/components/markets/market-summary-modal';
import { deserializePosition, deserializeStats } from '@/lib/position-serialization';
import type { UserPosition, UserStats, PositionsResponse } from '@/types/positions';
import type { Market } from '@weatherb/shared/types';
import { Wallet } from 'lucide-react';
import { WalletButton } from '@/components/layout/wallet-button';

type TabType = 'all' | 'active' | 'claimable' | 'claimed' | 'past';

export default function PositionsPage(): React.ReactElement {
  const account = useActiveAccount();
  return <AccountPositions key={account?.address ?? 'disconnected'} />;
}

function AccountPositions(): React.ReactElement {
  const account = useActiveAccount();

  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedPosition, setSelectedPosition] = useState<UserPosition | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showBulkClaimModal, setShowBulkClaimModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Fetch positions when wallet is connected
  useEffect(() => {
    if (!account?.address) {
      return;
    }

    const fetchPositions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/positions?wallet=${account.address}`);
        const data: PositionsResponse = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        // Deserialize positions and stats
        const deserializedPositions = data.positions.map(deserializePosition);
        const deserializedStats = deserializeStats(data.stats);

        setPositions(deserializedPositions);
        setStats(deserializedStats);
      } catch (err) {
        console.error('Failed to fetch positions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, [account?.address, refreshKey]);

  // Filter positions by tab
  const filteredPositions = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return positions.filter((p) => p.status === 'active');
      case 'claimable':
        return positions.filter((p) => p.status === 'claimable' || p.status === 'refundable');
      case 'claimed':
        return positions.filter((p) => p.status === 'claimed' || p.status === 'refunded');
      case 'past':
        return positions.filter((p) => ['claimed', 'refunded', 'lost'].includes(p.status));
      case 'all':
      default:
        return positions;
    }
  }, [positions, activeTab]);

  // Get claimable positions for bulk claim
  const claimablePositions = useMemo(() => {
    return positions.filter((p) => p.status === 'claimable' || p.status === 'refundable');
  }, [positions]);

  const handleClaimClick = (marketId: string) => {
    const position = positions.find((p) => p.marketId === marketId);
    if (position) {
      setSelectedPosition(position);
      setShowClaimModal(true);
    }
  };

  const handleRefundClick = (marketId: string) => {
    const position = positions.find((p) => p.marketId === marketId);
    if (position) {
      setSelectedPosition(position);
      setShowClaimModal(true);
    }
  };

  const handleClaimSuccess = () => {
    setShowClaimModal(false);
    setShowBulkClaimModal(false);
    setSelectedPosition(null);
    // Refresh positions after successful claim
    setRefreshKey((prev) => prev + 1);
  };

  const handleViewDetails = async (position: UserPosition) => {
    setSelectedPosition(position);

    try {
      // Fetch full market data from the API
      const response = await fetch('/api/markets');
      const data = await response.json();

      if (data.markets) {
        // Deserialize the market data
        const market = data.markets.find(
          (m: import('@/lib/contract-data').SerializedMarket) => m.id === position.marketId,
        );

        if (market) {
          // Convert string bigints back to bigint for the modal
          const deserializedMarket: Market = {
            ...market,
            yesPool: BigInt(market.yesPool),
            noPool: BigInt(market.noPool),
            totalFees: BigInt(market.totalFees ?? '0'),
          };
          setSelectedMarket(deserializedMarket);
          setShowSummaryModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    }
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: positions.length },
    {
      id: 'active',
      label: 'Active',
      count: positions.filter((p) => p.status === 'active').length,
    },
    {
      id: 'claimable',
      label: 'Claimable',
      count: claimablePositions.length,
    },
    {
      id: 'claimed',
      label: 'Claimed',
      count: positions.filter((p) => p.status === 'claimed' || p.status === 'refunded').length,
    },
    {
      id: 'past',
      label: 'Past',
      count: positions.filter((p) => ['claimed', 'refunded', 'lost'].includes(p.status)).length,
    },
  ];

  return (
    <div data-wb-theme="afterglow" className="wb-home wb-positions min-h-screen flex flex-col">
      <Header afterglow />

      <main className="wb-interior-main flex-1">
        <div className="wb-shell">
          {/* Page Header */}
          <div className="wb-page-heading">
            <h1 className="wb-page-title">My Positions</h1>
            <p className="text-[#b6c4d5] text-lg">
              Your markets, returns, and everything in between.
            </p>
          </div>

          {/* Wallet Not Connected */}
          {!account && (
            <div className="wb-panel text-center py-16 max-w-2xl mx-auto">
              <Wallet className="wb-empty-icon" strokeWidth={1.25} />
              <h2 className="text-2xl font-bold text-[#f4f7fb] mb-3">Connect Your Wallet</h2>
              <p className="text-[#b6c4d5] mb-8">
                Connect your wallet to view your positions and claim your winnings.
              </p>
              <WalletButton afterglow />
            </div>
          )}

          {/* Loading State */}
          {account && isLoading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" variant="default" label="Loading positions" />
            </div>
          )}

          {/* Error State */}
          {account && error && !isLoading && (
            <div className="wb-panel bg-[#352637] border-2 border-[#456078] text-center py-8 max-w-2xl mx-auto">
              <p className="text-[#f2b3c3] mb-4">{error}</p>
              <button onClick={() => setRefreshKey((prev) => prev + 1)} className="wb-outcome">
                Retry
              </button>
            </div>
          )}

          {/* Content */}
          {account && !isLoading && !error && stats && (
            <>
              {/* Stats Dashboard */}
              <div className="mb-12">
                <StatsCards
                  stats={stats}
                  onClaimAll={
                    claimablePositions.length > 0 ? () => setShowBulkClaimModal(true) : undefined
                  }
                />
              </div>

              <nav className="wb-position-filters" aria-label="Filter positions">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={activeTab === tab.id}
                  >
                    {tab.label}
                    <span>{tab.count ?? 0}</span>
                  </button>
                ))}
              </nav>

              {/* Positions Grid */}
              {filteredPositions.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredPositions.map((position) => (
                    <PositionCard
                      key={position.marketId}
                      position={position}
                      onClaim={position.status === 'claimable' ? handleClaimClick : undefined}
                      onRefund={position.status === 'refundable' ? handleRefundClick : undefined}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState type={activeTab} />
              )}
            </>
          )}
        </div>
      </main>

      <Footer afterglow />

      {/* Claim Modal */}
      {selectedPosition && (
        <ClaimModal
          position={selectedPosition}
          isOpen={showClaimModal}
          onClose={() => {
            setShowClaimModal(false);
            setSelectedPosition(null);
          }}
          onSuccess={handleClaimSuccess}
        />
      )}

      {/* Bulk Claim Modal */}
      <BulkClaimModal
        claimablePositions={claimablePositions}
        isOpen={showBulkClaimModal}
        onClose={() => setShowBulkClaimModal(false)}
        onSuccess={handleClaimSuccess}
      />

      {/* Market Summary Modal */}
      <MarketSummaryModal
        market={selectedMarket}
        isOpen={showSummaryModal}
        onClose={() => {
          setShowSummaryModal(false);
          setSelectedMarket(null);
          setSelectedPosition(null);
        }}
        {...(selectedPosition && { userPosition: selectedPosition })}
      />
    </div>
  );
}
