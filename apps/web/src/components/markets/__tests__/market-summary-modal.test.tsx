import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketSummaryModal } from '../market-summary-modal';
import type { Market } from '@weatherb/shared/types';

describe('MarketSummaryModal', () => {
  const mockMarket: Market = {
    id: '1',
    cityId: 'seattle',
    cityName: 'Seattle',
    latitude: 47.6062,
    longitude: -122.3321,
    resolveTime: 1735344000,
    thresholdF_tenths: 650,
    currency: 'FLR',
    status: 'resolved',
    yesPool: BigInt(100e18),
    noPool: BigInt(50e18),
    resolvedTempF_tenths: 680,
    observedTimestamp: 1735344100,
    outcome: true
  };

  it('should render modal when open', () => {
    const onClose = vi.fn();
    render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Market Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Seattle/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const onClose = vi.fn();
    const { container } = render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={false}
        onClose={onClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should display settled market info', () => {
    render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/YES Won/i)).toBeInTheDocument();
    expect(screen.getByText(/68°F/i)).toBeInTheDocument(); // Observed temp
    expect(screen.getByText(/≥65°F/i)).toBeInTheDocument(); // Threshold
  });
});
