import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedValue)}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-neutral-200',
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-neutral-900 transition-[width]"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };
