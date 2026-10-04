# Đối chiếu mã nguồn Preview trước khi dọn

Ngày kiểm tra: 30/09/2026. `mobile/` là ứng dụng chính; `mobile-preview/` hiện chưa được Git theo dõi. Không xóa dữ liệu người dùng hay database.

Đã dọn cache sinh tự động của Preview (`node_modules/`, `android/`, `dist/`, `.expo/`, `.gradle-cache/`, `.npm-cache/`) và chín module không còn được ứng dụng chính tham chiếu. `node scripts/audit-reachable.mjs` xác nhận 86/86 file nguồn còn lại của ứng dụng chính có thể đi đến từ entrypoint.

Đối chiếu hash từng file của `mobile-preview/src/` ngoài `src/preview/` với cùng đường dẫn trong `mobile/src/` cho kết quả:

| Nhóm | Số file | Xử lý |
| --- | ---: | --- |
| Giống từng byte | 62 | Giữ trong kho Preview để hồ sơ QA vẫn nguyên vẹn |
| Khác nội dung | 21 | Giữ để đối chiếu; bản chính đã lấy các thay đổi cần thiết và thay import khỏi `homeData.ts` |
| Không có cùng đường dẫn trong bản chính | 11 | Giữ vì gồm các module cũ và hai map component đã được đổi tên ở bản chính |

Các file khác nội dung: `AppointmentCard.tsx`, `categoryArt.ts`, `FilterSheet.tsx`, `BannerCarousel.tsx`, `ComboCard.tsx`, `config/api.ts`, `useBranchDetail.ts`, `useCatalog.ts`, `mappers/catalog.ts`, `AddServiceScreen.tsx`, `AppointmentDetailScreen.tsx`, `BookingScreen.tsx`, `BookingSuccessScreen.tsx`, `ComboDetailScreen.tsx`, `FavoritesScreen.tsx`, `HomeScreen.tsx`, `LichHenScreen.tsx`, `SearchScreen.tsx`, `VenueDetailScreen.tsx`, `authStorage.ts`, `hash.ts`.

Các file không có cùng đường dẫn: `ApiAuthSheet.tsx`, `AuthSheet.tsx`, `PreviewMap.tsx`, `PreviewMap.web.tsx`, `CategoryList.tsx`, `HomeHeader.tsx`, `SectionHeader.tsx`, `VenueCard.tsx`, `AuthSheetContext.tsx`, `ReviewsContext.tsx`, `homeData.ts`. Hai `PreviewMap` đã thành `VenueMap` trong bản chính; chín file còn lại được xác nhận không cần ở runtime chính và đã xóa khỏi `mobile/`.

Việc xóa toàn bộ `mobile-preview/src/` đã bị hệ thống xét duyệt tự động từ chối vì 32 file không giống bản chính hoặc không có cùng đường dẫn, và toàn bộ nguồn Preview chưa được Git lưu. Do đó thư mục nguồn Preview vẫn được giữ dưới nhãn lưu trữ, không phải app chính. Cần quyết định riêng trước khi xóa kho đối chiếu này.
