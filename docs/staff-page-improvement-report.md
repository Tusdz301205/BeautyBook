# Báo cáo nâng cấp Staff / Team Management

Ngày thực hiện: 16/07/2026

## Kết quả

- Giữ nguyên workspace nhân sự đã có: KPI, tìm kiếm, lọc trạng thái/chi nhánh, thêm/sửa hồ sơ, mời qua email, lịch làm, giờ nghỉ, nghỉ phép, ngày đóng cửa, ngày làm đặc biệt và phân công dịch vụ.
- Bổ sung toggle icon Card/Table, dùng chung một tập dữ liệu đã lọc và không refetch khi đổi kiểu hiển thị.
- Table view hiển thị nhân viên, chi nhánh, trạng thái, số dịch vụ, số ngày làm và action permission-aware.
- Staff công khai trong booking flow được lọc theo đúng chi nhánh, trạng thái ACTIVE và phải có đủ mapping kỹ năng cho mọi dịch vụ khách chọn.
- Backend tiếp tục kiểm tra lại lịch làm, nghỉ phép, ngày đóng cửa, giờ nghỉ, kỹ năng và branch scope khi tạo booking; frontend không phải nguồn sự thật.
- Soft-deactivate được giữ nguyên; không xóa hồ sơ hoặc lịch sử nhân sự.

## Xác minh

- Frontend production build: pass.
- Backend build: pass.
- RBAC permission catalog contract: pass.

