# Section A — Identity và workspace architecture

## Invariant

Một người chỉ có một `User`. Customer và nhân sự salon không phải hai account khác nhau; đó là hai membership/workspace của cùng identity.

Workspace hợp lệ:

- `CUSTOMER`: chỉ Customer role và self scope.
- `SALON`: chỉ Business Owner, Branch Manager, Receptionist, Staff trong Business/Branch đã xác minh.
- `PLATFORM`: chỉ Platform roles và direct Platform permissions.

User có nhiều workspace phải chọn workspace khi login. Backend không tự ưu tiên role salon và không trộn role từ workspace khác vào JWT.

## Login và session

`POST /auth/login` nhận:

```json
{
  "email": "user@example.com",
  "password": "...",
  "workspace": "CUSTOMER | SALON | PLATFORM",
  "businessId": "optional",
  "branchId": "optional"
}
```

Client gửi context chỉ như yêu cầu; backend luôn kiểm tra lại `UserRole`, Business và Branch assignment. Session lưu `workspace`, `businessId`, `branchId`. Refresh token đọc context từ session đã lưu và không tự đổi workspace.

JWT mang context đang hoạt động để UI định tuyến, nhưng authorization service vẫn kiểm tra ownership/scope lại trên resource.

## Phân tách quyền

- Direct `UserPermission` chỉ được đưa vào Platform workspace.
- Customer workspace không nhận salon role.
- Salon workspace không nhận Customer hoặc Platform role.
- Platform workspace không nhận tenant operational permission.
- Cross-business hoặc cross-branch context bị fail closed.

## Session revoke

Offboarding nhân viên chỉ revoke session `SALON` thuộc Business liên quan. Customer session và CustomerProfile được giữ. Khóa toàn cục User chỉ dùng cho security/risk toàn tài khoản.

## Prisma và migration

`UserSession` có thêm:

- `workspace AuthWorkspace`
- `businessId`
- `branchId`
- composite lookup index phục vụ revoke đúng workspace

Migration backfill session cũ theo role đang hiệu lực, không xóa session hoặc User. Ba partial unique index trên `user_roles` khóa duplicate ở Platform, Business và Branch scope, kể cả trường hợp cột nullable của PostgreSQL.

Nếu dữ liệu cũ có duplicate role scope, migration dừng ở unique index thay vì tự merge mù. Cần audit và xử lý mapping có chủ đích trước khi deploy lại.

## Security notes

- Invitation token được random và chỉ lưu hash.
- Token single-use, có expiry và revoke.
- Accept invitation yêu cầu email của User đang đăng nhập khớp lời mời.
- Không tin businessId/branchId từ client.
- Không trả password hash, raw token hoặc secret trong API detail.

