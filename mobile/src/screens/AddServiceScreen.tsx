import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors } from '../constants/colors';
import { formatCurrency, type ServiceGroup } from '../data/catalogModels';
import { servicesApi } from '../api/services';
import { groupServices } from '../mappers/catalog';

type Props = NativeStackScreenProps<HomeStackParamList, 'AddService'>;

export default function AddServiceScreen({ route, navigation }: Props) {
  const { branchId, selected, onConfirm } = route.params;
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(selected);

  useEffect(() => {
    servicesApi.list(branchId)
      .then((services) => setServiceGroups(groupServices(services)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được dịch vụ'))
      .finally(() => setLoading(false));
  }, [branchId]);

  const adjustQuantity = (id: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.min(1, Math.max(0, (prev[id] ?? 0) + delta)) }));
  };

  const handleConfirm = () => {
    const addedServices = serviceGroups
      .flatMap((group) => group.items)
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({
        id: item.id,
        name: item.name,
        duration: item.duration,
        price: item.price,
        quantity: 1,
      }));
    onConfirm(addedServices);
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thêm dịch vụ</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />}
        {!!error && <Text style={styles.serviceDuration}>{error}</Text>}
        {serviceGroups.map((group) => (
          <View key={group.name}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupHeaderText}>{group.name}</Text>
              <View style={styles.groupHeaderRight}>
                <Text style={styles.groupHeaderCount}>{group.items.length} dịch vụ</Text>
                <Ionicons name="chevron-down" size={16} color={colors.primary} />
              </View>
            </View>
            {group.items.map((item) => (
              <View key={item.id} style={styles.serviceRow}>
                <View style={styles.serviceInfo}>
                  <View style={styles.serviceNameRow}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textGray} />
                    <Text style={styles.serviceName}>{item.name}</Text>
                  </View>
                  <Text style={styles.serviceDuration}>{item.duration}</Text>
                  <Text style={styles.servicePrice}>{formatCurrency(item.price)}</Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepperButton} activeOpacity={0.7} onPress={() => adjustQuantity(item.id, -1)}>
                    <Ionicons name="remove" size={16} color={colors.textGray} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{quantities[item.id] ?? 0}</Text>
                  <TouchableOpacity
                    style={[styles.stepperButton, styles.stepperButtonAdd]}
                    activeOpacity={0.7}
                    onPress={() => adjustQuantity(item.id, 1)}
                  >
                    <Ionicons name="add" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <TouchableOpacity style={styles.confirmButton} activeOpacity={0.85} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Đồng Ý</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  content: {
    paddingBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  groupHeaderText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupHeaderCount: {
    fontSize: 13,
    color: colors.primary,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceInfo: {
    flex: 1,
    gap: 6,
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceName: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  serviceDuration: {
    fontSize: 13,
    color: colors.textGray,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonAdd: {
    backgroundColor: colors.primaryLight,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    minWidth: 18,
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
