import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, space, type, fw } from '../theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
  password?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  optional?: boolean;
};

const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, helper, password, icon, optional, multiline, style, onFocus, onBlur, editable = true, ...inputProps }, ref) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}{optional ? <Text style={styles.optional}> · không bắt buộc</Text> : null}</Text>
      <View style={[styles.box, multiline && styles.multiline, focused && styles.focused, !!error && styles.error, !editable && styles.readOnly]}>
        {icon ? <Ionicons accessible={false} name={icon} size={layout.iconMd} color={focused ? colors.primary : colors.secondaryText} style={multiline ? styles.iconTop : undefined} /> : null}
        <TextInput
          ref={ref}
          {...inputProps}
          editable={editable}
          multiline={multiline}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          accessibilityHint={error ?? helper}
          placeholderTextColor={colors.disabledText}
          secureTextEntry={password && !revealed}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        />
        {password ? (
          <Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setRevealed((value) => !value)} style={styles.reveal}>
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={layout.iconMd} color={colors.secondaryText} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  wrapper: { marginBottom: space.lg },
  label: { ...type.secondaryStrong, color: colors.heading, marginBottom: space.xs + 2 },
  optional: { ...type.secondary, ...fw.regular },
  box: { minHeight: layout.inputMinHeight, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface, paddingLeft: space.md + 2, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  multiline: { alignItems: 'flex-start', minHeight: 104 },
  focused: { borderColor: colors.primary, borderWidth: 2 },
  error: { borderColor: colors.error, borderWidth: 2 },
  readOnly: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  iconTop: { marginTop: space.md + 2 },
  input: { flex: 1, minWidth: 0, ...type.body, color: colors.heading, paddingVertical: space.md, paddingRight: space.md },
  inputMultiline: { minHeight: 100 },
  reveal: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...type.secondary, color: colors.error, marginTop: space.xs + 2 },
  helper: { ...type.caption, marginTop: space.xs + 2 },
});
