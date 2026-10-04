import { useCallback, useEffect, useState } from 'react';
import { branchesApi } from '../api/branches';
import { combosApi } from '../api/combos';
import { reviewsApi } from '../api/reviews';
import { groupServices, mapBranchDetail, mapCombo, mapReview, mapStaff, RemoteCombo, RemoteVenue } from '../mappers/catalog';
import type { Review, ServiceGroup, StaffMember } from '../data/catalogModels';

export function useBranchDetail(branchId: string) {
  const [venue, setVenue] = useState<RemoteVenue | null>(null);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [combos, setCombos] = useState<RemoteCombo[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await branchesApi.detail(branchId);
      if (!detail) throw new Error('Không tìm thấy địa điểm này');
      const [comboRows, reviewResponse] = await Promise.all([
        combosApi.listPublic(branchId),
        reviewsApi.byBusiness(detail.businessId),
      ]);
      setVenue(mapBranchDetail(detail));
      setServiceGroups(groupServices(detail.services));
      setStaff(mapStaff(detail.staff));
      setCombos(comboRows.map((combo) => mapCombo(combo, detail)));
      setReviews(reviewResponse.data.map(mapReview));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được chi tiết địa điểm');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { venue, serviceGroups, staff, combos, reviews, isLoading, error, reload };
}

