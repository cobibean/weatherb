'use client';

import Link from 'next/link';

const footerLinks = [
  { href: '/', label: 'Markets' },
  { href: '/positions', label: 'Positions' },
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-200/50 bg-cloud-soft/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Tagline */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-xl font-bold text-gradient">WeatherB</span>
            <p className="text-sm text-neutral-600">
              Temperature prediction markets on Flare
            </p>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Status */}
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="w-2 h-2 rounded-full bg-success-soft animate-pulse-soft" />
            <span>All systems operational</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-neutral-200/50 text-center">
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} WeatherB. Built on Flare.
          </p>
        </div>
      </div>
    </footer>
  );
}

