# BeautyBook Mobile — Đề xuất thiết kế lại toàn diện (Giai đoạn A)

**Phiên bản:** v1 · **Ngày:** 09/10/2026 · **Phạm vi:** Khách hàng, Nhân viên (Staff), Chủ doanh nghiệp (Owner) trên `mobile/`
**Trạng thái:** Bản ghi quyết định thiết kế và bản thiết kế thi công. Tài liệu này không được import vào ứng dụng.
**Hướng được chọn:** **Berry Clarity — “Rõ ràng & ấm áp”** (mục 5).

> **Ghi chú phạm vi brief:** Brief gốc bị cắt sau mục 11 (“…Clarify different date windows and paginat”). Các tiêu đề mục 12–24 dưới đây được suy ra từ phần còn lại của brief (component system, color tokens, screen matrix, wireframes, roadmap, QA, rủi ro). Mọi ràng buộc đọc được trong phần không bị cắt vẫn được áp dụng.

## Nhãn bằng chứng dùng trong tài liệu

| Nhãn | Ý nghĩa trong tài liệu này |
|---|---|
| `SOURCE VERIFIED` | Đọc trực tiếp trong mã nguồn của checkout hiện tại (HEAD `38c5fb6`, cây làm việc sạch lúc bắt đầu). |
| `CODE-INFERRED RISK` | Rủi ro suy ra từ mã, **chưa** tái hiện trên thiết bị. |
| `VISUALLY CONFIRMED` | **Không dùng** trong đợt này: checkout không có thư mục `docs/mobile-staff-owner/evidence/native/`, và `mobile/AGENTS.md` cấm tự chạy emulator/ADB/Metro. Không có nhận định nào dựa trên ảnh chụp. |
| `EXTERNAL RESEARCH` | Tài liệu công khai do brief cung cấp (Fresha, Booksy, Square, Android/Apple/React Native accessibility). Không truy cập lại trong phiên này; không suy diễn kiến trúc riêng của đối thủ. |
| `DESIGN HYPOTHESIS` | Đề xuất chuyên môn, chưa kiểm chứng bằng người dùng thật. |

## Ghi nhận tra cứu prompt library (theo `AGENTS.md`)

Root đã **bỏ qua** tra cứu `skills/prompts.chat` vì: (1) thư mục `skills/` **không tồn tại** trong checkout này; (2) brief đã cung cấp đầy đủ checklist, góc nhìn domain và cấu trúc đầu ra. Không có subagent nào được giao tra cứu. Không cài/tải thư viện prompt.

## Skills đã khảo sát

Môi trường hiện tại không có skill chuyên về thiết kế mobile/React Native (chỉ có skill artifact/dataviz/web). Không áp dụng skill landing-page cho app native. Tài liệu Expo SDK 57 được tham chiếu theo `mobile/AGENTS.md`; đợt này **không thêm dependency mới** (mục 7, 22).

---

## 1. Đánh giá tổng quan (Executive design assessment)

**Kết luận ngắn:** Nền tảng nghiệp vụ của BeautyBook mobile tốt hơn lớp giao diện của nó. Ba vai trò đã chạy trên API thật, với các cơ chế an toàn hiếm thấy (idempotency khi đặt lịch, fencing theo phiên, revision khi Staff thao tác, chặn tài chính cho Owner). Vấn đề chính nằm ở **hệ thống hiển thị phân tán** và **thứ bậc thông tin chưa đặt nhiệm vụ lên trước**.

### Điểm mạnh cần giữ — `SOURCE VERIFIED`
- Đặt lịch: snapshot payload + cùng `Idempotency-Key` khi thử lại; trạng thái “Chưa rõ kết quả đặt lịch”; kiểm tra lại giá trước khi gửi (`BookingScreen.tsx`).
- Phân biệt `PENDING`/`CONFIRMED` ở màn thành công (`BookingSuccessScreen.tsx`).
- Staff: projection công việc cá nhân, phân trang đầy đủ (`readWorkDay`), cổng thao tác một-lần-một-yêu-cầu (`createWorkGate`), không tự START/COMPLETE.
- Owner: không báo “không có việc” khi đang tải/lỗi; `MOBILE_FINANCE_REVIEW_REQUIRED`; chuyển sang web an toàn (`operationsWebUrl`).
- Thời gian dự kiến vs thực tế vs chưa biết được tách bạch (`bookingTiming.ts`, `bookingOperationalTime.ts`).

### Vấn đề thiết kế chính
1. **Không có design system:** 40+ file tự khai báo `StyleSheet` riêng; cỡ chữ 9–30px rải rác, 6 kiểu header khác nhau (header berry bo góc, header trắng, header nhúng ảnh), nút IN HOA lẫn chữ thường. `SOURCE VERIFIED`.
2. **Thứ bậc thông tin Customer:** Home đặt khối editorial cao 204dp trước lựa chọn thật; Venue mở tab “Thông tin” thay vì “Dịch vụ”; Booking hỏi giờ trước chuyên viên rồi xóa giờ khi đổi chuyên viên. `SOURCE VERIFIED` + `DESIGN HYPOTHESIS` về tác động.
3. **Staff/Owner dùng một kiểu nút cho mọi thứ:** `OperationButton` (nền hồng nhạt) dùng cho chọn chi nhánh, điều hướng ngày, phân trang, hành động chính — không phân biệt mức độ quan trọng. `SOURCE VERIFIED`.
4. **Trung thực dữ liệu:** một số chỗ hiển thị số giả định (rating `0.0` khi chưa có đánh giá; giá `FROM/RANGE` bị làm phẳng thành một số; “Tổng tiền” trước khi có price preview). `SOURCE VERIFIED`.

### Quy mô thay đổi đề xuất
**Thiết kế lại cấp sản phẩm, giữ nguyên hợp đồng:** token + bộ component dùng chung, tái cấu trúc bố cục mọi màn hình trong phạm vi, sắp lại thứ tự bước đặt lịch, sửa các điểm trình bày sai sự thật. Không đổi API, route name, quyền, hay nghiệp vụ.

### Tầm nhìn
> **Một thương hiệu, ba mật độ.** Khách hàng: ấm áp, gợi cảm hứng, nhưng lựa chọn thật xuất hiện ngay. Nhân viên: “Tôi đang làm gì, tiếp theo là gì?” trong một cái nhìn. Chủ doanh nghiệp: “Việc gì cần tôi quyết định?” trước mọi con số.

---

## 2. Kiểm kê hiện trạng mobile

### 2.1 Điều hướng và màn hình — `SOURCE VERIFIED`

| Shell | Tab / Stack | Màn hình | Đường vào thực tế |
|---|---|---|---|
| Root | `RootStack` | `MainTabs` / `Operations` / `UnsupportedWorkspace` theo `mobileShell(user)`; `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `OtpVerify` | Deep link `beautybook://reset-password`, `beautybook://verify-email` |
| Customer | `DiaDiem` (HomeStack) | `HomeMain`, `VenueDetail`, `ComboDetail`, `Booking`, `AddService`, `BookingSuccess` | Tab + điều hướng nội bộ |
| Customer | `TimKiem` | `SearchScreen` (+ modal lọc nội tuyến) | Tab, từ Home |
| Customer | `LichHen` (HoatDongStack) | `HoatDongMain`, `AppointmentDetail`, `CalendarView`, `Reschedule` | Tab |
| Customer | `TaiKhoan` (AccountStack) | `AccountMain`, `Favorites`, `Messages`, `Profile`, `Forms`, `Settings`, `Support`, `AddressForm`, `ChangePassword` | Tab |
| Staff | Tabs `Hôm nay`, `Lịch`, `Thông báo`, `Tài khoản` | `WorkList`, `WorkDetail`, `BookingWork` | Sau đăng nhập SALON có hồ sơ nhân viên |
| Owner | Stack `OwnerHome` (tabs `TongQuan`, `VanHanh`, `ThongBao`, `TaiKhoan`) + `OwnerRequest`, `OwnerImpact`, `OwnerBooking` | | Sau đăng nhập Owner |

**Route khai báo nhưng không có đường vào (đã kiểm tra bằng grep toàn `src/`):**
- `OtpVerify` — không có `navigate('OtpVerify')`; màn hình báo “Đã gửi lại mã”/“Thành công” bằng `Alert` mà **không gọi API**. Phân loại: *tính năng giả, không truy cập được*. → **Gỡ bỏ**.
- `Forms` — không có `navigate('Forms')`; màn trống mô tả “khai báo sức khỏe”. Phân loại: *placeholder không truy cập được*. → **Gỡ bỏ**.
- `FilterSheet`, `TimeFilterSheet` (mount trong `CustomerProviders`) — `openFilterSheet`/`openTimeSheet` **không được gọi ở đâu**. Bộ lọc thực tế là modal trong `SearchScreen`. → **Gỡ bỏ** cùng `FilterContext`, `TimeFilterContext`.

### 2.2 Token và kiểu hiển thị — `SOURCE VERIFIED`
- `constants/colors.ts`: 15 màu phẳng (berry `#8D315B`, cream `#FBF7F2`…), không có vai trò trạng thái, không có token chữ/khoảng cách/bo góc.
- Màu ngoài hệ thống xuất hiện trong file: `#422737`, `#F4E8E7`, `#E3F3FC`, `#FFF0F3`, gradient `#E8477B → #FF8FB3` ở `AuthScreenLayout` (hồng neon lệch hẳn tông berry), `placeholderPalette` 8 màu bão hòa.
- Cỡ chữ: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30 — **21 cỡ khác nhau**.
- Nhãn trạng thái dùng emoji (`😄🙂😐🙁`, `🗓️`, `💗`, `📋`) và ký tự `☑/☐` cho checkbox chính sách.

### 2.3 Trạng thái và trợ năng — `SOURCE VERIFIED`
- Nhiều nút thiếu `accessibilityRole`/`accessibilityLabel` (nút quay lại ở Booking, AddService, Profile…; nút bookmark ở ComboDetail).
- Vùng chạm nhỏ: nút quay lại 36–40dp (VenueDetail, ComboDetail, Booking), nút stepper 30–32dp, nút điều hướng tuần ở Booking chỉ có `hitSlop`.
- `RescheduleScreen` dùng “‹ Quay lại” dạng chữ, chip không có `accessibilityRole`.
- Không có skeleton; loading toàn màn dùng `ActivityIndicator` + chữ.

### 2.4 Phụ thuộc API theo màn — `SOURCE VERIFIED`
Home: `/services/search`, `/combos`, `/services/categories`, `/branches/:id` (ảnh 8 cơ sở đầu). Venue: `/branches/:id`, `/combos?branchId`, `/reviews/business/:id`. Booking: `/services?branchId`, `/staff/public`, `/bookings/available-slots`, `/bookings/preview-price`, `/bookings/self-booking-policy`, `POST /bookings` (Idempotency-Key). Lịch hẹn: `/bookings/my`, cancel / cancel-request / reschedule-request, `/platform-settings/public-policy`, `/reviews`. Staff: `/bookings/my-work-items`, `PATCH /bookings/:id/items/:itemId`. Owner: `/reports/owner-dashboard`, requests, impacts, unfinished, actual-time correction.

---

## 3. Vấn đề UX và cơ hội

| # | Vấn đề | Phân loại | Bằng chứng | Hướng xử lý | Lợi ích kỳ vọng / độ tin cậy |
|---|---|---|---|---|---|
| 3.1 | Home: khối editorial 204dp + lời chào 28px đẩy danh mục/cơ sở xuống | UX friction | `HomeScreen.tsx` `editorial.height: 204` | Bỏ khối editorial; lời chào 1 dòng; danh mục ngay dưới ô tìm kiếm | Lựa chọn thật hiện trong màn đầu · cao |
| 3.2 | Venue mở tab “Thông tin” mặc định | UX friction | `useState<TabKey>(… 'info')` | Mặc định “Dịch vụ” | Ít bước tới đặt lịch · trung bình |
| 3.3 | Rating `0.0` khi chưa có đánh giá (mapper gán `rating: 0`) | Trung thực dữ liệu | `mapBranchDetail` → `rating: 0`; `displayRating.toFixed(1)` | “Chưa có đánh giá” | Tránh hiểu sai · cao |
| 3.4 | Giá `FROM/RANGE/QUOTE` bị phẳng thành số cố định ở danh sách dịch vụ | Trung thực dữ liệu | `mapService` bỏ `priceDisplay`, `variants` | Giữ `priceDisplay`; nếu có biến thể → “Từ …”/“Theo lựa chọn”; QUOTE → “Cần tư vấn” | Tránh cam kết giá sai · cao |
| 3.5 | Booking hiển thị “Tổng tiền” trước khi có preview | Trung thực dữ liệu | `totalPrice = pricePreview?.finalAmount ?? localTotalPrice` | “Tạm tính” khi chưa có preview; “Tổng dự kiến” khi có | Cao |
| 3.6 | Booking: chọn giờ trước chuyên viên; đổi chuyên viên xóa giờ đã chọn | UX friction | `onSelect` staff → `setSelectedTime(null)` | Thứ tự Dịch vụ → Chuyên viên → Ngày → Giờ | Ít thao tác lặp · trung bình |
| 3.7 | Giờ trống định dạng theo múi giờ thiết bị; backend sinh slot theo `BOOKING_TIME_ZONE` (mặc định `Asia/Ho_Chi_Minh`) | `CODE-INFERRED RISK` | `toLocaleTimeString` không `timeZone`; `getHours()` chia Sáng/Chiều; `booking-datetime.ts` | Định dạng/nhóm theo `Asia/Ho_Chi_Minh` (khớp `mapBooking` đang dùng `+07:00`) | Đúng giờ khi thiết bị ở múi khác · cao |
| 3.8 | Review sheet luôn nói “Yêu cầu sẽ ở trạng thái chờ cơ sở xác nhận” | Trung thực | `reviewNote` | “Cơ sở có thể cần xác nhận trước khi lịch có hiệu lực” | Không hứa trước PENDING/CONFIRMED · cao |
| 3.9 | ComboDetail: nút bookmark chỉ là state cục bộ | Tính năng giả | `useState(false)` `isBookmarked` | Gỡ bỏ (không có API lưu combo) | Cao |
| 3.10 | VenueDetail: icon cờ “báo cáo” trên mỗi đánh giá không có hành động | Tính năng giả | `flag-outline` không `onPress` | Gỡ bỏ | Cao |
| 3.11 | FAQ nhắc tab “Hoạt động” (tab thật là “Lịch hẹn”) | Nội dung sai | `SupportScreen.tsx` | Sửa câu trả lời, phân biệt hủy ngay / yêu cầu hủy sát giờ | Cao |
| 3.12 | Search: kết quả dạng thẻ ảnh cao 145dp → ~2,5 kết quả mỗi màn | UX friction | `imageWrap.height: 145` | Thẻ ngang: ảnh 84dp + thông tin | Quét nhanh gấp đôi · `DESIGN HYPOTHESIS` |
| 3.13 | Search: bộ lọc đang bật chỉ hiển thị bằng một chấm | UX friction | `dot` | Hàng chip lọc có thể xóa từng chip | Trung bình |
| 3.14 | Staff: một kiểu nút cho chọn ngày/tuần/hành động | UX friction | `OperationButton` | Thanh ngày dạng dải 7 ngày; nút chính chỉ cho START/COMPLETE | Cao |
| 3.15 | Owner: bộ lọc chi nhánh + ngày + 3 nút chiếm đầu màn trước “Cần bạn xử lý” | UX friction | `OwnerFilters` đứng trước khối attention | Thanh ngữ cảnh gọn 1 hàng; khối “Cần bạn xử lý” lên đầu | Cao |
| 3.16 | Nhiều nút <48dp, thiếu nhãn trợ năng; emoji làm tín hiệu trạng thái | Accessibility | mục 2.3 | Component chuẩn ≥48dp, icon + chữ | Cao |
| 3.17 | Nhãn “Nhận khách” dễ nhầm với check-in (Staff không được check-in) | UX copy / an toàn | `actionLabel` | “Bắt đầu dịch vụ” | Giảm nhầm vai trò · trung bình |
| 3.18 | Thông báo Customer: đánh dấu đã đọc nhưng không cho biết có liên quan lịch nào | UX friction | `MessagesScreen` | Giữ hành vi (không tự mở `actionUrl`); thêm trạng thái chưa đọc rõ ràng, thời gian tương đối | Trung bình |

---

## 4. Nghiên cứu đối chiếu

Nguồn: `EXTERNAL RESEARCH` do brief cung cấp; không thử nghiệm trực tiếp trong phiên này.

| Nguồn | Quan sát được (tài liệu công khai) | Mẫu nên mượn | Vấn đề BeautyBook tương ứng | Điều chỉnh theo API/vai trò | Mẫu hấp dẫn nên **từ chối** |
|---|---|---|---|---|---|
| [Fresha — booking journey](https://www.fresha.com/help-center/knowledge-base/online-presence/102398-learn-how-clients-book-appointments-online) | Chọn dịch vụ → chuyên viên → giờ → xem lại → xác nhận | Tóm tắt nhất quán + cho phép sửa từng bước | Booking hiện là một trang dài không có tóm tắt | Một màn cuộn có các bước đánh số + thanh tóm tắt dính đáy; giữ một màn để không phá snapshot/idempotency | Chọn chuyên viên **theo từng dịch vụ** — API chỉ nhận một `staffId` |
| [Booksy — calendar & scheduling](https://biz.booksy.com/features/calendar-scheduling) | Trạng thái lịch trực quan, mở chi tiết từ lịch | Hàng agenda quét nhanh: giờ – khách – dịch vụ – trạng thái | Thẻ Staff cao, trạng thái chỉ là chữ | Hàng compact + pill trạng thái có icon | Kéo-thả đổi lịch, waitlist, lịch lặp — Staff không có quyền, sản phẩm đã loại |
| [Square — bookable team members](https://squareup.com/help/us/en/article/5350-create-staff-member-profiles-for-square-appointments) | Phân quyền lịch theo vai trò | Mỗi vai trò chỉ thấy cái quyền của mình cho phép | Staff không được xem toàn chi nhánh | Giữ projection cá nhân | Sao chép mô hình quyền của Square |
| [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views), [Apple HIG accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [RN accessibility](https://reactnative.dev/docs/accessibility) | 48×48dp / 44×44pt; hỗ trợ cỡ chữ lớn | Chuẩn vùng chạm, `accessibilityRole/State`, không tắt font scaling | Mục 2.3 | Token `touch.min = 48` | — |

Không bổ sung đối thủ khác (Treatwell, Vagaro…) vì không có quyết định cụ thể nào cần thêm bằng chứng ngoài các nguồn trên.

---

## 5. Ba hướng thị giác khác biệt

### Concept A — “Biên tập cao cấp” (Premium Beauty Editorial)
- **Triết lý:** tạp chí làm đẹp; mỗi màn là một trang báo. **Cảm xúc:** sang, chậm, tĩnh.
- **Màu:** mận đậm `#5C2340`, vàng đồng `#B08A4E`, giấy `#F7F1EA`, mực `#1E1418`.
- **Chữ:** serif hiển thị (Fraunces/Playfair) cho tiêu đề + sans cho thân; tiêu đề 32–40px.
- **Hình ảnh:** ảnh lớn tràn viền, tỉ lệ 4:5; nhiều khoảng trắng.
- **Bố cục:** một cột, nhịp chậm, ít thẻ, nhiều đường kẻ mảnh. **Điều hướng:** tab chữ không icon.
- **Chuyển động:** fade/parallax nhẹ; reduced-motion → tắt parallax.
- **Trợ năng:** tương phản cao; rủi ro chữ serif mảnh ở cỡ nhỏ và dấu tiếng Việt chồng tầng.
- **Hiệu năng:** cần font tùy chỉnh (thêm `expo-font` + asset) và ảnh lớn → nặng trên máy tầm trung.
- **Ưu:** khác biệt, cao cấp. **Nhược:** phụ thuộc ảnh thật mà nhiều cơ sở **chưa có**; không hợp Staff/Owner; ảnh minh họa AI phải gắn nhãn sẽ lộ rõ.
- **Phù hợp:** Customer 4/5 · Staff 1/5 · Owner 1/5. **Bản sắc berry:** thay bằng mận/vàng.

### Concept B — “Chợ dịch vụ sống động” (Modern Lifestyle Marketplace)
- **Triết lý:** năng động, nhiều lựa chọn, “lướt là thấy”. **Cảm xúc:** vui, trẻ, nhiều năng lượng.
- **Màu:** hồng tươi `#D0336C`, san hô `#E0624A`, teal `#0E7C7B`, tím `#7B5CC4`, nền trắng.
- **Chữ:** sans tròn, đậm; nhiều badge.
- **Hình ảnh:** ô danh mục màu khối, banner khuyến mãi, carousel tự chạy.
- **Bố cục:** nhiều rail ngang, lưới 2 cột, chip khắp nơi. **Điều hướng:** tab có icon đầy màu.
- **Chuyển động:** bounce, auto-carousel; reduced-motion → tắt auto-play.
- **Trợ năng:** hồng `#D0336C` chỉ đạt 4,80:1 trên trắng; san hô `#E0624A` 3,49:1 (chỉ dùng cho chữ lớn); nhiều màu cạnh tranh làm mờ tín hiệu trạng thái.
- **Hiệu năng:** nhiều rail + ảnh → nhiều render.
- **Ưu:** khám phá mạnh. **Nhược:** dễ “hồng khắp nơi”; khuyến mãi/banner **không có dữ liệu thật tương ứng**; quá ồn cho vận hành.
- **Phù hợp:** Customer 4/5 · Staff 2/5 · Owner 2/5. **Bản sắc berry:** thay bằng hồng tươi.

### Concept C — “Berry Clarity / Rõ ràng & ấm áp” (Contemporary Minimal Product, thương hiệu ấm)
- **Triết lý:** công cụ đáng tin cậy có cá tính; màu là tín hiệu, không là trang trí. **Cảm xúc:** bình tĩnh, ấm, chuyên nghiệp.
- **Màu:** giữ berry `#8D315B` làm **màu hành động duy nhất**, nền ngà `#FBF7F3`, mực tím-than `#2A1F26`, mận `#3A2232` cho bề mặt nhấn; bảng **màu trạng thái riêng** (mục 6) tách khỏi thương hiệu.
- **Chữ:** font hệ thống (Roboto/SF) — hỗ trợ dấu tiếng Việt đầy đủ, không tải font; thang 8 cấp.
- **Hình ảnh:** ảnh thật khi API có; minh họa AI chỉ ở danh mục, luôn gắn nhãn “Minh họa”; placeholder trung tính.
- **Bố cục:** lưới 4pt, lề 16dp, thẻ viền mảnh bo 16, danh sách dày vừa phải; Customer dùng nhịp thoáng hơn, Staff/Owner dày hơn trên cùng token.
- **Điều hướng:** tab bar thống nhất cho 3 vai trò: icon + nhãn, chỉ báo dạng viên thuốc nền `primarySoft`.
- **Chuyển động:** tối thiểu — phản hồi nhấn (đổi nền), sheet trượt native; không parallax, không auto-carousel; reduced-motion không cần nhánh riêng.
- **Trợ năng:** mọi cặp chữ/nền đạt ≥5,2:1 (mục 6); không dùng màu làm tín hiệu duy nhất.
- **Hiệu năng:** không dependency mới, không font tải về, ít bóng đổ.
- **Ưu:** hợp cả 3 mật độ; dễ bảo trì; trung thực với dữ liệu đang có. **Nhược:** nguy cơ “nhạt” ở Customer → bù bằng minh họa danh mục, thẻ lịch hẹn kế tiếp màu mận, và thẻ cơ sở có ảnh lớn khi có ảnh thật.
- **Phù hợp:** Customer 4/5 · Staff 5/5 · Owner 5/5. **Bản sắc berry:** **giữ và tiến hóa** (berry làm hành động, mận làm bề mặt nhấn, bỏ gradient hồng neon).

### So sánh song song

| Tiêu chí (trọng số) | A Editorial | B Marketplace | **C Berry Clarity** |
|---|---|---|---|
| Phù hợp Customer (20) | 16 | 16 | 15 |
| Phù hợp Staff (20) | 4 | 8 | **20** |
| Phù hợp Owner (15) | 3 | 6 | **15** |
| Trung thực với dữ liệu hiện có (15) | 6 | 5 | **14** |
| Trợ năng (10) | 7 | 5 | **10** |
| Chi phí/hiệu năng (10) | 4 | 6 | **10** |
| Kế thừa thương hiệu (10) | 5 | 4 | **9** |
| **Tổng /100** | 45 | 50 | **93** |

| Khía cạnh | A | B | C |
|---|---|---|---|
| Bố cục Home | Ảnh hero 4:5 + bài viết | Banner + lưới 2 cột | Tìm kiếm + danh mục + lịch kế tiếp + danh sách cơ sở |
| Chữ | Serif 40px | Sans tròn đậm 26px | Sans hệ thống 22–26px |
| Hình ảnh | Bắt buộc ảnh lớn | Màu khối + ảnh | Ảnh thật khi có, minh họa có nhãn |
| Thứ bậc | Cảm xúc trước | Khuyến mãi trước | Nhiệm vụ trước |

### Quyết định: **Concept C — Berry Clarity**
Lý do: là hướng duy nhất phục vụ tốt **cả ba** mật độ trên cùng một token; trung thực với dữ liệu thực tế (nhiều cơ sở chưa có ảnh, không có API banner/khuyến mãi toàn trang); không thêm dependency; giữ được nhận diện berry đã có trên web (`docs/design.md`).
**Mượn có kiểm soát:** từ A — một bề mặt mận đậm cho thẻ “Lịch hẹn kế tiếp” và lời chào tài khoản khách; từ B — rail danh mục có minh họa và rail gói dịch vụ. Không mượn: serif tải về, banner tự chạy, đa màu thương hiệu.
Không giả định mọi khách hàng nữ thích màu hồng: berry chỉ xuất hiện ở hành động/điểm nhấn; phần lớn diện tích là ngà, trắng, mực.

---

## 6. Hệ màu chi tiết

### 6.1 Bảng so sánh ba concept (HEX)

| Vai trò | A Editorial | B Marketplace | **C Berry Clarity** |
|---|---|---|---|
| primary | `#5C2340` | `#D0336C` | **`#8D315B`** |
| primaryPressed | `#45192F` | `#AE2657` | **`#70254A`** |
| primarySoft | `#F1E3EA` | `#FDE6EE` | **`#F7E8EF`** |
| secondary | `#B08A4E` | `#0E7C7B` | **`#3A2232`** (mận – bề mặt nhấn) |
| accent | `#B08A4E` | `#E0624A` | **`#A8472F`** (san hô – chỉ cho ưu đãi) |
| accent phụ | — | `#7B5CC4` | **`#3F6B5A`** (sage – chỉ cho xác nhận/thành công nhẹ) |
| background | `#F7F1EA` | `#FFFFFF` | **`#FBF7F3`** |
| elevatedSurface | `#FFFDF9` | `#FFFFFF` | **`#FFFFFF`** |
| cardSurface | `#FFFDF9` | `#FFFFFF` | **`#FFFFFF`** |
| border | `#E3D8CC` | `#EDE6EA` | **`#E7DCD8`** (trang trí) / **`#8C7F86`** (viền điều khiển) |
| headingText | `#1E1418` | `#1F1A1D` | **`#2A1F26`** |
| bodyText | `#3B3036` | `#33262E` | **`#4A3F46`** |
| secondaryText | `#6E6268` | `#6B6168` | **`#6B5F66`** |
| disabled | `#B5AAA0` | `#C9C1C6` | **`#857980`** chữ / **`#EFE8E5`** nền |
| success | `#3D6B4F` | `#1E8A5A` | **`#2E6A47`** |
| warning | `#8C6420` | `#B7791F` | **`#7A4E0A`** |
| error | `#9E2B2B` | `#D63A3A` | **`#A12A22`** |
| info | `#3B5B7A` | `#2D6FD6` | **`#255A86`** |
| onPrimary | `#FFFFFF` | `#FFFFFF` | **`#FFFFFF`** |

Concept A/B: chỉ các cặp ghi trong mục 5 đã được đo; các cặp còn lại `needs verification`.

### 6.2 Token đầy đủ cho Concept C

| Token | HEX | Ghi chú |
|---|---|---|
| inputBorder / focus | `#8C7F86` / `#8D315B` (viền 2dp khi focus) | viền điều khiển ≥3:1 |
| errorBorder | `#A12A22` | |
| tabActive / tabInactive | `#8D315B` / `#6B5F66` | chỉ báo nền `#F7E8EF` |
| chipSelected | nền `#3A2232`, chữ `#FFFFFF` | 14,44:1 |
| chipUnselected | nền `#FFFFFF`, viền `#8C7F86`, chữ `#2A1F26` | |
| skeletonBase / highlight | `#EFE8E5` / `#F7F2EF` | không animate khi reduced-motion |
| overlay | `rgba(42,31,38,0.48)` | scrim sheet |
| divider | `#EFE7E3` | |
| pressedSurface | `#F3ECE7` | phản hồi nhấn cho hàng/thẻ |

### 6.3 Cặp trạng thái (foreground/background) — luôn kèm **icon + chữ**

| Trạng thái | Chữ | Nền | Icon (Ionicons) | Tương phản |
|---|---|---|---|---|
| Chờ xác nhận (`PENDING`) | `#7A4E0A` | `#FBF0DA` | `time-outline` | 6,36:1 |
| Đã xác nhận (`CONFIRMED`) | `#255A86` | `#E6EFF8` | `checkmark-circle-outline` | 6,26:1 |
| Khách đã đến (`CHECKED_IN`) | `#1F6B5C` | `#E0F2ED` | `enter-outline` | 5,46:1 |
| Đang thực hiện (`IN_PROGRESS`) | `#8D315B` | `#F7E8EF` | `play-circle-outline` | 6,52:1 |
| Hoàn thành (`COMPLETED`) | `#2E6A47` | `#E4F2E8` | `checkmark-done-outline` | 5,56:1 |
| Đã hủy / Hết hạn | `#5E545A` | `#EEE8E6` | `close-circle-outline` / `hourglass-outline` | 5,99:1 |
| Từ chối / Không đến | `#A12A22` | `#FBE7E4` | `alert-circle-outline` | 6,15:1 |
| Yêu cầu chờ Owner | `#55468A` | `#EEEAF8` | `swap-horizontal-outline` | 6,75:1 |
| Ngoại lệ vận hành / quá giờ | `#7A4E0A` | `#FBF0DA` | `warning-outline` | 6,36:1 |

**Phương pháp đo:** công thức độ chói tương đối WCAG 2.x (sRGB tuyến tính hóa, `(L1+0.05)/(L2+0.05)`) chạy bằng script Node trong phiên làm việc; kết quả chép nguyên. Chưa kiểm tra trên màn hình vật lý.

### 6.4 Phân vai màu
- **Khám phá (Customer):** berry cho CTA và lựa chọn; mận cho thẻ lịch kế tiếp; san hô chỉ cho nhãn “Ưu đãi/giảm giá”; minh họa danh mục mang màu ảnh.
- **Vận hành (Staff/Owner):** gần như đơn sắc (ngà/trắng/mực); màu chỉ xuất hiện ở pill trạng thái, cảnh báo và **một** nút chính mỗi thẻ.
- **Quy tắc tiết chế:** mỗi màn tối đa một nút nền berry đặc trong vùng nhìn thấy; các hành động phụ dùng tonal (`primarySoft`) hoặc outline.
- **Trạng thái tương tác native:** pressed = đổi nền (`pressedSurface`/`primaryPressed`), focus = viền 2dp berry; không mô phỏng hover.
- **Dark mode:** ngoài phạm vi đợt này (`app.json` đặt `userInterfaceStyle: "light"`); token đặt tên theo vai trò để thêm sau.

---

## 7. Typography

**Quyết định:** dùng **font hệ thống** (Roboto trên Android, SF Pro trên iOS).
- Phủ đủ dấu tiếng Việt (kể cả dấu chồng `ặ, ỗ, ữ`), không cần license, không cần `expo-font`, không nhảy layout khi tải.
- Web dùng Be Vietnam Pro (`docs/design.md`). Đồng bộ font với web là **bước 2 tùy chọn**: cần thêm `expo-font` + `@expo-google-fonts/be-vietnam-pro` (OFL), xử lý splash chờ font, và QA trên thiết bị — không làm trong đợt này vì không được tự chạy thiết bị để nghiệm thu.

| Vai trò | Font | Cỡ | Weight | Line height | Letter spacing | Dùng cho |
|---|---|---|---|---|---|---|
| Display | System | 28 | 700 | 34 | -0.3 | Lời chào tài khoản khách, tên khách đang phục vụ (Staff) |
| H1 | System | 24 | 700 | 30 | -0.2 | Tiêu đề màn tab |
| H2 | System | 20 | 700 | 26 | 0 | Tên cơ sở, tiêu đề khối |
| H3 | System | 17 | 600 | 23 | 0 | Tiêu đề thẻ, tên dịch vụ |
| Body | System | 16 | 400 | 24 | 0 | Nội dung |
| Body strong | System | 16 | 600 | 24 | 0 | Giá trị nhấn |
| Secondary | System | 14 | 400 | 20 | 0 | Meta, địa chỉ |
| Caption | System | 12 | 500 | 16 | 0.2 | Nhãn phụ, “Minh họa” (tối thiểu 12) |
| Button | System | 16 | 600 | 22 | 0 | Nút (chữ thường câu, không IN HOA) |
| Tab | System | 12 | 600 | 16 | 0.1 | Nhãn tab |
| Numeric/Data | System | 26 | 700 | 32 | -0.2 | Số liệu Owner, giờ Staff; `fontVariant: ['tabular-nums']` |
| Overline | System | 12 | 700 | 16 | 0.4 | Nhãn nhóm (chữ thường câu) |

- **Customer** dùng H1/H2 thoáng; **Staff/Owner** dùng H3/Body dày hơn nhưng không nhỏ hơn 14 cho thông tin vận hành.
- Giờ/thời lượng/số liệu dùng `tabular-nums` để cột giờ thẳng hàng.
- Tên dài/địa chỉ nhiều dòng: **không** `numberOfLines` cho tên khách/dịch vụ trong Staff (đã có test), thẻ Customer cho phép 2 dòng tên.
- Không tắt `allowFontScaling`; mọi container dùng `minHeight` thay vì `height`.

---

## 8. Layout & design tokens (TypeScript-ready)

```ts
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, sheet: 24, pill: 999 };
export const layout = {
  gutter: 16,            // lề trang mọi vai trò
  sectionGap: 28,        // Customer; Staff/Owner dùng 20
  cardPadding: 16,
  touch: 48,             // vùng chạm tối thiểu (Android 48dp ≥ iOS 44pt)
  buttonMinHeight: 52, buttonCompactMinHeight: 48, inputMinHeight: 52,
  iconSm: 16, iconMd: 20, iconLg: 24,
  headerMinHeight: 56, tabBarMinHeight: 64,
};
export const elevation = {
  none: {},
  card: { shadowColor: '#2A1F26', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  raised: { shadowColor: '#2A1F26', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -2 }, elevation: 6 },
};
```

- **Min vs fixed:** mọi nút/ô nhập/hàng dùng `minHeight`; chỉ ảnh/thumbnail dùng chiều cao cố định.
- **Header:** nền `background`, không bo góc, nút quay lại 48×48, tiêu đề H3 canh giữa (stack) hoặc H1 trái (tab).
- **Tab bar:** nền trắng, viền trên `divider`, chỉ báo viên thuốc 56×32 nền `primarySoft` sau icon đang chọn; chiều cao = `max(64, 30 + 36×fontScale + insetBottom)` (giữ công thức Staff/Owner hiện có).
- **Sheet:** bo 24 góc trên, tay nắm 36×4, tiêu đề + nút đóng 48, `maxHeight: 88%`, đáy theo safe area.
- **Sticky CTA:** thanh đáy trắng, `elevation.raised`, padding 16, tôn trọng `insets.bottom`.
- **Bàn phím:** `KeyboardAvoidingView` (iOS `padding`) + `keyboardShouldPersistTaps="handled"` cho form.
- **Mật độ theo vai trò:** cùng token; Customer `sectionGap 28`, ảnh lớn hơn; Staff/Owner `sectionGap 20`, hàng compact 72dp tối thiểu.
- **Lưới/carousel:** rail ngang `gap 12`, padding ngang = gutter, thẻ rail 148–240dp.

---

## 9. Thiết kế lại Customer

### 9.1 Home — thứ tự khối (viewport 390dp)

| # | Khối | Chiều cao ước tính | Quyết định |
|---|---|---|---|
| 1 | Thanh đầu: wordmark “BeautyBook” (H2) + chip khu vực | 56 | Giữ, gọn |
| 2 | Lời chào 1 dòng (“Hôm nay bạn muốn chăm sóc gì?”) | 30 | **Thu gọn** từ 28px/2 dòng |
| 3 | Ô tìm kiếm (giả) 52dp → tab Tìm kiếm | 52 | Giữ |
| 4 | Thẻ “Lịch hẹn kế tiếp” (nếu có dữ liệu thật) nền mận, pill trạng thái thật | ~92 | **Mở rộng** (trước chỉ là thẻ hồng nhạt) |
| 5 | Rail danh mục: ô 104×120 có minh họa + nhãn “Minh họa” | 136 | Giữ, **thu nhỏ** |
| 6 | “Cơ sở đang nhận lịch”: thẻ ảnh 16:9 (ảnh thật) hoặc thẻ không ảnh gọn | — | Giữ, thẻ không ảnh thu còn 1 dòng placeholder |
| 7 | Rail “Gói dịch vụ” với giá thật | — | Giữ |
| — | Khối editorial “Chọn khoảng thời gian cho mình” 204dp | — | **Gỡ** (không mang lựa chọn thật) |

Màn đầu (≈ 56+30+52+92+136 ≈ 390dp dưới status bar) chứa: tìm kiếm, lịch kế tiếp, danh mục, và đầu danh sách cơ sở. `DESIGN HYPOTHESIS`.

### 9.2 Search
- **Bố cục chọn:** “thanh tìm kiếm cố định + hàng chip lọc + danh sách thẻ ngang” (so với lưới ảnh 2 cột: loại vì tên dịch vụ tiếng Việt dài bị cắt).
- Chip lọc: `Khu vực`, `Sắp xếp`, `Loại dịch vụ`, `Đánh giá`, `Giá`. Chip đang bật → nền mận + nút ✕ xóa riêng; “Xóa tất cả” khi ≥1 lọc.
- Mọi lọc gửi lên server (`servicesApi.search`) — giữ `useServiceSearch` (debounce 250ms, fence theo query key; trang tiếp bỏ qua khi query đổi).
- Thẻ kết quả: minh họa 84×84 (nhãn “Minh họa”), loại dịch vụ, tên (2 dòng), cơ sở · quận, giá + thời lượng, nút lưu 48dp.
- Segmented “Dịch vụ | Chuyên viên” giữ nguyên ngữ nghĩa (chuyên viên từ 8 cơ sở đầu kết quả, có ghi chú).
- Rỗng / lỗi / đang tải phân biệt; không có lịch sử tìm kiếm (không có persistence hợp lệ).

### 9.3 Venue detail
- Ảnh thật 240dp (carousel không tự chạy) hoặc khối không ảnh 120dp; nút quay lại 48dp trên scrim.
- Khối tiêu đề: tên (H1), loại dịch vụ, **rating chỉ khi có đánh giá** (“★ 4,6 · 12 đánh giá”), địa chỉ, giờ mở cửa hôm nay.
- Hàng hành động có nhãn: `Gọi`, `Zalo`, `Chỉ đường` (thay 3 icon trơn ở thanh đáy).
- Tab dính: **Dịch vụ (mặc định)** · Thông tin · Ưu đãi · Đánh giá.
- Dịch vụ: nhóm theo danh mục; hàng chọn kiểu checkbox (vùng chạm cả hàng), giá đúng ngữ nghĩa (mục 3.4), thời lượng, nút “Lưu” nhỏ có nhãn.
- Đánh giá: phân bố sao bằng thanh ngang + số đếm (bỏ emoji); bỏ icon cờ không hoạt động.
- Thanh đáy: “N dịch vụ · Tạm tính X” + `Tiếp tục đặt lịch`; khi chưa chọn: “Chọn dịch vụ để đặt lịch” (disabled).

### 9.4 Service & combo
- Combo: tiêu đề, cơ sở, giá combo + giá gốc gạch (nếu khác), các bước, điều khoản, thẻ cơ sở (rating chỉ khi >0).
- **Gỡ bookmark cục bộ** (không có hợp đồng lưu combo).
- Không có “sheet dịch vụ” riêng: chọn dịch vụ trực tiếp trong tab Dịch vụ là đủ.

### 9.5 Booking — so sánh luồng

| Hiện tại | Đề xuất | Lý do |
|---|---|---|
| Chi nhánh → Ngày → Giờ → Chuyên viên → Dịch vụ → Khuyến mãi → Ghi chú | ① Dịch vụ đã chọn (+ biến thể, + thêm dịch vụ) → ② Chuyên viên → ③ Ngày → ④ Giờ → ⑤ Ưu đãi & ghi chú → Thanh đáy → Sheet xem lại | Biến thể/chuyên viên ảnh hưởng giờ trống; chọn trước để không xóa giờ |
| Header berry bo góc | Header sáng thống nhất | Nhất quán |
| “Tổng tiền” | “Tạm tính” (chưa có preview) / “Tổng dự kiến” (có preview) | Trung thực |
| Checkbox `☑/☐` dạng nút outline | Hàng checkbox `accessibilityRole="checkbox"` | Trợ năng |
| “XEM LẠI ĐẶT LỊCH” | “Xem lại đặt lịch” | Không IN HOA |

- **Một màn cuộn** (không tách nhiều màn): giữ nguyên snapshot/idempotency, `usePreventRemove`, và các test hành vi.
- Đăng nhập giữa chừng: giữ `navigationRef.navigate('Login', { returnTo: 'previous' })`; form không mất vì màn Booking vẫn trong stack.
- Thành công: `PENDING` → “Đã gửi yêu cầu đặt lịch”; `CONFIRMED` → “Lịch hẹn đã được xác nhận”; khác → “Lịch hẹn đã được ghi nhận”.
- Kết quả chưa rõ: khối cảnh báo vàng ở thanh đáy + “Xem lịch hẹn của tôi” + “Thử lại yêu cầu đã gửi” (cùng key/payload).
- Không thêm lưu nháp: chưa có cơ chế cô lập theo tài khoản; rủi ro rò dữ liệu giữa phiên.

### 9.6 Lịch hẹn
- Segmented `Sắp tới | Lịch sử` + nút `Xem theo lịch` (icon + nhãn).
- Thẻ kế tiếp (mận) với đếm ngày; `PENDING` → “Chờ cơ sở xác nhận”; quá giờ mà chưa xử lý → “Quá giờ hẹn · chờ cập nhật” (**không** coi là hoàn thành).
- Thẻ danh sách: pill trạng thái có icon, cơ sở, dịch vụ, giờ, chuyên viên, giá.
- Chi tiết: khối trạng thái + mã lịch; thông tin; tiến trình từng dịch vụ (dự kiến vs thực tế); nhóm hành động theo ngữ cảnh: `Yêu cầu đổi lịch`, `Hủy lịch` (≥ mốc giờ miễn phí) **hoặc** `Gửi yêu cầu hủy sát giờ`, `Viết đánh giá`, `Đặt lại`, `Chỉ đường`.
- Đổi lịch: giải thích “Lịch hiện tại giữ nguyên tới khi cơ sở duyệt”; dải 7 ngày + lưới giờ theo `Asia/Ho_Chi_Minh`.

### 9.7 Tài khoản / xác thực
- Khách vãng lai: thẻ mận giới thiệu + `Đăng nhập`, `Tạo tài khoản`, `Trung tâm hỗ trợ`.
- Đăng nhập: giữ thứ tự gửi credential trước, chỉ hiện chọn không gian/doanh nghiệp khi server trả challenge.
- `AuthScreenLayout`: bỏ gradient hồng neon; header mận đặc, wordmark, nút quay lại 48dp.
- `TextField` dùng chung: nhãn hiển thị, lỗi inline, nút hiện/ẩn mật khẩu 48dp có nhãn trợ năng, `textContentType`/`autoComplete`.
- Hồ sơ, địa chỉ, đổi mật khẩu: cùng TextField; giới tính dùng chip `Nữ/Nam/Khác` (giá trị `FEMALE/MALE/OTHER` đúng hợp đồng `updateProfile`).
- Mục yêu thích = **dịch vụ đã lưu** (đổi nhãn “Dịch vụ đã lưu”).
- Thông báo (`Messages`) = **thông báo**, không phải chat.
- Yêu cầu xóa tài khoản: backend còn endpoint `/privacy/data-requests` → giữ hành vi, hạ mức nhấn, sửa lời: “Gửi yêu cầu xóa tài khoản” và mô tả là *yêu cầu chờ xử lý*. **Câu hỏi mở cho chủ sản phẩm** (mục 24).
- `OtpVerify`, `Forms`: gỡ (mục 2.1).

---

## 10. Thiết kế lại Staff

**Câu hỏi trung tâm:** “Tôi đang làm gì, tiếp theo là gì?”

### 10.1 Thứ bậc màn “Hôm nay”
1. Thanh ngữ cảnh 1 hàng: chi nhánh (nhấn để đổi nếu >1) · ngày theo múi giờ chi nhánh.
2. Thông báo kết quả thao tác / lỗi / dữ liệu cũ (nếu có).
3. **Đang thực hiện** — mọi item `IN_PROGRESS` (không gộp), item đầu nhấn mạnh.
4. **Tiếp theo** — item đủ điều kiện START trước, nếu không thì item sớm nhất.
5. **Còn lại hôm nay** — hàng compact.
6. **Đã kết thúc** — hàng compact, chữ phụ.

### 10.2 Thẻ đang thực hiện
Viền trái berry 4dp, nền `primarySoft`: tên khách (Display 28 cho thẻ đầu, H2 cho thẻ sau), dịch vụ, pill “Đang thực hiện”, giờ dự kiến `HH:mm – HH:mm` (tabular), **thời gian thực tế đã trôi** chỉ khi có `actualStartedAt` từ lifecycle, cảnh báo quá giờ, nút chính `Hoàn tất` (có xác nhận nêu tên dịch vụ + khách), liên kết `Chi tiết`.

### 10.3 Thẻ tiếp theo
Tên khách, dịch vụ, giờ dự kiến, **tình trạng đến** (pill “Khách đã đến” / “Chưa ghi nhận khách đến”), nút `Bắt đầu dịch vụ` **chỉ khi** `actionFor()` = START (tức khách đã check-in, đúng phân công, `canStart`, revision hợp lệ). Chưa đến → không có nút, kèm dòng “Chờ quầy ghi nhận khách đến”. Server vẫn có thể từ chối; lỗi 400/409 hiển thị nguyên văn + đã đọc lại.

### 10.4 Agenda (tab “Lịch”)
So sánh: danh sách agenda (đơn giản), timeline giờ (cần dữ liệu lấp đầy), lịch ngày dạng lưới (quá dày cho mobile), dải tuần + agenda (lai). **Chọn: dải 7 ngày + agenda.** Dải ngày dạng chip 48dp (Th2 05), nút `Tuần trước`/`Tuần sau` dạng icon 48dp có nhãn trợ năng, nút `Hôm nay`. Ngày theo múi giờ chi nhánh; thiếu múi giờ → trạng thái chặn có giải thích.

### 10.5 Chi tiết & ngoại lệ
Chi tiết: thẻ trạng thái + 3 khối “Thời gian dự kiến”, “Thời gian thực tế”, “Lịch hẹn” (mã lịch, ngày, giờ hẹn). Ngoại lệ đều đã có trong logic (`workError`, `createWorkGate`): sai phân công/404, mất quyền 401/403, xung đột revision 409, mạng chưa rõ → khóa thao tác tới khi đọc lại thành công. Không thêm ca làm, lương, hoa hồng, xếp hạng.

### 10.6 Tình huống bắt buộc: dịch vụ dự kiến 22:00–22:30, lúc 22:52 vẫn chưa bắt đầu
- UI hiển thị trên thẻ: pill trạng thái thật (“Chưa ghi nhận khách đến” hoặc “Khách đã đến”), giờ “Dự kiến 22:00 – 22:30”, và cảnh báo vàng **“Quá giờ dự kiến — cần kiểm tra”** (`operationalTimeLabel`, tính bằng đồng hồ server + monotonic).
- **Ai hành động được:** nếu khách đã check-in và server cho `canStart` → Staff được giao bấm `Bắt đầu dịch vụ`; ứng dụng hiện hộp thoại “Bắt đầu muộn?” giải thích giờ thực tế ghi từ máy chủ, giờ dự kiến giữ nguyên, máy chủ sẽ từ chối nếu trùng lịch. Nếu khách chưa đến → Staff **không** có nút; quầy/Owner xử lý (check-in, no-show, hủy, đổi lịch qua quy trình của họ).
- **Vì sao không tự động:** quá giờ không chứng minh khách vắng, dịch vụ đã làm hay đã xong; tự START/COMPLETE/NO_SHOW/CANCEL hoặc điền giờ thực tế từ giờ dự kiến sẽ tạo dữ liệu kiểm toán sai. Giờ thực tế để trống (`UNKNOWN`) cho tới khi có sự kiện lifecycle hoặc hiệu chỉnh có quyền.

---

## 11. Thiết kế lại Owner

**Câu hỏi trung tâm:** “Việc gì cần tôi quyết định?”

### 11.1 Màn đầu “Tổng quan”
1. Thanh ngữ cảnh 1 hàng: chi nhánh ▾ · ngày ‹ › (mở sheet chọn ngày) — thay 5 nút chồng.
2. **Khối “Cần bạn xử lý”** (đầu tiên): số yêu cầu đổi/hủy chờ + số ảnh hưởng vận hành chưa đóng; nút `Xem việc cần xử lý`. Đang tải → “Đang cập nhật…”, lỗi → thông báo lỗi; **không bao giờ** hiện “Không có việc chờ xử lý” khi chưa biết.
3. Trạng thái hồ sơ doanh nghiệp (chỉ khi chưa APPROVED hoặc bị hạn chế).
4. Số liệu ngày: `Lịch hẹn` / `Lịch hoàn tất` (đếm **lịch**, không phải dịch vụ) + pill phân bố trạng thái.
5. Tình hình chi nhánh: số lịch, số hoàn tất, số mục cần xử lý của **đúng chi nhánh**, “N hồ sơ nhân viên hoạt động · Không phải số người đang trong ca”.

### 11.2 Tab “Vận hành”
Thanh chi nhánh; “Lịch chưa kết thúc” (gồm ngày trước, phân trang 20/trang, ghi rõ “Trang X · tổng Y lịch” — không gọi là tổng toàn hệ thống nếu đang lọc chi nhánh); danh sách yêu cầu (pill tím) và ảnh hưởng (pill vàng, viền trái) phân biệt hình thức.

### 11.3 Chi tiết
- Yêu cầu: “Trước khi thay đổi” / “Sau khi duyệt”, ghi chú, `Duyệt yêu cầu` / `Từ chối yêu cầu` qua bước xác nhận hai lớp (`ReviewAction`). Hủy sát giờ hợp lệ không được từ chối.
- Lịch hẹn: tiến trình dịch vụ, dự kiến vs thực tế, hiệu chỉnh thời gian thực tế **chỉ khi** `canCorrectActualTime` (có lý do, revision, lịch sử); thao tác ngoại lệ (xác nhận/từ chối/check-in) thu gọn sau nút “Thao tác khác”.
- Ảnh hưởng: từng lịch xử lý riêng; đóng case khi server báo `READY_TO_COMPLETE`.
- Tài chính: giữ chặn `MOBILE_FINANCE_REVIEW_REQUIRED`, liên kết `Tiếp tục trên phiên bản quản trị` (không gắn token vào URL).
- Chế độ “Công việc của tôi”: chỉ hiện khi có StaffProfile ACTIVE trong phạm vi; Owner không cần StaffProfile để vào quản trị.

### 11.4 Cửa sổ ngày và phân trang
Tổng quan = **một ngày** theo múi giờ chi nhánh tham chiếu. Vận hành = **mọi ngày còn hiệu lực** cho yêu cầu/ảnh hưởng; “Lịch chưa kết thúc” = phân trang server. Nhãn mỗi khối ghi rõ cửa sổ của nó.

---

## 12. Hệ thống component dùng chung (`mobile/src/ui/`)

| Component | Thay thế | API chính | Trạng thái |
|---|---|---|---|
| `theme` (`src/theme/index.ts`) | `constants/colors.ts` rời rạc | `colors`, `space`, `radius`, `type`, `layout`, `elevation`, `statusTone` | Module thuần TS (test nạp được) |
| `AppButton` | 15+ kiểu nút tự chế | `variant: primary/tonal/outline/ghost/danger`, `size`, `icon`, `loading`, `disabled`, `accessibilityLabel` | default/pressed/disabled/loading |
| `IconButton` | nút icon 36–40dp | 48×48, `accessibilityLabel` bắt buộc | |
| `ScreenHeader` | 6 kiểu header | `title`, `onBack`, `right`, `large` | |
| `Card` | nhiều `card` style | `padded`, `tone`, `onPress` (pressable) | |
| `StatusPill` | badge màu rời | `tone`, `label`, `icon` | luôn có chữ + icon |
| `Notice` | chữ lỗi đỏ rải rác | `tone: info/warning/error/success`, `title`, `children`, `action` | `accessibilityLiveRegion` |
| `EmptyState` | emoji + chữ | `icon`, `title`, `body`, `action` | |
| `LoadingState` / `SkeletonBlock` | spinner toàn màn | | tĩnh khi reduced-motion |
| `ListRow` | hàng menu tự chế | `icon`, `label`, `detail`, `danger`, `chevron` | |
| `Chip` | chip tự chế | `selected`, `onRemove`, `icon` | `accessibilityState.selected` |
| `Segmented` | 3 kiểu tab con | `options`, `value`, `onChange` | `accessibilityRole="tab"` |
| `SectionHeader` | | `title`, `action` | |
| `TextField` | `AuthField` + input rời | `label`, `error`, `helper`, `password`, `icon` | focus/error |
| `BrandTabBar` | `CustomTabBar` + tab Staff/Owner | cấu hình route → nhãn/icon | |
| `SheetModal` | 4 kiểu sheet | `visible`, `title`, `onClose`, `footer` | |

Màn hình bị test “ghim” (`BookingScreen`, `BookingSuccessScreen`, `AppointmentDetailScreen`, `OwnerOverview`, `WorkCard`) dùng primitive RN + token theme để giữ nguyên cách test duyệt cây; test chỉ được bổ sung mock cho module theme mới.

---

## 13. Kiến trúc thông tin & điều hướng

- Giữ nguyên **tên route**, tham số, stack và deep link (`reset-password`, `verify-email`). Gỡ `OtpVerify`, `Forms` (không có đường vào).
- Customer 4 tab giữ nhãn: Khám phá · Tìm kiếm · Lịch hẹn · Tài khoản. Ẩn tab bar trong luồng sâu (giữ danh sách `HIDDEN_ROUTES`).
- Staff 4 tab, Owner 4 tab giữ nguyên; tab bar dùng chung `BrandTabBar`.
- Back stack: header thống nhất, nút quay lại luôn có; Booking chặn rời khi đang gửi/chưa rõ kết quả (giữ `usePreventRemove`).
- Bỏ `TAB_BAR_CLEARANCE = 100` (tab bar tùy biến nằm trong flow, không phủ nội dung) → 24.

## 14. Hình ảnh, minh họa & icon
- Ảnh cơ sở/chuyên viên **chỉ** từ API. Minh họa AI trong `assets/illustrations` giữ nhãn “Minh họa” (12px, tương phản ≥4,5:1 trên scrim).
- Không ảnh → khối trung tính `surfaceMuted` + icon `storefront-outline` + “Cơ sở chưa cập nhật ảnh”. Bỏ `PlaceholderCover` đa màu bão hòa cho combo; dùng khối mận nhạt với tên viết tắt.
- Icon: Ionicons outline mặc định, filled cho trạng thái chọn; luôn kèm chữ ở thanh hành động.
- Không thêm asset mới trong đợt này.

## 15. Chuyển động & phản hồi
- Nhấn: đổi nền `pressedSurface` hoặc `primaryPressed` (không dùng opacity 0.65 cho nút chính để tránh trông như disabled).
- Sheet: `animationType="slide"` native. Không carousel tự chạy (bỏ auto-scroll 3,5s của `BannerCarousel`) — giảm chuyển động không mong muốn, hỗ trợ reduced-motion mặc định.
- Bộ đếm thời gian thực tế Staff giữ tick 1s chỉ trên thẻ đang chạy.

## 16. Trợ năng
- Vùng chạm ≥48dp (token `layout.touch`); `hitSlop` chỉ là bổ sung.
- Mọi điều khiển có `accessibilityRole`, `accessibilityLabel` (khi chỉ có icon), `accessibilityState` (selected/checked/disabled/busy).
- Tín hiệu trạng thái: chữ + icon + màu.
- Font scaling bật; layout dùng `minHeight`, `flexWrap`, `flexShrink`.
- Thông báo lỗi/kết quả dùng `accessibilityLiveRegion="polite"`; tiêu đề màn có `accessibilityRole="header"`.

## 17. Nội dung tiếng Việt (UX copy)
- Chữ thường câu cho nút (“Xác nhận đặt lịch”), không IN HOA cả câu.
- Động từ rõ: “Bắt đầu dịch vụ”, “Hoàn tất”, “Gửi yêu cầu hủy sát giờ”, “Tiếp tục trên phiên bản quản trị”.
- Không hứa vượt dữ liệu: “Tạm tính”, “Chưa có đánh giá”, “Cơ sở có thể cần xác nhận”, “Chưa rõ kết quả đặt lịch”.
- Thống nhất thuật ngữ: Lịch hẹn (không “Hoạt động”/“cuộc hẹn”), Dịch vụ đã lưu, Chuyên viên, Chi nhánh, Thông báo.

## 18. Trạng thái tải / rỗng / lỗi / ngoại tuyến / chưa rõ
| Trạng thái | Mẫu | Ví dụ |
|---|---|---|
| Tải lần đầu | `LoadingState` (skeleton đơn giản hoặc spinner + mô tả) | Home, Lịch hẹn |
| Đang làm mới | `RefreshControl` + giữ dữ liệu cũ, có dòng “Đang cập nhật…” | Staff, Owner |
| Rỗng | `EmptyState` có lý do + hành động | “Chưa có lịch hẹn sắp tới” → Tìm dịch vụ |
| Lỗi | `Notice tone=error` + `Thử lại` | không biến lỗi thành 0 |
| Một phần | `Notice tone=warning` | Venue: “Chưa tải được một phần ưu đãi hoặc đánh giá” |
| Chưa rõ kết quả | `Notice tone=warning` + hành động kiểm tra | Booking, Staff action |
| Dữ liệu cũ | “Theo lần cập nhật gần nhất” | Staff timer khi mất kết nối |

## 19. Hiệu năng (máy tầm trung)
- Không thêm dependency, không font tải về, giảm bóng đổ (chỉ thanh đáy và thẻ nổi).
- Danh sách dài dùng `FlatList` (Search, Staff, Owner); Home giữ `ScrollView` vì ≤8 cơ sở + ≤6 combo.
- Ảnh rail cố định kích thước để tránh relayout; không auto-carousel.
- Token là hằng số module, `StyleSheet.create` một lần.

## 20. Ma trận màn hình

| Màn | Vai trò | Hành động | Ghi chú triển khai |
|---|---|---|---|
| Home | C | Tái bố cục | bỏ editorial, thẻ lịch kế tiếp mận |
| Search + sheet lọc | C | Tái bố cục | chip lọc, thẻ ngang |
| VenueDetail | C | Tái bố cục + sửa trung thực | tab Dịch vụ mặc định, rating thật, giá ngữ nghĩa |
| ComboDetail | C | Tái bố cục + gỡ bookmark giả | |
| Booking | C | Tái bố cục, đổi thứ tự bước, sửa nhãn giá, sửa múi giờ | test ghim |
| AddService | C | Tái bố cục | hàng checkbox |
| BookingSuccess | C | Tái bố cục | test ghim |
| Lịch hẹn / Lịch theo tháng / Chi tiết / Đổi lịch | C | Tái bố cục | Chi tiết test ghim |
| Tài khoản / Hồ sơ / Địa chỉ / Đổi mật khẩu / Cài đặt / Hỗ trợ / Dịch vụ đã lưu / Thông báo | C | Tái bố cục, sửa FAQ | |
| Login / Register / Forgot / Reset / VerifyEmail | C | Layout auth mới, TextField | |
| OtpVerify, Forms | C | **Gỡ** | không có đường vào, giả |
| FilterSheet, TimeFilterSheet | C | **Gỡ** | không được mở |
| Staff Hôm nay / Lịch / Chi tiết / BookingWork | S | Tái bố cục | WorkCard test ghim |
| Thông báo vận hành | S/O | Tái bố cục | |
| Tài khoản vận hành | S/O | Tái bố cục | |
| Owner Tổng quan | O | Tái bố cục, thanh ngữ cảnh | test ghim |
| Owner Vận hành / Yêu cầu / Lịch / Ảnh hưởng / Hiệu chỉnh giờ | O | Tái bố cục | |
| UnsupportedWorkspace | R/PA | Tái bố cục | giữ giới hạn |

## 21. Wireframe chính (390dp)

**Customer Home**
```
┌──────────────────────────────────────┐
│ BeautyBook            [📍 Quận 1 ▾]  │ 56
│ Hôm nay bạn muốn chăm sóc gì?        │ 30
│ ┌──────────────────────────────────┐ │
│ │ 🔍 Tìm dịch vụ, cơ sở…           │ │ 52
│ └──────────────────────────────────┘ │
│ ┌──── nền mận ─────────────────────┐ │
│ │ LỊCH HẸN KẾ TIẾP   [⏱ Chờ xác nhận]│ │
│ │ Gội đầu dưỡng sinh               │ │ 92
│ │ T7 12/10 · 14:30 · Lotus Spa   › │ │
│ └──────────────────────────────────┘ │
│ Theo nhu cầu                          │
│ [ảnh][ảnh][ảnh][ảnh] → (Minh họa)    │ 136
│ Cơ sở đang nhận lịch      Xem tất cả │
│ ┌ ảnh 16:9 ───────────────────────┐  │
├──────────────────────────────────────┤
│ (◉)Khám phá  Tìm kiếm  Lịch hẹn  TK  │ 64
└──────────────────────────────────────┘
```

**Booking**
```
│ ‹  Đặt lịch                          │
│ ① Dịch vụ          Lotus Spa · Q1    │
│   Gội đầu dưỡng sinh · 60 phút       │
│   [ + Thêm dịch vụ ]                 │
│ ② Chuyên viên   [Bất kỳ ▾]           │
│ ③ Ngày   ‹ Tháng 10/2026 ›           │
│   [T2 12][T3 13][T4 14]…             │
│ ④ Giờ   Sáng [09:00][09:30]          │
│         Chiều [14:00][14:30]         │
│ ⑤ Ưu đãi & ghi chú                   │
├──────────────────────────────────────┤
│ Tổng dự kiến            320.000 đ    │
│ [      Xem lại đặt lịch           ]  │
```

**Staff Hôm nay**
```
│ Hôm nay                               │
│ [Chi nhánh Q1 ▾]  Thứ Năm 09/10       │
│ Đang thực hiện                        │
│ ┃ Nguyễn Thị Ngọc Ánh                 │
│ ┃ Chăm sóc da chuyên sâu              │
│ ┃ [▶ Đang thực hiện]  Dự kiến 14:00–15:00│
│ ┃ 32 phút 10 giây thực tế             │
│ ┃ [        Hoàn tất         ] Chi tiết│
│ Tiếp theo                             │
│ │ Trần Minh Thư · Gội dưỡng sinh      │
│ │ [✓ Khách đã đến] Dự kiến 15:00      │
│ │ [     Bắt đầu dịch vụ      ]        │
│ Còn lại hôm nay                       │
│ 16:00  Lê Hà · Nail gel   [Chưa đến] ›│
```

**Owner Tổng quan**
```
│ Tổng quan                             │
│ [Tất cả chi nhánh ▾]   ‹ 09/10/2026 › │
│ ┌ Cần bạn xử lý ───────────────────┐  │
│ │ 3 yêu cầu đổi / hủy đang chờ     │  │
│ │ 1 ảnh hưởng vận hành chưa đóng   │  │
│ │ [  Xem việc cần xử lý  ]         │  │
│ └──────────────────────────────────┘  │
│ Ngày 09/10    18 lịch hẹn · 6 hoàn tất│
│ [Chờ xử lý 2][Đã xác nhận 9]…         │
│ Tình hình chi nhánh                   │
```

## 22. Kiến trúc triển khai & lộ trình

**Nhánh:** `feat/mobile-berry-clarity-redesign` (từ `main` @ `38c5fb6`).
1. **Nền móng:** `src/theme/index.ts` (thuần TS), `constants/colors.ts` re-export + alias cũ, `src/ui/*` component dùng chung, `utils/bookingClock.ts` (định dạng `Asia/Ho_Chi_Minh`).
2. **Điều hướng:** `BrandTabBar` cho 3 shell; header thống nhất; gỡ `OtpVerify`, `Forms`, `FilterSheet`, `TimeFilterSheet` + context.
3. **Customer:** Home → Search → Venue → Combo → Booking/AddService/Success → Lịch hẹn → Tài khoản/Auth.
4. **Staff:** primitives vận hành, WorkCard, StaffWorkScreen, OperationsAccount, Notifications.
5. **Owner:** OwnerUI, Overview, Operations, Details, ActualTimeCorrection, UnfinishedBookings, SetupState.
6. **Kiểm chứng:** `npm ci` (theo lockfile), `npm run typecheck`, `node --test tests/*.test.cjs`, `scripts/audit-reachable.mjs`.
7. **Bàn giao:** `mobile/docs/REDESIGN-BERRY-CLARITY.md`, PR.

Không thêm dependency. Không chạm backend/web/infra.

## 23. Kế hoạch kiểm thử & QA
- **Tự động (được phép):** typecheck; toàn bộ test Node hiện có; cập nhật mock test cho module theme mới **không đổi assertion nghiệp vụ**; đổi assertion nhãn “Nhận khách” → “Bắt đầu dịch vụ” (thay đổi nội dung có chủ đích, payload START giữ nguyên).
- **Thủ công (cần người dùng cho phép chạy thiết bị):** 320/390/412dp; font scale 1.0/1.3/2.0; TalkBack; đặt lịch PENDING/CONFIRMED/xung đột giờ/mất mạng; Staff START/COMPLETE song song; Owner tải/lỗi/không có việc.
- Không tuyên bố đã nghiệm thu trên thiết bị khi chưa chạy.

## 24. Rủi ro, câu hỏi mở & quyết định cuối

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Thay đổi cấu trúc JSX làm hỏng test “ghim” | Trung bình | Giữ primitive RN, nhãn trợ năng, thứ tự `useState` |
| Không xác minh hình ảnh trên thiết bị | Cao | Ghi rõ trong PR; PR là **Draft** nếu chưa QA thủ công |
| Đổi thứ tự bước Booking ảnh hưởng thói quen | Thấp | Logic không đổi; nhãn bước đánh số |
| Gỡ route `OtpVerify`/`Forms` | Thấp | Đã xác minh không có đường vào; không có deep link |
| Định dạng giờ theo `Asia/Ho_Chi_Minh` khi server cấu hình `BOOKING_TIME_ZONE` khác | Thấp | Khớp giả định `+07:00` hiện có của `mapBooking`; ghi chú cho backend nếu đổi |

**Câu hỏi mở cho chủ sản phẩm**
1. Brief nói “retired data-processing request UI”, nhưng checkout hiện tại vẫn có `privacyApi.requestAccountDeletion` và backend `/privacy/data-requests`. Đợt này **giữ** (mã cục bộ là chuẩn), chỉ chỉnh lời. Có muốn gỡ không? (Lưu ý: kho ứng dụng thường yêu cầu đường xóa tài khoản.)
2. Có muốn bước 2 đồng bộ font Be Vietnam Pro với web không?

**Quyết định cuối:** triển khai **Berry Clarity** cho cả ba vai trò theo lộ trình mục 22, ngay trong Giai đoạn B.
