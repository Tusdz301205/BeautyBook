import React from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useOperationTabHeight() {
  const { fontScale } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  return Math.max(64, Math.ceil(30 + 36 * fontScale + bottom));
}

export default function OperationTabLabel({ title, color }: { title: string; color: string }) {
  return <Text style={{ color, fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 2 }}>{title}</Text>;
}
