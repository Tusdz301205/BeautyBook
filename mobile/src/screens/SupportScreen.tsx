import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<AccountStackParamList, 'Support'>;

const FAQS = [
  {
    question: 'Làm sao để hủy lịch hẹn đã đặt?',
    answer: 'Vào mục "Hoạt động", chọn lịch hẹn cần hủy và bấm "Hủy lịch hẹn".',
  },
  { question: 'Tôi có thể đổi lịch đã đặt không?', answer: 'Mở chi tiết lịch hẹn và chọn Yêu cầu đổi lịch. Cơ sở sẽ duyệt trước khi lịch mới có hiệu lực.' },
  {
    question: 'Ưu đãi áp dụng như thế nào?',
    answer: 'Khuyến mãi tự động và mã voucher hợp lệ được hệ thống tính trong phần xem trước giá khi đặt lịch.',
  },
];

export default function SupportScreen({ navigation }: Props) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hỗ trợ</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Câu hỏi thường gặp</Text>
        <View style={styles.group}>
          {FAQS.map((faq, index) => (
            <View key={faq.question} style={[styles.faqRow, index < FAQS.length - 1 && styles.rowDivider]}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textGray,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  rowValue: {
    fontSize: 13,
    color: colors.textGray,
  },
  faqRow: {
    paddingVertical: 16,
    gap: 6,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  faqAnswer: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
  },
});
