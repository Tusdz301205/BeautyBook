import { Prisma, type ImpactAction, type ImpactSubjectType } from '@prisma/client';

export const IMPACT_SUBJECT_LABELS: Readonly<Record<ImpactSubjectType, string>> = Object.freeze({
  STAFF: 'Chuyên viên', BRANCH: 'Chi nhánh', BUSINESS: 'Doanh nghiệp', SCHEDULE: 'Lịch làm việc',
});
export const IMPACT_ACTION_LABELS: Readonly<Record<ImpactAction, string>> = Object.freeze({
  OFFBOARD: 'Ngừng làm việc', PAUSE: 'Tạm ngừng hoạt động', SUSPEND: 'Đình chỉ hoạt động',
  CLOSE: 'Đóng cửa', SCHEDULE_CHANGE: 'Thay đổi lịch làm việc', TRANSFER: 'Chuyển giao',
});

export const IMPACT_DEADLINE_TITLE = 'Hồ sơ lịch bị ảnh hưởng đã quá hạn';
const legacyPrefixes = Object.entries(IMPACT_SUBJECT_LABELS).flatMap(([subject, subjectLabel]) =>
  Object.entries(IMPACT_ACTION_LABELS).map(([action, actionLabel]) => ({
    stored: `${subject} · ${action}:`, shown: `${subjectLabel} — ${actionLabel}:`,
  })));

export function impactDeadlineBody(subject: ImpactSubjectType, action: ImpactAction, reason: string): string {
  return `${IMPACT_SUBJECT_LABELS[subject]} — ${IMPACT_ACTION_LABELS[action]}: ${reason}`;
}

export function presentLegacyImpactDeadlineBody(body: string | null): string | null {
  if (body == null) return body;
  const prefix = legacyPrefixes.find(value => body.startsWith(value.stored));
  return prefix ? prefix.shown + body.slice(prefix.stored.length) : body;
}

// Fixed notification alias only. Preserve the reason exactly; never replace
// enum-like words elsewhere in a user's text or rewrite stored history.
export function legacyImpactDeadlineBodySql(): Prisma.Sql {
  const cases = legacyPrefixes.map(prefix => Prisma.sql`
    WHEN LEFT(n.body, ${prefix.stored.length}::int) = ${prefix.stored}
      THEN ${prefix.shown} || SUBSTRING(n.body FROM ${prefix.stored.length + 1}::int)`);
  return Prisma.sql`CASE ${Prisma.join(cases, ' ')} ELSE n.body END`;
}
