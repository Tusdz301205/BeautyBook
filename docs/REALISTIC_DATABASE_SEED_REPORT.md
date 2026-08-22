# Realistic Database & Seed Report

Ngày kiểm chứng: 2026-07-17  
Phạm vi dữ liệu: 2024-01-01 đến ngày chạy seed, kèm lịch tương lai 60 ngày  
Mục đích: dữ liệu production-like phục vụ demo và thử vận hành; không phải dữ liệu production thật.

## 1. Schema audit summary

Schema hiện có 50+ model và đã bao phủ các miền chính: users/RBAC, business/branch, onboarding review history, business service catalog, staff schedule/leave, attendance/exception, booking/change request/history, payment/refund, promotion/voucher, review/report, notification, audit, platform settings, trust actions/snapshot, consent và health records.

Các quan hệ cascade nguy hiểm chủ yếu nằm ở dữ liệu con khi xóa user/business/branch. Seed sử dụng reset có thứ tự quan hệ rõ ràng; không dùng lệnh xóa Docker volume và không hard-code dữ liệu vào business logic.

## 2. Model/field và migration

Không thêm model, field hay migration mới trong hạng mục này. Migration `20260717_platform_trust_onboarding_attendance` đã có sẵn và cung cấp PlatformSetting, onboarding history, trust actions, StaffAttendance và AttendanceExceptionRequest. Giữ nguyên schema tránh phá API/frontend hiện tại.

## 3. Seed modes

- `npm run db:seed:small`: 3 business, 120 customer, khoảng 600 booking; dùng kiểm tra nhanh.
- `npm run db:seed:demo`: 8 business, 600 customer, khoảng 4.000 booking; dùng demo thông thường.
- `npm run db:seed:realistic`: 12 business, 1.500 customer, khoảng 10.000 booking và lịch sử attendance lớn.
- `npm run db:validate-seed`: kiểm tra bất biến dữ liệu sau seed.

Có thể đặt `SEED_END_DATE=YYYY-MM-DD`. Nếu không đặt, seed lấy ngày chạy thực tế. Random generator có seed cố định để cấu trúc dữ liệu có thể tái hiện; UUID vẫn thay đổi giữa các lần reset.

Seed là reset flow có chủ đích: xóa dữ liệu demo theo đúng thứ tự foreign key rồi tạo lại. Chạy lại không tạo bản ghi trùng không kiểm soát. Docker volume PostgreSQL không bị xóa.

## 4. Data volume đã chạy (realistic)

| Nhóm | Số lượng |
|---|---:|
| Users | 1.758 |
| Businesses | 12 |
| Branches | 44 |
| Staff profiles | 237 |
| Customers | 1.500 |
| Branch services | 496 |
| Bookings | 9.896 |
| Payments | 9.896 |
| Refund requests | 467 |
| Reviews | 4.226 |
| Attendance | 148.599 |
| Attendance exceptions | 200 |
| Notifications | 6.000 sau khi scheduler chạy (5.500 do seed tạo trực tiếp) |
| Audit logs | 20.000 |
| Trust snapshots | 12 |
| Trust actions | 54 |
| Onboarding events | 12 |

## 5. Demo accounts

Mật khẩu chung: `Password123!`

| Vai trò | Email |
|---|---|
| Platform Admin | admin@glowbook.vn |
| Compliance | compliance@glowbook.vn |
| Support | support@glowbook.vn |
| Marketing | marketing@glowbook.vn |
| Finance | finance@glowbook.vn |
| Business Owner | lananh.owner@glowbook.vn |
| Branch Manager | manager@glowbook.vn |
| Receptionist | reception@glowbook.vn |
| Staff | staff@glowbook.vn |
| Customer | khach0001@glowbook.vn |

Realistic mode tạo thêm user thứ hai cho Compliance, Support, Marketing và Finance với hậu tố `2` trong email.

## 6. Demo scenarios

- Admin có dữ liệu overview, user, booking, payment, review, attendance, onboarding và trust/risk.
- Compliance có business PENDING_REVIEW, NEED_MORE_INFO, REJECTED, ACTIVE/SUSPENDED và lịch sử review reason.
- Owner có nhiều branch, staff, service, booking, payment và attendance.
- Manager/Receptionist/Staff có dữ liệu chấm công hôm nay gồm checked-in, late, absent, not checked-in, missing checkout hôm qua và exception pending.
- Customer có booking quá khứ, hôm nay, tương lai 60 ngày, cancelled/no-show/completed, payment, review và notification.
- Có 244 quan hệ ngày-vắng/booking lịch sử để trình diễn kiểm tra ảnh hưởng; việc giao lại chi tiết được thể hiện hạn chế qua booking history/audit do schema chưa lưu old/new staff.

## 7. Booking data strategy

Dữ liệu tăng trưởng theo năm: 2024 thấp hơn, 2025 tăng, 2026 và tương lai có trọng số cao hơn. Booking có đủ nguồn ONLINE_WEB, WALK_IN, PHONE, STAFF_CREATED, ADMIN_CREATED và đủ lifecycle status. Slot được kiểm tra theo interval trước khi insert để không trùng cùng staff/ngày; staff chỉ nhận service đã được gán skill. Seed tạo booking hôm nay trước để calendar luôn có dữ liệu demo.

## 8. Attendance strategy

Attendance được tạo theo ngày làm việc, không tạo Chủ nhật. Realistic mode giữ tối đa 730 ngày gần ngày seed, gồm QR/manual exception/manual adjustment, late, left early, missing checkout, absent và trạng thái hôm nay. Insert theo batch 2.000 bản ghi. Có leave và 200 exception với PENDING/APPROVED/REJECTED.

## 9. Onboarding strategy

Business có profile vận hành tốt, mới/pending, need more info, rejected và suspended. Legal document metadata dùng URL demo, tax code, representative, submitted/reviewed timestamp và BusinessReviewEvent. Reason tiếng Việt rõ ràng.

## 10. Trust/risk strategy

Mỗi business có snapshot hiện tại. Profile OK/WARN/DANGER khác nhau về cancellation/no-show/reject time/trust score. TrustAction tạo lịch sử warning, explanation request, monitoring, restriction, suspension và note.

## 11. Payment, review, notification, audit

Payment/final amount tính sau voucher; refund không vượt payment. Review chỉ gắn booking COMPLETED, có rating 1–5, anonymous, report và hidden/pending moderation. Notification phân bổ cho customer và user vận hành. Audit dùng actor hợp lệ và phủ Business, Branch, Booking, User, Promotion, Payment, Refund, Review, Attendance, Trust và PlatformSetting.

## 12. Validation results

`npm run db:validate-seed` đã PASS với tất cả lỗi bằng 0:

- booking staff overlap;
- booking ngoài giờ branch;
- staff thiếu skill;
- review trên booking chưa completed;
- payment âm hoặc refund vượt payment;
- branch active thuộc business chưa duyệt;
- attendance sai business/branch scope;
- booking mới giao sau thời điểm đánh dấu absent;
- permission lạ hoặc catalog chưa seed.

Trong lần kiểm tra đầu, validation phát hiện booking vượt giờ đóng cửa; seed đã được sửa để giới hạn giờ bắt đầu muộn nhất và dữ liệu hiện tại được chuẩn hóa trước khi validation cuối PASS.

## 13. Build results

- `npx prisma validate`: PASS.
- Backend `npm run build`: PASS.
- Docker API image: build PASS, Prisma generate PASS, Nest build PASS.
- Frontend được kiểm tra bằng Docker build do Vite/esbuild bị sandbox Windows chặn khi chạy trực tiếp trên host.

## 14. Known limitations

- `BranchStatus` hiện chỉ có PENDING/ACTIVE/INACTIVE; rejected/suspended ở cấp branch được biểu diễn bằng INACTIVE + reviewNote, không thêm enum để tránh phá API.
- `SalonTrustSnapshot.businessId` là unique nên chỉ lưu snapshot hiện tại, chưa lưu monthly history. Lịch sử quyết định nằm trong TrustAction.
- Business document metadata hiện dùng `Business.legalDocuments` JSON theo API onboarding sẵn có; chưa có bảng BusinessDocument riêng.
- BookingStatusHistory chưa có old/new staff/time; AppointmentChangeRequest và AuditLog bù một phần nhưng chưa thay thế đầy đủ BookingHistory giàu dữ liệu.
- Chưa có StaffAbsenceIncident/StaffAbsenceAffectedBooking riêng; dùng StaffAttendance ABSENT, booking history, notification và audit.
- Email/SMS/push đều tắt vì project chưa cấu hình provider thật. Không seed commission và không giả lập OTP/provider.

## 15. Next steps

Khi cần nâng schema ở vòng sau, ưu tiên migration additive cho BusinessDocument, snapshot history theo kỳ, BookingHistory có old/new staff/time và StaffAbsenceAffectedBooking. Các field mới nên nullable/backfill để giữ dữ liệu lịch sử và tương thích API hiện tại.
