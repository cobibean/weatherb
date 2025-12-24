'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TemperatureDisplayProps {
  /** Temperature in Fahrenheit (whole number) */
  fahrenheit: number;
  /** Show ≥ threshold symbol before temperature */
  showThreshold?: boolean;
  /** Text size variant */
  size?: 'sm' | 'base' | 'lg';
  /** Additional classes for the temperature text */
  className?: string;
}

/**
 * Converts Fahrenheit to Celsius
 * Formula: C = (F - 32) * 5/9
 * Rounds to nearest whole number
 */
function fahrenheitToCelsius(fahrenheit: number): number {
  return Math.round((fahrenheit - 32) * 5 / 9);
}

/**
 * Temperature display with Celsius tooltip on hover
 * Shows Fahrenheit with a tooltip displaying the Celsius equivalent
 * Uses portal to escape parent overflow constraints
 */
export function TemperatureDisplay({ 
  fahrenheit, 
  showThreshold = false,
  size = 'base',
  className = ''
}: TemperatureDisplayProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle client-side mounting to avoid hydration issues
  useEffect(() => {
    setMounted(true);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
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
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 50);
  }, []);

  const celsius = fahrenheitToCelsius(fahrenheit);

  // Size classes for the temperature text
  const sizeClasses = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
  };

  return (
    <>
      <span 
        ref={triggerRef}
        className="inline-flex items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span 
          className={`
            cursor-help 
            decoration-dotted decoration-neutral-400 underline-offset-2 
            hover:decoration-sky-500 transition-colors
            font-semibold text-neutral-800
            ${sizeClasses[size]}
            ${className}
          `}
          style={{
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
          }}
          aria-describedby="temperature-tooltip"
        >
          {showThreshold && '≥ '}{fahrenheit}°F
        </span>
      </span>

      {/* Render tooltip in portal to escape overflow:hidden - client-side only */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="temperature-tooltip"
              role="tooltip"
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              className="fixed z-[9999]"
              style={{ 
                top: position.top, 
                left: position.left,
                transform: 'translateX(-50%)',
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* Arrow */}
              <div 
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                style={{
                  background: 'linear-gradient(135deg, rgba(248, 251, 255, 0.95), rgba(255, 255, 255, 0.9))',
                  borderLeft: '1px solid rgba(91, 165, 229, 0.2)',
                  borderTop: '1px solid rgba(91, 165, 229, 0.2)',
                }}
              />
              
              {/* Tooltip content - glass morphism style */}
              <div 
                className="relative px-3 py-1.5 rounded-lg shadow-lg overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(248, 251, 255, 0.95), rgba(255, 255, 255, 0.9))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(91, 165, 229, 0.2)',
                }}
              >
                <span className="font-mono text-sm font-medium text-neutral-700 whitespace-nowrap">
                  ≈ {celsius}°C
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}




