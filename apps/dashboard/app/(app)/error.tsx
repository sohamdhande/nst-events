'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // We do not leak stack traces or internal backend data here.
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center space-y-4 p-8">
      <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
      <p className="text-sm text-gray-500">We encountered an unexpected error.</p>
      <button
        onClick={() => reset()}
        className="rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Try again
      </button>
    </div>
  );
}
