import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors, elevation, layout, radius, space, type } from '../theme';
import { servicePriceLabel, type ServiceGroup } from '../data/catalogModels';
import { servicesApi } from '../api/services';
import { groupServices } from '../mappers/catalog';
import { AppButton, EmptyState, LoadingState, ScreenHeader } from '../ui';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddService'>;

export default function AddServiceScreen({ route, navigation }: Props) {
  const { branchId, shopName, selected, onConfirm } = route.params;
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(selected);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    servicesApi.list(branchId)
      .then((services) => { if (active) setServiceGroups(groupServices(services)); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Không tải được dịch vụ'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, attempt]);

  const toggle = (id: string) => setQuantities((prev) => ({ ...prev, [id]: prev[id] ? 0 : 1 }));
  const count = Object.values(quantities).filter(Boolean).length;

  const handleConfirm = () => {
    const addedServices = serviceGroups
      .flatMap((group) => group.items)
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({ id: item.id, name: item.name, duration: item.duration, price: item.price, quantity: 1 }));
    onConfirm(addedServices);
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Thêm dịch vụ" subtitle={shopName} onBack={() => navigation.goBack()} />
      {isLoading ? <LoadingState message="Đang tải dịch vụ…" /> : error ? (
        <EmptyState icon="cloud-offline-outline" title="Không tải được dịch vụ" message={error} actionLabel="Thử lại" onAction={() => setAttempt((value) => value + 1)} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.hint}>Dịch vụ thêm được đặt cùng lịch hẹn. Giá cuối cùng được hệ thống tính ở bước xem lại.</Text>
          {serviceGroups.map((group) => (
            <View key={group.name} style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>{group.name} <Text style={styles.groupCount}>· {group.items.length}</Text></Text>
              {group.items.map((item) => {
                const checked = Boolean(quantities[item.id]);
                return (
                  <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${item.name}, ${item.duration}, ${servicePriceLabel(item)}`} onPress={() => toggle(item.id)} style={[styles.row, checked && styles.rowChecked]}>
                    <Ionicons accessible={false} name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.primary : colors.borderStrong} />
                    <View style={styles.flex}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>{item.duration}</Text>
                    </View>
                    <Text style={styles.price}>{servicePriceLabel(item)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <AppButton label={count ? `Xong · ${count} dịch vụ thêm` : 'Xong'} onPress={handleConfirm} disabled={isLoading || !!error} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space.xxl },
  hint: { ...type.secondary, marginTop: space.sm },
  group: { marginTop: space.lg },
  groupTitle: { ...type.h3, marginBottom: space.sm },
  groupCount: { ...type.secondary },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  rowChecked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  name: { ...type.bodyStrong },
  meta: { ...type.secondary },
  price: { ...type.price, color: colors.primary, maxWidth: '40%', textAlign: 'right' },
  bottomBar: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, ...elevation.raised },
});
