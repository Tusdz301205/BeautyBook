# Section A — Staff onboarding và offboarding

## Một luồng thêm nhân viên

Nút chính là “Thêm nhân sự”. Người quản lý tạo một `StaffProfile`, sau đó chọn:

- Cấp tài khoản sau: `StaffStatus = PROFILE_ONLY`, không public và chưa bookable.
- Gửi lời mời ngay: profile chuyển `INVITED`, invitation liên kết bằng `staffProfileId`.

Không còn luồng tạo StaffProfile thứ hai từ email invitation.

## Invitation lifecycle

Invitation chứa email, role, Business, Branch, StaffProfile, người mời, hash token, expiry và trạng thái.

Các action thật:

- list theo tenant/branch;
- xem token context an toàn;
- resend;
- đổi email trước khi nhận;
- revoke;
- accept cho User mới;
- authenticated accept cho User/Customer đã tồn tại.

Khi User đã tồn tại:

1. User login vào SALON workspace flow.
2. Backend kiểm tra token, expiry, revoked/accepted state và email.
3. Kiểm tra Branch thuộc Business và StaffProfile chưa gắn User khác.
4. Gắn User hiện có vào chính StaffProfile.
5. Tạo role và branch assignment theo kiểu idempotent.
6. Giữ nguyên CustomerProfile.
7. Chuyển StaffProfile sang `ACTIVE` và ghi audit.

Owner không đặt hoặc biết mật khẩu của nhân viên.

## Staff Detail

Route `/salon/staff/:staffId` có 10 nhóm:

1. Tổng quan
2. Tài khoản
3. Vai trò & chi nhánh
4. Dịch vụ
5. Lịch làm
6. Nghỉ phép
7. Chấm công
8. Bảng công & thu nhập
9. Tài liệu
10. Nhật ký

Tab tài khoản hiển thị `PROFILE_ONLY`, `INVITED`, `ACTIVE`, `LOCKED/INACTIVE`, email, last login và invitation gần nhất. Cấp tài khoản, resend, đổi email, revoke đều gọi API thật. Tab tài liệu báo empty rõ ràng vì schema chưa có staff-document relation; không tạo dữ liệu giả.

## Offboarding

“Ngừng làm việc” không hard-delete StaffProfile:

1. Bắt buộc lý do.
2. Tính danh sách booking tương lai bị ảnh hưởng.
3. Chặn nếu chưa xác nhận đã có kế hoạch reassign/reschedule.
4. Tắt `isBookable` và `publicVisible`.
5. End mọi assignment đang active.
6. Revoke invitation đang pending.
7. Revoke salon roles thuộc Business.
8. Revoke salon sessions thuộc Business.
9. Giữ booking, attendance, timesheet, compensation, pay run và audit.
10. Giữ CustomerProfile và customer sessions không liên quan.

Hệ thống không tự hủy booking tương lai; quyết định reassign/reschedule thuộc người vận hành và phải dùng booking workflow.

## Trạng thái và ràng buộc

- `PROFILE_ONLY`: hồ sơ nội bộ, chưa tài khoản.
- `INVITED`: đã gửi invitation.
- `ACTIVE`: đã liên kết User và đang làm việc.
- `LOCKED`: khóa quyền công việc.
- `ON_LEAVE`: nghỉ phép.
- `INACTIVE`: đã offboard.

Invitation mới bắt buộc có `staffProfileId`. Cột vẫn nullable trong migration để giữ các bản ghi legacy và cho phép audit trước khi backfill.

