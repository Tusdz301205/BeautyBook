import { Prisma } from '@prisma/client';
import { IMPACT_DEADLINE_TITLE, legacyImpactDeadlineBodySql, presentLegacyImpactDeadlineBody } from './impact-notification-labels';

export const REPORT_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  OTHER: 'Khác', PII: 'Thông tin cá nhân', ABUSE: 'Nội dung xúc phạm', THREAT: 'Đe dọa',
  HATE: 'Thù ghét', SEXUAL: 'Nội dung không phù hợp', SPAM: 'Spam / giả mạo',
});
export const REPORT_SEVERITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Nghiêm trọng',
});
const reportTitles = ['Đánh giá đã được báo cáo', 'Đánh giá tạm ẩn để kiểm duyệt'];
const legacyPattern = /^Phân loại: ([A-Z_]+) — mức độ: ([A-Z_]+)$/;
const unknownSummary = 'Đánh giá đã được báo cáo để quản trị viên xem xét.';

export function reviewReportSummary(category: string, severity: string): string {
  if (!Object.hasOwn(REPORT_CATEGORY_LABELS, category) || !Object.hasOwn(REPORT_SEVERITY_LABELS, severity)) return unknownSummary;
  return `Phân loại: ${REPORT_CATEGORY_LABELS[category]} — mức độ: ${REPORT_SEVERITY_LABELS[severity]}`;
}

export function presentNotificationBody(notification: { type: string; targetType: string | null; title: string; body: string | null }): string | null {
  if (notification.type === 'SYSTEM' && ['OPERATIONAL_IMPACT', 'OperationalImpactCase'].includes(notification.targetType ?? '') && notification.title === IMPACT_DEADLINE_TITLE) {
    return presentLegacyImpactDeadlineBody(notification.body);
  }
  if (notification.type !== 'SYSTEM' || notification.targetType !== 'REVIEW' && notification.targetType !== null || !reportTitles.includes(notification.title)) return notification.body;
  const match = legacyPattern.exec(notification.body ?? '');
  return match ? reviewReportSummary(match[1], match[2]) : notification.body;
}

// Use the same presentation for search before pagination, without rewriting
// historical notification rows or trusting client-supplied SQL identifiers.
export function presentedNotificationBodySql(): Prisma.Sql {
  const cases = Object.keys(REPORT_CATEGORY_LABELS).flatMap(category => Object.keys(REPORT_SEVERITY_LABELS).map(severity =>
    Prisma.sql`WHEN n.body = ${`Phân loại: ${category} — mức độ: ${severity}`} THEN ${reviewReportSummary(category, severity)}`));
  return Prisma.sql`CASE WHEN n.type::text = ${'SYSTEM'} AND (n.target_type = ${'REVIEW'} OR n.target_type IS NULL)
    AND n.title IN (${Prisma.join(reportTitles)}) THEN CASE ${Prisma.join(cases, ' ')}
      ELSE CASE WHEN n.body ~ ${legacyPattern.source} THEN ${unknownSummary} ELSE n.body END END
    ELSE CASE WHEN n.type::text = ${'SYSTEM'} AND n.target_type IN (${'OPERATIONAL_IMPACT'}, ${'OperationalImpactCase'})
      AND n.title = ${IMPACT_DEADLINE_TITLE} THEN ${legacyImpactDeadlineBodySql()} ELSE n.body END END`;
}
