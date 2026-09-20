'use client';

import Link from 'next/link';

const footerLinks = [
  { href: '/', label: 'Markets' },
  { href: '/docs', label: 'Docs' },
  { href: '/positions', label: 'Positions' },
];

export function Footer({ afterglow = false }: { afterglow?: boolean } = {}): React.ReactElement {
  if (afterglow)
    return (
      <footer className="wb-shell wb-footer">
        <div className="wb-footer-brand">
          <Link href="/">weatherB</Link>
          <p>Temperature prediction markets on Arc.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/docs">Docs</Link>
          <Link href="/positions">My Positions</Link>
        </nav>
        <p>
          Arc Testnet
          <br />© {new Date().getFullYear()} weatherB. Built on Arc.
        </p>
      </footer>
    );
  return (
    <footer className="border-t border-neutral-200/50 bg-cloud-soft/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Tagline */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-xl font-bold text-gradient">weatherB</span>
            <p className="text-sm text-neutral-600">Temperature prediction markets on Arc</p>
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
            <a
              href="https://twitter.com/weatherbapp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
            >
              @weatherbapp
            </a>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-neutral-200/50 text-center">
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} weatherB. Built on Arc.
          </p>
        </div>
      </div>
    </footer>
  );
}
