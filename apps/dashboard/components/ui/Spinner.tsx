import { cn } from '../../lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary-base", className)}
      role="status"
      aria-label="Loading"
    />
  );
}
