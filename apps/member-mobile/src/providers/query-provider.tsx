import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/functions';

/** docs/06 §7 — staleTime per resource, set at the call site, not globally. */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              // A refusal is an answer. Retrying a 401 or a 403 just delays the
              // redirect and multiplies the failure in the logs.
              if (error instanceof ApiError) {
                if (['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_GYM_MEMBER', 'NOT_FOUND'].includes(error.code)) {
                  return false;
                }
              }
              return failureCount < 2;
            },
            staleTime: 30_000,
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
