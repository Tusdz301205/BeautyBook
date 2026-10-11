import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { colors, space, type } from '../theme';

export type TabConfig = Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }>;

/** One tab bar for Customer, Staff and Owner: icon + label, pill indicator, grows with font scale. */
export default function BrandTabBar({ state, navigation, insets, config, hiddenRoutes = [] }: BottomTabBarProps & { config: TabConfig; hiddenRoutes?: string[] }) {
  const { fontScale } = useWindowDimensions();
  const focused = state.routes[state.index];
  const nested = getFocusedRouteNameFromRoute(focused);
  if (nested && hiddenRoutes.includes(nested)) return null;
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm), minHeight: Math.max(64, Math.ceil(30 + 36 * fontScale + insets.bottom)) }]}>
      {state.routes.map((route, index) => {
        const active = state.index === index;
        const item = config[route.name] ?? { label: route.name, icon: 'ellipse-outline', activeIcon: 'ellipse' };
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={onPress} style={styles.tab}>
            <View style={[styles.indicator, active && styles.indicatorActive]}>
              <Ionicons accessible={false} name={active ? item.activeIcon : item.icon} size={22} color={active ? colors.primary : colors.secondaryText} />
            </View>
            <Text style={[styles.label, { color: active ? colors.primary : colors.secondaryText }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: space.xs + 2 },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  indicator: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  indicatorActive: { backgroundColor: colors.primarySoft },
  label: { ...type.tab, textAlign: 'center' },
});
