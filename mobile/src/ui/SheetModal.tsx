import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, elevation, layout, radius, space, type } from '../theme';
import IconButton from './IconButton';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Prevents dismissal while a request is running. */
  locked?: boolean;
  scroll?: boolean;
};

export default function SheetModal({ visible, title, subtitle, onClose, children, footer, locked, scroll = true }: Props) {
  const close = () => { if (!locked) onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Đóng ${title}`} style={styles.scrim} onPress={close} />
        <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <IconButton icon="close" label={`Đóng ${title}`} onPress={close} disabled={locked} />
          </View>
          {scroll ? <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={styles.body}>{children}</View>}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  sheet: { maxHeight: '88%', backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, ...elevation.raised },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: layout.gutter + space.xs, paddingRight: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  flex: { flex: 1, minWidth: 0 },
  title: { ...type.h2 },
  subtitle: { ...type.secondary, marginTop: 2 },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: layout.gutter + space.xs, paddingBottom: space.lg },
  footer: { paddingHorizontal: layout.gutter + space.xs, paddingTop: space.md, paddingBottom: space.md, borderTopWidth: 1, borderTopColor: colors.divider, gap: space.sm },
});
