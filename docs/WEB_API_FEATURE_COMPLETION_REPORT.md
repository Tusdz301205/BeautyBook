# Web + API Feature Completion Report

Cập nhật: 16/07/2026

## 1. Scope đã làm

Hoàn thiện P0 đã có, bổ sung service lifecycle safety và triển khai các khoảng trống P1 khả thi: Admin appointment/salon filters, public discovery/detail và review riêng service/staff. Không làm mobile native.

## 2. Out of scope

Không rebuild frontend/design system/portal architecture; không tách Admin Portal; không fake data; không triển khai payment provider, push mobile, media upload production hoặc OpenAPI full production.

## 3. Routes audited

Salon routes, customer/public booking và appointments, Admin overview/salons/users/appointments/payments/promotions/reports/compliance/settings; backend auth/RBAC, business/branch, services, staff, bookings, reviews, payments, promotions, reports và admin.

## 4. Backend files changed

`bookings.controller.ts`, `bookings.service.ts`, `branches.controller.ts`, `branches.service.ts`, `services.service.ts`, `services.service.spec.ts`, `staff.controller.ts`, `staff.service.ts`, `reviews.controller.ts`, `reviews.service.ts` và các thay đổi P0 từ audit role-specific trước.

## 5. Frontend files changed

`App.jsx`, `apiClient.js`, `PublicHome.jsx`, `PublicDetails.jsx`, `AdminSalons.jsx`, `AdminAppointmentsView.jsx`, `SchedulerListView.jsx`, `ReviewModal.jsx` cùng các shell/pages role-specific từ lượt trước.

## 6. Database/schema changes

Không migration mới. Đã khai thác schema hiện có cho `ReviewServiceRating`, media relation, `Combo` và `RecurringBookingPlan` được audit nhưng chưa đưa vào flow production.

## 7. Permission changes

Không tạo permission mới. Staff-own guard, branch/business scope và platform role landing dùng catalog hiện có; unknown permission contract vẫn được test.

## 8. Role-specific UX changes

Owner/Manager/Receptionist/Staff và platform auxiliary roles có header, nav, title, action và scope khác nhau. Staff không còn workspace toàn branch; Admin Portal vẫn gộp.

## 9. Staff lifecycle changes

Deactivate giữ `deletedAt = null`, UI dùng “Tạm ngưng nhận lịch”; inactive/on-leave không xuất hiện trong public staff/assignable/availability; booking cũ giữ reference.

## 10. Booking changes

PENDING/CONFIRMED copy, pending queue, expiry, staff-own update, walk-in actor/source và Admin filters theo category/service/business/branch/customer/staff/source/date/status.

## 11. Service lifecycle changes

Public chỉ thấy ACTIVE service tại ACTIVE branch; direct create/slot validation giữ backend source of truth. Archive catalog hoặc soft-delete branch service bị chặn khi còn future PENDING/CONFIRMED/CHECKED_IN/IN_PROGRESS booking; pause vẫn dùng để ngừng nhận lịch mới mà giữ lịch sử.

## 12. Admin improvements

Role-specific landing/nav; appointments có filter và bảng dữ liệu chi tiết; salons lọc theo category, trả số service trong nhóm; status dùng enum backend; Compliance reject cần reason.

## 13. Customer web improvements

Discovery theo cơ sở/dịch vụ/category/khu vực/giá, sort rating/popular/price. Có detail branch/service/staff, album từ media thật hoặc empty state, booking CTA và review summary.

## 14. Review improvements

Schema/API vốn đã enforce booking COMPLETED, owner customer và unique booking. UI nay gửi overall rating cùng rating/comment riêng từng `BookingService` và staff thực hiện. Public có aggregate service/staff chỉ từ review APPROVED.

## 15. Combo/recurring status

Schema tồn tại nhưng thiếu service/controller/transaction/UI hoàn chỉnh. Deferred thay vì tạo hack hoặc nút chết. Cần thiết kế availability toàn chuỗi, atomic create, cancel one/all và combo staff eligibility trước khi production.

## 16. Payment/promotion/profile/security

Payment copy/action theo role, promotion wording/scope theo platform/business/branch, profile/settings theo role và pending hold 5–1440 phút; security có confirm password và chặn mismatch.

## 17. Build result

Backend Nest build PASS. Frontend Vite production build PASS (3.244 modules ở lượt build feature).

## 18. Test result

Backend full Jest: 28 suite pass, 1 PostgreSQL integration suite skip theo cấu hình mặc định; 148 test pass, 4 skip, 152 tổng. Hai test mới xác nhận không archive/soft-delete service khi còn booking tương lai. Frontend không có automated test runner nên không fake test; production build pass.

Manual browser smoke test PASS trên bản Docker cuối: public discovery, branch/service/staff detail, Platform Admin appointment list/filter và Admin salon category filter. Bảng danh sách Admin không còn render lặp trên desktop.

## 19. Remaining limitations

Xem `KNOWN_LIMITATIONS.md`: mobile native, media upload, provider payment, combo/recurring, staff enum chi tiết, counter search chuyên dụng, frontend E2E/visual QA.

## 20. Suggested next steps

1. Thiết kế/implement combo module và recurring transaction riêng.
2. Thêm media upload pipeline có validation/storage/CDN.
3. Thêm booking lookup endpoint cho quầy.
4. Bổ sung Playwright E2E, visual regression, load/security tests.
5. Tích hợp payment provider và reconciliation production.

Không claim mobile app hoặc production readiness tuyệt đối.
