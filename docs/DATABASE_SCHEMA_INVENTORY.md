# BeautyBook — Phụ lục kiểm kê schema

> **Inventory final ngày 21/09/2026:** main đã migrate/archive thành công; active source **121 model/92 enum**; 12 bảng retired nằm trong archive, 2 consent giữ nguyên và 395 FK/0 orphan. Final regression đạt 103 suite/943 test BE+PostgreSQL, 58 FE, 66 browser actor/RBAC/booking/responsive và 12 concurrency/negative. Xem `DATABASE_SCHEMA_AUDIT_FINAL.md`; các inventory 133/131 model bên dưới được giữ làm bằng chứng trước cleanup.

> Trạng thái rehearsal 19/09: active Prisma **121 model /92 enum**; `archive_health_20260919` trên copy giữ 12 table cùng dữ liệu và10 enum. Hash source: `8c958f45eee21645ed4fa0aaa4b22196899bb315d3f2ba3bdd77dfd62d81e15e`. DB chính chưa archive. Các mục133/131 model bên dưới là snapshot trước cleanup, chưa thay bằng inventory FINAL khi user chưa duyệt. Mapping12 và FK ở `HEALTH_ARCHIVE_PREFLIGHT.md`; kết quả/recovery ở `HEALTH_ARCHIVE_REHEARSAL_RESULT.md`.

## Cập nhật tăng dần 19/09/2026

Hiện tại source có **133 model /102 enum**. Baseline 131 model bên dưới giữ nguyên để truy nguyên; line number/số field/index tổng ở baseline KHÔNG đại diện source hiện tại. Không ghi đè inventory gốc hoặc giả định database chính đã migrated. Hash hiện tại: `76c01a6018f921ea6d49705f3cd6b80ca13569c340e44c8ac0ff0697300a4997`.

### BookingViolationEvent — bổ sung

Table `booking_violation_events`. PK `id`. Fields:

| Field | SQL column | Type | Nullable |
|---|---|---|---|
| id | id | String UUID default | Không |
| bookingId | booking_id | String | Không |
| customerId | customer_id | String | Không |
| businessId | business_id | String | Không |
| sourceRequestId | source_request_id | String unique | Có |
| kind | kind | BookingViolationKind | Không |
| occurredAt | occurred_at | DateTime | Không |
| appointmentStartAt | appointment_start_at | DateTime | Không |
| recordedById | recorded_by_id | String | Không |
| policyVersion | policy_version | String | Không |
| createdAt | created_at | DateTime default now | Không |
| voidedAt | voided_at | DateTime | Có |
| voidedById | voided_by_id | String | Có |
| voidReason | void_reason | String | Có |

FK Restrict tới Booking, CustomerProfile, Business, AppointmentChangeRequest, User(recordedBy), User(voidedBy). Quan hệ inverse mới ở Booking/CustomerProfile/Business/AppointmentChangeRequest/User; event có triggeredPolicy optional. Index Prisma: bookingId; (customerId,businessId,occurredAt). SQL partial unique chỉ một event chưa VOID/booking; SQL scope/validity/immutability xem migration `20260917_booking_violation_events`, không biểu diễn đầy đủ bởi Prisma alone. Enum mới BookingViolationKind có LATE_CANCELLATION, NO_SHOW; weight được derive từ kind, không có cột penaltyPoint.

### CustomerBookingPolicy — bổ sung

Table `customer_booking_policies`. PK `id`. Fields:

| Field | SQL column | Type | Nullable |
|---|---|---|---|
| id | id | String UUID default | Không |
| customerId | customer_id | String | Không |
| businessId | business_id | String | Không |
| revision | revision | Int default 0 | Không |
| startsAt | starts_at | DateTime | Có |
| endsAt | ends_at | DateTime | Có |
| triggeredByViolationEventId | triggered_by_violation_event_id | String unique | Có |
| createdAt | created_at | DateTime default now | Không |
| updatedAt | updated_at | DateTime updatedAt | Không |

FK Restrict tới CustomerProfile, Business và BookingViolationEvent. Unique (customerId,businessId); index (businessId,endsAt). Inverse bookingPolicies ở CustomerProfile/Business. SQL CHECK revision>=0; dates và trigger-event cùng null hoặc đủ, endsAt>startsAt. SQL trigger đòi event valid cùng scope và endsAt=occurredAt+30d. Revision là transaction fence, không phải score. Hạn chế hết hạn giữ row; GET không tạo/gia hạn. AuditLog giữ trước/sau thay đổi; không thêm history model trùng event/audit.

### Các model hiện có chịu ảnh hưởng

- CustomerProfile/Business/Booking/User/AppointmentChangeRequest thêm inverse relation tới hai model mới; giữ PK và history hiện có.
- AppointmentChangeRequest giữ source event qua sourceRequestId unique; không thêm model cancellation trùng nghĩa.
- UserRole/Role/Permission schema không được tái thêm Manager; account separation kiểm bằng migration/service/guard, không biểu diễn bằng mixed Customer+operational role.
- CancellationPolicy chưa xóa/gộp: quyết định chuyển REFACTOR, không dùng policy 30d mới thay cho reschedule resolver.
- Counts/FK của cleanup candidate cập nhật bằng READ ONLY ở `DATABASE_SCHEMA_CLEANUP_APPROVAL.md`; chưa có destructive migration được duyệt. Mọi số liệu tổng field/index ở phần lịch sử sau đây chỉ là baseline.

## Baseline ngày 15/09/2026 (giữ nguyên)

Snapshot schema ngày 15/09/2026, sau loại Manager, trước thay đổi Phase 2. Không thay thế quyết định trong DATABASE_SCHEMA_AUDIT_DRAFT.md.

Source SHA-256: `65baa82f84811dbc41a46aebde141d9146af84b491ef0377b91344133088bdf8`. 131 model; 101 enum; 2074 field; 644 relation fields; 229 index declarations; 96 unique declarations. Tên FK/cardinality phía active dựa schema; default referential action không tự suy diễn khi không khai báo.

## User

SQL table: `users`; schema.prisma:9. PK: (id). Unique: (email); (phone).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 10 |
| email | email | String | Không | 11 |
| phone | phone | String | Có | 12 |
| passwordHash | password_hash | String | Không | 13 |
| fullName | full_name | String | Không | 14 |
| address | address | String | Có | 15 |
| avatarMediaId | avatar_media_id | String | Có | 16 |
| gender | gender | Gender | Có | 17 |
| dateOfBirth | date_of_birth | DateTime | Có | 18 |
| isEmailVerified | is_email_verified | Boolean | Không | 19 |
| isPhoneVerified | is_phone_verified | Boolean | Không | 20 |
| isActive | is_active | Boolean | Không | 21 |
| lastLoginAt | last_login_at | DateTime | Có | 22 |
| createdAt | created_at | DateTime | Không | 23 |
| updatedAt | updated_at | DateTime | Không | 24 |
| deletedAt | deleted_at | DateTime | Có | 25 |

Quan hệ có local FK:

- `avatarMediaId` → MediaFile(id); field avatarMedia; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=UserAvatar.

Relation fields của các model trỏ tới model này:

- AccountToken.user: đơn 1.
- UserSession.user: đơn 1.
- UserPermission.user: đơn 1.
- UserRole.grantor: đơn 0..1.
- UserRole.user: đơn 1.
- CustomerProfile.user: đơn 1.
- BusinessOwnerProfile.user: đơn 1.
- StaffProfile.user: đơn 0..1.
- DeviceToken.user: đơn 1.
- MediaFile.uploader: đơn 0..1.
- MediaFile.userAvatars: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.cancelledByUser: đơn 0..1.
- BookingStatusHistory.changedByUser: đơn 0..1.
- Notification.user: đơn 1.
- NotificationOutbox.user: đơn 1.
- AuditLog.user: đơn 0..1.
- SalonMember.user: đơn 1.
- AppointmentChangeRequest.requestedByUser: đơn 1.
- AppointmentChangeRequest.reviewer: đơn 0..1.
- TrustAction.actor: đơn 1.
- BusinessReviewEvent.actor: đơn 0..1.
- BusinessDocumentVersion.creator: đơn 1.
- BranchDocumentVersion.creator: đơn 1.
- BranchReviewRequest.requester: đơn 1.
- BranchReviewRequest.reviewer: đơn 0..1.
- BranchReviewEvent.actor: đơn 0..1.
- DocumentReviewEvent.actor: đơn 0..1.
- ReviewReport.reporter: đơn 1.
- BranchStateTransition.ref_actorId: đơn 1.
- BookingServiceAdjustment.ref_actorId: đơn 1.
- OperationalImpactCase.ref_ownerId: đơn 1.
- OperationalImpactCase.ref_createdBy: đơn 1.
- OperationalImpactItem.ref_resolvedBy: đơn 0..1.
- ReviewModerationEvent.ref_actorId: đơn 1.
- ReviewAppeal.ref_appellantId: đơn 1.
- ReviewAppeal.ref_reviewedBy: đơn 0..1.
- LoyaltyRule.ref_createdBy: đơn 1.
- LoyaltyTransaction.ref_createdBy: đơn 0..1.
- Invoice.ref_createdBy: đơn 1.
- InvoiceEvent.ref_actorId: đơn 1.
- OwnershipTransfer.ref_newOwnerUserId: đơn 1.
- OwnershipTransfer.ref_requestedBy: đơn 1.
- OwnershipTransfer.ref_approvedBy: đơn 0..1.
- LegalEntityVersion.ref_createdBy: đơn 1.
- PayoutAccountVersion.ref_createdBy: đơn 1.
- CustomerBusinessSegment.ref_assignedBy: đơn 0..1.

Index declarations:

- `@@index([email])`
- `@@index([phone])`

## AccountToken

SQL table: `account_tokens`; schema.prisma:78. PK: (id). Unique: (tokenHash).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 79 |
| userId | user_id | String | Không | 80 |
| type | type | AccountTokenType | Không | 81 |
| tokenHash | token_hash | String | Không | 82 |
| expiresAt | expires_at | DateTime | Không | 83 |
| usedAt | used_at | DateTime | Có | 84 |
| createdAt | created_at | DateTime | Không | 85 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.accountTokens: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([userId, type])`
- `@@index([expiresAt])`

## UserSession

SQL table: `user_sessions`; schema.prisma:93. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 94 |
| userId | user_id | String | Không | 95 |
| refreshTokenHash | refresh_token_hash | String | Có | 96 |
| userAgent | user_agent | String | Có | 97 |
| ipAddress | ip_address | String | Có | 98 |
| workspace | workspace | AuthWorkspace | Không | 99 |
| businessId | business_id | String | Có | 100 |
| branchId | branch_id | String | Có | 101 |
| lastActiveAt | last_active_at | DateTime | Không | 102 |
| expiresAt | expires_at | DateTime | Không | 103 |
| revokedAt | revoked_at | DateTime | Có | 104 |
| createdAt | created_at | DateTime | Không | 105 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.sessions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([userId, revokedAt])`
- `@@index([userId, workspace, businessId, branchId, revokedAt])`
- `@@index([expiresAt])`

## PlatformSetting

SQL table: `platform_settings`; schema.prisma:114. PK: (id). Unique: (key).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 115 |
| key | key | String | Không | 116 |
| value | value | Json | Không | 117 |
| updatedBy | updated_by | String | Có | 118 |
| createdAt | created_at | DateTime | Không | 119 |
| updatedAt | updated_at | DateTime | Không | 120 |

Quan hệ có local FK:

- Không có relation field sở hữu FK trong model này.

Relation fields của các model trỏ tới model này:


Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## StaffInvitation

SQL table: `staff_invitations`; schema.prisma:125. PK: (id). Unique: (tokenHash).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 126 |
| email | email | String | Không | 127 |
| roleCode | role_code | RoleCode | Không | 128 |
| businessId | business_id | String | Không | 129 |
| branchId | branch_id | String | Có | 130 |
| staffProfileId | staff_profile_id | String | Có | 131 |
| tokenHash | token_hash | String | Không | 132 |
| status | status | InvitationStatus | Không | 133 |
| invitedBy | invited_by | String | Không | 134 |
| expiresAt | expires_at | DateTime | Không | 135 |
| acceptedAt | accepted_at | DateTime | Có | 136 |
| acceptedBy | accepted_by | String | Có | 137 |
| revokedAt | revoked_at | DateTime | Có | 138 |
| createdAt | created_at | DateTime | Không | 139 |
| updatedAt | updated_at | DateTime | Không | 140 |

Quan hệ có local FK:

- `staffProfileId` → StaffProfile(id); field staffProfile; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- StaffProfile.invitations: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([email, status])`
- `@@index([businessId, branchId])`
- `@@index([staffProfileId, status])`

## Role

SQL table: `roles`; schema.prisma:149. PK: (id). Unique: (code).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 150 |
| code | code | RoleCode | Không | 151 |
| name | name | String | Không | 152 |
| createdAt | created_at | DateTime | Không | 153 |
| level | level | RoleLevel | Không | 154 |

Quan hệ có local FK:

- Không có relation field sở hữu FK trong model này.

Relation fields của các model trỏ tới model này:

- RolePermission.role: đơn 1.
- UserRole.role: đơn 1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## Permission

SQL table: `permissions`; schema.prisma:161. PK: (id). Unique: (code).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 162 |
| code | code | String | Không | 163 |
| description | description | String | Có | 164 |
| resource | resource | String | Không | 165 |
| action | action | String | Không | 166 |
| scope | scope | PermissionScope | Không | 167 |
| createdAt | created_at | DateTime | Không | 168 |

Quan hệ có local FK:

- Không có relation field sở hữu FK trong model này.

Relation fields của các model trỏ tới model này:

- RolePermission.permission: đơn 1.
- UserPermission.permission: đơn 1.

Index declarations:

- `@@index([resource, action])`

## RolePermission

SQL table: `role_permissions`; schema.prisma:176. PK: (roleId, permissionId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| roleId | role_id | String | Không | 177 |
| permissionId | permission_id | String | Không | 178 |
| createdAt | created_at | DateTime | Không | 179 |

Quan hệ có local FK:

- `permissionId` → Permission(id); field permission; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `roleId` → Role(id); field role; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Role.rolePermissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Permission.rolePermissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([permissionId])`

## UserPermission

SQL table: `user_permissions`; schema.prisma:188. PK: (id). Unique: (userId, permissionId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 189 |
| userId | user_id | String | Không | 190 |
| permissionId | permission_id | String | Không | 191 |
| bundleCode | bundle_code | String | Có | 192 |
| grantedBy | granted_by | String | Có | 193 |
| grantedAt | granted_at | DateTime | Không | 194 |
| expiresAt | expires_at | DateTime | Có | 195 |
| revokedAt | revoked_at | DateTime | Có | 196 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `permissionId` → Permission(id); field permission; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.userPermissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Permission.userPermissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([userId, revokedAt, expiresAt])`
- `@@index([permissionId])`

## UserRole

SQL table: `user_roles`; schema.prisma:211. PK: (id). Unique: (userId, roleId, businessId, branchId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| userId | user_id | String | Không | 212 |
| roleId | role_id | String | Không | 213 |
| branchId | branch_id | String | Có | 214 |
| businessId | business_id | String | Có | 215 |
| expiresAt | expires_at | DateTime | Có | 216 |
| grantedAt | granted_at | DateTime | Không | 217 |
| grantedBy | granted_by | String | Có | 218 |
| id | id | String | Không | 219 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `grantedBy` → User(id); field grantor; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=UserRoleGrantor.
- `roleId` → Role(id); field role; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `userId` → User(id); field user; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.userRolesGranted: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.userRoles: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Role.userRoles: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.userRoles: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.userRoles: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([userId])`
- `@@index([roleId])`
- `@@index([businessId])`
- `@@index([branchId])`

## CustomerProfile

SQL table: `customer_profiles`; schema.prisma:234. PK: (id). Unique: (userId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 235 |
| userId | user_id | String | Không | 236 |
| address | address | String | Có | 237 |
| note | note | String | Có | 238 |
| createdAt | created_at | DateTime | Không | 239 |
| updatedAt | updated_at | DateTime | Không | 240 |
| deletedAt | deleted_at | DateTime | Có | 241 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.customerProfile: đơn 0..1.
- Booking.customer: đơn 1.
- RecurringBookingPlan.customer: đơn 1.
- PackagePurchase.customer: đơn 1.
- Review.customer: đơn 1.
- BusinessComment.customer: đơn 1.
- CustomerVoucher.customer: đơn 1.
- SensitiveConsent.customer: đơn 1.
- BookingHealthRecord.customer: đơn 1.
- ConsultationSubmission.customer: đơn 1.
- ConsentEvent.customer: đơn 1.
- DataSubjectRequest.customer: đơn 1.
- PriceAdjustment.ref_customerId: đơn 0..1.
- PromotionRedemption.ref_customerId: đơn 1.
- VoucherRedemption.ref_customerId: đơn 1.
- WaitlistEntry.ref_customerId: đơn 1.
- LoyaltyAccount.ref_customerId: đơn 1.
- LoyaltyTransaction.ref_customerId: đơn 1.
- InvoiceInformationRequest.customer: đơn 1.
- CustomerSavedService.customer: đơn 1.
- CustomerBusinessSegment.ref_customerId: đơn 1.
- MarketingPreference.customer: đơn 1.
- PrivacyExportPackage.customer: đơn 1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## BookingContact

SQL table: `booking_contacts`; schema.prisma:271. PK: (id). Unique: (bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 272 |
| bookingId | booking_id | String | Không | 273 |
| fullName | full_name | String | Không | 274 |
| phone | phone | String | Có | 275 |
| email | email | String | Có | 276 |
| createdAt | created_at | DateTime | Không | 277 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Booking.contact: đơn 0..1.

Index declarations:

- `@@index([phone])`

## BusinessOwnerProfile

SQL table: `business_owner_profiles`; schema.prisma:284. PK: (id). Unique: (userId); (taxCode).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 285 |
| userId | user_id | String | Không | 286 |
| companyName | company_name | String | Có | 287 |
| taxCode | tax_code | String | Có | 288 |
| identityCardNumber | identity_card_number | String | Có | 289 |
| createdAt | created_at | DateTime | Không | 290 |
| updatedAt | updated_at | DateTime | Không | 291 |
| deletedAt | deleted_at | DateTime | Có | 292 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.ownerProfile: đơn 0..1.
- Business.owner: đơn 1.
- OwnershipTransfer.ref_oldOwnerId: đơn 1.
- OwnershipHistory.ref_ownerId: đơn 1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## StaffProfile

SQL table: `staff_profiles`; schema.prisma:301. PK: (id). Unique: (branchId, employeeCode); (userId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 302 |
| userId | user_id | String | Có | 303 |
| branchId | branch_id | String | Không | 304 |
| fullName | full_name | String | Không | 305 |
| position | position | String | Có | 306 |
| bio | bio | String | Có | 307 |
| employeeCode | employee_code | String | Có | 308 |
| experienceYears | experience_years | Int | Có | 309 |
| publicVisible | public_visible | Boolean | Không | 310 |
| isBookable | is_bookable | Boolean | Không | 311 |
| emergencyContactName | emergency_contact_name | String | Có | 312 |
| emergencyContactPhone | emergency_contact_phone | String | Có | 313 |
| status | status | StaffStatus | Không | 314 |
| hiredAt | hired_at | DateTime | Có | 315 |
| createdAt | created_at | DateTime | Không | 316 |
| updatedAt | updated_at | DateTime | Không | 317 |
| deletedAt | deleted_at | DateTime | Có | 318 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `userId` → User(id); field user; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.staffProfile: đơn 0..1.
- StaffInvitation.staffProfile: đơn 0..1.
- Branch.staff: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- StaffBranchAssignment.staff: đơn 1.
- StaffImage.staff: đơn 1.
- StaffService.staff: đơn 1.
- BookingService.staff: đơn 0..1.
- RecurringBookingPlan.staff: đơn 0..1.
- ReviewServiceRating.staff: đơn 0..1.
- AppointmentChangeRequest.proposedStaff: đơn 0..1.
- OperationalImpactItem.ref_replacementStaffId: đơn 0..1.
- WaitlistEntry.ref_staffId: đơn 0..1.

Index declarations:

- `@@index([branchId])`
- `@@index([status])`
- `@@index([branchId, status, isBookable, publicVisible])`

## DeviceToken

SQL table: `device_tokens`; schema.prisma:339. PK: (id). Unique: (token).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 340 |
| userId | user_id | String | Không | 341 |
| token | token | String | Không | 342 |
| platform | platform | DevicePlatform | Không | 343 |
| createdAt | created_at | DateTime | Không | 344 |
| updatedAt | updated_at | DateTime | Không | 345 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.deviceTokens: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([userId])`

## Province

SQL table: `provinces`; schema.prisma:352. PK: (id). Unique: (name); (code).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 353 |
| name | name | String | Không | 354 |
| code | code | String | Có | 355 |
| createdAt | created_at | DateTime | Không | 356 |

Quan hệ có local FK:

- Không có relation field sở hữu FK trong model này.

Relation fields của các model trỏ tới model này:

- District.province: đơn 1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## District

SQL table: `districts`; schema.prisma:362. PK: (id). Unique: (provinceId, name).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 363 |
| provinceId | province_id | String | Không | 364 |
| name | name | String | Không | 365 |
| code | code | String | Có | 366 |
| createdAt | created_at | DateTime | Không | 367 |

Quan hệ có local FK:

- `provinceId` → Province(id); field province; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Province.districts: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.district: đơn 0..1.

Index declarations:

- `@@index([provinceId])`

## Business

SQL table: `businesses`; schema.prisma:376. PK: (id). Unique: (slug).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 377 |
| ownerId | owner_id | String | Không | 378 |
| name | name | String | Không | 379 |
| slug | slug | String | Không | 380 |
| description | description | String | Có | 381 |
| contactEmail | contact_email | String | Có | 382 |
| contactPhone | contact_phone | String | Có | 383 |
| addressLine | address_line | String | Có | 384 |
| legalRepresentative | legal_representative | String | Có | 385 |
| legalDocuments | legal_documents | Json | Có | 386 |
| onboardingData | onboarding_data | Json | Có | 387 |
| onboardingStep | onboarding_step | Int | Không | 388 |
| marketplacePreviewedAt | marketplace_previewed_at | DateTime | Có | 389 |
| reviewNote | review_note | String | Có | 390 |
| submittedAt | submitted_at | DateTime | Có | 391 |
| reviewedAt | reviewed_at | DateTime | Có | 392 |
| logoMediaId | logo_media_id | String | Có | 393 |
| status | status | BusinessStatus | Không | 394 |
| createdAt | created_at | DateTime | Không | 395 |
| updatedAt | updated_at | DateTime | Không | 396 |
| deletedAt | deleted_at | DateTime | Có | 397 |
| bookingRestrictedAt | booking_restricted_at | DateTime | Có | 412 |
| bookingRestrictionReason | booking_restriction_reason | String | Có | 413 |

Quan hệ có local FK:

- `logoMediaId` → MediaFile(id); field logoMedia; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=BusinessLogo.
- `ownerId` → BusinessOwnerProfile(id); field owner; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- UserRole.business: đơn 0..1.
- BusinessOwnerProfile.businesses: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.business: đơn 1.
- MediaFile.businessLogos: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessImage.business: đơn 1.
- ServiceCategory.business: đơn 1.
- BusinessService.business: đơn 1.
- Combo.business: đơn 1.
- Promotion.businessOwner: đơn 0..1.
- PromotionBusiness.business: đơn 1.
- PricingSnapshot.business: đơn 1.
- PaymentPolicy.business: đơn 1.
- PaymentPolicySnapshot.business: đơn 1.
- PaymentIntent.business: đơn 1.
- PaymentTransaction.business: đơn 1.
- FinancialLedgerEntry.business: đơn 1.
- PlatformFeeEntry.business: đơn 1.
- PlatformFeeAdjustment.business: đơn 1.
- PlatformStatement.business: đơn 1.
- TreatmentPackage.business: đơn 1.
- PackagePurchase.business: đơn 1.
- BusinessComment.business: đơn 1.
- SalonMember.business: đơn 1.
- CancellationPolicy.business: đơn 1.
- Voucher.business: đơn 0..1.
- SalonTrustSnapshot.business: đơn 1.
- TrustAction.business: đơn 1.
- BusinessReviewEvent.business: đơn 1.
- BusinessDocument.business: đơn 1.
- ConsultationFormTemplate.business: đơn 1.
- ConsultationSubmission.business: đơn 1.
- ConsentEvent.business: đơn 1.
- SensitiveDataAccessEvent.business: đơn 1.
- SensitiveBreakGlassGrant.business: đơn 1.
- OperationalImpactCase.ref_businessId: đơn 1.
- WaitlistEntry.ref_businessId: đơn 1.
- LoyaltyRule.ref_businessId: đơn 1.
- LoyaltyAccount.ref_businessId: đơn 1.
- LoyaltyTransaction.ref_businessId: đơn 1.
- Invoice.ref_businessId: đơn 1.
- InvoiceInformationRequest.business: đơn 1.
- OwnershipTransfer.ref_businessId: đơn 1.
- OwnershipHistory.ref_businessId: đơn 1.
- LegalEntityVersion.ref_businessId: đơn 1.
- PayoutAccountVersion.ref_businessId: đơn 1.
- CustomerBusinessSegment.ref_businessId: đơn 1.

Index declarations:

- `@@index([ownerId])`
- `@@index([status])`
- `@@index([name])`

## Branch

SQL table: `branches`; schema.prisma:453. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 454 |
| businessId | business_id | String | Không | 455 |
| name | name | String | Không | 456 |
| publicName | public_name | String | Có | 457 |
| description | description | String | Có | 458 |
| addressLine | address_line | String | Có | 459 |
| districtId | district_id | String | Có | 460 |
| ward | ward | String | Có | 461 |
| floor | floor | String | Có | 462 |
| directions | directions | String | Có | 463 |
| latitude | latitude | Decimal | Có | 464 |
| longitude | longitude | Decimal | Có | 465 |
| phone | phone | String | Có | 466 |
| email | email | String | Có | 467 |
| serviceMode | service_mode | BranchServiceMode | Không | 468 |
| sameLegalEntity | same_legal_entity | Boolean | Không | 469 |
| managerName | manager_name | String | Có | 470 |
| scheduledOpeningDate | scheduled_opening_date | DateTime | Có | 471 |
| timezone | timezone | String | Không | 472 |
| bookingStartDate | booking_start_date | DateTime | Có | 473 |
| serviceAreas | service_areas | Json | Có | 474 |
| serviceRadiusKm | service_radius_km | Int | Có | 475 |
| travelFee | travel_fee | Decimal | Có | 476 |
| excludedServiceAreas | excluded_service_areas | Json | Có | 477 |
| bookingConfirmationMode | booking_confirmation_mode | BookingConfirmationMode | Không | 478 |
| staffAssignmentMode | staff_assignment_mode | StaffAssignmentMode | Không | 479 |
| pendingHoldMinutes | pending_hold_minutes | Int | Không | 480 |
| status | status | BranchStatus | Không | 481 |
| reviewStatus | review_status | BranchReviewStatus | Không | 482 |
| operationalStatus | operational_status | BranchOperationalStatus | Không | 483 |
| reviewNote | review_note | String | Có | 484 |
| submittedAt | submitted_at | DateTime | Có | 485 |
| reviewedAt | reviewed_at | DateTime | Có | 486 |
| publishedAt | published_at | DateTime | Có | 487 |
| createdAt | created_at | DateTime | Không | 488 |
| updatedAt | updated_at | DateTime | Không | 489 |
| deletedAt | deleted_at | DateTime | Có | 490 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `districtId` → District(id); field district; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- UserRole.branch: đơn 0..1.
- StaffProfile.branch: đơn 1.
- District.branches: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.branches: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchWorkingHour.branch: đơn 1.
- BranchOnboardingProgress.branch: đơn 1.
- BranchBookingPolicy.branch: đơn 1.
- BranchHoliday.branch: đơn 1.
- SpecialWorkingDay.branch: đơn 1.
- StaffBranchAssignment.branch: đơn 1.
- BranchImage.branch: đơn 1.
- BranchServiceOffering.branch: đơn 1.
- Combo.branch: đơn 1.
- PromotionBranch.branch: đơn 1.
- Booking.branch: đơn 1.
- RecurringBookingPlan.branch: đơn 1.
- PricingSnapshot.branch: đơn 1.
- PaymentPolicy.branch: đơn 0..1.
- PaymentPolicySnapshot.branch: đơn 1.
- PaymentIntent.branch: đơn 1.
- PaymentTransaction.branch: đơn 1.
- FinancialLedgerEntry.branch: đơn 1.
- PlatformFeeEntry.branch: đơn 1.
- PlatformFeeAdjustment.branch: đơn 1.
- TreatmentPackage.branch: đơn 0..1.
- PackagePurchase.branch: đơn 0..1.
- SalonMember.branch: đơn 0..1.
- TrustAction.branch: đơn 0..1.
- BranchDocument.branch: đơn 1.
- BranchReviewRequest.branch: đơn 1.
- BranchReviewEvent.branch: đơn 1.
- ConsultationFormTemplate.branch: đơn 0..1.
- ConsultationSubmission.branch: đơn 1.
- ConsentEvent.branch: đơn 1.
- SensitiveDataAccessEvent.branch: đơn 1.
- SensitiveBreakGlassGrant.branch: đơn 1.
- BranchStateTransition.ref_branchId: đơn 1.
- PriceAdjustment.ref_branchId: đơn 1.
- PromotionRedemption.ref_branchId: đơn 1.
- VoucherRedemption.ref_branchId: đơn 1.
- OperationalImpactCase.ref_branchId: đơn 0..1.
- OperationalImpactItem.ref_replacementBranchId: đơn 0..1.
- WaitlistEntry.ref_branchId: đơn 1.
- LoyaltyRule.ref_branchId: đơn 0..1.
- Invoice.ref_branchId: đơn 1.
- InvoiceInformationRequest.branch: đơn 1.
- VoucherBranchScope.branch: đơn 1.

Index declarations:

- `@@index([businessId])`
- `@@index([districtId])`
- `@@index([status])`
- `@@index([reviewStatus])`
- `@@index([operationalStatus])`
- `@@index([status, deletedAt, createdAt])`
- `@@index([latitude, longitude])`

## BranchWorkingHour

SQL table: `branch_working_hours`; schema.prisma:549. PK: (id). Unique: (branchId, dayOfWeek).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 550 |
| branchId | branch_id | String | Không | 551 |
| dayOfWeek | day_of_week | Int | Không | 552 |
| openTime | open_time | DateTime | Không | 553 |
| closeTime | close_time | DateTime | Không | 554 |
| isClosed | is_closed | Boolean | Không | 555 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.workingHours: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## BranchOnboardingProgress

SQL table: `branch_onboarding_progress`; schema.prisma:562. PK: (id). Unique: (branchId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 563 |
| branchId | branch_id | String | Không | 564 |
| currentStep | current_step | Int | Không | 565 |
| completedSteps | completed_steps | Json | Không | 566 |
| draftData | draft_data | Json | Có | 567 |
| createdAt | created_at | DateTime | Không | 568 |
| updatedAt | updated_at | DateTime | Không | 569 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.onboardingProgress: đơn 0..1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## BranchBookingPolicy

SQL table: `branch_booking_policies`; schema.prisma:575. PK: (id). Unique: (branchId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 576 |
| branchId | branch_id | String | Không | 577 |
| leadTimeMinutes | lead_time_minutes | Int | Không | 578 |
| bookingHorizonDays | booking_horizon_days | Int | Không | 579 |
| cancellationHours | cancellation_hours | Int | Không | 580 |
| rescheduleHours | reschedule_hours | Int | Không | 581 |
| noShowHandling | no_show_handling | String | Có | 582 |
| earlyCheckInMinutes | early_check_in_minutes | Int | Không | 583 |
| gracePeriodMinutes | grace_period_minutes | Int | Không | 584 |
| allowWalkIn | allow_walk_in | Boolean | Không | 585 |
| allowCounterBooking | allow_counter_booking | Boolean | Không | 586 |
| defaultBufferMinutes | default_buffer_minutes | Int | Không | 587 |
| overbookingEnabled | overbooking_enabled | Boolean | Không | 588 |
| maxOverbookedSlots | max_overbooked_slots | Int | Không | 589 |
| depositPolicy | deposit_policy | Json | Có | 590 |
| confirmedAt | confirmed_at | DateTime | Có | 591 |
| createdAt | created_at | DateTime | Không | 592 |
| updatedAt | updated_at | DateTime | Không | 593 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.bookingPolicy: đơn 0..1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## OverbookingOverride

SQL table: `overbooking_overrides`; schema.prisma:599. PK: (id). Unique: (bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 600 |
| bookingId | booking_id | String | Không | 601 |
| branchId | branch_id | String | Không | 602 |
| actorId | actor_id | String | Không | 603 |
| reason | reason | String | Không | 604 |
| policyLimit | policy_limit | Int | Không | 605 |
| startAt | start_at | DateTime | Không | 606 |
| endAt | end_at | DateTime | Không | 607 |
| createdAt | created_at | DateTime | Không | 608 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Booking.overbookingOverride: đơn 0..1.

Index declarations:

- `@@index([branchId, startAt, endAt])`

## BranchHoliday

SQL table: `branch_holidays`; schema.prisma:615. PK: (id). Unique: (branchId, date).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 616 |
| branchId | branch_id | String | Không | 617 |
| date | date | DateTime | Không | 618 |
| name | name | String | Không | 619 |
| isClosed | is_closed | Boolean | Không | 620 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.holidays: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## SpecialWorkingDay

SQL table: `special_working_days`; schema.prisma:627. PK: (id). Unique: (branchId, date).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 628 |
| branchId | branch_id | String | Không | 629 |
| date | date | DateTime | Không | 630 |
| startTime | start_time | DateTime | Không | 631 |
| endTime | end_time | DateTime | Không | 632 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.specialDays: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## StaffBranchAssignment

SQL table: `staff_branch_assignments`; schema.prisma:639. PK: (id). Unique: (staffId, branchId, startDate).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 640 |
| staffId | staff_id | String | Không | 641 |
| branchId | branch_id | String | Không | 642 |
| startDate | start_date | DateTime | Không | 643 |
| endDate | end_date | DateTime | Có | 644 |
| status | status | StaffAssignmentStatus | Không | 645 |
| jobTitle | job_title | String | Có | 646 |
| isPrimary | is_primary | Boolean | Không | 647 |
| isBookable | is_bookable | Boolean | Không | 648 |
| createdAt | created_at | DateTime | Không | 649 |
| updatedAt | updated_at | DateTime | Không | 650 |

Quan hệ có local FK:

- `staffId` → StaffProfile(id); field staff; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- StaffProfile.branchAssignments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.staffAssignments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([branchId, status, startDate])`
- `@@index([staffId, status, startDate])`

## MediaFile

SQL table: `media_files`; schema.prisma:660. PK: (id). Unique: (storageKey).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 661 |
| url | url | String | Không | 662 |
| storageKey | storage_key | String | Có | 663 |
| originalName | original_name | String | Có | 664 |
| safeName | safe_name | String | Có | 665 |
| mimeType | mime_type | String | Có | 666 |
| extension | extension | String | Có | 667 |
| fileType | file_type | String | Có | 668 |
| fileSize | file_size | Int | Có | 669 |
| uploadedBy | uploaded_by | String | Có | 670 |
| businessId | business_id | String | Có | 671 |
| branchId | branch_id | String | Có | 672 |
| entityType | entity_type | String | Có | 673 |
| entityId | entity_id | String | Có | 674 |
| visibility | visibility | MediaVisibility | Không | 675 |
| createdAt | created_at | DateTime | Không | 676 |
| updatedAt | updated_at | DateTime | Không | 677 |

Quan hệ có local FK:

- `uploadedBy` → User(id); field uploader; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=MediaUploader.

Relation fields của các model trỏ tới model này:

- User.uploadedMedia: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.avatarMedia: đơn 0..1.
- Business.logoMedia: đơn 0..1.
- BusinessImage.media: đơn 1.
- BranchImage.media: đơn 1.
- ServiceImage.media: đơn 1.
- ComboImage.media: đơn 1.
- StaffImage.media: đơn 1.
- BusinessDocumentVersion.media: đơn 1.
- BranchDocumentVersion.media: đơn 1.

Index declarations:

- `@@index([uploadedBy])`
- `@@index([businessId, branchId])`
- `@@index([entityType, entityId])`

## BusinessImage

SQL table: `business_images`; schema.prisma:695. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 696 |
| businessId | business_id | String | Không | 697 |
| mediaId | media_id | String | Không | 698 |
| isCover | is_cover | Boolean | Không | 699 |
| sortOrder | sort_order | Int | Không | 700 |
| createdAt | created_at | DateTime | Không | 701 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `mediaId` → MediaFile(id); field media; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.images: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- MediaFile.businessImages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId])`

## BranchImage

SQL table: `branch_images`; schema.prisma:709. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 710 |
| branchId | branch_id | String | Không | 711 |
| mediaId | media_id | String | Không | 712 |
| isCover | is_cover | Boolean | Không | 713 |
| sortOrder | sort_order | Int | Không | 714 |
| createdAt | created_at | DateTime | Không | 715 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `mediaId` → MediaFile(id); field media; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.images: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- MediaFile.branchImages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([branchId])`

## ServiceImage

SQL table: `service_images`; schema.prisma:723. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 724 |
| serviceId | service_id | String | Không | 725 |
| mediaId | media_id | String | Không | 726 |
| sortOrder | sort_order | Int | Không | 727 |
| createdAt | created_at | DateTime | Không | 728 |

Quan hệ có local FK:

- `mediaId` → MediaFile(id); field media; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- MediaFile.serviceImages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.images: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([serviceId])`

## ComboImage

SQL table: `combo_images`; schema.prisma:736. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 737 |
| comboId | combo_id | String | Không | 738 |
| mediaId | media_id | String | Không | 739 |
| sortOrder | sort_order | Int | Không | 740 |
| createdAt | created_at | DateTime | Không | 741 |

Quan hệ có local FK:

- `comboId` → Combo(id); field combo; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `mediaId` → MediaFile(id); field media; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- MediaFile.comboImages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Combo.images: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([comboId])`

## StaffImage

SQL table: `staff_images`; schema.prisma:749. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 750 |
| staffId | staff_id | String | Không | 751 |
| mediaId | media_id | String | Không | 752 |
| sortOrder | sort_order | Int | Không | 753 |
| createdAt | created_at | DateTime | Không | 754 |

Quan hệ có local FK:

- `mediaId` → MediaFile(id); field media; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `staffId` → StaffProfile(id); field staff; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- StaffProfile.images: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- MediaFile.staffImages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([staffId])`

## ServiceCategory

SQL table: `service_categories`; schema.prisma:762. PK: (id). Unique: (businessId, slug).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 763 |
| businessId | business_id | String | Không | 764 |
| parentId | parent_id | String | Có | 765 |
| name | name | String | Không | 766 |
| slug | slug | String | Không | 767 |
| createdAt | created_at | DateTime | Không | 768 |
| updatedAt | updated_at | DateTime | Không | 769 |
| deletedAt | deleted_at | DateTime | Có | 770 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `parentId` → ServiceCategory(id); field parent; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=CategoryTree.

Relation fields của các model trỏ tới model này:

- Business.serviceCategories: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ServiceCategory.parent: đơn 0..1.
- ServiceCategory.children: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessService.category: đơn 1.
- BranchServiceOffering.category: đơn 1.

Index declarations:

- `@@index([businessId, deletedAt])`
- `@@index([parentId])`

## CanonicalService

SQL table: `canonical_services`; schema.prisma:785. PK: (id). Unique: (code); (slug).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 786 |
| code | code | String | Không | 787 |
| slug | slug | String | Không | 788 |
| name | name | String | Không | 789 |
| description | description | String | Có | 790 |
| parentId | parent_id | String | Có | 791 |
| replacementCanonicalId | replacement_canonical_id | String | Có | 792 |
| synonyms | synonyms | String[] | Không | 793 |
| status | status | CanonicalServiceStatus | Không | 794 |
| createdAt | created_at | DateTime | Không | 795 |
| updatedAt | updated_at | DateTime | Không | 796 |

Quan hệ có local FK:

- `parentId` → CanonicalService(id); field parent; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=CanonicalTree.
- `replacementCanonicalId` → CanonicalService(id); field replacement; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=CanonicalReplacement.

Relation fields của các model trỏ tới model này:

- CanonicalService.parent: đơn 0..1.
- CanonicalService.children: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- CanonicalService.replacement: đơn 0..1.
- CanonicalService.replacedCanonicals: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessService.canonicalService: đơn 0..1.
- BookingService.canonicalService: đơn 0..1.

Index declarations:

- `@@index([parentId])`
- `@@index([replacementCanonicalId])`
- `@@index([status, name])`

## BusinessService

SQL table: `business_services`; schema.prisma:812. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 813 |
| businessId | business_id | String | Không | 814 |
| categoryId | category_id | String | Không | 815 |
| canonicalServiceId | canonical_service_id | String | Có | 816 |
| name | name | String | Không | 817 |
| description | description | String | Có | 818 |
| keywords | keywords | String[] | Không | 819 |
| mappingStatus | mapping_status | ServiceMappingStatus | Không | 820 |
| basePrice | base_price | Decimal | Không | 821 |
| baseDurationMinutes | base_duration_minutes | Int | Không | 822 |
| status | status | ServiceStatus | Không | 823 |
| createdAt | created_at | DateTime | Không | 824 |
| updatedAt | updated_at | DateTime | Không | 825 |
| deletedAt | deleted_at | DateTime | Có | 826 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `categoryId` → ServiceCategory(id); field category; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `canonicalServiceId` → CanonicalService(id); field canonicalService; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.serviceCatalog: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ServiceCategory.businessServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- CanonicalService.businessServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.businessService: đơn 1.
- BookingService.businessService: đơn 1.

Index declarations:

- `@@index([businessId, status, deletedAt])`
- `@@index([categoryId])`
- `@@index([canonicalServiceId, mappingStatus])`

## BranchServiceOffering

SQL table: `services`; schema.prisma:841. PK: (id). Unique: (branchId, businessServiceId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 842 |
| branchId | branch_id | String | Không | 843 |
| businessServiceId | business_service_id | String | Không | 844 |
| categoryId | category_id | String | Không | 845 |
| name | name | String | Không | 846 |
| description | description | String | Có | 847 |
| price | price | Decimal | Không | 848 |
| durationMinutes | duration_minutes | Int | Không | 849 |
| bookable | bookable | Boolean | Không | 850 |
| status | status | ServiceStatus | Không | 851 |
| createdAt | created_at | DateTime | Không | 852 |
| updatedAt | updated_at | DateTime | Không | 853 |
| deletedAt | deleted_at | DateTime | Có | 854 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `businessServiceId` → BusinessService(id); field businessService; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `categoryId` → ServiceCategory(id); field category; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.services: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ServiceImage.service: đơn 1.
- ServiceCategory.services: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessService.branchServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- StaffService.service: đơn 1.
- ComboService.service: đơn 1.
- PromotionService.service: đơn 1.
- BookingService.service: đơn 1.
- PaymentPolicy.service: đơn 0..1.
- ServiceConsultationRequirement.service: đơn 1.
- ConsultationSubmission.service: đơn 1.
- ConsentEvent.service: đơn 1.
- ServiceVariant.ref_serviceId: đơn 1.
- ServicePriceRule.ref_serviceId: đơn 1.
- ServiceDependency.ref_serviceId: đơn 1.
- ServiceDependency.ref_requiredServiceId: đơn 1.
- WaitlistEntry.ref_serviceId: đơn 1.
- CustomerSavedService.offering: đơn 1.
- VoucherServiceScope.service: đơn 1.

Index declarations:

- `@@index([branchId])`
- `@@index([businessServiceId])`
- `@@index([categoryId])`
- `@@index([status])`
- `@@index([branchId, status, deletedAt, createdAt])`
- `@@index([price])`

## StaffService

SQL table: `staff_services`; schema.prisma:885. PK: (staffId, serviceId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| staffId | staff_id | String | Không | 886 |
| serviceId | service_id | String | Không | 887 |
| createdAt | created_at | DateTime | Không | 888 |

Quan hệ có local FK:

- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `staffId` → StaffProfile(id); field staff; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- StaffProfile.staffServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.staffServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([serviceId])`

## Combo

SQL table: `combos`; schema.prisma:897. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 898 |
| businessId | business_id | String | Không | 899 |
| branchId | branch_id | String | Không | 900 |
| name | name | String | Không | 901 |
| description | description | String | Có | 902 |
| comboPrice | combo_price | Decimal | Không | 903 |
| validFrom | valid_from | DateTime | Có | 904 |
| validTo | valid_to | DateTime | Có | 905 |
| maxUsage | max_usage | Int | Có | 906 |
| usedCount | used_count | Int | Không | 907 |
| status | status | ComboStatus | Không | 908 |
| pricingMode | pricing_mode | ComboPricingMode | Không | 909 |
| staffAssignmentMode | staff_assignment_mode | ComboStaffAssignmentMode | Không | 910 |
| version | version | Int | Không | 911 |
| createdAt | created_at | DateTime | Không | 912 |
| updatedAt | updated_at | DateTime | Không | 913 |
| deletedAt | deleted_at | DateTime | Có | 914 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.combos: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.combos: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ComboImage.combo: đơn 1.
- ComboService.combo: đơn 1.
- PromotionCombo.combo: đơn 1.
- BookingService.combo: đơn 0..1.
- RecurringBookingPlan.combo: đơn 0..1.
- VoucherComboScope.combo: đơn 1.

Index declarations:

- `@@index([branchId])`
- `@@index([businessId, status])`
- `@@index([status])`

## ComboService

SQL table: `combo_services`; schema.prisma:930. PK: (comboId, serviceId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| comboId | combo_id | String | Không | 931 |
| serviceId | service_id | String | Không | 932 |
| quantity | quantity | Int | Không | 933 |
| sortOrder | sort_order | Int | Không | 934 |
| priceSnapshot | price_snapshot | Decimal | Không | 935 |
| durationSnapshot | duration_snapshot | Int | Không | 936 |
| transitionMinutes | transition_minutes | Int | Không | 937 |

Quan hệ có local FK:

- `comboId` → Combo(id); field combo; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- BranchServiceOffering.comboServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Combo.comboServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([serviceId])`
- `@@index([comboId, sortOrder])`

## Promotion

SQL table: `promotions`; schema.prisma:947. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 948 |
| name | name | String | Không | 949 |
| description | description | String | Có | 950 |
| discountType | discount_type | DiscountType | Không | 951 |
| discountValue | discount_value | Decimal | Không | 952 |
| startDate | start_date | DateTime | Không | 953 |
| endDate | end_date | DateTime | Không | 954 |
| status | status | PromotionStatus | Không | 955 |
| createdAt | created_at | DateTime | Không | 956 |
| updatedAt | updated_at | DateTime | Không | 957 |
| deletedAt | deleted_at | DateTime | Có | 958 |
| businessId | business_id | String | Có | 959 |
| createdByPlatform | created_by_platform | Boolean | Không | 960 |
| audience | audience | VoucherAudience | Không | 961 |
| totalQuantity | total_quantity | Int | Có | 962 |
| maxUsagePerCustomer | max_usage_per_customer | Int | Không | 963 |
| autoApply | auto_apply | Boolean | Không | 964 |
| stackingAllowed | stacking_allowed | Boolean | Không | 965 |
| version | version | Int | Không | 966 |

Quan hệ có local FK:

- `businessId` → Business(id); field businessOwner; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=PromotionOwner.

Relation fields của các model trỏ tới model này:

- Business.ownedPromotions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PromotionBusiness.promotion: đơn 1.
- PromotionBranch.promotion: đơn 1.
- PromotionService.promotion: đơn 1.
- PromotionCombo.promotion: đơn 1.
- PromotionRedemption.ref_promotionId: đơn 1.

Index declarations:

- `@@index([status])`
- `@@index([startDate, endDate])`
- `@@index([businessId])`

## PromotionBusiness

SQL table: `promotion_businesses`; schema.prisma:980. PK: (promotionId, businessId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| promotionId | promotion_id | String | Không | 981 |
| businessId | business_id | String | Không | 982 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `promotionId` → Promotion(id); field promotion; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.promotionLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Promotion.businessLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId])`

## PromotionBranch

SQL table: `promotion_branches`; schema.prisma:991. PK: (promotionId, branchId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| promotionId | promotion_id | String | Không | 992 |
| branchId | branch_id | String | Không | 993 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `promotionId` → Promotion(id); field promotion; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.promotionLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Promotion.branchLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([branchId])`

## PromotionService

SQL table: `promotion_services`; schema.prisma:1002. PK: (promotionId, serviceId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| promotionId | promotion_id | String | Không | 1003 |
| serviceId | service_id | String | Không | 1004 |

Quan hệ có local FK:

- `promotionId` → Promotion(id); field promotion; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- BranchServiceOffering.promotionLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Promotion.serviceLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([serviceId])`

## PromotionCombo

SQL table: `promotion_combos`; schema.prisma:1013. PK: (promotionId, comboId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| promotionId | promotion_id | String | Không | 1014 |
| comboId | combo_id | String | Không | 1015 |

Quan hệ có local FK:

- `comboId` → Combo(id); field combo; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `promotionId` → Promotion(id); field promotion; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Combo.promotionLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Promotion.comboLinks: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([comboId])`

## Booking

SQL table: `bookings`; schema.prisma:1024. PK: (id). Unique: (bookingCode).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1025 |
| customerId | customer_id | String | Không | 1026 |
| branchId | branch_id | String | Không | 1027 |
| recurringPlanId | recurring_plan_id | String | Có | 1028 |
| bookingCode | booking_code | String | Không | 1029 |
| appointmentDate | appointment_date | DateTime | Không | 1030 |
| appointmentStartTime | appointment_start_time | DateTime | Không | 1031 |
| appointmentEndTime | appointment_end_time | DateTime | Không | 1032 |
| status | status | BookingStatus | Không | 1033 |
| source | source | BookingSource | Không | 1034 |
| pendingExpiresAt | pending_expires_at | DateTime | Có | 1035 |
| totalAmount | total_amount | Decimal | Không | 1036 |
| note | note | String | Có | 1037 |
| cancelReason | cancel_reason | String | Có | 1038 |
| cancelledAt | cancelled_at | DateTime | Có | 1039 |
| cancelledBy | cancelled_by | String | Có | 1040 |
| createdAt | created_at | DateTime | Không | 1041 |
| updatedAt | updated_at | DateTime | Không | 1042 |
| deletedAt | deleted_at | DateTime | Có | 1043 |
| cancelledByType | cancelled_by_type | CancelledByType | Có | 1044 |
| cancellationFeeAmount | cancellation_fee_amount | Decimal | Có | 1045 |
| finalAmount | final_amount | Decimal | Có | 1046 |
| voucherDiscountAmount | voucher_discount_amount | Decimal | Có | 1047 |
| voucherId | voucher_id | String | Có | 1048 |
| sensitiveDataConsent | sensitive_data_consent | Boolean | Không | 1049 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `cancelledBy` → User(id); field cancelledByUser; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=BookingCancelledBy.
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `recurringPlanId` → RecurringBookingPlan(id); field recurringPlan; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `voucherId` → Voucher(id); field voucher; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.cancelledBookings: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- CustomerProfile.bookings: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BookingContact.booking: đơn 1.
- Branch.bookings: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- OverbookingOverride.booking: đơn 1.
- BookingService.booking: đơn 1.
- BookingStatusHistory.booking: đơn 1.
- RecurringBookingPlan.bookings: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Payment.booking: đơn 1.
- PricingSnapshot.booking: đơn 1.
- PaymentPolicySnapshot.booking: đơn 1.
- PaymentIntent.booking: đơn 0..1.
- PaymentTransaction.booking: đơn 0..1.
- FinancialLedgerEntry.booking: đơn 0..1.
- PlatformFeeEntry.booking: đơn 1.
- PackageSessionEntitlement.booking: đơn 0..1.
- Review.booking: đơn 1.
- Notification.relatedBooking: đơn 0..1.
- NotificationOutbox.relatedBooking: đơn 0..1.
- Voucher.bookings: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- AppointmentChangeRequest.booking: đơn 1.
- BookingHealthRecord.booking: đơn 1.
- ConsultationSubmission.booking: đơn 1.
- ConsentEvent.booking: đơn 1.
- SensitiveDataAccessEvent.booking: đơn 1.
- SensitiveBreakGlassGrant.booking: đơn 1.
- PriceAdjustment.ref_bookingId: đơn 0..1.
- PromotionRedemption.ref_bookingId: đơn 1.
- VoucherRedemption.ref_bookingId: đơn 1.
- BookingServiceAdjustment.ref_bookingId: đơn 1.
- OperationalImpactItem.ref_bookingId: đơn 1.
- WaitlistEntry.ref_bookingId: đơn 0..1.
- LoyaltyTransaction.ref_bookingId: đơn 0..1.
- Invoice.ref_bookingId: đơn 0..1.
- InvoiceInformationRequest.booking: đơn 1.

Index declarations:

- `@@index([customerId])`
- `@@index([branchId])`
- `@@index([appointmentDate])`
- `@@index([status])`
- `@@index([status, pendingExpiresAt])`
- `@@index([branchId, appointmentDate, status])`

## BookingService

SQL table: `booking_services`; schema.prisma:1095. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1096 |
| bookingId | booking_id | String | Không | 1097 |
| serviceId | service_id | String | Không | 1098 |
| businessServiceId | business_service_id | String | Không | 1099 |
| canonicalServiceId | canonical_service_id | String | Có | 1100 |
| comboId | combo_id | String | Có | 1101 |
| staffId | staff_id | String | Có | 1102 |
| variantId | variant_id | String | Có | 1103 |
| priceAtBooking | price_at_booking | Decimal | Không | 1104 |
| durationMinutes | duration_minutes | Int | Không | 1105 |
| serviceNameSnapshot | service_name_snapshot | String | Không | 1106 |
| sortOrder | sort_order | Int | Không | 1107 |
| status | status | BookingServiceStatus | Không | 1108 |
| itemStartAt | item_start_at | DateTime | Có | 1109 |
| itemEndAt | item_end_at | DateTime | Có | 1110 |
| transitionMinutes | transition_minutes | Int | Không | 1111 |
| comboVersion | combo_version | Int | Có | 1112 |
| revision | revision | Int | Không | 1113 |
| skippedReason | skipped_reason | String | Có | 1114 |
| createdAt | created_at | DateTime | Không | 1115 |
| updatedAt | updated_at | DateTime | Không | 1116 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `comboId` → Combo(id); field combo; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `businessServiceId` → BusinessService(id); field businessService; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `canonicalServiceId` → CanonicalService(id); field canonicalService; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `staffId` → StaffProfile(id); field staff; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- StaffProfile.bookingServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- CanonicalService.bookingServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessService.bookingServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.bookingServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Combo.bookingServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.bookingServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- RefundAllocation.bookingService: đơn 0..1.
- PackageSessionEntitlement.redeemedBookingService: đơn 0..1.
- ReviewServiceRating.bookingService: đơn 1.
- BookingServiceAdjustment.ref_bookingServiceId: đơn 1.
- InvoiceLine.ref_bookingServiceId: đơn 0..1.

Index declarations:

- `@@index([bookingId])`
- `@@index([serviceId])`
- `@@index([businessServiceId])`
- `@@index([canonicalServiceId])`
- `@@index([staffId])`

## BookingStatusHistory

SQL table: `booking_status_histories`; schema.prisma:1137. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1138 |
| bookingId | booking_id | String | Không | 1139 |
| status | status | BookingStatus | Không | 1140 |
| changedBy | changed_by | String | Có | 1141 |
| note | note | String | Có | 1142 |
| createdAt | created_at | DateTime | Không | 1143 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `changedBy` → User(id); field changedByUser; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=StatusChangedBy.

Relation fields của các model trỏ tới model này:

- User.statusChanges: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.statusHistory: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([bookingId])`

## RecurringBookingPlan

SQL table: `recurring_booking_plans`; schema.prisma:1151. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1152 |
| customerId | customer_id | String | Không | 1153 |
| branchId | branch_id | String | Không | 1154 |
| frequency | frequency | RecurrenceFrequency | Không | 1155 |
| serviceIds | service_ids | Json | Không | 1156 |
| comboId | combo_id | String | Có | 1157 |
| staffId | staff_id | String | Có | 1158 |
| staffMode | staff_mode | RecurringStaffMode | Không | 1159 |
| preferredTime | preferred_time | String | Không | 1160 |
| occurrenceCount | occurrence_count | Int | Không | 1161 |
| createdOccurrenceCount | created_occurrence_count | Int | Không | 1162 |
| failureReason | failure_reason | String | Có | 1163 |
| dayOfWeek | day_of_week | Int | Có | 1164 |
| dayOfMonth | day_of_month | Int | Có | 1165 |
| startDate | start_date | DateTime | Không | 1166 |
| endDate | end_date | DateTime | Có | 1167 |
| status | status | RecurringPlanStatus | Không | 1168 |
| createdAt | created_at | DateTime | Không | 1169 |
| updatedAt | updated_at | DateTime | Không | 1170 |
| deletedAt | deleted_at | DateTime | Có | 1171 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `comboId` → Combo(id); field combo; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `staffId` → StaffProfile(id); field staff; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.recurringPlans: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- StaffProfile.recurringPlans: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.recurringPlans: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Combo.recurringPlans: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.recurringPlan: đơn 0..1.

Index declarations:

- `@@index([customerId])`
- `@@index([branchId, status])`

## Payment

SQL table: `payments`; schema.prisma:1183. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1184 |
| bookingId | booking_id | String | Không | 1185 |
| amount | amount | Decimal | Không | 1186 |
| method | method | PaymentMethod | Không | 1187 |
| status | status | PaymentStatus | Không | 1188 |
| transactionRef | transaction_ref | String | Có | 1189 |
| paidAt | paid_at | DateTime | Có | 1190 |
| createdAt | created_at | DateTime | Không | 1191 |
| updatedAt | updated_at | DateTime | Không | 1192 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Booking.payments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- RefundRequest.payment: đơn 1.
- PaymentTransaction.payment: đơn 0..1.
- FinancialLedgerEntry.payment: đơn 0..1.
- Invoice.ref_paymentId: đơn 0..1.

Index declarations:

- `@@index([bookingId])`
- `@@index([status])`
- `@@index([createdAt])`

## RefundRequest

SQL table: `refund_requests`; schema.prisma:1205. PK: (id). Unique: (settlementReference).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1206 |
| paymentId | payment_id | String | Không | 1207 |
| amount | amount | Decimal | Không | 1208 |
| reason | reason | String | Không | 1209 |
| evidence | evidence | Json | Có | 1210 |
| status | status | RefundStatus | Không | 1211 |
| requestedBy | requested_by | String | Không | 1212 |
| reviewedBy | reviewed_by | String | Có | 1213 |
| reviewNote | review_note | String | Có | 1214 |
| reviewedAt | reviewed_at | DateTime | Có | 1215 |
| processingStartedAt | processing_started_at | DateTime | Có | 1216 |
| processedAt | processed_at | DateTime | Có | 1217 |
| processedBy | processed_by | String | Có | 1218 |
| settlementReference | settlement_reference | String | Có | 1219 |
| failureReason | failure_reason | String | Có | 1220 |
| createdAt | created_at | DateTime | Không | 1221 |
| updatedAt | updated_at | DateTime | Không | 1222 |

Quan hệ có local FK:

- `paymentId` → Payment(id); field payment; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Payment.refundRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- FinancialLedgerEntry.refund: đơn 0..1.
- RefundAllocation.refund: đơn 1.
- PlatformFeeAdjustment.refund: đơn 0..1.
- LoyaltyTransaction.ref_refundRequestId: đơn 0..1.

Index declarations:

- `@@index([paymentId, status])`
- `@@index([requestedBy])`

## PricingSnapshot

SQL table: `pricing_snapshots`; schema.prisma:1236. PK: (id). Unique: (bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1237 |
| bookingId | booking_id | String | Không | 1238 |
| businessId | business_id | String | Không | 1239 |
| branchId | branch_id | String | Không | 1240 |
| currency | currency | String | Không | 1241 |
| subtotalAmount | subtotal_amount | Decimal | Không | 1242 |
| discountAmount | discount_amount | Decimal | Không | 1243 |
| finalAmount | final_amount | Decimal | Không | 1244 |
| items | items | Json | Không | 1245 |
| capturedAt | captured_at | DateTime | Không | 1246 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.pricingSnapshots: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.pricingSnapshots: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.pricingSnapshot: đơn 0..1.

Index declarations:

- `@@index([businessId, capturedAt])`
- `@@index([branchId, capturedAt])`

## PaymentPolicy

SQL table: `payment_policies`; schema.prisma:1256. PK: (id). Unique: (businessId, branchId, serviceId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1257 |
| businessId | business_id | String | Không | 1258 |
| branchId | branch_id | String | Có | 1259 |
| serviceId | service_id | String | Có | 1260 |
| name | name | String | Không | 1261 |
| version | version | Int | Không | 1262 |
| status | status | PolicyVersionStatus | Không | 1263 |
| depositType | deposit_type | DepositType | Không | 1264 |
| depositValue | deposit_value | Decimal | Không | 1265 |
| allowSplitPayment | allow_split_payment | Boolean | Không | 1266 |
| allowInstallments | allow_installments | Boolean | Không | 1267 |
| effectiveFrom | effective_from | DateTime | Không | 1268 |
| effectiveTo | effective_to | DateTime | Có | 1269 |
| createdBy | created_by | String | Không | 1270 |
| createdAt | created_at | DateTime | Không | 1271 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.paymentPolicies: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.paymentPolicies: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.paymentPolicies: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PaymentPolicySnapshot.paymentPolicy: đơn 0..1.

Index declarations:

- `@@index([businessId, status, effectiveFrom, effectiveTo])`
- `@@index([branchId, status])`

## PaymentPolicySnapshot

SQL table: `payment_policy_snapshots`; schema.prisma:1283. PK: (id). Unique: (bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1284 |
| bookingId | booking_id | String | Không | 1285 |
| businessId | business_id | String | Không | 1286 |
| branchId | branch_id | String | Không | 1287 |
| paymentPolicyId | payment_policy_id | String | Có | 1288 |
| policyVersion | policy_version | Int | Có | 1289 |
| depositType | deposit_type | DepositType | Không | 1290 |
| depositValue | deposit_value | Decimal | Không | 1291 |
| requiredAmount | required_amount | Decimal | Không | 1292 |
| allowSplitPayment | allow_split_payment | Boolean | Không | 1293 |
| allowInstallments | allow_installments | Boolean | Không | 1294 |
| capturedAt | captured_at | DateTime | Không | 1295 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `paymentPolicyId` → PaymentPolicy(id); field paymentPolicy; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.paymentPolicySnapshots: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.paymentPolicySnapshots: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.paymentPolicySnapshot: đơn 0..1.
- PaymentPolicy.snapshots: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId, capturedAt])`

## PaymentIntent

SQL table: `payment_intents`; schema.prisma:1305. PK: (id). Unique: (idempotencyKey).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1306 |
| bookingId | booking_id | String | Có | 1307 |
| packagePurchaseId | package_purchase_id | String | Có | 1308 |
| packageInstallmentId | package_installment_id | String | Có | 1309 |
| businessId | business_id | String | Không | 1310 |
| branchId | branch_id | String | Không | 1311 |
| amount | amount | Decimal | Không | 1312 |
| currency | currency | String | Không | 1313 |
| method | method | PaymentMethod | Không | 1314 |
| provider | provider | String | Không | 1315 |
| status | status | PaymentIntentStatus | Không | 1316 |
| idempotencyKey | idempotency_key | String | Không | 1317 |
| expiresAt | expires_at | DateTime | Có | 1318 |
| metadata | metadata | Json | Có | 1319 |
| createdBy | created_by | String | Không | 1320 |
| createdAt | created_at | DateTime | Không | 1321 |
| updatedAt | updated_at | DateTime | Không | 1322 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `packagePurchaseId` → PackagePurchase(id); field packagePurchase; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `packageInstallmentId` → PackageInstallment(id); field packageInstallment; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.paymentIntents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.paymentIntents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.paymentIntents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PaymentTransaction.intent: đơn 0..1.
- PackagePurchase.paymentIntents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PackageInstallment.paymentIntents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([bookingId, status])`
- `@@index([packagePurchaseId, status])`
- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`

## PaymentTransaction

SQL table: `payment_transactions`; schema.prisma:1339. PK: (id). Unique: (idempotencyKey); (providerEventId); (reversalOfId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1340 |
| intentId | intent_id | String | Có | 1341 |
| paymentId | payment_id | String | Có | 1342 |
| bookingId | booking_id | String | Có | 1343 |
| packagePurchaseId | package_purchase_id | String | Có | 1344 |
| packageInstallmentId | package_installment_id | String | Có | 1345 |
| businessId | business_id | String | Không | 1346 |
| branchId | branch_id | String | Không | 1347 |
| amount | amount | Decimal | Không | 1348 |
| currency | currency | String | Không | 1349 |
| method | method | PaymentMethod | Không | 1350 |
| provider | provider | String | Không | 1351 |
| status | status | PaymentTransactionStatus | Không | 1352 |
| transactionRef | transaction_ref | String | Có | 1353 |
| idempotencyKey | idempotency_key | String | Không | 1354 |
| providerEventId | provider_event_id | String | Có | 1355 |
| evidence | evidence | Json | Có | 1356 |
| verifiedBy | verified_by | String | Có | 1357 |
| verifiedAt | verified_at | DateTime | Có | 1358 |
| reversalOfId | reversal_of_id | String | Có | 1359 |
| failureReason | failure_reason | String | Có | 1360 |
| createdAt | created_at | DateTime | Không | 1361 |

Quan hệ có local FK:

- `intentId` → PaymentIntent(id); field intent; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=(implicit).
- `paymentId` → Payment(id); field payment; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `packagePurchaseId` → PackagePurchase(id); field packagePurchase; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `packageInstallmentId` → PackageInstallment(id); field packageInstallment; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `reversalOfId` → PaymentTransaction(id); field reversalOf; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=PaymentTransactionReversal.

Relation fields của các model trỏ tới model này:

- Business.paymentTransactions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.paymentTransactions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.paymentTransactions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Payment.transactions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PaymentIntent.transactions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PaymentTransaction.reversalOf: đơn 0..1.
- PaymentTransaction.reversedBy: đơn 0..1.
- FinancialLedgerEntry.paymentTransaction: đơn 0..1.
- PackagePurchase.paymentTransactions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PackageInstallment.paymentTransactions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([bookingId, status])`
- `@@index([packagePurchaseId, status])`
- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`

## FinancialLedgerEntry

SQL table: `financial_ledger_entries`; schema.prisma:1382. PK: (id). Unique: (idempotencyKey).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1383 |
| businessId | business_id | String | Không | 1384 |
| branchId | branch_id | String | Không | 1385 |
| bookingId | booking_id | String | Có | 1386 |
| paymentId | payment_id | String | Có | 1387 |
| paymentTransactionId | payment_transaction_id | String | Có | 1388 |
| refundId | refund_id | String | Có | 1389 |
| type | type | FinancialLedgerType | Không | 1390 |
| direction | direction | LedgerDirection | Không | 1391 |
| amount | amount | Decimal | Không | 1392 |
| currency | currency | String | Không | 1393 |
| sourceType | source_type | String | Không | 1394 |
| sourceId | source_id | String | Không | 1395 |
| idempotencyKey | idempotency_key | String | Không | 1396 |
| actorId | actor_id | String | Có | 1397 |
| correlationId | correlation_id | String | Có | 1398 |
| metadata | metadata | Json | Có | 1399 |
| occurredAt | occurred_at | DateTime | Không | 1400 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `paymentId` → Payment(id); field payment; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `paymentTransactionId` → PaymentTransaction(id); field paymentTransaction; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `refundId` → RefundRequest(id); field refund; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.financialLedgerEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.financialLedgerEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.financialLedgerEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Payment.ledgerEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- RefundRequest.ledgerEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PaymentTransaction.ledgerEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId, occurredAt])`
- `@@index([branchId, occurredAt])`
- `@@index([bookingId, occurredAt])`
- `@@index([sourceType, sourceId])`

## RefundAllocation

SQL table: `refund_allocations`; schema.prisma:1415. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1416 |
| refundId | refund_id | String | Không | 1417 |
| bookingServiceId | booking_service_id | String | Có | 1418 |
| amount | amount | Decimal | Không | 1419 |
| createdAt | created_at | DateTime | Không | 1420 |

Quan hệ có local FK:

- `refundId` → RefundRequest(id); field refund; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `bookingServiceId` → BookingService(id); field bookingService; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- BookingService.refundAllocations: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- RefundRequest.allocations: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([refundId])`
- `@@index([bookingServiceId])`

## PlatformFeeEntry

SQL table: `platform_fee_entries`; schema.prisma:1429. PK: (id). Unique: (bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1430 |
| businessId | business_id | String | Không | 1431 |
| branchId | branch_id | String | Không | 1432 |
| bookingId | booking_id | String | Không | 1433 |
| baseAmount | base_amount | Decimal | Không | 1434 |
| feeRate | fee_rate | Decimal | Không | 1435 |
| feeAmount | fee_amount | Decimal | Không | 1436 |
| currency | currency | String | Không | 1437 |
| status | status | PlatformFeeStatus | Không | 1438 |
| calculationSnapshot | calculation_snapshot | Json | Không | 1439 |
| createdAt | created_at | DateTime | Không | 1440 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.platformFeeEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.platformFeeEntries: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.platformFeeEntry: đơn 0..1.
- PlatformFeeAdjustment.platformFee: đơn 1.
- PlatformStatementLine.platformFee: đơn 0..1.

Index declarations:

- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`

## PlatformFeeAdjustment

SQL table: `platform_fee_adjustments`; schema.prisma:1452. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1453 |
| platformFeeId | platform_fee_id | String | Không | 1454 |
| businessId | business_id | String | Không | 1455 |
| branchId | branch_id | String | Không | 1456 |
| refundId | refund_id | String | Có | 1457 |
| amount | amount | Decimal | Không | 1458 |
| reason | reason | String | Không | 1459 |
| createdAt | created_at | DateTime | Không | 1460 |

Quan hệ có local FK:

- `platformFeeId` → PlatformFeeEntry(id); field platformFee; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `refundId` → RefundRequest(id); field refund; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.platformFeeAdjustments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.platformFeeAdjustments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- RefundRequest.platformFeeAdjustments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PlatformFeeEntry.adjustments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PlatformStatementLine.feeAdjustment: đơn 0..1.

Index declarations:

- `@@index([platformFeeId, createdAt])`
- `@@index([businessId, createdAt])`

## PlatformStatement

SQL table: `platform_statements`; schema.prisma:1472. PK: (id). Unique: (businessId, periodStart, periodEnd, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1473 |
| businessId | business_id | String | Không | 1474 |
| periodStart | period_start | DateTime | Không | 1475 |
| periodEnd | period_end | DateTime | Không | 1476 |
| version | version | Int | Không | 1477 |
| status | status | PlatformStatementStatus | Không | 1478 |
| currency | currency | String | Không | 1479 |
| grossFeeAmount | gross_fee_amount | Decimal | Không | 1480 |
| adjustmentAmount | adjustment_amount | Decimal | Không | 1481 |
| netAmount | net_amount | Decimal | Không | 1482 |
| issuedAt | issued_at | DateTime | Có | 1483 |
| paidAt | paid_at | DateTime | Có | 1484 |
| lockedAt | locked_at | DateTime | Có | 1485 |
| createdAt | created_at | DateTime | Không | 1486 |
| updatedAt | updated_at | DateTime | Không | 1487 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.platformStatements: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PlatformStatementLine.statement: đơn 1.

Index declarations:

- `@@index([businessId, status, periodStart])`

## PlatformStatementLine

SQL table: `platform_statement_lines`; schema.prisma:1496. PK: (id). Unique: (statementId, platformFeeId, feeAdjustmentId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1497 |
| statementId | statement_id | String | Không | 1498 |
| platformFeeId | platform_fee_id | String | Có | 1499 |
| feeAdjustmentId | fee_adjustment_id | String | Có | 1500 |
| lineType | line_type | StatementLineType | Không | 1501 |
| amount | amount | Decimal | Không | 1502 |
| sourceSnapshot | source_snapshot | Json | Không | 1503 |
| createdAt | created_at | DateTime | Không | 1504 |

Quan hệ có local FK:

- `statementId` → PlatformStatement(id); field statement; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `platformFeeId` → PlatformFeeEntry(id); field platformFee; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `feeAdjustmentId` → PlatformFeeAdjustment(id); field feeAdjustment; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- PlatformFeeEntry.statementLines: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PlatformFeeAdjustment.statementLines: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PlatformStatement.lines: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([statementId])`

## TreatmentPackage

SQL table: `treatment_packages`; schema.prisma:1514. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1515 |
| businessId | business_id | String | Không | 1516 |
| branchId | branch_id | String | Có | 1517 |
| name | name | String | Không | 1518 |
| description | description | String | Có | 1519 |
| totalPrice | total_price | Decimal | Không | 1520 |
| currency | currency | String | Không | 1521 |
| sessionCount | session_count | Int | Không | 1522 |
| validityDays | validity_days | Int | Không | 1523 |
| status | status | TreatmentPackageStatus | Không | 1524 |
| createdAt | created_at | DateTime | Không | 1525 |
| updatedAt | updated_at | DateTime | Không | 1526 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.treatmentPackages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.treatmentPackages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PackagePurchase.package: đơn 1.

Index declarations:

- `@@index([businessId, status])`
- `@@index([branchId, status])`

## PackagePurchase

SQL table: `package_purchases`; schema.prisma:1536. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1537 |
| packageId | package_id | String | Không | 1538 |
| customerId | customer_id | String | Không | 1539 |
| businessId | business_id | String | Không | 1540 |
| branchId | branch_id | String | Có | 1541 |
| totalAmount | total_amount | Decimal | Không | 1542 |
| paidAmount | paid_amount | Decimal | Không | 1543 |
| currency | currency | String | Không | 1544 |
| status | status | PackagePurchaseStatus | Không | 1545 |
| pricingSnapshot | pricing_snapshot | Json | Không | 1546 |
| purchasedAt | purchased_at | DateTime | Không | 1547 |
| expiresAt | expires_at | DateTime | Không | 1548 |

Quan hệ có local FK:

- `packageId` → TreatmentPackage(id); field package; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.packagePurchases: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.packagePurchases: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.packagePurchases: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PaymentIntent.packagePurchase: đơn 0..1.
- PaymentTransaction.packagePurchase: đơn 0..1.
- TreatmentPackage.purchases: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PackageInstallment.purchase: đơn 1.
- PackageSessionEntitlement.purchase: đơn 1.

Index declarations:

- `@@index([customerId, status])`
- `@@index([businessId, status])`

## PackageInstallment

SQL table: `package_installments`; schema.prisma:1563. PK: (id). Unique: (purchaseId, sequence).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1564 |
| purchaseId | purchase_id | String | Không | 1565 |
| sequence | sequence | Int | Không | 1566 |
| dueAt | due_at | DateTime | Không | 1567 |
| amount | amount | Decimal | Không | 1568 |
| status | status | PackageInstallmentStatus | Không | 1569 |
| paymentIntentId | payment_intent_id | String | Có | 1570 |
| paidAt | paid_at | DateTime | Có | 1571 |

Quan hệ có local FK:

- `purchaseId` → PackagePurchase(id); field purchase; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- PaymentIntent.packageInstallment: đơn 0..1.
- PaymentTransaction.packageInstallment: đơn 0..1.
- PackagePurchase.installments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([status, dueAt])`

## PackageSessionEntitlement

SQL table: `package_session_entitlements`; schema.prisma:1581. PK: (id). Unique: (purchaseId, sequence); (redeemedBookingServiceId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1582 |
| purchaseId | purchase_id | String | Không | 1583 |
| sequence | sequence | Int | Không | 1584 |
| status | status | PackageEntitlementStatus | Không | 1585 |
| bookingId | booking_id | String | Có | 1586 |
| redeemedBookingServiceId | redeemed_booking_service_id | String | Có | 1587 |
| reservedAt | reserved_at | DateTime | Có | 1588 |
| redeemedAt | redeemed_at | DateTime | Có | 1589 |

Quan hệ có local FK:

- `purchaseId` → PackagePurchase(id); field purchase; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=(implicit).
- `redeemedBookingServiceId` → BookingService(id); field redeemedBookingService; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Booking.packageEntitlements: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BookingService.packageEntitlement: đơn 0..1.
- PackagePurchase.entitlements: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([purchaseId, status])`

## Review

SQL table: `reviews`; schema.prisma:1599. PK: (id). Unique: (bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1600 |
| bookingId | booking_id | String | Không | 1601 |
| customerId | customer_id | String | Không | 1602 |
| overallRating | overall_rating | Int | Không | 1603 |
| comment | comment | String | Có | 1604 |
| isAnonymous | is_anonymous | Boolean | Không | 1605 |
| status | status | ReviewStatus | Không | 1606 |
| createdAt | created_at | DateTime | Không | 1607 |
| updatedAt | updated_at | DateTime | Không | 1608 |
| deletedAt | deleted_at | DateTime | Có | 1609 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.reviews: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.review: đơn 0..1.
- ReviewServiceRating.review: đơn 1.
- BusinessComment.review: đơn 0..1.
- ReviewReport.review: đơn 1.
- ReviewModerationEvent.ref_reviewId: đơn 1.
- ReviewAppeal.ref_reviewId: đơn 1.

Index declarations:

- `@@index([customerId])`
- `@@index([status])`
- `@@index([status, deletedAt, bookingId])`

## ReviewServiceRating

SQL table: `review_service_ratings`; schema.prisma:1624. PK: (id). Unique: (bookingServiceId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1625 |
| reviewId | review_id | String | Không | 1626 |
| bookingServiceId | booking_service_id | String | Không | 1627 |
| staffId | staff_id | String | Có | 1628 |
| rating | rating | Int | Không | 1629 |
| comment | comment | String | Có | 1630 |
| createdAt | created_at | DateTime | Không | 1631 |

Quan hệ có local FK:

- `bookingServiceId` → BookingService(id); field bookingService; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `reviewId` → Review(id); field review; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `staffId` → StaffProfile(id); field staff; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- StaffProfile.reviewRatings: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BookingService.reviewRating: đơn 0..1.
- Review.serviceRatings: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([reviewId])`
- `@@index([staffId])`

## BusinessComment

SQL table: `business_comments`; schema.prisma:1641. PK: (id). Unique: (reviewId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1642 |
| businessId | business_id | String | Không | 1643 |
| customerId | customer_id | String | Không | 1644 |
| parentCommentId | parent_comment_id | String | Có | 1645 |
| reviewId | review_id | String | Có | 1646 |
| content | content | String | Không | 1647 |
| status | status | CommentStatus | Không | 1648 |
| createdAt | created_at | DateTime | Không | 1649 |
| updatedAt | updated_at | DateTime | Không | 1650 |
| deletedAt | deleted_at | DateTime | Có | 1651 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `parentCommentId` → BusinessComment(id); field parent; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=CommentReplies.
- `reviewId` → Review(id); field review; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.comments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.comments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Review.businessReply: đơn 0..1.
- BusinessComment.parent: đơn 0..1.
- BusinessComment.replies: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId])`
- `@@index([parentCommentId])`

## Notification

SQL table: `notifications`; schema.prisma:1663. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1664 |
| userId | user_id | String | Không | 1665 |
| type | type | NotificationType | Không | 1666 |
| severity | severity | NotificationSeverity | Không | 1667 |
| title | title | String | Không | 1668 |
| body | body | String | Có | 1669 |
| isRead | is_read | Boolean | Không | 1670 |
| readAt | read_at | DateTime | Có | 1671 |
| targetType | target_type | String | Có | 1672 |
| targetId | target_id | String | Có | 1673 |
| actionUrl | action_url | String | Có | 1674 |
| metadata | metadata | Json | Có | 1675 |
| relatedBookingId | related_booking_id | String | Có | 1676 |
| createdAt | created_at | DateTime | Không | 1677 |

Quan hệ có local FK:

- `relatedBookingId` → Booking(id); field relatedBooking; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `userId` → User(id); field user; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.notifications: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.notifications: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- NotificationOutbox.notification: đơn 0..1.

Index declarations:

- `@@index([userId])`
- `@@index([isRead])`
- `@@index([userId, isRead])`

## NotificationOutbox

SQL table: `notification_outbox`; schema.prisma:1691. PK: (id). Unique: (dedupeKey); (notificationId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1692 |
| userId | user_id | String | Không | 1693 |
| type | type | NotificationType | Không | 1694 |
| severity | severity | NotificationSeverity | Không | 1695 |
| title | title | String | Không | 1696 |
| body | body | String | Có | 1697 |
| targetType | target_type | String | Có | 1698 |
| targetId | target_id | String | Có | 1699 |
| actionUrl | action_url | String | Có | 1700 |
| metadata | metadata | Json | Có | 1701 |
| relatedBookingId | related_booking_id | String | Có | 1702 |
| dedupeKey | dedupe_key | String | Không | 1703 |
| status | status | NotificationOutboxStatus | Không | 1704 |
| attempts | attempts | Int | Không | 1705 |
| availableAt | available_at | DateTime | Không | 1706 |
| lastError | last_error | String | Có | 1707 |
| sentAt | sent_at | DateTime | Có | 1708 |
| notificationId | notification_id | String | Có | 1709 |
| createdAt | created_at | DateTime | Không | 1710 |
| updatedAt | updated_at | DateTime | Không | 1711 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `relatedBookingId` → Booking(id); field relatedBooking; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `notificationId` → Notification(id); field notification; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.notificationOutboxes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.notificationOutboxes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Notification.outbox: đơn 0..1.

Index declarations:

- `@@index([status, availableAt])`
- `@@index([userId, createdAt])`

## AuditLog

SQL table: `audit_logs`; schema.prisma:1721. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1722 |
| userId | user_id | String | Có | 1723 |
| action | action | AuditAction | Không | 1724 |
| entityType | entity_type | String | Không | 1725 |
| entityId | entity_id | String | Có | 1726 |
| oldData | old_data | Json | Có | 1727 |
| newData | new_data | Json | Có | 1728 |
| createdAt | created_at | DateTime | Không | 1729 |
| reason | reason | String | Có | 1730 |

Quan hệ có local FK:

- `userId` → User(id); field user; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.auditLogs: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([userId])`
- `@@index([entityType])`
- `@@index([entityId])`

## SalonMember

SQL table: `salon_members`; schema.prisma:1739. PK: (id). Unique: (userId, businessId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1740 |
| userId | user_id | String | Không | 1741 |
| businessId | business_id | String | Không | 1742 |
| branchId | branch_id | String | Có | 1743 |
| role | role | SalonMemberRole | Không | 1744 |
| isActive | is_active | Boolean | Không | 1745 |
| createdAt | created_at | DateTime | Không | 1746 |
| updatedAt | updated_at | DateTime | Không | 1747 |
| deletedAt | deleted_at | DateTime | Có | 1748 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `userId` → User(id); field user; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- User.salonMemberships: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.members: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.salonMembers: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId])`
- `@@index([branchId])`

## CancellationPolicy

SQL table: `cancellation_policies`; schema.prisma:1759. PK: (id). Unique: (businessId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1760 |
| businessId | business_id | String | Không | 1761 |
| freeCancelHours | free_cancel_hours | Int | Không | 1762 |
| lateCancelFeePercent | late_cancel_fee_percent | Int | Không | 1765 |
| noShowFeePercent | no_show_fee_percent | Int | Không | 1766 |
| rescheduleAllowedHours | reschedule_allowed_hours | Int | Không | 1767 |
| notes | notes | String | Có | 1768 |
| updatedBy | updated_by | String | Có | 1769 |
| createdAt | created_at | DateTime | Không | 1770 |
| updatedAt | updated_at | DateTime | Không | 1771 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.cancellationPolicy: đơn 0..1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## Voucher

SQL table: `vouchers`; schema.prisma:1777. PK: (id). Unique: (code).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1778 |
| code | code | String | Không | 1779 |
| name | name | String | Không | 1780 |
| description | description | String | Có | 1781 |
| discountType | discount_type | DiscountType | Không | 1782 |
| discountValue | discount_value | Decimal | Không | 1783 |
| minOrderValue | min_order_value | Decimal | Không | 1784 |
| maxDiscount | max_discount | Decimal | Có | 1785 |
| totalQuantity | total_quantity | Int | Không | 1786 |
| usedQuantity | used_quantity | Int | Không | 1787 |
| startDate | start_date | DateTime | Không | 1788 |
| endDate | end_date | DateTime | Không | 1789 |
| status | status | VoucherStatus | Không | 1790 |
| createdAt | created_at | DateTime | Không | 1791 |
| updatedAt | updated_at | DateTime | Không | 1792 |
| deletedAt | deleted_at | DateTime | Có | 1793 |
| businessId | business_id | String | Có | 1794 |
| scope | scope | VoucherScope | Không | 1795 |
| createdByPlatform | created_by_platform | Boolean | Không | 1796 |
| audience | audience | VoucherAudience | Không | 1797 |
| maxUsagePerCustomer | max_usage_per_customer | Int | Không | 1798 |
| autoIssue | auto_issue | Boolean | Không | 1799 |
| version | version | Int | Không | 1800 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.vouchers: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.voucher: đơn 0..1.
- CustomerVoucher.voucher: đơn 1.
- VoucherRedemption.ref_voucherId: đơn 1.
- VoucherBranchScope.voucher: đơn 1.
- VoucherServiceScope.voucher: đơn 1.
- VoucherComboScope.voucher: đơn 1.

Index declarations:

- `@@index([status])`
- `@@index([startDate, endDate])`
- `@@index([businessId, scope])`

## CustomerVoucher

SQL table: `customer_vouchers`; schema.prisma:1815. PK: (id). Unique: (voucherId, customerId); (usedBookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1816 |
| voucherId | voucher_id | String | Không | 1817 |
| customerId | customer_id | String | Không | 1818 |
| status | status | VoucherStatus | Không | 1819 |
| acquiredAt | acquired_at | DateTime | Không | 1820 |
| usedAt | used_at | DateTime | Có | 1821 |
| reservedAt | reserved_at | DateTime | Có | 1822 |
| usedBookingId | used_booking_id | String | Có | 1823 |
| expiresAt | expires_at | DateTime | Có | 1824 |

Quan hệ có local FK:

- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `voucherId` → Voucher(id); field voucher; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.customerVouchers: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Voucher.customerVouchers: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- VoucherRedemption.ref_customerVoucherId: đơn 0..1.

Index declarations:

- `@@index([customerId])`

## AppointmentChangeRequest

SQL table: `appointment_change_requests`; schema.prisma:1834. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1835 |
| bookingId | booking_id | String | Không | 1836 |
| requestedBy | requested_by | String | Không | 1837 |
| requestedByType | requested_by_type | CancelledByType | Không | 1838 |
| requestType | request_type | ChangeRequestType | Không | 1839 |
| proposedStartTime | proposed_start_time | DateTime | Có | 1840 |
| proposedEndTime | proposed_end_time | DateTime | Có | 1841 |
| proposedStaffId | proposed_staff_id | String | Có | 1842 |
| reason | reason | String | Có | 1843 |
| status | status | ChangeRequestStatus | Không | 1844 |
| reviewedBy | reviewed_by | String | Có | 1845 |
| reviewedAt | reviewed_at | DateTime | Có | 1846 |
| reviewNote | review_note | String | Có | 1847 |
| expiresAt | expires_at | DateTime | Không | 1848 |
| createdAt | created_at | DateTime | Không | 1849 |
| updatedAt | updated_at | DateTime | Không | 1850 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `proposedStaffId` → StaffProfile(id); field proposedStaff; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=ChangeRequestProposedStaff.
- `requestedBy` → User(id); field requestedByUser; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=ChangeRequestRequestedBy.
- `reviewedBy` → User(id); field reviewer; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=ChangeRequestReviewedBy.

Relation fields của các model trỏ tới model này:

- User.changeRequestsRequested: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.changeRequestsReviewed: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- StaffProfile.changeRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.changeRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([bookingId])`
- `@@index([status])`

## SalonTrustSnapshot

SQL table: `salon_trust_snapshots`; schema.prisma:1861. PK: (id). Unique: (businessId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1862 |
| businessId | business_id | String | Không | 1863 |
| totalBookings | total_bookings | Int | Không | 1864 |
| cancellationRate | cancellation_rate | Float | Không | 1865 |
| noShowRate | no_show_rate | Float | Không | 1866 |
| avgRejectTimeMinutes | avg_reject_time_minutes | Float | Không | 1867 |
| lateCancelBySalonRate | late_cancel_by_salon_rate | Float | Không | 1868 |
| trustScore | trust_score | Float | Không | 1869 |
| alertLevel | alert_level | String | Không | 1870 |
| computedAt | computed_at | DateTime | Không | 1871 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.trustSnapshot: đơn 0..1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## TrustAction

SQL table: `trust_actions`; schema.prisma:1877. PK: (id). Unique: (restoreOfActionId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1878 |
| businessId | business_id | String | Không | 1879 |
| branchId | branch_id | String | Có | 1880 |
| actorId | actor_id | String | Không | 1881 |
| action | action | TrustActionType | Không | 1882 |
| reason | reason | String | Không | 1883 |
| internalNote | internal_note | String | Có | 1884 |
| statusBefore | status_before | String | Có | 1885 |
| statusAfter | status_after | String | Có | 1886 |
| restoreOfActionId | restore_of_action_id | String | Có | 1887 |
| createdAt | created_at | DateTime | Không | 1888 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=(implicit).
- `actorId` → User(id); field actor; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=TrustActionActor.
- `restoreOfActionId` → TrustAction(id); field restoreOf; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=TrustActionRestore.

Relation fields của các model trỏ tới model này:

- User.trustActions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.trustActions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.trustActions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- TrustAction.restoreOf: đơn 0..1.
- TrustAction.restoredBy: đơn 0..1.

Index declarations:

- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`

## BusinessReviewEvent

SQL table: `business_review_events`; schema.prisma:1900. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1901 |
| businessId | business_id | String | Không | 1902 |
| actorId | actor_id | String | Có | 1903 |
| action | action | String | Không | 1904 |
| fromStatus | from_status | BusinessStatus | Có | 1905 |
| toStatus | to_status | BusinessStatus | Không | 1906 |
| reason | reason | String | Có | 1907 |
| createdAt | created_at | DateTime | Không | 1908 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `actorId` → User(id); field actor; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=BusinessReviewActor.

Relation fields của các model trỏ tới model này:

- User.businessReviewEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.reviewEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId, createdAt])`

## BusinessDocument

SQL table: `business_documents`; schema.prisma:1916. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1917 |
| businessId | business_id | String | Không | 1918 |
| documentType | document_type | BusinessDocumentType | Không | 1919 |
| documentNumber | document_number | String | Có | 1920 |
| expiresAt | expires_at | DateTime | Có | 1921 |
| status | status | BusinessDocumentStatus | Không | 1922 |
| currentVersion | current_version | Int | Không | 1923 |
| createdAt | created_at | DateTime | Không | 1924 |
| updatedAt | updated_at | DateTime | Không | 1925 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.documents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessDocumentVersion.document: đơn 1.
- DocumentReviewEvent.document: đơn 1.

Index declarations:

- `@@index([businessId, documentType, status])`

## BusinessDocumentVersion

SQL table: `business_document_versions`; schema.prisma:1934. PK: (id). Unique: (documentId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1935 |
| documentId | document_id | String | Không | 1936 |
| version | version | Int | Không | 1937 |
| mediaId | media_id | String | Không | 1938 |
| documentName | document_name | String | Không | 1939 |
| note | note | String | Có | 1940 |
| createdBy | created_by | String | Không | 1941 |
| createdAt | created_at | DateTime | Không | 1942 |

Quan hệ có local FK:

- `documentId` → BusinessDocument(id); field document; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `mediaId` → MediaFile(id); field media; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `createdBy` → User(id); field creator; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=BusinessDocumentVersionCreator.

Relation fields của các model trỏ tới model này:

- User.businessDocumentVersions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- MediaFile.businessDocumentVersions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessDocument.versions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([mediaId])`

## BranchDocument

SQL table: `branch_documents`; schema.prisma:1952. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1953 |
| branchId | branch_id | String | Không | 1954 |
| documentType | document_type | BranchDocumentType | Không | 1955 |
| documentNumber | document_number | String | Có | 1956 |
| issuedAt | issued_at | DateTime | Có | 1957 |
| expiresAt | expires_at | DateTime | Có | 1958 |
| status | status | BranchDocumentStatus | Không | 1959 |
| currentVersion | current_version | Int | Không | 1960 |
| createdAt | created_at | DateTime | Không | 1961 |
| updatedAt | updated_at | DateTime | Không | 1962 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.documents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchDocumentVersion.document: đơn 1.

Index declarations:

- `@@index([branchId, documentType, status])`

## BranchDocumentVersion

SQL table: `branch_document_versions`; schema.prisma:1970. PK: (id). Unique: (documentId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1971 |
| documentId | document_id | String | Không | 1972 |
| version | version | Int | Không | 1973 |
| mediaId | media_id | String | Không | 1974 |
| documentName | document_name | String | Không | 1975 |
| note | note | String | Có | 1976 |
| createdBy | created_by | String | Không | 1977 |
| createdAt | created_at | DateTime | Không | 1978 |

Quan hệ có local FK:

- `documentId` → BranchDocument(id); field document; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `mediaId` → MediaFile(id); field media; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `createdBy` → User(id); field creator; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=BranchDocumentVersionCreator.

Relation fields của các model trỏ tới model này:

- User.branchDocumentVersions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- MediaFile.branchDocumentVersions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchDocument.versions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([mediaId])`

## BranchReviewRequest

SQL table: `branch_review_requests`; schema.prisma:1988. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 1989 |
| branchId | branch_id | String | Không | 1990 |
| requestedBy | requested_by | String | Không | 1991 |
| status | status | BranchReviewStatus | Không | 1992 |
| profileSnapshot | profile_snapshot | Json | Không | 1993 |
| documentSnapshot | document_snapshot | Json | Có | 1994 |
| riskSnapshot | risk_snapshot | Json | Có | 1995 |
| assignedTo | assigned_to | String | Có | 1996 |
| dueAt | due_at | DateTime | Có | 1997 |
| submittedAt | submitted_at | DateTime | Không | 1998 |
| resolvedAt | resolved_at | DateTime | Có | 1999 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `requestedBy` → User(id); field requester; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=BranchReviewRequester.
- `assignedTo` → User(id); field reviewer; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=BranchReviewReviewer.

Relation fields của các model trỏ tới model này:

- User.branchReviewRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.branchReviewAssignments: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.reviewRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([branchId, submittedAt])`
- `@@index([status, submittedAt])`

## BranchReviewEvent

SQL table: `branch_review_events`; schema.prisma:2009. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2010 |
| branchId | branch_id | String | Không | 2011 |
| actorId | actor_id | String | Có | 2012 |
| action | action | String | Không | 2013 |
| fromStatus | from_status | BranchReviewStatus | Có | 2014 |
| toStatus | to_status | BranchReviewStatus | Không | 2015 |
| reason | reason | String | Có | 2016 |
| targetStep | target_step | Int | Có | 2017 |
| deadline | deadline | DateTime | Có | 2018 |
| createdAt | created_at | DateTime | Không | 2019 |

Quan hệ có local FK:

- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `actorId` → User(id); field actor; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=BranchReviewActor.

Relation fields của các model trỏ tới model này:

- User.branchReviewEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.reviewEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([branchId, createdAt])`

## DocumentReviewEvent

SQL table: `document_review_events`; schema.prisma:2027. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2028 |
| documentId | document_id | String | Không | 2029 |
| actorId | actor_id | String | Có | 2030 |
| action | action | DocumentReviewAction | Không | 2031 |
| fromStatus | from_status | BusinessDocumentStatus | Có | 2032 |
| toStatus | to_status | BusinessDocumentStatus | Không | 2033 |
| reason | reason | String | Có | 2034 |
| createdAt | created_at | DateTime | Không | 2035 |

Quan hệ có local FK:

- `documentId` → BusinessDocument(id); field document; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `actorId` → User(id); field actor; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=DocumentReviewActor.

Relation fields của các model trỏ tới model này:

- User.documentReviewEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessDocument.reviewEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([documentId, createdAt])`

## ReviewReport

SQL table: `review_reports`; schema.prisma:2043. PK: (id). Unique: (reviewId, reporterId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2044 |
| reviewId | review_id | String | Không | 2045 |
| reporterId | reporter_id | String | Không | 2046 |
| reason | reason | String | Không | 2047 |
| createdAt | created_at | DateTime | Không | 2048 |

Quan hệ có local FK:

- `reviewId` → Review(id); field review; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `reporterId` → User(id); field reporter; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=ReviewReporter.

Relation fields của các model trỏ tới model này:

- User.reviewReports: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Review.reports: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([reviewId, createdAt])`

## SensitiveConsent

SQL table: `sensitive_consents`; schema.prisma:2057. PK: (id). Unique: (customerId, scope).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2058 |
| customerId | customer_id | String | Không | 2059 |
| scope | scope | ConsentScope | Không | 2060 |
| granted | granted | Boolean | Không | 2061 |
| grantedAt | granted_at | DateTime | Không | 2062 |
| revokedAt | revoked_at | DateTime | Có | 2063 |
| policyVersion | policy_version | String | Không | 2064 |
| ip | ip | String | Có | 2065 |

Quan hệ có local FK:

- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.consents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BookingHealthRecord.consent: đơn 1.

Index declarations:

- `@@index([customerId])`

## BookingHealthRecord

SQL table: `booking_health_records`; schema.prisma:2074. PK: (id). Unique: (bookingId, field).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2075 |
| bookingId | booking_id | String | Không | 2076 |
| customerId | customer_id | String | Không | 2077 |
| consentId | consent_id | String | Không | 2078 |
| field | field | SensitiveDataField | Không | 2079 |
| payload | payload | Json | Không | 2081 |
| createdAt | created_at | DateTime | Không | 2082 |
| lastAccessedAt | last_accessed_at | DateTime | Có | 2084 |
| lastAccessedBy | last_accessed_by | String | Có | 2085 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `consentId` → SensitiveConsent(id); field consent; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.healthRecords: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.healthRecords: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- SensitiveConsent.healthRecords: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([customerId])`
- `@@index([consentId])`

## HealthRecordAccessLog

SQL table: `health_record_access_logs`; schema.prisma:2096. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2097 |
| actorId | actor_id | String | Có | 2098 |
| actorRole | actor_role | String | Có | 2099 |
| recordId | record_id | String | Có | 2100 |
| bookingId | booking_id | String | Có | 2101 |
| customerId | customer_id | String | Có | 2102 |
| businessId | business_id | String | Có | 2103 |
| branchId | branch_id | String | Có | 2104 |
| consentId | consent_id | String | Có | 2105 |
| purpose | purpose | String | Không | 2106 |
| action | action | String | Không | 2107 |
| result | result | String | Không | 2108 |
| ipAddress | ip_address | String | Có | 2109 |
| userAgent | user_agent | String | Có | 2110 |
| createdAt | created_at | DateTime | Không | 2111 |

Quan hệ có local FK:

- Không có relation field sở hữu FK trong model này.

Relation fields của các model trỏ tới model này:


Index declarations:

- `@@index([recordId, createdAt])`
- `@@index([actorId, createdAt])`
- `@@index([customerId, createdAt])`
- `@@index([businessId, branchId, createdAt])`

## ConsultationFormTemplate

SQL table: `consultation_form_templates`; schema.prisma:2120. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2121 |
| businessId | business_id | String | Không | 2122 |
| branchId | branch_id | String | Có | 2123 |
| name | name | String | Không | 2124 |
| description | description | String | Có | 2125 |
| status | status | ConsultationTemplateStatus | Không | 2126 |
| createdBy | created_by | String | Không | 2127 |
| createdAt | created_at | DateTime | Không | 2128 |
| updatedAt | updated_at | DateTime | Không | 2129 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 0..1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.consultationTemplates: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.consultationTemplates: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsultationFormVersion.template: đơn 1.
- ServiceConsultationRequirement.template: đơn 1.

Index declarations:

- `@@index([businessId, status])`
- `@@index([branchId, status])`

## ConsultationFormVersion

SQL table: `consultation_form_versions`; schema.prisma:2140. PK: (id). Unique: (templateId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2141 |
| templateId | template_id | String | Không | 2142 |
| version | version | Int | Không | 2143 |
| noticeVersion | notice_version | String | Không | 2144 |
| noticeHash | notice_hash | String | Không | 2145 |
| noticeContent | notice_content | String | Không | 2146 |
| purpose | purpose | String | Không | 2147 |
| recipientDescription | recipient_description | String | Không | 2148 |
| retentionDays | retention_days | Int | Không | 2149 |
| publishedAt | published_at | DateTime | Có | 2150 |
| createdAt | created_at | DateTime | Không | 2151 |

Quan hệ có local FK:

- `templateId` → ConsultationFormTemplate(id); field template; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- ConsultationFormTemplate.versions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsultationFormField.version: đơn 1.
- ConsultationSubmission.version: đơn 1.

Index declarations:

- `@@index([templateId, publishedAt])`

## ConsultationFormField

SQL table: `consultation_form_fields`; schema.prisma:2161. PK: (id). Unique: (versionId, fieldKey).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2162 |
| versionId | version_id | String | Không | 2163 |
| fieldKey | field_key | String | Không | 2164 |
| label | label | String | Không | 2165 |
| description | description | String | Có | 2166 |
| fieldType | field_type | ConsultationFieldType | Không | 2167 |
| dataCategory | data_category | SensitiveDataField | Có | 2168 |
| required | required | Boolean | Không | 2169 |
| options | options | Json | Có | 2170 |
| sortOrder | sort_order | Int | Không | 2171 |
| maxLength | max_length | Int | Có | 2172 |

Quan hệ có local FK:

- `versionId` → ConsultationFormVersion(id); field version; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- ConsultationFormVersion.fields: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- SensitiveAnswer.field: đơn 1.
- ConsentEvent.field: đơn 0..1.

Index declarations:

- `@@index([versionId, sortOrder])`

## ServiceConsultationRequirement

SQL table: `service_consultation_requirements`; schema.prisma:2182. PK: (id). Unique: (serviceId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2183 |
| serviceId | service_id | String | Không | 2184 |
| templateId | template_id | String | Không | 2185 |
| required | required | Boolean | Không | 2186 |
| timing | timing | ConsultationCompletionTiming | Không | 2187 |
| createdAt | created_at | DateTime | Không | 2188 |
| updatedAt | updated_at | DateTime | Không | 2189 |

Quan hệ có local FK:

- `templateId` → ConsultationFormTemplate(id); field template; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- BranchServiceOffering.consultationRequirement: đơn 0..1.
- ConsultationFormTemplate.requirements: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([templateId])`

## ConsultationSubmission

SQL table: `consultation_submissions`; schema.prisma:2197. PK: (id). Unique: (bookingId, serviceId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2198 |
| customerId | customer_id | String | Không | 2199 |
| businessId | business_id | String | Không | 2200 |
| branchId | branch_id | String | Không | 2201 |
| bookingId | booking_id | String | Không | 2202 |
| serviceId | service_id | String | Không | 2203 |
| versionId | version_id | String | Không | 2204 |
| status | status | ConsultationSubmissionStatus | Không | 2205 |
| requiresReview | requires_review | Boolean | Không | 2206 |
| submittedAt | submitted_at | DateTime | Có | 2207 |
| retentionUntil | retention_until | DateTime | Không | 2208 |
| legalHoldReason | legal_hold_reason | String | Có | 2209 |
| createdAt | created_at | DateTime | Không | 2210 |
| updatedAt | updated_at | DateTime | Không | 2211 |

Quan hệ có local FK:

- `versionId` → ConsultationFormVersion(id); field version; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.consultationSubmissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.consultationSubmissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.consultationSubmissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.consultationSubmissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.consultationSubmissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsultationFormVersion.submissions: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- SensitiveAnswer.submission: đơn 1.
- ConsentEvent.submission: đơn 1.
- SensitiveDataAccessEvent.submission: đơn 1.

Index declarations:

- `@@index([customerId, createdAt])`
- `@@index([businessId, branchId, status])`
- `@@index([retentionUntil, legalHoldReason])`

## SensitiveAnswer

SQL table: `sensitive_answers`; schema.prisma:2229. PK: (id). Unique: (submissionId, fieldId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2230 |
| submissionId | submission_id | String | Không | 2231 |
| fieldId | field_id | String | Không | 2232 |
| dataCategory | data_category | SensitiveDataField | Có | 2233 |
| valueType | value_type | SensitiveAnswerValueType | Không | 2234 |
| valueCiphertext | value_ciphertext | String | Không | 2235 |
| encryptionIv | encryption_iv | String | Không | 2236 |
| authenticationTag | authentication_tag | String | Không | 2237 |
| keyVersion | key_version | String | Không | 2238 |
| createdAt | created_at | DateTime | Không | 2239 |
| updatedAt | updated_at | DateTime | Không | 2240 |

Quan hệ có local FK:

- `submissionId` → ConsultationSubmission(id); field submission; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `fieldId` → ConsultationFormField(id); field field; phía đích 1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- ConsultationFormField.answers: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsultationSubmission.answers: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- SensitiveDataAccessEvent.answer: đơn 0..1.

Index declarations:

- `@@index([dataCategory])`

## ConsentEvent

SQL table: `consent_events`; schema.prisma:2250. PK: (id). Unique: (revokeOfEventId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2251 |
| customerId | customer_id | String | Không | 2252 |
| businessId | business_id | String | Không | 2253 |
| branchId | branch_id | String | Không | 2254 |
| bookingId | booking_id | String | Không | 2255 |
| serviceId | service_id | String | Không | 2256 |
| submissionId | submission_id | String | Không | 2257 |
| fieldId | field_id | String | Có | 2258 |
| dataCategory | data_category | SensitiveDataField | Có | 2259 |
| action | action | ConsentEventAction | Không | 2260 |
| purpose | purpose | String | Không | 2261 |
| recipientType | recipient_type | ConsentRecipientType | Không | 2262 |
| recipientId | recipient_id | String | Có | 2263 |
| assignedStaffId | assigned_staff_id | String | Có | 2264 |
| noticeVersion | notice_version | String | Không | 2265 |
| noticeHash | notice_hash | String | Không | 2266 |
| expiresAt | expires_at | DateTime | Không | 2267 |
| revokeOfEventId | revoke_of_event_id | String | Có | 2268 |
| ipAddress | ip_address | String | Có | 2269 |
| userAgent | user_agent | String | Có | 2270 |
| createdAt | created_at | DateTime | Không | 2271 |

Quan hệ có local FK:

- `submissionId` → ConsultationSubmission(id); field submission; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).
- `fieldId` → ConsultationFormField(id); field field; phía đích 0..1; onDelete=(không khai báo); onUpdate=(không khai báo); relation name=(implicit).
- `revokeOfEventId` → ConsentEvent(id); field revokeOf; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=ConsentEventRevocation.
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.consentEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.consultationConsentEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.consultationConsentEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.consultationConsentEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.consultationConsentEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsultationFormField.consentEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsultationSubmission.consentEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsentEvent.revokeOf: đơn 0..1.
- ConsentEvent.revokedBy: đơn 0..1.

Index declarations:

- `@@index([customerId, createdAt])`
- `@@index([bookingId, serviceId, createdAt])`
- `@@index([businessId, branchId, createdAt])`
- `@@index([submissionId, action])`

## SensitiveDataAccessEvent

SQL table: `sensitive_data_access_events`; schema.prisma:2289. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2290 |
| submissionId | submission_id | String | Không | 2291 |
| answerId | answer_id | String | Có | 2292 |
| actorId | actor_id | String | Không | 2293 |
| actorRole | actor_role | String | Không | 2294 |
| businessId | business_id | String | Không | 2295 |
| branchId | branch_id | String | Không | 2296 |
| bookingId | booking_id | String | Không | 2297 |
| purpose | purpose | String | Không | 2298 |
| result | result | SensitiveAccessResult | Không | 2299 |
| breakGlassGrantId | break_glass_grant_id | String | Có | 2300 |
| ipAddress | ip_address | String | Có | 2301 |
| userAgent | user_agent | String | Có | 2302 |
| createdAt | created_at | DateTime | Không | 2303 |

Quan hệ có local FK:

- `submissionId` → ConsultationSubmission(id); field submission; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `answerId` → SensitiveAnswer(id); field answer; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `breakGlassGrantId` → SensitiveBreakGlassGrant(id); field breakGlassGrant; phía đích 0..1; onDelete=SetNull; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.sensitiveAccessEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.sensitiveAccessEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.sensitiveAccessEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ConsultationSubmission.accessEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- SensitiveAnswer.accessEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- SensitiveBreakGlassGrant.accessEvents: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([submissionId, createdAt])`
- `@@index([actorId, createdAt])`
- `@@index([businessId, branchId, createdAt])`

## SensitiveBreakGlassGrant

SQL table: `sensitive_break_glass_grants`; schema.prisma:2317. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2318 |
| actorId | actor_id | String | Không | 2319 |
| businessId | business_id | String | Không | 2320 |
| branchId | branch_id | String | Không | 2321 |
| bookingId | booking_id | String | Không | 2322 |
| reason | reason | String | Không | 2323 |
| explanation | explanation | String | Không | 2324 |
| grantedBy | granted_by | String | Có | 2325 |
| expiresAt | expires_at | DateTime | Không | 2326 |
| revokedAt | revoked_at | DateTime | Có | 2327 |
| createdAt | created_at | DateTime | Không | 2328 |

Quan hệ có local FK:

- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Business.sensitiveBreakGlassGrants: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.sensitiveBreakGlassGrants: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.sensitiveBreakGlassGrants: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- SensitiveDataAccessEvent.breakGlassGrant: đơn 0..1.

Index declarations:

- `@@index([actorId, bookingId, expiresAt])`
- `@@index([businessId, branchId, createdAt])`

## DataSubjectRequest

SQL table: `data_subject_requests`; schema.prisma:2339. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2340 |
| customerId | customer_id | String | Không | 2341 |
| type | type | DataSubjectRequestType | Không | 2342 |
| status | status | DataSubjectRequestStatus | Không | 2343 |
| reason | reason | String | Có | 2344 |
| identityVerifiedAt | identity_verified_at | DateTime | Có | 2345 |
| legalHoldReason | legal_hold_reason | String | Có | 2346 |
| resolution | resolution | String | Có | 2347 |
| deadlineAt | deadline_at | DateTime | Không | 2348 |
| completedAt | completed_at | DateTime | Có | 2349 |
| createdAt | created_at | DateTime | Không | 2350 |
| updatedAt | updated_at | DateTime | Không | 2351 |

Quan hệ có local FK:

- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.dataSubjectRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PrivacyExportPackage.request: đơn 1.

Index declarations:

- `@@index([customerId, createdAt])`
- `@@index([status, deadlineAt])`

## BranchStateTransition

SQL table: `branch_state_transitions`; schema.prisma:2366. PK: (id). Unique: (branchId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2367 |
| branchId | branch_id | String | Không | 2368 |
| actorId | actor_id | String | Không | 2369 |
| fromStatus | from_status | String | Không | 2370 |
| toStatus | to_status | String | Không | 2371 |
| fromReviewStatus | from_review_status | String | Không | 2372 |
| toReviewStatus | to_review_status | String | Không | 2373 |
| fromOperationalStatus | from_operational_status | String | Không | 2374 |
| toOperationalStatus | to_operational_status | String | Không | 2375 |
| reason | reason | String | Không | 2376 |
| version | version | Int | Không | 2377 |
| createdAt | created_at | DateTime | Không | 2378 |

Quan hệ có local FK:

- `branchId` → Branch(id); field ref_branchId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_BranchStateTransition_branchId.
- `actorId` → User(id); field ref_actorId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_BranchStateTransition_actorId.

Relation fields của các model trỏ tới model này:

- User.refs_BranchStateTransition_actorId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_BranchStateTransition_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([branchId, createdAt])`

## PriceAdjustment

SQL table: `price_adjustments`; schema.prisma:2387. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2388 |
| bookingId | booking_id | String | Có | 2389 |
| branchId | branch_id | String | Không | 2390 |
| customerId | customer_id | String | Có | 2391 |
| type | type | PriceAdjustmentType | Không | 2392 |
| sourceId | source_id | String | Có | 2393 |
| sourceVersion | source_version | Int | Có | 2394 |
| label | label | String | Không | 2395 |
| amount | amount | Decimal | Không | 2396 |
| allocation | allocation | Json | Có | 2397 |
| ruleSnapshot | rule_snapshot | Json | Không | 2398 |
| status | status | PriceAdjustmentStatus | Không | 2399 |
| reservedAt | reserved_at | DateTime | Không | 2400 |
| appliedAt | applied_at | DateTime | Có | 2401 |
| releasedAt | released_at | DateTime | Có | 2402 |
| reversedAt | reversed_at | DateTime | Có | 2403 |
| createdAt | created_at | DateTime | Không | 2404 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field ref_bookingId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PriceAdjustment_bookingId.
- `branchId` → Branch(id); field ref_branchId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PriceAdjustment_branchId.
- `customerId` → CustomerProfile(id); field ref_customerId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PriceAdjustment_customerId.

Relation fields của các model trỏ tới model này:

- CustomerProfile.refs_PriceAdjustment_customerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_PriceAdjustment_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_PriceAdjustment_bookingId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([bookingId, status])`
- `@@index([branchId, createdAt])`
- `@@index([sourceId, status])`

## PromotionRedemption

SQL table: `promotion_redemptions`; schema.prisma:2415. PK: (id). Unique: (promotionId, bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2416 |
| promotionId | promotion_id | String | Không | 2417 |
| bookingId | booking_id | String | Không | 2418 |
| customerId | customer_id | String | Không | 2419 |
| branchId | branch_id | String | Không | 2420 |
| amount | amount | Decimal | Không | 2421 |
| status | status | RedemptionStatus | Không | 2422 |
| ruleSnapshot | rule_snapshot | Json | Không | 2423 |
| reservedAt | reserved_at | DateTime | Không | 2424 |
| appliedAt | applied_at | DateTime | Có | 2425 |
| releasedAt | released_at | DateTime | Có | 2426 |
| reversedAt | reversed_at | DateTime | Có | 2427 |
| createdAt | created_at | DateTime | Không | 2428 |

Quan hệ có local FK:

- `promotionId` → Promotion(id); field ref_promotionId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PromotionRedemption_promotionId.
- `bookingId` → Booking(id); field ref_bookingId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PromotionRedemption_bookingId.
- `customerId` → CustomerProfile(id); field ref_customerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PromotionRedemption_customerId.
- `branchId` → Branch(id); field ref_branchId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PromotionRedemption_branchId.

Relation fields của các model trỏ tới model này:

- CustomerProfile.refs_PromotionRedemption_customerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_PromotionRedemption_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Promotion.refs_PromotionRedemption_promotionId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_PromotionRedemption_bookingId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([promotionId, status])`
- `@@index([customerId, createdAt])`

## VoucherRedemption

SQL table: `voucher_redemptions`; schema.prisma:2440. PK: (id). Unique: (voucherId, bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2441 |
| voucherId | voucher_id | String | Không | 2442 |
| customerVoucherId | customer_voucher_id | String | Có | 2443 |
| customerId | customer_id | String | Không | 2444 |
| bookingId | booking_id | String | Không | 2445 |
| branchId | branch_id | String | Không | 2446 |
| amount | amount | Decimal | Không | 2447 |
| status | status | RedemptionStatus | Không | 2448 |
| ruleSnapshot | rule_snapshot | Json | Không | 2449 |
| reservedAt | reserved_at | DateTime | Không | 2450 |
| appliedAt | applied_at | DateTime | Có | 2451 |
| releasedAt | released_at | DateTime | Có | 2452 |
| reversedAt | reversed_at | DateTime | Có | 2453 |
| createdAt | created_at | DateTime | Không | 2454 |

Quan hệ có local FK:

- `voucherId` → Voucher(id); field ref_voucherId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_VoucherRedemption_voucherId.
- `customerVoucherId` → CustomerVoucher(id); field ref_customerVoucherId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_VoucherRedemption_customerVoucherId.
- `customerId` → CustomerProfile(id); field ref_customerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_VoucherRedemption_customerId.
- `bookingId` → Booking(id); field ref_bookingId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_VoucherRedemption_bookingId.
- `branchId` → Branch(id); field ref_branchId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_VoucherRedemption_branchId.

Relation fields của các model trỏ tới model này:

- CustomerProfile.refs_VoucherRedemption_customerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_VoucherRedemption_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_VoucherRedemption_bookingId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Voucher.refs_VoucherRedemption_voucherId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- CustomerVoucher.refs_VoucherRedemption_customerVoucherId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([voucherId, customerId, status])`
- `@@index([bookingId, status])`

## ServiceVariant

SQL table: `service_variants`; schema.prisma:2467. PK: (id). Unique: (serviceId, code).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2468 |
| serviceId | service_id | String | Không | 2469 |
| code | code | String | Không | 2470 |
| name | name | String | Không | 2471 |
| description | description | String | Có | 2472 |
| priceType | price_type | ServicePriceType | Không | 2473 |
| price | price | Decimal | Có | 2474 |
| maxPrice | max_price | Decimal | Có | 2475 |
| durationMinutes | duration_minutes | Int | Có | 2476 |
| maxDurationMinutes | max_duration_minutes | Int | Có | 2477 |
| bufferBeforeMinutes | buffer_before_minutes | Int | Không | 2478 |
| bufferAfterMinutes | buffer_after_minutes | Int | Không | 2479 |
| consultationRequired | consultation_required | Boolean | Không | 2480 |
| eligibilityRules | eligibility_rules | Json | Có | 2481 |
| status | status | ServiceStatus | Không | 2482 |
| version | version | Int | Không | 2483 |
| createdAt | created_at | DateTime | Không | 2484 |
| updatedAt | updated_at | DateTime | Không | 2485 |
| deletedAt | deleted_at | DateTime | Có | 2486 |

Quan hệ có local FK:

- `serviceId` → BranchServiceOffering(id); field ref_serviceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ServiceVariant_serviceId.

Relation fields của các model trỏ tới model này:

- BranchServiceOffering.refs_ServiceVariant_serviceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ServicePriceRule.ref_variantId: đơn 0..1.

Index declarations:

- `@@index([serviceId, status, deletedAt])`

## ServicePriceRule

SQL table: `service_price_rules`; schema.prisma:2495. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2496 |
| serviceId | service_id | String | Không | 2497 |
| variantId | variant_id | String | Có | 2498 |
| name | name | String | Không | 2499 |
| priority | priority | Int | Không | 2500 |
| adjustmentType | adjustment_type | DiscountType | Không | 2501 |
| adjustmentValue | adjustment_value | Decimal | Không | 2502 |
| conditions | conditions | Json | Không | 2503 |
| active | active | Boolean | Không | 2504 |
| validFrom | valid_from | DateTime | Có | 2505 |
| validTo | valid_to | DateTime | Có | 2506 |
| version | version | Int | Không | 2507 |
| createdAt | created_at | DateTime | Không | 2508 |
| updatedAt | updated_at | DateTime | Không | 2509 |

Quan hệ có local FK:

- `serviceId` → BranchServiceOffering(id); field ref_serviceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ServicePriceRule_serviceId.
- `variantId` → ServiceVariant(id); field ref_variantId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ServicePriceRule_variantId.

Relation fields của các model trỏ tới model này:

- BranchServiceOffering.refs_ServicePriceRule_serviceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- ServiceVariant.refs_ServicePriceRule_variantId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([serviceId, active, priority])`

## ServiceDependency

SQL table: `service_dependencies`; schema.prisma:2517. PK: (id). Unique: (serviceId, requiredServiceId, dependencyType).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2518 |
| serviceId | service_id | String | Không | 2519 |
| requiredServiceId | required_service_id | String | Không | 2520 |
| dependencyType | dependency_type | ServiceDependencyType | Không | 2521 |
| createdAt | created_at | DateTime | Không | 2522 |

Quan hệ có local FK:

- `serviceId` → BranchServiceOffering(id); field ref_serviceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ServiceDependency_serviceId.
- `requiredServiceId` → BranchServiceOffering(id); field ref_requiredServiceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ServiceDependency_requiredServiceId.

Relation fields của các model trỏ tới model này:

- BranchServiceOffering.refs_ServiceDependency_serviceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.refs_ServiceDependency_requiredServiceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## BookingServiceAdjustment

SQL table: `booking_service_adjustments`; schema.prisma:2530. PK: (id). Unique: (bookingServiceId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2531 |
| bookingServiceId | booking_service_id | String | Không | 2532 |
| bookingId | booking_id | String | Không | 2533 |
| actorId | actor_id | String | Không | 2534 |
| action | action | BookingItemAction | Không | 2535 |
| reason | reason | String | Không | 2536 |
| beforeSnapshot | before_snapshot | Json | Không | 2537 |
| afterSnapshot | after_snapshot | Json | Không | 2538 |
| amountDelta | amount_delta | Decimal | Không | 2539 |
| version | version | Int | Không | 2540 |
| createdAt | created_at | DateTime | Không | 2541 |

Quan hệ có local FK:

- `bookingServiceId` → BookingService(id); field ref_bookingServiceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_BookingServiceAdjustment_bookingServiceId.
- `bookingId` → Booking(id); field ref_bookingId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_BookingServiceAdjustment_bookingId.
- `actorId` → User(id); field ref_actorId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_BookingServiceAdjustment_actorId.

Relation fields của các model trỏ tới model này:

- User.refs_BookingServiceAdjustment_actorId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_BookingServiceAdjustment_bookingId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BookingService.refs_BookingServiceAdjustment_bookingServiceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([bookingId, createdAt])`

## OperationalImpactCase

SQL table: `operational_impact_cases`; schema.prisma:2551. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2552 |
| businessId | business_id | String | Không | 2553 |
| branchId | branch_id | String | Có | 2554 |
| subjectType | subject_type | ImpactSubjectType | Không | 2555 |
| subjectId | subject_id | String | Không | 2556 |
| action | action | ImpactAction | Không | 2557 |
| status | status | ImpactCaseStatus | Không | 2558 |
| reason | reason | String | Không | 2559 |
| ownerId | owner_id | String | Không | 2560 |
| deadlineAt | deadline_at | DateTime | Không | 2561 |
| createdBy | created_by | String | Không | 2562 |
| completedAt | completed_at | DateTime | Có | 2563 |
| createdAt | created_at | DateTime | Không | 2564 |
| updatedAt | updated_at | DateTime | Không | 2565 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactCase_businessId.
- `branchId` → Branch(id); field ref_branchId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactCase_branchId.
- `ownerId` → User(id); field ref_ownerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactCase_ownerId.
- `createdBy` → User(id); field ref_createdBy; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactCase_createdBy.

Relation fields của các model trỏ tới model này:

- User.refs_OperationalImpactCase_ownerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.refs_OperationalImpactCase_createdBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_OperationalImpactCase_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_OperationalImpactCase_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- OperationalImpactItem.ref_caseId: đơn 1.

Index declarations:

- `@@index([businessId, status, deadlineAt])`
- `@@index([subjectType, subjectId, status])`

## OperationalImpactItem

SQL table: `operational_impact_items`; schema.prisma:2577. PK: (id). Unique: (caseId, bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2578 |
| caseId | case_id | String | Không | 2579 |
| bookingId | booking_id | String | Không | 2580 |
| resolution | resolution | ImpactResolution | Có | 2581 |
| status | status | ImpactItemStatus | Không | 2582 |
| replacementStaffId | replacement_staff_id | String | Có | 2583 |
| replacementBranchId | replacement_branch_id | String | Có | 2584 |
| proposedStartAt | proposed_start_at | DateTime | Có | 2585 |
| reason | reason | String | Có | 2586 |
| resolvedBy | resolved_by | String | Có | 2587 |
| resolvedAt | resolved_at | DateTime | Có | 2588 |
| financialSnapshot | financial_snapshot | Json | Có | 2589 |
| createdAt | created_at | DateTime | Không | 2590 |
| updatedAt | updated_at | DateTime | Không | 2591 |

Quan hệ có local FK:

- `caseId` → OperationalImpactCase(id); field ref_caseId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactItem_caseId.
- `bookingId` → Booking(id); field ref_bookingId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactItem_bookingId.
- `replacementStaffId` → StaffProfile(id); field ref_replacementStaffId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactItem_replacementStaffId.
- `replacementBranchId` → Branch(id); field ref_replacementBranchId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactItem_replacementBranchId.
- `resolvedBy` → User(id); field ref_resolvedBy; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OperationalImpactItem_resolvedBy.

Relation fields của các model trỏ tới model này:

- User.refs_OperationalImpactItem_resolvedBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- StaffProfile.refs_OperationalImpactItem_replacementStaffId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_OperationalImpactItem_replacementBranchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_OperationalImpactItem_bookingId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- OperationalImpactCase.refs_OperationalImpactItem_caseId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([caseId, status])`
- `@@index([bookingId])`

## WaitlistEntry

SQL table: `waitlist_entries`; schema.prisma:2604. PK: (id). Unique: (offerTokenHash); (offerSlotKey); (bookingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2605 |
| customerId | customer_id | String | Không | 2606 |
| businessId | business_id | String | Không | 2607 |
| branchId | branch_id | String | Không | 2608 |
| serviceId | service_id | String | Không | 2609 |
| staffId | staff_id | String | Có | 2610 |
| windowStart | window_start | DateTime | Không | 2611 |
| windowEnd | window_end | DateTime | Không | 2612 |
| status | status | WaitlistStatus | Không | 2613 |
| offeredStartAt | offered_start_at | DateTime | Có | 2614 |
| offerExpiresAt | offer_expires_at | DateTime | Có | 2615 |
| offerTokenHash | offer_token_hash | String | Có | 2616 |
| offerSlotKey | offer_slot_key | String | Có | 2617 |
| bookingId | booking_id | String | Có | 2618 |
| acceptedAt | accepted_at | DateTime | Có | 2619 |
| cancelledAt | cancelled_at | DateTime | Có | 2620 |
| createdAt | created_at | DateTime | Không | 2621 |
| updatedAt | updated_at | DateTime | Không | 2622 |

Quan hệ có local FK:

- `customerId` → CustomerProfile(id); field ref_customerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_WaitlistEntry_customerId.
- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_WaitlistEntry_businessId.
- `branchId` → Branch(id); field ref_branchId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_WaitlistEntry_branchId.
- `serviceId` → BranchServiceOffering(id); field ref_serviceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_WaitlistEntry_serviceId.
- `staffId` → StaffProfile(id); field ref_staffId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_WaitlistEntry_staffId.
- `bookingId` → Booking(id); field ref_bookingId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_WaitlistEntry_bookingId.

Relation fields của các model trỏ tới model này:

- CustomerProfile.refs_WaitlistEntry_customerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- StaffProfile.refs_WaitlistEntry_staffId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_WaitlistEntry_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_WaitlistEntry_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.refs_WaitlistEntry_serviceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_WaitlistEntry_bookingId: đơn 0..1.

Index declarations:

- `@@index([branchId, serviceId, status, createdAt])`
- `@@index([customerId, status])`
- `@@index([offerExpiresAt, status])`

## ReviewModerationEvent

SQL table: `review_moderation_events`; schema.prisma:2636. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2637 |
| reviewId | review_id | String | Không | 2638 |
| actorId | actor_id | String | Không | 2639 |
| action | action | ReviewModerationAction | Không | 2640 |
| fromStatus | from_status | ReviewStatus | Không | 2641 |
| toStatus | to_status | ReviewStatus | Không | 2642 |
| reasonCode | reason_code | String | Không | 2643 |
| reason | reason | String | Không | 2644 |
| reportCategory | report_category | String | Có | 2645 |
| severity | severity | String | Có | 2646 |
| createdAt | created_at | DateTime | Không | 2647 |

Quan hệ có local FK:

- `reviewId` → Review(id); field ref_reviewId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ReviewModerationEvent_reviewId.
- `actorId` → User(id); field ref_actorId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ReviewModerationEvent_actorId.

Relation fields của các model trỏ tới model này:

- User.refs_ReviewModerationEvent_actorId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Review.refs_ReviewModerationEvent_reviewId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([reviewId, createdAt])`

## ReviewAppeal

SQL table: `review_appeals`; schema.prisma:2655. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2656 |
| reviewId | review_id | String | Không | 2657 |
| appellantId | appellant_id | String | Không | 2658 |
| reason | reason | String | Không | 2659 |
| status | status | ReviewAppealStatus | Không | 2660 |
| reviewedBy | reviewed_by | String | Có | 2661 |
| resolution | resolution | String | Có | 2662 |
| reviewedAt | reviewed_at | DateTime | Có | 2663 |
| createdAt | created_at | DateTime | Không | 2664 |
| updatedAt | updated_at | DateTime | Không | 2665 |

Quan hệ có local FK:

- `reviewId` → Review(id); field ref_reviewId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ReviewAppeal_reviewId.
- `appellantId` → User(id); field ref_appellantId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ReviewAppeal_appellantId.
- `reviewedBy` → User(id); field ref_reviewedBy; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_ReviewAppeal_reviewedBy.

Relation fields của các model trỏ tới model này:

- User.refs_ReviewAppeal_appellantId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.refs_ReviewAppeal_reviewedBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Review.refs_ReviewAppeal_reviewId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([reviewId, status])`
- `@@index([appellantId, createdAt])`

## LoyaltyRule

SQL table: `loyalty_rules`; schema.prisma:2675. PK: (id). Unique: (businessId, branchId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2676 |
| businessId | business_id | String | Không | 2677 |
| branchId | branch_id | String | Có | 2678 |
| version | version | Int | Không | 2679 |
| earnPointsPerAmount | earn_points_per_amount | Int | Không | 2680 |
| earnAmountUnit | earn_amount_unit | Decimal | Không | 2681 |
| redemptionValuePerPoint | redemption_value_per_point | Decimal | Không | 2682 |
| expiresAfterDays | expires_after_days | Int | Có | 2683 |
| active | active | Boolean | Không | 2684 |
| validFrom | valid_from | DateTime | Không | 2685 |
| validTo | valid_to | DateTime | Có | 2686 |
| createdBy | created_by | String | Không | 2687 |
| createdAt | created_at | DateTime | Không | 2688 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyRule_businessId.
- `branchId` → Branch(id); field ref_branchId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyRule_branchId.
- `createdBy` → User(id); field ref_createdBy; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyRule_createdBy.

Relation fields của các model trỏ tới model này:

- User.refs_LoyaltyRule_createdBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_LoyaltyRule_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_LoyaltyRule_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId, active, validFrom])`

## LoyaltyAccount

SQL table: `loyalty_accounts`; schema.prisma:2698. PK: (id). Unique: (businessId, customerId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2699 |
| businessId | business_id | String | Không | 2700 |
| customerId | customer_id | String | Không | 2701 |
| balance | balance | Int | Không | 2702 |
| version | version | Int | Không | 2703 |
| createdAt | created_at | DateTime | Không | 2704 |
| updatedAt | updated_at | DateTime | Không | 2705 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyAccount_businessId.
- `customerId` → CustomerProfile(id); field ref_customerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyAccount_customerId.

Relation fields của các model trỏ tới model này:

- CustomerProfile.refs_LoyaltyAccount_customerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_LoyaltyAccount_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- LoyaltyTransaction.ref_accountId: đơn 1.

Index declarations:

- `@@index([customerId, updatedAt])`

## LoyaltyTransaction

SQL table: `loyalty_transactions`; schema.prisma:2715. PK: (id). Unique: (idempotencyKey).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2716 |
| accountId | account_id | String | Không | 2717 |
| businessId | business_id | String | Không | 2718 |
| customerId | customer_id | String | Không | 2719 |
| bookingId | booking_id | String | Có | 2720 |
| refundRequestId | refund_request_id | String | Có | 2721 |
| type | type | LoyaltyTransactionType | Không | 2722 |
| points | points | Int | Không | 2723 |
| balanceAfter | balance_after | Int | Không | 2724 |
| idempotencyKey | idempotency_key | String | Không | 2725 |
| ruleSnapshot | rule_snapshot | Json | Có | 2726 |
| expiresAt | expires_at | DateTime | Có | 2727 |
| reversalOfId | reversal_of_id | String | Có | 2728 |
| reason | reason | String | Có | 2729 |
| createdBy | created_by | String | Có | 2730 |
| createdAt | created_at | DateTime | Không | 2731 |

Quan hệ có local FK:

- `accountId` → LoyaltyAccount(id); field ref_accountId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyTransaction_accountId.
- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyTransaction_businessId.
- `customerId` → CustomerProfile(id); field ref_customerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyTransaction_customerId.
- `bookingId` → Booking(id); field ref_bookingId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyTransaction_bookingId.
- `refundRequestId` → RefundRequest(id); field ref_refundRequestId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyTransaction_refundRequestId.
- `reversalOfId` → LoyaltyTransaction(id); field ref_reversalOfId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyTransaction_reversalOfId.
- `createdBy` → User(id); field ref_createdBy; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LoyaltyTransaction_createdBy.

Relation fields của các model trỏ tới model này:

- User.refs_LoyaltyTransaction_createdBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- CustomerProfile.refs_LoyaltyTransaction_customerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_LoyaltyTransaction_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_LoyaltyTransaction_bookingId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- RefundRequest.refs_LoyaltyTransaction_refundRequestId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- LoyaltyAccount.refs_LoyaltyTransaction_accountId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- LoyaltyTransaction.ref_reversalOfId: đơn 0..1.
- LoyaltyTransaction.refs_LoyaltyTransaction_reversalOfId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([accountId, createdAt])`
- `@@index([businessId, customerId, createdAt])`
- `@@index([expiresAt, type])`

## Invoice

SQL table: `invoices`; schema.prisma:2747. PK: (id). Unique: (businessId, invoiceNumber); (replacesInvoiceId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2748 |
| businessId | business_id | String | Không | 2749 |
| branchId | branch_id | String | Không | 2750 |
| bookingId | booking_id | String | Có | 2751 |
| paymentId | payment_id | String | Có | 2752 |
| invoiceNumber | invoice_number | String | Không | 2753 |
| status | status | InvoiceStatus | Không | 2754 |
| currency | currency | String | Không | 2755 |
| subtotalAmount | subtotal_amount | Decimal | Không | 2756 |
| discountAmount | discount_amount | Decimal | Không | 2757 |
| taxAmount | tax_amount | Decimal | Không | 2758 |
| totalAmount | total_amount | Decimal | Không | 2759 |
| taxInclusive | tax_inclusive | Boolean | Không | 2760 |
| taxRate | tax_rate | Decimal | Không | 2761 |
| buyerSnapshot | buyer_snapshot | Json | Có | 2762 |
| sellerSnapshot | seller_snapshot | Json | Không | 2763 |
| version | version | Int | Không | 2764 |
| replacesInvoiceId | replaces_invoice_id | String | Có | 2765 |
| issuedAt | issued_at | DateTime | Có | 2766 |
| cancelledAt | cancelled_at | DateTime | Có | 2767 |
| createdBy | created_by | String | Không | 2768 |
| createdAt | created_at | DateTime | Không | 2769 |
| updatedAt | updated_at | DateTime | Không | 2770 |

Quan hệ có local FK:

- `replacesInvoiceId` → Invoice(id); field replacesInvoice; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=InvoiceReplacement.
- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_Invoice_businessId.
- `branchId` → Branch(id); field ref_branchId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_Invoice_branchId.
- `bookingId` → Booking(id); field ref_bookingId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_Invoice_bookingId.
- `paymentId` → Payment(id); field ref_paymentId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_Invoice_paymentId.
- `createdBy` → User(id); field ref_createdBy; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_Invoice_createdBy.

Relation fields của các model trỏ tới model này:

- User.refs_Invoice_createdBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_Invoice_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.refs_Invoice_branchId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.refs_Invoice_bookingId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Payment.refs_Invoice_paymentId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Invoice.replacesInvoice: đơn 0..1.
- Invoice.replacement: đơn 0..1.
- InvoiceInformationRequest.invoice: đơn 0..1.
- InvoiceLine.ref_invoiceId: đơn 1.
- InvoiceEvent.ref_invoiceId: đơn 1.

Index declarations:

- `@@index([branchId, status, createdAt])`
- `@@index([bookingId])`

## InvoiceInformationRequest

SQL table: `invoice_information_requests`; schema.prisma:2788. PK: (id). Unique: (invoiceId); (openKey); (idempotencyKey).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2789 |
| bookingId | booking_id | String | Không | 2790 |
| customerId | customer_id | String | Không | 2791 |
| businessId | business_id | String | Không | 2792 |
| branchId | branch_id | String | Không | 2793 |
| invoiceId | invoice_id | String | Có | 2794 |
| status | status | InvoiceRequestStatus | Không | 2795 |
| buyerSnapshot | buyer_snapshot | Json | Không | 2796 |
| customerNote | customer_note | String | Có | 2797 |
| resolutionNote | resolution_note | String | Có | 2798 |
| resolvedBy | resolved_by | String | Có | 2799 |
| resolvedAt | resolved_at | DateTime | Có | 2800 |
| openKey | open_key | String | Có | 2801 |
| idempotencyKey | idempotency_key | String | Không | 2802 |
| createdAt | created_at | DateTime | Không | 2803 |
| updatedAt | updated_at | DateTime | Không | 2804 |

Quan hệ có local FK:

- `bookingId` → Booking(id); field booking; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `businessId` → Business(id); field business; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `invoiceId` → Invoice(id); field invoice; phía đích 0..1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.invoiceRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.invoiceRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Branch.invoiceRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Booking.invoiceRequests: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Invoice.informationRequest: đơn 0..1.

Index declarations:

- `@@index([customerId, createdAt])`
- `@@index([businessId, status, createdAt])`
- `@@index([branchId, status, createdAt])`

## InvoiceLine

SQL table: `invoice_lines`; schema.prisma:2817. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2818 |
| invoiceId | invoice_id | String | Không | 2819 |
| bookingServiceId | booking_service_id | String | Có | 2820 |
| description | description | String | Không | 2821 |
| quantity | quantity | Int | Không | 2822 |
| unitPrice | unit_price | Decimal | Không | 2823 |
| discountAmount | discount_amount | Decimal | Không | 2824 |
| taxRate | tax_rate | Decimal | Không | 2825 |
| taxAmount | tax_amount | Decimal | Không | 2826 |
| lineTotal | line_total | Decimal | Không | 2827 |
| createdAt | created_at | DateTime | Không | 2828 |

Quan hệ có local FK:

- `invoiceId` → Invoice(id); field ref_invoiceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_InvoiceLine_invoiceId.
- `bookingServiceId` → BookingService(id); field ref_bookingServiceId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_InvoiceLine_bookingServiceId.

Relation fields của các model trỏ tới model này:

- BookingService.refs_InvoiceLine_bookingServiceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Invoice.refs_InvoiceLine_invoiceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([invoiceId])`

## InvoiceEvent

SQL table: `invoice_events`; schema.prisma:2836. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2837 |
| invoiceId | invoice_id | String | Không | 2838 |
| actorId | actor_id | String | Không | 2839 |
| action | action | String | Không | 2840 |
| reason | reason | String | Có | 2841 |
| snapshot | snapshot | Json | Không | 2842 |
| createdAt | created_at | DateTime | Không | 2843 |

Quan hệ có local FK:

- `invoiceId` → Invoice(id); field ref_invoiceId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_InvoiceEvent_invoiceId.
- `actorId` → User(id); field ref_actorId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_InvoiceEvent_actorId.

Relation fields của các model trỏ tới model này:

- User.refs_InvoiceEvent_actorId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Invoice.refs_InvoiceEvent_invoiceId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([invoiceId, createdAt])`

## OwnershipTransfer

SQL table: `ownership_transfers`; schema.prisma:2851. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2852 |
| businessId | business_id | String | Không | 2853 |
| oldOwnerId | old_owner_id | String | Không | 2854 |
| newOwnerUserId | new_owner_user_id | String | Không | 2855 |
| status | status | OwnershipTransferStatus | Không | 2856 |
| effectiveAt | effective_at | DateTime | Không | 2857 |
| reason | reason | String | Không | 2858 |
| scopeSnapshot | scope_snapshot | Json | Không | 2859 |
| settlementAgreement | settlement_agreement | Json | Có | 2860 |
| impactSnapshot | impact_snapshot | Json | Có | 2861 |
| legalEntityVersionId | legal_entity_version_id | String | Có | 2862 |
| payoutAccountVersionId | payout_account_version_id | String | Có | 2863 |
| requestedBy | requested_by | String | Không | 2864 |
| acceptedByNewOwnerAt | accepted_by_new_owner_at | DateTime | Có | 2865 |
| approvedBy | approved_by | String | Có | 2866 |
| approvedAt | approved_at | DateTime | Có | 2867 |
| completedAt | completed_at | DateTime | Có | 2868 |
| failureReason | failure_reason | String | Có | 2869 |
| createdAt | created_at | DateTime | Không | 2870 |
| updatedAt | updated_at | DateTime | Không | 2871 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipTransfer_businessId.
- `oldOwnerId` → BusinessOwnerProfile(id); field ref_oldOwnerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipTransfer_oldOwnerId.
- `newOwnerUserId` → User(id); field ref_newOwnerUserId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipTransfer_newOwnerUserId.
- `legalEntityVersionId` → LegalEntityVersion(id); field ref_legalEntityVersionId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipTransfer_legalEntityVersionId.
- `payoutAccountVersionId` → PayoutAccountVersion(id); field ref_payoutAccountVersionId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipTransfer_payoutAccountVersionId.
- `requestedBy` → User(id); field ref_requestedBy; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipTransfer_requestedBy.
- `approvedBy` → User(id); field ref_approvedBy; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipTransfer_approvedBy.

Relation fields của các model trỏ tới model này:

- User.refs_OwnershipTransfer_newOwnerUserId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.refs_OwnershipTransfer_requestedBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- User.refs_OwnershipTransfer_approvedBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BusinessOwnerProfile.refs_OwnershipTransfer_oldOwnerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_OwnershipTransfer_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- OwnershipHistory.ref_transferId: đơn 0..1.
- LegalEntityVersion.refs_OwnershipTransfer_legalEntityVersionId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- PayoutAccountVersion.refs_OwnershipTransfer_payoutAccountVersionId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId, status, effectiveAt])`
- `@@index([newOwnerUserId, status])`

## OwnershipHistory

SQL table: `ownership_history`; schema.prisma:2886. PK: (id). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2887 |
| businessId | business_id | String | Không | 2888 |
| ownerId | owner_id | String | Không | 2889 |
| transferId | transfer_id | String | Có | 2890 |
| validFrom | valid_from | DateTime | Không | 2891 |
| validTo | valid_to | DateTime | Có | 2892 |
| createdAt | created_at | DateTime | Không | 2893 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipHistory_businessId.
- `ownerId` → BusinessOwnerProfile(id); field ref_ownerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipHistory_ownerId.
- `transferId` → OwnershipTransfer(id); field ref_transferId; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_OwnershipHistory_transferId.

Relation fields của các model trỏ tới model này:

- BusinessOwnerProfile.refs_OwnershipHistory_ownerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_OwnershipHistory_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- OwnershipTransfer.refs_OwnershipHistory_transferId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId, validFrom])`

## LegalEntityVersion

SQL table: `legal_entity_versions`; schema.prisma:2902. PK: (id). Unique: (businessId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2903 |
| businessId | business_id | String | Không | 2904 |
| version | version | Int | Không | 2905 |
| legalName | legal_name | String | Không | 2906 |
| taxCode | tax_code | String | Có | 2907 |
| registrationNumber | registration_number | String | Có | 2908 |
| representativeName | representative_name | String | Có | 2909 |
| verificationStatus | verification_status | String | Không | 2910 |
| isActive | is_active | Boolean | Không | 2911 |
| validFrom | valid_from | DateTime | Không | 2912 |
| validTo | valid_to | DateTime | Có | 2913 |
| createdBy | created_by | String | Không | 2914 |
| createdAt | created_at | DateTime | Không | 2915 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LegalEntityVersion_businessId.
- `createdBy` → User(id); field ref_createdBy; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_LegalEntityVersion_createdBy.

Relation fields của các model trỏ tới model này:

- User.refs_LegalEntityVersion_createdBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_LegalEntityVersion_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- OwnershipTransfer.ref_legalEntityVersionId: đơn 0..1.

Index declarations:

- `@@index([businessId, validFrom])`

## PayoutAccountVersion

SQL table: `payout_account_versions`; schema.prisma:2925. PK: (id). Unique: (businessId, version).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2926 |
| businessId | business_id | String | Không | 2927 |
| version | version | Int | Không | 2928 |
| bankName | bank_name | String | Không | 2929 |
| accountHolder | account_holder | String | Không | 2930 |
| accountNumberCiphertext | account_number_ciphertext | String | Không | 2931 |
| accountNumberIv | account_number_iv | String | Không | 2932 |
| authenticationTag | authentication_tag | String | Không | 2933 |
| keyVersion | key_version | String | Không | 2934 |
| maskedAccountNumber | masked_account_number | String | Không | 2935 |
| verificationStatus | verification_status | String | Không | 2936 |
| isActive | is_active | Boolean | Không | 2937 |
| validFrom | valid_from | DateTime | Không | 2938 |
| validTo | valid_to | DateTime | Có | 2939 |
| createdBy | created_by | String | Không | 2940 |
| createdAt | created_at | DateTime | Không | 2941 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PayoutAccountVersion_businessId.
- `createdBy` → User(id); field ref_createdBy; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_PayoutAccountVersion_createdBy.

Relation fields của các model trỏ tới model này:

- User.refs_PayoutAccountVersion_createdBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_PayoutAccountVersion_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- OwnershipTransfer.ref_payoutAccountVersionId: đơn 0..1.

Index declarations:

- `@@index([businessId, validFrom])`

## CustomerSavedService

SQL table: `customer_saved_services`; schema.prisma:2951. PK: (id). Unique: (customerId, branchServiceOfferingId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2952 |
| customerId | customer_id | String | Không | 2953 |
| branchServiceOfferingId | branch_service_offering_id | String | Không | 2954 |
| createdAt | created_at | DateTime | Không | 2955 |
| updatedAt | updated_at | DateTime | Không | 2956 |

Quan hệ có local FK:

- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchServiceOfferingId` → BranchServiceOffering(id); field offering; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.savedServices: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- BranchServiceOffering.savedByCustomers: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([customerId, createdAt])`

## VoucherBranchScope

SQL table: `voucher_branch_scopes`; schema.prisma:2965. PK: (voucherId, branchId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| voucherId | voucher_id | String | Không | 2966 |
| branchId | branch_id | String | Không | 2967 |

Quan hệ có local FK:

- `voucherId` → Voucher(id); field voucher; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `branchId` → Branch(id); field branch; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Branch.voucherBranchScopes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Voucher.branchScopes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([branchId])`

## VoucherServiceScope

SQL table: `voucher_service_scopes`; schema.prisma:2976. PK: (voucherId, serviceId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| voucherId | voucher_id | String | Không | 2977 |
| serviceId | service_id | String | Không | 2978 |

Quan hệ có local FK:

- `voucherId` → Voucher(id); field voucher; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `serviceId` → BranchServiceOffering(id); field service; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- BranchServiceOffering.voucherScopes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Voucher.serviceScopes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([serviceId])`

## VoucherComboScope

SQL table: `voucher_combo_scopes`; schema.prisma:2987. PK: (voucherId, comboId). Unique: (không khai báo khác PK).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| voucherId | voucher_id | String | Không | 2988 |
| comboId | combo_id | String | Không | 2989 |

Quan hệ có local FK:

- `voucherId` → Voucher(id); field voucher; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `comboId` → Combo(id); field combo; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- Combo.voucherScopes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Voucher.comboScopes: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([comboId])`

## CustomerBusinessSegment

SQL table: `customer_business_segments`; schema.prisma:2998. PK: (id). Unique: (businessId, customerId, segment).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 2999 |
| businessId | business_id | String | Không | 3000 |
| customerId | customer_id | String | Không | 3001 |
| segment | segment | String | Không | 3002 |
| assignedBy | assigned_by | String | Có | 3003 |
| createdAt | created_at | DateTime | Không | 3004 |
| updatedAt | updated_at | DateTime | Không | 3005 |

Quan hệ có local FK:

- `businessId` → Business(id); field ref_businessId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_CustomerBusinessSegment_businessId.
- `customerId` → CustomerProfile(id); field ref_customerId; phía đích 1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_CustomerBusinessSegment_customerId.
- `assignedBy` → User(id); field ref_assignedBy; phía đích 0..1; onDelete=Restrict; onUpdate=Cascade; relation name=Audit_CustomerBusinessSegment_assignedBy.

Relation fields của các model trỏ tới model này:

- User.refs_CustomerBusinessSegment_assignedBy: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- CustomerProfile.refs_CustomerBusinessSegment_customerId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- Business.refs_CustomerBusinessSegment_businessId: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).

Index declarations:

- `@@index([businessId, segment])`

## MarketingPreference

SQL table: `marketing_preferences`; schema.prisma:3015. PK: (id). Unique: (customerId).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 3016 |
| customerId | customer_id | String | Không | 3017 |
| emailMarketing | email_marketing | Boolean | Không | 3018 |
| smsMarketing | sms_marketing | Boolean | Không | 3019 |
| pushMarketing | push_marketing | Boolean | Không | 3020 |
| personalizedPromotions | personalized_promotions | Boolean | Không | 3021 |
| updatedAt | updated_at | DateTime | Không | 3022 |
| createdAt | created_at | DateTime | Không | 3023 |

Quan hệ có local FK:

- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Cascade; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.marketingPreference: đơn 0..1.

Index declarations:

- Không có @@index; PK/unique vẫn tạo index vật lý.

## PrivacyExportPackage

SQL table: `privacy_export_packages`; schema.prisma:3029. PK: (id). Unique: (requestId); (downloadTokenHash).

| Field | SQL column | Type | Nullable | Line |
| --- | --- | --- | --- | ---: |
| id | id | String | Không | 3030 |
| customerId | customer_id | String | Không | 3031 |
| requestId | request_id | String | Không | 3032 |
| downloadTokenHash | download_token_hash | String | Không | 3033 |
| payloadCiphertext | payload_ciphertext | String | Không | 3034 |
| encryptionIv | encryption_iv | String | Không | 3035 |
| authenticationTag | authentication_tag | String | Không | 3036 |
| keyVersion | key_version | String | Không | 3037 |
| expiresAt | expires_at | DateTime | Không | 3038 |
| downloadedAt | downloaded_at | DateTime | Có | 3039 |
| createdAt | created_at | DateTime | Không | 3040 |

Quan hệ có local FK:

- `customerId` → CustomerProfile(id); field customer; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).
- `requestId` → DataSubjectRequest(id); field request; phía đích 1; onDelete=Restrict; onUpdate=(không khai báo); relation name=(implicit).

Relation fields của các model trỏ tới model này:

- CustomerProfile.privacyExportPackages: danh sách (0..N ở mức schema, không bảo đảm có ít nhất 1).
- DataSubjectRequest.exportPackage: đơn 0..1.

Index declarations:

- `@@index([customerId, createdAt])`
- `@@index([expiresAt])`

## Enum catalog

| Enum | Values | Active model fields | Schema line |
| --- | --- | --- | ---: |
| PriceAdjustmentType | PROMOTION, VOUCHER, LOYALTY, PACKAGE, MANUAL, SURCHARGE, REFUND | PriceAdjustment.type | 3049 |
| PriceAdjustmentStatus | RESERVED, APPLIED, RELEASED, REVERSED | PriceAdjustment.status | 3059 |
| RedemptionStatus | RESERVED, APPLIED, RELEASED, REVERSED | PromotionRedemption.status, VoucherRedemption.status | 3066 |
| ServicePriceType | FIXED, FROM, RANGE, QUOTE | ServiceVariant.priceType | 3073 |
| ServiceDependencyType | REQUIRED, ADD_ON, INCOMPATIBLE | ServiceDependency.dependencyType | 3080 |
| BookingItemAction | ADD, REMOVE, REASSIGN, RESIZE, START, COMPLETE, SKIP, REPRICE | BookingServiceAdjustment.action | 3086 |
| ImpactSubjectType | STAFF, BRANCH, BUSINESS, SCHEDULE | OperationalImpactCase.subjectType | 3097 |
| ImpactAction | OFFBOARD, PAUSE, SUSPEND, CLOSE, SCHEDULE_CHANGE, TRANSFER | OperationalImpactCase.action | 3104 |
| ImpactCaseStatus | OPEN, IN_PROGRESS, READY_TO_COMPLETE, COMPLETED, CANCELLED | OperationalImpactCase.status | 3113 |
| ImpactResolution | REASSIGN, RESCHEDULE, TRANSFER_BRANCH, CANCEL_REFUND, APPROVED_EXCEPTION | OperationalImpactItem.resolution | 3121 |
| ImpactItemStatus | PENDING, PROCESSING, RESOLVED, FAILED | OperationalImpactItem.status | 3129 |
| WaitlistStatus | WAITING, OFFERED, ACCEPTED, EXPIRED, CANCELLED | WaitlistEntry.status | 3136 |
| ReviewModerationAction | REPORT, QUARANTINE, APPROVE, HIDE, RESTORE, APPEAL_SUBMITTED, APPEAL_APPROVED, APPEAL_REJECTED | ReviewModerationEvent.action | 3144 |
| ReviewAppealStatus | PENDING, APPROVED, REJECTED | ReviewAppeal.status | 3155 |
| LoyaltyTransactionType | EARN, REDEEM, EXPIRE, REVERSE, REFUND_ADJUSTMENT, MANUAL_ADJUSTMENT | LoyaltyTransaction.type | 3161 |
| InvoiceStatus | DRAFT, ISSUED, CANCELLED, ADJUSTED | Invoice.status | 3170 |
| InvoiceRequestStatus | PENDING, FULFILLED, REJECTED, CANCELLED | InvoiceInformationRequest.status | 3177 |
| OwnershipTransferStatus | DRAFT, PENDING_NEW_OWNER_ACCEPTANCE, UNDER_REVIEW, NEED_MORE_INFO, APPROVED, SCHEDULED, EXECUTING, COMPLETED, REJECTED, CANCELLED, EXECUTION_FAILED | OwnershipTransfer.status | 3184 |
| RoleLevel | PLATFORM, TENANT, BRANCH, CUSTOMER | Role.level | 3198 |
| AccountTokenType | EMAIL_VERIFICATION, PASSWORD_RESET | AccountToken.type | 3205 |
| AuthWorkspace | CUSTOMER, SALON, PLATFORM | UserSession.workspace | 3210 |
| InvitationStatus | PENDING, ACCEPTED, REVOKED, EXPIRED | StaffInvitation.status | 3216 |
| TenantStatus | PENDING, ACTIVE, SUSPENDED, REJECTED | (không có) | 3223 |
| SubscriptionTier | FREE, PRO, ENTERPRISE | (không có) | 3230 |
| PermissionScope | PLATFORM, TENANT, BRANCH, SELF, PUBLIC | Permission.scope | 3236 |
| UserStatus | ACTIVE, SUSPENDED, DELETED | (không có) | 3244 |
| BookingLifecycleStatus | PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW | (không có) | 3250 |
| RoleCode | PLATFORM_ADMIN, BUSINESS_OWNER, RECEPTIONIST, STAFF, CUSTOMER, GUEST | StaffInvitation.roleCode, Role.code | 3260 |
| CanonicalServiceStatus | ACTIVE, DEPRECATED, MERGED | CanonicalService.status | 3269 |
| ServiceMappingStatus | MAPPED, UNMAPPED, SUGGESTED | BusinessService.mappingStatus | 3275 |
| Gender | MALE, FEMALE, OTHER | User.gender | 3281 |
| DevicePlatform | IOS, ANDROID, WEB | DeviceToken.platform | 3287 |
| BusinessStatus | DRAFT, PENDING, PENDING_REVIEW, NEED_MORE_INFO, APPROVED, ACTIVE, SUSPENDED, REJECTED | Business.status, BusinessReviewEvent.fromStatus, BusinessReviewEvent.toStatus | 3293 |
| BranchStatus | PENDING, ACTIVE, INACTIVE | Branch.status | 3304 |
| BranchReviewStatus | DRAFT, SUBMITTED, PENDING_REVIEW, NEED_MORE_INFO, APPROVED, REJECTED | Branch.reviewStatus, BranchReviewRequest.status, BranchReviewEvent.fromStatus, BranchReviewEvent.toStatus | 3310 |
| BranchOperationalStatus | INACTIVE, READY_TO_PUBLISH, ACTIVE, PAUSED, SUSPENDED, CLOSED, ARCHIVED | Branch.operationalStatus | 3319 |
| BranchServiceMode | AT_LOCATION, MOBILE, BOTH | Branch.serviceMode | 3329 |
| BranchDocumentType | OPERATING_LICENSE, LOCATION_DOCUMENT, SERVICE_LICENSE, FIRE_SAFETY, OTHER | BranchDocument.documentType | 3335 |
| BranchDocumentStatus | DRAFT, SUBMITTED, NEED_MORE_INFO, APPROVED, REJECTED, ARCHIVED | BranchDocument.status | 3343 |
| StaffAssignmentStatus | ACTIVE, INACTIVE, ENDED | StaffBranchAssignment.status | 3352 |
| StaffStatus | PROFILE_ONLY, INVITED, ACTIVE, LOCKED, INACTIVE | StaffProfile.status | 3358 |
| ServiceStatus | ACTIVE, INACTIVE | BusinessService.status, BranchServiceOffering.status, ServiceVariant.status | 3366 |
| ComboStatus | ACTIVE, INACTIVE, PAUSED, EXPIRED | Combo.status | 3371 |
| ComboPricingMode | FIXED_PRICE | Combo.pricingMode | 3378 |
| ComboStaffAssignmentMode | SINGLE_PROVIDER, PER_SERVICE_PROVIDER | Combo.staffAssignmentMode | 3382 |
| BookingServiceStatus | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, SKIPPED | BookingService.status | 3387 |
| BusinessDocumentType | BUSINESS_LICENSE, OWNER_ID_CARD, TAX_DOCUMENT, OTHER | BusinessDocument.documentType | 3395 |
| BusinessDocumentStatus | DRAFT, SUBMITTED, NEED_MORE_INFO, APPROVED, REJECTED, ARCHIVED | BusinessDocument.status, DocumentReviewEvent.fromStatus, DocumentReviewEvent.toStatus | 3402 |
| DocumentReviewAction | SUBMIT, APPROVE, REQUEST_INFO, REJECT, ARCHIVE | DocumentReviewEvent.action | 3411 |
| MediaVisibility | PUBLIC, PRIVATE | MediaFile.visibility | 3419 |
| DiscountType | PERCENTAGE, FIXED_AMOUNT | Promotion.discountType, Voucher.discountType, ServicePriceRule.adjustmentType | 3424 |
| PromotionStatus | ACTIVE, INACTIVE, EXPIRED | Promotion.status | 3429 |
| BookingStatus | PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW, REJECTED, EXPIRED | Booking.status, BookingStatusHistory.status | 3435 |
| BookingConfirmationMode | MANUAL_CONFIRMATION, AUTO_CONFIRMATION | Branch.bookingConfirmationMode | 3447 |
| StaffAssignmentMode | CUSTOMER_SELECTS_STAFF, AUTO_ASSIGN_IF_ANY_STAFF, MANUAL_ASSIGN_BY_RECEPTIONIST | Branch.staffAssignmentMode | 3452 |
| BookingSource | ONLINE_WEB, ONLINE_APP, WALK_IN, PHONE, STAFF_CREATED, ADMIN_CREATED | Booking.source | 3458 |
| RecurrenceFrequency | WEEKLY, BIWEEKLY, MONTHLY | RecurringBookingPlan.frequency | 3467 |
| RecurringPlanStatus | CREATING, ACTIVE, PAUSED, FAILED, CANCELLED, COMPLETED | RecurringBookingPlan.status | 3473 |
| RecurringStaffMode | SAME_STAFF, ANY_AVAILABLE | RecurringBookingPlan.staffMode | 3482 |
| PaymentMethod | CASH, MOCK_ONLINE, BANK_TRANSFER, MOMO, VNPAY, ZALOPAY, CREDIT_CARD | Payment.method, PaymentIntent.method, PaymentTransaction.method | 3487 |
| RefundStatus | PENDING, APPROVED, REJECTED, PROCESSING, REFUNDED, FAILED | RefundRequest.status | 3497 |
| PaymentStatus | PENDING, PAID, PARTIALLY_PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED | Payment.status | 3506 |
| PolicyVersionStatus | DRAFT, ACTIVE, ARCHIVED | PaymentPolicy.status | 3515 |
| DepositType | NONE, FIXED, PERCENTAGE, FULL_PREPAYMENT | PaymentPolicy.depositType, PaymentPolicySnapshot.depositType | 3521 |
| PaymentIntentStatus | CREATED, PENDING, REQUIRES_ACTION, SUCCEEDED, FAILED, CANCELLED, EXPIRED | PaymentIntent.status | 3528 |
| PaymentTransactionStatus | PENDING, VERIFIED, FAILED, REVERSED | PaymentTransaction.status | 3538 |
| FinancialLedgerType | SERVICE_CHARGE, PACKAGE_CHARGE, PROMOTION, VOUCHER, PAYMENT_RECEIVED, REFUND, REVERSAL, ADJUSTMENT, PLATFORM_FEE, PLATFORM_FEE_ADJUSTMENT | FinancialLedgerEntry.type | 3545 |
| LedgerDirection | DEBIT, CREDIT | FinancialLedgerEntry.direction | 3558 |
| PlatformFeeStatus | ACCRUED, STATEMENTED, ADJUSTED | PlatformFeeEntry.status | 3563 |
| PlatformStatementStatus | DRAFT, REVIEW, ISSUED, PAID, OVERDUE | PlatformStatement.status | 3569 |
| StatementLineType | FEE, ADJUSTMENT | PlatformStatementLine.lineType | 3577 |
| TreatmentPackageStatus | ACTIVE, INACTIVE, ARCHIVED | TreatmentPackage.status | 3582 |
| PackagePurchaseStatus | PENDING_PAYMENT, ACTIVE, COMPLETED, EXPIRED, CANCELLED | PackagePurchase.status | 3588 |
| PackageInstallmentStatus | DUE, PENDING, PAID, FAILED, WAIVED | PackageInstallment.status | 3596 |
| PackageEntitlementStatus | AVAILABLE, RESERVED, REDEEMED, RELEASED, EXPIRED | PackageSessionEntitlement.status | 3604 |
| ReviewStatus | PENDING, APPROVED, REPORTED, HIDDEN | Review.status, ReviewModerationEvent.fromStatus, ReviewModerationEvent.toStatus | 3612 |
| CommentStatus | VISIBLE, HIDDEN, DELETED | BusinessComment.status | 3619 |
| NotificationType | BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_REMINDER, PROMOTION, SYSTEM, PAYMENT, BOOKING_RESCHEDULE_REQUEST, BOOKING_RESCHEDULE_APPROVED, BOOKING_RESCHEDULE_REJECTED, BOOKING_PAYMENT_RECEIVED, BOOKING_COMPLETED, REVIEW_REMINDER, SALON_VIOLATION_ALERT | Notification.type, NotificationOutbox.type | 3625 |
| NotificationSeverity | INFO, SUCCESS, WARNING, CRITICAL | Notification.severity, NotificationOutbox.severity | 3641 |
| NotificationOutboxStatus | PENDING, PROCESSING, SENT, FAILED | NotificationOutbox.status | 3648 |
| VoucherAudience | ALL, NEW_CUSTOMER, RETURNING_CUSTOMER, BIRTHDAY, VIP, SELECTED | Promotion.audience, Voucher.audience | 3655 |
| AuditAction | READ, CREATE, UPDATE, DELETE, LOGIN, LOGOUT, STATUS_CHANGE, CANCEL, FORCE_CANCEL, REFUND, ESCALATION, POLICY_OVERRIDE | AuditLog.action | 3664 |
| TrustActionType | WARNING_SENT, EXPLANATION_REQUESTED, MONITORING_STARTED, BOOKING_RESTRICTED, SUSPENDED, RESTORED, NOTE_ADDED | TrustAction.action | 3679 |
| SalonMemberRole | OWNER, RECEPTIONIST | SalonMember.role | 3689 |
| CancelledByType | CUSTOMER, SALON, ADMIN, SYSTEM | Booking.cancelledByType, AppointmentChangeRequest.requestedByType | 3694 |
| ChangeRequestType | RESCHEDULE, STAFF_CHANGE, CANCEL | AppointmentChangeRequest.requestType | 3701 |
| ChangeRequestStatus | PENDING, APPROVED, REJECTED, EXPIRED | AppointmentChangeRequest.status | 3707 |
| VoucherStatus | ACTIVE, RESERVED, USED, EXPIRED, REVOKED | Voucher.status, CustomerVoucher.status | 3714 |
| VoucherScope | PLATFORM, TENANT, CUSTOMER, COMPENSATION, CAMPAIGN | Voucher.scope | 3722 |
| ConsentScope | SKIN_CONDITION, ALLERGY, MEDICATION, PREGNANCY, GENERAL_HEALTH | SensitiveConsent.scope | 3730 |
| ConsultationTemplateStatus | DRAFT, PUBLISHED, ARCHIVED | ConsultationFormTemplate.status | 3738 |
| ConsultationFieldType | TEXT, TEXTAREA, BOOLEAN, SINGLE_SELECT, MULTI_SELECT, DATE | ConsultationFormField.fieldType | 3744 |
| ConsultationCompletionTiming | BEFORE_APPOINTMENT, AT_CHECK_IN, BEFORE_SERVICE | ServiceConsultationRequirement.timing | 3753 |
| ConsultationSubmissionStatus | DRAFT, SUBMITTED, REVOKED | ConsultationSubmission.status | 3759 |
| SensitiveAnswerValueType | TEXT, BOOLEAN, STRING_LIST, DATE | SensitiveAnswer.valueType | 3765 |
| ConsentEventAction | GRANTED, REVOKED | ConsentEvent.action | 3772 |
| ConsentRecipientType | ASSIGNED_STAFF, BRANCH_SPECIALIST | ConsentEvent.recipientType | 3777 |
| SensitiveAccessResult | GRANTED, DENIED, REDACTED | SensitiveDataAccessEvent.result | 3782 |
| DataSubjectRequestType | EXPORT, RECTIFICATION, ERASURE, RESTRICT_PROCESSING, OBJECT_PROCESSING, DELETE_ACCOUNT | DataSubjectRequest.type | 3788 |
| DataSubjectRequestStatus | RECEIVED, IDENTITY_VERIFICATION, IN_PROGRESS, COMPLETED, REJECTED | DataSubjectRequest.status | 3797 |
| SensitiveDataField | SKIN_CONDITION, ALLERGY, MEDICATION, PREGNANCY, GENERAL_HEALTH, OTHER | BookingHealthRecord.field, ConsultationFormField.dataCategory, SensitiveAnswer.dataCategory, ConsentEvent.dataCategory | 3805 |

## SQL-only objects / live catalog

Catalog local đầy đủ nằm trong `tmp/manager-refactor/database-evidence.json`; audit draft phân biệt archive tables, triggers, partial indexes, CHECK và ORM declarations. Không bỏ qua SQL-only objects khi vẽ concurrency hoặc migration.
