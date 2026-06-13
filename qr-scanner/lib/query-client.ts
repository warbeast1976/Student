import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ApiHttpError } from '@/lib/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'online',
      retry: (failureCount, error) => {
        if (error instanceof ApiHttpError) {
          // Skip retries for client-side errors except rate limiting.
          if (error.status >= 400 && error.status < 500 && error.status !== 429) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(800 * 2 ** attemptIndex, 3000),
    },
    mutations: {
      networkMode: 'online',
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'sars_mobile_query_cache_v1',
});
