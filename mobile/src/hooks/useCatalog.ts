import { useCallback, useEffect, useRef, useState } from 'react';
import { combosApi } from '../api/combos';
import { branchesApi } from '../api/branches';
import { servicesApi } from '../api/services';
import { groupSearchRows, mapCategory, mapCombo, RemoteCombo, RemoteVenue } from '../mappers/catalog';
import type { Category } from '../data/catalogModels';

export function useCatalog(location?: string) {
  const [venues, setVenues] = useState<RemoteVenue[]>([]);
  const [combos, setCombos] = useState<RemoteCombo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const extras = Promise.allSettled([combosApi.listPublic(), servicesApi.categories()]);
      const searchResponse = await servicesApi.search({ location, sort: 'rating', limit: 50 });
      if (requestRef.current !== requestId) return;
      const searchVenues = groupSearchRows(searchResponse.data);
      const byId = new Map(searchVenues.map((venue) => [venue.id, venue]));
      setVenues(searchVenues);
      setLoading(false);
      const [comboResult, categoryResult] = await extras;
      if (requestRef.current !== requestId) return;
      setCombos(comboResult.status === 'fulfilled'
        ? comboResult.value.map((combo) => mapCombo(combo, byId.get(combo.branchId)))
        : []);
      setCategories(categoryResult.status === 'fulfilled' ? categoryResult.value.map(mapCategory) : []);
      const photoResults = await Promise.allSettled(searchVenues.slice(0, 8).map((venue) => branchesApi.detail(venue.id)));
      if (requestRef.current !== requestId) return;
      const photosById = new Map<string, string[]>();
      photoResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          photosById.set(searchVenues[index].id, result.value.images?.map((item) => item.media.url).filter(Boolean) ?? []);
        }
      });
      setVenues(searchVenues.map((venue) => ({ ...venue, imageUrls: photosById.get(venue.id) ?? [] })));
    } catch (reason) {
      if (requestRef.current === requestId) setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu trang chủ');
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { venues, combos, categories, isLoading, error, reload };
}
