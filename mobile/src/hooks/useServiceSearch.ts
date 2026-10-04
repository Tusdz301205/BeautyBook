import { useEffect, useMemo, useRef, useState } from 'react';
import { servicesApi, ServiceSearchFilters } from '../api/services';
import { groupSearchRows } from '../mappers/catalog';
import type { ApiSearchService } from '../types/api';

export function useServiceSearch(filters: ServiceSearchFilters) {
  const [rows, setRows] = useState<ApiSearchService[]>([]);
  const venues = useMemo(() => groupSearchRows(rows), [rows]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const queryKey = JSON.stringify({ filters, refreshKey });
  const currentQueryKey = useRef(queryKey);
  currentQueryKey.current = queryKey;
  useEffect(() => {
    let active = true;
    setPage(1);
    setHasMore(false);
    setRows([]);
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await servicesApi.search({ ...filters, limit: 50 });
        if (active) {
          setRows(response.data);
          setHasMore(response.hasMore);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Không tìm kiếm được dịch vụ');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [queryKey]);

  const loadMore = async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const requestedQuery = queryKey;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await servicesApi.search({ ...filters, page: nextPage, limit: 50 });
      if (currentQueryKey.current !== requestedQuery) return;
      setRows((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...response.data.filter((row) => !seen.has(row.id))];
      });
      setPage(nextPage);
      setHasMore(response.hasMore);
    } catch (reason) {
      if (currentQueryKey.current === requestedQuery) setError(reason instanceof Error ? reason.message : 'Không tải thêm được dịch vụ');
    } finally {
      setLoadingMore(false);
    }
  };

  return { rows, venues, isLoading, error, hasMore, isLoadingMore, loadMore, reload: () => setRefreshKey((current) => current + 1) };
}
