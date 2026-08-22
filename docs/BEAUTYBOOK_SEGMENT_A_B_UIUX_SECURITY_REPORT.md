# BeautyBook — Segment A + B UI/UX & Security Report

Ngày hoàn tất lượt triển khai: 18/07/2026  
Phạm vi kiểm tra: React web, NestJS API, Prisma/PostgreSQL, Redis và Docker Compose.

## 1. Scope đã làm

- Xây dựng upload thật có kiểm tra nội dung tệp, metadata, quyền truy cập và vùng public/private.
- Hoàn thiện luồng cơ bản của combo booking và recurring booking từ schema/API tới web.
- Nâng cấp campaign/voucher, birthday voucher, notification, profile/security và staff management.
- Giữ salon appointments ở dạng calendar/scheduler; sửa auto-scroll và khả năng đọc booking card.
- Audit/rà soát RBAC, tenant scope, session, token rotation, validation, CORS, upload và vận hành Docker.
- Áp dụng hệ token/UI dùng chung và rà soát theo Hallmark + UI UX Pro Max.

## 2. Out of scope

Không làm mobile native, payroll đầy đủ, payment gateway/SMS/push provider thật, 2FA giả lập, hoặc thay calendar bằng list. Không seed/xóa dữ liệu hiện có trong quá trình deploy cuối.

## 3. Hallmark/UI UX Pro Max đã đọc và áp dụng

- `hallmark-main/skills/hallmark/SKILL.md`
- `hallmark-main/skills/hallmark/references/slop-test.md`
- `hallmark-main/skills/hallmark/references/contract.md`
- `ui-ux-pro-max-skill-main/ui-ux-pro-max-skill-main/.claude/skills/ui-ux-pro-max/SKILL.md`
- README và các truy vấn tham chiếu React/accessibility/interaction của UI UX Pro Max.

Ảnh hưởng chính: token màu/typography/shadow dùng chung, hierarchy rõ, focus-visible, dialog có focus trap/return focus, trạng thái loading/error/empty, action nguy hiểm có xác nhận, loại bỏ `transition-all`, z-index tùy tiện và các màu hard-code còn sót. Hallmark pre-emit critique được ghi trong `src/styles/tokens.css`.

## 4. Frontend files changed

Nhóm chính (không phải danh sách duy nhất):

- `src/api/apiClient.js`, `src/store/authStore.js`, `src/App.jsx`, `src/main.jsx`
- `src/styles/tokens.css`, `src/styles/theme.css`
- `src/components/ui/index.jsx`, `src/components/layout/AppShell.jsx`
- `src/components/media/FileUpload.jsx`, `src/components/notifications/NotificationCenter.jsx`
- `src/components/admin/scheduler/*`, `src/utils/bookingCalendar.*`
- Customer booking/appointments, `ProfileSettings.jsx`, `SecuritySettings.jsx`
- Salon appointments, notifications, services, combos, staff, promotions, profile và onboarding.
- Admin users/violations và các notification wrapper.

## 5. Backend files changed

Nhóm chính:

- `src/media/*`, `src/combos/*`, `src/recurring/*`
- `src/bookings/*`, `src/services/services.service.ts`, `src/staff/staff.service.ts`
- `src/auth/*`, `src/users/*`, `src/notifications/*`, `src/promotions/*`
- `src/common/guards/*`, `src/app.module.ts`, Dockerfile và compose/env mẫu.

## 6. Prisma/schema changes

- Bổ sung metadata/quan hệ media, combo, recurring, notification severity/action/read, voucher audience/auto issue và trường hồ sơ user/staff.
- `UserSession.refreshTokenHash` lưu hash refresh token thay vì token thô.
- Migration mới: `20260718_z_refresh_token_rotation`.
- Prisma `format`, `validate` và `generate` đều pass ở lượt cuối.

## 7. Upload implementation

- Endpoint multipart thật; không dùng URL nhập tay cho legal onboarding.
- Allowlist JPG/PNG/WebP/AVIF và PDF; kiểm MIME, extension, magic bytes và giới hạn 10 MB.
- Cấm executable/SVG/HTML/JS, tên lưu UUID, path traversal guard, kiểm owner/business/branch/entity.
- Legal document luôn private; content private đi qua authenticated endpoint. Delete có permission; legal upload/delete có audit; upload/delete có throttle.
- Web có preview, loading, replace, delete và lỗi validation cho avatar, legal documents, business logo, branch image, service image theo branch, staff portfolio và combo image.
- Chưa hoàn chỉnh gallery nhiều ảnh, review image và promotion banner vì schema hiện chưa có relation chuyên biệt; không báo giả là đã làm.

## 8. Combo booking implementation

- CRUD combo theo branch, status, thời hạn, giới hạn lượt dùng, included services, ảnh, giá combo, tổng giá gốc/tổng duration và usage count.
- Public/customer flow chọn combo; server kiểm branch, service active, thời hạn/max usage và staff có đủ skills.
- Booking bung combo thành booking items, lưu snapshot/giá combo, giữ slot cho toàn duration và chống overlap/double booking.
- Calendar/detail nhận biết combo và giữ lịch sử khi combo về sau hết hạn hoặc bị lưu trữ.
- Giới hạn: một staff cho cả combo; chưa có multi-staff, partial cancel/refund và gateway thật.

## 9. Recurring booking implementation

- API preview, create, list mine, pause/resume, cancel một occurrence và cancel toàn plan.
- Hỗ trợ weekly, biweekly, monthly/custom interval theo DTO; specific/same staff hoặc any staff.
- Preview kiểm availability từng occurrence, trả conflict reason/count; có chính sách bỏ qua conflict hoặc chặn tạo.
- Tạo booking thật chỉ sau confirm và dùng logic booking/slot hiện hữu.
- Giới hạn: chưa có UI reschedule toàn chuỗi/đổi riêng conflict; thanh toán vẫn từng booking.

## 10. Campaign/voucher improvements

- List/search/filter status/audience, form audience + auto issue, detail vận hành và usage data cơ bản.
- Có target audience `ALL`, `NEW_CUSTOMER`, `BIRTHDAY_MONTH`, `LOYAL`, `INACTIVE`, `CUSTOM_SEGMENT` theo phần schema/DTO áp dụng.
- Không claim đầy đủ scheduler cho loyal/win-back/off-peak; hiện tự động hóa thật tập trung birthday.

## 11. Birthday voucher logic

- Scheduler tìm customer có sinh nhật trong tháng, kiểm campaign birthday đang active/auto issue.
- Chỉ phát một voucher/customer/campaign/năm, tôn trọng tổng số lượng phát và hạn dùng.
- Tạo CustomerVoucher và notification có action metadata; đếm giới hạn theo số voucher đã phát, không dùng nhầm số đã redeem.

## 12. Notification improvements

- Model/API có severity, target type/id, action URL, metadata, readAt.
- Notification Center có All/Unread/Read/type filter, badge unread, mark one/all, detail drawer và điều hướng action.
- Shared center được dùng cho salon/admin; customer dùng cùng API/route khi được cấp.
- Socket.IO hiện hữu được giữ; hạ tầng nhiều replica vẫn cần adapter/queue dùng chung.

## 13. Staff/Receptionist portal improvements

- Profile có avatar, contact/personal fields, bio, experience và emergency contact; official role/branch/status/assignment vẫn readonly với staff.
- Owner/manager staff management có profile, portfolio, weekly schedule, breaks, leave, holidays, special days, services và lifecycle actions theo permission.
- Receptionist/staff chỉ thấy và sửa phạm vi được backend cấp; QR/attendance/action phụ thuộc permission hiện có.

## 14. Calendar auto-scroll logic

- Calendar vẫn là scheduler trung tâm.
- Khi mở ngày hiện tại, ưu tiên booking đầu tiên và chừa context trước booking; nếu không có booking thì dùng giờ hiện tại/đầu ca theo dữ liệu khả dụng.
- Sửa padding phần đầu để mốc 08:00 không bị header che; tăng vùng nội dung card tuần và tooltip/detail để chữ không bị mất hoàn toàn.
- Booking card vẫn mở detail drawer; Action Center tab đã được bỏ theo yêu cầu, list và thống kê theo branch/aggregate được giữ.

## 15. Dead card/list audit result

- Đã rà source các vùng appointment, notification, promotion, user, salon, violation, service, staff, payment/review/onboarding và shared card/table.
- Các luồng ưu tiên có drill-down hoặc action riêng: booking detail, notification detail/action, service detail, staff edit/schedule/service, promotion detail, user/salon/violation actions.
- `AdminViolations` bỏ nút “Tải lại” dư thừa cạnh “Tạo snapshot ngay”.
- Chưa khẳng định mọi hàng ở mọi trang có drill-down riêng: một số bảng báo cáo/summary vẫn là thông tin thuần và combo management dùng edit form làm màn chi tiết vận hành.

## 16. Profile/security improvements

- Profile: avatar thật, full name, phone, gender, birthday, address và staff fields; save validation/toast.
- Password: current/new/confirm, show-hide, strength, policy backend, không cho trùng password hiện tại.
- Session: current device, created/last active, revoke từng session và revoke all others; current session được bảo vệ.
- Security history: login success/fail, password/session/profile security events theo audit data.
- 2FA không được giả lập và được ghi là chưa triển khai.

## 17. Security A–Z audit summary

Chi tiết đầy đủ ở `docs/SECURITY_AUDIT_BEFORE_DEPLOY.md`. Các phần đã sửa gồm refresh rotation/replay protection, session revocation, password policy, RBAC/scope cho module mới, input validation, CORS/Helmet/body limit, upload isolation, throttling, booking transaction/overlap guard, server-controlled amount và audit sensitive actions.

Các blocker production còn lại: localStorage token/cookie-CSRF migration, object storage + malware scan, Redis distributed limiter/lock, gateway thật, backup restore drill, central monitoring, DAST/load test và 2FA privileged accounts.

## 18. RBAC/scope safety notes

- Module mới không dựa vào việc ẩn nút: controller dùng role/permission và service xác minh business/branch/entity ownership.
- Không hard-code businessId/branchId/userId trong flow; ID gửi lên được đối chiếu scope server.
- Private media không public bằng đường dẫn đoán được; legal docs bắt buộc cùng owner/business scope.
- Permission lạ tiếp tục bị từ chối theo permission contract hiện hữu.

## 19. Responsive check result

- Source dùng mobile-first breakpoints, table có scroll container, dialog/drawer có max width và `html/body` chặn overflow-x ngoài ý muốn.
- Live browser smoke ở viewport 375px trên services/calendar và desktop 1280px trên các route owner không phát hiện document overflow ngang hoặc alert. Primary CTA mẫu có contrast WCAG tính được 5.08:1; secondary control mẫu 17.62:1.
- Viewport override của công cụ không giữ đúng các giá trị 768/1024/1440 (trả về viewport mặc định 1280), nên **chưa có bằng chứng live đầy đủ** cho toàn bộ bốn kích thước bắt buộc. Cần chạy Playwright device matrix/thiết bị thật trước release; không ghi PASS giả.

## 20. Build result

- API: `npm run build` — PASS.
- Web: `npm run build` — PASS; Vite transform 3.322 modules.
- Docker Compose config — PASS; image API/web được rebuild và service health được kiểm ở bước deploy cuối.
- Frontend không có lint script. API lint script mặc định có `--fix`, nên không chạy như một audit read-only.

## 21. Test result

- Jest: 30 suite pass, 160 test pass; 1 suite/4 test skip theo cấu hình; 0 fail.
- Prisma format/validate/generate: PASS.
- Browser smoke owner đã mở appointments, notifications, account, security, attendance, services, staff, promotions, combos, profile và stats; không gặp alert trong lượt smoke.
- Không có frontend E2E/visual-regression runner trong project, vì vậy browser smoke không được mô tả như coverage tự động đầy đủ.

## 22. Known limitations

Xem `docs/KNOWN_LIMITATIONS.md`. Trọng yếu nhất là cookie/CSRF, media storage/scan, distributed infrastructure, payment provider, multi-staff/partial combo, recurring reschedule, các auto-audience khác birthday và thiếu device/E2E matrix.

## 23. Next steps

1. Hoàn thành các gate security trong `SECURITY_AUDIT_BEFORE_DEPLOY.md` trước public launch.
2. Thêm promotion/review/gallery media relations và UI nhiều ảnh nếu đó là yêu cầu release.
3. Thiết kế multi-staff combo + partial refund với ledger rõ ràng trước khi mở nghiệp vụ này.
4. Thêm recurring reschedule/resolve từng conflict và manager conflict queue.
5. Bổ sung Playwright E2E cho role matrix, viewport 375/768/1024/1440, upload, combo, recurring, IDOR và refresh replay.
6. Chạy staging load/concurrency test, DAST, backup/PITR restore drill và observability/SLO.

## Kết luận trung thực

Segment A+B đã được triển khai sâu ở source và các build/test hiện có đều pass. Tuy nhiên hệ thống **chưa được tuyên bố production-ready** do các blocker hạ tầng/bảo mật và các giới hạn nghiệp vụ đã liệt kê rõ ở trên.
