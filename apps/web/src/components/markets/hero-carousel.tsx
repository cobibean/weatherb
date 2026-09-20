'use client';
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, CloudSun } from 'lucide-react';
import type { Market } from '@weatherb/shared/types';
import { HeroCard } from './hero-card';
import { marketTime } from './market-presentation';
import { HowWeatherbWorksModal } from '@/components/home/how-weatherb-works-modal';

export function HeroCarousel({
  markets,
  onBetYes,
  onBetNo,
  selectedId,
  onSelect,
  className = '',
}: {
  markets: Market[];
  onBetYes: (market: Market) => void;
  onBetNo: (market: Market) => void;
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
  className?: string;
}): React.ReactElement {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = Math.max(
    0,
    markets.findIndex((m) => m.id === selectedId),
  );
  const market = markets[index];
  const selectorsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = selectorsRef.current;
    const selected = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!container || !selected) return;
    const left = selected.offsetLeft - container.offsetLeft;
    if (left < container.scrollLeft) container.scrollLeft = left;
    else if (left + selected.offsetWidth > container.scrollLeft + container.clientWidth)
      container.scrollLeft = left + selected.offsetWidth - container.clientWidth;
  }, [market?.id]);
  const move = (step: number): void => {
    const next = markets[(index + step + markets.length) % markets.length];
    if (next) onSelect(next.id);
  };
  return (
    <section className={`wb-hero ${className}`} aria-label="Featured markets">
      <picture className="wb-scenery">
        <source
          media="(max-width: 639px)"
          srcSet="/backgrounds/afterglow/hero-mobile-640.webp 640w, /backgrounds/afterglow/hero-mobile-941.webp 941w"
          sizes="100vw"
        />
        {/* Deliberate picture art direction; pre-encoded WebP sources need no Next transcoding. */}
        <img
          src="/backgrounds/afterglow/hero-desktop-1672.webp"
          srcSet="/backgrounds/afterglow/hero-desktop-1024.webp 1024w, /backgrounds/afterglow/hero-desktop-1672.webp 1672w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
        />
      </picture>
      <div className="wb-shell wb-hero-content">
        {markets.length > 1 && (
          <div className="wb-market-navigation">
            <span className="wb-navigation-label">Featured market</span>
            <div
              className="wb-market-selectors"
              ref={selectorsRef}
              role="group"
              aria-label="Select featured market"
            >
              {markets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === market?.id}
                  aria-label={`${item.cityName}, ${Math.round(item.thresholdF_tenths / 10)}°F or higher, resolves ${marketTime(item)}`}
                  onClick={() => onSelect(item.id)}
                >
                  {item.cityName} {Math.round(item.thresholdF_tenths / 10)}°
                  {markets.some(
                    (other) =>
                      other.id !== item.id &&
                      other.cityName === item.cityName &&
                      other.thresholdF_tenths === item.thresholdF_tenths,
                  ) && <small>{marketTime(item)}</small>}
                </button>
              ))}
            </div>
            <div className="wb-market-arrows">
              <button type="button" onClick={() => move(-1)} aria-label="Previous market">
                <ArrowLeft size={18} />
              </button>
              <span aria-live="polite">
                {index + 1} of {markets.length}
              </span>
              <button type="button" onClick={() => move(1)} aria-label="Next market">
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
        {market ? (
          <div
            onTouchStart={(event) => {
              if ((event.target as HTMLElement).closest('button, a')) return;
              const point = event.touches[0];
              if (point) touch.current = { x: point.clientX, y: point.clientY };
            }}
            onTouchEnd={(event) => {
              const point = event.changedTouches[0];
              const start = touch.current;
              touch.current = null;
              if (!point || !start || markets.length < 2) return;
              const dx = point.clientX - start.x;
              const dy = point.clientY - start.y;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
            }}
            onTouchCancel={() => {
              touch.current = null;
            }}
          >
            <HeroCard
              market={market}
              onBetYes={() => onBetYes(market)}
              onBetNo={() => onBetNo(market)}
            />
          </div>
        ) : (
          <div className="wb-empty">
            <CloudSun size={38} strokeWidth={1.3} />
            <p className="wb-eyebrow">Weather worth watching</p>
            <h1>Clear skies ahead.</h1>
            <p>No active markets right now. Check back soon for new temperature predictions.</p>
            <HowWeatherbWorksModal />
          </div>
        )}
        {markets.length > 1 && (
          <a className="wb-view-all" href="#active-markets">
            Explore all {markets.length} markets <ArrowRight size={17} />
          </a>
        )}
      </div>
    </section>
  );
}
