import { BadRequestException } from '@nestjs/common';

// Shape validation only. Source: TT90/2026 Article5, Law108/2025 Article11,
// and the Citizenship Identification Law Article12. No identity verification.
export const LEGAL_SUBJECT_CATALOG = [
  { code: 'ORGANIZATION_10', label: 'Doanh nghiệp / tổ chức độc lập', pattern: '^[0-9]{2}(?!0000000)[0-9]{7}[0-9]$', hint: 'Mã số thuế gồm 10 chữ số.' },
  { code: 'DEPENDENT_13', label: 'Đơn vị phụ thuộc / địa điểm kinh doanh', pattern: '^[0-9]{2}(?!0000000)[0-9]{7}[0-9]-(?!000)[0-9]{3}$', hint: '10 chữ số, dấu gạch nối và 3 chữ số, ví dụ 0123456789-001.' },
  { code: 'VN_HOUSEHOLD_12', label: 'Hộ kinh doanh / hộ gia đình có số định danh Việt Nam', pattern: '^[0-9]{12}$', hint: 'Dùng số định danh cá nhân gồm 12 chữ số của chủ hộ.' },
  { code: 'VN_INDIVIDUAL_12', label: 'Cá nhân kinh doanh có số định danh Việt Nam', pattern: '^[0-9]{12}$', hint: 'Dùng số định danh cá nhân gồm 12 chữ số.' },
  { code: 'FOREIGN_PERSON_10', label: 'Cá nhân nước ngoài / ở nước ngoài chưa có số định danh Việt Nam', pattern: '^[0-9]{2}(?!0000000)[0-9]{7}[0-9]$', hint: 'Mã số thuế 10 chữ số do cơ quan thuế cấp.' },
  { code: 'LEGACY_DEPENDENT_10', label: 'Đơn vị phụ thuộc giữ mã 10 chữ số theo trường hợp chuyển tiếp', pattern: '^[0-9]{2}(?!0000000)[0-9]{7}[0-9]$', hint: 'Chỉ chọn khi giấy tờ thuế xác nhận trường hợp chuyển tiếp; bắt buộc xét duyệt thủ công.' },
] as const;
export const REPRESENTATIVE_IDENTITY_CATALOG = [
  { code: 'VN_CITIZEN_ID', label: 'Căn cước / số định danh cá nhân Việt Nam', pattern: '^[0-9]{12}$', hint: 'Gồm 12 chữ số; không dùng số CMND 9 chữ số.' },
  { code: 'FOREIGN_PASSPORT', label: 'Hộ chiếu nước ngoài', pattern: null, hint: 'Nhập đúng số trên hộ chiếu. Không áp dụng định dạng căn cước Việt Nam.' },
] as const;
export type LegalRegistration = { legalSubjectType?: unknown; representativeIdentityType?: unknown };
export function legalIdentifierErrors(identity: { taxCode?: unknown; identityCardNumber?: unknown }, registration: LegalRegistration = {}, required = false) {
  const errors: Record<string, string> = {};
  const tax = typeof identity.taxCode === 'string' ? identity.taxCode.trim() : '';
  const number = typeof identity.identityCardNumber === 'string' ? identity.identityCardNumber.trim() : '';
  const subject = LEGAL_SUBJECT_CATALOG.find(x => x.code === registration.legalSubjectType);
  const representative = REPRESENTATIVE_IDENTITY_CATALOG.find(x => x.code === registration.representativeIdentityType);
  if (!subject && (required || tax || registration.legalSubjectType)) errors.legalSubjectType = 'Chọn loại chủ thể pháp lý trước khi nhập mã số thuế.';
  if (subject && ((required && !tax) || (tax && !new RegExp(subject.pattern).test(tax)))) errors.taxCode = `Mã số thuế: ${subject.hint}`;
  if (!representative && (number || registration.representativeIdentityType)) errors.representativeIdentityType = 'Chọn loại giấy tờ định danh người đại diện.';
  if (representative?.pattern && number && !new RegExp(representative.pattern).test(number)) errors.identityCardNumber = 'Số định danh cá nhân Việt Nam phải gồm 12 chữ số.';
  return errors;
}
export function assertLegalIdentifiers(identity: { taxCode?: unknown; identityCardNumber?: unknown }, registration: LegalRegistration = {}, required = false) {
  const errors = legalIdentifierErrors(identity, registration, required);
  if (Object.keys(errors).length) throw new BadRequestException({ code: 'LEGAL_IDENTIFIER_INVALID', fields: errors, message: Object.values(errors).join(' ') });
}
