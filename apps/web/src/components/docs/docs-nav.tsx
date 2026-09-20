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

export function DocsNav({ items, activeSlug, activeLabel }: DocsNavProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:sticky lg:top-28">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-2xl border border-[#30475a] bg-[#0c2134] px-4 py-3 text-left text-sm font-semibold text-[#f4f7fb] shadow-xs lg:hidden"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="docs-nav"
      >
        <span>{activeLabel ?? items[0]?.label}</span>
        <span className="text-[#b6c4d5]">{isOpen ? '−' : '+'}</span>
      </button>

      <nav
        id="docs-nav"
        className={cn(
          'mt-4 space-y-1 rounded-2xl border border-[#30475a] bg-[#0c2134] p-4 shadow-xs',
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
                  ? 'bg-sky-light/20 text-[#a6d6f2]'
                  : 'text-[#b6c4d5] hover:bg-[#0c2134] hover:text-[#f4f7fb]'
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
