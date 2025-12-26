'use client';

import Link from 'next/link';
import { TrendingUp, Clock, Trophy, FileText } from 'lucide-react';

interface EmptyStateProps {
  type: 'all' | 'active' | 'claimable' | 'claimed' | 'past';
}

export function EmptyState({ type }: EmptyStateProps) {
  const config = {
    all: {
      icon: FileText,
      title: 'No Positions Yet',
      description: 'You haven\'t placed any bets yet. Browse markets to get started!',
      action: 'Browse Markets',
      href: '/',
    },
    active: {
      icon: Clock,
      title: 'No Active Bets',
      description: 'Your pending bets awaiting resolution will appear here.',
      action: 'Place a Bet',
      href: '/',
    },
    claimable: {
      icon: Trophy,
      title: 'No Winnings to Claim',
      description: 'Keep betting to win! Your claimable winnings will appear here.',
      action: 'Browse Markets',
      href: '/',
    },
    claimed: {
      icon: Trophy,
      title: 'No Claimed Positions',
      description: 'Positions where you\'ve already claimed your winnings will appear here.',
      action: null,
      href: null,
    },
    past: {
      icon: FileText,
      title: 'No Betting History',
      description: 'Your resolved positions and betting history will appear here.',
      action: 'Browse Markets',
      href: '/',
    },
  };

  const { icon: Icon, title, description, action, href } = config[type];

  return (
    <div className="card-hero text-center py-16 max-w-2xl mx-auto">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-800 mb-3">{title}</h2>
      <p className="text-neutral-600 mb-8 max-w-md mx-auto">{description}</p>
      {action && href && (
        <Link href={href} className="btn-primary inline-block">
          {action}
        </Link>
      )}
    </div>
  );
}
