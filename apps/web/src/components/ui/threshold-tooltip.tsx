'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ThresholdTooltipProps {
  threshold: number;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Tooltip explaining the ≥ (greater than or equal to) symbol
 * Shows explanations in the top 5 most spoken languages
 * Uses portal to escape parent overflow constraints
 */
export function ThresholdTooltip({
  threshold,
  children,
  className,
}: ThresholdTooltipProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const handleMouseLeave = useCallback(() => {
    // Small delay to allow moving to tooltip
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, []);

  // English explanation (default, no header needed)
  const englishText = `This means: the temperature will be ${threshold}°F or higher. If it's exactly ${threshold}°F or above, YES wins.`;

  // Translations for other top spoken languages
  const translations = [
    {
      lang: '中文',
      flag: '🇨🇳',
      text: `意思是：温度将达到${threshold}°F或更高。如果正好${threshold}°F或以上，YES赢。`,
    },
    {
      lang: 'हिन्दी',
      flag: '🇮🇳',
      text: `इसका मतलब है: तापमान ${threshold}°F या उससे अधिक होगा। अगर ${threshold}°F या उससे ऊपर है, तो YES जीतता है।`,
    },
    {
      lang: 'Español',
      flag: '🇪🇸',
      text: `Significa: la temperatura será ${threshold}°F o más. Si es exactamente ${threshold}°F o superior, YES gana.`,
    },
    {
      lang: 'العربية',
      flag: '🇸🇦',
      text: `هذا يعني: درجة الحرارة ستكون ${threshold}°F أو أعلى. إذا كانت ${threshold}°F بالضبط أو أكثر، يفوز YES.`,
    },
  ];

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex items-center ${className || ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span
          className="cursor-help underline decoration-dotted decoration-neutral-400 underline-offset-2 hover:decoration-sky-500 transition-colors"
          aria-describedby="threshold-tooltip"
        >
          {children || '≥'}
        </span>
      </span>

      {/* Render tooltip in portal to escape overflow:hidden */}
      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                id="threshold-tooltip"
                role="tooltip"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="fixed z-9999 w-72 sm:w-80"
                style={{
                  top: position.top,
                  left: position.left,
                  transform: 'translateX(-50%)',
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                {/* Arrow */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-l border-t border-neutral-200" />

                {/* Tooltip content */}
                <div className="relative bg-white rounded-xl shadow-xl border border-neutral-200 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 bg-linear-to-r from-sky-50 to-orange-50 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📚</span>
                      <span className="font-display font-bold text-neutral-800 text-sm">
                        What does ≥ mean?
                      </span>
                    </div>
                  </div>

                  {/* Explanations - scrollable */}
                  <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
                    {/* English (default - no header) */}
                    <div className="px-4 py-3 border-b border-neutral-100">
                      <p className="font-body text-xs text-neutral-700 leading-relaxed">
                        {englishText}
                      </p>
                    </div>

                    {/* Other languages with headers */}
                    {translations.map((exp, index) => (
                      <div
                        key={exp.lang}
                        className={`px-4 py-3 ${index !== translations.length - 1 ? 'border-b border-neutral-100' : ''}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{exp.flag}</span>
                          <span className="font-body font-semibold text-xs text-neutral-600 uppercase tracking-wide">
                            {exp.lang}
                          </span>
                        </div>
                        <p
                          className="font-body text-xs text-neutral-700 leading-relaxed"
                          dir={exp.lang === 'العربية' ? 'rtl' : 'ltr'}
                        >
                          {exp.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Footer hint */}
                  <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100">
                    <p className="font-body text-[10px] text-neutral-500 text-center">
                      ≥ means &quot;greater than or equal to&quot;
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
