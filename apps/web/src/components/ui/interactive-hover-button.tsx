'use client';

import React from 'react';
import { ArrowRight, Check, X, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'yes' | 'no' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button text label */
  text?: string;
  /** Color variant */
  variant?: ButtonVariant;
  /** Size variant */
  size?: ButtonSize;
  /** Custom icon (defaults to ArrowRight, or Check/X for yes/no variants) */
  icon?: LucideIcon;
  /** Hide the icon completely */
  hideIcon?: boolean;
  /** Full width button */
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; hoverBg: string }> = {
  default: {
    bg: 'bg-neutral-800',
    text: 'text-white',
    hoverBg: 'bg-neutral-900',
  },
  yes: {
    bg: 'bg-gradient-to-r from-sky-medium to-sky-light',
    text: 'text-white',
    hoverBg: 'bg-sky-dark',
  },
  no: {
    bg: 'bg-gradient-to-r from-sunset-coral to-sunset-peach',
    text: 'text-white',
    hoverBg: 'bg-sunset-coral',
  },
  outline: {
    bg: 'bg-transparent border-2 border-neutral-300',
    text: 'text-neutral-700',
    hoverBg: 'bg-neutral-800',
  },
  ghost: {
    bg: 'bg-transparent',
    text: 'text-neutral-600',
    hoverBg: 'bg-neutral-200',
  },
};

const sizeStyles: Record<ButtonSize, { padding: string; text: string; icon: string; minWidth: string }> = {
  sm: {
    padding: 'px-4 py-2',
    text: 'text-sm',
    icon: 'w-4 h-4',
    minWidth: 'min-w-[80px]',
  },
  md: {
    padding: 'px-6 py-2.5',
    text: 'text-base',
    icon: 'w-5 h-5',
    minWidth: 'min-w-[100px]',
  },
  lg: {
    padding: 'px-8 py-3',
    text: 'text-lg',
    icon: 'w-6 h-6',
    minWidth: 'min-w-[120px]',
  },
};

const defaultIcons: Record<ButtonVariant, LucideIcon> = {
  default: ArrowRight,
  yes: Check,
  no: X,
  outline: ArrowRight,
  ghost: ArrowRight,
};

const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(
  (
    {
      text = 'Button',
      variant = 'default',
      size = 'md',
      icon,
      hideIcon = false,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const styles = variantStyles[variant];
    const sizeStyle = sizeStyles[size];
    const IconComponent = icon ?? defaultIcons[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          // Base styles
          'group relative cursor-pointer overflow-hidden rounded-xl font-body font-bold transition-all duration-300',
          'hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]',
          sizeStyle.padding,
          sizeStyle.text,
          sizeStyle.minWidth,
          styles.bg,
          styles.text,
          fullWidth && 'w-full',
          disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
          className
        )}
        {...props}
      >
        {/* Default state text - slides out on hover */}
        <span
          className={cn(
            'inline-block transition-all duration-300',
            !hideIcon && 'group-hover:translate-x-12 group-hover:opacity-0'
          )}
        >
          {text}
        </span>

        {/* Hover state - text + icon slides in */}
        {!hideIcon && (
          <div
            className={cn(
              'absolute inset-0 z-10 flex items-center justify-center gap-2 opacity-0 transition-all duration-300',
              'translate-x-12 group-hover:translate-x-0 group-hover:opacity-100',
              styles.text
            )}
          >
            <span>{text}</span>
            <IconComponent className={sizeStyle.icon} />
          </div>
        )}
      </button>
    );
  }
);

InteractiveHoverButton.displayName = 'InteractiveHoverButton';

export { InteractiveHoverButton };
export type { InteractiveHoverButtonProps, ButtonVariant, ButtonSize };

