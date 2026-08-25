import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
        {
          'border-transparent bg-gray-100 text-gray-900': variant === 'default',
          'border-transparent bg-success-surface text-success-base': variant === 'success',
          'border-transparent bg-warning-surface text-warning-base': variant === 'warning',
          'border-transparent bg-error-surface text-error-base': variant === 'error',
          'border-transparent bg-info-surface text-info-base': variant === 'info',
        },
        className
      )}
      {...props}
    />
  );
}
