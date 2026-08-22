# Platform Settings, Trust Safety, Onboarding & Attendance QR Report

Ngày hoàn tất: 17/07/2026  
Workspace: Beauty Booking (NestJS/Prisma/PostgreSQL + React/Vite)  
Trạng thái: đã triển khai, migrate, build, test và kiểm tra trên ứng dụng Docker local.

## 1. Scope đã làm

- Biến Platform Settings thành nguồn policy có default, validation, audit và được booking/review/onboarding/branch/notification/attendance đọc thật.
- Hoàn thiện Trust & Safety snapshot, drill-down lý do và workflow xử lý theo business/branch.
- Thay onboarding giấy tờ JSON bằng document metadata UI, timeline, review history, reason và checklist readiness.
- Xây module Staff Attendance bằng QR động: self check-in/out, QR board, bảng công, ngoại lệ và sudden absence.
- Nối attendance với booking availability, scheduler warning và affected-booking resolution.
- Bổ sung RBAC, migration, audit, unit tests và responsive QA.

## 2. Out of scope

- Không làm app mobile native, Flutter/React Native/APK.
- Không làm commission/hoa hồng, payroll hoặc tính lương đầy đủ.
- Không tích hợp máy chấm công, selfie/face recognition.
- Không claim email/SMS/push production; chưa có provider production tương ứng.
- Không rebuild toàn bộ frontend hoặc đổi design system.
- Không tạo mock data và không reset database.

## 3. Files audited

Backend đã audit Prisma schema/migrations, admin settings/controller, permission catalog/guards/policy, booking/change request/cancellation, business onboarding, branch approval/readiness, trust snapshot, review/report/moderation, staff schedules/leaves/special days, notifications/scheduler, audit utility và các spec hiện có.

Frontend đã audit Admin Settings, Violations, Compliance, Business Onboarding, Salon Profile, staff/schedule, appointment scheduler, booking/customer review, App routes, AppShell navigation, auth permission helper và component UI dùng chung.

## 4. Backend files changed

- `prisma/schema.prisma`
- `prisma/migrations/20260717_platform_trust_onboarding_attendance/migration.sql`
- `src/app.module.ts`
- `src/platform-settings/platform-settings.{module,controller,service}.ts`
- `src/platform-settings/platform-settings.service.spec.ts`
- `src/admin/admin.controller.ts`
- `src/admin/dto/platform-settings.dto.ts`
- `src/admin/trust-snapshot.service.ts`
- `src/business/business.controller.ts`
- `src/business/business-onboarding.service.ts`
- `src/business/business-onboarding.service.spec.ts`
- `src/branches/branches.controller.ts`
- `src/branches/branches.service.ts`
- `src/bookings/bookings.service.ts`
- `src/bookings/change-requests.service.ts`
- `src/common/permissions/permission-catalog.ts`
- `src/common/utils/policy.ts`
- `src/reviews/reviews.controller.ts`
- `src/reviews/reviews.service.ts`
- `src/reviews/reviews.service.spec.ts`
- `src/scheduler/policy-notification.cron.ts`
- `src/scheduler/scheduler.module.ts`
- `src/attendance/attendance.{module,controller,service}.ts`
- `src/attendance/attendance.service.spec.ts`

## 5. Frontend files changed

- `src/api/apiClient.js`
- `src/App.jsx`
- `src/components/layout/AppShell.jsx`
- `src/components/ui/index.jsx`
- `src/pages/Admin/AdminSettings.jsx`
- `src/pages/Admin/AdminViolations.jsx`
- `src/pages/Admin/AdminCompliance.jsx`
- `src/pages/Salon/BusinessOnboarding.jsx`
- `src/pages/Salon/SalonAttendance.jsx`
- `src/pages/Salon/SalonProfile.jsx`
- `src/pages/Customer/CustomerAppointments.jsx`
- `src/components/customer/ReviewModal.jsx`
- `src/components/admin/scheduler/SchedulerView.jsx`
- `src/utils/bookingCalendar.adapter.js`
- `package.json`, `package-lock.json` (`qrcode` để render QR local)

## 6. Database/schema changes

Thêm:

- `TrustAction`, `BusinessReviewEvent`, `ReviewReport`.
- `StaffAttendance`, `AttendanceExceptionRequest`.
- Enum trust action, attendance method/status/exception type/status.
- `Review.isAnonymous`.
- Business booking restriction fields.
- Branch review note/reviewed timestamp.
- `REVIEW_REMINDER` notification type.

Migration đã áp thành công. Lần deploy đầu phát hiện ID thực tế của project là PostgreSQL `TEXT`, không phải `UUID`; migration được sửa đúng kiểu và làm idempotent cho enum/column. Hai lần lỗi được Prisma đánh dấu rollback, lần thứ ba hoàn tất. Không reset volume. Số liệu trước/sau vẫn là 5 business, 11 branch, 4.000 booking.

## 7. Permission changes

Thêm permission Trust manage và bộ attendance:

- QR board.
- self read/check-in/check-out.
- branch/tenant read.
- branch/tenant adjust.
- approve exception.
- mark/restore absent.

Role mapping:

- STAFF: self attendance.
- RECEPTIONIST: self attendance + QR board; không có adjust/board management mặc định.
- BRANCH_MANAGER: self + QR + branch read/adjust/approve/absence.
- BUSINESS_OWNER: QR + tenant read/adjust/approve/absence.
- PLATFORM_ADMIN/COMPLIANCE: Trust snapshot/action theo catalog.

Seed permission idempotent đã chạy: 121 permission, 11 role, 202 role-permission upsert. Unknown permission vẫn fail-closed và test contract vẫn pass.

## 8. Platform settings enforcement

Canonical policy có configured/default/effective view và reset-default có audit. Backend validate integer/boolean theo giới hạn yêu cầu.

- Booking: max advance, min lead time, free-cancellation policy, pending hold.
- Reschedule: enable/disable và số lần tối đa.
- Review: min length, anonymous enable, report threshold auto-hide.
- Onboarding: auto approve, phone verification field, required ID documents.
- Branch: max branch count.
- Trust: violation suspend threshold.
- Attendance: early window, late grace, absent threshold, early/overtime grace, QR TTL 30–60 giây.

Admin UI hiển thị rõ giá trị chưa cấu hình và default đang dùng; không còn commission.

## 9. Notification setting limitations

In-process scheduler mỗi 5 phút tạo internal appointment reminder và review reminder theo policy. Nó cũng đánh dấu missing checkout cho ngày trước.

UI ghi rõ SMTP/SMS/push provider chưa cấu hình. Chưa có gửi production qua email/SMS/push. Scheduler hiện chưa có distributed lock; khi scale nhiều API replica cần chuyển sang queue/cron có leader lock để tránh tạo trùng trong race window.

## 10. Trust & Safety changes

- Summary 90 ngày, last computed, total, WARN, DANGER, monitored.
- Manual “Tạo snapshot ngay”, audit actor.
- Drill-down cancellation, late cancel, confirmation time và reason.
- Customer no-show không trực tiếp bị tính như lỗi salon.
- Action: warning, explanation, monitoring, booking restriction, suspension, restore, internal note.
- Target có thể là toàn business hoặc một branch cụ thể.
- Reason bắt buộc, lưu before/after, actor, note, timestamp và audit.
- Notification nội bộ gửi cho salon member ở các action phù hợp.
- Browser QA đã tạo thành công 5 snapshot thật; không có WARN/DANGER trên dữ liệu hiện tại.

## 11. Onboarding changes

- Không còn raw JSON document field.
- Document metadata rows: type/name/url/note, add/remove, URL validation.
- Status timeline DRAFT/PENDING_REVIEW/NEED_MORE_INFO/APPROVED/REJECTED.
- Review events giữ lịch sử submit/resubmit/approve/request info/reject.
- Request-info/reject bắt reason; owner thấy reason, actor hợp lệ và thời gian.
- NEED_MORE_INFO sửa cùng hồ sơ và resubmit, không tạo bản trùng.
- Compliance queue hiển thị nhiều status, tài liệu, owner, branch count và branch request-info/reject.

## 12. Branch readiness changes

Public/bookable chỉ khi business approved/active, không restricted; branch active; có service active; có staff active với working hours. Public list/detail và booking service đều enforce backend.

Salon Profile hiển thị rõ “Chi nhánh chưa sẵn sàng nhận lịch” cùng reason hoặc success state khi đủ điều kiện. Checklist onboarding dùng count dữ liệu thật.

## 13. Attendance QR changes

- Signed HMAC token gồm businessId, branchId, issuedAt, expiresAt, nonce, purpose.
- TTL policy 30–60 giây, mặc định 45 giây.
- Reject signature sai, token hết hạn, purpose sai, business/branch sai.
- Check-in kiểm tra profile ACTIVE, đúng branch, có ca, time window, chưa check-in/absent.
- Check-out kiểm tra đã check-in/chưa check-out.
- Tính late/early/overtime và hỗ trợ ca qua ngày.
- Missing checkout được đưa vào trạng thái cần xử lý.

## 14. QR board role behavior

Route `/salon/attendance/qr-board` hiển thị QR lớn, countdown, auto refresh, branch selector, connection state và fullscreen. QR chứa URL vào `/salon/attendance/my?token=...`.

Browser QA xác nhận Receptionist thấy QR board và self attendance, nhưng không thấy Bảng công và truy cập trực tiếp `/salon/attendance` bị route guard đưa về workspace được phép.

## 15. Exception check-in/check-out workflow

STAFF/RECEPTIONIST/BRANCH_MANAGER có thể gửi request CHECK_IN/CHECK_OUT/ADJUST_TIME cho chính mình với ngày, giờ đề xuất, reason, note. Manager/Owner approve/reject với reason; approve cập nhật attendance bằng `MANUAL_EXCEPTION`. Người gửi không được tự duyệt request của mình. Tất cả được audit.

## 16. Sudden absence workflow

Manager/Owner mark absent có reason, actor/time và audit; có thể restore nếu đánh nhầm. Hệ thống trả danh sách affected bookings trong ngày. UI hiển thị số lịch, khách, giờ, dịch vụ và action xử lý.

## 17. Booking integration with absence

- Staff ABSENT bị loại khỏi available slot, auto assignment, manual assign và move booking trong ngày.
- Scheduler cảnh báo absent, late, missing checkout và trường hợp có booking hôm nay nhưng chưa check-in; không tự hủy booking.
- Affected booking hỗ trợ reassign, reschedule hoặc cancel.
- Reassign/move dùng lại booking validation: đúng branch, ACTIVE, schedule, skill/service, overlap và absent check.
- Cancel message nêu rõ nhân viên phụ trách vắng đột xuất.

## 18. Audit log coverage

Đã audit settings update/reset; trust rebuild/actions; onboarding submit/resubmit/review; attendance check-in/out, adjustment, exception approval/rejection, mark/restore absent; reassign/reschedule/cancel do absence. Audit ghi actor, entity type/id, old/new, reason và timestamp theo schema audit hiện có.

## 19. Build result

- Backend `npm run build`: PASS.
- Frontend `npm run build`: PASS, 3.320 modules transformed.
- Docker API build: PASS; healthcheck healthy.
- Docker Web build: PASS; đang phục vụ tại `http://localhost:8080`.
- PostgreSQL/Redis: healthy; volume được giữ nguyên.

## 20. Test result

- Backend: 30 suite pass, 160 test pass.
- 1 suite/4 test được repository chủ động skip.
- Attendance tests bao phủ QR expired, wrong branch, no shift, valid QR check-in, checkout-before-checkin và ca qua ngày.
- Platform settings validation tests bao phủ giới hạn số và legacy alias.
- Frontend project chưa có script test; không claim frontend unit tests.
- Browser QA không có console error trên các workflow đã kiểm tra.
- Responsive kiểm tra 375/768/1024/1440 cho Settings, Trust, Compliance, Onboarding, Attendance My/Board/QR và Salon Profile; không còn horizontal overflow.

## 21. Known limitations

- Chưa có document upload pipeline; onboarding dùng metadata + URL thật.
- QR dùng signed stateless token; chưa có Redis revoke/replay registry. TTL/signature/branch check giảm rủi ro nhưng production nhiều quầy nên thêm Redis nonce consume/rate-limit.
- Cần cấu hình riêng `ATTENDANCE_QR_SECRET`; local hiện fallback về JWT secret.
- Mã dự phòng được sinh/hiển thị nhưng chưa có màn hình nhập mã; QR/deep-link là flow đã hoàn chỉnh.
- Không có native/in-app camera scanner; nhân viên dùng camera điện thoại quét QR để mở deep-link sau khi đăng nhập.
- Không có email/SMS/push provider production.
- Frontend dependency audit báo 1 moderate và 1 high; chưa chạy `npm audit fix --force` vì có thể gây breaking change.
- Không có payroll, multi-shift/shiftId chuyên sâu; model hiện dùng unique staff + branch + work date.

## 22. Suggested next steps

1. Thêm Redis nonce/replay protection và backup-code verification endpoint.
2. Cấu hình secret riêng, rate limit QR và test clock-skew/timezone production.
3. Chuyển reminder cron sang queue có distributed lock.
4. Xây upload pipeline private object storage + malware scan + signed URL.
5. Thêm frontend Vitest/Testing Library cho settings, onboarding, RBAC và attendance dialogs.
6. Xử lý dependency audit qua PR riêng có regression test.
7. Nếu cần nhiều ca/ngày, thêm Shift/shiftId trước khi nối attendance với payroll.
