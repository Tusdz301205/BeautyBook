# BeautyBook mobile: Staff / Owner V1

Ngày triển khai: 05/10/2026. Tài liệu mô tả quyết định và mã thực tế; kết quả chạy được ghi riêng trong TESTS.md, không suy ra nghiệm thu từ thiết kế.

## Phạm vi và quyết định

Customer giữ bốn tab hiện tại. Staff: Hôm nay, Lịch, Thông báo, Tài khoản. Owner: Tổng quan, Vận hành, Thông báo, Tài khoản. Mỗi shell có native stack riêng; không nhúng web hoặc scheduler desktop.

Staff xem từng BookingService được giao, khách đã đến/chưa đến, giờ dự kiến theo chi nhánh, thời gian thực tế từ audit. START trực tiếp và COMPLETE có xác nhận đúng dịch vụ/khách. Không check-in, sửa giá, phân công, duyệt yêu cầu hay hoàn tất toàn booking. Không tạo pause/resume hoặc tự hoàn tất khi hết thời lượng.

Owner theo dõi số lịch và trạng thái đúng ngày/chi nhánh, xử lý yêu cầu và impact qua nghiệp vụ hiện có. ACTIVE staff profile được mô tả là hồ sơ ACTIVE, không gọi là người đang làm việc. Các nhánh tài chính dùng chặn server và chuyển sang web cấu hình; không đưa thanh toán/hoàn tiền/hoa hồng hoặc cấu hình sâu vào V1.

## Skills và nguồn

- `skills/SKILL.md`: thứ tự thông tin theo nhiệm vụ, trạng thái tải/lỗi/rỗng rõ ràng; reuse berry/cream tokens.
- `skills/mobile-app-design/SKILL.md`, `references/android-guidelines.md`: bottom tabs có chữ/icon; điều khiển >=48dp, safe area, font scaling; FlatList cho danh sách.
- `skills/ux-pattern-research/SKILL.md`: awesome-ux là chỉ mục nghiên cứu, không phải bằng chứng local usability. Không tuyên bố đã nghiên cứu thực địa.
- Đã xem `skills/taste-skill/SKILL.md` và mẫu mobile-onboarding; không áp dụng vì tài liệu giới hạn landing/prototype HTML, không phù hợp app vận hành React Native. Không thêm skill trang trí để đáp ứng hình thức.
- Expo SDK57 docs: https://docs.expo.dev/versions/v57.0.0/ đối chiếu SDK57/React19.2/RN0.86; không nâng dependencies lớn.

## Auth, scope và cache

Login cho chọn Customer/SALON; role lấy từ server. Challenge BUSINESS_REQUIRED giữ password trong memory, nhãn doanh nghiệp chỉ từ server sau xác thực. Session user lưu workspace, sessionType, businessId, branchId, roles/scopes/expiry. Giữ Secure Store key hiện có để tương thích phiên cũ.

Chỉ CustomerTabs mount CustomerProviders. Operational shell không mount customer bookings/favorites/address/filter providers. Receptionist/platform-only có màn giải thích và logout, không fallback Customer. Lựa chọn phụ tài khoản quản trị chỉ xác thực để giải thích phạm vi web, không triển khai Platform shell vận hành.

Đổi business yêu cầu đăng nhập lại để server cấp session mới; không sửa businessId của token tại client. Branch picker chỉ dùng accessible branches của session và không đổi khỏi session.branchId đã khóa. Owner có quyền Owner còn hiệu lực và profile nhân viên ACTIVE trong doanh nghiệp hiện tại được chuyển sang Công việc của tôi; endpoint vẫn chỉ trả item gắn profile của chính tài khoản.

Cache identity gồm user/workspace/business/session branch/scopes/selected branch/mode. Các đọc async có sequence và session generation fencing. Một socket shared operational provider; event chỉ invalidation, refetch qua API có quyền. Foreground/reconnect bù thay đổi; không merge event payload vào công việc. Logout hoặc scope đổi hủy subscription và bỏ navigation/data cũ.

## Mapping

| Screen | API / state | Ranh giới |
|---|---|---|
| Login | POST /auth/login; /auth/refresh | BODY refresh rotation; server role/challenge |
| Context/account | GET /branches/accessible; /staff/me | current business; valid scope; missing profile có trạng thái riêng |
| Staff Today/Agenda | GET /bookings/my-work-items | item được phân công; phân trang đầy đủ; không dùng my-appointments |
| Staff detail | GET /bookings/my-work-items/:itemId | không contact/financial projection |
| Staff action | PATCH /bookings/:bookingId/items/:itemId | START/COMPLETE; expectedRevision; reread khi chưa rõ kết quả |
| Owner overview | GET /reports/owner-dashboard từng accessible branch | aggregate đúng business; không số tài chính |
| Owner operations | pending change requests + operational impacts | phân biệt request/case; không gọi PENDING queue là khách đã đến |
| Owner review | approve/reject request; safe impact endpoint | review note; server mobile finance guard; refetch |
| Notifications | GET /notifications + read endpoints | theo tài khoản, không quảng cáo lọc branch; UUID allowlist; không execute actionUrl |

## Thời gian và lỗi

Planned timestamp khác actual timestamp. Actual chỉ SERVICE_ADJUSTMENT; null/UNAVAILABLE luôn ghi chưa có mốc. Counter anchored serverNow + audit start/stop, không bắt đầu lại từ 0 sau refetch. Không dịch lịch kế tiếp hoặc tăng giá vì chạy quá giờ.

Không có fixture fallback khi API lỗi. Forbidden/mất assignment bỏ dữ liệu và CTA; offline giữ dữ liệu đã có nhưng đánh dấu cũ, không queue mutation. Mutation không optimistic thành công và không blind retry sau timeout. Android/iOS/native bằng chứng nằm riêng trong TESTS.md; Android export không thay kiểm thử thiết bị.

Final context changes: selected-business status uses the minimal /business/mobile-context response (no legal docs/tax/contact payload). Staff Account lists services in own assigned workday via safe personal-work API, not catalog prices or commission. Root Socket.IO namespace matches actual SchedulerGateway; no /scheduler namespace. Latesttypecheck/exportPASS and native results in TESTS.md.
