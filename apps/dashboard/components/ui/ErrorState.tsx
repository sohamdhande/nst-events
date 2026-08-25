import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function ErrorState({ className, title = 'Error', message = 'Something went wrong.', action, ...props }: ErrorStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center rounded-lg border border-error-surface bg-error-surface/30 p-8 text-center", className)}
      {...props}
    >
      <AlertTriangle className="h-8 w-8 text-error-base mb-4" />
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
