import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import { promotionsApi } from '../api/promotions';
import { formatCurrency } from '../data/catalogModels';
import { useDiscoveryResource } from '../hooks/useDiscoveryResource';
import { AppButton, EmptyState, LoadingState } from '../ui';
import { discoveryStyles as styles } from './discoveryStyles';
import { promotionAudienceLabel, promotionsForService } from './promotionDiscovery';

type Target = { id: string; name: string };
const dateLabel = (date: string) => new Date(date).toLocaleDateString('vi-VN');

export default function BranchPromotions({ branchId, serviceId, services = [], combos = [], onService, onCombo }: {
  branchId: string;
  serviceId?: string;
  services?: Target[];
  combos?: Target[];
  onService?: (id: string) => void;
  onCombo?: (id: string) => void;
}) {
  const fetcher = useCallback(() => promotionsApi.byBranch(branchId), [branchId]);
  const { data, loading, error, reload } = useDiscoveryResource(fetcher);
  // An unlinked promotion applies branch-wide; combo-only promotions do not apply to a single service.
  const rows = promotionsForService(data ?? [], serviceId);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Khuyến mãi tại cơ sở</Text>
    {loading ? <LoadingState message="Đang tải khuyến mãi…" /> : error ? <EmptyState title="Chưa tải được khuyến mãi" message={error} actionLabel="Thử lại" onAction={reload} /> : !rows.length ? <Text style={styles.meta}>Chưa có khuyến mãi phù hợp.</Text> : rows.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.heading}>{item.name}</Text>
      <Text style={styles.price}>{item.discountType === 'PERCENTAGE' ? `Giảm ${Number(item.discountValue)}%` : item.discountType === 'FIXED_AMOUNT' || item.discountType === 'FIXED' ? `Giảm ${formatCurrency(Number(item.discountValue))}` : 'Ưu đãi theo điều kiện cơ sở'}</Text>
      {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
      <Text style={styles.meta}>Từ {dateLabel(item.startDate)} đến {dateLabel(item.endDate)}</Text>
      <Text style={styles.meta}>{promotionAudienceLabel(item.audience)} · {item.autoApply ? 'Tự động áp dụng khi đủ điều kiện' : 'Áp dụng theo điều kiện cơ sở'}</Text>
      <Text style={styles.meta}>{item.stackingAllowed ? 'Có thể kết hợp ưu đãi khác' : 'Không kết hợp ưu đãi khác'}</Text>
      {item.maxUsagePerCustomer != null ? <Text style={styles.meta}>Tối đa {item.maxUsagePerCustomer} lần/khách hàng</Text> : null}
      {item.totalQuantity != null ? <Text style={styles.meta}>Tổng số lượt: {item.totalQuantity}</Text> : null}
      {!item.serviceIds.length && !item.comboIds.length ? <Text style={styles.meta}>Áp dụng cho dịch vụ và combo tại cơ sở</Text> : <>
        {item.serviceIds.map((id, index) => <AppButton key={id} variant="ghost" label={`Dịch vụ: ${services.find(target => target.id === id)?.name || `Dịch vụ áp dụng ${index + 1}`}`} disabled={!onService} onPress={() => onService?.(id)} />)}
        {item.comboIds.map((id, index) => <AppButton key={id} variant="ghost" label={`Combo: ${combos.find(target => target.id === id)?.name || `Combo áp dụng ${index + 1}`}`} disabled={!onCombo} onPress={() => onCombo?.(id)} />)}
      </>}
      <Text style={styles.meta}>Mức giảm cuối cùng được xác nhận khi đặt lịch.</Text>
    </View>)}
  </View>;
}
