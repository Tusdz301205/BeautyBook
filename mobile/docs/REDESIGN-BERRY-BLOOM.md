# BeautyBook mobile — Hệ thiết kế “Berry Bloom”

Ngày: 11/10/2026 · Nhánh: `feat/mobile-berry-clarity-redesign` (chỉ ở máy local, chưa push) · Kế thừa và thay thế phần màu/chữ/ảnh của [REDESIGN-BERRY-CLARITY.md](REDESIGN-BERRY-CLARITY.md). Các quy ước nghiệp vụ và hành vi hiển thị ghi ở tài liệu đó vẫn còn hiệu lực.

## 1. Hướng thiết kế

Bản Berry Clarity (09/10) đúng về cấu trúc nhưng nhạt: một màu berry trầm trên nền ngà, font hệ thống, không có ảnh. Berry Bloom giữ cấu trúc đó và thêm ba thứ tạo bản sắc:

1. **Màu có vai trò cố định**, không trang trí ngẫu nhiên.
2. **Hai họ chữ hỗ trợ tiếng Việt**: Fraunces (tiêu đề lớn) và Be Vietnam Pro (mọi thứ còn lại).
3. **Hình ảnh dẫn đường**: ảnh minh họa theo nhu cầu, ảnh biên tập cho các khối thương hiệu, bìa màu theo nhóm dịch vụ khi cơ sở chưa có ảnh thật.

## 2. Màu (`src/theme/index.ts`)

| Vai trò | Token | Giá trị | Dùng cho |
| --- | --- | --- | --- |
| Hành động + đang chọn | `primary` / `primaryPressed` / `primarySoft` | `#B4235F` / `#8C1848` / `#FCE4EC` | CTA, chip/ngày/giờ/tab đang chọn, giá |
| Bề mặt thương hiệu | `secondary` / `secondaryMid` | `#3A1446` / `#5E1F66` | Hero, header, khối ngày giờ |
| Nền | `background` / `surface` / `surfaceMuted` | `#FFF8F5` / `#FFFFFF` / `#F8EEF0` | Trang, thẻ, vùng phụ |
| Chữ | `heading` / `body` / `secondaryText` | `#2A1230` / `#4A3550` / `#6D5873` | |
| Viền | `border` / `borderStrong` | `#EFDDE3` / `#93798A` | Thẻ / đường viền điều khiển |

- **Gradient** (`gradients`): `brand` (mận → berry) cho hero Customer; `dusk` cho header Staff/Owner; `blush`, `lilac` cho băng nội dung sáng. Gradient tĩnh, không animation.
- **Nhóm dịch vụ** (`families` + `familyOf(tên)`): tóc = tím lavender, móng = berry, da = đào, spa/massage = xanh sage, trang điểm/mày = xanh sky, còn lại = vàng gold. Màu được suy ra từ tên nhóm theo quy tắc cố định, không ngẫu nhiên theo từng thẻ.
- **Trạng thái lịch hẹn** (`bookingTone` → `tones`): chờ xác nhận = warning, đã xác nhận = info, đã đến = arrived, đang làm = brand, hoàn tất = success, hủy/hết hạn = neutral, từ chối/vắng = danger. Luôn kèm **icon + chữ**.

Tương phản (WCAG, tính bằng `tests/presentation-logic.test.cjs`):

| Cặp | Tỉ lệ |
| --- | --- |
| Chữ trắng trên `primary` / `primaryPressed` | 6.28 / 8.98 |
| Chữ trắng trên các điểm dừng `brand` | 15.35 / 9.57 / 6.28 |
| Chữ trắng trên `dusk` | 11.27 / 15.35 |
| `heading` / `body` / `secondaryText` trên nền | 16.29 / 10.44 / 6.07 |
| `primary` trên trắng / trên `primarySoft` | 6.28 / 5.21 |
| Chữ trạng thái trên nền trạng thái (8 tone) | 5.61 – 7.16 |
| Chữ nhóm dịch vụ trên nền nhóm (6 nhóm) | 5.50 – 7.16 |
| `borderStrong` trên trắng (viền điều khiển, cần ≥ 3) | 3.93 |

Gradient sáng (`blush`, `lilac`, `sunrise`) chỉ mang chữ đậm màu `heading`/`primary`, không bao giờ mang chữ trắng.

## 3. Chữ

- `Fraunces_600SemiBold`: `type.display`, `type.h1`, tiêu đề header.
- `BeVietnamPro` 400/500/600/700: phần còn lại. Mỗi độ đậm là một `fontFamily` riêng — **không đặt `fontWeight`**, dùng `...fw.semibold` v.v. (đặt `fontWeight` sẽ khiến Android vẽ đậm giả).
- Font nạp ở `App.tsx` bằng `expo-font`; nếu nạp lỗi ứng dụng vẫn mở với font hệ thống.
- Cỡ nhỏ nhất 12, không tắt font scaling; đã kiểm ở hệ số 1.3 trên Android.

## 4. Thành phần mới / thay đổi (`src/ui`)

| Thành phần | Vai trò |
| --- | --- |
| `BrandGradient` | Bề mặt gradient thương hiệu, tùy chọn họa tiết tròn mờ |
| `ArtCover` | Bìa màu theo nhóm dịch vụ thay cho ô “chưa có ảnh”; có chế độ gọn cho ô ≤ 72 |
| `Avatar`, `FamilyTag`, `RatingPill` | Ảnh/chữ viết tắt chuyên viên, nhãn nhóm dịch vụ, điểm đánh giá |
| `Medallion` + `EmptyState tone` | Trạng thái rỗng/lỗi có màu theo ngữ cảnh |
| `StatusBarShade` + `useStatusBarShade` | Dải mận sau thanh trạng thái khi hero đã cuộn khỏi màn hình (icon trạng thái màu sáng luôn đọc được) |
| `ScreenHeader brand`, `Chip`, `Segmented`, `BrandTabBar` | Header gradient; trạng thái chọn là berry đặc |

## 5. Hình ảnh

- Đường đi ảnh thật: API (`imageUrls`, `avatarUrl`) → `mappers/catalog.ts` → `BannerCarousel` / `Avatar`. Có ảnh thật thì luôn dùng ảnh thật.
- Không có ảnh thật: `ArtCover` (bìa màu + chữ viết tắt), không dùng ảnh biên tập để giả làm ảnh cơ sở.
- Ảnh minh họa theo nhu cầu (`assets/illustrations`, gắn nhãn “Minh họa”) và ảnh biên tập (`assets/editorial`, chỉ trang trí) đều là tài sản của dự án, không hotlink. Nguồn gốc: [assets/illustrations/manifest.md](../assets/illustrations/manifest.md), [assets/editorial/manifest.md](../assets/editorial/manifest.md).

## 6. Thay đổi trải nghiệm đáng chú ý (không đổi API, không đổi nghiệp vụ)

- **Home:** hero gradient có ô tìm kiếm, lịch hẹn kế tiếp, dải nhu cầu bằng ảnh, cơ sở (tiêu đề “được đánh giá cao” chỉ khi API có điểm), băng biên tập, danh sách dịch vụ thật từ tìm kiếm.
- **Cơ sở:** dịch vụ khách bấm từ Tìm kiếm/Yêu thích được chọn sẵn **và đưa lên đầu** (`leadWithRequested`); tab ghim ngay dưới thanh trạng thái khi cuộn; điểm đánh giá lấy từ tổng hợp của API; khối “Đội ngũ chuyên viên”.
- **Đặt lịch:** khách chưa đăng nhập thấy đúng việc cần làm tiếp (“Chọn giờ trước, rồi đăng nhập…”); nền mờ của sheet xem lại không còn đổ bóng cứng trên Android.
- **Sau khi đặt:** nút Back của Android, “Xem lịch hẹn của tôi” và “Về trang khám phá” đều đưa tab Khám phá về trang chủ; không quay lại form vừa gửi.
- **Đăng nhập:** nút quay lại hoạt động cả khi Đăng nhập là màn gốc (sau đăng xuất).
- **Cỡ chữ lớn:** giờ hẹn và “giá · thời lượng” không còn gãy giữa chừng.
- **Staff/Owner:** header `dusk`, ô số liệu có màu theo ý nghĩa; không hiện mã trạng thái thô (`ACTIVE`, `STAFF`, `Asia/Ho_Chi_Minh` → nhãn tiếng Việt).

## 7. Kiểm chứng từ bản bàn giao (11/10/2026)

Các kết quả và ảnh chụp bên dưới được nhận từ bản nguồn cập nhật; không phải nghiệm thu lại bản chính sau merge ngày 12/10/2026. Xem `MERGE-123-20261012.md` để biết các kiểm tra thực sự chạy trên bản đã ghép.

| Hạng mục | Kết quả |
| --- | --- |
| `npx tsc --noEmit` | Sạch |
| `node --test tests/*.test.cjs` | 164/164 đạt (8 bài mới trong `presentation-logic.test.cjs`) |
| `node scripts/audit-reachable.mjs` | 135/135 file được dùng, 0 file thừa |
| `npx expo export --platform android` | Đạt (bundle Hermes ~3 MB) |
| `npm run test:live:catalog` (web 320 và 390, API thật) | Đạt: không tràn ngang, không lỗi trang, không lỗi API, slot trả 200 |
| Android emulator (1080×2400, Expo Go, API thật) | Đã chạy tay: Customer từ Home → Tìm kiếm → Cơ sở → Đặt lịch → Đăng nhập → Xem lại → Gửi → Kết quả → Lịch hẹn → Chi tiết → Tài khoản → Đăng xuất; Staff (Hôm nay, chi tiết, Lịch, Tài khoản); Owner (Tổng quan, Vận hành, Tài khoản); cỡ chữ 1.3 cho Home, Tìm kiếm, Cơ sở, Đặt lịch, Lịch hẹn |

Ảnh chụp: [evidence/berry-bloom/native](evidence/berry-bloom/native) là ảnh từ emulator Android; [evidence/berry-bloom/web](evidence/berry-bloom/web) là ảnh bản web của Expo cho các màn chưa chụp native — **không** phải bằng chứng native. Không có ảnh “trước” vì giao diện cũ không được chụp lại trước khi sửa.

Chưa kiểm chứng: iOS; thiết bị thật; màn hình nhỏ dưới 360dp trên native (chỉ kiểm ở web 320); TalkBack; combo và ảnh thật của cơ sở (dữ liệu demo không có); đổi lịch/hủy lịch, thông báo, yêu thích, hồ sơ trên native (chỉ kiểm ở web); các bài `tests/live-*.mjs` ngoài `live-catalog-smoke` và `live-booking-entry` chưa được cập nhật theo giao diện mới.

## 8. Chạy môi trường kiểm thử trên Windows không có Docker

Docker Desktop trên máy phát triển hiện không chạy được (WSL2 chưa bật “Virtual Machine Platform”). Cách đã dùng, không đụng tới PostgreSQL đang cài sẵn:

```bash
# 1) Cụm PostgreSQL tạm, xác thực trust, cổng 5544
PGBIN="/c/ProgramFiles/PostgreSQL/18/bin"; PGDATA="<thư mục tạm>/pgqa"
"$PGBIN/initdb.exe" -D "$PGDATA" -U bbqa -A trust -E UTF8 --locale=C
"$PGBIN/pg_ctl.exe" -D "$PGDATA" -o "-p 5544 -c listen_addresses=localhost" -w start
"$PGBIN/createdb.exe" -h localhost -p 5544 -U bbqa beautybook_demo

# 2) API (trong beauty-booking-api-main); các biến còn lại lấy giá trị local-dev như docker-compose.yml
export DATABASE_URL="postgresql://bbqa@localhost:5544/beautybook_demo?schema=public" DIRECT_URL="$DATABASE_URL"
npm ci && npx prisma generate && npx prisma migrate deploy
SEED_SKIP_RESET=1 NODE_ENV=development npm run db:seed:demo   # in ra danh sách tài khoản demo
npx nest build && NODE_ENV=development PORT=3000 CORS_ORIGINS="http://localhost:8081" node dist/src/main.js

# 3a) Web: trong mobile/
npm run web                                   # http://localhost:8081

# 3b) Android emulator + Expo Go: trong mobile/
NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --android --localhost --port 8083
```

`SEED_SKIP_RESET=1` là bắt buộc trên database vừa migrate (bước reset của seed bị chặn bởi bảng lưu trữ bất biến). `--dns-result-order=ipv4first` là bắt buộc trên máy này: nếu thiếu, Metro chỉ nghe IPv6 và Expo Go báo “Failed to download remote update”. Emulator gọi API qua `http://10.0.2.2:3000` (mặc định trong `src/config/api.ts`).

Công cụ chụp ảnh web: `scripts/shoot-web.mjs` (Customer) và `scripts/shoot-ops-web.mjs` (Staff/Owner); cả hai nhận tài khoản qua biến môi trường `QA_EMAIL` / `QA_PASSWORD`, không lưu trong mã.
