import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import { reviewsApi } from '../api/reviews';
import { useDiscoveryResource } from '../hooks/useDiscoveryResource';
import { EmptyState, LoadingState, RatingPill } from '../ui';
import { discoveryStyles as styles } from './discoveryStyles';

export default function DiscoveryReviews({ kind, id }: { kind: 'service' | 'staff'; id: string }) {
  const fetcher = useCallback(() => kind === 'service' ? reviewsApi.byService(id) : reviewsApi.byStaff(id), [kind, id]);
  const { data, loading, error, reload } = useDiscoveryResource(fetcher);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Đánh giá</Text>
    {loading ? <LoadingState message="Đang tải đánh giá…" /> : error ? <EmptyState title="Chưa tải được đánh giá" message={error} actionLabel="Thử lại" onAction={reload} /> : !data?.ratings.length ? <Text style={styles.meta}>Chưa có đánh giá.</Text> : <>
      <RatingPill value={data.averageRating} count={data.totalRatings} />
      {data.totalRatings > data.ratings.length ? <Text style={styles.meta}>Hiển thị {data.ratings.length} đánh giá gần đây.</Text> : null}
      {data.ratings.map((review, index) => <View key={`${review.createdAt}-${index}`} style={styles.card}>
        <Text style={styles.strong}>{review.customerName || 'Khách hàng'}</Text>
        <RatingPill value={review.rating} />
        <Text style={styles.meta}>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</Text>
        {review.serviceName ? <Text style={styles.meta}>{review.serviceName}</Text> : null}
        {review.staff ? <Text style={styles.meta}>{review.staff.fullName}</Text> : null}
        {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
      </View>)}
    </>}
  </View>;
}
