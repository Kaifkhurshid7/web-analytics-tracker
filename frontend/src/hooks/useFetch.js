import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

/**
 * Generic data fetching hook with loading/error states
 */
export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e) {
      setError(e.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}

/**
 * Hook for fetching sessions list
 */
export function useSessions(limit = 50, skip = 0) {
  return useFetch(() => api.fetchSessions(limit, skip), [limit, skip]);
}

/**
 * Hook for fetching detailed session data
 */
export function useSessionDetails(sessionId) {
  return useFetch(
    () => (sessionId ? api.fetchSessionDetails(sessionId) : Promise.resolve(null)),
    [sessionId]
  );
}

/**
 * Hook for fetching heatmap click data
 */
export function useHeatmap(pageUrl) {
  return useFetch(
    () => (pageUrl ? api.fetchHeatmapData(pageUrl) : Promise.resolve(null)),
    [pageUrl]
  );
}

/**
 * Hook for fetching distinct pages
 */
export function usePages() {
  return useFetch(() => api.fetchPages(), []);
}
