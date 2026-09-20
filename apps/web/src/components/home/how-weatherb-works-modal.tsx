'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Target,
  Thermometer,
  Trophy,
  Wallet,
} from 'lucide-react';

const STEPS = [
  {
    id: 1,
    title: 'Browse Markets',
    subtitle: 'Find a temperature prediction to bet on',
    description:
      'Explore active weather markets for cities around the world. Each market asks a simple question: Will the temperature meet or exceed a threshold at a specific time?',
    icon: Thermometer,
    color: 'from-sky-400 to-blue-500',
    bgColor: 'bg-sky-50',
    details: [
      'Markets for cities worldwide',
      'Clear threshold & resolve time',
      'See current pool sizes',
      'Live odds update in real-time',
    ],
  },
  {
    id: 2,
    title: 'Connect Wallet',
    subtitle: 'Link your Arc wallet to participate',
    description:
      'Connect your Arc-compatible wallet to start betting. Connect with MetaMask, Rabby, or WalletConnect. Your funds stay in your control until you place a bet.',
    icon: Wallet,
    color: 'from-violet-400 to-purple-500',
    bgColor: 'bg-violet-50',
    details: [
      'WalletConnect supported',
      'Non-custodial — you control keys',
      'Bets paid in USDC tokens',
      'Minimum bet: 0.01 USDC',
    ],
  },
  {
    id: 3,
    title: 'Place Your Bet',
    subtitle: 'Predict YES or NO on the temperature',
    description:
      'Think it will hit the threshold? Bet YES. Think it will fall short? Bet NO. Enter your wager amount and confirm the transaction. Your bet joins the pool.',
    icon: Target,
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    details: [
      'Choose YES or NO position',
      'Set your bet amount',
      'See potential payout instantly',
      'One tx to place your bet',
    ],
  },
  {
    id: 4,
    title: 'Wait for Settlement',
    subtitle: 'Real weather data determines the outcome',
    description:
      "When the market's resolve time arrives, we fetch the actual temperature from verified weather APIs. The outcome is recorded on-chain — no human intervention.",
    icon: Clock,
    color: 'from-emerald-400 to-green-500',
    bgColor: 'bg-emerald-50',
    details: [
      'Automated settlement',
      'Tomorrow.io weather data',
      'On-chain verification',
      'Fully transparent process',
    ],
  },
  {
    id: 5,
    title: 'Collect Winnings',
    subtitle: 'Winners claim their payout',
    description:
      'If your prediction was correct, your share of the losing pool is added to your stake and becomes claimable. Connect your wallet and claim your winnings anytime after settlement.',
    icon: Trophy,
    color: 'from-rose-400 to-pink-500',
    bgColor: 'bg-rose-50',
    details: [
      'Payouts become claimable',
      'Share of the losing pool',
      'Small 1% platform fee',
      'Claim with one transaction',
    ],
  },
];

export function HowWeatherbWorksModal(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const step = STEPS[current]!;
  const Icon = step.icon;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setCurrent(0);
      }}
    >
      <DialogTrigger asChild>
        <button className="wb-how-trigger">
          <HelpCircle size={17} /> How it works
        </button>
      </DialogTrigger>
      <DialogContent data-wb-theme="afterglow" className="wb-guide wb-dialog">
        <DialogHeader>
          <DialogTitle>How weatherB works</DialogTitle>
          <DialogDescription>From a prediction to a payout.</DialogDescription>
        </DialogHeader>
        <nav className="wb-guide-steps" aria-label="Guide steps">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              aria-label={`${item.id}. ${item.title}`}
              aria-current={index === current ? 'step' : undefined}
              onClick={() => setCurrent(index)}
            >
              {item.id}
            </button>
          ))}
        </nav>
        <section className="wb-guide-content" aria-live="polite" aria-atomic="true">
          <Icon size={36} strokeWidth={1.25} aria-hidden="true" />
          <p className="wb-guide-eyebrow">
            Step {step.id} of {STEPS.length}
          </p>
          <h2>{step.title}</h2>
          <p>{step.description}</p>
          <ul>
            {step.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>
        <footer className="wb-guide-footer">
          <button
            className="wb-outcome wb-outcome--compact"
            disabled={current === 0}
            onClick={() => setCurrent(current - 1)}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            className="wb-outcome wb-outcome--compact"
            onClick={() =>
              current === STEPS.length - 1 ? setOpen(false) : setCurrent(current + 1)
            }
          >
            {current === STEPS.length - 1 ? 'Done' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
