import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Market } from '@weatherb/shared/types';
import { HeroCarousel } from '../hero-carousel';
import { OutcomePanel } from '../outcome-panel';
import { MarketGrid } from '../market-grid';
import { bettingCloseTime, canBet } from '../market-presentation';
vi.mock('@/lib/arc-wallet', () => ({ useArcSettings: () => ({ feeBps: 100n, minBetWei: 100n }) }));
vi.mock('@/components/home/how-weatherb-works-modal', () => ({
  HowWeatherbWorksModal: () => <button>How it works</button>,
}));
const base: Market = {
  id: '1',
  cityId: 'austin',
  cityName: 'Austin',
  latitude: 30.2672,
  longitude: -97.7431,
  resolveTime: Date.parse('2026-09-20T12:00:00Z'),
  thresholdF_tenths: 960,
  currency: 'USDC',
  status: 'open',
  yesPool: 92n * 10n ** 18n,
  noPool: 8n * 10n ** 18n,
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T11:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('Afterglow market interactions', () => {
  it('uses the market-specific on-chain deadline when supplied', () => {
    const market = { ...base, bettingDeadline: base.resolveTime - 20 * 60 * 1000 };
    expect(bettingCloseTime(market)).toBe(market.bettingDeadline);
    expect(canBet(market, market.bettingDeadline - 1)).toBe(true);
    expect(canBet(market, market.bettingDeadline)).toBe(false);
  });
  it('switches on deliberate horizontal swipes, not vertical scrolling', () => {
    const select = vi.fn();
    const { container } = render(
      <HeroCarousel
        markets={[base, { ...base, id: '2', cityName: 'Chicago' }]}
        selectedId="1"
        onSelect={select}
        onBetYes={vi.fn()}
        onBetNo={vi.fn()}
      />,
    );
    const surface = container.querySelector('.wb-hero-card')!.parentElement!;
    fireEvent.touchStart(surface, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 100, clientY: 105 }] });
    expect(select).toHaveBeenLastCalledWith('2');
    select.mockClear();
    fireEvent.touchStart(surface, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 280, clientY: 300 }] });
    expect(select).not.toHaveBeenCalled();
  });

  it('closes both outcome actions at the betting deadline, before resolution', () => {
    const yes = vi.fn();
    render(<OutcomePanel market={base} onBetYes={yes} onBetNo={vi.fn()} />);
    expect(canBet(base, bettingCloseTime(base) - 1)).toBe(true);
    expect(canBet(base, bettingCloseTime(base))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Bet YES' }));
    expect(yes).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(50 * 60 * 1000));
    expect(screen.getByRole('button', { name: 'Bet YES' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bet NO' })).toBeDisabled();
  });
  it('keeps selected identity on reorder, never auto-advances, and safely falls back on removal', () => {
    const select = vi.fn();
    const second = { ...base, id: '2', cityName: 'Chicago' };
    const { rerender } = render(
      <HeroCarousel
        markets={[base, second]}
        selectedId="2"
        onSelect={select}
        onBetYes={vi.fn()}
        onBetNo={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chicago');
    act(() => vi.advanceTimersByTime(30000));
    expect(select).not.toHaveBeenCalled();
    rerender(
      <HeroCarousel
        markets={[second, base]}
        selectedId="2"
        onSelect={select}
        onBetYes={vi.fn()}
        onBetNo={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chicago');
    fireEvent.click(screen.getByRole('button', { name: 'Next market' }));
    expect(select).toHaveBeenLastCalledWith('1');
    rerender(
      <HeroCarousel
        markets={[base]}
        selectedId="2"
        onSelect={select}
        onBetYes={vi.fn()}
        onBetNo={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Austin');
    expect(screen.queryByRole('button', { name: 'Next market' })).not.toBeInTheDocument();
  });
  it('provides ten uniquely labelled selectors and hides a redundant single-market grid', () => {
    const markets = Array.from({ length: 10 }, (_, i) => ({
      ...base,
      id: String(i),
      resolveTime: base.resolveTime + i * 60000,
    }));
    const { rerender } = render(
      <HeroCarousel markets={markets} onSelect={vi.fn()} onBetYes={vi.fn()} onBetNo={vi.fn()} />,
    );
    const selectors = screen.getAllByRole('button', { name: /Austin, 96°F or higher, resolves/ });
    expect(selectors).toHaveLength(10);
    expect(new Set(selectors.map((s) => s.getAttribute('aria-label'))).size).toBe(10);
    rerender(<MarketGrid markets={[base]} onBetYes={vi.fn()} onBetNo={vi.fn()} />);
    expect(screen.queryByText('All active markets')).not.toBeInTheDocument();
  });
  it('renders the empty state with no betting or switching controls', () => {
    render(<HeroCarousel markets={[]} onSelect={vi.fn()} onBetYes={vi.fn()} onBetNo={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Clear skies ahead.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bet YES' })).not.toBeInTheDocument();
  });
});
