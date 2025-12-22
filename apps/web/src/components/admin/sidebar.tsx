'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Settings,
  MapPin,
  TrendingUp,
  ScrollText,
  CloudSun,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/cities', label: 'Cities', icon: MapPin },
  { href: '/admin/markets', label: 'Markets', icon: TrendingUp },
  { href: '/admin/logs', label: 'Activity Logs', icon: ScrollText },
];

export function AdminSidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-neutral-200 z-40 hidden lg:block">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-200">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-medium to-sky-deep flex items-center justify-center">
            <CloudSun className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-neutral-800">WeatherB</span>
            <span className="font-body text-xs text-sunset-pink ml-1.5">Admin</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm transition-colors ${
                    isActive
                      ? 'text-sky-deep bg-sky-light/20'
                      : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="admin-nav-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sky-medium rounded-r-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
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
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          ← Back to App
        </Link>
      </div>
    </aside>
  );
}

