'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  LogOut,
  User,
  LayoutDashboard,
  Settings,
  MapPin,
  TrendingUp,
  ScrollText,
  CloudSun,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const mobileNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/cities', label: 'Cities', icon: MapPin },
  { href: '/admin/markets', label: 'Markets', icon: TrendingUp },
  { href: '/admin/logs', label: 'Activity Logs', icon: ScrollText },
];

interface AdminHeaderProps {
  wallet: string;
}

export function AdminHeader({ wallet }: AdminHeaderProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await fetch('/admin/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  const shortWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  return (
    <>
      <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white/80 backdrop-blur-lg border-b border-neutral-200 z-30 flex items-center justify-between px-4 lg:px-6">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-neutral-600" />
        </button>

        {/* Mobile logo */}
        <Link href="/admin" className="flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-medium to-sky-deep flex items-center justify-center">
            <CloudSun className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-neutral-800">Admin</span>
        </Link>

        {/* Spacer for desktop */}
        <div className="hidden lg:block" />

        {/* User menu */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100">
            <User className="w-4 h-4 text-neutral-500" />
            <span className="font-mono text-sm text-neutral-600">{shortWallet}</span>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-72 bg-white z-50 lg:hidden shadow-xl"
            >
              {/* Close button */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-200">
                <Link href="/admin" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-medium to-sky-deep flex items-center justify-center">
                    <CloudSun className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-display font-bold text-neutral-800">WeatherB</span>
                    <span className="font-body text-xs text-sunset-pink ml-1.5">Admin</span>
                  </div>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="p-4">
                <ul className="space-y-1">
                  {mobileNavItems.map((item) => {
                    const isActive = pathname === item.href || 
                      (item.href !== '/admin' && pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm transition-colors ${
                            isActive
                              ? 'text-sky-deep bg-sky-light/20'
                              : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-200">
                <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-xl bg-neutral-100">
                  <User className="w-4 h-4 text-neutral-500" />
                  <span className="font-mono text-sm text-neutral-600 truncate">{shortWallet}</span>
                </div>
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  ← Back to App
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

