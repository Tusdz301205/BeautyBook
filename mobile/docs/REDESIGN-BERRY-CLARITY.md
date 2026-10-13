# BeautyBook mobile — Thiết kế lại “Berry Clarity”

Ngày: 09/10/2026 · Nhánh: `feat/mobile-berry-clarity-redesign` · Đề xuất gốc: [design-proposals/beautybook-mobile/2026-10-09-de-xuat-berry-clarity-v1.md](../../design-proposals/beautybook-mobile/2026-10-09-de-xuat-berry-clarity-v1.md)

> Cập nhật 11/10/2026: bảng màu, chữ và hình ảnh mô tả dưới đây đã được thay bằng [Berry Bloom](REDESIGN-BERRY-BLOOM.md). Phần cấu trúc mã và hành vi hiển thị vẫn đúng.

## Tóm tắt

Một thương hiệu, ba mật độ. Berry `#8D315B` là màu hành động duy nhất; nền ngà `#FBF7F3`, mực `#2A1F26`, mận `#3A2232` cho bề mặt nhấn. Trạng thái dùng bảng màu riêng và luôn có **icon + chữ**. Font hệ thống (Roboto/SF), không thêm dependency.

## Cấu trúc mã mới

| Đường dẫn | Vai trò |
|---|---|
| `src/theme/index.ts` | Token thuần TS: `colors`, `tones`, `bookingTone`, `space`, `radius`, `layout`, `type`, `elevation`. Không import React Native để test Node nạp trực tiếp. |
| `src/ui/*` | Bộ component dùng chung: `AppButton`, `IconButton`, `ScreenHeader`, `Card`, `StatusPill`, `Notice`, `EmptyState`/`LoadingState`/`SkeletonBlock`, `ListRow`, `Chip`, `Segmented`, `SectionHeader`, `TextField`, `SheetModal`, `BrandTabBar`. |
| `src/utils/bookingClock.ts` | Định dạng giờ trống theo `Asia/Ho_Chi_Minh` (khớp `BOOKING_TIME_ZONE` mặc định của backend và `mapBooking`). |
| `src/operations/stackOptions.ts` | Header native-stack chung cho Staff/Owner. |
| `src/components/AuthResult.tsx` | Khối kết quả cho luồng xác thực. |

Quy ước: mọi điều khiển ≥48dp, dùng `minHeight` (không cố định chiều cao), không tắt font scaling, nhãn trợ năng cho nút chỉ có icon, nút viết chữ thường câu.

## Thay đổi hành vi hiển thị (không đổi API)

- **Booking:** thứ tự Dịch vụ → Chuyên viên → Ngày → Giờ → Ưu đãi/ghi chú; “Tạm tính” khi chưa có báo giá máy chủ, “Tổng dự kiến” khi có; dòng lý do khi nút bị khóa; giờ nhóm Sáng/Chiều/Tối theo múi giờ đặt lịch; sheet xem lại không còn khẳng định chắc chắn PENDING. Logic snapshot/idempotency/kết quả chưa rõ giữ nguyên từng dòng.
- **Cơ sở:** tab Dịch vụ mặc định; rating chỉ khi có đánh giá; giá giữ ngữ nghĩa `fixed/from/quote` (`servicePriceLabel`); Gọi/Zalo/Chỉ đường có nhãn; bỏ icon “báo cáo” không hoạt động.
- **Combo:** bỏ bookmark chỉ lưu cục bộ.
- **Lịch hẹn:** quá giờ mà cơ sở chưa xử lý hiển thị “Quá giờ hẹn · chờ cập nhật” (không coi là hoàn thành).
- **Staff:** START hiển thị “Bắt đầu dịch vụ” (không nhầm check-in); COMPLETE “Hoàn tất dịch vụ”; khi khách chưa được ghi nhận đến, thẻ nói rõ phải chờ quầy.
- **Owner:** “Cần bạn xử lý” lên đầu, không bao giờ báo “không có việc” khi đang tải/lỗi; số liệu ngày ghi “đếm theo lịch hẹn”.
- **Gỡ:** `OtpVerify` (giả, không có đường vào), `Forms` (placeholder, không có đường vào), `FilterSheet`/`TimeFilterSheet` và context tương ứng (không được mở), `OperationTabLabel`, `PlaceholderCover`, `constants/colors` (đã thay bằng `theme`).

## Giữ nguyên có chủ đích

- Theo quyết định sản phẩm đã áp dụng ở project chính, không đưa lại giao diện hoặc API client yêu cầu xử lý dữ liệu / xóa tài khoản. Backend audit cần thiết được giữ nguyên.
- Route name, deep link, package `com.beautybook.mobile`, scheme `beautybook`, khóa phiên, biến môi trường.

## Kiểm chứng đã chạy (09/10/2026, Windows, Node)

- `npm ci` theo lockfile.
- `npx tsc --noEmit`: sạch.
- `node --test tests/*.test.cjs`: **156/156 đạt**. Trên `main` trước thay đổi: 155/156 (test chi tiết lịch hẹn lỗi do mock thiếu `useOperationalTime`; đã sửa mock).
- `node scripts/audit-reachable.mjs`: 130/130 module truy cập được.
- Đối chiếu tên icon Ionicons dùng dạng chuỗi với glyph map đã cài: không thiếu.

Thay đổi test: chỉ bổ sung mock cho module thuần mới (`theme`, `bookingClock`, `bookingOperationalTime`), đổi kỳ vọng chuỗi theo nội dung mới (“Bắt đầu dịch vụ”, “Hoàn tất dịch vụ”, “Ngày 06/10/2026”, “Viết đánh giá”). Không bỏ assertion nghiệp vụ nào.

## Chưa kiểm chứng

Theo `mobile/AGENTS.md`, không tự chạy emulator/ADB/Metro nên **chưa có ảnh chụp hay nghiệm thu trên thiết bị**. Cần QA thủ công trước khi merge:

1. Màn 320/390/412dp; font scale 1.0 / 1.3 / 2.0; TalkBack/VoiceOver đọc nhãn nút icon, pill trạng thái, chip lọc.
2. Customer: Home → danh mục → Tìm kiếm (chip lọc thêm/xóa, phân trang) → Cơ sở (tab dính, chọn nhiều dịch vụ, giá “Từ…”) → Đặt lịch (biến thể, đổi chuyên viên, giờ Sáng/Chiều/Tối, voucher, chính sách cảnh báo, đăng nhập giữa chừng) → PENDING và CONFIRMED → mất mạng khi gửi (khối “Chưa rõ kết quả”, thử lại cùng yêu cầu) → xung đột giờ.
3. Lịch hẹn: thẻ kế tiếp, lịch tháng, chi tiết (hủy ngay vs yêu cầu hủy sát giờ, đổi lịch, đánh giá).
4. Staff: nhiều dịch vụ đang chạy song song, START khi đã/ chưa check-in, COMPLETE có xác nhận, dải 7 ngày, mất mạng khi thao tác.
5. Owner: tải/lỗi không báo “không có việc”, đổi chi nhánh/ngày, duyệt/từ chối (xác nhận hai bước), hiệu chỉnh giờ thực tế, chặn tài chính chuyển web.
6. Sheet (`SheetModal`) với bàn phím trên Android/iOS; nút back Android đóng sheet.
