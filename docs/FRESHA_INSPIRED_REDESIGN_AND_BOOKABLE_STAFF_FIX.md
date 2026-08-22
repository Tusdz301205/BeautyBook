# BeautyBook — Fresha-inspired public redesign & bookable staff fix

Ngày hoàn tất: 2026-07-22

## Kết quả

Public marketplace đã được chuyển sang trải nghiệm tìm kiếm và đặt lịch nhanh theo hướng Fresha-inspired ở cấp kiến trúc thông tin, không sao chép giao diện, nội dung, ảnh, mã nguồn hay nhận diện của Fresha. Trang chủ, Explore, trang chi tiết cơ sở/dịch vụ/chuyên viên và hai bước đầu của booking flow dùng chung dữ liệu API thật, CTA thật và image slot thuộc project.

Lỗi lọc chuyên viên đã được sửa ở tầng dữ liệu, query public, availability, booking validation và recurring assignment. Quyền vận hành như chủ doanh nghiệp, quản lý chi nhánh hoặc lễ tân không còn tự động đồng nghĩa với khả năng nhận lịch.

## Hướng thiết kế

- Hallmark macrostructure: `Ecosystem Index` với search hero, category rail và salon rail.
- Điều hướng desktop: capsule gọn; mobile: drawer có accessible name và trạng thái expanded.
- Footer: statement close; không dùng footer bốn cột kiểu template.
- Visual: nền sáng, sans hình học dễ đọc tiếng Việt, pastel dùng có chủ đích, Fraunces chỉ giữ cho wordmark.
- Ảnh: chỉ nhận URL từ backend hoặc hiện image slot ổn định; không lấy ảnh mạng, không giả ảnh.
- Rail: cuộn ngang native, không autoplay, nút trước/sau chỉ hiện khi thật sự overflow và bị disable ở biên.
- Responsive: kiểm tra 1440, 1024, 768, 390 và 320 px; `html` và `body` dùng `overflow-x: clip`.

## Luồng public đã triển khai

- `/`: search-first homepage; danh mục dịch vụ, cơ sở phổ biến và cơ sở mới đều gọi API thật.
- `/explore`: filter thật, 12 bản ghi/trang, tải thêm có dedupe và retry đúng trang.
- `/explore/branches/:id`: dữ liệu cơ sở, dịch vụ, chuyên viên, review; desktop có booking dock sticky, mobile có bottom booking bar.
- `/explore/services/:id` và `/explore/staff/:id`: title chuyên môn, chuyên môn dịch vụ, avatar/placeholder, rating duyệt và CTA giữ lựa chọn sang booking.
- `/book`: mặc định khuyến nghị “Bất kỳ chuyên viên phù hợp”; `branchId`, `serviceId`, `staffId` từ CTA được giữ trong booking store.

## Nguyên nhân và policy mới cho nhân sự nhận lịch

Trước đây các query dùng trạng thái hồ sơ hoặc quan hệ staff chung, nên một tài khoản vận hành có `StaffProfile` có thể lọt vào danh sách công khai/ứng viên booking. Policy mới được gom tại `bookableStaffWhere()`:

1. `status = ACTIVE` và `deletedAt = null`.
2. `isBookable = true` — cờ nghiệp vụ độc lập với RBAC.
3. Nếu là public query thì thêm `publicVisible = true`.
4. Query nhận lịch yêu cầu lịch làm việc và service assignment phù hợp.
5. Tài khoản liên kết phải active, chưa bị xóa; hồ sơ provider không có account vẫn được hỗ trợ.
6. Role không được dùng để quyết định ở runtime.

Public DTO chỉ xuất `professionalTitle`, `specialties`, avatar và rating/count từ review `APPROVED`; title nội bộ như quản lý, lễ tân, chủ doanh nghiệp và quản trị được thay bằng “Chuyên viên làm đẹp”.

## Schema và migration

- `StaffProfile.isBookable Boolean @default(false) @map("is_bookable")`.
- Composite index: `(branchId, status, isBookable, publicVisible)`.
- Migration backfill chỉ bật cho hồ sơ active có service assignment và là tài khoản `STAFF` còn hiệu lực, hoặc provider không liên kết account. Các role vận hành khác giữ `false` và phải bật rõ ràng từ màn quản lý đội ngũ.
- API container chạy `prisma migrate deploy` trước khi start Nest.

Migration `20260721_add_staff_bookable_flag` đã được áp dụng trên PostgreSQL local. Dữ liệu hiện tại có 123 hồ sơ `is_bookable=true, public_visible=true` và 114 hồ sơ `is_bookable=false, public_visible=true`; nhóm 114 bị loại bởi mọi public/booking query vì policy yêu cầu đồng thời hai cờ.

## Enforcement

- Public branch readiness/list/detail chỉ xét provider đủ điều kiện.
- Public services chỉ trả provider đủ điều kiện và có schedule.
- Staff public list/detail dùng cùng một policy.
- Booking validation từ chối profile không nhận lịch hoặc linked account inactive/deleted.
- Candidate selection, “any staff” availability và recurring auto-assignment đều yêu cầu `isBookable=true`.
- Invitation STAFF mặc định bookable/public; invitation manager/receptionist mặc định không bookable.
- Seed chỉ gắn services cho provider thực, không gắn cho manager/receptionist.
- Màn quản lý đội ngũ có hai cờ riêng: “Nhận lịch” và “Hồ sơ công khai”.

## Test matrix

| Trường hợp | Kết quả |
|---|---|
| Active, chưa xóa, `isBookable=true` | Pass |
| `isBookable=false` bị loại | Pass |
| Public query yêu cầu `publicVisible=true` | Pass |
| Branch scope được giữ | Pass |
| Phải có working hour khi query yêu cầu | Pass |
| Service IDs được dedupe và lọc | Pass |
| Linked account inactive/deleted bị loại | Pass |
| Quyền manager/receptionist/owner không tự tạo eligibility | Pass |
| Title nội bộ EN/VI, dạng khoảng trắng/gạch dưới không lộ ra public | Pass |
| Title chuyên môn thật được giữ | Pass |
| Rating chỉ tổng hợp dữ liệu được truyền từ review đã duyệt | Pass |
| Booking validation từ chối non-bookable staff | Pass |

Kết quả tự động:

- Focused tests: 3 suites, 37 tests — pass.
- Full backend: 35 suites pass, 189 tests pass; 1 suite/4 tests được skip theo cấu hình hiện có.
- `npx prisma validate` — pass.
- Nest production build — pass.
- Vite production build — pass, 3.329 modules.
- Docker build API/web — pass.

## Runtime verification

- PostgreSQL: healthy.
- Redis: healthy.
- API: healthy, `/api/v1/health` trả `status=ok`, `database=up`.
- Web: chạy tại `http://localhost:8080`.
- Public Explore trả 12 cơ sở thật ở trang đầu; CTA chi tiết và booking có ID thật.
- Một chi nhánh kiểm tra trả 4 chuyên viên đủ điều kiện, kèm title chuyên môn, specialties và rating/count thật (ví dụ 4.4/16, 3.8/8, 4.3/11, 4.5/15).
- Hallmark fold test tại 1280×800: headline, lede, primary CTA và focal point của media slot đều nằm trong màn hình đầu; không có horizontal overflow.

## File đã sửa

### Design system

- `design.md`
- `.hallmark/log.json`

### Backend

- `beauty-booking-api-main/prisma/schema.prisma`
- `beauty-booking-api-main/prisma/migrations/20260721_add_staff_bookable_flag/migration.sql`
- `beauty-booking-api-main/prisma/seed.ts`
- `beauty-booking-api-main/src/staff/bookable-staff.ts`
- `beauty-booking-api-main/src/staff/bookable-staff.spec.ts`
- `beauty-booking-api-main/src/staff/staff.service.ts`
- `beauty-booking-api-main/src/staff/staff.controller.ts`
- `beauty-booking-api-main/src/staff/staff-invitations.service.ts`
- `beauty-booking-api-main/src/bookings/bookings.validation.ts`
- `beauty-booking-api-main/src/bookings/bookings.validation.spec.ts`
- `beauty-booking-api-main/src/bookings/bookings.service.ts`
- `beauty-booking-api-main/src/recurring/recurring.service.ts`
- `beauty-booking-api-main/src/branches/branches.service.ts`
- `beauty-booking-api-main/src/services/services.service.ts`

### Frontend

- `beauty-booking-web-main/beauty-booking-web-main/src/components/public/MarketplaceRail.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/components/public/PublicChrome.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicHome.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicDetails.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingStep1.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingStep2.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonStaffManagement.jsx`
- `beauty-booking-web-main/beauty-booking-web-main/src/styles/public-home.css`

## Chạy lại project

Docker CLI của máy này nằm tại thư mục cài theo user và chưa có trong `PATH`. Trong PowerShell mới, có thể thêm tạm rồi chạy:

```powershell
cd C:\Users\Admin\Downloads\beauty-booking-api-main
$env:Path += ';C:\Users\Admin\AppData\Local\Programs\DockerDesktop\resources\bin'
docker compose up -d --build
docker compose ps
```

Không cần chạy migration riêng vì API image tự chạy `npx prisma migrate deploy`. Không chạy seed khi chỉ muốn giữ dữ liệu hiện tại. Chỉ chạy seed khi chủ động muốn thay dữ liệu demo:

```powershell
cd C:\Users\Admin\Downloads\beauty-booking-api-main
$env:Path += ';C:\Users\Admin\AppData\Local\Programs\DockerDesktop\resources\bin'
docker compose exec api npx prisma db seed
```
