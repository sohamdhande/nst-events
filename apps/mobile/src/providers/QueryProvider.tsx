import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const noRetryStatuses = [401, 403, 404, 422];
        if (error?.status && noRetryStatuses.includes(error?.status)) {
          return false; // Do not retry auth/business deterministic failures
        }
        return failureCount < 1; // Retry network/5xx transient failures once
      },
      refetchOnWindowFocus: true,
      staleTime: 5000,
    },
  },
});

export const AppQueryProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
