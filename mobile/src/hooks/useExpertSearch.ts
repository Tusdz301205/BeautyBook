import { useEffect, useState } from 'react';

import { staffApi } from '../api/staff';
import type { ApiStaff } from '../types/api';
import type { SearchVenue } from '../mappers/catalog';

export interface SearchExpert extends ApiStaff {
  venue: SearchVenue;
}

export function useExpertSearch(venues: SearchVenue[], enabled: boolean) {
  const [experts, setExperts] = useState<SearchExpert[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const venueKey = venues.map((venue) => `${venue.id}:${venue.servicesFromSearch[0]?.id ?? ''}`).join('|');

  useEffect(() => {
    if (!enabled) return;
    if (venues.length === 0) {
      setExperts([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all(
      venues.map(async (venue) => {
        const firstMatchingServiceId = venue.servicesFromSearch[0]?.id;
        const rows = await staffApi.publicByServices(
          venue.id,
          firstMatchingServiceId ? [firstMatchingServiceId] : [],
        );
        return rows.map((staff) => ({ ...staff, venue }));
      }),
    )
      .then((groups) => {
        if (!active) return;
        const unique = new Map<string, SearchExpert>();
        groups.flat().forEach((expert) => unique.set(expert.id, expert));
        setExperts([...unique.values()]);
      })
      .catch((reason) => {
        if (!active) return;
        setExperts([]);
        setError(reason instanceof Error ? reason.message : 'Không tải được danh sách chuyên gia');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, venueKey]);

  return { experts, isLoading, error };
}
