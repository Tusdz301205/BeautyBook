import { useCallback, useEffect, useRef, useState } from 'react';
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
  const sequence = useRef(0);
  const [extrasError, setExtrasError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError(null);
    setExtrasError(null);
    try {
      const detail = await branchesApi.detail(branchId);
      if (!detail) throw new Error('Không tìm thấy địa điểm này');
      if (request !== sequence.current) return;
      setVenue(mapBranchDetail(detail));
      setServiceGroups(groupServices(detail.services ?? []));
      setStaff(mapStaff(detail.staff ?? []));
      setLoading(false);
      const [comboResult, reviewResult] = await Promise.allSettled([
        combosApi.listPublic(branchId),
        reviewsApi.byBusiness(detail.businessId),
      ]);
      if (request !== sequence.current) return;
      setCombos(comboResult.status === 'fulfilled' ? comboResult.value.map((combo) => mapCombo(combo, detail)) : []);
      setReviews(reviewResult.status === 'fulfilled' ? reviewResult.value.data.map(mapReview) : []);
      if (comboResult.status === 'rejected' || reviewResult.status === 'rejected') setExtrasError('Chưa tải được một phần ưu đãi hoặc đánh giá. Bạn vẫn có thể xem thông tin và chọn dịch vụ.');
    } catch (reason) {
      if (request === sequence.current) setError(reason instanceof Error ? reason.message : 'Không tải được chi tiết địa điểm');
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    setVenue(null); setServiceGroups([]); setStaff([]); setCombos([]); setReviews([]);
    void reload();
    return () => { sequence.current += 1; };
  }, [reload]);

  return { venue, serviceGroups, staff, combos, reviews, isLoading, error, extrasError, reload };
}
