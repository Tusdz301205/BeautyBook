import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { useOperations } from './OperationsContext';

export function OperationPage({ title, children, inStack = false }: { title: string; children: React.ReactNode; inStack?: boolean }) {
  return <SafeAreaView edges={inStack ? ['left', 'right'] : ['top', 'left', 'right']} style={styles.page}>{!inStack && <Text accessibilityRole="header" style={styles.title}>{title}</Text>}{children}</SafeAreaView>;
}
export function OperationButton({ label, onPress, disabled, busy, secondary }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || busy || pressed) && { opacity: 0.65 }]}>{busy ? <ActivityIndicator color={secondary ? colors.primary : colors.white} /> : <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{label}</Text>}</Pressable>;
}
export function OperationState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <View style={styles.state}><Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>{onRetry && <OperationButton label="Thử lại" onPress={onRetry} secondary />}</View>; }
export function BranchPicker({ inset = true }: { inset?: boolean } = {}) {
  const { branches, branchId, setBranchId, mode } = useOperations();
  const [open, setOpen] = useState(false);
  const select = (id: string | null) => { setOpen(false); setBranchId(id); };
  return <View style={[styles.branches, !inset && { marginHorizontal: 0 }]}><OperationButton label={branches.find(branch => branch.id === branchId)?.name || (mode === 'OWNER' ? 'Tất cả chi nhánh' : 'Chọn chi nhánh')} secondary onPress={() => setOpen(true)} disabled={!branches.length} /><Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><SafeAreaView style={styles.page}><Text accessibilityRole="header" style={styles.title}>Chi nhánh có quyền</Text><FlatList contentContainerStyle={{ padding: 20, gap: 12 }} data={branches} keyExtractor={branch => branch.id} ListHeaderComponent={mode === 'OWNER' && branches.length > 1 ? <OperationButton label="Tất cả chi nhánh" onPress={() => select(null)} secondary /> : null} renderItem={({ item }) => <OperationButton label={item.name} onPress={() => select(item.id)} secondary={branchId !== item.id} />} /><View style={{ padding: 20 }}><OperationButton label="Đóng" secondary onPress={() => setOpen(false)} /></View></SafeAreaView></Modal></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, title: { fontSize: 26, fontWeight: '800', color: colors.textDark, marginHorizontal: 20, marginVertical: 16 }, body: { color: colors.textBody, fontSize: 16, lineHeight: 24 }, state: { padding: 20, gap: 12 }, button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: colors.primary }, buttonText: { color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center', flexShrink: 1 }, secondary: { backgroundColor: colors.primaryLight }, branches: { marginHorizontal: 20, marginBottom: 12, gap: 8 } });
