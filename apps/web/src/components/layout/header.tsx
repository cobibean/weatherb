'use client';

import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { WalletButton } from './wallet-button';

const navLinks = [
  { href: '/', label: 'Markets' },
  { href: '/positions', label: 'My Positions' },
];

export function Header() {
  const [isHidden, setIsHidden] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    // Hide on scroll down (after 100px), show on scroll up
    if (latest > previous && latest > 100) {
      setIsHidden(true);
      setIsMobileMenuOpen(false);
    } else {
      setIsHidden(false);
    }
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pt-4"
      initial={{ y: 0 }}
      animate={{ y: isHidden ? -100 : 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Header pill */}
      <header className="header-floating mx-auto max-w-6xl">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 focus-ring rounded-lg">
            <span className="font-display text-2xl font-extrabold text-gradient">WeatherB</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-body text-sm font-semibold text-neutral-600 hover:text-neutral-800 transition-colors focus-ring rounded-lg px-2 py-1"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Wallet Button */}
          <div className="hidden md:block">
            <WalletButton />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg focus-ring"
            aria-label="Toggle menu"
          >
            <motion.div
              className="w-5 h-4 flex flex-col justify-between"
              animate={isMobileMenuOpen ? 'open' : 'closed'}
            >
              <motion.span
                className="w-full h-0.5 bg-neutral-700 rounded-full origin-left"
                variants={{
                  closed: { rotate: 0, y: 0 },
                  open: { rotate: 45, y: -2 },
                }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="w-full h-0.5 bg-neutral-700 rounded-full"
                variants={{
                  closed: { opacity: 1 },
                  open: { opacity: 0 },
                }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="w-full h-0.5 bg-neutral-700 rounded-full origin-left"
                variants={{
                  closed: { rotate: 0, y: 0 },
                  open: { rotate: -45, y: 2 },
                }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>
          </button>
        </div>
      </header>

      {/* Mobile Menu - separate dropdown below the header pill */}
      <motion.div
        className="md:hidden mx-auto max-w-6xl mt-2"
        initial={false}
        animate={isMobileMenuOpen ? 'open' : 'closed'}
        variants={{
          open: { opacity: 1, y: 0, pointerEvents: 'auto' as const },
          closed: { opacity: 0, y: -10, pointerEvents: 'none' as const },
        }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <nav className="header-floating p-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-3 text-base font-semibold text-neutral-700 hover:text-neutral-900 hover:bg-white/50 rounded-xl transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 px-1">
            <WalletButton />
          </div>
        </nav>
      </motion.div>
    </motion.div>
  );
}
