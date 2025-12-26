'use client';

import { useState, useEffect, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { Loader2 } from 'lucide-react';
import { Header, Footer } from '@/components/layout';
import { StatsCards } from '@/components/positions/stats-cards';
import { PositionCard } from '@/components/positions/position-card';
import { ClaimModal } from '@/components/positions/claim-modal';
import { BulkClaimModal } from '@/components/positions/bulk-claim-modal';
import { EmptyState } from '@/components/positions/empty-state';
import { deserializePosition, deserializeStats } from '@/lib/positions';
import type { UserPosition, UserStats, PositionsResponse } from '@/types/positions';
import { cn } from '@/lib/utils';

type TabType = 'all' | 'active' | 'claimable' | 'claimed' | 'past';

export default function PositionsPage() {
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

  // Fetch positions when wallet is connected
  useEffect(() => {
    if (!account?.address) {
      setPositions([]);
      setStats(null);
      setError(null);
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
        return positions.filter((p) =>
          ['claimed', 'refunded', 'lost'].includes(p.status)
        );
      case 'all':
      default:
        return positions;
    }
  }, [positions, activeTab]);

  // Get claimable positions for bulk claim
  const claimablePositions = useMemo(() => {
    return positions.filter((p) => p.status === 'claimable');
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
    setTimeout(() => {
      setRefreshKey((prev) => prev + 1);
    }, 2000);
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
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gradient mb-4">My Positions</h1>
            <p className="text-neutral-600 text-lg">
              Track your active bets and view historical positions
            </p>
          </div>

          {/* Wallet Not Connected */}
          {!account && (
            <div className="card-hero text-center py-16 max-w-2xl mx-auto">
              <div className="text-6xl mb-6">🔗</div>
              <h2 className="text-2xl font-bold text-neutral-800 mb-3">
                Connect Your Wallet
              </h2>
              <p className="text-neutral-600 mb-8">
                Connect your wallet to view your positions and claim your winnings.
              </p>
              <p className="text-sm text-neutral-500">
                Use the "Connect Wallet" button in the header to get started.
              </p>
            </div>
          )}

          {/* Loading State */}
          {account && isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {account && error && !isLoading && (
            <div className="card bg-rose-50 border-2 border-rose-200 text-center py-8 max-w-2xl mx-auto">
              <p className="text-rose-800 mb-4">{error}</p>
              <button
                onClick={() => setRefreshKey((prev) => prev + 1)}
                className="btn-primary"
              >
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
                    claimablePositions.length > 0
                      ? () => setShowBulkClaimModal(true)
                      : undefined
                  }
                />
              </div>

              {/* Tabs */}
              <div className="mb-8">
                <div className="border-b border-neutral-200">
                  <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                          activeTab === tab.id
                            ? 'border-sky-500 text-sky-600'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                        )}
                      >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                          <span
                            className={cn(
                              'ml-2 py-0.5 px-2 rounded-full text-xs font-semibold',
                              activeTab === tab.id
                                ? 'bg-sky-100 text-sky-600'
                                : 'bg-neutral-100 text-neutral-600'
                            )}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* Positions Grid */}
              {filteredPositions.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPositions.map((position) => (
                    <PositionCard
                      key={position.marketId}
                      position={position}
                      onClaim={
                        position.status === 'claimable'
                          ? handleClaimClick
                          : undefined
                      }
                      onRefund={
                        position.status === 'refundable'
                          ? handleRefundClick
                          : undefined
                      }
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

      <Footer />

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
    </div>
  );
}

