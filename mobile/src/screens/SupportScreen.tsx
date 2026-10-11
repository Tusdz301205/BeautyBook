import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors, layout, radius, space, type } from '../theme';
import { ScreenHeader } from '../ui';

type Props = NativeStackScreenProps<AccountStackParamList, 'Support'>;

const FAQS = [
  {
    question: 'Làm sao để hủy lịch hẹn đã đặt?',
    answer: 'Vào tab Lịch hẹn, mở lịch cần hủy. Nếu còn đủ thời gian theo chính sách, chọn “Hủy lịch hẹn”. Nếu đã sát giờ, chọn “Gửi yêu cầu hủy sát giờ” để cơ sở duyệt.',
  },
  { question: 'Tôi có thể đổi lịch đã đặt không?', answer: 'Mở chi tiết lịch hẹn và chọn “Yêu cầu đổi lịch”. Lịch hiện tại vẫn giữ nguyên cho tới khi cơ sở duyệt yêu cầu.' },
  { question: 'Vì sao lịch của tôi đang “Chờ cơ sở xác nhận”?', answer: 'Một số cơ sở cần xác nhận trước khi lịch có hiệu lực. Trạng thái sẽ cập nhật trong tab Lịch hẹn.' },
  {
    question: 'Ưu đãi áp dụng như thế nào?',
    answer: 'Khuyến mãi tự động và mã voucher hợp lệ được hệ thống tính trong phần xem lại giá khi đặt lịch. Giá được kiểm tra lại khi bạn gửi.',
  },
  { question: 'Tôi muốn đăng ký cho doanh nghiệp của mình?', answer: 'Đăng ký và quản trị doanh nghiệp thực hiện trên phiên bản web BeautyBook. Ứng dụng này dành cho khách hàng, nhân viên và chủ doanh nghiệp đã được cấp tài khoản.' },
];

export default function SupportScreen({ navigation }: Props) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Hỗ trợ" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.groupTitle}>Câu hỏi thường gặp</Text>
        <View style={styles.group}>
          {FAQS.map((faq, index) => {
            const expanded = open === index;
            return (
              <View key={faq.question} style={[styles.item, index < FAQS.length - 1 && styles.divider]}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : index)} style={styles.question}>
                  <Text style={styles.questionText}>{faq.question}</Text>
                  <Ionicons accessible={false} name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.secondaryText} />
                </Pressable>
                {expanded ? <Text style={styles.answer}>{faq.answer}</Text> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl },
  groupTitle: { ...type.overline, marginTop: space.md, marginBottom: space.sm },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  item: { paddingHorizontal: space.lg },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  question: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  questionText: { ...type.bodyStrong, flex: 1 },
  answer: { ...type.body, paddingBottom: space.lg },
});
