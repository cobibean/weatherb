'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getDocHref } from '@/content/docs';

type DocNavItem = {
  slug: string;
  label: string;
};

type DocsNavProps = {
  items: DocNavItem[];
  activeSlug: string;
  activeLabel?: string | undefined;
};

export function DocsNav({ items, activeSlug, activeLabel }: DocsNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:sticky lg:top-28">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-semibold text-neutral-700 shadow-sm lg:hidden"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="docs-nav"
      >
        <span>{activeLabel ?? items[0]?.label}</span>
        <span className="text-neutral-400">{isOpen ? '−' : '+'}</span>
      </button>

      <nav
        id="docs-nav"
        className={cn(
          'mt-4 space-y-1 rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm',
          isOpen ? 'block' : 'hidden',
          'lg:block'
        )}
      >
        {items.map((item) => {
          const isActive = item.slug === activeSlug;
          return (
            <Link
              key={item.slug}
              href={getDocHref(item.slug)}
              className={cn(
                'block rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-sky-light/20 text-sky-deep'
                  : 'text-neutral-600 hover:bg-cloud-soft/60 hover:text-neutral-900'
              )}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
