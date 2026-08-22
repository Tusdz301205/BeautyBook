# BeautyBook — Full Product Redesign Report

Ngày kiểm tra cuối: 21/07/2026  
Phạm vi: Public, Auth, Customer, Salon/Business, Staff/Receptionist, Platform Admin, API liên quan đến đăng ký và guest booking.

## 1. Kết luận điều hành

Đợt này hoàn tất lớp nền thiết kế chung và các luồng chuyển đổi quan trọng nhất trên source thật: public discovery, trang chi tiết, authentication, customer registration, guest booking, Customer Portal, lịch vận hành Salon và Platform Admin thống nhất. Business logic hiện có không bị thay thế; các thay đổi backend mới đều đi qua DTO validation và service nghiệp vụ đang dùng.

Không claim “production-ready tuyệt đối”. Build và toàn bộ unit/integration test hiện có đều pass, nhưng các thao tác tạo booking thật, duyệt hồ sơ, hoàn tiền, đình chỉ doanh nghiệp và gửi notification ngoài hệ thống không được thực thi trong browser QA vì sẽ làm thay đổi database production-like.

## 2. Source và tài liệu đã audit

- Root: `design.md`, `.hallmark/log.json`, `docker-compose.yml`, các báo cáo RBAC/scope/security/onboarding/attendance trước đó trong `docs/`.
- Frontend: `src/App.jsx`, route guards, auth store, API client, shared UI, public/auth/booking/customer/salon/admin pages, AppShell, scheduler, notification center, responsive CSS và media config.
- Backend: auth controller/service/DTO, bookings controller/service/access/DTO, permissions/scopes, Prisma schema/config, seed accounts và test suites.
- Hallmark: `SKILL.md`, README, recipes, study protocol/examples, typography, color, layout, responsive, interaction, motion, microinteraction, copy và anti-pattern guidance.
- UI-UX-Pro-Max: `SKILL.md`, README, generator workflow và comparison/reference docs. Kết quả generator được dùng cho form semantics, loading/disabled states, route lazy loading, responsive và accessibility; palette lavender gợi ý không được dùng vì xung đột với `design.md` đã khóa.

## 3. Design direction đã khóa

| Phạm vi | Hallmark macrostructure | Mục tiêu |
|---|---|---|
| Homepage / Explore | Marquee | Editorial discovery, search-first, một primary CTA |
| Salon/service/staff detail | Long Document | Nội dung thật theo chương, CTA booking luôn rõ |
| Login/Register/Auth action | Split Diptych | Form tập trung, có project-owned media slot |
| Customer/Salon/Admin | Workbench | Điều hướng theo quyền, work surface dày nhưng bình tĩnh |

Typography dùng Fraunces cho editorial display, Be Vietnam Pro cho UI và IBM Plex Mono cho mã/dữ liệu tabular. Canvas oat ấm, ink gần đen pha berry, accent berry chỉ dùng cho primary action/active/focus. Không dùng gradient trang trí, glassmorphism, ảnh mạng hoặc card-grid vô nghĩa.

## 4. Route matrix

### Đã implement/redesign và browser-verify

- Public: `/`, `/explore`, `/explore/branches/:id`, route 404.
- Auth: `/login`, `/register`.
- Booking: `/book`, `/book/staff`, `/book/time`, `/book/info` với dữ liệu branch/service/staff/availability thật.
- Customer: `/customer/appointments`, bao gồm empty state có CTA `/book`.
- Salon owner: `/salon`, `/salon/appointments`.
- Platform Admin: `/admin`, `/admin/compliance`, `/admin/violations`.

### Đã audit source, giữ contract và production-build verify

- Public: `/explore/services/:id`, `/explore/staff/:id`.
- Auth: `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-invitation`.
- Customer: `/customer/privacy`, `/customer/profile`, `/customer/security`.
- Salon: services, combos, staff, promotions, reviews, reports, notifications, profile, onboarding, payments, attendance, QR board, account và security.
- Admin: salons/businesses, users, appointments, payments/refunds, campaigns, reports, reviews, notifications, settings, profile và security.

Các route được lazy-load. Route chưa biết dùng trang 404 public; route con protected dùng fallback an toàn trong workspace tương ứng.

## 5. Thành phần mới/nâng cấp chính

- Public chrome, homepage media slots và media config tập trung.
- Editorial homepage, Explore và Long Document detail dùng dữ liệu API thật.
- Split Diptych `AuthShell`, login/register/auth-action pages và public 404.
- Registration form có label, inline error, focus first invalid, show/hide password, consent và loading/disabled state; không còn demo role/demo account.
- Guest checkout chỉ yêu cầu họ tên + điện thoại; tạo tài khoản là tùy chọn inline.
- Generic `Field` gắn `aria-required`, `aria-invalid`, hint/error relationship.
- Customer empty state dẫn tới booking flow thật.
- Scheduler giữ calendar grid khi rỗng, hỗ trợ deep-link `bookingId`, hiển thị đầy đủ thời gian/khách/dịch vụ/nhân viên/trạng thái và giữ mốc 08:00 không bị che.
- Notification center chỉ cho phép action URL nội bộ an toàn và fallback tới entity thật.

## 6. API tái sử dụng

Frontend tiếp tục dùng các API client hiện có cho:

- public branches, service categories, branch/service/staff detail, reviews;
- service/staff availability và booking preview;
- customer appointments, recurring plans, change requests, reviews, profile/privacy/security;
- salon scheduler, branch scope, services, staff, attendance, payments, reports và notifications;
- platform businesses/branches, users, appointments, finance, campaigns, reviews, trust snapshots/actions, compliance và settings.

Không có KPI public hoặc dashboard mới bị hard-code. Nội dung không có endpoint tương ứng được thể hiện dưới dạng empty/media slot rõ ràng.

## 7. Backend thay đổi

### Customer registration

- Public registration luôn tạo role `CUSTOMER`; client không thể tự gửi role đặc quyền.
- Email/name/phone được trim/normalize; password có policy và giới hạn độ dài.
- Kiểm tra trùng phone/email và chuyển Prisma `P2002` thành lỗi nghiệp vụ rõ ràng.
- User, role và customer profile được tạo trong transaction.

### Guest booking

- Thêm `POST /bookings/guest`, `@Public`, rate limit 8 request/phút.
- `CreateGuestBookingDto` chỉ nhận branch/service/combo/date/note/staff + guest name/phone; không nhận `customerId`, `createdBy`, voucher hoặc source do client tự gán.
- Phone được chuẩn hóa về `+84`; guest identity bị vô hiệu hóa đăng nhập.
- Booking cuối vẫn gọi `BookingsService.create`, nên giữ chung kiểm tra branch/service/staff, availability, conflict/double-booking, giá và state machine.
- Không có Prisma migration hoặc thay đổi schema trong đợt này.

## 8. Role, permission và scope

- Frontend giữ `ProtectedRoute` + `PermissionGate`; backend vẫn là nguồn quyết định cuối cùng.
- Browser QA xác nhận Customer chỉ thấy appointments/privacy/profile/security, không thấy Business/Admin menu.
- Business Owner thấy tenant workspace và chọn được tất cả hoặc từng branch trong scheduler.
- Staff/Receptionist/Manager dùng chung Salon Portal nhưng menu được lọc theo permission thay vì nhận menu Owner đầy đủ.
- Platform Admin là một portal thống nhất; compliance, support, marketing, finance là workspace theo permission, không tạo portal riêng.
- Không hard-code businessId/branchId/userId trong UI mới.

## 9. Calendar, walk-in và notification

- Salon appointment vẫn là scheduler Day/Week/Month; List và Stats chỉ là tab phụ.
- Tab Action Center cũ đã được loại khỏi appointment navigation.
- Week grid hiển thị từ 08:00, có khoảng đệm đầu, auto-scroll theo booking/current time và title/aria-label đầy đủ.
- Ở phạm vi tất cả chi nhánh, Owner vẫn xem được calendar tổng hợp; list/stats yêu cầu branch khi endpoint không hỗ trợ aggregation.
- Walk-in dialog và action vẫn nối API availability thật; không tự ghi đè conflict.
- Notification contextual click mở action URL nội bộ hoặc route booking tương ứng với `bookingId`.

Browser QA không submit walk-in hoặc thay đổi booking status để tránh tạo audit event ngoài ý muốn.

## 10. Responsive và accessibility

- Scheduler được đo ở 320, 375, 390, 768, 1024, 1280 và 1440 CSS px: document `scrollWidth === clientWidth` tại cả bảy breakpoint; calendar vẫn tồn tại và phần rộng được giữ trong work surface có scroll chủ đích.
- Homepage, branch detail, register, guest booking và Customer Portal được kiểm tra ở 320 px; không có document-level horizontal overflow.
- Mobile dùng menu drawer; touch target chính tối thiểu 44 px.
- Form có visible label, required semantics, inline error, focus-visible và accessible password toggle.
- Dialog shared component trap focus, Escape/backdrop/close và restore focus.
- Scheduler events có accessible name chứa thời gian, khách, dịch vụ, nhân viên và trạng thái.
- Browser console của tab QA sạch: 0 warning, 0 error.

## 11. Build và test

| Kiểm tra | Kết quả |
|---|---|
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass — Prisma Client 7.8.0 |
| Backend `npm run build` | Pass |
| Frontend `npm run build` | Pass — Vite 5.4.21, 3.328 modules |
| Targeted auth/guest tests | Pass — 4 suites, 10 tests |
| Full backend Jest | Pass — 34 suites, 170 tests; 1 suite/4 tests pre-skipped |
| Docker | API/PostgreSQL/Redis healthy; Web running tại `http://localhost:8080` |

Frontend package hiện không có script lint hoặc unit-test riêng; vì vậy không claim lint/test frontend. Production build và browser QA là bằng chứng frontend trong đợt này.

## 12. Files đã sửa trong đợt full redesign

### Root/design/report

- `design.md`
- `.hallmark/log.json`
- `docs/FULL_PRODUCT_REDESIGN_REPORT.md`

### Frontend

- `src/App.jsx`
- `src/api/apiClient.js`
- `src/config/homeMedia.js`
- `src/components/public/HomeMedia.jsx`
- `src/components/public/PublicChrome.jsx`
- `src/components/public/AuthShell.jsx`
- `src/components/ui/index.jsx`
- `src/components/notifications/NotificationCenter.jsx`
- `src/components/admin/scheduler/SchedulerView.jsx`
- `src/components/admin/scheduler/SchedulerSidebar.jsx`
- `src/pages/Public/PublicHome.jsx`
- `src/pages/Public/PublicDetails.jsx`
- `src/pages/Public/PublicNotFound.jsx`
- `src/pages/Login/LoginScreen.jsx`
- `src/pages/Login/RegisterScreen.jsx`
- `src/pages/Login/AuthActionPages.jsx`
- `src/pages/Booking/BookingStep3.jsx`
- `src/pages/Booking/BookingStep4.jsx`
- `src/pages/Booking/BookingConfirm.jsx`
- `src/pages/Booking/BookingSuccess.jsx`
- `src/pages/Customer/CustomerAppointments.jsx`
- `src/pages/Salon/SalonServices.jsx`
- `src/styles/public-home.css`

### Backend

- `src/auth/dto/auth.dto.ts`
- `src/auth/auth.service.ts`
- `src/auth/dto/auth.dto.spec.ts`
- `src/auth/auth.service.spec.ts`
- `src/bookings/dto/bookings.dto.ts`
- `src/bookings/bookings.controller.ts`
- `src/bookings/dto/bookings.dto.spec.ts`
- `src/bookings/bookings.controller.spec.ts`

## 13. Known limitations

1. Browser QA đi tới guest contact/account-option step và availability thật nhưng không nhấn xác nhận tạo booking, để không làm bẩn database production-like. DTO/controller/service contract đã có test; cần một môi trường disposable để chạy E2E tạo rồi rollback booking.
2. Không thực thi approve/reject/refund/suspend/restore/attendance mutation trong browser QA; các màn hình, quyền và dữ liệu đọc đã được kiểm tra.
3. Seed hiện có hồ sơ compliance với `0 giấy tờ`, nên document viewer không có tài liệu thật để visual-QA.
4. Email/SMS/push phụ thuộc provider và cấu hình triển khai; UI không giả trạng thái provider chưa được cấu hình.
5. Public media slots cố ý để trống khi backend không có asset do project sở hữu, đúng yêu cầu không lấy ảnh mạng.
6. Chunk biểu đồ dùng Recharts khoảng 411 kB trước gzip; đã tách lazy chunk nhưng vẫn là mục tiêu tối ưu tiếp theo nếu báo cáo trở thành đường tải thường xuyên.

## 14. Next steps đề xuất

1. Thêm môi trường E2E disposable hoặc transaction rollback cho registration, guest booking, reschedule, walk-in và payment/refund.
2. Thêm frontend test runner + accessibility CI cho route matrix theo role.
3. Upload bộ ảnh project-owned vào media slots và kiểm tra crop/alt text trên từng breakpoint.
4. Bổ sung compliance fixture có tài liệu thật để test viewer, timeline và resubmit end-to-end.
5. Theo dõi bundle budget cho chart/scheduler và thiết lập performance gate trong CI.
