'use client';

/**
 * LOADING ANIMATION EXAMPLES
 *
 * This file demonstrates all loading animations available in weatherB.
 * Use these examples as a reference when implementing loading states.
 */

import React, { useState } from 'react';
import {
  LoadingSpinner,
  LoadingDots,
  LoadingSkeleton,
  LoadingOverlay,
  InlineLoader,
} from '@/components/ui/loading-spinner';

export function LoadingExamples(): React.ReactElement {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div className="min-h-screen bg-cloud-off p-8">
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-neutral-800 mb-2">Loading Animations</h1>
          <p className="text-neutral-600">On-brand loading states for weatherB</p>
        </div>

        {/* Main Spinners */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-800">Main Spinners</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Default Variant */}
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Default
              </h3>
              <LoadingSpinner variant="default" size="md" label="Loading" />
            </div>

            {/* Sunset Variant */}
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Sunset
              </h3>
              <LoadingSpinner variant="sunset" size="md" label="Processing" />
            </div>

            {/* Sky Variant */}
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Sky
              </h3>
              <LoadingSpinner variant="sky" size="md" label="Fetching" />
            </div>

            {/* Minimal Variant */}
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Minimal
              </h3>
              <LoadingSpinner variant="minimal" size="md" label="Loading" />
            </div>
          </div>
        </section>

        {/* Sizes */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-800">Sizes</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Small
              </h3>
              <LoadingSpinner variant="default" size="sm" label="Small" />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Medium
              </h3>
              <LoadingSpinner variant="default" size="md" label="Medium" />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Large
              </h3>
              <LoadingSpinner variant="default" size="lg" label="Large" />
            </div>
          </div>
        </section>

        {/* Loading Dots */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-800">Loading Dots</h2>
          <p className="text-neutral-600">Perfect for inline loading states</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Default
              </h3>
              <LoadingDots variant="default" />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Sunset
              </h3>
              <LoadingDots variant="sunset" />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Sky
              </h3>
              <LoadingDots variant="sky" />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Minimal
              </h3>
              <LoadingDots variant="minimal" />
            </div>
          </div>
        </section>

        {/* Skeletons */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-800">Skeleton Loaders</h2>
          <p className="text-neutral-600">Mimics content shape while loading</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Text Line
              </h3>
              <LoadingSkeleton variant="text" />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Full Width
              </h3>
              <LoadingSkeleton variant="default" />
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Card
              </h3>
              <LoadingSkeleton variant="card" />
            </div>
          </div>
        </section>

        {/* Button States */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-800">Button Loading States</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Primary Button
              </h3>
              <button className="btn-primary inline-flex items-center gap-2" disabled>
                <InlineLoader variant="minimal" size="sm" />
                Processing
              </button>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Secondary Button
              </h3>
              <button className="btn-secondary inline-flex items-center gap-2" disabled>
                <InlineLoader variant="sky" size="sm" />
                Loading
              </button>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-neutral-600 mb-4 uppercase tracking-wide">
                Glass Button
              </h3>
              <button className="btn-glass inline-flex items-center gap-2" disabled>
                <InlineLoader variant="default" size="sm" />
                Fetching
              </button>
            </div>
          </div>
        </section>

        {/* Overlay Example */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-800">Full-Page Overlay</h2>

          <div className="card">
            <p className="text-neutral-600 mb-4">Click to trigger a full-page loading overlay</p>
            <button
              className="btn-primary"
              onClick={() => {
                setShowOverlay(true);
                setTimeout(() => setShowOverlay(false), 3000);
              }}
            >
              Show Loading Overlay
            </button>
          </div>
        </section>

        {/* Usage Examples */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-neutral-800">Usage Examples</h2>

          <div className="space-y-4">
            {/* Modal Loading State */}
            <div className="card">
              <h3 className="font-semibold text-neutral-800 mb-2">Modal Loading</h3>
              <p className="text-sm text-neutral-600 mb-4">When loading data in a modal dialog</p>
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl px-8 py-10 shadow-glass-lg border border-white/50 inline-block">
                <LoadingSpinner size="lg" variant="default" label="Loading market data" />
              </div>
            </div>

            {/* Card Loading State */}
            <div className="card">
              <h3 className="font-semibold text-neutral-800 mb-2">Card Content Loading</h3>
              <p className="text-sm text-neutral-600 mb-4">Skeleton loader for card content</p>
              <div className="space-y-3 max-w-md">
                <LoadingSkeleton variant="default" />
                <LoadingSkeleton variant="text" />
                <LoadingSkeleton variant="text" className="w-2/3" />
              </div>
            </div>

            {/* Inline Text Loading */}
            <div className="card">
              <h3 className="font-semibold text-neutral-800 mb-2">Inline Loading</h3>
              <p className="text-sm text-neutral-600 mb-4">Loading dots for text content</p>
              <p className="text-neutral-800">
                Fetching latest data <LoadingDots variant="sky" className="inline-flex" />
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Overlay Component */}
      <LoadingOverlay isLoading={showOverlay} label="Loading data" variant="default" />
    </div>
  );
}
