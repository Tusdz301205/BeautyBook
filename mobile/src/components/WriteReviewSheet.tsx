import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, space, type } from '../theme';
import { AppButton, SheetModal, TextField } from '../ui';

const STAR_COUNT = 5;
const STAR_WORDS = ['', 'Không hài lòng', 'Chưa tốt', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];
const STAR_COLOR = '#9A6206';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (score: number, text: string) => void;
  isSubmitting?: boolean;
  minLength?: number;
}

export default function WriteReviewSheet({ visible, onClose, onSubmit, isSubmitting = false, minLength = 0 }: Props) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) { setStars(0); setText(''); }
  }, [visible]);

  const tooShort = text.trim().length < minLength;
  const disabled = stars === 0 || tooShort || isSubmitting;
  const submit = () => { if (!disabled) onSubmit(stars, text.trim()); };

  return (
    <SheetModal
      visible={visible}
      title="Viết đánh giá"
      subtitle="Đánh giá giúp người khác chọn dịch vụ phù hợp."
      onClose={onClose}
      locked={isSubmitting}
      footer={<AppButton label={isSubmitting ? 'Đang gửi…' : 'Gửi đánh giá'} loading={isSubmitting} disabled={disabled} onPress={submit} />}
    >
      <Text style={styles.label}>Bạn hài lòng như thế nào?</Text>
      <View accessibilityRole="radiogroup" style={styles.stars}>
        {Array.from({ length: STAR_COUNT }, (_, index) => index + 1).map((value) => (
          <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} sao, ${STAR_WORDS[value]}`} accessibilityState={{ checked: stars === value }} onPress={() => setStars(value)} style={styles.star}>
            <Ionicons name={value <= stars ? 'star' : 'star-outline'} size={34} color={value <= stars ? STAR_COLOR : colors.borderStrong} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.verdict}>{stars ? `${stars}/5 · ${STAR_WORDS[stars]}` : 'Chạm vào số sao để chọn'}</Text>
      <TextField
        label="Chia sẻ trải nghiệm của bạn"
        optional={minLength === 0}
        value={text}
        onChangeText={setText}
        placeholder="Dịch vụ, thái độ nhân viên, không gian…"
        multiline
        helper={minLength > 0 ? `Nhận xét tối thiểu ${minLength} ký tự (${text.trim().length}/${minLength}).` : undefined}
      />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  label: { ...type.secondaryStrong, color: colors.heading, marginTop: space.xs },
  stars: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  star: { width: layout.touch + 8, height: layout.touch + 8, alignItems: 'center', justifyContent: 'center' },
  verdict: { ...type.secondary, textAlign: 'center', marginBottom: space.lg },
});
