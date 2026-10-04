import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 250;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface Props {
  visible: boolean;
  title: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  columns?: 1 | 2;
}

export default function SelectListSheet({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  columns = 2,
}: Props) {
  const [isRendered, setIsRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: ANIM_DURATION, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setIsRendered(false);
      });
    }
  }, [visible, translateY, backdropOpacity]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!isRendered) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <AnimatedTouchable
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          {options.map((option) => {
            const isSelected = option === selectedValue;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.item, { width: columns === 2 ? '50%' : '100%' }]}
                activeOpacity={0.7}
                onPress={() => onSelect(option)}
              >
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.itemText, isSelected && styles.itemTextSelected]} numberOfLines={2}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 999,
    elevation: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
    paddingLeft: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 12,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  itemText: {
    flex: 1,
    fontSize: 17,
    color: colors.textBody,
  },
  itemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
