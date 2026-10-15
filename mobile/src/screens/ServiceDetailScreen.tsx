import React, { useCallback } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { servicesApi } from '../api/services';
import { useDiscoveryResource } from '../hooks/useDiscoveryResource';
import { AppButton, Avatar, EmptyState, LoadingState, ScreenHeader } from '../ui';
import { mapService } from '../mappers/catalog';
import { formatCurrency, servicePriceLabel } from '../data/catalogModels';
import DiscoveryReviews from '../components/DiscoveryReviews';
import BranchPromotions from '../components/BranchPromotions';
import { discoveryStyles as styles } from '../components/discoveryStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'ServiceDetail'>;

export default function ServiceDetailScreen({ route, navigation }: Props) {
  const fetcher = useCallback(() => servicesApi.detail(route.params.serviceId), [route.params.serviceId]);
  const { data: service, loading, error, reload } = useDiscoveryResource(fetcher);
  const mapped = service ? mapService(service) : null;
  const staff = service?.staffServices?.map(item => item.staff) ?? [];
  const initialStaffId = staff.some(person => person.id === route.params.initialStaffId) ? route.params.initialStaffId : undefined;
  const book = () => {
    if (!service || !mapped) return;
    navigation.navigate('Booking', {
      branchId: service.branchId,
      shopName: service.branch?.business?.name || service.branch?.name || 'Cơ sở',
      addresses: service.branch?.addressLine ? [service.branch.addressLine] : [],
      service: { id: service.id, name: service.name, duration: mapped.duration, price: mapped.price, originalPrice: mapped.price },
      serviceIds: [service.id],
      staffOptions: staff.map(person => ({ id: person.id, name: person.fullName })),
      initialStaffId,
    });
  };
  return <View style={styles.screen}>
    <ScreenHeader title="Chi tiết dịch vụ" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <LoadingState message="Đang tải dịch vụ…" /> : !service || !mapped ? <EmptyState title="Chưa mở được dịch vụ" message={error || 'Dịch vụ không còn nhận lịch.'} actionLabel="Thử lại" onAction={reload} /> : <>
        <Text accessibilityRole="header" style={styles.title}>{service.name}</Text>
        <Text style={styles.price}>{servicePriceLabel(mapped)}</Text>
        <Text style={styles.meta}>{mapped.duration}</Text>
        <AppButton variant="ghost" label={service.branch?.name || 'Xem cơ sở'} onPress={() => navigation.navigate('VenueDetail', { venueId: service.branchId })} />
        {service.images?.length ? <ScrollView horizontal contentContainerStyle={styles.row}>{service.images.map((image, index) => <Image key={`${image.media.url}-${index}`} source={{ uri: image.media.url }} accessibilityLabel={`Ảnh ${service.name} ${index + 1}`} style={styles.photo} />)}</ScrollView> : null}
        <Text style={styles.body}>{service.description || 'Cơ sở chưa cập nhật mô tả dịch vụ.'}</Text>
        {service.variants?.length ? <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>Lựa chọn dịch vụ</Text>
          {service.variants.map(variant => <View key={variant.id} style={styles.card}>
            <Text style={styles.strong}>{variant.name}</Text>
            <Text style={styles.price}>{variant.priceDisplay || (variant.priceType === 'QUOTE' ? 'Cần tư vấn' : variant.price == null ? 'Liên hệ cơ sở' : `${variant.priceType === 'FROM' ? 'Từ ' : ''}${formatCurrency(Number(variant.price))}${variant.priceType === 'RANGE' && variant.maxPrice != null ? ` – ${formatCurrency(Number(variant.maxPrice))}` : ''}`)}</Text>
            {variant.durationMinutes != null ? <Text style={styles.meta}>{variant.durationMinutes}{variant.maxDurationMinutes && variant.maxDurationMinutes !== variant.durationMinutes ? `–${variant.maxDurationMinutes}` : ''} phút</Text> : null}
          </View>)}
        </View> : null}
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>Chuyên viên thực hiện</Text>
          {staff.length ? staff.map(person => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`Xem chuyên viên ${person.fullName}`} style={[styles.card, styles.row]} onPress={() => navigation.push('StaffDetail', { staffId: person.id })}>
            <Avatar uri={person.avatarUrl} name={person.fullName} size={48} />
            <View style={styles.flex}><Text style={styles.strong}>{person.fullName}</Text><Text style={styles.meta}>{person.professionalTitle || 'Chuyên viên'}</Text></View>
          </Pressable>) : <Text style={styles.meta}>Chưa có chuyên viên được công bố.</Text>}
        </View>
        <AppButton label={initialStaffId ? 'Đặt lịch với chuyên viên đã chọn' : 'Đặt dịch vụ này'} onPress={book} disabled={service.bookable === false} />
        <AppButton variant="outline" label="Chọn nhiều dịch vụ tại cơ sở" onPress={() => navigation.navigate('VenueDetail', { venueId: service.branchId, serviceId: service.id })} />
        <BranchPromotions branchId={service.branchId} serviceId={service.id} services={[service]} onService={id => navigation.push('ServiceDetail', { serviceId: id })} onCombo={id => navigation.push('ComboDetail', { comboId: id })} />
      </>}
      <DiscoveryReviews kind="service" id={route.params.serviceId} />
    </ScrollView>
  </View>;
}
