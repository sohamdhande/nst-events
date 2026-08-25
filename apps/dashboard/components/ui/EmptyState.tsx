import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { FileX2 } from 'lucide-react';

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: 'default' | 'card';
}

export function EmptyState({ className, title, description, icon, action, variant = 'default', ...props }: EmptyStateProps) {
  const isCard = variant === 'card';
  
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-in fade-in-50",
        isCard ? "p-4" : "rounded-lg border border-dashed border-gray-300 p-8",
        className
      )}
      {...props}
    >
      <div className={cn("mx-auto flex items-center justify-center rounded-full bg-gray-100", isCard ? "h-10 w-10 mb-3" : "h-12 w-12 mb-4")}>
        {icon || <FileX2 className={cn("text-gray-400", isCard ? "h-5 w-5" : "h-6 w-6")} />}
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && <div className={cn(isCard ? "mt-4" : "mt-6")}>{action}</div>}
    </div>
  );
}
