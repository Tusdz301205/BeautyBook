import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  password?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function AuthField({ label, error, password, icon, ...inputProps }: Props) {
  const [isFocused, setFocused] = useState(false);
  const [isPasswordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, isFocused && styles.inputFocused, !!error && styles.inputError]}>
        <Ionicons name={icon} size={20} color={isFocused ? colors.primary : colors.textMuted} />
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={password && !isPasswordVisible}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
        />
        {password && (
          <TouchableOpacity onPress={() => setPasswordVisible((current) => !current)} hitSlop={8}>
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={21}
              color={colors.textGray}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 17 },
  label: { color: colors.textBody, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  inputWrap: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
  },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.discountRed },
  input: { flex: 1, color: colors.textDark, fontSize: 16, paddingVertical: 14 },
  error: { color: colors.discountRed, fontSize: 13, marginTop: 6, lineHeight: 18 },
});
