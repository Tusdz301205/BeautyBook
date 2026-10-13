# Ảnh biên tập (editorial) dùng trên mobile

Các ảnh này là **ảnh biên tập toàn cục thuộc dự án BeautyBook**, sao chép từ bản web đã commit
(`beauty-booking-web-main/beauty-booking-web-main/public/images/beautybook/`). Nguồn gốc, kích thước gốc và
alt text được ghi trong `docs/generated-images/beautybook/manifest.json` (tier `global` / `reusable`,
`entitySpecific: false`). Theo `IMAGE-SYSTEM.md`, chúng là ảnh tĩnh vật tạo sinh cho giao diện biên tập,
**không** phải ảnh thật của cơ sở, dịch vụ hay chuyên viên, và không được dùng làm ảnh thay thế cho một cơ sở cụ thể.

| File mobile | Nguồn (web) | Khóa manifest | Dùng ở |
| --- | --- | --- | --- |
| `home-hero.webp` | `home/beautybook-home-hero-480.webp` | `hero` | Băng khám phá ở Home |
| `invitation.webp` | `home/final-cta-editorial-768.webp` | `finalCta` | Tài khoản (khi chưa đăng nhập) |
| `planning.webp` | `home/availability-planning-editorial-768.webp` | `availability` | Màn đặt lịch thành công |
| `auth-login.webp` | `auth/auth-login-editorial-720.webp` | `authLogin` | Đăng nhập |
| `auth-register.webp` | `auth/auth-register-editorial-720.webp` | `authRegister` | Đăng ký |
| `auth-recovery.webp` | `auth/auth-recovery-editorial-720.webp` | `authRecovery` | Quên / đặt lại mật khẩu, xác minh email |

Quy ước hiển thị: ảnh biên tập chỉ đóng vai trò trang trí cho các khối toàn cục (ẩn với trình đọc màn hình hoặc mô tả là
“ảnh minh họa”). Ảnh cơ sở / dịch vụ / chuyên viên luôn lấy từ API; khi API không có ảnh, giao diện dùng bìa màu theo nhóm
dịch vụ (`src/ui/ArtCover.tsx`), không dùng ảnh biên tập để giả làm ảnh thật.

Không có ảnh nào được tải từ URL ngoài (hotlink).
