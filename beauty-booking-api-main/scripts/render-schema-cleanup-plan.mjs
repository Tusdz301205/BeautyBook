import { readFileSync, writeFileSync } from 'node:fs';
const decisions = JSON.parse(readFileSync('../docs/schema-audit-decisions.json', 'utf8'));
const evidence = JSON.parse(readFileSync('../tmp/manager-refactor/schema-cleanup-evidence-20260919.json', 'utf8'));
const usage = JSON.parse(readFileSync('../tmp/manager-refactor/usage-evidence.json', 'utf8'));
const safe = text => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const rows = evidence.rows.filter(row => decisions.models[row.model]?.action !== 'KEEP');
const lines = ['# BeautyBook — Đề xuất cleanup schema cần duyệt', '',
  `Đối chiếu tăng dần ngày 19/09/2026; bằng chứng DB READ ONLY: ${evidence.capturedAt}. Không có lệnh drop/delete trong tài liệu hoặc script sinh tài liệu.`, '',
  '## Quyết định cần người dùng xác nhận', '',
  '- Đề xuất giai đoạn kế tiếp: archive nguyên graph 12 model sức khỏe/consultation đã retired, rồi bỏ chúng khỏi active Prisma schema. KHÔNG xóa cứng; chưa thực hiện.',
  '- SensitiveConsent còn 2 dòng; các bảng khác trong nhóm đang rỗng trên DB được đọc. Không suy rộng số liệu này sang môi trường khác.',
  '- SalonMember: giữ compatibility hiện tại, chưa gộp. CancellationPolicy: chuyển MERGE_CANDIDATE sang REFACTOR vì cancellation 4h cố định nhưng reschedule vẫn dùng resolver.',
  '- 25 REFACTOR là danh sách cần thiết kế/test riêng, không phải cho phép sửa hàng loạt. PlatformSetting và PayoutAccountVersion vẫn cần quyết định nghiệp vụ.',
  '- Ba migration additive account separation/event/restriction chưa áp dụng DB chính. Cần phê duyệt triển khai riêng; không gộp chúng với destructive cleanup.', '',
  '## Bảng đề xuất theo model', '',
  'Số dòng/FK là hiện trạng DB chính. Runtime dependency tái sử dụng bằng chứng đã kiểm tra ngày 15/09, kết hợp delta policy ngày 19/09; trước migration phải kiểm tra lại caller liên quan, không coi direct usage bằng 0 là dead code.', '',
  '| Model | Current decision | New evidence | Runtime dependency | DB rows | FK/history impact | Final proposal |',
  '|---|---|---|---|---:|---|---|'];
for (const row of rows) {
  const d = decisions.models[row.model];
  const prior = usage.models.find(m => m.name === row.model);
  const calls = Object.values(prior ?? {}).filter(Array.isArray).flat().filter(x => x && typeof x.path === 'string');
  const paths = [...new Set(calls.map(x => x.path))].slice(0, 4);
  const incoming = row.fks.filter(f => f.target === row.table);
  const outgoing = row.fks.filter(f => f.source === row.table);
  const proposal = d.action === 'REMOVE_CANDIDATE' ? 'Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop.'
    : d.action === 'MERGE_CANDIDATE' ? 'Giữ nguyên; cần mapping compatibility trước đề xuất migration.'
    : d.action === 'NEEDS_REVIEW' ? 'Chờ xác nhận nghiệp vụ; chưa sửa schema.' : 'Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change.';
  lines.push(`| ${row.model} | ${d.action} | ${safe(d.reason)} | ${paths.length ? paths.map(p => '`' + p + '`').join('; ') : 'Nested/history/schema dependency; xem audit gốc, không kết luận không dùng'} | ${row.count ?? 'Chưa có bảng'} | ${incoming.length} FK vào; ${outgoing.length} FK ra. ${incoming.length ? 'Bảng tham chiếu: ' + [...new Set(incoming.map(f => f.source))].join(', ') : 'Không có FK vào không đồng nghĩa được xóa lịch sử.'} | ${proposal} |`);
}
lines.push('', '## FK cụ thể để duyệt migration', '');
for (const row of rows) {
  lines.push(`### ${row.model} / ${row.table}`, '', `${row.count ?? 'Chưa có bảng'} dòng tại thời điểm snapshot.`, '');
  if (!row.fks.length) lines.push('Không có FK vật lý liên quan trong snapshot; vẫn kiểm tra JSON/scalar ID và query raw SQL.');
  for (const fk of row.fks) lines.push(`- \`${fk.name}\`: \`${fk.source}\` → \`${fk.target}\`; \`${fk.definition}\`.`);
  lines.push('');
}
lines.push('## Quy trình archive/recovery bắt buộc trước khi được phép triển khai', '',
  '1. Chốt retention/đơn vị có quyền đọc archive, đặc biệt 2 dòng consent; không xuất nội dung cá nhân vào Git.',
  '2. Kiểm tra lại callers, Prisma relation và SQL trigger/function tham chiếu 12 bảng; archive theo cả graph. FK ra User/Booking/Service phải giữ ID và được bảo vệ, không CASCADE xóa lịch sử.',
  '3. Backup native PostgreSQL, kiểm tra restore trên fresh copy; lưu counts/fingerprint cả graph và 4.000 booking trước/sau. Không vô hiệu trigger bất biến của HealthRecordAccessLog để xóa dữ liệu.',
  '4. Chuẩn bị forward migration archive/rename và reverse migration tương ứng. Chưa có SQL migration cleanup được phê duyệt; không gọi đây là rollback đã được kiểm chứng.',
  '5. Sau chỉnh Prisma, regenerate client, sửa code còn tham chiếu retired model, chạy build/unit/DB/API/browser; kiểm tra hủy/no-show/điểm/giới hạn/role/public-preview/counter payment và concurrency.',
  '6. Nếu rehearsal lỗi hoặc fingerprint đổi ngoài phạm vi: dừng. Recovery dùng bản backup đã restore thử hoặc reverse migration trong cửa sổ bảo trì; không reset database.',
  '7. Chỉ triển khai DB chính sau người dùng phê duyệt phạm vi và bằng chứng rehearsal. Chưa vẽ 5 sơ đồ khóa luận cuối cùng trước khi chốt schema.', '');
writeFileSync('../docs/DATABASE_SCHEMA_CLEANUP_APPROVAL.md', lines.join('\n'));
console.log(JSON.stringify({ proposals: rows.length, status: 'AWAITING_APPROVAL_NO_DATABASE_CHANGES' }));
