# BeautyBook mobile chính — trạng thái chuyển từ Preview

Ngày kiểm tra: 30/09/2026. `mobile/` là ứng dụng khách hàng chính; `mobile-preview/` được lưu trữ để đối chiếu QA cũ, gồm cả bản sao mã nguồn chưa được Git theo dõi. Bản chính giữ package `com.beautybook.mobile`, deep link `beautybook://`, key phiên `beautybook.customer.session`, và biến `EXPO_PUBLIC_API_URL`. Không ghi đè cấu hình này bằng tên/package/key của Preview.

## Thay đổi

- Chuyển các cải tiến đã chạy API của Preview vào trang chủ, tìm kiếm, chi tiết cơ sở, đặt lịch, lịch hẹn, hồ sơ, mục đã lưu, tab bar và các mapper/hook tương ứng. Dữ liệu trong runtime lấy từ API; khi API lỗi có trạng thái lỗi và thử lại.
- Chuyển năm ảnh minh họa cũ từ Preview; thêm hai ảnh mới cho `Sơn gel` và `Triệt lông`. Ảnh mới là still-life AI, không mô tả cơ sở hoặc người thật. Mọi ảnh dịch vụ AI có nhãn minh họa. Mapping và nguồn ở [manifest ảnh](../assets/illustrations/manifest.md).
- Xóa 9 file/component/context không còn được entrypoint dùng, gồm auth sheet cũ, các thẻ Home cũ, ReviewsContext chỉ có state cục bộ và `homeData.ts` chứa fixture giả. Giữ các type/`formatCurrency` cần thiết trong `catalogModels.ts`. Script `scripts/audit-reachable.mjs` xác nhận không còn module nguồn mồ côi.
- Thêm `app.json` Android package và sinh dự án native `mobile/android/` qua Expo prebuild; thư mục native và output build là generated, không phải source được commit. Không reset database hoặc xóa lịch hẹn.

## Đã kiểm tra trên ứng dụng chính

- `npm run typecheck`: qua.
- `npx expo export --platform web`: qua, bundle gồm bảy ảnh minh họa cục bộ. Demo local từ `mobile/dist` ở `http://localhost:8086`.
- `npm run export:android`: qua, bundle Hermes Android gồm bảy ảnh.
- `node tests/live-catalog-smoke.mjs` tại 320/390px, URL chính cổng 8086: đủ ảnh cho cả 12 danh mục API đang trả về; ảnh tóc nam/nữ và sơn gel/chăm sóc móng khác nhau; ảnh tải thành công; không page error, API error hay tràn ngang. Ảnh: `report-output/live-web/home-320.png`, `home-390.png`, `search-390.png`, `venue-390.png`.
- `node tests/live-booking-entry.mjs` tại 320/390px: từ tìm kiếm vào cơ sở, dịch vụ và màn đặt lịch; slot API HTTP 200; không lỗi/tràn ngang. Ảnh: `report-output/live-web/booking-320.png`, `booking-390.png`.
- `:app:assembleDebug`: qua với Android SDK/Gradle hiện tại; log `report-output/android-main-build.txt`. APK debug ở `mobile/android/app/build/outputs/apk/debug/app-debug.apk` là artifact local cần Metro khi chạy. Chưa cài hoặc mở APK chính trên emulator trong đợt chuyển này.

`expo export --platform android` cũng thay nội dung `dist/`; đã export web lại và xác nhận `http://localhost:8086/` tải `index.html` trước khi chạy smoke test trên bản chính.

Các lượt QA native đặt/hủy lịch, hồ sơ, lưu dịch vụ và mất mạng trước đây thực hiện trên package **Preview**, không được suy diễn thành QA native của package chính. Chưa thử yêu cầu đổi lịch, thanh toán, hoàn tiền hay thiết bị vật lý trên bản chính. Backend local được dùng cho demo; cần API HTTPS và kiểm tra phát hành riêng trước khi đưa lên store.

Đối chiếu các file Preview được giữ lại trước khi dọn thêm: [PREVIEW-CLEANUP-AUDIT.md](PREVIEW-CLEANUP-AUDIT.md).
