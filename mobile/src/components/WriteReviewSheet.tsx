import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, space, type } from '../theme';
import { AppButton, SheetModal, TextField } from '../ui';
import { buildReviewInput, createServiceReviewDrafts, reviewableServices, type ReviewServiceLine, type ServiceReviewDrafts } from '../utils/reviewForm';

const STAR_COUNT = 5;
const STAR_WORDS = ['', 'Không hài lòng', 'Chưa tốt', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];
const STAR_COLOR = '#9A6206';

interface Props {
  visible: boolean;
  onClose: () => void;
  services: readonly ReviewServiceLine[];
  onSubmit: (score: number, text: string, serviceReviews: ServiceReviewDrafts) => void;
  isSubmitting?: boolean;
  minLength?: number;
}

export default function WriteReviewSheet({ visible, onClose, onSubmit, services, isSubmitting = false, minLength = 0 }: Props) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [serviceReviews, setServiceReviews] = useState<ServiceReviewDrafts>(() => createServiceReviewDrafts(services));
  const lines = reviewableServices(services);
  const resetKey = JSON.stringify(services.map(item => [item.id, item.staffId, item.status]));

  useEffect(() => {
    if (visible) { setStars(0); setText(''); setServiceReviews(createServiceReviewDrafts(services)); }
  }, [visible, resetKey]);

  const disabled = !buildReviewInput('', stars, text, services, serviceReviews, minLength) || isSubmitting;
  const submit = () => { if (!disabled) onSubmit(stars, text.trim(), serviceReviews); };
  const updateService = (id: string, patch: Partial<ServiceReviewDrafts[string]>) => {
    setServiceReviews(current => ({ ...current, [id]: { ...(current[id] ?? { rating: 0, comment: '' }), ...patch } }));
  };
  const renderStars = (score: number, onSelect: (value: number) => void, label: string) => (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.stars}>
      {Array.from({ length: STAR_COUNT }, (_, index) => index + 1).map(value => (
        <Pressable key={value} disabled={isSubmitting} accessibilityRole="radio" accessibilityLabel={`${label}: ${value} sao, ${STAR_WORDS[value]}`} accessibilityState={{ checked: score === value, disabled: isSubmitting }} onPress={() => onSelect(value)} style={styles.star}>
          <Ionicons name={value <= score ? 'star' : 'star-outline'} size={34} color={value <= score ? STAR_COLOR : colors.borderStrong} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      title="Viết đánh giá"
      onClose={onClose}
      locked={isSubmitting}
      footer={<AppButton label={isSubmitting ? 'Đang gửi…' : 'Gửi đánh giá'} loading={isSubmitting} disabled={disabled} onPress={submit} />}
    >
      <Text style={styles.label}>Bạn hài lòng như thế nào?</Text>
      {renderStars(stars, setStars, 'Đánh giá chung')}
      <Text style={styles.verdict}>{stars ? `${stars}/5 · ${STAR_WORDS[stars]}` : 'Chạm vào số sao để chọn'}</Text>
      <TextField
        label="Chia sẻ trải nghiệm của bạn"
        optional={minLength === 0}
        value={text}
        onChangeText={setText}
        placeholder="Dịch vụ, thái độ nhân viên, không gian…"
        multiline
        editable={!isSubmitting}
        helper={minLength > 0 ? `Nhận xét tối thiểu ${minLength} ký tự (${text.trim().length}/${minLength}).` : undefined}
      />
      {lines.length > 0 && <Text style={styles.label}>Đánh giá từng dịch vụ · bắt buộc chọn sao</Text>}
      {lines.length < services.length && <Text style={styles.serviceHint}>Dịch vụ đã bỏ qua hoặc đã hủy không được tính trong đánh giá dịch vụ.</Text>}
      {lines.map(item => {
        const draft = serviceReviews[item.id];
        const score = draft?.rating ?? 0;
        const label = [item.serviceName, item.staffName].filter(Boolean).join(' · ');
        return (
          <View key={item.id} style={styles.service}>
            <Text accessibilityRole="header" style={styles.label}>{item.serviceName}</Text>
            {!!item.staffName && <Text style={styles.serviceHint}>Chuyên viên: {item.staffName}</Text>}
            {renderStars(score, rating => updateService(item.id, { rating }), label)}
            <Text style={styles.verdict}>{score ? `${score}/5 · ${STAR_WORDS[score]}` : 'Chọn số sao cho dịch vụ này'}</Text>
            <TextField label={`Nhận xét · ${label}`} optional value={draft?.comment ?? ''} onChangeText={comment => updateService(item.id, { comment })} multiline editable={!isSubmitting} placeholder="Chia sẻ về dịch vụ và chuyên viên…" />
          </View>
        );
      })}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  label: { ...type.secondaryStrong, color: colors.heading, marginTop: space.xs },
  service: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: space.md, marginTop: space.md },
  serviceHint: { ...type.secondary, marginTop: space.xs },
  stars: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  star: { width: layout.touch + 8, height: layout.touch + 8, alignItems: 'center', justifyContent: 'center' },
  verdict: { ...type.secondary, textAlign: 'center', marginBottom: space.lg },
});
