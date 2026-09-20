'use client';

import { Clock, FileText, Trophy } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  type: 'all' | 'active' | 'claimable' | 'claimed' | 'past';
}

export function EmptyState({ type }: EmptyStateProps): React.ReactElement {
  const config = {
    all: {
      icon: FileText,
      title: 'No Positions Yet',
      description: "You haven't placed any bets yet. Browse markets to get started!",
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
      title: 'Nothing to Claim',
      description: 'Available winnings and refunds will appear here after settlement.',
      action: 'Browse Markets',
      href: '/',
    },
    claimed: {
      icon: Trophy,
      title: 'No Claimed Positions',
      description: "Positions where you've already claimed your winnings will appear here.",
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
    <div className="wb-panel text-center py-16 max-w-2xl mx-auto">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-[#142b40] rounded-full mb-4">
        <Icon className="w-8 h-8 text-[#b6c4d5]" />
      </div>
      <h2 className="text-2xl font-bold text-[#f4f7fb] mb-3">{title}</h2>
      <p className="text-[#b6c4d5] mb-8 max-w-md mx-auto">{description}</p>
      {action && href && (
        <Link href={href} className="wb-outcome inline-block">
          {action}
        </Link>
      )}
    </div>
  );
}
