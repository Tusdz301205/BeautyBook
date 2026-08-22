# Role-specific UX & Business Logic Consistency Audit

Ngày rà soát: 16/07/2026  
Phạm vi: Beauty Booking API, Web Portal, Customer/Public flow và cấu hình Docker hiện tại.

> Báo cáo này xác nhận các thay đổi và phép kiểm tra đã thực sự chạy. Nó không phải tuyên bố hệ thống đã sẵn sàng production ở mọi khía cạnh.

## 1. Source audit summary

Đã đọc và đối chiếu route, shell/navigation, auth store, permission helper, permission catalog, role mapping, guard/scope helper, Prisma enum, controller/service/DTO và test hiện có. Các điểm chính được phát hiện gồm: giao diện dùng chung chưa phân biệt đủ vai trò; Staff có permission branch quá rộng ở một số luồng; thống kê/audit của Branch Manager còn có thể lấy toàn doanh nghiệp; trạng thái nhân viên bị deactivate dễ biến mất; một số copy không phản ánh đúng trạng thái backend; luồng PENDING bị diễn đạt như đã xác nhận; và một số form thiếu validation/giải thích.

Không thêm mock data, không hard-code business/branch/staff/service và không tạo permission mới.

## 2. Roles audited

- Salon: `BUSINESS_OWNER`, `BRANCH_MANAGER`, `RECEPTIONIST`, `STAFF`.
- Platform: `PLATFORM_ADMIN`, `COMPLIANCE`, `SUPPORT`, `MARKETING`, `FINANCE`, legacy `ADMIN`.
- Customer/Public: `CUSTOMER` và khách vãng lai.

## 3. Routes audited

- Salon: `/salon`, `/salon/services`, `/salon/staff`, `/salon/appointments`, `/salon/payments`, `/salon/promotions`, `/salon/profile`, `/salon/stats`, `/salon/account`, `/salon/security`.
- Customer/Public: `/book/*`, `/booking-success`, `/customer/appointments`.
- Admin: `/admin`, `/admin/users`, `/admin/salons`, `/admin/compliance`, `/admin/appointments`, `/admin/payments`, `/admin/promotions`, `/admin/violations`, `/admin/profile`, `/admin/security`.
- Backend: bookings/change requests/scheduler, staff/schedule/service assignment, branches/businesses, services/public availability, payments/refunds, promotions/vouchers, users/self profile và admin/compliance.

## 4. Files changed

Backend chính:

- `src/bookings/bookings-access.service.ts`
- `src/bookings/bookings.controller.ts`
- `src/bookings/bookings.service.ts`
- `src/staff/staff.controller.ts`
- `src/staff/staff.service.ts`
- `src/branches/branches.controller.ts`
- `src/branches/dto/branch.dto.ts`
- `src/common/interceptors/audit.interceptor.ts`
- `src/users/users.service.ts`
- Các spec liên quan bookings access, staff và branches.

Frontend chính:

- `src/App.jsx`, `src/components/layout/AppShell.jsx`, `src/api/apiClient.js`
- `SalonAppointments.jsx`, `AdminAppointmentsView.jsx`, `SchedulerView.jsx`
- `SalonServices.jsx`, `SalonStaffManagement.jsx`, `SalonProfile.jsx`
- `PaymentsWorkspace.jsx`, `SalonPromotions.jsx`
- `BookingConfirm.jsx`, `BookingSuccess.jsx`, `CustomerAppointments.jsx`
- `AdminSalons.jsx`, `AdminCompliance.jsx`
- `SecuritySettings.jsx`, `ProfileSettings.jsx`

## 5. Backend changes

- Staff thuần chỉ được đọc/cập nhật booking đã assign cho chính user đó; không thể dùng permission branch để thao tác booking của đồng nghiệp.
- Staff thuần chỉ đọc hồ sơ, lịch làm, lịch ngoại lệ, dịch vụ và hoa hồng của chính mình.
- Walk-in/customer create được phân loại đúng actor; customer không thể giả mạo booking source.
- Branch Manager dùng danh sách branch được cấp cho thống kê và audit vi phạm, không còn tự mở rộng ra toàn business.
- Deactivate nhân viên đặt `INACTIVE`, giữ `deletedAt = null` để hồ sơ và booking cũ còn quản lý được.
- Gán service cho staff kiểm tra service active, chưa xóa và áp dụng đúng staff branch.
- `pendingHoldMinutes` được validate từ 5 đến 1440 phút.
- Từ chối chi nhánh bắt buộc có lý do; lý do nghiệp vụ được lưu trong audit log (giới hạn 500 ký tự).
- Self profile trả thêm liên kết `staffProfile` và branch khi có dữ liệu.

## 6. Frontend changes

- Shell, navigation, tiêu đề, mô tả và action được phân nhánh theo vai trò.
- Các action nhạy cảm dùng permission helper thực tế; phần backend tương ứng cũng kiểm tra scope/actor.
- Không thêm nút giả hoặc field backend chưa hỗ trợ.
- Trạng thái hiển thị được map từ enum backend thay vì so sánh label tiếng Việt.

## 7. Permission/scope changes

- Không tạo permission mới; dùng permission catalog hiện có.
- STAFF: own assigned booking/own staff resource.
- RECEPTIONIST: branch counter booking và payment khi permission cho phép.
- BRANCH_MANAGER: chỉ branch được cấp.
- BUSINESS_OWNER: các branch trong business được cấp.
- Platform auxiliary roles: chỉ landing/nav/action phù hợp permission chuyên trách.
- Test contract unknown-permission vẫn đạt; unknown permission bằng 0.

## 8. Services card changes

- Bỏ wording “toàn hệ thống” ở business scope; dùng “Đang hoạt động” và “Tạm ngưng cấp doanh nghiệp”.
- Thêm hover/shadow/translate nhẹ, icon gradient và border theo trạng thái.
- Hiển thị `Áp dụng X/Y chi nhánh`, progress bar/phần trăm, số active/paused/not-applied và danh sách branch từ API thật.
- Card chỉ giữ action Sửa/Chi tiết; action branch nằm trong view quản lý chi tiết.
- Public APIs hiện chỉ trả service active/available tại branch; không fake coverage.

## 9. Staff page changes

- “Lịch làm đặc biệt” có mô tả mục đích và action “Thêm lịch đặc biệt”.
- Form thêm nhân viên nói rõ chỉ tạo `StaffProfile`; tài khoản đăng nhập là luồng riêng.
- Detail cho biết hồ sơ đã/chưa liên kết tài khoản.
- `INACTIVE` hiển thị trung thực là “Tạm ngưng nhận lịch”; hồ sơ không biến mất khi xem tất cả.
- Assignment backend chặn service ngoài branch/inactive/not-applied.

## 10. Appointment role-specific changes

- Owner: “Lịch hẹn toàn doanh nghiệp”.
- Manager: “Lịch hẹn chi nhánh”, branch selector chỉ có scope được cấp.
- Receptionist: “Lịch hẹn tại quầy”, có tạo lịch tại quầy khi có permission.
- Staff: “Lịch của tôi”, không có tạo lịch tại quầy, khóa staff filter, không có list/stat toàn branch và vô hiệu drag/drop/reassign.
- Action Center đã được bỏ khỏi appointment navigation theo yêu cầu trước đó.
- Calendar tuần hiển thị từ 08:00; booking có accessible label đầy đủ thời gian, khách, service, staff, status.

## 11. Customer booking status copy changes

- `PENDING`: “Đã gửi yêu cầu đặt lịch”, nói rõ chưa xác nhận và thời gian giữ slot từ `pendingExpiresAt`.
- `CONFIRMED`: “Đặt lịch thành công”, nói rõ lịch đã xác nhận.
- Danh sách customer map đầy đủ PENDING/CONFIRMED/CHECKED_IN/IN_PROGRESS/COMPLETED/CANCELLED/REJECTED/EXPIRED/NO_SHOW.
- Change request hiển thị đang chờ/được chấp nhận/bị từ chối/hết hạn và không làm khách hiểu rằng booking đã đổi trước khi duyệt.
- Chặn gửi trùng yêu cầu đổi/hủy khi yêu cầu mới nhất còn pending; backend vẫn là nguồn quyết định policy.

## 12. Admin role-specific changes

- COMPLIANCE landing vào hàng chờ tuân thủ; MARKETING vào promotion; FINANCE vào payment; SUPPORT ưu tiên users/appointments theo permission.
- Nav platform được thu gọn theo vai trò; không đưa marketing/finance/compliance action sai workspace.
- AdminSalons dùng enum `ACTIVE`, `PENDING`, `SUSPENDED`, `REJECTED` rồi map label tiếng Việt.
- Từ chối business/branch yêu cầu lý do; branch rejection được backend enforce và audit.
- AdminUsers tiếp tục hiển thị role/scope thực tế; assign/remove chỉ hiện theo permission hiện có.

## 13. Payments changes

- Receptionist: copy tập trung thu tiền tại quầy/branch.
- Branch Manager: copy và dữ liệu theo branch.
- Business Owner: copy tài chính doanh nghiệp và branch filter khi có.
- Finance/Platform: tập trung giao dịch, refund, reconciliation và audit status theo permission.
- Backend hiện chỉ thu tiền theo booking UUID; UI giải thích rõ hạn chế thay vì giả search theo code/tên/số điện thoại.

## 14. Promotions changes

- Platform Admin/Marketing: “Chiến dịch & voucher nền tảng”.
- Business Owner: “Khuyến mãi của doanh nghiệp”.
- Branch Manager: “Khuyến mãi chi nhánh”.
- Chỉ hiển thị scope/field backend hiện hỗ trợ; không thêm targeting/stackable giả.

## 15. Salon profile/settings changes

- Owner thấy copy business profile, branch list và setting theo branch.
- Manager chỉ thấy branch được cấp; onboarding được bỏ khỏi manager nav.
- Receptionist/Staff không thấy profile quản trị mặc định.
- Confirmation mode và staff assignment mode có giải thích rõ tác động nghiệp vụ.
- Pending hold có đơn vị phút, min/max client và server là 5–1440.

## 16. Security/profile changes

- Đổi mật khẩu có “Xác nhận mật khẩu mới”; mismatch hiển thị lỗi, disable submit và không gọi API.
- Danh sách session/revoke được giữ nguyên.
- Profile user có branch, vị trí, staff status và link “Lịch của tôi” nếu backend có staff linkage; không tạo dữ liệu giả.

## 17. Build result

- Backend: `npm.cmd run build` — PASS.
- Frontend: `npm.cmd run build` — PASS, Vite transform 3.243 modules.
- Docker: `docker compose up -d --build` — PASS; PostgreSQL/Redis giữ nguyên volume, API healthy, web started.

## 18. Test result

- Backend full Jest: 28 suite pass, 1 suite PostgreSQL integration skip theo cấu hình mặc định; 146 test pass, 4 skip, 150 tổng.
- PostgreSQL integration đã chạy riêng trong container trước lượt chốt: 4/4 pass (overlap ngày, concurrent collection, concurrent slot/staff, refund oversell guard).
- Manual browser trên Docker đã xác minh Owner, Branch Manager, Receptionist, Staff và Compliance: landing, nav, title, branch scope, walk-in visibility, calendar tuần, service coverage và security confirm password.
- Frontend project hiện không có script/test runner tự động; không tuyên bố có frontend unit test.
- Warning WebSocket thiếu token trong scheduler spec là case bị từ chối có chủ đích, không phải test failure.
- Đã kiểm tra bố cục desktop bằng browser tích hợp. Ma trận visual 375/768/1024/1440 chưa chạy đủ vì quyền điều khiển/resize cửa sổ Cốc Cốc bị hệ thống từ chối; không tuyên bố đã có visual regression đầy đủ ở bốn breakpoint.

## 19. Known limitations

- Staff lifecycle trong Prisma hiện chỉ có `ACTIVE`, `ON_LEAVE`, `INACTIVE`; chưa tách `SUSPENDED`, `PAUSED`, `TERMINATED`. UI dùng copy trung thực “Tạm ngưng nhận lịch”.
- Payment counter API vẫn lấy booking UUID, chưa có search wrapper theo booking code/tên/điện thoại.
- Promotion targeting/usage/stacking chỉ giới hạn ở field backend hiện có.
- Maker-checker refund chưa được bổ sung trong scope này.
- Audit reason được lưu chung trong `AuditLog.reason`; chưa có bảng decision-note riêng.
- Package `pg` phát cảnh báo deprecation khi chạy integration với Prisma adapter; test vẫn pass nhưng nên nâng theo migration guide riêng.
- Chưa có frontend automated test infrastructure; manual browser không thay thế visual regression/E2E matrix đầy đủ.
- Chưa hoàn tất kiểm tra trực quan đủ bốn viewport 375/768/1024/1440 do quyền resize cửa sổ desktop không được cấp; CSS responsive đã build thành công nhưng cần một lượt QA thiết bị riêng.

## 20. Deferred items

Theo đúng out-of-scope, không triển khai:

- Email invitation / SMTP production.
- Notification/email/push production.
- Media upload/image workflow.
- Deep review/report analytics.
- Booking search nâng cao cho counter payment.
- Promotion targeting nâng cao và maker-checker refund.
- Tách sâu staff lifecycle enum và migration dữ liệu tương ứng.
