import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 250;
const STAR_COUNT = 5;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (score: number, text: string) => void;
  isSubmitting?: boolean;
  minLength?: number;
}

export default function WriteReviewSheet({ visible, onClose, onSubmit, isSubmitting = false, minLength = 0 }: Props) {
  const [isRendered, setIsRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      setStars(0);
      setText('');
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

  const handleSubmit = () => {
    if (stars === 0 || text.trim().length < minLength) return;
    onSubmit(stars, text.trim());
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <AnimatedTouchable style={[styles.backdrop, { opacity: backdropOpacity }]} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>Viết đánh giá</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Bạn hài lòng như thế nào?</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((value) => (
                <TouchableOpacity key={value} activeOpacity={0.7} onPress={() => setStars(value)} hitSlop={6}>
                  <Ionicons
                    name={value <= stars ? 'star' : 'star-outline'}
                    size={36}
                    color={value <= stars ? '#F5A623' : colors.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Chia sẻ trải nghiệm của bạn</Text>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="Dịch vụ, thái độ nhân viên, không gian..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />
            {minLength > 0 && <Text style={styles.label}>Nhận xét tối thiểu {minLength} ký tự.</Text>}

            <TouchableOpacity
              style={[styles.submitButton, (stars === 0 || text.trim().length < minLength || isSubmitting) && styles.submitButtonDisabled]}
              activeOpacity={0.85}
              disabled={stars === 0 || text.trim().length < minLength || isSubmitting}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>{isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textDark,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.primaryLight,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
