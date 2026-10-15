import React, { useCallback } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { staffApi } from '../api/staff';
import { useDiscoveryResource } from '../hooks/useDiscoveryResource';
import { AppButton, Avatar, EmptyState, LoadingState, RatingPill, ScreenHeader } from '../ui';
import DiscoveryReviews from '../components/DiscoveryReviews';
import { discoveryStyles as styles } from '../components/discoveryStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'StaffDetail'>;

export default function StaffDetailScreen({ route, navigation }: Props) {
  const fetcher = useCallback(() => staffApi.detail(route.params.staffId), [route.params.staffId]);
  const { data: person, loading, error, reload } = useDiscoveryResource(fetcher);
  return <View style={styles.screen}>
    <ScreenHeader title="Chi tiết chuyên viên" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <LoadingState message="Đang tải chuyên viên…" /> : !person ? <EmptyState title="Chưa mở được chuyên viên" message={error || 'Chuyên viên không còn nhận lịch.'} actionLabel="Thử lại" onAction={reload} /> : <>
        <Avatar uri={person.avatarUrl} name={person.fullName} size={88} />
        <Text accessibilityRole="header" style={styles.title}>{person.fullName}</Text>
        <Text style={styles.meta}>{person.professionalTitle || person.position || 'Chuyên viên'}</Text>
        {person.experienceYears != null ? <Text style={styles.meta}>{person.experienceYears} năm kinh nghiệm</Text> : null}
        {person.ratingCount ? <RatingPill value={person.rating ?? person.averageRating ?? 0} count={person.ratingCount} /> : null}
        <Text style={styles.body}>{person.bio || 'Chuyên viên chưa cập nhật giới thiệu.'}</Text>
        {person.specialties?.length ? <Text style={styles.meta}>Chuyên môn: {person.specialties.join(' · ')}</Text> : null}
        <AppButton variant="outline" label={`Xem ${person.branch.name}`} onPress={() => navigation.navigate('VenueDetail', { venueId: person.branch.id })} />
        {person.images?.length ? <ScrollView horizontal contentContainerStyle={styles.row}>{person.images.map((image, index) => <Image key={`${image.media.url}-${index}`} source={{ uri: image.media.url }} accessibilityLabel={`Ảnh ${person.fullName} ${index + 1}`} style={styles.photo} />)}</ScrollView> : null}
        <Text accessibilityRole="header" style={styles.heading}>Dịch vụ nhận lịch</Text>
        {person.staffServices.length ? person.staffServices.map(({ service }) => <View key={service.id} style={styles.card}>
          <Text style={styles.strong}>{service.name}</Text>
          <Text style={styles.meta}>{service.durationMinutes} phút</Text>
          <AppButton variant="outline" label="Xem dịch vụ và đặt với chuyên viên" onPress={() => navigation.push('ServiceDetail', { serviceId: service.id, initialStaffId: person.id })} />
        </View>) : <Text style={styles.meta}>Chưa có dịch vụ nhận lịch.</Text>}
      </>}
      <DiscoveryReviews kind="staff" id={route.params.staffId} />
    </ScrollView>
  </View>;
}
