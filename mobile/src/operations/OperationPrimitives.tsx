import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, space, tones, type } from '../theme';
import { AppButton, SheetModal } from '../ui';
import { useOperations } from './OperationsContext';

export function OperationPage({ title, subtitle, children, inStack = false, right }: { title: string; subtitle?: string; children: React.ReactNode; inStack?: boolean; right?: React.ReactNode }) {
  return (
    <SafeAreaView edges={inStack ? ['left', 'right'] : ['top', 'left', 'right']} style={styles.page}>
      {!inStack && (
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </SafeAreaView>
  );
}

/** Operational action. `secondary` is a quieter tonal action; only lifecycle/decision actions are solid. */
export function OperationButton({ label, onPress, disabled, busy, secondary, danger, icon }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; danger?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return <AppButton label={label} onPress={onPress} disabled={disabled} loading={busy} icon={icon} variant={danger ? (secondary ? 'dangerOutline' : 'danger') : secondary ? 'tonal' : 'primary'} compact={secondary} />;
}

export function OperationState({ message, onRetry, tone = 'neutral' }: { message: string; onRetry?: () => void; tone?: 'neutral' | 'warning' | 'error' }) {
  const palette = tone === 'error' ? tones.danger : tone === 'warning' ? tones.warning : tones.neutral;
  const icon = tone === 'error' ? 'alert-circle-outline' : tone === 'warning' ? 'warning-outline' : 'information-circle-outline';
  return (
    <View style={[styles.state, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={styles.stateRow}>
        <Ionicons accessible={false} name={icon} size={20} color={palette.fg} style={styles.stateIcon} />
        <Text accessibilityLiveRegion="polite" style={styles.stateText}>{message}</Text>
      </View>
      {onRetry && <AppButton compact variant="outline" label="Thử lại" onPress={onRetry} style={styles.retry} />}
    </View>
  );
}

/** One-line context control: authorised branches only, opened as a sheet. */
export function BranchPicker({ inset = true }: { inset?: boolean } = {}) {
  const { branches, branchId, setBranchId, mode } = useOperations();
  const [open, setOpen] = useState(false);
  const select = (id: string | null) => { setOpen(false); setBranchId(id); };
  const label = branches.find(branch => branch.id === branchId)?.name || (mode === 'OWNER' ? 'Tất cả chi nhánh' : 'Chọn chi nhánh');
  const disabled = branches.length < 2 && !(mode === 'OWNER' && branches.length === 1 && branchId === null);
  const options: { id: string | null; name: string }[] = [...(mode === 'OWNER' && branches.length > 1 ? [{ id: null, name: 'Tất cả chi nhánh' }] : []), ...branches];
  return (
    <View style={[styles.branchWrap, !inset && styles.noInset]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Chi nhánh: ${label}${disabled ? '' : '. Đổi chi nhánh'}`}
        accessibilityState={{ disabled }}
        disabled={disabled || !branches.length}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.branch, pressed && { backgroundColor: colors.surfacePressed }]}
      >
        <Ionicons accessible={false} name="storefront-outline" size={18} color={colors.secondary} />
        <Text style={styles.branchText}>{label}</Text>
        {!disabled && branches.length > 0 ? <Ionicons accessible={false} name="chevron-down" size={18} color={colors.secondaryText} /> : null}
      </Pressable>
      <SheetModal visible={open} title="Chi nhánh có quyền" onClose={() => setOpen(false)}>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {options.map(option => {
            const selected = option.id === branchId;
            return (
              <Pressable key={option.id ?? 'all'} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => select(option.id)} style={[styles.option, selected && styles.optionSelected]}>
                <Ionicons accessible={false} name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.borderStrong} />
                <Text style={[styles.optionText, selected && { color: colors.primary, fontWeight: '600' }]}>{option.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </SheetModal>
    </View>
  );
}

export const opStyles = StyleSheet.create({
  section: { ...type.overline, marginTop: space.xl, marginBottom: space.sm },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.sm },
  title: { ...type.h1 },
  subtitle: { ...type.secondary, marginTop: 2 },
  state: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.sm, marginBottom: space.md },
  stateRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  stateIcon: { marginTop: 2 },
  stateText: { ...type.secondary, color: colors.body, flex: 1 },
  retry: { alignSelf: 'flex-start' },
  branchWrap: { marginHorizontal: layout.gutter, marginBottom: space.sm },
  noInset: { marginHorizontal: 0 },
  branch: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: layout.touch - 4, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  branchText: { ...type.secondaryStrong, color: colors.heading, flexShrink: 1 },
  options: { gap: space.sm },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { ...type.body, color: colors.heading, flex: 1 },
});
