'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

/**
 * Banner component promoting the Arc Testnet faucet for test tokens
 * Positioned between hero and market grid for optimal visibility
 * Styled with brand colors: sky blues, sunset gradients, and cloud backgrounds
 */
export function FaucetBanner(): React.ReactElement {
  return (
    <motion.section
      className="bg-linear-to-r from-sky-light/30 via-cloud-off to-sky-light/30 border-y border-sky-medium/20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-sm sm:text-base font-body text-neutral-800">
            <span className="text-lg">💧</span>
            <span className="font-semibold">Need test tokens to bet?</span>
          </div>
          <Link
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-sunset-orange to-sunset-pink hover:from-sunset-orange/90 hover:to-sunset-pink/90 text-white font-body font-semibold rounded-xl transition-all duration-200 focus-ring shadow-sunset hover:shadow-sunset-lg hover:-translate-y-0.5"
          >
            Get USDC from Faucet
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </Link>
          <p className="text-xs sm:text-sm font-body text-neutral-600 font-medium">
            No wallet connect needed
          </p>
        </div>
      </div>
    </motion.section>
  );
}
