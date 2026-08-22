# Báo cáo nâng cấp Service Management Workspace

Ngày thực hiện: 16/07/2026

## Kết quả

- Tách rõ `BusinessService` (định nghĩa cấp doanh nghiệp) và `Service` (bản ghi áp dụng/ghi đè tại chi nhánh).
- Migration tự backfill catalog từ dữ liệu dịch vụ cũ; không đổi ID của `Service`, vì vậy `BookingService.serviceId` và toàn bộ lịch sử booking được giữ nguyên.
- `/salon/services` hỗ trợ lọc chi nhánh, tìm kiếm, danh mục, trạng thái, Card/Table view và drawer chi tiết.
- Mỗi dịch vụ hiển thị số chi nhánh đang hoạt động, tạm ngưng, chưa áp dụng; drawer hiển thị giá, thời lượng, số nhân viên phù hợp và booking tương lai từ dữ liệu thật.
- Có action áp dụng, tạm ngưng và kích hoạt lại riêng từng chi nhánh. Tạm ngưng tại A không cập nhật B.
- Public services, preview price, available slots và create booking chỉ chấp nhận `Service` ACTIVE đúng chi nhánh.
- Lưu trữ catalog là soft-delete; booking lịch sử không bị xóa.
- Giữ nguyên permission hiện có; không tạo permission tùy tiện. Contract “unknown permission = 0” vẫn pass.

## API bổ sung

- `GET /services/workspace/manage`
- `POST /services/catalog`
- `PATCH /services/catalog/:id`
- `DELETE /services/catalog/:id`
- `POST /services/catalog/:id/branches/:branchId/apply`
- `POST /services/catalog/:id/branches/:branchId/pause`
- `POST /services/catalog/:id/branches/:branchId/reactivate`

## Xác minh

- Backend build: pass.
- Frontend production build: pass.
- Unit test branch availability/public filtering: pass.
- Prisma format/generate: pass.

