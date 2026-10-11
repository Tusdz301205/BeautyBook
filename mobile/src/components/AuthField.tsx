import React from 'react';
import type { TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../ui';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  password?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}

/** Auth forms share the design-system field: visible label, inline error, 48dp reveal toggle. */
export default function AuthField(props: Props) {
  return <TextField {...props} />;
}
