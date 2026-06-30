'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Thermometer,
  Wallet,
  Target,
  Clock,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Step data for the main platform journey
const STEPS = [
  {
    id: 1,
    title: 'Browse Markets',
    subtitle: 'Find a temperature prediction to bet on',
    description:
      'Explore active weather markets for cities around the world. Each market asks a simple question: Will the temperature be above or below a threshold at a specific time?',
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
    subtitle: 'Link your Flare wallet to participate',
    description:
      'Connect your Flare-compatible wallet to start betting. We support WalletConnect and all major wallets. Your funds stay in your control until you place a bet.',
    icon: Wallet,
    color: 'from-violet-400 to-purple-500',
    bgColor: 'bg-violet-50',
    details: [
      'WalletConnect supported',
      'Non-custodial — you control keys',
      'Bets paid in FLR tokens',
      'Minimum bet: 0.01 FLR',
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
      'When the market\'s resolve time arrives, we fetch the actual temperature from verified weather APIs. The outcome is recorded on-chain — no human intervention.',
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

// Floating particle component
function FloatingParticle({
  delay,
  x,
  size,
}: {
  delay: number;
  x: number;
  size: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full bg-gradient-to-br from-sunset-orange/30 to-sunset-pink/30"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: -20,
      }}
      initial={{ opacity: 0, y: 0 }}
      animate={{
        opacity: [0, 0.6, 0],
        y: [-20, -120],
        x: [0, Math.sin(x) * 20],
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// Step indicator component
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <motion.div
          key={index}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            index < currentStep
              ? 'bg-gradient-to-r from-sky-medium to-sunset-pink'
              : index === currentStep
                ? 'bg-sky-medium'
                : 'bg-neutral-200'
          }`}
          initial={false}
          animate={{
            width: index === currentStep ? 16 : 6,
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// Progress bar component
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="relative h-1.5 w-full bg-neutral-200/50 rounded-full overflow-hidden">
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-medium via-sunset-orange to-sunset-pink rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        animate={{ x: [-80, 400] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
          repeatDelay: 1,
        }}
      />
    </div>
  );
}

// Step content component - vertical centered layout, scaled down to fit
function StepContent({ step, isActive }: { step: (typeof STEPS)[0]; isActive: boolean }) {
  const Icon = step.icon;

  return (
    <motion.div
      className="flex flex-col items-center text-center px-5 py-4"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : 50 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Icon with gradient background - centered */}
      <motion.div
        className={`relative mb-3 p-4 rounded-2xl ${step.bgColor}`}
        initial={{ scale: 0.8, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
      >
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.color} opacity-20`}
        />
        <Icon className="relative w-7 h-7 text-neutral-800" strokeWidth={1.5} />
        
        {/* Sparkle decoration */}
        <motion.div
          className="absolute -top-1 -right-1"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 15, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles className="w-3 h-3 text-sunset-orange" />
        </motion.div>
      </motion.div>

      {/* Step number */}
      <motion.div
        className="mb-1 text-[10px] font-body uppercase tracking-widest text-neutral-400"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        Step {step.id} of 5
      </motion.div>

      {/* Title */}
      <motion.h3
        className="mb-1 text-xl font-display font-bold text-neutral-800"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        {step.title}
      </motion.h3>

      {/* Subtitle */}
      <motion.p
        className={`mb-2 text-xs font-body font-medium bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        {step.subtitle}
      </motion.p>

      {/* Description */}
      <motion.p
        className="mb-3 text-sm font-body text-neutral-600 max-w-xs leading-relaxed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
      >
        {step.description}
      </motion.p>

      {/* Details list - vertical */}
      <motion.ul
        className="space-y-1 text-left"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        {step.details.map((detail, index) => (
          <motion.li
            key={index}
            className="flex items-center gap-2 text-xs font-body text-neutral-500"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.45 + index * 0.06 }}
          >
            <div
              className={`w-1 h-1 rounded-full flex-shrink-0 bg-gradient-to-r ${step.color}`}
            />
            {detail}
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  );
}

// Main modal component
export function HowWeatherbWorksModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsOpen(false);
      setCurrentStep(0);
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset to first step when closing
      setTimeout(() => setCurrentStep(0), 300);
    }
  }, []);

  const triggerButton = (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
    >
      <HelpCircle className="w-4 h-4" />
      <span className="font-body">How it works</span>
    </Button>
  );

  if (!mounted) {
    return triggerButton;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden bg-gradient-to-b from-white to-cloud-off border-0 shadow-2xl">
        {/* Floating particles background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingParticle delay={0} x={15} size={6} />
          <FloatingParticle delay={0.8} x={50} size={8} />
          <FloatingParticle delay={1.6} x={85} size={5} />
        </div>

        {/* Header with progress bar */}
        <DialogHeader className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2 gap-2 pr-6">
            <DialogTitle className="text-base font-display font-semibold text-neutral-800">
              How weatherB Works
            </DialogTitle>
            <StepIndicator currentStep={currentStep} totalSteps={STEPS.length} />
          </div>
          <ProgressBar progress={progress} />
        </DialogHeader>

        {/* Step content with animations */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {STEPS[currentStep] && (
              <StepContent
                key={currentStep}
                step={STEPS[currentStep]}
                isActive={true}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Navigation footer */}
        <div className="px-5 pb-4 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`gap-1 font-body text-xs transition-all duration-300 ${
                currentStep === 0
                  ? 'opacity-0 pointer-events-none'
                  : 'opacity-100'
              }`}
            >
              <ChevronLeft className="w-3 h-3" />
              Back
            </Button>

            {/* Skip link */}
            <button
              onClick={() => handleOpenChange(false)}
              className="text-xs font-body text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Skip
            </button>

            {/* Next/Finish button */}
            <Button
              size="sm"
              onClick={handleNext}
              className={`gap-1 font-body text-xs min-w-[80px] transition-all duration-300 ${
                currentStep === STEPS.length - 1
                  ? 'bg-gradient-to-r from-sunset-orange to-sunset-pink hover:shadow-sunset text-white'
                  : 'bg-sky-medium hover:bg-sky-deep text-white'
              }`}
            >
              {currentStep === STEPS.length - 1 ? (
                <>
                  Let&apos;s bet!
                  <Sparkles className="w-3 h-3" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-3 h-3" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
