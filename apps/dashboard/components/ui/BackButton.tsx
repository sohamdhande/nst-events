'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fallbackHref?: string;
  label?: string;
}

export function BackButton({ fallbackHref = '/student/home', label = 'Back', className, ...props }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // If the window history length is > 1, there's a previous page we can go back to.
    // In SPAs, history.length is sometimes not completely reliable for detecting internal vs external refers.
    // For V1, prefer router.back(), but if we want more robust handling we could parse referrer or history state.
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        "flex items-center gap-2 text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-variant/50 p-2 rounded-lg transition-colors",
        className
      )}
      aria-label={label}
      {...props}
    >
      <ArrowLeft className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}
