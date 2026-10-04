# Từ điển dữ liệu toàn bộ schema

Nguồn: `prisma/schema.prisma`, SHA-256 `b30eb0d487134d656702fff56da633b58975ff51980530fe42f126a8f05b8215`. Đọc 121 model, 92 enum; không truy vấn PostgreSQL. Dòng schema chứa kiểu, nullable, default, native SQL annotation và ràng buộc. Prisma `String` không mặc nhiên là UUID SQL dù default uuid(). Liên hệ object không là cột.

## User

Bảng: `users`; schema dòng 9; miền Định danh và phiên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| recordedBookingViolations | BookingViolationEvent[] (object) | Không | `recordedBookingViolations BookingViolationEvent[] @relation("BookingViolationActor")`  |
| voidedBookingViolations | BookingViolationEvent[] (object) | Không | `voidedBookingViolations BookingViolationEvent[] @relation("BookingViolationVoider")`  |
| id | String (scalar) | Không | `id                       String                       @id @default(uuid())`  |
| email | String (scalar) | Không | `email                    String                       @unique`  |
| phone | String (scalar) | Có | `phone                    String?                      @unique`  |
| passwordHash | String (scalar) | Không | `passwordHash             String                       @map("password_hash")`  |
| fullName | String (scalar) | Không | `fullName                 String                       @map("full_name")`  |
| address | String (scalar) | Có | `address                  String?`  |
| avatarMediaId | String (scalar) | Có | `avatarMediaId            String?                      @map("avatar_media_id")` **FK vật lý** |
| gender | Gender (enum) | Có | `gender                   Gender?`  |
| dateOfBirth | DateTime (scalar) | Có | `dateOfBirth              DateTime?                    @map("date_of_birth") @db.Date`  |
| isEmailVerified | Boolean (scalar) | Không | `isEmailVerified          Boolean                      @default(false) @map("is_email_verified")`  |
| isPhoneVerified | Boolean (scalar) | Không | `isPhoneVerified          Boolean                      @default(false) @map("is_phone_verified")`  |
| isActive | Boolean (scalar) | Không | `isActive                 Boolean                      @default(true) @map("is_active")`  |
| lastLoginAt | DateTime (scalar) | Có | `lastLoginAt              DateTime?                    @map("last_login_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt                DateTime                     @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt                DateTime                     @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt                DateTime?                    @map("deleted_at")`  |
| changeRequestsRequested | AppointmentChangeRequest[] (object) | Không | `changeRequestsRequested  AppointmentChangeRequest[]   @relation("ChangeRequestRequestedBy")`  |
| changeRequestsReviewed | AppointmentChangeRequest[] (object) | Không | `changeRequestsReviewed   AppointmentChangeRequest[]   @relation("ChangeRequestReviewedBy")`  |
| auditLogs | AuditLog[] (object) | Không | `auditLogs                AuditLog[]`  |
| statusChanges | BookingStatusHistory[] (object) | Không | `statusChanges            BookingStatusHistory[]       @relation("StatusChangedBy")`  |
| cancelledBookings | Booking[] (object) | Không | `cancelledBookings        Booking[]                    @relation("BookingCancelledBy")`  |
| ownerProfile | BusinessOwnerProfile (object) | Có | `ownerProfile             BusinessOwnerProfile?`  |
| customerProfile | CustomerProfile (object) | Có | `customerProfile          CustomerProfile?`  |
| deviceTokens | DeviceToken[] (object) | Không | `deviceTokens             DeviceToken[]`  |
| uploadedMedia | MediaFile[] (object) | Không | `uploadedMedia            MediaFile[]                  @relation("MediaUploader")`  |
| notifications | Notification[] (object) | Không | `notifications            Notification[]`  |
| notificationOutboxes | NotificationOutbox[] (object) | Không | `notificationOutboxes     NotificationOutbox[]`  |
| salonMemberships | SalonMember[] (object) | Không | `salonMemberships         SalonMember[]`  |
| staffProfile | StaffProfile (object) | Có | `staffProfile             StaffProfile?`  |
| userRolesGranted | UserRole[] (object) | Không | `userRolesGranted         UserRole[]                   @relation("UserRoleGrantor")`  |
| userRoles | UserRole[] (object) | Không | `userRoles                UserRole[]`  |
| avatarMedia | MediaFile (object) | Có | `avatarMedia              MediaFile?                   @relation("UserAvatar", fields: [avatarMediaId], references: [id])`  |
| accountTokens | AccountToken[] (object) | Không | `accountTokens            AccountToken[]`  |
| sessions | UserSession[] (object) | Không | `sessions                 UserSession[]`  |
| trustActions | TrustAction[] (object) | Không | `trustActions             TrustAction[]                @relation("TrustActionActor")`  |
| businessReviewEvents | BusinessReviewEvent[] (object) | Không | `businessReviewEvents     BusinessReviewEvent[]        @relation("BusinessReviewActor")`  |
| businessDocumentVersions | BusinessDocumentVersion[] (object) | Không | `businessDocumentVersions BusinessDocumentVersion[]    @relation("BusinessDocumentVersionCreator")`  |
| documentReviewEvents | DocumentReviewEvent[] (object) | Không | `documentReviewEvents     DocumentReviewEvent[]        @relation("DocumentReviewActor")`  |
| branchDocumentVersions | BranchDocumentVersion[] (object) | Không | `branchDocumentVersions   BranchDocumentVersion[]      @relation("BranchDocumentVersionCreator")`  |
| branchReviewEvents | BranchReviewEvent[] (object) | Không | `branchReviewEvents       BranchReviewEvent[]          @relation("BranchReviewActor")`  |
| branchReviewRequests | BranchReviewRequest[] (object) | Không | `branchReviewRequests     BranchReviewRequest[]        @relation("BranchReviewRequester")`  |
| branchReviewAssignments | BranchReviewRequest[] (object) | Không | `branchReviewAssignments  BranchReviewRequest[]        @relation("BranchReviewReviewer")`  |
| userPermissions | UserPermission[] (object) | Không | `userPermissions          UserPermission[]`  |
| reviewReports | ReviewReport[] (object) | Không | `reviewReports            ReviewReport[]               @relation("ReviewReporter")`  |
| refs_BranchStateTransition_actorId | BranchStateTransition[] (object) | Không | `refs_BranchStateTransition_actorId BranchStateTransition[] @relation("Audit_BranchStateTransition_actorId")`  |
| refs_BookingServiceAdjustment_actorId | BookingServiceAdjustment[] (object) | Không | `refs_BookingServiceAdjustment_actorId BookingServiceAdjustment[] @relation("Audit_BookingServiceAdjustment_actorId")`  |
| refs_OperationalImpactCase_ownerId | OperationalImpactCase[] (object) | Không | `refs_OperationalImpactCase_ownerId OperationalImpactCase[] @relation("Audit_OperationalImpactCase_ownerId")`  |
| refs_OperationalImpactCase_createdBy | OperationalImpactCase[] (object) | Không | `refs_OperationalImpactCase_createdBy OperationalImpactCase[] @relation("Audit_OperationalImpactCase_createdBy")`  |
| refs_OperationalImpactItem_resolvedBy | OperationalImpactItem[] (object) | Không | `refs_OperationalImpactItem_resolvedBy OperationalImpactItem[] @relation("Audit_OperationalImpactItem_resolvedBy")`  |
| refs_ReviewModerationEvent_actorId | ReviewModerationEvent[] (object) | Không | `refs_ReviewModerationEvent_actorId ReviewModerationEvent[] @relation("Audit_ReviewModerationEvent_actorId")`  |
| refs_ReviewAppeal_appellantId | ReviewAppeal[] (object) | Không | `refs_ReviewAppeal_appellantId ReviewAppeal[] @relation("Audit_ReviewAppeal_appellantId")`  |
| refs_ReviewAppeal_reviewedBy | ReviewAppeal[] (object) | Không | `refs_ReviewAppeal_reviewedBy ReviewAppeal[] @relation("Audit_ReviewAppeal_reviewedBy")`  |
| refs_LoyaltyRule_createdBy | LoyaltyRule[] (object) | Không | `refs_LoyaltyRule_createdBy LoyaltyRule[] @relation("Audit_LoyaltyRule_createdBy")`  |
| refs_LoyaltyTransaction_createdBy | LoyaltyTransaction[] (object) | Không | `refs_LoyaltyTransaction_createdBy LoyaltyTransaction[] @relation("Audit_LoyaltyTransaction_createdBy")`  |
| refs_Invoice_createdBy | Invoice[] (object) | Không | `refs_Invoice_createdBy Invoice[] @relation("Audit_Invoice_createdBy")`  |
| refs_InvoiceEvent_actorId | InvoiceEvent[] (object) | Không | `refs_InvoiceEvent_actorId InvoiceEvent[] @relation("Audit_InvoiceEvent_actorId")`  |
| refs_OwnershipTransfer_newOwnerUserId | OwnershipTransfer[] (object) | Không | `refs_OwnershipTransfer_newOwnerUserId OwnershipTransfer[] @relation("Audit_OwnershipTransfer_newOwnerUserId")`  |
| refs_OwnershipTransfer_requestedBy | OwnershipTransfer[] (object) | Không | `refs_OwnershipTransfer_requestedBy OwnershipTransfer[] @relation("Audit_OwnershipTransfer_requestedBy")`  |
| refs_OwnershipTransfer_approvedBy | OwnershipTransfer[] (object) | Không | `refs_OwnershipTransfer_approvedBy OwnershipTransfer[] @relation("Audit_OwnershipTransfer_approvedBy")`  |
| refs_LegalEntityVersion_createdBy | LegalEntityVersion[] (object) | Không | `refs_LegalEntityVersion_createdBy LegalEntityVersion[] @relation("Audit_LegalEntityVersion_createdBy")`  |
| refs_PayoutAccountVersion_createdBy | PayoutAccountVersion[] (object) | Không | `refs_PayoutAccountVersion_createdBy PayoutAccountVersion[] @relation("Audit_PayoutAccountVersion_createdBy")`  |
| refs_CustomerBusinessSegment_assignedBy | CustomerBusinessSegment[] (object) | Không | `refs_CustomerBusinessSegment_assignedBy CustomerBusinessSegment[] @relation("Audit_CustomerBusinessSegment_assignedBy")`  |

Khóa chính: id. Unique đơn: email, phone.

- `@@index([email])`
- `@@index([phone])`
- `@@map("users")`

## AccountToken

Bảng: `account_tokens`; schema dòng 80; miền Định danh và phiên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String           @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId    String           @map("user_id")` **FK vật lý** |
| type | AccountTokenType (enum) | Không | `type      AccountTokenType`  |
| tokenHash | String (scalar) | Không | `tokenHash String           @unique @map("token_hash")`  |
| expiresAt | DateTime (scalar) | Không | `expiresAt DateTime         @map("expires_at")`  |
| usedAt | DateTime (scalar) | Có | `usedAt    DateTime?        @map("used_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime         @default(now()) @map("created_at")`  |
| user | User (object) | Không | `user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: tokenHash.

- `@@index([userId, type])`
- `@@index([expiresAt])`
- `@@map("account_tokens")`

## UserSession

Bảng: `user_sessions`; schema dòng 95; miền Định danh và phiên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String        @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId           String        @map("user_id")` **FK vật lý** |
| refreshTokenHash | String (scalar) | Có | `refreshTokenHash String?       @map("refresh_token_hash")`  |
| userAgent | String (scalar) | Có | `userAgent        String?       @map("user_agent")`  |
| ipAddress | String (scalar) | Có | `ipAddress        String?       @map("ip_address")`  |
| workspace | AuthWorkspace (enum) | Không | `workspace        AuthWorkspace @default(CUSTOMER)`  |
| businessId | String (scalar) | Có | `businessId       String?       @map("business_id")` (Không suy FK từ hậu tố Id) |
| branchId | String (scalar) | Có | `branchId         String?       @map("branch_id")` (Không suy FK từ hậu tố Id) |
| lastActiveAt | DateTime (scalar) | Không | `lastActiveAt     DateTime      @default(now()) @map("last_active_at")`  |
| expiresAt | DateTime (scalar) | Không | `expiresAt        DateTime      @map("expires_at")`  |
| revokedAt | DateTime (scalar) | Có | `revokedAt        DateTime?     @map("revoked_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime      @default(now()) @map("created_at")`  |
| user | User (object) | Không | `user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([userId, revokedAt])`
- `@@index([userId, workspace, businessId, branchId, revokedAt], map: "user_sessions_user_id_workspace_business_id_branch_id_revoked_i")`
- `@@index([expiresAt])`
- `@@map("user_sessions")`

## PlatformSetting

Bảng: `platform_settings`; schema dòng 116; miền Thông báo và cấu hình. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`  |
| key | String (scalar) | Không | `key       String   @unique`  |
| value | Json (scalar) | Không | `value     Json`  |
| updatedBy | String (scalar) | Có | `updatedBy String?  @map("updated_by") @db.Uuid`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt DateTime @default(now()) @updatedAt @map("updated_at")`  |

Khóa chính: id. Unique đơn: key.

- `@@map("platform_settings")`

## StaffInvitation

Bảng: `staff_invitations`; schema dòng 127; miền Nhân sự và kỹ năng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String           @id @default(uuid())`  |
| email | String (scalar) | Không | `email          String`  |
| roleCode | RoleCode (enum) | Không | `roleCode       RoleCode         @map("role_code")`  |
| businessId | String (scalar) | Không | `businessId     String           @map("business_id")` (Không suy FK từ hậu tố Id) |
| branchId | String (scalar) | Có | `branchId       String?          @map("branch_id")` (Không suy FK từ hậu tố Id) |
| staffProfileId | String (scalar) | Có | `staffProfileId String?          @map("staff_profile_id")` **FK vật lý** |
| tokenHash | String (scalar) | Không | `tokenHash      String           @unique @map("token_hash")`  |
| status | InvitationStatus (enum) | Không | `status         InvitationStatus @default(PENDING)`  |
| invitedBy | String (scalar) | Không | `invitedBy      String           @map("invited_by")`  |
| expiresAt | DateTime (scalar) | Không | `expiresAt      DateTime         @map("expires_at")`  |
| acceptedAt | DateTime (scalar) | Có | `acceptedAt     DateTime?        @map("accepted_at")`  |
| acceptedBy | String (scalar) | Có | `acceptedBy     String?          @map("accepted_by")`  |
| revokedAt | DateTime (scalar) | Có | `revokedAt      DateTime?        @map("revoked_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime         @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime         @default(now()) @updatedAt @map("updated_at")`  |
| staffProfile | StaffProfile (object) | Có | `staffProfile   StaffProfile?    @relation(fields: [staffProfileId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: tokenHash.

- `@@index([email, status])`
- `@@index([businessId, branchId])`
- `@@index([staffProfileId, status])`
- `@@map("staff_invitations")`

## Role

Bảng: `roles`; schema dòng 151; miền Vai trò và cấp quyền. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id              String           @id @default(uuid())`  |
| code | RoleCode (enum) | Không | `code            RoleCode         @unique`  |
| name | String (scalar) | Không | `name            String`  |
| createdAt | DateTime (scalar) | Không | `createdAt       DateTime         @default(now()) @map("created_at")`  |
| level | RoleLevel (enum) | Không | `level           RoleLevel        @default(CUSTOMER)`  |
| rolePermissions | RolePermission[] (object) | Không | `rolePermissions RolePermission[]`  |
| userRoles | UserRole[] (object) | Không | `userRoles       UserRole[]`  |

Khóa chính: id. Unique đơn: code.

- `@@map("roles")`

## Permission

Bảng: `permissions`; schema dòng 163; miền Vai trò và cấp quyền. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id              String           @id @default(uuid())`  |
| code | String (scalar) | Không | `code            String           @unique`  |
| description | String (scalar) | Có | `description     String?`  |
| resource | String (scalar) | Không | `resource        String`  |
| action | String (scalar) | Không | `action          String`  |
| scope | PermissionScope (enum) | Không | `scope           PermissionScope  @default(SELF)`  |
| createdAt | DateTime (scalar) | Không | `createdAt       DateTime         @default(now()) @map("created_at")`  |
| rolePermissions | RolePermission[] (object) | Không | `rolePermissions RolePermission[]`  |
| userPermissions | UserPermission[] (object) | Không | `userPermissions UserPermission[]`  |

Khóa chính: id. Unique đơn: code.

- `@@index([resource, action])`
- `@@map("permissions")`

## RolePermission

Bảng: `role_permissions`; schema dòng 178; miền Vai trò và cấp quyền. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| roleId | String (scalar) | Không | `roleId       String     @map("role_id")` **FK vật lý** |
| permissionId | String (scalar) | Không | `permissionId String     @map("permission_id")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt    DateTime   @default(now()) @map("created_at")`  |
| permission | Permission (object) | Không | `permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)`  |
| role | Role (object) | Không | `role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)`  |

Khóa chính: roleId + permissionId. Unique đơn: không.

- `@@id([roleId, permissionId])`
- `@@index([permissionId])`
- `@@map("role_permissions")`

## UserPermission

Bảng: `user_permissions`; schema dòng 190; miền Vai trò và cấp quyền. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id           String     @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId       String     @map("user_id")` **FK vật lý** |
| permissionId | String (scalar) | Không | `permissionId String     @map("permission_id")` **FK vật lý** |
| bundleCode | String (scalar) | Có | `bundleCode   String?    @map("bundle_code")`  |
| grantedBy | String (scalar) | Có | `grantedBy    String?    @map("granted_by")`  |
| grantedAt | DateTime (scalar) | Không | `grantedAt    DateTime   @default(now()) @map("granted_at")`  |
| expiresAt | DateTime (scalar) | Có | `expiresAt    DateTime?  @map("expires_at")`  |
| revokedAt | DateTime (scalar) | Có | `revokedAt    DateTime?  @map("revoked_at")`  |
| user | User (object) | Không | `user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)`  |
| permission | Permission (object) | Không | `permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([userId, permissionId])`
- `@@index([userId, revokedAt, expiresAt])`
- `@@index([permissionId])`
- `@@map("user_permissions")`

## UserRole

Bảng: `user_roles`; schema dòng 213; miền Vai trò và cấp quyền. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| userId | String (scalar) | Không | `userId     String    @map("user_id")` **FK vật lý** |
| roleId | String (scalar) | Không | `roleId     String    @map("role_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId   String?   @map("branch_id")` **FK vật lý** |
| businessId | String (scalar) | Có | `businessId String?   @map("business_id")` **FK vật lý** |
| expiresAt | DateTime (scalar) | Có | `expiresAt  DateTime? @map("expires_at")`  |
| grantedAt | DateTime (scalar) | Không | `grantedAt  DateTime  @default(now()) @map("granted_at")`  |
| grantedBy | String (scalar) | Có | `grantedBy  String?   @map("granted_by")` **FK vật lý** |
| id | String (scalar) | Không | `id         String    @id @default(uuid())`  |
| branch | Branch (object) | Có | `branch     Branch?   @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| business | Business (object) | Có | `business   Business? @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| grantor | User (object) | Có | `grantor    User?     @relation("UserRoleGrantor", fields: [grantedBy], references: [id])`  |
| role | Role (object) | Không | `role       Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)`  |
| user | User (object) | Không | `user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([userId, roleId, businessId, branchId])`
- `@@index([userId])`
- `@@index([roleId])`
- `@@index([businessId])`
- `@@index([branchId])`
- `@@map("user_roles")`

## CustomerProfile

Bảng: `customer_profiles`; schema dòng 236; miền Định danh và phiên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| bookingPolicies | CustomerBookingPolicy[] (object) | Không | `bookingPolicies CustomerBookingPolicy[]`  |
| bookingViolations | BookingViolationEvent[] (object) | Không | `bookingViolations BookingViolationEvent[]`  |
| id | String (scalar) | Không | `id                      String                      @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId                  String                      @unique @map("user_id")` **FK vật lý** |
| address | String (scalar) | Có | `address                 String?`  |
| note | String (scalar) | Có | `note                    String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt               DateTime                    @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt               DateTime                    @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt               DateTime?                   @map("deleted_at")`  |
| bookings | Booking[] (object) | Không | `bookings                Booking[]`  |
| comments | BusinessComment[] (object) | Không | `comments                BusinessComment[]`  |
| user | User (object) | Không | `user                    User                        @relation(fields: [userId], references: [id], onDelete: Restrict)`  |
| customerVouchers | CustomerVoucher[] (object) | Không | `customerVouchers        CustomerVoucher[]`  |
| recurringPlans | RecurringBookingPlan[] (object) | Không | `recurringPlans          RecurringBookingPlan[]`  |
| reviews | Review[] (object) | Không | `reviews                 Review[]`  |
| dataSubjectRequests | DataSubjectRequest[] (object) | Không | `dataSubjectRequests     DataSubjectRequest[]`  |
| marketingPreference | MarketingPreference (object) | Có | `marketingPreference     MarketingPreference?`  |
| privacyExportPackages | PrivacyExportPackage[] (object) | Không | `privacyExportPackages   PrivacyExportPackage[]`  |
| packagePurchases | PackagePurchase[] (object) | Không | `packagePurchases        PackagePurchase[]`  |
| savedServices | CustomerSavedService[] (object) | Không | `savedServices           CustomerSavedService[]`  |
| invoiceRequests | InvoiceInformationRequest[] (object) | Không | `invoiceRequests         InvoiceInformationRequest[]`  |
| refs_PriceAdjustment_customerId | PriceAdjustment[] (object) | Không | `refs_PriceAdjustment_customerId PriceAdjustment[] @relation("Audit_PriceAdjustment_customerId")`  |
| refs_PromotionRedemption_customerId | PromotionRedemption[] (object) | Không | `refs_PromotionRedemption_customerId PromotionRedemption[] @relation("Audit_PromotionRedemption_customerId")`  |
| refs_VoucherRedemption_customerId | VoucherRedemption[] (object) | Không | `refs_VoucherRedemption_customerId VoucherRedemption[] @relation("Audit_VoucherRedemption_customerId")`  |
| refs_WaitlistEntry_customerId | WaitlistEntry[] (object) | Không | `refs_WaitlistEntry_customerId WaitlistEntry[] @relation("Audit_WaitlistEntry_customerId")`  |
| refs_LoyaltyAccount_customerId | LoyaltyAccount[] (object) | Không | `refs_LoyaltyAccount_customerId LoyaltyAccount[] @relation("Audit_LoyaltyAccount_customerId")`  |
| refs_LoyaltyTransaction_customerId | LoyaltyTransaction[] (object) | Không | `refs_LoyaltyTransaction_customerId LoyaltyTransaction[] @relation("Audit_LoyaltyTransaction_customerId")`  |
| refs_CustomerBusinessSegment_customerId | CustomerBusinessSegment[] (object) | Không | `refs_CustomerBusinessSegment_customerId CustomerBusinessSegment[] @relation("Audit_CustomerBusinessSegment_customerId")`  |

Khóa chính: id. Unique đơn: userId.

- `@@map("customer_profiles")`

## BookingContact

Bảng: `booking_contacts`; schema dòng 271; miền Lịch và phần dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String   @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId String   @unique @map("booking_id")` **FK vật lý** |
| fullName | String (scalar) | Không | `fullName  String   @map("full_name")`  |
| phone | String (scalar) | Có | `phone     String?`  |
| email | String (scalar) | Có | `email     String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime @default(now()) @map("created_at")`  |
| booking | Booking (object) | Không | `booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: bookingId.

- `@@index([phone])`
- `@@map("booking_contacts")`

## BusinessOwnerProfile

Bảng: `business_owner_profiles`; schema dòng 284; miền Định danh và phiên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                 String     @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId             String     @unique @map("user_id")` **FK vật lý** |
| companyName | String (scalar) | Có | `companyName        String?    @map("company_name")`  |
| taxCode | String (scalar) | Có | `taxCode            String?    @unique @map("tax_code")`  |
| identityCardNumber | String (scalar) | Có | `identityCardNumber String?    @map("identity_card_number")`  |
| createdAt | DateTime (scalar) | Không | `createdAt          DateTime   @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt          DateTime   @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt          DateTime?  @map("deleted_at")`  |
| user | User (object) | Không | `user               User       @relation(fields: [userId], references: [id], onDelete: Restrict)`  |
| businesses | Business[] (object) | Không | `businesses         Business[]`  |
| refs_OwnershipTransfer_oldOwnerId | OwnershipTransfer[] (object) | Không | `refs_OwnershipTransfer_oldOwnerId OwnershipTransfer[] @relation("Audit_OwnershipTransfer_oldOwnerId")`  |
| refs_OwnershipHistory_ownerId | OwnershipHistory[] (object) | Không | `refs_OwnershipHistory_ownerId OwnershipHistory[] @relation("Audit_OwnershipHistory_ownerId")`  |

Khóa chính: id. Unique đơn: userId, taxCode.

- `@@map("business_owner_profiles")`

## StaffProfile

Bảng: `staff_profiles`; schema dòng 301; miền Nhân sự và kỹ năng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                      String                       @id @default(uuid())`  |
| userId | String (scalar) | Có | `userId                  String?                      @unique @map("user_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId                String                       @map("branch_id")` **FK vật lý** |
| fullName | String (scalar) | Không | `fullName                String                       @map("full_name")`  |
| position | String (scalar) | Có | `position                String?`  |
| bio | String (scalar) | Có | `bio                     String?`  |
| employeeCode | String (scalar) | Có | `employeeCode            String?                      @map("employee_code")`  |
| experienceYears | Int (scalar) | Có | `experienceYears         Int?                         @map("experience_years")`  |
| publicVisible | Boolean (scalar) | Không | `publicVisible           Boolean                      @default(true) @map("public_visible")`  |
| isBookable | Boolean (scalar) | Không | `isBookable              Boolean                      @default(false) @map("is_bookable")`  |
| emergencyContactName | String (scalar) | Có | `emergencyContactName    String?                      @map("emergency_contact_name")`  |
| emergencyContactPhone | String (scalar) | Có | `emergencyContactPhone   String?                      @map("emergency_contact_phone")`  |
| status | StaffStatus (enum) | Không | `status                  StaffStatus                  @default(ACTIVE)`  |
| hiredAt | DateTime (scalar) | Có | `hiredAt                 DateTime?                    @map("hired_at") @db.Date`  |
| createdAt | DateTime (scalar) | Không | `createdAt               DateTime                     @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt               DateTime                     @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt               DateTime?                    @map("deleted_at")`  |
| changeRequests | AppointmentChangeRequest[] (object) | Không | `changeRequests          AppointmentChangeRequest[]   @relation("ChangeRequestProposedStaff")`  |
| bookingServices | BookingService[] (object) | Không | `bookingServices         BookingService[]`  |
| reviewRatings | ReviewServiceRating[] (object) | Không | `reviewRatings           ReviewServiceRating[]`  |
| images | StaffImage[] (object) | Không | `images                  StaffImage[]`  |
| branch | Branch (object) | Không | `branch                  Branch                       @relation(fields: [branchId], references: [id])`  |
| user | User (object) | Có | `user                    User?                        @relation(fields: [userId], references: [id])`  |
| staffServices | StaffService[] (object) | Không | `staffServices           StaffService[]`  |
| recurringPlans | RecurringBookingPlan[] (object) | Không | `recurringPlans          RecurringBookingPlan[]`  |
| branchAssignments | StaffBranchAssignment[] (object) | Không | `branchAssignments       StaffBranchAssignment[]`  |
| invitations | StaffInvitation[] (object) | Không | `invitations             StaffInvitation[]`  |
| refs_OperationalImpactItem_replacementStaffId | OperationalImpactItem[] (object) | Không | `refs_OperationalImpactItem_replacementStaffId OperationalImpactItem[] @relation("Audit_OperationalImpactItem_replacementStaffId")`  |
| refs_WaitlistEntry_staffId | WaitlistEntry[] (object) | Không | `refs_WaitlistEntry_staffId WaitlistEntry[] @relation("Audit_WaitlistEntry_staffId")`  |

Khóa chính: id. Unique đơn: userId.

- `@@unique([branchId, employeeCode])`
- `@@index([branchId])`
- `@@index([status])`
- `@@index([branchId, status, isBookable, publicVisible])`
- `@@map("staff_profiles")`

## DeviceToken

Bảng: `device_tokens`; schema dòng 339; miền Thông báo và cấu hình. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String         @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId    String         @map("user_id")` **FK vật lý** |
| token | String (scalar) | Không | `token     String         @unique`  |
| platform | DevicePlatform (enum) | Không | `platform  DevicePlatform`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime       @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt DateTime       @updatedAt @map("updated_at")`  |
| user | User (object) | Không | `user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: token.

- `@@index([userId])`
- `@@map("device_tokens")`

## Province

Bảng: `provinces`; schema dòng 352; miền Địa bàn và giờ mở cửa. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String     @id @default(uuid())`  |
| name | String (scalar) | Không | `name      String     @unique`  |
| code | String (scalar) | Có | `code      String?    @unique`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime   @default(now()) @map("created_at")`  |
| districts | District[] (object) | Không | `districts District[]`  |

Khóa chính: id. Unique đơn: name, code.

- `@@map("provinces")`

## District

Bảng: `districts`; schema dòng 362; miền Địa bàn và giờ mở cửa. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String   @id @default(uuid())`  |
| provinceId | String (scalar) | Không | `provinceId String   @map("province_id")` **FK vật lý** |
| name | String (scalar) | Không | `name       String`  |
| code | String (scalar) | Có | `code       String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime @default(now()) @map("created_at")`  |
| branches | Branch[] (object) | Không | `branches   Branch[]`  |
| province | Province (object) | Không | `province   Province @relation(fields: [provinceId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([provinceId, name])`
- `@@index([provinceId])`
- `@@map("districts")`

## Business

Bảng: `businesses`; schema dòng 376; miền Doanh nghiệp và thành viên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| customerBookingPolicies | CustomerBookingPolicy[] (object) | Không | `customerBookingPolicies CustomerBookingPolicy[]`  |
| bookingViolations | BookingViolationEvent[] (object) | Không | `bookingViolations BookingViolationEvent[]`  |
| id | String (scalar) | Không | `id                        String                       @id @default(uuid())`  |
| ownerId | String (scalar) | Không | `ownerId                   String                       @map("owner_id")` **FK vật lý** |
| name | String (scalar) | Không | `name                      String`  |
| slug | String (scalar) | Không | `slug                      String                       @unique`  |
| description | String (scalar) | Có | `description               String?`  |
| contactEmail | String (scalar) | Có | `contactEmail              String?                      @map("contact_email")`  |
| contactPhone | String (scalar) | Có | `contactPhone              String?                      @map("contact_phone")`  |
| addressLine | String (scalar) | Có | `addressLine               String?                      @map("address_line")`  |
| legalRepresentative | String (scalar) | Có | `legalRepresentative       String?                      @map("legal_representative")`  |
| legalDocuments | Json (scalar) | Có | `legalDocuments            Json?                        @map("legal_documents")`  |
| onboardingData | Json (scalar) | Có | `onboardingData            Json?                        @map("onboarding_data")`  |
| onboardingStep | Int (scalar) | Không | `onboardingStep            Int                          @default(1) @map("onboarding_step")`  |
| marketplacePreviewedAt | DateTime (scalar) | Có | `marketplacePreviewedAt    DateTime?                    @map("marketplace_previewed_at")`  |
| reviewNote | String (scalar) | Có | `reviewNote                String?                      @map("review_note")`  |
| submittedAt | DateTime (scalar) | Có | `submittedAt               DateTime?                    @map("submitted_at")`  |
| reviewedAt | DateTime (scalar) | Có | `reviewedAt                DateTime?                    @map("reviewed_at")`  |
| logoMediaId | String (scalar) | Có | `logoMediaId               String?                      @map("logo_media_id")` **FK vật lý** |
| status | BusinessStatus (enum) | Không | `status                    BusinessStatus               @default(PENDING)`  |
| createdAt | DateTime (scalar) | Không | `createdAt                 DateTime                     @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt                 DateTime                     @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt                 DateTime?                    @map("deleted_at")`  |
| branches | Branch[] (object) | Không | `branches                  Branch[]`  |
| comments | BusinessComment[] (object) | Không | `comments                  BusinessComment[]`  |
| images | BusinessImage[] (object) | Không | `images                    BusinessImage[]`  |
| logoMedia | MediaFile (object) | Có | `logoMedia                 MediaFile?                   @relation("BusinessLogo", fields: [logoMediaId], references: [id])`  |
| owner | BusinessOwnerProfile (object) | Không | `owner                     BusinessOwnerProfile         @relation(fields: [ownerId], references: [id])`  |
| cancellationPolicy | CancellationPolicy (object) | Có | `cancellationPolicy        CancellationPolicy?`  |
| promotionLinks | PromotionBusiness[] (object) | Không | `promotionLinks            PromotionBusiness[]`  |
| members | SalonMember[] (object) | Không | `members                   SalonMember[]`  |
| trustSnapshot | SalonTrustSnapshot (object) | Có | `trustSnapshot             SalonTrustSnapshot?`  |
| userRoles | UserRole[] (object) | Không | `userRoles                 UserRole[]`  |
| ownedPromotions | Promotion[] (object) | Không | `ownedPromotions           Promotion[]                  @relation("PromotionOwner")`  |
| vouchers | Voucher[] (object) | Không | `vouchers                  Voucher[]`  |
| serviceCatalog | BusinessService[] (object) | Không | `serviceCatalog            BusinessService[]`  |
| serviceCategories | ServiceCategory[] (object) | Không | `serviceCategories         ServiceCategory[]`  |
| bookingRestrictedAt | DateTime (scalar) | Có | `bookingRestrictedAt       DateTime?                    @map("booking_restricted_at")`  |
| bookingRestrictionReason | String (scalar) | Có | `bookingRestrictionReason  String?                      @map("booking_restriction_reason")`  |
| trustActions | TrustAction[] (object) | Không | `trustActions              TrustAction[]`  |
| reviewEvents | BusinessReviewEvent[] (object) | Không | `reviewEvents              BusinessReviewEvent[]`  |
| documents | BusinessDocument[] (object) | Không | `documents                 BusinessDocument[]`  |
| combos | Combo[] (object) | Không | `combos                    Combo[]`  |
| paymentPolicies | PaymentPolicy[] (object) | Không | `paymentPolicies           PaymentPolicy[]`  |
| pricingSnapshots | PricingSnapshot[] (object) | Không | `pricingSnapshots          PricingSnapshot[]`  |
| paymentPolicySnapshots | PaymentPolicySnapshot[] (object) | Không | `paymentPolicySnapshots    PaymentPolicySnapshot[]`  |
| paymentIntents | PaymentIntent[] (object) | Không | `paymentIntents            PaymentIntent[]`  |
| paymentTransactions | PaymentTransaction[] (object) | Không | `paymentTransactions       PaymentTransaction[]`  |
| financialLedgerEntries | FinancialLedgerEntry[] (object) | Không | `financialLedgerEntries    FinancialLedgerEntry[]`  |
| platformFeeEntries | PlatformFeeEntry[] (object) | Không | `platformFeeEntries        PlatformFeeEntry[]`  |
| platformFeeAdjustments | PlatformFeeAdjustment[] (object) | Không | `platformFeeAdjustments    PlatformFeeAdjustment[]`  |
| platformStatements | PlatformStatement[] (object) | Không | `platformStatements        PlatformStatement[]`  |
| treatmentPackages | TreatmentPackage[] (object) | Không | `treatmentPackages         TreatmentPackage[]`  |
| packagePurchases | PackagePurchase[] (object) | Không | `packagePurchases          PackagePurchase[]`  |
| invoiceRequests | InvoiceInformationRequest[] (object) | Không | `invoiceRequests           InvoiceInformationRequest[]`  |
| refs_OperationalImpactCase_businessId | OperationalImpactCase[] (object) | Không | `refs_OperationalImpactCase_businessId OperationalImpactCase[] @relation("Audit_OperationalImpactCase_businessId")`  |
| refs_WaitlistEntry_businessId | WaitlistEntry[] (object) | Không | `refs_WaitlistEntry_businessId WaitlistEntry[] @relation("Audit_WaitlistEntry_businessId")`  |
| refs_LoyaltyRule_businessId | LoyaltyRule[] (object) | Không | `refs_LoyaltyRule_businessId LoyaltyRule[] @relation("Audit_LoyaltyRule_businessId")`  |
| refs_LoyaltyAccount_businessId | LoyaltyAccount[] (object) | Không | `refs_LoyaltyAccount_businessId LoyaltyAccount[] @relation("Audit_LoyaltyAccount_businessId")`  |
| refs_LoyaltyTransaction_businessId | LoyaltyTransaction[] (object) | Không | `refs_LoyaltyTransaction_businessId LoyaltyTransaction[] @relation("Audit_LoyaltyTransaction_businessId")`  |
| refs_Invoice_businessId | Invoice[] (object) | Không | `refs_Invoice_businessId Invoice[] @relation("Audit_Invoice_businessId")`  |
| refs_OwnershipTransfer_businessId | OwnershipTransfer[] (object) | Không | `refs_OwnershipTransfer_businessId OwnershipTransfer[] @relation("Audit_OwnershipTransfer_businessId")`  |
| refs_OwnershipHistory_businessId | OwnershipHistory[] (object) | Không | `refs_OwnershipHistory_businessId OwnershipHistory[] @relation("Audit_OwnershipHistory_businessId")`  |
| refs_LegalEntityVersion_businessId | LegalEntityVersion[] (object) | Không | `refs_LegalEntityVersion_businessId LegalEntityVersion[] @relation("Audit_LegalEntityVersion_businessId")`  |
| refs_PayoutAccountVersion_businessId | PayoutAccountVersion[] (object) | Không | `refs_PayoutAccountVersion_businessId PayoutAccountVersion[] @relation("Audit_PayoutAccountVersion_businessId")`  |
| refs_CustomerBusinessSegment_businessId | CustomerBusinessSegment[] (object) | Không | `refs_CustomerBusinessSegment_businessId CustomerBusinessSegment[] @relation("Audit_CustomerBusinessSegment_businessId")`  |

Khóa chính: id. Unique đơn: slug.

- `@@index([ownerId])`
- `@@index([status])`
- `@@index([name])`
- `@@map("businesses")`

## Branch

Bảng: `branches`; schema dòng 450; miền Chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                        String                       @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId                String                       @map("business_id")` **FK vật lý** |
| name | String (scalar) | Không | `name                      String`  |
| publicName | String (scalar) | Có | `publicName                String?                      @map("public_name")`  |
| description | String (scalar) | Có | `description               String?`  |
| addressLine | String (scalar) | Có | `addressLine               String?                      @map("address_line")`  |
| districtId | String (scalar) | Có | `districtId                String?                      @map("district_id")` **FK vật lý** |
| ward | String (scalar) | Có | `ward                      String?`  |
| floor | String (scalar) | Có | `floor                     String?`  |
| directions | String (scalar) | Có | `directions                String?`  |
| latitude | Decimal (scalar) | Có | `latitude                  Decimal?                     @db.Decimal(9, 6)`  |
| longitude | Decimal (scalar) | Có | `longitude                 Decimal?                     @db.Decimal(9, 6)`  |
| phone | String (scalar) | Có | `phone                     String?`  |
| email | String (scalar) | Có | `email                     String?`  |
| serviceMode | BranchServiceMode (enum) | Không | `serviceMode               BranchServiceMode            @default(AT_LOCATION) @map("service_mode")`  |
| sameLegalEntity | Boolean (scalar) | Không | `sameLegalEntity           Boolean                      @default(true) @map("same_legal_entity")`  |
| managerName | String (scalar) | Có | `managerName               String?                      @map("manager_name")`  |
| scheduledOpeningDate | DateTime (scalar) | Có | `scheduledOpeningDate      DateTime?                    @map("scheduled_opening_date") @db.Date`  |
| timezone | String (scalar) | Không | `timezone                  String                       @default("Asia/Ho_Chi_Minh")`  |
| bookingStartDate | DateTime (scalar) | Có | `bookingStartDate          DateTime?                    @map("booking_start_date") @db.Date`  |
| serviceAreas | Json (scalar) | Có | `serviceAreas              Json?                        @map("service_areas")`  |
| serviceRadiusKm | Int (scalar) | Có | `serviceRadiusKm           Int?                         @map("service_radius_km")`  |
| travelFee | Decimal (scalar) | Có | `travelFee                 Decimal?                     @map("travel_fee") @db.Decimal(12, 2)`  |
| excludedServiceAreas | Json (scalar) | Có | `excludedServiceAreas      Json?                        @map("excluded_service_areas")`  |
| bookingConfirmationMode | BookingConfirmationMode (enum) | Không | `bookingConfirmationMode   BookingConfirmationMode      @default(MANUAL_CONFIRMATION) @map("booking_confirmation_mode")`  |
| staffAssignmentMode | StaffAssignmentMode (enum) | Không | `staffAssignmentMode       StaffAssignmentMode          @default(AUTO_ASSIGN_IF_ANY_STAFF) @map("staff_assignment_mode")`  |
| pendingHoldMinutes | Int (scalar) | Không | `pendingHoldMinutes        Int                          @default(30) @map("pending_hold_minutes")`  |
| status | BranchStatus (enum) | Không | `status                    BranchStatus                 @default(PENDING)`  |
| reviewStatus | BranchReviewStatus (enum) | Không | `reviewStatus              BranchReviewStatus           @default(DRAFT) @map("review_status")`  |
| operationalStatus | BranchOperationalStatus (enum) | Không | `operationalStatus         BranchOperationalStatus      @default(INACTIVE) @map("operational_status")`  |
| reviewNote | String (scalar) | Có | `reviewNote                String?                      @map("review_note")`  |
| submittedAt | DateTime (scalar) | Có | `submittedAt               DateTime?                    @map("submitted_at")`  |
| reviewedAt | DateTime (scalar) | Có | `reviewedAt                DateTime?                    @map("reviewed_at")`  |
| publishedAt | DateTime (scalar) | Có | `publishedAt               DateTime?                    @map("published_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt                 DateTime                     @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt                 DateTime                     @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt                 DateTime?                    @map("deleted_at")`  |
| bookings | Booking[] (object) | Không | `bookings                  Booking[]`  |
| images | BranchImage[] (object) | Không | `images                    BranchImage[]`  |
| workingHours | BranchWorkingHour[] (object) | Không | `workingHours              BranchWorkingHour[]`  |
| business | Business (object) | Không | `business                  Business                     @relation(fields: [businessId], references: [id])`  |
| district | District (object) | Có | `district                  District?                    @relation(fields: [districtId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| combos | Combo[] (object) | Không | `combos                    Combo[]`  |
| promotionLinks | PromotionBranch[] (object) | Không | `promotionLinks            PromotionBranch[]`  |
| recurringPlans | RecurringBookingPlan[] (object) | Không | `recurringPlans            RecurringBookingPlan[]`  |
| salonMembers | SalonMember[] (object) | Không | `salonMembers              SalonMember[]`  |
| services | BranchServiceOffering[] (object) | Không | `services                  BranchServiceOffering[]`  |
| staff | StaffProfile[] (object) | Không | `staff                     StaffProfile[]`  |
| userRoles | UserRole[] (object) | Không | `userRoles                 UserRole[]`  |
| holidays | BranchHoliday[] (object) | Không | `holidays                  BranchHoliday[]`  |
| specialDays | SpecialWorkingDay[] (object) | Không | `specialDays               SpecialWorkingDay[]`  |
| trustActions | TrustAction[] (object) | Không | `trustActions              TrustAction[]`  |
| onboardingProgress | BranchOnboardingProgress (object) | Có | `onboardingProgress        BranchOnboardingProgress?`  |
| bookingPolicy | BranchBookingPolicy (object) | Có | `bookingPolicy             BranchBookingPolicy?`  |
| documents | BranchDocument[] (object) | Không | `documents                 BranchDocument[]`  |
| reviewRequests | BranchReviewRequest[] (object) | Không | `reviewRequests            BranchReviewRequest[]`  |
| reviewEvents | BranchReviewEvent[] (object) | Không | `reviewEvents              BranchReviewEvent[]`  |
| staffAssignments | StaffBranchAssignment[] (object) | Không | `staffAssignments          StaffBranchAssignment[]`  |
| paymentPolicies | PaymentPolicy[] (object) | Không | `paymentPolicies           PaymentPolicy[]`  |
| pricingSnapshots | PricingSnapshot[] (object) | Không | `pricingSnapshots          PricingSnapshot[]`  |
| paymentPolicySnapshots | PaymentPolicySnapshot[] (object) | Không | `paymentPolicySnapshots    PaymentPolicySnapshot[]`  |
| paymentIntents | PaymentIntent[] (object) | Không | `paymentIntents            PaymentIntent[]`  |
| paymentTransactions | PaymentTransaction[] (object) | Không | `paymentTransactions       PaymentTransaction[]`  |
| financialLedgerEntries | FinancialLedgerEntry[] (object) | Không | `financialLedgerEntries    FinancialLedgerEntry[]`  |
| platformFeeEntries | PlatformFeeEntry[] (object) | Không | `platformFeeEntries        PlatformFeeEntry[]`  |
| platformFeeAdjustments | PlatformFeeAdjustment[] (object) | Không | `platformFeeAdjustments    PlatformFeeAdjustment[]`  |
| treatmentPackages | TreatmentPackage[] (object) | Không | `treatmentPackages         TreatmentPackage[]`  |
| packagePurchases | PackagePurchase[] (object) | Không | `packagePurchases          PackagePurchase[]`  |
| invoiceRequests | InvoiceInformationRequest[] (object) | Không | `invoiceRequests           InvoiceInformationRequest[]`  |
| voucherBranchScopes | VoucherBranchScope[] (object) | Không | `voucherBranchScopes       VoucherBranchScope[]`  |
| refs_BranchStateTransition_branchId | BranchStateTransition[] (object) | Không | `refs_BranchStateTransition_branchId BranchStateTransition[] @relation("Audit_BranchStateTransition_branchId")`  |
| refs_PriceAdjustment_branchId | PriceAdjustment[] (object) | Không | `refs_PriceAdjustment_branchId PriceAdjustment[] @relation("Audit_PriceAdjustment_branchId")`  |
| refs_PromotionRedemption_branchId | PromotionRedemption[] (object) | Không | `refs_PromotionRedemption_branchId PromotionRedemption[] @relation("Audit_PromotionRedemption_branchId")`  |
| refs_VoucherRedemption_branchId | VoucherRedemption[] (object) | Không | `refs_VoucherRedemption_branchId VoucherRedemption[] @relation("Audit_VoucherRedemption_branchId")`  |
| refs_OperationalImpactCase_branchId | OperationalImpactCase[] (object) | Không | `refs_OperationalImpactCase_branchId OperationalImpactCase[] @relation("Audit_OperationalImpactCase_branchId")`  |
| refs_OperationalImpactItem_replacementBranchId | OperationalImpactItem[] (object) | Không | `refs_OperationalImpactItem_replacementBranchId OperationalImpactItem[] @relation("Audit_OperationalImpactItem_replacementBranchId")`  |
| refs_WaitlistEntry_branchId | WaitlistEntry[] (object) | Không | `refs_WaitlistEntry_branchId WaitlistEntry[] @relation("Audit_WaitlistEntry_branchId")`  |
| refs_LoyaltyRule_branchId | LoyaltyRule[] (object) | Không | `refs_LoyaltyRule_branchId LoyaltyRule[] @relation("Audit_LoyaltyRule_branchId")`  |
| refs_Invoice_branchId | Invoice[] (object) | Không | `refs_Invoice_branchId Invoice[] @relation("Audit_Invoice_branchId")`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId])`
- `@@index([districtId])`
- `@@index([status])`
- `@@index([reviewStatus])`
- `@@index([operationalStatus])`
- `@@index([status, deletedAt, createdAt])`
- `@@index([latitude, longitude])`
- `@@map("branches")`

## BranchWorkingHour

Bảng: `branch_working_hours`; schema dòng 541; miền Địa bàn và giờ mở cửa. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String   @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId  String   @map("branch_id")` **FK vật lý** |
| dayOfWeek | Int (scalar) | Không | `dayOfWeek Int      @map("day_of_week") @db.SmallInt`  |
| openTime | DateTime (scalar) | Không | `openTime  DateTime @map("open_time") @db.Time(6)`  |
| closeTime | DateTime (scalar) | Không | `closeTime DateTime @map("close_time") @db.Time(6)`  |
| isClosed | Boolean (scalar) | Không | `isClosed  Boolean  @default(false) @map("is_closed")`  |
| branch | Branch (object) | Không | `branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([branchId, dayOfWeek])`
- `@@map("branch_working_hours")`

## BranchOnboardingProgress

Bảng: `branch_onboarding_progress`; schema dòng 554; miền Chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String   @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId       String   @unique @map("branch_id")` **FK vật lý** |
| currentStep | Int (scalar) | Không | `currentStep    Int      @default(1) @map("current_step")`  |
| completedSteps | Json (scalar) | Không | `completedSteps Json     @default("[]") @map("completed_steps")`  |
| draftData | Json (scalar) | Có | `draftData      Json?    @map("draft_data")`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime @updatedAt @map("updated_at")`  |
| branch | Branch (object) | Không | `branch         Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: branchId.

- `@@map("branch_onboarding_progress")`

## BranchBookingPolicy

Bảng: `branch_booking_policies`; schema dòng 567; miền Chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                   String    @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId             String    @unique @map("branch_id")` **FK vật lý** |
| leadTimeMinutes | Int (scalar) | Không | `leadTimeMinutes      Int       @default(0) @map("lead_time_minutes")`  |
| bookingHorizonDays | Int (scalar) | Không | `bookingHorizonDays   Int       @default(90) @map("booking_horizon_days")`  |
| cancellationHours | Int (scalar) | Không | `cancellationHours    Int       @default(24) @map("cancellation_hours")`  |
| rescheduleHours | Int (scalar) | Không | `rescheduleHours      Int       @default(12) @map("reschedule_hours")`  |
| noShowHandling | String (scalar) | Có | `noShowHandling       String?   @map("no_show_handling")`  |
| earlyCheckInMinutes | Int (scalar) | Không | `earlyCheckInMinutes  Int       @default(0) @map("early_check_in_minutes")`  |
| gracePeriodMinutes | Int (scalar) | Không | `gracePeriodMinutes   Int       @default(10) @map("grace_period_minutes")`  |
| allowWalkIn | Boolean (scalar) | Không | `allowWalkIn          Boolean   @default(true) @map("allow_walk_in")`  |
| allowCounterBooking | Boolean (scalar) | Không | `allowCounterBooking  Boolean   @default(true) @map("allow_counter_booking")`  |
| defaultBufferMinutes | Int (scalar) | Không | `defaultBufferMinutes Int       @default(0) @map("default_buffer_minutes")`  |
| overbookingEnabled | Boolean (scalar) | Không | `overbookingEnabled   Boolean   @default(false) @map("overbooking_enabled")`  |
| maxOverbookedSlots | Int (scalar) | Không | `maxOverbookedSlots   Int       @default(0) @map("max_overbooked_slots")`  |
| depositPolicy | Json (scalar) | Có | `depositPolicy        Json?     @map("deposit_policy")`  |
| confirmedAt | DateTime (scalar) | Có | `confirmedAt          DateTime? @map("confirmed_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt            DateTime  @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt            DateTime  @updatedAt @map("updated_at")`  |
| branch | Branch (object) | Không | `branch               Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: branchId.

- `@@map("branch_booking_policies")`

## OverbookingOverride

Bảng: `overbooking_overrides`; schema dòng 591; miền Yêu cầu và chính sách khách. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id          String   @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId   String   @unique @map("booking_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId    String   @map("branch_id")` (Không suy FK từ hậu tố Id) |
| actorId | String (scalar) | Không | `actorId     String   @map("actor_id")` (Không suy FK từ hậu tố Id) |
| reason | String (scalar) | Không | `reason      String`  |
| policyLimit | Int (scalar) | Không | `policyLimit Int      @map("policy_limit")`  |
| startAt | DateTime (scalar) | Không | `startAt     DateTime @map("start_at")`  |
| endAt | DateTime (scalar) | Không | `endAt       DateTime @map("end_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt   DateTime @default(now()) @map("created_at")`  |
| booking | Booking (object) | Không | `booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: bookingId.

- `@@index([branchId, startAt, endAt])`
- `@@map("overbooking_overrides")`

## BranchHoliday

Bảng: `branch_holidays`; schema dòng 607; miền Địa bàn và giờ mở cửa. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id       String   @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId String   @map("branch_id")` **FK vật lý** |
| date | DateTime (scalar) | Không | `date     DateTime @db.Date`  |
| name | String (scalar) | Không | `name     String`  |
| isClosed | Boolean (scalar) | Không | `isClosed Boolean  @default(true) @map("is_closed")`  |
| branch | Branch (object) | Không | `branch   Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([branchId, date])`
- `@@map("branch_holidays")`

## SpecialWorkingDay

Bảng: `special_working_days`; schema dòng 619; miền Địa bàn và giờ mở cửa. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String   @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId  String   @map("branch_id")` **FK vật lý** |
| date | DateTime (scalar) | Không | `date      DateTime @db.Date`  |
| startTime | DateTime (scalar) | Không | `startTime DateTime @map("start_time") @db.Time(6)`  |
| endTime | DateTime (scalar) | Không | `endTime   DateTime @map("end_time") @db.Time(6)`  |
| branch | Branch (object) | Không | `branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([branchId, date])`
- `@@index([branchId, date], map: "special_working_days_branch_id_date_idx")`
- `@@map("special_working_days")`

## StaffBranchAssignment

Bảng: `staff_branch_assignments`; schema dòng 632; miền Nhân sự và kỹ năng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String                @id @default(uuid())`  |
| staffId | String (scalar) | Không | `staffId    String                @map("staff_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId   String                @map("branch_id")` **FK vật lý** |
| startDate | DateTime (scalar) | Không | `startDate  DateTime              @map("start_date") @db.Date`  |
| endDate | DateTime (scalar) | Có | `endDate    DateTime?             @map("end_date") @db.Date`  |
| status | StaffAssignmentStatus (enum) | Không | `status     StaffAssignmentStatus @default(ACTIVE)`  |
| jobTitle | String (scalar) | Có | `jobTitle   String?               @map("job_title")`  |
| isPrimary | Boolean (scalar) | Không | `isPrimary  Boolean               @default(false) @map("is_primary")`  |
| isBookable | Boolean (scalar) | Không | `isBookable Boolean               @default(false) @map("is_bookable")`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime              @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt  DateTime              @updatedAt @map("updated_at")`  |
| staff | StaffProfile (object) | Không | `staff      StaffProfile          @relation(fields: [staffId], references: [id], onDelete: Cascade)`  |
| branch | Branch (object) | Không | `branch     Branch                @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([staffId, branchId, startDate])`
- `@@index([branchId, status, startDate])`
- `@@index([staffId, status, startDate])`
- `@@map("staff_branch_assignments")`

## MediaFile

Bảng: `media_files`; schema dòng 653; miền Ảnh và media. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                       String                    @id @default(uuid())`  |
| url | String (scalar) | Không | `url                      String`  |
| storageKey | String (scalar) | Có | `storageKey               String?                   @unique @map("storage_key")`  |
| originalName | String (scalar) | Có | `originalName             String?                   @map("original_name")`  |
| safeName | String (scalar) | Có | `safeName                 String?                   @map("safe_name")`  |
| mimeType | String (scalar) | Có | `mimeType                 String?                   @map("mime_type")`  |
| extension | String (scalar) | Có | `extension                String?`  |
| fileType | String (scalar) | Có | `fileType                 String?                   @map("file_type")`  |
| fileSize | Int (scalar) | Có | `fileSize                 Int?                      @map("file_size")`  |
| uploadedBy | String (scalar) | Có | `uploadedBy               String?                   @map("uploaded_by")` **FK vật lý** |
| businessId | String (scalar) | Có | `businessId               String?                   @map("business_id")` (Không suy FK từ hậu tố Id) |
| branchId | String (scalar) | Có | `branchId                 String?                   @map("branch_id")` (Không suy FK từ hậu tố Id) |
| entityType | String (scalar) | Có | `entityType               String?                   @map("entity_type")`  |
| entityId | String (scalar) | Có | `entityId                 String?                   @map("entity_id")` (Không suy FK từ hậu tố Id) |
| visibility | MediaVisibility (enum) | Không | `visibility               MediaVisibility           @default(PUBLIC)`  |
| createdAt | DateTime (scalar) | Không | `createdAt                DateTime                  @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt                DateTime                  @default(now()) @updatedAt @map("updated_at")`  |
| branchImages | BranchImage[] (object) | Không | `branchImages             BranchImage[]`  |
| businessImages | BusinessImage[] (object) | Không | `businessImages           BusinessImage[]`  |
| businessLogos | Business[] (object) | Không | `businessLogos            Business[]                @relation("BusinessLogo")`  |
| comboImages | ComboImage[] (object) | Không | `comboImages              ComboImage[]`  |
| uploader | User (object) | Có | `uploader                 User?                     @relation("MediaUploader", fields: [uploadedBy], references: [id])`  |
| serviceImages | ServiceImage[] (object) | Không | `serviceImages            ServiceImage[]`  |
| staffImages | StaffImage[] (object) | Không | `staffImages              StaffImage[]`  |
| userAvatars | User[] (object) | Không | `userAvatars              User[]                    @relation("UserAvatar")`  |
| businessDocumentVersions | BusinessDocumentVersion[] (object) | Không | `businessDocumentVersions BusinessDocumentVersion[]`  |
| branchDocumentVersions | BranchDocumentVersion[] (object) | Không | `branchDocumentVersions   BranchDocumentVersion[]`  |

Khóa chính: id. Unique đơn: storageKey.

- `@@index([uploadedBy])`
- `@@index([businessId, branchId])`
- `@@index([entityType, entityId])`
- `@@map("media_files")`

## BusinessImage

Bảng: `business_images`; schema dòng 688; miền Ảnh và media. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String    @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId String    @map("business_id")` **FK vật lý** |
| mediaId | String (scalar) | Không | `mediaId    String    @map("media_id")` **FK vật lý** |
| isCover | Boolean (scalar) | Không | `isCover    Boolean   @default(false) @map("is_cover")`  |
| sortOrder | Int (scalar) | Không | `sortOrder  Int       @default(0) @map("sort_order")`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime  @default(now()) @map("created_at")`  |
| business | Business (object) | Không | `business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| media | MediaFile (object) | Không | `media      MediaFile @relation(fields: [mediaId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId])`
- `@@map("business_images")`

## BranchImage

Bảng: `branch_images`; schema dòng 702; miền Ảnh và media. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String    @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId  String    @map("branch_id")` **FK vật lý** |
| mediaId | String (scalar) | Không | `mediaId   String    @map("media_id")` **FK vật lý** |
| isCover | Boolean (scalar) | Không | `isCover   Boolean   @default(false) @map("is_cover")`  |
| sortOrder | Int (scalar) | Không | `sortOrder Int       @default(0) @map("sort_order")`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime  @default(now()) @map("created_at")`  |
| branch | Branch (object) | Không | `branch    Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| media | MediaFile (object) | Không | `media     MediaFile @relation(fields: [mediaId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([branchId])`
- `@@map("branch_images")`

## ServiceImage

Bảng: `service_images`; schema dòng 716; miền Ảnh và media. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String                @id @default(uuid())`  |
| serviceId | String (scalar) | Không | `serviceId String                @map("service_id")` **FK vật lý** |
| mediaId | String (scalar) | Không | `mediaId   String                @map("media_id")` **FK vật lý** |
| sortOrder | Int (scalar) | Không | `sortOrder Int                   @default(0) @map("sort_order")`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime              @default(now()) @map("created_at")`  |
| media | MediaFile (object) | Không | `media     MediaFile             @relation(fields: [mediaId], references: [id])`  |
| service | BranchServiceOffering (object) | Không | `service   BranchServiceOffering @relation(fields: [serviceId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([serviceId])`
- `@@map("service_images")`

## ComboImage

Bảng: `combo_images`; schema dòng 729; miền Combo. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String    @id @default(uuid())`  |
| comboId | String (scalar) | Không | `comboId   String    @map("combo_id")` **FK vật lý** |
| mediaId | String (scalar) | Không | `mediaId   String    @map("media_id")` **FK vật lý** |
| sortOrder | Int (scalar) | Không | `sortOrder Int       @default(0) @map("sort_order")`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime  @default(now()) @map("created_at")`  |
| combo | Combo (object) | Không | `combo     Combo     @relation(fields: [comboId], references: [id], onDelete: Cascade)`  |
| media | MediaFile (object) | Không | `media     MediaFile @relation(fields: [mediaId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([comboId])`
- `@@map("combo_images")`

## StaffImage

Bảng: `staff_images`; schema dòng 742; miền Ảnh và media. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String       @id @default(uuid())`  |
| staffId | String (scalar) | Không | `staffId   String       @map("staff_id")` **FK vật lý** |
| mediaId | String (scalar) | Không | `mediaId   String       @map("media_id")` **FK vật lý** |
| sortOrder | Int (scalar) | Không | `sortOrder Int          @default(0) @map("sort_order")`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime     @default(now()) @map("created_at")`  |
| media | MediaFile (object) | Không | `media     MediaFile    @relation(fields: [mediaId], references: [id])`  |
| staff | StaffProfile (object) | Không | `staff     StaffProfile @relation(fields: [staffId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([staffId])`
- `@@map("staff_images")`

## ServiceCategory

Bảng: `service_categories`; schema dòng 755; miền Phân tầng catalog. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String                  @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId       String                  @map("business_id")` **FK vật lý** |
| parentId | String (scalar) | Có | `parentId         String?                 @map("parent_id")` **FK vật lý** |
| name | String (scalar) | Không | `name             String`  |
| slug | String (scalar) | Không | `slug             String`  |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime                @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt        DateTime                @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt        DateTime?               @map("deleted_at")`  |
| business | Business (object) | Không | `business         Business                @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| parent | ServiceCategory (object) | Có | `parent           ServiceCategory?        @relation("CategoryTree", fields: [parentId], references: [id])`  |
| children | ServiceCategory[] (object) | Không | `children         ServiceCategory[]       @relation("CategoryTree")`  |
| services | BranchServiceOffering[] (object) | Không | `services         BranchServiceOffering[]`  |
| businessServices | BusinessService[] (object) | Không | `businessServices BusinessService[]`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, slug])`
- `@@index([businessId, deletedAt])`
- `@@index([parentId])`
- `@@map("service_categories")`

## CanonicalService

Bảng: `canonical_services`; schema dòng 778; miền Phân tầng catalog. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                     String                 @id @default(uuid())`  |
| code | String (scalar) | Không | `code                   String                 @unique`  |
| slug | String (scalar) | Không | `slug                   String                 @unique`  |
| name | String (scalar) | Không | `name                   String`  |
| description | String (scalar) | Có | `description            String?`  |
| parentId | String (scalar) | Có | `parentId               String?                @map("parent_id")` **FK vật lý** |
| replacementCanonicalId | String (scalar) | Có | `replacementCanonicalId String?                @map("replacement_canonical_id")` **FK vật lý** |
| synonyms | String[] (scalar) | Không | `synonyms               String[]               @default([])`  |
| status | CanonicalServiceStatus (enum) | Không | `status                 CanonicalServiceStatus @default(ACTIVE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt              DateTime               @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt              DateTime               @default(now()) @updatedAt @map("updated_at")`  |
| parent | CanonicalService (object) | Có | `parent                 CanonicalService?      @relation("CanonicalTree", fields: [parentId], references: [id])`  |
| children | CanonicalService[] (object) | Không | `children               CanonicalService[]     @relation("CanonicalTree")`  |
| replacement | CanonicalService (object) | Có | `replacement            CanonicalService?      @relation("CanonicalReplacement", fields: [replacementCanonicalId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| replacedCanonicals | CanonicalService[] (object) | Không | `replacedCanonicals     CanonicalService[]     @relation("CanonicalReplacement")`  |
| businessServices | BusinessService[] (object) | Không | `businessServices       BusinessService[]`  |
| bookingServices | BookingService[] (object) | Không | `bookingServices        BookingService[]`  |

Khóa chính: id. Unique đơn: code, slug.

- `@@index([parentId])`
- `@@index([replacementCanonicalId])`
- `@@index([status, name])`
- `@@map("canonical_services")`

## BusinessService

Bảng: `business_services`; schema dòng 805; miền Phân tầng catalog. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String                  @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId          String                  @map("business_id")` **FK vật lý** |
| categoryId | String (scalar) | Không | `categoryId          String                  @map("category_id")` **FK vật lý** |
| canonicalServiceId | String (scalar) | Có | `canonicalServiceId  String?                 @map("canonical_service_id")` **FK vật lý** |
| name | String (scalar) | Không | `name                String`  |
| description | String (scalar) | Có | `description         String?`  |
| keywords | String[] (scalar) | Không | `keywords            String[]                @default([])`  |
| mappingStatus | ServiceMappingStatus (enum) | Không | `mappingStatus       ServiceMappingStatus    @default(UNMAPPED) @map("mapping_status")`  |
| basePrice | Decimal (scalar) | Không | `basePrice           Decimal                 @map("base_price") @db.Decimal(12, 2)`  |
| baseDurationMinutes | Int (scalar) | Không | `baseDurationMinutes Int                     @map("base_duration_minutes")`  |
| status | ServiceStatus (enum) | Không | `status              ServiceStatus           @default(ACTIVE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt           DateTime                @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt           DateTime                @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt           DateTime?               @map("deleted_at")`  |
| business | Business (object) | Không | `business            Business                @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| category | ServiceCategory (object) | Không | `category            ServiceCategory         @relation(fields: [categoryId], references: [id])`  |
| canonicalService | CanonicalService (object) | Có | `canonicalService    CanonicalService?       @relation(fields: [canonicalServiceId], references: [id], onDelete: Restrict)`  |
| branchServices | BranchServiceOffering[] (object) | Không | `branchServices      BranchServiceOffering[]`  |
| bookingServices | BookingService[] (object) | Không | `bookingServices     BookingService[]`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId, status, deletedAt])`
- `@@index([categoryId])`
- `@@index([canonicalServiceId, mappingStatus])`
- `@@map("business_services")`

## BranchServiceOffering

Bảng: `services`; schema dòng 834; miền Phân tầng catalog. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                        String                          @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId                  String                          @map("branch_id")` **FK vật lý** |
| businessServiceId | String (scalar) | Không | `businessServiceId         String                          @map("business_service_id")` **FK vật lý** |
| categoryId | String (scalar) | Không | `categoryId                String                          @map("category_id")` **FK vật lý** |
| name | String (scalar) | Không | `name                      String`  |
| description | String (scalar) | Có | `description               String?`  |
| price | Decimal (scalar) | Không | `price                     Decimal                         @db.Decimal(12, 2)`  |
| durationMinutes | Int (scalar) | Không | `durationMinutes           Int                             @map("duration_minutes")`  |
| bookable | Boolean (scalar) | Không | `bookable                  Boolean                         @default(true)`  |
| status | ServiceStatus (enum) | Không | `status                    ServiceStatus                   @default(ACTIVE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt                 DateTime                        @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt                 DateTime                        @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt                 DateTime?                       @map("deleted_at")`  |
| bookingServices | BookingService[] (object) | Không | `bookingServices           BookingService[]`  |
| comboServices | ComboService[] (object) | Không | `comboServices             ComboService[]`  |
| promotionLinks | PromotionService[] (object) | Không | `promotionLinks            PromotionService[]`  |
| images | ServiceImage[] (object) | Không | `images                    ServiceImage[]`  |
| branch | Branch (object) | Không | `branch                    Branch                          @relation(fields: [branchId], references: [id])`  |
| businessService | BusinessService (object) | Không | `businessService           BusinessService                 @relation(fields: [businessServiceId], references: [id])`  |
| category | ServiceCategory (object) | Không | `category                  ServiceCategory                 @relation(fields: [categoryId], references: [id])`  |
| staffServices | StaffService[] (object) | Không | `staffServices             StaffService[]`  |
| paymentPolicies | PaymentPolicy[] (object) | Không | `paymentPolicies           PaymentPolicy[]`  |
| savedByCustomers | CustomerSavedService[] (object) | Không | `savedByCustomers          CustomerSavedService[]`  |
| voucherScopes | VoucherServiceScope[] (object) | Không | `voucherScopes             VoucherServiceScope[]`  |
| refs_ServiceVariant_serviceId | ServiceVariant[] (object) | Không | `refs_ServiceVariant_serviceId ServiceVariant[] @relation("Audit_ServiceVariant_serviceId")`  |
| refs_ServicePriceRule_serviceId | ServicePriceRule[] (object) | Không | `refs_ServicePriceRule_serviceId ServicePriceRule[] @relation("Audit_ServicePriceRule_serviceId")`  |
| refs_ServiceDependency_serviceId | ServiceDependency[] (object) | Không | `refs_ServiceDependency_serviceId ServiceDependency[] @relation("Audit_ServiceDependency_serviceId")`  |
| refs_ServiceDependency_requiredServiceId | ServiceDependency[] (object) | Không | `refs_ServiceDependency_requiredServiceId ServiceDependency[] @relation("Audit_ServiceDependency_requiredServiceId")`  |
| refs_WaitlistEntry_serviceId | WaitlistEntry[] (object) | Không | `refs_WaitlistEntry_serviceId WaitlistEntry[] @relation("Audit_WaitlistEntry_serviceId")`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([branchId, businessServiceId])`
- `@@index([branchId])`
- `@@index([businessServiceId])`
- `@@index([categoryId])`
- `@@index([status])`
- `@@index([branchId, status, deletedAt, createdAt])`
- `@@index([price])`
- `@@map("services")`

## StaffService

Bảng: `staff_services`; schema dòng 875; miền Nhân sự và kỹ năng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| staffId | String (scalar) | Không | `staffId   String                @map("staff_id")` **FK vật lý** |
| serviceId | String (scalar) | Không | `serviceId String                @map("service_id")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime              @default(now()) @map("created_at")`  |
| service | BranchServiceOffering (object) | Không | `service   BranchServiceOffering @relation(fields: [serviceId], references: [id], onDelete: Cascade)`  |
| staff | StaffProfile (object) | Không | `staff     StaffProfile          @relation(fields: [staffId], references: [id], onDelete: Cascade)`  |

Khóa chính: staffId + serviceId. Unique đơn: không.

- `@@id([staffId, serviceId])`
- `@@index([serviceId])`
- `@@map("staff_services")`

## Combo

Bảng: `combos`; schema dòng 887; miền Combo. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String                   @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId          String                   @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId            String                   @map("branch_id")` **FK vật lý** |
| name | String (scalar) | Không | `name                String`  |
| description | String (scalar) | Có | `description         String?`  |
| comboPrice | Decimal (scalar) | Không | `comboPrice          Decimal                  @map("combo_price") @db.Decimal(12, 2)`  |
| validFrom | DateTime (scalar) | Có | `validFrom           DateTime?                @map("valid_from")`  |
| validTo | DateTime (scalar) | Có | `validTo             DateTime?                @map("valid_to")`  |
| maxUsage | Int (scalar) | Có | `maxUsage            Int?                     @map("max_usage")`  |
| usedCount | Int (scalar) | Không | `usedCount           Int                      @default(0) @map("used_count")`  |
| status | ComboStatus (enum) | Không | `status              ComboStatus              @default(ACTIVE)`  |
| pricingMode | ComboPricingMode (enum) | Không | `pricingMode         ComboPricingMode         @default(FIXED_PRICE) @map("pricing_mode")`  |
| staffAssignmentMode | ComboStaffAssignmentMode (enum) | Không | `staffAssignmentMode ComboStaffAssignmentMode @default(SINGLE_PROVIDER) @map("staff_assignment_mode")`  |
| version | Int (scalar) | Không | `version             Int                      @default(1)`  |
| createdAt | DateTime (scalar) | Không | `createdAt           DateTime                 @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt           DateTime                 @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt           DateTime?                @map("deleted_at")`  |
| bookingServices | BookingService[] (object) | Không | `bookingServices     BookingService[]`  |
| images | ComboImage[] (object) | Không | `images              ComboImage[]`  |
| comboServices | ComboService[] (object) | Không | `comboServices       ComboService[]`  |
| business | Business (object) | Không | `business            Business                 @relation(fields: [businessId], references: [id])`  |
| branch | Branch (object) | Không | `branch              Branch                   @relation(fields: [branchId], references: [id])`  |
| promotionLinks | PromotionCombo[] (object) | Không | `promotionLinks      PromotionCombo[]`  |
| recurringPlans | RecurringBookingPlan[] (object) | Không | `recurringPlans      RecurringBookingPlan[]`  |
| voucherScopes | VoucherComboScope[] (object) | Không | `voucherScopes       VoucherComboScope[]`  |

Khóa chính: id. Unique đơn: không.

- `@@index([branchId])`
- `@@index([businessId, status])`
- `@@index([status])`
- `@@map("combos")`

## ComboService

Bảng: `combo_services`; schema dòng 920; miền Combo. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| comboId | String (scalar) | Không | `comboId           String                @map("combo_id")` **FK vật lý** |
| serviceId | String (scalar) | Không | `serviceId         String                @map("service_id")` **FK vật lý** |
| quantity | Int (scalar) | Không | `quantity          Int                   @default(1)`  |
| sortOrder | Int (scalar) | Không | `sortOrder         Int                   @default(0) @map("sort_order")`  |
| priceSnapshot | Decimal (scalar) | Không | `priceSnapshot     Decimal               @map("price_snapshot") @db.Decimal(12, 2)`  |
| durationSnapshot | Int (scalar) | Không | `durationSnapshot  Int                   @map("duration_snapshot")`  |
| transitionMinutes | Int (scalar) | Không | `transitionMinutes Int                   @default(0) @map("transition_minutes")`  |
| combo | Combo (object) | Không | `combo             Combo                 @relation(fields: [comboId], references: [id], onDelete: Cascade)`  |
| service | BranchServiceOffering (object) | Không | `service           BranchServiceOffering @relation(fields: [serviceId], references: [id], onDelete: Cascade)`  |

Khóa chính: comboId + serviceId. Unique đơn: không.

- `@@id([comboId, serviceId])`
- `@@index([serviceId])`
- `@@index([comboId, sortOrder])`
- `@@map("combo_services")`

## Promotion

Bảng: `promotions`; schema dòng 937; miền Khuyến mãi và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String              @id @default(uuid())`  |
| name | String (scalar) | Không | `name                String`  |
| description | String (scalar) | Có | `description         String?`  |
| discountType | DiscountType (enum) | Không | `discountType        DiscountType        @map("discount_type")`  |
| discountValue | Decimal (scalar) | Không | `discountValue       Decimal             @map("discount_value") @db.Decimal(12, 2)`  |
| startDate | DateTime (scalar) | Không | `startDate           DateTime            @map("start_date")`  |
| endDate | DateTime (scalar) | Không | `endDate             DateTime            @map("end_date")`  |
| status | PromotionStatus (enum) | Không | `status              PromotionStatus     @default(ACTIVE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt           DateTime            @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt           DateTime            @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt           DateTime?           @map("deleted_at")`  |
| businessId | String (scalar) | Có | `businessId          String?             @map("business_id")` **FK vật lý** |
| createdByPlatform | Boolean (scalar) | Không | `createdByPlatform   Boolean             @default(false) @map("created_by_platform")`  |
| audience | VoucherAudience (enum) | Không | `audience            VoucherAudience     @default(ALL)`  |
| totalQuantity | Int (scalar) | Có | `totalQuantity       Int?                @map("total_quantity")`  |
| maxUsagePerCustomer | Int (scalar) | Không | `maxUsagePerCustomer Int                 @default(1) @map("max_usage_per_customer")`  |
| autoApply | Boolean (scalar) | Không | `autoApply           Boolean             @default(true) @map("auto_apply")`  |
| stackingAllowed | Boolean (scalar) | Không | `stackingAllowed     Boolean             @default(false) @map("stacking_allowed")`  |
| version | Int (scalar) | Không | `version             Int                 @default(1)`  |
| branchLinks | PromotionBranch[] (object) | Không | `branchLinks         PromotionBranch[]`  |
| businessLinks | PromotionBusiness[] (object) | Không | `businessLinks       PromotionBusiness[]`  |
| comboLinks | PromotionCombo[] (object) | Không | `comboLinks          PromotionCombo[]`  |
| serviceLinks | PromotionService[] (object) | Không | `serviceLinks        PromotionService[]`  |
| businessOwner | Business (object) | Có | `businessOwner       Business?           @relation("PromotionOwner", fields: [businessId], references: [id], onDelete: Cascade)`  |
| refs_PromotionRedemption_promotionId | PromotionRedemption[] (object) | Không | `refs_PromotionRedemption_promotionId PromotionRedemption[] @relation("Audit_PromotionRedemption_promotionId")`  |

Khóa chính: id. Unique đơn: không.

- `@@index([status])`
- `@@index([startDate, endDate])`
- `@@index([businessId])`
- `@@map("promotions")`

## PromotionBusiness

Bảng: `promotion_businesses`; schema dòng 970; miền Khuyến mãi và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| promotionId | String (scalar) | Không | `promotionId String    @map("promotion_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId  String    @map("business_id")` **FK vật lý** |
| business | Business (object) | Không | `business    Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| promotion | Promotion (object) | Không | `promotion   Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)`  |

Khóa chính: promotionId + businessId. Unique đơn: không.

- `@@id([promotionId, businessId])`
- `@@index([businessId])`
- `@@map("promotion_businesses")`

## PromotionBranch

Bảng: `promotion_branches`; schema dòng 981; miền Khuyến mãi và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| promotionId | String (scalar) | Không | `promotionId String    @map("promotion_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId    String    @map("branch_id")` **FK vật lý** |
| branch | Branch (object) | Không | `branch      Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| promotion | Promotion (object) | Không | `promotion   Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)`  |

Khóa chính: promotionId + branchId. Unique đơn: không.

- `@@id([promotionId, branchId])`
- `@@index([branchId])`
- `@@map("promotion_branches")`

## PromotionService

Bảng: `promotion_services`; schema dòng 992; miền Khuyến mãi và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| promotionId | String (scalar) | Không | `promotionId String                @map("promotion_id")` **FK vật lý** |
| serviceId | String (scalar) | Không | `serviceId   String                @map("service_id")` **FK vật lý** |
| promotion | Promotion (object) | Không | `promotion   Promotion             @relation(fields: [promotionId], references: [id], onDelete: Cascade)`  |
| service | BranchServiceOffering (object) | Không | `service     BranchServiceOffering @relation(fields: [serviceId], references: [id], onDelete: Cascade)`  |

Khóa chính: promotionId + serviceId. Unique đơn: không.

- `@@id([promotionId, serviceId])`
- `@@index([serviceId])`
- `@@map("promotion_services")`

## PromotionCombo

Bảng: `promotion_combos`; schema dòng 1003; miền Khuyến mãi và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| promotionId | String (scalar) | Không | `promotionId String    @map("promotion_id")` **FK vật lý** |
| comboId | String (scalar) | Không | `comboId     String    @map("combo_id")` **FK vật lý** |
| combo | Combo (object) | Không | `combo       Combo     @relation(fields: [comboId], references: [id], onDelete: Cascade)`  |
| promotion | Promotion (object) | Không | `promotion   Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)`  |

Khóa chính: promotionId + comboId. Unique đơn: không.

- `@@id([promotionId, comboId])`
- `@@index([comboId])`
- `@@map("promotion_combos")`

## Booking

Bảng: `bookings`; schema dòng 1014; miền Lịch và phần dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| violationEvents | BookingViolationEvent[] (object) | Không | `violationEvents BookingViolationEvent[]`  |
| id | String (scalar) | Không | `id                        String                      @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId                String                      @map("customer_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId                  String                      @map("branch_id")` **FK vật lý** |
| recurringPlanId | String (scalar) | Có | `recurringPlanId           String?                     @map("recurring_plan_id")` **FK vật lý** |
| bookingCode | String (scalar) | Không | `bookingCode               String                      @unique @map("booking_code")`  |
| appointmentDate | DateTime (scalar) | Không | `appointmentDate           DateTime                    @map("appointment_date") @db.Date`  |
| appointmentStartTime | DateTime (scalar) | Không | `appointmentStartTime      DateTime                    @map("appointment_start_time") @db.Time(6)`  |
| appointmentEndTime | DateTime (scalar) | Không | `appointmentEndTime        DateTime                    @map("appointment_end_time") @db.Time(6)`  |
| status | BookingStatus (enum) | Không | `status                    BookingStatus               @default(PENDING)`  |
| source | BookingSource (enum) | Không | `source                    BookingSource               @default(ONLINE_WEB)`  |
| pendingExpiresAt | DateTime (scalar) | Có | `pendingExpiresAt          DateTime?                   @map("pending_expires_at")`  |
| totalAmount | Decimal (scalar) | Không | `totalAmount               Decimal                     @map("total_amount") @db.Decimal(12, 2)`  |
| note | String (scalar) | Có | `note                      String?`  |
| cancelReason | String (scalar) | Có | `cancelReason              String?                     @map("cancel_reason")`  |
| cancelledAt | DateTime (scalar) | Có | `cancelledAt               DateTime?                   @map("cancelled_at")`  |
| cancelledBy | String (scalar) | Có | `cancelledBy               String?                     @map("cancelled_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt                 DateTime                    @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt                 DateTime                    @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt                 DateTime?                   @map("deleted_at")`  |
| cancelledByType | CancelledByType (enum) | Có | `cancelledByType           CancelledByType?            @map("cancelled_by_type")`  |
| cancellationFeeAmount | Decimal (scalar) | Có | `cancellationFeeAmount     Decimal?                    @map("cancellation_fee_amount") @db.Decimal(12, 2)`  |
| finalAmount | Decimal (scalar) | Có | `finalAmount               Decimal?                    @map("final_amount") @db.Decimal(12, 2)`  |
| voucherDiscountAmount | Decimal (scalar) | Có | `voucherDiscountAmount     Decimal?                    @map("voucher_discount_amount") @db.Decimal(12, 2)`  |
| voucherId | String (scalar) | Có | `voucherId                 String?                     @map("voucher_id")` **FK vật lý** |
| sensitiveDataConsent | Boolean (scalar) | Không | `sensitiveDataConsent      Boolean                     @default(false) @map("sensitive_data_consent")`  |
| changeRequests | AppointmentChangeRequest[] (object) | Không | `changeRequests            AppointmentChangeRequest[]`  |
| bookingServices | BookingService[] (object) | Không | `bookingServices           BookingService[]`  |
| statusHistory | BookingStatusHistory[] (object) | Không | `statusHistory             BookingStatusHistory[]`  |
| branch | Branch (object) | Không | `branch                    Branch                      @relation(fields: [branchId], references: [id])`  |
| cancelledByUser | User (object) | Có | `cancelledByUser           User?                       @relation("BookingCancelledBy", fields: [cancelledBy], references: [id])`  |
| customer | CustomerProfile (object) | Không | `customer                  CustomerProfile             @relation(fields: [customerId], references: [id])`  |
| recurringPlan | RecurringBookingPlan (object) | Có | `recurringPlan             RecurringBookingPlan?       @relation(fields: [recurringPlanId], references: [id])`  |
| voucher | Voucher (object) | Có | `voucher                   Voucher?                    @relation(fields: [voucherId], references: [id])`  |
| notifications | Notification[] (object) | Không | `notifications             Notification[]`  |
| notificationOutboxes | NotificationOutbox[] (object) | Không | `notificationOutboxes      NotificationOutbox[]`  |
| payments | Payment[] (object) | Không | `payments                  Payment[]`  |
| review | Review (object) | Có | `review                    Review?`  |
| contact | BookingContact (object) | Có | `contact                   BookingContact?`  |
| pricingSnapshot | PricingSnapshot (object) | Có | `pricingSnapshot           PricingSnapshot?`  |
| paymentPolicySnapshot | PaymentPolicySnapshot (object) | Có | `paymentPolicySnapshot     PaymentPolicySnapshot?`  |
| paymentIntents | PaymentIntent[] (object) | Không | `paymentIntents            PaymentIntent[]`  |
| paymentTransactions | PaymentTransaction[] (object) | Không | `paymentTransactions       PaymentTransaction[]`  |
| financialLedgerEntries | FinancialLedgerEntry[] (object) | Không | `financialLedgerEntries    FinancialLedgerEntry[]`  |
| platformFeeEntry | PlatformFeeEntry (object) | Có | `platformFeeEntry          PlatformFeeEntry?`  |
| packageEntitlements | PackageSessionEntitlement[] (object) | Không | `packageEntitlements       PackageSessionEntitlement[]`  |
| overbookingOverride | OverbookingOverride (object) | Có | `overbookingOverride       OverbookingOverride?`  |
| invoiceRequests | InvoiceInformationRequest[] (object) | Không | `invoiceRequests           InvoiceInformationRequest[]`  |
| refs_PriceAdjustment_bookingId | PriceAdjustment[] (object) | Không | `refs_PriceAdjustment_bookingId PriceAdjustment[] @relation("Audit_PriceAdjustment_bookingId")`  |
| refs_PromotionRedemption_bookingId | PromotionRedemption[] (object) | Không | `refs_PromotionRedemption_bookingId PromotionRedemption[] @relation("Audit_PromotionRedemption_bookingId")`  |
| refs_VoucherRedemption_bookingId | VoucherRedemption[] (object) | Không | `refs_VoucherRedemption_bookingId VoucherRedemption[] @relation("Audit_VoucherRedemption_bookingId")`  |
| refs_BookingServiceAdjustment_bookingId | BookingServiceAdjustment[] (object) | Không | `refs_BookingServiceAdjustment_bookingId BookingServiceAdjustment[] @relation("Audit_BookingServiceAdjustment_bookingId")`  |
| refs_OperationalImpactItem_bookingId | OperationalImpactItem[] (object) | Không | `refs_OperationalImpactItem_bookingId OperationalImpactItem[] @relation("Audit_OperationalImpactItem_bookingId")`  |
| refs_WaitlistEntry_bookingId | WaitlistEntry (object) | Có | `refs_WaitlistEntry_bookingId WaitlistEntry? @relation("Audit_WaitlistEntry_bookingId")`  |
| refs_LoyaltyTransaction_bookingId | LoyaltyTransaction[] (object) | Không | `refs_LoyaltyTransaction_bookingId LoyaltyTransaction[] @relation("Audit_LoyaltyTransaction_bookingId")`  |
| refs_Invoice_bookingId | Invoice[] (object) | Không | `refs_Invoice_bookingId Invoice[] @relation("Audit_Invoice_bookingId")`  |

Khóa chính: id. Unique đơn: bookingCode.

- `@@index([customerId])`
- `@@index([branchId])`
- `@@index([appointmentDate])`
- `@@index([status])`
- `@@index([status, pendingExpiresAt])`
- `@@map("bookings")`
- `@@index([branchId, appointmentDate, status])`

## BookingService

Bảng: `booking_services`; schema dòng 1081; miền Lịch và phần dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String                     @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId           String                     @map("booking_id")` **FK vật lý** |
| serviceId | String (scalar) | Không | `serviceId           String                     @map("service_id")` **FK vật lý** |
| businessServiceId | String (scalar) | Không | `businessServiceId   String                     @map("business_service_id")` **FK vật lý** |
| canonicalServiceId | String (scalar) | Có | `canonicalServiceId  String?                    @map("canonical_service_id")` **FK vật lý** |
| comboId | String (scalar) | Có | `comboId             String?                    @map("combo_id")` **FK vật lý** |
| staffId | String (scalar) | Có | `staffId             String?                    @map("staff_id")` **FK vật lý** |
| variantId | String (scalar) | Có | `variantId           String?                    @map("variant_id")` (Không suy FK từ hậu tố Id) |
| priceAtBooking | Decimal (scalar) | Không | `priceAtBooking      Decimal                    @map("price_at_booking") @db.Decimal(12, 2)`  |
| durationMinutes | Int (scalar) | Không | `durationMinutes     Int                        @map("duration_minutes")`  |
| serviceNameSnapshot | String (scalar) | Không | `serviceNameSnapshot String                     @map("service_name_snapshot")`  |
| sortOrder | Int (scalar) | Không | `sortOrder           Int                        @default(0) @map("sort_order")`  |
| status | BookingServiceStatus (enum) | Không | `status              BookingServiceStatus       @default(SCHEDULED)`  |
| itemStartAt | DateTime (scalar) | Có | `itemStartAt         DateTime?                  @map("item_start_at")`  |
| itemEndAt | DateTime (scalar) | Có | `itemEndAt           DateTime?                  @map("item_end_at")`  |
| transitionMinutes | Int (scalar) | Không | `transitionMinutes   Int                        @default(0) @map("transition_minutes")`  |
| comboVersion | Int (scalar) | Có | `comboVersion        Int?                       @map("combo_version")`  |
| revision | Int (scalar) | Không | `revision            Int                        @default(1)`  |
| skippedReason | String (scalar) | Có | `skippedReason       String?                    @map("skipped_reason")`  |
| createdAt | DateTime (scalar) | Không | `createdAt           DateTime                   @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt           DateTime                   @updatedAt @map("updated_at")`  |
| booking | Booking (object) | Không | `booking             Booking                    @relation(fields: [bookingId], references: [id], onDelete: Cascade)`  |
| combo | Combo (object) | Có | `combo               Combo?                     @relation(fields: [comboId], references: [id])`  |
| service | BranchServiceOffering (object) | Không | `service             BranchServiceOffering      @relation(fields: [serviceId], references: [id])`  |
| businessService | BusinessService (object) | Không | `businessService     BusinessService            @relation(fields: [businessServiceId], references: [id], onDelete: Restrict)`  |
| canonicalService | CanonicalService (object) | Có | `canonicalService    CanonicalService?          @relation(fields: [canonicalServiceId], references: [id], onDelete: Restrict)`  |
| staff | StaffProfile (object) | Có | `staff               StaffProfile?              @relation(fields: [staffId], references: [id])`  |
| reviewRating | ReviewServiceRating (object) | Có | `reviewRating        ReviewServiceRating?`  |
| refundAllocations | RefundAllocation[] (object) | Không | `refundAllocations   RefundAllocation[]`  |
| packageEntitlement | PackageSessionEntitlement (object) | Có | `packageEntitlement  PackageSessionEntitlement?`  |
| refs_BookingServiceAdjustment_bookingServiceId | BookingServiceAdjustment[] (object) | Không | `refs_BookingServiceAdjustment_bookingServiceId BookingServiceAdjustment[] @relation("Audit_BookingServiceAdjustment_bookingServiceId")`  |
| refs_InvoiceLine_bookingServiceId | InvoiceLine[] (object) | Không | `refs_InvoiceLine_bookingServiceId InvoiceLine[] @relation("Audit_InvoiceLine_bookingServiceId")`  |

Khóa chính: id. Unique đơn: không.

- `@@index([bookingId])`
- `@@index([serviceId])`
- `@@index([businessServiceId])`
- `@@index([canonicalServiceId])`
- `@@index([staffId])`
- `@@map("booking_services")`

## BookingStatusHistory

Bảng: `booking_status_histories`; schema dòng 1123; miền Lịch và phần dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id            String        @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId     String        @map("booking_id")` **FK vật lý** |
| status | BookingStatus (enum) | Không | `status        BookingStatus`  |
| changedBy | String (scalar) | Có | `changedBy     String?       @map("changed_by")` **FK vật lý** |
| note | String (scalar) | Có | `note          String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt     DateTime      @default(now()) @map("created_at")`  |
| booking | Booking (object) | Không | `booking       Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)`  |
| changedByUser | User (object) | Có | `changedByUser User?         @relation("StatusChangedBy", fields: [changedBy], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([bookingId])`
- `@@map("booking_status_histories")`

## RecurringBookingPlan

Bảng: `recurring_booking_plans`; schema dòng 1137; miền Yêu cầu và chính sách khách. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                     String              @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId             String              @map("customer_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId               String              @map("branch_id")` **FK vật lý** |
| frequency | RecurrenceFrequency (enum) | Không | `frequency              RecurrenceFrequency`  |
| serviceIds | Json (scalar) | Không | `serviceIds             Json                @default("[]") @map("service_ids")`  |
| comboId | String (scalar) | Có | `comboId                String?             @map("combo_id")` **FK vật lý** |
| staffId | String (scalar) | Có | `staffId                String?             @map("staff_id")` **FK vật lý** |
| staffMode | RecurringStaffMode (enum) | Không | `staffMode              RecurringStaffMode  @default(ANY_AVAILABLE) @map("staff_mode")`  |
| preferredTime | String (scalar) | Không | `preferredTime          String              @default("09:00") @map("preferred_time")`  |
| occurrenceCount | Int (scalar) | Không | `occurrenceCount        Int                 @default(1) @map("occurrence_count")`  |
| createdOccurrenceCount | Int (scalar) | Không | `createdOccurrenceCount Int                 @default(0) @map("created_occurrence_count")`  |
| failureReason | String (scalar) | Có | `failureReason          String?             @map("failure_reason")`  |
| dayOfWeek | Int (scalar) | Có | `dayOfWeek              Int?                @map("day_of_week")`  |
| dayOfMonth | Int (scalar) | Có | `dayOfMonth             Int?                @map("day_of_month")`  |
| startDate | DateTime (scalar) | Không | `startDate              DateTime            @map("start_date") @db.Date`  |
| endDate | DateTime (scalar) | Có | `endDate                DateTime?           @map("end_date") @db.Date`  |
| status | RecurringPlanStatus (enum) | Không | `status                 RecurringPlanStatus @default(ACTIVE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt              DateTime            @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt              DateTime            @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt              DateTime?           @map("deleted_at")`  |
| bookings | Booking[] (object) | Không | `bookings               Booking[]`  |
| branch | Branch (object) | Không | `branch                 Branch              @relation(fields: [branchId], references: [id])`  |
| customer | CustomerProfile (object) | Không | `customer               CustomerProfile     @relation(fields: [customerId], references: [id])`  |
| combo | Combo (object) | Có | `combo                  Combo?              @relation(fields: [comboId], references: [id])`  |
| staff | StaffProfile (object) | Có | `staff                  StaffProfile?       @relation(fields: [staffId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([customerId])`
- `@@index([branchId, status])`
- `@@map("recurring_booking_plans")`

## Payment

Bảng: `payments`; schema dòng 1169; miền Thanh toán. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String                 @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId      String                 @map("booking_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount         Decimal                @db.Decimal(12, 2)`  |
| method | PaymentMethod (enum) | Không | `method         PaymentMethod`  |
| status | PaymentStatus (enum) | Không | `status         PaymentStatus          @default(PENDING)`  |
| transactionRef | String (scalar) | Có | `transactionRef String?                @map("transaction_ref")`  |
| paidAt | DateTime (scalar) | Có | `paidAt         DateTime?              @map("paid_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime               @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime               @updatedAt @map("updated_at")`  |
| booking | Booking (object) | Không | `booking        Booking                @relation(fields: [bookingId], references: [id])`  |
| refundRequests | RefundRequest[] (object) | Không | `refundRequests RefundRequest[]`  |
| transactions | PaymentTransaction[] (object) | Không | `transactions   PaymentTransaction[]`  |
| ledgerEntries | FinancialLedgerEntry[] (object) | Không | `ledgerEntries  FinancialLedgerEntry[]`  |
| refs_Invoice_paymentId | Invoice[] (object) | Không | `refs_Invoice_paymentId Invoice[] @relation("Audit_Invoice_paymentId")`  |

Khóa chính: id. Unique đơn: không.

- `@@index([bookingId])`
- `@@index([status])`
- `@@map("payments")`
- `@@index([createdAt])`

## RefundRequest

Bảng: `refund_requests`; schema dòng 1191; miền Hoàn tiền và sổ cái. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                      String                   @id @default(uuid())`  |
| paymentId | String (scalar) | Không | `paymentId               String                   @map("payment_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount                  Decimal                  @db.Decimal(12, 2)`  |
| reason | String (scalar) | Không | `reason                  String`  |
| evidence | Json (scalar) | Có | `evidence                Json?`  |
| status | RefundStatus (enum) | Không | `status                  RefundStatus             @default(PENDING)`  |
| requestedBy | String (scalar) | Không | `requestedBy             String                   @map("requested_by")`  |
| reviewedBy | String (scalar) | Có | `reviewedBy              String?                  @map("reviewed_by")`  |
| reviewNote | String (scalar) | Có | `reviewNote              String?                  @map("review_note")`  |
| reviewedAt | DateTime (scalar) | Có | `reviewedAt              DateTime?                @map("reviewed_at")`  |
| processingStartedAt | DateTime (scalar) | Có | `processingStartedAt     DateTime?                @map("processing_started_at")`  |
| processedAt | DateTime (scalar) | Có | `processedAt             DateTime?                @map("processed_at")`  |
| processedBy | String (scalar) | Có | `processedBy             String?                  @map("processed_by")`  |
| settlementReference | String (scalar) | Có | `settlementReference     String?                  @unique @map("settlement_reference")`  |
| failureReason | String (scalar) | Có | `failureReason           String?                  @map("failure_reason")`  |
| createdAt | DateTime (scalar) | Không | `createdAt               DateTime                 @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt               DateTime                 @updatedAt @map("updated_at")`  |
| payment | Payment (object) | Không | `payment                 Payment                  @relation(fields: [paymentId], references: [id], onDelete: Cascade)`  |
| allocations | RefundAllocation[] (object) | Không | `allocations             RefundAllocation[]`  |
| ledgerEntries | FinancialLedgerEntry[] (object) | Không | `ledgerEntries           FinancialLedgerEntry[]`  |
| platformFeeAdjustments | PlatformFeeAdjustment[] (object) | Không | `platformFeeAdjustments  PlatformFeeAdjustment[]`  |
| refs_LoyaltyTransaction_refundRequestId | LoyaltyTransaction[] (object) | Không | `refs_LoyaltyTransaction_refundRequestId LoyaltyTransaction[] @relation("Audit_LoyaltyTransaction_refundRequestId")`  |

Khóa chính: id. Unique đơn: settlementReference.

- `@@index([paymentId, status])`
- `@@index([requestedBy])`
- `@@map("refund_requests")`

## PricingSnapshot

Bảng: `pricing_snapshots`; schema dòng 1222; miền Thanh toán. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String   @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId      String   @unique @map("booking_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId     String   @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId       String   @map("branch_id")` **FK vật lý** |
| currency | String (scalar) | Không | `currency       String   @default("VND")`  |
| subtotalAmount | Decimal (scalar) | Không | `subtotalAmount Decimal  @map("subtotal_amount") @db.Decimal(12, 2)`  |
| discountAmount | Decimal (scalar) | Không | `discountAmount Decimal  @default(0) @map("discount_amount") @db.Decimal(12, 2)`  |
| finalAmount | Decimal (scalar) | Không | `finalAmount    Decimal  @map("final_amount") @db.Decimal(12, 2)`  |
| items | Json (scalar) | Không | `items          Json`  |
| capturedAt | DateTime (scalar) | Không | `capturedAt     DateTime @default(now()) @map("captured_at")`  |
| booking | Booking (object) | Không | `booking        Booking  @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business       Business @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch         Branch   @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: bookingId.

- `@@index([businessId, capturedAt])`
- `@@index([branchId, capturedAt])`
- `@@map("pricing_snapshots")`

## PaymentPolicy

Bảng: `payment_policies`; schema dòng 1242; miền Hoàn tiền và sổ cái. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                String                  @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId        String                  @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId          String?                 @map("branch_id")` **FK vật lý** |
| serviceId | String (scalar) | Có | `serviceId         String?                 @map("service_id")` **FK vật lý** |
| name | String (scalar) | Không | `name              String`  |
| version | Int (scalar) | Không | `version           Int`  |
| status | PolicyVersionStatus (enum) | Không | `status            PolicyVersionStatus     @default(ACTIVE)`  |
| depositType | DepositType (enum) | Không | `depositType       DepositType             @default(NONE) @map("deposit_type")`  |
| depositValue | Decimal (scalar) | Không | `depositValue      Decimal                 @default(0) @map("deposit_value") @db.Decimal(12, 2)`  |
| allowSplitPayment | Boolean (scalar) | Không | `allowSplitPayment Boolean                 @default(true) @map("allow_split_payment")`  |
| allowInstallments | Boolean (scalar) | Không | `allowInstallments Boolean                 @default(false) @map("allow_installments")`  |
| effectiveFrom | DateTime (scalar) | Không | `effectiveFrom     DateTime                @map("effective_from")`  |
| effectiveTo | DateTime (scalar) | Có | `effectiveTo       DateTime?               @map("effective_to")`  |
| createdBy | String (scalar) | Không | `createdBy         String                  @map("created_by")`  |
| createdAt | DateTime (scalar) | Không | `createdAt         DateTime                @default(now()) @map("created_at")`  |
| business | Business (object) | Không | `business          Business                @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| branch | Branch (object) | Có | `branch            Branch?                 @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| service | BranchServiceOffering (object) | Có | `service           BranchServiceOffering?  @relation(fields: [serviceId], references: [id], onDelete: Cascade)`  |
| snapshots | PaymentPolicySnapshot[] (object) | Không | `snapshots         PaymentPolicySnapshot[]`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, branchId, serviceId, version])`
- `@@index([businessId, status, effectiveFrom, effectiveTo])`
- `@@index([branchId, status])`
- `@@map("payment_policies")`

## PaymentPolicySnapshot

Bảng: `payment_policy_snapshots`; schema dòng 1269; miền Thanh toán. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                String         @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId         String         @unique @map("booking_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId        String         @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId          String         @map("branch_id")` **FK vật lý** |
| paymentPolicyId | String (scalar) | Có | `paymentPolicyId   String?        @map("payment_policy_id")` **FK vật lý** |
| policyVersion | Int (scalar) | Có | `policyVersion     Int?           @map("policy_version")`  |
| depositType | DepositType (enum) | Không | `depositType       DepositType    @default(NONE) @map("deposit_type")`  |
| depositValue | Decimal (scalar) | Không | `depositValue      Decimal        @default(0) @map("deposit_value") @db.Decimal(12, 2)`  |
| requiredAmount | Decimal (scalar) | Không | `requiredAmount    Decimal        @default(0) @map("required_amount") @db.Decimal(12, 2)`  |
| allowSplitPayment | Boolean (scalar) | Không | `allowSplitPayment Boolean        @default(true) @map("allow_split_payment")`  |
| allowInstallments | Boolean (scalar) | Không | `allowInstallments Boolean        @default(false) @map("allow_installments")`  |
| capturedAt | DateTime (scalar) | Không | `capturedAt        DateTime       @default(now()) @map("captured_at")`  |
| booking | Booking (object) | Không | `booking           Booking        @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business          Business       @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch            Branch         @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| paymentPolicy | PaymentPolicy (object) | Có | `paymentPolicy     PaymentPolicy? @relation(fields: [paymentPolicyId], references: [id], onDelete: SetNull)`  |

Khóa chính: id. Unique đơn: bookingId.

- `@@index([businessId, capturedAt])`
- `@@map("payment_policy_snapshots")`

## PaymentIntent

Bảng: `payment_intents`; schema dòng 1291; miền Thanh toán. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                   String               @id @default(uuid())`  |
| bookingId | String (scalar) | Có | `bookingId            String?              @map("booking_id")` **FK vật lý** |
| packagePurchaseId | String (scalar) | Có | `packagePurchaseId    String?              @map("package_purchase_id")` **FK vật lý** |
| packageInstallmentId | String (scalar) | Có | `packageInstallmentId String?              @map("package_installment_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId           String               @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId             String               @map("branch_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount               Decimal              @db.Decimal(12, 2)`  |
| currency | String (scalar) | Không | `currency             String               @default("VND")`  |
| method | PaymentMethod (enum) | Không | `method               PaymentMethod`  |
| provider | String (scalar) | Không | `provider             String`  |
| status | PaymentIntentStatus (enum) | Không | `status               PaymentIntentStatus  @default(CREATED)`  |
| idempotencyKey | String (scalar) | Không | `idempotencyKey       String               @unique @map("idempotency_key")`  |
| expiresAt | DateTime (scalar) | Có | `expiresAt            DateTime?            @map("expires_at")`  |
| metadata | Json (scalar) | Có | `metadata             Json?`  |
| createdBy | String (scalar) | Không | `createdBy            String               @map("created_by")`  |
| createdAt | DateTime (scalar) | Không | `createdAt            DateTime             @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt            DateTime             @updatedAt @map("updated_at")`  |
| booking | Booking (object) | Có | `booking              Booking?             @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| packagePurchase | PackagePurchase (object) | Có | `packagePurchase      PackagePurchase?     @relation(fields: [packagePurchaseId], references: [id], onDelete: Restrict)`  |
| packageInstallment | PackageInstallment (object) | Có | `packageInstallment   PackageInstallment?  @relation(fields: [packageInstallmentId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business             Business             @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch               Branch               @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| transactions | PaymentTransaction[] (object) | Không | `transactions         PaymentTransaction[]`  |

Khóa chính: id. Unique đơn: idempotencyKey.

- `@@index([bookingId, status])`
- `@@index([packagePurchaseId, status])`
- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`
- `@@map("payment_intents")`

## PaymentTransaction

Bảng: `payment_transactions`; schema dòng 1325; miền Thanh toán. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                   String                   @id @default(uuid())`  |
| intentId | String (scalar) | Có | `intentId             String?                  @map("intent_id")` **FK vật lý** |
| paymentId | String (scalar) | Có | `paymentId            String?                  @map("payment_id")` **FK vật lý** |
| bookingId | String (scalar) | Có | `bookingId            String?                  @map("booking_id")` **FK vật lý** |
| packagePurchaseId | String (scalar) | Có | `packagePurchaseId    String?                  @map("package_purchase_id")` **FK vật lý** |
| packageInstallmentId | String (scalar) | Có | `packageInstallmentId String?                  @map("package_installment_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId           String                   @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId             String                   @map("branch_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount               Decimal                  @db.Decimal(12, 2)`  |
| currency | String (scalar) | Không | `currency             String                   @default("VND")`  |
| method | PaymentMethod (enum) | Không | `method               PaymentMethod`  |
| provider | String (scalar) | Không | `provider             String`  |
| status | PaymentTransactionStatus (enum) | Không | `status               PaymentTransactionStatus @default(PENDING)`  |
| transactionRef | String (scalar) | Có | `transactionRef       String?                  @map("transaction_ref")`  |
| idempotencyKey | String (scalar) | Không | `idempotencyKey       String                   @unique @map("idempotency_key")`  |
| providerEventId | String (scalar) | Có | `providerEventId      String?                  @unique @map("provider_event_id")` (Không suy FK từ hậu tố Id) |
| evidence | Json (scalar) | Có | `evidence             Json?`  |
| verifiedBy | String (scalar) | Có | `verifiedBy           String?                  @map("verified_by")`  |
| verifiedAt | DateTime (scalar) | Có | `verifiedAt           DateTime?                @map("verified_at")`  |
| reversalOfId | String (scalar) | Có | `reversalOfId         String?                  @unique @map("reversal_of_id")` **FK vật lý** |
| failureReason | String (scalar) | Có | `failureReason        String?                  @map("failure_reason")`  |
| createdAt | DateTime (scalar) | Không | `createdAt            DateTime                 @default(now()) @map("created_at")`  |
| intent | PaymentIntent (object) | Có | `intent               PaymentIntent?           @relation(fields: [intentId], references: [id], onDelete: SetNull)`  |
| payment | Payment (object) | Có | `payment              Payment?                 @relation(fields: [paymentId], references: [id], onDelete: SetNull)`  |
| booking | Booking (object) | Có | `booking              Booking?                 @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| packagePurchase | PackagePurchase (object) | Có | `packagePurchase      PackagePurchase?         @relation(fields: [packagePurchaseId], references: [id], onDelete: Restrict)`  |
| packageInstallment | PackageInstallment (object) | Có | `packageInstallment   PackageInstallment?      @relation(fields: [packageInstallmentId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business             Business                 @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch               Branch                   @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| reversalOf | PaymentTransaction (object) | Có | `reversalOf           PaymentTransaction?      @relation("PaymentTransactionReversal", fields: [reversalOfId], references: [id], onDelete: Restrict)`  |
| reversedBy | PaymentTransaction (object) | Có | `reversedBy           PaymentTransaction?      @relation("PaymentTransactionReversal")`  |
| ledgerEntries | FinancialLedgerEntry[] (object) | Không | `ledgerEntries        FinancialLedgerEntry[]`  |

Khóa chính: id. Unique đơn: idempotencyKey, providerEventId, reversalOfId.

- `@@index([bookingId, status])`
- `@@index([packagePurchaseId, status])`
- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`
- `@@map("payment_transactions")`

## FinancialLedgerEntry

Bảng: `financial_ledger_entries`; schema dòng 1368; miền Hoàn tiền và sổ cái. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                   String              @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId           String              @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId             String              @map("branch_id")` **FK vật lý** |
| bookingId | String (scalar) | Có | `bookingId            String?             @map("booking_id")` **FK vật lý** |
| paymentId | String (scalar) | Có | `paymentId            String?             @map("payment_id")` **FK vật lý** |
| paymentTransactionId | String (scalar) | Có | `paymentTransactionId String?             @map("payment_transaction_id")` **FK vật lý** |
| refundId | String (scalar) | Có | `refundId             String?             @map("refund_id")` **FK vật lý** |
| type | FinancialLedgerType (enum) | Không | `type                 FinancialLedgerType`  |
| direction | LedgerDirection (enum) | Không | `direction            LedgerDirection`  |
| amount | Decimal (scalar) | Không | `amount               Decimal             @db.Decimal(12, 2)`  |
| currency | String (scalar) | Không | `currency             String              @default("VND")`  |
| sourceType | String (scalar) | Không | `sourceType           String              @map("source_type")`  |
| sourceId | String (scalar) | Không | `sourceId             String              @map("source_id")` (Không suy FK từ hậu tố Id) |
| idempotencyKey | String (scalar) | Không | `idempotencyKey       String              @unique @map("idempotency_key")`  |
| actorId | String (scalar) | Có | `actorId              String?             @map("actor_id")` (Không suy FK từ hậu tố Id) |
| correlationId | String (scalar) | Có | `correlationId        String?             @map("correlation_id")` (Không suy FK từ hậu tố Id) |
| metadata | Json (scalar) | Có | `metadata             Json?`  |
| occurredAt | DateTime (scalar) | Không | `occurredAt           DateTime            @default(now()) @map("occurred_at")`  |
| business | Business (object) | Không | `business             Business            @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch               Branch              @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| booking | Booking (object) | Có | `booking              Booking?            @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| payment | Payment (object) | Có | `payment              Payment?            @relation(fields: [paymentId], references: [id], onDelete: Restrict)`  |
| paymentTransaction | PaymentTransaction (object) | Có | `paymentTransaction   PaymentTransaction? @relation(fields: [paymentTransactionId], references: [id], onDelete: Restrict)`  |
| refund | RefundRequest (object) | Có | `refund               RefundRequest?      @relation(fields: [refundId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: idempotencyKey.

- `@@index([businessId, occurredAt])`
- `@@index([branchId, occurredAt])`
- `@@index([bookingId, occurredAt])`
- `@@index([sourceType, sourceId])`
- `@@map("financial_ledger_entries")`

## RefundAllocation

Bảng: `refund_allocations`; schema dòng 1401; miền Hoàn tiền và sổ cái. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String          @id @default(uuid())`  |
| refundId | String (scalar) | Không | `refundId         String          @map("refund_id")` **FK vật lý** |
| bookingServiceId | String (scalar) | Có | `bookingServiceId String?         @map("booking_service_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount           Decimal         @db.Decimal(12, 2)`  |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime        @default(now()) @map("created_at")`  |
| refund | RefundRequest (object) | Không | `refund           RefundRequest   @relation(fields: [refundId], references: [id], onDelete: Cascade)`  |
| bookingService | BookingService (object) | Có | `bookingService   BookingService? @relation(fields: [bookingServiceId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([refundId])`
- `@@index([bookingServiceId])`
- `@@map("refund_allocations")`

## PlatformFeeEntry

Bảng: `platform_fee_entries`; schema dòng 1415; miền Phí và đối soát nền tảng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String                  @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId          String                  @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId            String                  @map("branch_id")` **FK vật lý** |
| bookingId | String (scalar) | Không | `bookingId           String                  @unique @map("booking_id")` **FK vật lý** |
| baseAmount | Decimal (scalar) | Không | `baseAmount          Decimal                 @map("base_amount") @db.Decimal(12, 2)`  |
| feeRate | Decimal (scalar) | Không | `feeRate             Decimal                 @map("fee_rate") @db.Decimal(7, 4)`  |
| feeAmount | Decimal (scalar) | Không | `feeAmount           Decimal                 @map("fee_amount") @db.Decimal(12, 2)`  |
| currency | String (scalar) | Không | `currency            String                  @default("VND")`  |
| status | PlatformFeeStatus (enum) | Không | `status              PlatformFeeStatus       @default(ACCRUED)`  |
| calculationSnapshot | Json (scalar) | Không | `calculationSnapshot Json                    @map("calculation_snapshot")`  |
| createdAt | DateTime (scalar) | Không | `createdAt           DateTime                @default(now()) @map("created_at")`  |
| business | Business (object) | Không | `business            Business                @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch              Branch                  @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| booking | Booking (object) | Không | `booking             Booking                 @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| adjustments | PlatformFeeAdjustment[] (object) | Không | `adjustments         PlatformFeeAdjustment[]`  |
| statementLines | PlatformStatementLine[] (object) | Không | `statementLines      PlatformStatementLine[]`  |

Khóa chính: id. Unique đơn: bookingId.

- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`
- `@@map("platform_fee_entries")`

## PlatformFeeAdjustment

Bảng: `platform_fee_adjustments`; schema dòng 1438; miền Phí và đối soát nền tảng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String                  @id @default(uuid())`  |
| platformFeeId | String (scalar) | Không | `platformFeeId  String                  @map("platform_fee_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId     String                  @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId       String                  @map("branch_id")` **FK vật lý** |
| refundId | String (scalar) | Có | `refundId       String?                 @map("refund_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount         Decimal                 @db.Decimal(12, 2)`  |
| reason | String (scalar) | Không | `reason         String`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime                @default(now()) @map("created_at")`  |
| platformFee | PlatformFeeEntry (object) | Không | `platformFee    PlatformFeeEntry        @relation(fields: [platformFeeId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business       Business                @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch         Branch                  @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| refund | RefundRequest (object) | Có | `refund         RefundRequest?          @relation(fields: [refundId], references: [id], onDelete: Restrict)`  |
| statementLines | PlatformStatementLine[] (object) | Không | `statementLines PlatformStatementLine[]`  |

Khóa chính: id. Unique đơn: không.

- `@@index([platformFeeId, createdAt])`
- `@@index([businessId, createdAt])`
- `@@map("platform_fee_adjustments")`

## PlatformStatement

Bảng: `platform_statements`; schema dòng 1458; miền Phí và đối soát nền tảng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String                  @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId       String                  @map("business_id")` **FK vật lý** |
| periodStart | DateTime (scalar) | Không | `periodStart      DateTime                @map("period_start") @db.Date`  |
| periodEnd | DateTime (scalar) | Không | `periodEnd        DateTime                @map("period_end") @db.Date`  |
| version | Int (scalar) | Không | `version          Int                     @default(1)`  |
| status | PlatformStatementStatus (enum) | Không | `status           PlatformStatementStatus @default(DRAFT)`  |
| currency | String (scalar) | Không | `currency         String                  @default("VND")`  |
| grossFeeAmount | Decimal (scalar) | Không | `grossFeeAmount   Decimal                 @default(0) @map("gross_fee_amount") @db.Decimal(12, 2)`  |
| adjustmentAmount | Decimal (scalar) | Không | `adjustmentAmount Decimal                 @default(0) @map("adjustment_amount") @db.Decimal(12, 2)`  |
| netAmount | Decimal (scalar) | Không | `netAmount        Decimal                 @default(0) @map("net_amount") @db.Decimal(12, 2)`  |
| issuedAt | DateTime (scalar) | Có | `issuedAt         DateTime?               @map("issued_at")`  |
| paidAt | DateTime (scalar) | Có | `paidAt           DateTime?               @map("paid_at")`  |
| lockedAt | DateTime (scalar) | Có | `lockedAt         DateTime?               @map("locked_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime                @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt        DateTime                @updatedAt @map("updated_at")`  |
| business | Business (object) | Không | `business         Business                @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| lines | PlatformStatementLine[] (object) | Không | `lines            PlatformStatementLine[]`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, periodStart, periodEnd, version])`
- `@@index([businessId, status, periodStart])`
- `@@map("platform_statements")`

## PlatformStatementLine

Bảng: `platform_statement_lines`; schema dòng 1482; miền Phí và đối soát nền tảng. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id              String                 @id @default(uuid())`  |
| statementId | String (scalar) | Không | `statementId     String                 @map("statement_id")` **FK vật lý** |
| platformFeeId | String (scalar) | Có | `platformFeeId   String?                @map("platform_fee_id")` **FK vật lý** |
| feeAdjustmentId | String (scalar) | Có | `feeAdjustmentId String?                @map("fee_adjustment_id")` **FK vật lý** |
| lineType | StatementLineType (enum) | Không | `lineType        StatementLineType      @map("line_type")`  |
| amount | Decimal (scalar) | Không | `amount          Decimal                @db.Decimal(12, 2)`  |
| sourceSnapshot | Json (scalar) | Không | `sourceSnapshot  Json                   @map("source_snapshot")`  |
| createdAt | DateTime (scalar) | Không | `createdAt       DateTime               @default(now()) @map("created_at")`  |
| statement | PlatformStatement (object) | Không | `statement       PlatformStatement      @relation(fields: [statementId], references: [id], onDelete: Cascade)`  |
| platformFee | PlatformFeeEntry (object) | Có | `platformFee     PlatformFeeEntry?      @relation(fields: [platformFeeId], references: [id], onDelete: Restrict)`  |
| feeAdjustment | PlatformFeeAdjustment (object) | Có | `feeAdjustment   PlatformFeeAdjustment? @relation(fields: [feeAdjustmentId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([statementId, platformFeeId, feeAdjustmentId])`
- `@@index([statementId])`
- `@@map("platform_statement_lines")`

## TreatmentPackage

Bảng: `treatment_packages`; schema dòng 1500; miền Gói buổi dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id           String                 @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId   String                 @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId     String?                @map("branch_id")` **FK vật lý** |
| name | String (scalar) | Không | `name         String`  |
| description | String (scalar) | Có | `description  String?`  |
| totalPrice | Decimal (scalar) | Không | `totalPrice   Decimal                @map("total_price") @db.Decimal(12, 2)`  |
| currency | String (scalar) | Không | `currency     String                 @default("VND")`  |
| sessionCount | Int (scalar) | Không | `sessionCount Int                    @map("session_count")`  |
| validityDays | Int (scalar) | Không | `validityDays Int                    @default(365) @map("validity_days")`  |
| status | TreatmentPackageStatus (enum) | Không | `status       TreatmentPackageStatus @default(ACTIVE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt    DateTime               @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt    DateTime               @updatedAt @map("updated_at")`  |
| business | Business (object) | Không | `business     Business               @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| branch | Branch (object) | Có | `branch       Branch?                @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| purchases | PackagePurchase[] (object) | Không | `purchases    PackagePurchase[]`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId, status])`
- `@@index([branchId, status])`
- `@@map("treatment_packages")`

## PackagePurchase

Bảng: `package_purchases`; schema dòng 1522; miền Gói buổi dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String                      @id @default(uuid())`  |
| packageId | String (scalar) | Không | `packageId           String                      @map("package_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId          String                      @map("customer_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId          String                      @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId            String?                     @map("branch_id")` **FK vật lý** |
| totalAmount | Decimal (scalar) | Không | `totalAmount         Decimal                     @map("total_amount") @db.Decimal(12, 2)`  |
| paidAmount | Decimal (scalar) | Không | `paidAmount          Decimal                     @default(0) @map("paid_amount") @db.Decimal(12, 2)`  |
| currency | String (scalar) | Không | `currency            String                      @default("VND")`  |
| status | PackagePurchaseStatus (enum) | Không | `status              PackagePurchaseStatus       @default(PENDING_PAYMENT)`  |
| pricingSnapshot | Json (scalar) | Không | `pricingSnapshot     Json                        @map("pricing_snapshot")`  |
| purchasedAt | DateTime (scalar) | Không | `purchasedAt         DateTime                    @default(now()) @map("purchased_at")`  |
| expiresAt | DateTime (scalar) | Không | `expiresAt           DateTime                    @map("expires_at")`  |
| package | TreatmentPackage (object) | Không | `package             TreatmentPackage            @relation(fields: [packageId], references: [id], onDelete: Restrict)`  |
| customer | CustomerProfile (object) | Không | `customer            CustomerProfile             @relation(fields: [customerId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business            Business                    @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Có | `branch              Branch?                     @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| installments | PackageInstallment[] (object) | Không | `installments        PackageInstallment[]`  |
| entitlements | PackageSessionEntitlement[] (object) | Không | `entitlements        PackageSessionEntitlement[]`  |
| paymentIntents | PaymentIntent[] (object) | Không | `paymentIntents      PaymentIntent[]`  |
| paymentTransactions | PaymentTransaction[] (object) | Không | `paymentTransactions PaymentTransaction[]`  |

Khóa chính: id. Unique đơn: không.

- `@@index([customerId, status])`
- `@@index([businessId, status])`
- `@@map("package_purchases")`

## PackageInstallment

Bảng: `package_installments`; schema dòng 1549; miền Gói buổi dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String                   @id @default(uuid())`  |
| purchaseId | String (scalar) | Không | `purchaseId          String                   @map("purchase_id")` **FK vật lý** |
| sequence | Int (scalar) | Không | `sequence            Int`  |
| dueAt | DateTime (scalar) | Không | `dueAt               DateTime                 @map("due_at")`  |
| amount | Decimal (scalar) | Không | `amount              Decimal                  @db.Decimal(12, 2)`  |
| status | PackageInstallmentStatus (enum) | Không | `status              PackageInstallmentStatus @default(DUE)`  |
| paymentIntentId | String (scalar) | Có | `paymentIntentId     String?                  @map("payment_intent_id")` (Không suy FK từ hậu tố Id) |
| paidAt | DateTime (scalar) | Có | `paidAt              DateTime?                @map("paid_at")`  |
| purchase | PackagePurchase (object) | Không | `purchase            PackagePurchase          @relation(fields: [purchaseId], references: [id], onDelete: Cascade)`  |
| paymentIntents | PaymentIntent[] (object) | Không | `paymentIntents      PaymentIntent[]`  |
| paymentTransactions | PaymentTransaction[] (object) | Không | `paymentTransactions PaymentTransaction[]`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([purchaseId, sequence])`
- `@@index([status, dueAt])`
- `@@map("package_installments")`

## PackageSessionEntitlement

Bảng: `package_session_entitlements`; schema dòng 1567; miền Gói buổi dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                       String                   @id @default(uuid())`  |
| purchaseId | String (scalar) | Không | `purchaseId               String                   @map("purchase_id")` **FK vật lý** |
| sequence | Int (scalar) | Không | `sequence                 Int`  |
| status | PackageEntitlementStatus (enum) | Không | `status                   PackageEntitlementStatus @default(AVAILABLE)`  |
| bookingId | String (scalar) | Có | `bookingId                String?                  @map("booking_id")` **FK vật lý** |
| redeemedBookingServiceId | String (scalar) | Có | `redeemedBookingServiceId String?                  @unique @map("redeemed_booking_service_id")` **FK vật lý** |
| reservedAt | DateTime (scalar) | Có | `reservedAt               DateTime?                @map("reserved_at")`  |
| redeemedAt | DateTime (scalar) | Có | `redeemedAt               DateTime?                @map("redeemed_at")`  |
| purchase | PackagePurchase (object) | Không | `purchase                 PackagePurchase          @relation(fields: [purchaseId], references: [id], onDelete: Cascade)`  |
| booking | Booking (object) | Có | `booking                  Booking?                 @relation(fields: [bookingId], references: [id], onDelete: SetNull)`  |
| redeemedBookingService | BookingService (object) | Có | `redeemedBookingService   BookingService?          @relation(fields: [redeemedBookingServiceId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: redeemedBookingServiceId.

- `@@unique([purchaseId, sequence])`
- `@@index([purchaseId, status])`
- `@@map("package_session_entitlements")`

## Review

Bảng: `reviews`; schema dòng 1585; miền Đánh giá. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String                @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId      String                @unique @map("booking_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId     String                @map("customer_id")` **FK vật lý** |
| overallRating | Int (scalar) | Không | `overallRating  Int                   @map("overall_rating") @db.SmallInt`  |
| comment | String (scalar) | Có | `comment        String?`  |
| isAnonymous | Boolean (scalar) | Không | `isAnonymous    Boolean               @default(false) @map("is_anonymous")`  |
| status | ReviewStatus (enum) | Không | `status         ReviewStatus          @default(PENDING)`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime              @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime              @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt      DateTime?             @map("deleted_at")`  |
| serviceRatings | ReviewServiceRating[] (object) | Không | `serviceRatings ReviewServiceRating[]`  |
| booking | Booking (object) | Không | `booking        Booking               @relation(fields: [bookingId], references: [id])`  |
| customer | CustomerProfile (object) | Không | `customer       CustomerProfile       @relation(fields: [customerId], references: [id])`  |
| reports | ReviewReport[] (object) | Không | `reports        ReviewReport[]`  |
| businessReply | BusinessComment (object) | Có | `businessReply  BusinessComment?`  |
| refs_ReviewModerationEvent_reviewId | ReviewModerationEvent[] (object) | Không | `refs_ReviewModerationEvent_reviewId ReviewModerationEvent[] @relation("Audit_ReviewModerationEvent_reviewId")`  |
| refs_ReviewAppeal_reviewId | ReviewAppeal[] (object) | Không | `refs_ReviewAppeal_reviewId ReviewAppeal[] @relation("Audit_ReviewAppeal_reviewId")`  |

Khóa chính: id. Unique đơn: bookingId.

- `@@index([customerId])`
- `@@index([status])`
- `@@index([status, deletedAt, bookingId])`
- `@@map("reviews")`

## ReviewServiceRating

Bảng: `review_service_ratings`; schema dòng 1610; miền Đánh giá. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String         @id @default(uuid())`  |
| reviewId | String (scalar) | Không | `reviewId         String         @map("review_id")` **FK vật lý** |
| bookingServiceId | String (scalar) | Không | `bookingServiceId String         @unique @map("booking_service_id")` **FK vật lý** |
| staffId | String (scalar) | Có | `staffId          String?        @map("staff_id")` **FK vật lý** |
| rating | Int (scalar) | Không | `rating           Int            @db.SmallInt`  |
| comment | String (scalar) | Có | `comment          String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime       @default(now()) @map("created_at")`  |
| bookingService | BookingService (object) | Không | `bookingService   BookingService @relation(fields: [bookingServiceId], references: [id])`  |
| review | Review (object) | Không | `review           Review         @relation(fields: [reviewId], references: [id], onDelete: Cascade)`  |
| staff | StaffProfile (object) | Có | `staff            StaffProfile?  @relation(fields: [staffId], references: [id])`  |

Khóa chính: id. Unique đơn: bookingServiceId.

- `@@index([reviewId])`
- `@@index([staffId])`
- `@@map("review_service_ratings")`

## BusinessComment

Bảng: `business_comments`; schema dòng 1627; miền Đánh giá. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id              String            @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId      String            @map("business_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId      String            @map("customer_id")` **FK vật lý** |
| parentCommentId | String (scalar) | Có | `parentCommentId String?           @map("parent_comment_id")` **FK vật lý** |
| reviewId | String (scalar) | Có | `reviewId        String?           @unique @map("review_id")` **FK vật lý** |
| content | String (scalar) | Không | `content         String`  |
| status | CommentStatus (enum) | Không | `status          CommentStatus     @default(VISIBLE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt       DateTime          @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt       DateTime          @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt       DateTime?         @map("deleted_at")`  |
| business | Business (object) | Không | `business        Business          @relation(fields: [businessId], references: [id])`  |
| customer | CustomerProfile (object) | Không | `customer        CustomerProfile   @relation(fields: [customerId], references: [id])`  |
| parent | BusinessComment (object) | Có | `parent          BusinessComment?  @relation("CommentReplies", fields: [parentCommentId], references: [id])`  |
| replies | BusinessComment[] (object) | Không | `replies         BusinessComment[] @relation("CommentReplies")`  |
| review | Review (object) | Có | `review          Review?           @relation(fields: [reviewId], references: [id])`  |

Khóa chính: id. Unique đơn: reviewId.

- `@@index([businessId])`
- `@@index([parentCommentId])`
- `@@map("business_comments")`

## Notification

Bảng: `notifications`; schema dòng 1649; miền Thông báo và cấu hình. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String               @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId           String               @map("user_id")` **FK vật lý** |
| type | NotificationType (enum) | Không | `type             NotificationType`  |
| severity | NotificationSeverity (enum) | Không | `severity         NotificationSeverity @default(INFO)`  |
| title | String (scalar) | Không | `title            String`  |
| body | String (scalar) | Có | `body             String?`  |
| isRead | Boolean (scalar) | Không | `isRead           Boolean              @default(false) @map("is_read")`  |
| readAt | DateTime (scalar) | Có | `readAt           DateTime?            @map("read_at")`  |
| targetType | String (scalar) | Có | `targetType       String?              @map("target_type")`  |
| targetId | String (scalar) | Có | `targetId         String?              @map("target_id")` (Không suy FK từ hậu tố Id) |
| actionUrl | String (scalar) | Có | `actionUrl        String?              @map("action_url")`  |
| metadata | Json (scalar) | Có | `metadata         Json?`  |
| relatedBookingId | String (scalar) | Có | `relatedBookingId String?              @map("related_booking_id")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime             @default(now()) @map("created_at")`  |
| relatedBooking | Booking (object) | Có | `relatedBooking   Booking?             @relation(fields: [relatedBookingId], references: [id])`  |
| user | User (object) | Không | `user             User                 @relation(fields: [userId], references: [id])`  |
| outbox | NotificationOutbox (object) | Có | `outbox           NotificationOutbox?`  |

Khóa chính: id. Unique đơn: không.

- `@@index([userId])`
- `@@index([isRead])`
- `@@map("notifications")`
- `@@index([userId, isRead])`

## NotificationOutbox

Bảng: `notification_outbox`; schema dòng 1677; miền Thông báo và cấu hình. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String                   @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId           String                   @map("user_id")` **FK vật lý** |
| type | NotificationType (enum) | Không | `type             NotificationType`  |
| severity | NotificationSeverity (enum) | Không | `severity         NotificationSeverity     @default(INFO)`  |
| title | String (scalar) | Không | `title            String`  |
| body | String (scalar) | Có | `body             String?`  |
| targetType | String (scalar) | Có | `targetType       String?                  @map("target_type")`  |
| targetId | String (scalar) | Có | `targetId         String?                  @map("target_id")` (Không suy FK từ hậu tố Id) |
| actionUrl | String (scalar) | Có | `actionUrl        String?                  @map("action_url")`  |
| metadata | Json (scalar) | Có | `metadata         Json?`  |
| relatedBookingId | String (scalar) | Có | `relatedBookingId String?                  @map("related_booking_id")` **FK vật lý** |
| dedupeKey | String (scalar) | Không | `dedupeKey        String                   @unique @map("dedupe_key")`  |
| status | NotificationOutboxStatus (enum) | Không | `status           NotificationOutboxStatus @default(PENDING)`  |
| attempts | Int (scalar) | Không | `attempts         Int                      @default(0)`  |
| availableAt | DateTime (scalar) | Không | `availableAt      DateTime                 @default(now()) @map("available_at")`  |
| lastError | String (scalar) | Có | `lastError        String?                  @map("last_error")`  |
| sentAt | DateTime (scalar) | Có | `sentAt           DateTime?                @map("sent_at")`  |
| notificationId | String (scalar) | Có | `notificationId   String?                  @unique @map("notification_id")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime                 @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt        DateTime                 @updatedAt @map("updated_at")`  |
| user | User (object) | Không | `user             User                     @relation(fields: [userId], references: [id], onDelete: Restrict)`  |
| relatedBooking | Booking (object) | Có | `relatedBooking   Booking?                 @relation(fields: [relatedBookingId], references: [id], onDelete: Restrict)`  |
| notification | Notification (object) | Có | `notification     Notification?            @relation(fields: [notificationId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: dedupeKey, notificationId.

- `@@index([status, availableAt])`
- `@@index([userId, createdAt])`
- `@@map("notification_outbox")`

## AuditLog

Bảng: `audit_logs`; schema dòng 1707; miền Giám sát và tác động. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String      @id @default(uuid())`  |
| userId | String (scalar) | Có | `userId     String?     @map("user_id")` **FK vật lý** |
| action | AuditAction (enum) | Không | `action     AuditAction`  |
| entityType | String (scalar) | Không | `entityType String      @map("entity_type")`  |
| entityId | String (scalar) | Có | `entityId   String?     @map("entity_id")` (Không suy FK từ hậu tố Id) |
| oldData | Json (scalar) | Có | `oldData    Json?       @map("old_data")`  |
| newData | Json (scalar) | Có | `newData    Json?       @map("new_data")`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime    @default(now()) @map("created_at")`  |
| reason | String (scalar) | Có | `reason     String?`  |
| user | User (object) | Có | `user       User?       @relation(fields: [userId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([userId])`
- `@@index([entityType])`
- `@@index([entityId])`
- `@@map("audit_logs")`

## SalonMember

Bảng: `salon_members`; schema dòng 1725; miền Doanh nghiệp và thành viên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String          @id @default(uuid())`  |
| userId | String (scalar) | Không | `userId     String          @map("user_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId String          @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId   String?         @map("branch_id")` **FK vật lý** |
| role | SalonMemberRole (enum) | Không | `role       SalonMemberRole`  |
| isActive | Boolean (scalar) | Không | `isActive   Boolean         @default(true) @map("is_active")`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime        @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt  DateTime        @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt  DateTime?       @map("deleted_at")`  |
| branch | Branch (object) | Có | `branch     Branch?         @relation(fields: [branchId], references: [id])`  |
| business | Business (object) | Không | `business   Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| user | User (object) | Không | `user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([userId, businessId])`
- `@@index([businessId])`
- `@@index([branchId])`
- `@@map("salon_members")`

## CancellationPolicy

Bảng: `cancellation_policies`; schema dòng 1745; miền Doanh nghiệp và thành viên. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                     String   @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId             String   @unique @map("business_id")` **FK vật lý** |
| freeCancelHours | Int (scalar) | Không | `freeCancelHours        Int      @default(2) @map("free_cancel_hours")`  |
| lateCancelFeePercent | Int (scalar) | Không | `lateCancelFeePercent   Int      @default(0) @map("late_cancel_fee_percent")`  |
| noShowFeePercent | Int (scalar) | Không | `noShowFeePercent       Int      @default(0) @map("no_show_fee_percent")`  |
| rescheduleAllowedHours | Int (scalar) | Không | `rescheduleAllowedHours Int      @default(1) @map("reschedule_allowed_hours")`  |
| notes | String (scalar) | Có | `notes                  String?`  |
| updatedBy | String (scalar) | Có | `updatedBy              String?  @map("updated_by")`  |
| createdAt | DateTime (scalar) | Không | `createdAt              DateTime @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt              DateTime @updatedAt @map("updated_at")`  |
| business | Business (object) | Không | `business               Business @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: businessId.

- `@@map("cancellation_policies")`

## Voucher

Bảng: `vouchers`; schema dòng 1763; miền Voucher và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String                @id @default(uuid())`  |
| code | String (scalar) | Không | `code                String                @unique`  |
| name | String (scalar) | Không | `name                String`  |
| description | String (scalar) | Có | `description         String?`  |
| discountType | DiscountType (enum) | Không | `discountType        DiscountType          @map("discount_type")`  |
| discountValue | Decimal (scalar) | Không | `discountValue       Decimal               @map("discount_value") @db.Decimal(12, 2)`  |
| minOrderValue | Decimal (scalar) | Không | `minOrderValue       Decimal               @default(0) @map("min_order_value") @db.Decimal(12, 2)`  |
| maxDiscount | Decimal (scalar) | Có | `maxDiscount         Decimal?              @map("max_discount") @db.Decimal(12, 2)`  |
| totalQuantity | Int (scalar) | Không | `totalQuantity       Int                   @default(0) @map("total_quantity")`  |
| usedQuantity | Int (scalar) | Không | `usedQuantity        Int                   @default(0) @map("used_quantity")`  |
| startDate | DateTime (scalar) | Không | `startDate           DateTime              @map("start_date")`  |
| endDate | DateTime (scalar) | Không | `endDate             DateTime              @map("end_date")`  |
| status | VoucherStatus (enum) | Không | `status              VoucherStatus         @default(ACTIVE)`  |
| createdAt | DateTime (scalar) | Không | `createdAt           DateTime              @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt           DateTime              @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt           DateTime?             @map("deleted_at")`  |
| businessId | String (scalar) | Có | `businessId          String?               @map("business_id")` **FK vật lý** |
| scope | VoucherScope (enum) | Không | `scope               VoucherScope          @default(TENANT)`  |
| createdByPlatform | Boolean (scalar) | Không | `createdByPlatform   Boolean               @default(false) @map("created_by_platform")`  |
| audience | VoucherAudience (enum) | Không | `audience            VoucherAudience       @default(ALL)`  |
| maxUsagePerCustomer | Int (scalar) | Không | `maxUsagePerCustomer Int                   @default(1) @map("max_usage_per_customer")`  |
| autoIssue | Boolean (scalar) | Không | `autoIssue           Boolean               @default(false) @map("auto_issue")`  |
| version | Int (scalar) | Không | `version             Int                   @default(1)`  |
| bookings | Booking[] (object) | Không | `bookings            Booking[]`  |
| customerVouchers | CustomerVoucher[] (object) | Không | `customerVouchers    CustomerVoucher[]`  |
| business | Business (object) | Có | `business            Business?             @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| branchScopes | VoucherBranchScope[] (object) | Không | `branchScopes        VoucherBranchScope[]`  |
| serviceScopes | VoucherServiceScope[] (object) | Không | `serviceScopes       VoucherServiceScope[]`  |
| comboScopes | VoucherComboScope[] (object) | Không | `comboScopes         VoucherComboScope[]`  |
| refs_VoucherRedemption_voucherId | VoucherRedemption[] (object) | Không | `refs_VoucherRedemption_voucherId VoucherRedemption[] @relation("Audit_VoucherRedemption_voucherId")`  |

Khóa chính: id. Unique đơn: code.

- `@@index([status])`
- `@@index([startDate, endDate])`
- `@@index([businessId, scope])`
- `@@map("vouchers")`

## CustomerVoucher

Bảng: `customer_vouchers`; schema dòng 1801; miền Voucher và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id            String          @id @default(uuid())`  |
| voucherId | String (scalar) | Không | `voucherId     String          @map("voucher_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId    String          @map("customer_id")` **FK vật lý** |
| status | VoucherStatus (enum) | Không | `status        VoucherStatus   @default(ACTIVE)`  |
| acquiredAt | DateTime (scalar) | Không | `acquiredAt    DateTime        @default(now()) @map("acquired_at")`  |
| usedAt | DateTime (scalar) | Có | `usedAt        DateTime?       @map("used_at")`  |
| reservedAt | DateTime (scalar) | Có | `reservedAt    DateTime?       @map("reserved_at")`  |
| usedBookingId | String (scalar) | Có | `usedBookingId String?         @unique @map("used_booking_id")` (Không suy FK từ hậu tố Id) |
| expiresAt | DateTime (scalar) | Có | `expiresAt     DateTime?       @map("expires_at")`  |
| customer | CustomerProfile (object) | Không | `customer      CustomerProfile @relation(fields: [customerId], references: [id], onDelete: Cascade)`  |
| voucher | Voucher (object) | Không | `voucher       Voucher         @relation(fields: [voucherId], references: [id], onDelete: Cascade)`  |
| refs_VoucherRedemption_customerVoucherId | VoucherRedemption[] (object) | Không | `refs_VoucherRedemption_customerVoucherId VoucherRedemption[] @relation("Audit_VoucherRedemption_customerVoucherId")`  |

Khóa chính: id. Unique đơn: usedBookingId.

- `@@unique([voucherId, customerId])`
- `@@index([customerId])`
- `@@map("customer_vouchers")`

## AppointmentChangeRequest

Bảng: `appointment_change_requests`; schema dòng 1820; miền Yêu cầu và chính sách khách. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| violationEvent | BookingViolationEvent (object) | Có | `violationEvent BookingViolationEvent?`  |
| id | String (scalar) | Không | `id                String              @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId         String              @map("booking_id")` **FK vật lý** |
| requestedBy | String (scalar) | Không | `requestedBy       String              @map("requested_by")` **FK vật lý** |
| requestedByType | CancelledByType (enum) | Không | `requestedByType   CancelledByType     @map("requested_by_type")`  |
| requestType | ChangeRequestType (enum) | Không | `requestType       ChangeRequestType   @map("request_type")`  |
| proposedStartTime | DateTime (scalar) | Có | `proposedStartTime DateTime?           @map("proposed_start_time")`  |
| proposedEndTime | DateTime (scalar) | Có | `proposedEndTime   DateTime?           @map("proposed_end_time")`  |
| proposedStaffId | String (scalar) | Có | `proposedStaffId   String?             @map("proposed_staff_id")` **FK vật lý** |
| reason | String (scalar) | Có | `reason            String?`  |
| status | ChangeRequestStatus (enum) | Không | `status            ChangeRequestStatus @default(PENDING)`  |
| reviewedBy | String (scalar) | Có | `reviewedBy        String?             @map("reviewed_by")` **FK vật lý** |
| reviewedAt | DateTime (scalar) | Có | `reviewedAt        DateTime?           @map("reviewed_at")`  |
| reviewNote | String (scalar) | Có | `reviewNote        String?             @map("review_note")`  |
| expiresAt | DateTime (scalar) | Không | `expiresAt         DateTime            @map("expires_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt         DateTime            @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt         DateTime            @updatedAt @map("updated_at")`  |
| booking | Booking (object) | Không | `booking           Booking             @relation(fields: [bookingId], references: [id], onDelete: Cascade)`  |
| proposedStaff | StaffProfile (object) | Có | `proposedStaff     StaffProfile?       @relation("ChangeRequestProposedStaff", fields: [proposedStaffId], references: [id])`  |
| requestedByUser | User (object) | Không | `requestedByUser   User                @relation("ChangeRequestRequestedBy", fields: [requestedBy], references: [id])`  |
| reviewer | User (object) | Có | `reviewer          User?               @relation("ChangeRequestReviewedBy", fields: [reviewedBy], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([bookingId])`
- `@@index([status])`
- `@@map("appointment_change_requests")`

## BookingViolationEvent

Bảng: `booking_violation_events`; schema dòng 1854; miền Yêu cầu và chính sách khách. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| triggeredPolicy | CustomerBookingPolicy (object) | Có | `triggeredPolicy CustomerBookingPolicy?`  |
| id | String (scalar) | Không | `id                 String @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId          String @map("booking_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId         String @map("customer_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId         String @map("business_id")` **FK vật lý** |
| sourceRequestId | String (scalar) | Có | `sourceRequestId    String? @unique @map("source_request_id")` **FK vật lý** |
| kind | BookingViolationKind (enum) | Không | `kind               BookingViolationKind`  |
| occurredAt | DateTime (scalar) | Không | `occurredAt         DateTime @map("occurred_at")`  |
| appointmentStartAt | DateTime (scalar) | Không | `appointmentStartAt DateTime @map("appointment_start_at")`  |
| recordedById | String (scalar) | Không | `recordedById       String @map("recorded_by_id")` **FK vật lý** |
| policyVersion | String (scalar) | Không | `policyVersion      String @map("policy_version")`  |
| createdAt | DateTime (scalar) | Không | `createdAt          DateTime @default(now()) @map("created_at")`  |
| voidedAt | DateTime (scalar) | Có | `voidedAt           DateTime? @map("voided_at")`  |
| voidedById | String (scalar) | Có | `voidedById         String? @map("voided_by_id")` **FK vật lý** |
| voidReason | String (scalar) | Có | `voidReason         String? @map("void_reason")`  |
| booking | Booking (object) | Không | `booking            Booking @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| customer | CustomerProfile (object) | Không | `customer           CustomerProfile @relation(fields: [customerId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business           Business @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| sourceRequest | AppointmentChangeRequest (object) | Có | `sourceRequest      AppointmentChangeRequest? @relation(fields: [sourceRequestId], references: [id], onDelete: Restrict)`  |
| recordedBy | User (object) | Không | `recordedBy         User @relation("BookingViolationActor", fields: [recordedById], references: [id], onDelete: Restrict)`  |
| voidedBy | User (object) | Có | `voidedBy           User? @relation("BookingViolationVoider", fields: [voidedById], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: sourceRequestId.

- `@@index([bookingId])`
- `@@index([customerId, businessId, occurredAt], map: "booking_violation_events_customer_id_business_id_occurred_at_id")`
- `@@map("booking_violation_events")`

## CustomerBookingPolicy

Bảng: `customer_booking_policies`; schema dòng 1885; miền Yêu cầu và chính sách khách. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id String @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId String @map("customer_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId String @map("business_id")` **FK vật lý** |
| revision | Int (scalar) | Không | `revision Int @default(0)`  |
| startsAt | DateTime (scalar) | Có | `startsAt DateTime? @map("starts_at")`  |
| endsAt | DateTime (scalar) | Có | `endsAt DateTime? @map("ends_at")`  |
| triggeredByViolationEventId | String (scalar) | Có | `triggeredByViolationEventId String? @unique @map("triggered_by_violation_event_id")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt DateTime @updatedAt @map("updated_at")`  |
| customer | CustomerProfile (object) | Không | `customer CustomerProfile @relation(fields: [customerId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| triggeredByViolationEvent | BookingViolationEvent (object) | Có | `triggeredByViolationEvent BookingViolationEvent? @relation(fields: [triggeredByViolationEventId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: triggeredByViolationEventId.

- `@@unique([customerId, businessId])`
- `@@index([businessId, endsAt])`
- `@@map("customer_booking_policies")`

## SalonTrustSnapshot

Bảng: `salon_trust_snapshots`; schema dòng 1904; miền Giám sát và tác động. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                    String   @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId            String   @unique @map("business_id")` **FK vật lý** |
| totalBookings | Int (scalar) | Không | `totalBookings         Int      @default(0) @map("total_bookings")`  |
| cancellationRate | Float (scalar) | Không | `cancellationRate      Float    @default(0) @map("cancellation_rate")`  |
| noShowRate | Float (scalar) | Không | `noShowRate            Float    @default(0) @map("no_show_rate")`  |
| avgRejectTimeMinutes | Float (scalar) | Không | `avgRejectTimeMinutes  Float    @default(0) @map("avg_reject_time_minutes")`  |
| lateCancelBySalonRate | Float (scalar) | Không | `lateCancelBySalonRate Float    @default(0) @map("late_cancel_by_salon_rate")`  |
| trustScore | Float (scalar) | Không | `trustScore            Float    @default(100) @map("trust_score")`  |
| alertLevel | String (scalar) | Không | `alertLevel            String   @default("OK") @map("alert_level")`  |
| computedAt | DateTime (scalar) | Không | `computedAt            DateTime @default(now()) @map("computed_at")`  |
| business | Business (object) | Không | `business              Business @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: businessId.

- `@@map("salon_trust_snapshots")`

## TrustAction

Bảng: `trust_actions`; schema dòng 1920; miền Giám sát và tác động. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                String          @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId        String          @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId          String?         @map("branch_id")` **FK vật lý** |
| actorId | String (scalar) | Không | `actorId           String          @map("actor_id")` **FK vật lý** |
| action | TrustActionType (enum) | Không | `action            TrustActionType`  |
| reason | String (scalar) | Không | `reason            String`  |
| internalNote | String (scalar) | Có | `internalNote      String?         @map("internal_note")`  |
| statusBefore | String (scalar) | Có | `statusBefore      String?         @map("status_before")`  |
| statusAfter | String (scalar) | Có | `statusAfter       String?         @map("status_after")`  |
| restoreOfActionId | String (scalar) | Có | `restoreOfActionId String?         @unique @map("restore_of_action_id")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt         DateTime        @default(now()) @map("created_at")`  |
| business | Business (object) | Không | `business          Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| branch | Branch (object) | Có | `branch            Branch?         @relation(fields: [branchId], references: [id], onDelete: SetNull)`  |
| actor | User (object) | Không | `actor             User            @relation("TrustActionActor", fields: [actorId], references: [id])`  |
| restoreOf | TrustAction (object) | Có | `restoreOf         TrustAction?    @relation("TrustActionRestore", fields: [restoreOfActionId], references: [id], onDelete: SetNull)`  |
| restoredBy | TrustAction (object) | Có | `restoredBy        TrustAction?    @relation("TrustActionRestore")`  |

Khóa chính: id. Unique đơn: restoreOfActionId.

- `@@index([businessId, createdAt])`
- `@@index([branchId, createdAt])`
- `@@map("trust_actions")`

## BusinessReviewEvent

Bảng: `business_review_events`; schema dòng 1943; miền Hồ sơ doanh nghiệp. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String          @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId String          @map("business_id")` **FK vật lý** |
| actorId | String (scalar) | Có | `actorId    String?         @map("actor_id")` **FK vật lý** |
| action | String (scalar) | Không | `action     String`  |
| fromStatus | BusinessStatus (enum) | Có | `fromStatus BusinessStatus? @map("from_status")`  |
| toStatus | BusinessStatus (enum) | Không | `toStatus   BusinessStatus  @map("to_status")`  |
| reason | String (scalar) | Có | `reason     String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime        @default(now()) @map("created_at")`  |
| business | Business (object) | Không | `business   Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| actor | User (object) | Có | `actor      User?           @relation("BusinessReviewActor", fields: [actorId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId, createdAt])`
- `@@map("business_review_events")`

## BusinessDocument

Bảng: `business_documents`; schema dòng 1959; miền Hồ sơ doanh nghiệp. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String                    @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId     String                    @map("business_id")` **FK vật lý** |
| documentType | BusinessDocumentType (enum) | Không | `documentType   BusinessDocumentType      @map("document_type")`  |
| documentNumber | String (scalar) | Có | `documentNumber String?                   @map("document_number")`  |
| expiresAt | DateTime (scalar) | Có | `expiresAt      DateTime?                 @map("expires_at") @db.Date`  |
| status | BusinessDocumentStatus (enum) | Không | `status         BusinessDocumentStatus    @default(DRAFT)`  |
| currentVersion | Int (scalar) | Không | `currentVersion Int                       @default(1) @map("current_version")`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime                  @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime                  @default(now()) @updatedAt @map("updated_at")`  |
| business | Business (object) | Không | `business       Business                  @relation(fields: [businessId], references: [id], onDelete: Cascade)`  |
| versions | BusinessDocumentVersion[] (object) | Không | `versions       BusinessDocumentVersion[]`  |
| reviewEvents | DocumentReviewEvent[] (object) | Không | `reviewEvents   DocumentReviewEvent[]`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId, documentType, status])`
- `@@map("business_documents")`

## BusinessDocumentVersion

Bảng: `business_document_versions`; schema dòng 1977; miền Hồ sơ doanh nghiệp. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id           String           @id @default(uuid())`  |
| documentId | String (scalar) | Không | `documentId   String           @map("document_id")` **FK vật lý** |
| version | Int (scalar) | Không | `version      Int`  |
| mediaId | String (scalar) | Không | `mediaId      String           @map("media_id")` **FK vật lý** |
| documentName | String (scalar) | Không | `documentName String           @map("document_name")`  |
| note | String (scalar) | Có | `note         String?`  |
| createdBy | String (scalar) | Không | `createdBy    String           @map("created_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt    DateTime         @default(now()) @map("created_at")`  |
| document | BusinessDocument (object) | Không | `document     BusinessDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)`  |
| media | MediaFile (object) | Không | `media        MediaFile        @relation(fields: [mediaId], references: [id], onDelete: Restrict)`  |
| creator | User (object) | Không | `creator      User             @relation("BusinessDocumentVersionCreator", fields: [createdBy], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([documentId, version])`
- `@@index([mediaId])`
- `@@map("business_document_versions")`

## BranchDocument

Bảng: `branch_documents`; schema dòng 1995; miền Hồ sơ chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String                  @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId       String                  @map("branch_id")` **FK vật lý** |
| documentType | BranchDocumentType (enum) | Không | `documentType   BranchDocumentType      @map("document_type")`  |
| documentNumber | String (scalar) | Có | `documentNumber String?                 @map("document_number")`  |
| issuedAt | DateTime (scalar) | Có | `issuedAt       DateTime?               @map("issued_at") @db.Date`  |
| expiresAt | DateTime (scalar) | Có | `expiresAt      DateTime?               @map("expires_at") @db.Date`  |
| status | BranchDocumentStatus (enum) | Không | `status         BranchDocumentStatus    @default(DRAFT)`  |
| currentVersion | Int (scalar) | Không | `currentVersion Int                     @default(1) @map("current_version")`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime                @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime                @updatedAt @map("updated_at")`  |
| branch | Branch (object) | Không | `branch         Branch                  @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| versions | BranchDocumentVersion[] (object) | Không | `versions       BranchDocumentVersion[]`  |

Khóa chính: id. Unique đơn: không.

- `@@index([branchId, documentType, status])`
- `@@map("branch_documents")`

## BranchDocumentVersion

Bảng: `branch_document_versions`; schema dòng 2013; miền Hồ sơ chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id           String         @id @default(uuid())`  |
| documentId | String (scalar) | Không | `documentId   String         @map("document_id")` **FK vật lý** |
| version | Int (scalar) | Không | `version      Int`  |
| mediaId | String (scalar) | Không | `mediaId      String         @map("media_id")` **FK vật lý** |
| documentName | String (scalar) | Không | `documentName String         @map("document_name")`  |
| note | String (scalar) | Có | `note         String?`  |
| createdBy | String (scalar) | Không | `createdBy    String         @map("created_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt    DateTime       @default(now()) @map("created_at")`  |
| document | BranchDocument (object) | Không | `document     BranchDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)`  |
| media | MediaFile (object) | Không | `media        MediaFile      @relation(fields: [mediaId], references: [id], onDelete: Restrict)`  |
| creator | User (object) | Không | `creator      User           @relation("BranchDocumentVersionCreator", fields: [createdBy], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([documentId, version])`
- `@@index([mediaId])`
- `@@map("branch_document_versions")`

## BranchReviewRequest

Bảng: `branch_review_requests`; schema dòng 2031; miền Hồ sơ chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String             @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId         String             @map("branch_id")` **FK vật lý** |
| requestedBy | String (scalar) | Không | `requestedBy      String             @map("requested_by")` **FK vật lý** |
| status | BranchReviewStatus (enum) | Không | `status           BranchReviewStatus @default(PENDING_REVIEW)`  |
| profileSnapshot | Json (scalar) | Không | `profileSnapshot  Json               @map("profile_snapshot")`  |
| documentSnapshot | Json (scalar) | Có | `documentSnapshot Json?              @map("document_snapshot")`  |
| riskSnapshot | Json (scalar) | Có | `riskSnapshot     Json?              @map("risk_snapshot")`  |
| assignedTo | String (scalar) | Có | `assignedTo       String?            @map("assigned_to")` **FK vật lý** |
| dueAt | DateTime (scalar) | Có | `dueAt            DateTime?          @map("due_at")`  |
| submittedAt | DateTime (scalar) | Không | `submittedAt      DateTime           @default(now()) @map("submitted_at")`  |
| resolvedAt | DateTime (scalar) | Có | `resolvedAt       DateTime?          @map("resolved_at")`  |
| branch | Branch (object) | Không | `branch           Branch             @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| requester | User (object) | Không | `requester        User               @relation("BranchReviewRequester", fields: [requestedBy], references: [id], onDelete: Restrict)`  |
| reviewer | User (object) | Có | `reviewer         User?              @relation("BranchReviewReviewer", fields: [assignedTo], references: [id], onDelete: SetNull)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([branchId, submittedAt])`
- `@@index([status, submittedAt])`
- `@@map("branch_review_requests")`

## BranchReviewEvent

Bảng: `branch_review_events`; schema dòng 2052; miền Hồ sơ chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String              @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId   String              @map("branch_id")` **FK vật lý** |
| actorId | String (scalar) | Có | `actorId    String?             @map("actor_id")` **FK vật lý** |
| action | String (scalar) | Không | `action     String`  |
| fromStatus | BranchReviewStatus (enum) | Có | `fromStatus BranchReviewStatus? @map("from_status")`  |
| toStatus | BranchReviewStatus (enum) | Không | `toStatus   BranchReviewStatus  @map("to_status")`  |
| reason | String (scalar) | Có | `reason     String?`  |
| targetStep | Int (scalar) | Có | `targetStep Int?                @map("target_step")`  |
| deadline | DateTime (scalar) | Có | `deadline   DateTime?           @map("deadline")`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime            @default(now()) @map("created_at")`  |
| branch | Branch (object) | Không | `branch     Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)`  |
| actor | User (object) | Có | `actor      User?               @relation("BranchReviewActor", fields: [actorId], references: [id], onDelete: SetNull)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([branchId, createdAt])`
- `@@map("branch_review_events")`

## DocumentReviewEvent

Bảng: `document_review_events`; schema dòng 2070; miền Hồ sơ doanh nghiệp. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String                  @id @default(uuid())`  |
| documentId | String (scalar) | Không | `documentId String                  @map("document_id")` **FK vật lý** |
| actorId | String (scalar) | Có | `actorId    String?                 @map("actor_id")` **FK vật lý** |
| action | DocumentReviewAction (enum) | Không | `action     DocumentReviewAction`  |
| fromStatus | BusinessDocumentStatus (enum) | Có | `fromStatus BusinessDocumentStatus? @map("from_status")`  |
| toStatus | BusinessDocumentStatus (enum) | Không | `toStatus   BusinessDocumentStatus  @map("to_status")`  |
| reason | String (scalar) | Có | `reason     String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime                @default(now()) @map("created_at")`  |
| document | BusinessDocument (object) | Không | `document   BusinessDocument        @relation(fields: [documentId], references: [id], onDelete: Cascade)`  |
| actor | User (object) | Có | `actor      User?                   @relation("DocumentReviewActor", fields: [actorId], references: [id], onDelete: SetNull)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([documentId, createdAt])`
- `@@map("document_review_events")`

## ReviewReport

Bảng: `review_reports`; schema dòng 2086; miền Đánh giá. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String   @id @default(uuid())`  |
| reviewId | String (scalar) | Không | `reviewId   String   @map("review_id")` **FK vật lý** |
| reporterId | String (scalar) | Không | `reporterId String   @map("reporter_id")` **FK vật lý** |
| reason | String (scalar) | Không | `reason     String`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime @default(now()) @map("created_at")`  |
| review | Review (object) | Không | `review     Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)`  |
| reporter | User (object) | Không | `reporter   User     @relation("ReviewReporter", fields: [reporterId], references: [id])`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([reviewId, reporterId])`
- `@@index([reviewId, createdAt])`
- `@@map("review_reports")`

## DataSubjectRequest

Bảng: `data_subject_requests`; schema dòng 2112; miền Quyền dữ liệu và dịch vụ lưu. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                 String                   @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId         String                   @map("customer_id")` **FK vật lý** |
| type | DataSubjectRequestType (enum) | Không | `type               DataSubjectRequestType`  |
| status | DataSubjectRequestStatus (enum) | Không | `status             DataSubjectRequestStatus @default(RECEIVED)`  |
| reason | String (scalar) | Có | `reason             String?`  |
| identityVerifiedAt | DateTime (scalar) | Có | `identityVerifiedAt DateTime?                @map("identity_verified_at")`  |
| legalHoldReason | String (scalar) | Có | `legalHoldReason    String?                  @map("legal_hold_reason")`  |
| resolution | String (scalar) | Có | `resolution         String?`  |
| deadlineAt | DateTime (scalar) | Không | `deadlineAt         DateTime                 @map("deadline_at")`  |
| completedAt | DateTime (scalar) | Có | `completedAt        DateTime?                @map("completed_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt          DateTime                 @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt          DateTime                 @updatedAt @map("updated_at")`  |
| customer | CustomerProfile (object) | Không | `customer           CustomerProfile          @relation(fields: [customerId], references: [id], onDelete: Restrict)`  |
| exportPackage | PrivacyExportPackage (object) | Có | `exportPackage      PrivacyExportPackage?`  |

Khóa chính: id. Unique đơn: không.

- `@@index([customerId, createdAt])`
- `@@index([status, deadlineAt])`
- `@@map("data_subject_requests")`

## BranchStateTransition

Bảng: `branch_state_transitions`; schema dòng 2139; miền Chi nhánh. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                    String   @id @default(uuid())`  |
| branchId | String (scalar) | Không | `branchId              String   @map("branch_id")` **FK vật lý** |
| actorId | String (scalar) | Không | `actorId               String   @map("actor_id")` **FK vật lý** |
| fromStatus | String (scalar) | Không | `fromStatus            String   @map("from_status")`  |
| toStatus | String (scalar) | Không | `toStatus              String   @map("to_status")`  |
| fromReviewStatus | String (scalar) | Không | `fromReviewStatus      String   @map("from_review_status")`  |
| toReviewStatus | String (scalar) | Không | `toReviewStatus        String   @map("to_review_status")`  |
| fromOperationalStatus | String (scalar) | Không | `fromOperationalStatus String   @map("from_operational_status")`  |
| toOperationalStatus | String (scalar) | Không | `toOperationalStatus   String   @map("to_operational_status")`  |
| reason | String (scalar) | Không | `reason                String`  |
| version | Int (scalar) | Không | `version               Int`  |
| createdAt | DateTime (scalar) | Không | `createdAt             DateTime @default(now()) @map("created_at")`  |
| ref_branchId | Branch (object) | Không | `ref_branchId Branch @relation("Audit_BranchStateTransition_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_actorId | User (object) | Không | `ref_actorId User @relation("Audit_BranchStateTransition_actorId", fields: [actorId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([branchId, version])`
- `@@index([branchId, createdAt])`
- `@@map("branch_state_transitions")`

## PriceAdjustment

Bảng: `price_adjustments`; schema dòng 2160; miền Áp dụng ưu đãi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id            String                @id @default(uuid())`  |
| bookingId | String (scalar) | Có | `bookingId     String?               @map("booking_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId      String                @map("branch_id")` **FK vật lý** |
| customerId | String (scalar) | Có | `customerId    String?               @map("customer_id")` **FK vật lý** |
| type | PriceAdjustmentType (enum) | Không | `type          PriceAdjustmentType`  |
| sourceId | String (scalar) | Có | `sourceId      String?               @map("source_id")` (Không suy FK từ hậu tố Id) |
| sourceVersion | Int (scalar) | Có | `sourceVersion Int?                  @map("source_version")`  |
| label | String (scalar) | Không | `label         String`  |
| amount | Decimal (scalar) | Không | `amount        Decimal               @db.Decimal(12, 2)`  |
| allocation | Json (scalar) | Có | `allocation    Json?`  |
| ruleSnapshot | Json (scalar) | Không | `ruleSnapshot  Json                  @map("rule_snapshot")`  |
| status | PriceAdjustmentStatus (enum) | Không | `status        PriceAdjustmentStatus @default(RESERVED)`  |
| reservedAt | DateTime (scalar) | Không | `reservedAt    DateTime              @default(now()) @map("reserved_at")`  |
| appliedAt | DateTime (scalar) | Có | `appliedAt     DateTime?             @map("applied_at")`  |
| releasedAt | DateTime (scalar) | Có | `releasedAt    DateTime?             @map("released_at")`  |
| reversedAt | DateTime (scalar) | Có | `reversedAt    DateTime?             @map("reversed_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt     DateTime              @default(now()) @map("created_at")`  |
| ref_bookingId | Booking (object) | Có | `ref_bookingId Booking? @relation("Audit_PriceAdjustment_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_branchId | Branch (object) | Không | `ref_branchId Branch @relation("Audit_PriceAdjustment_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_customerId | CustomerProfile (object) | Có | `ref_customerId CustomerProfile? @relation("Audit_PriceAdjustment_customerId", fields: [customerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([bookingId, status])`
- `@@index([branchId, createdAt])`
- `@@index([sourceId, status])`
- `@@map("price_adjustments")`

## PromotionRedemption

Bảng: `promotion_redemptions`; schema dòng 2188; miền Áp dụng ưu đãi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id           String           @id @default(uuid())`  |
| promotionId | String (scalar) | Không | `promotionId  String           @map("promotion_id")` **FK vật lý** |
| bookingId | String (scalar) | Không | `bookingId    String           @map("booking_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId   String           @map("customer_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId     String           @map("branch_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount       Decimal          @db.Decimal(12, 2)`  |
| status | RedemptionStatus (enum) | Không | `status       RedemptionStatus @default(RESERVED)`  |
| ruleSnapshot | Json (scalar) | Không | `ruleSnapshot Json             @map("rule_snapshot")`  |
| reservedAt | DateTime (scalar) | Không | `reservedAt   DateTime         @default(now()) @map("reserved_at")`  |
| appliedAt | DateTime (scalar) | Có | `appliedAt    DateTime?        @map("applied_at")`  |
| releasedAt | DateTime (scalar) | Có | `releasedAt   DateTime?        @map("released_at")`  |
| reversedAt | DateTime (scalar) | Có | `reversedAt   DateTime?        @map("reversed_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt    DateTime         @default(now()) @map("created_at")`  |
| ref_promotionId | Promotion (object) | Không | `ref_promotionId Promotion @relation("Audit_PromotionRedemption_promotionId", fields: [promotionId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingId | Booking (object) | Không | `ref_bookingId Booking @relation("Audit_PromotionRedemption_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_customerId | CustomerProfile (object) | Không | `ref_customerId CustomerProfile @relation("Audit_PromotionRedemption_customerId", fields: [customerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_branchId | Branch (object) | Không | `ref_branchId Branch @relation("Audit_PromotionRedemption_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([promotionId, bookingId])`
- `@@index([promotionId, status])`
- `@@index([customerId, createdAt])`
- `@@map("promotion_redemptions")`

## VoucherRedemption

Bảng: `voucher_redemptions`; schema dòng 2213; miền Áp dụng ưu đãi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                String           @id @default(uuid())`  |
| voucherId | String (scalar) | Không | `voucherId         String           @map("voucher_id")` **FK vật lý** |
| customerVoucherId | String (scalar) | Có | `customerVoucherId String?          @map("customer_voucher_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId        String           @map("customer_id")` **FK vật lý** |
| bookingId | String (scalar) | Không | `bookingId         String           @map("booking_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId          String           @map("branch_id")` **FK vật lý** |
| amount | Decimal (scalar) | Không | `amount            Decimal          @db.Decimal(12, 2)`  |
| status | RedemptionStatus (enum) | Không | `status            RedemptionStatus @default(RESERVED)`  |
| ruleSnapshot | Json (scalar) | Không | `ruleSnapshot      Json             @map("rule_snapshot")`  |
| reservedAt | DateTime (scalar) | Không | `reservedAt        DateTime         @default(now()) @map("reserved_at")`  |
| appliedAt | DateTime (scalar) | Có | `appliedAt         DateTime?        @map("applied_at")`  |
| releasedAt | DateTime (scalar) | Có | `releasedAt        DateTime?        @map("released_at")`  |
| reversedAt | DateTime (scalar) | Có | `reversedAt        DateTime?        @map("reversed_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt         DateTime         @default(now()) @map("created_at")`  |
| ref_voucherId | Voucher (object) | Không | `ref_voucherId Voucher @relation("Audit_VoucherRedemption_voucherId", fields: [voucherId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_customerVoucherId | CustomerVoucher (object) | Có | `ref_customerVoucherId CustomerVoucher? @relation("Audit_VoucherRedemption_customerVoucherId", fields: [customerVoucherId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_customerId | CustomerProfile (object) | Không | `ref_customerId CustomerProfile @relation("Audit_VoucherRedemption_customerId", fields: [customerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingId | Booking (object) | Không | `ref_bookingId Booking @relation("Audit_VoucherRedemption_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_branchId | Branch (object) | Không | `ref_branchId Branch @relation("Audit_VoucherRedemption_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([voucherId, bookingId])`
- `@@index([voucherId, customerId, status])`
- `@@index([bookingId, status])`
- `@@map("voucher_redemptions")`

## ServiceVariant

Bảng: `service_variants`; schema dòng 2240; miền Biến thể và phụ thuộc. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                   String           @id @default(uuid())`  |
| serviceId | String (scalar) | Không | `serviceId            String           @map("service_id")` **FK vật lý** |
| code | String (scalar) | Không | `code                 String`  |
| name | String (scalar) | Không | `name                 String`  |
| description | String (scalar) | Có | `description          String?`  |
| priceType | ServicePriceType (enum) | Không | `priceType            ServicePriceType @default(FIXED) @map("price_type")`  |
| price | Decimal (scalar) | Có | `price                Decimal?         @db.Decimal(12, 2)`  |
| maxPrice | Decimal (scalar) | Có | `maxPrice             Decimal?         @map("max_price") @db.Decimal(12, 2)`  |
| durationMinutes | Int (scalar) | Có | `durationMinutes      Int?             @map("duration_minutes")`  |
| maxDurationMinutes | Int (scalar) | Có | `maxDurationMinutes   Int?             @map("max_duration_minutes")`  |
| bufferBeforeMinutes | Int (scalar) | Không | `bufferBeforeMinutes  Int              @default(0) @map("buffer_before_minutes")`  |
| bufferAfterMinutes | Int (scalar) | Không | `bufferAfterMinutes   Int              @default(0) @map("buffer_after_minutes")`  |
| consultationRequired | Boolean (scalar) | Không | `consultationRequired Boolean          @default(false) @map("consultation_required")`  |
| eligibilityRules | Json (scalar) | Có | `eligibilityRules     Json?            @map("eligibility_rules")`  |
| status | ServiceStatus (enum) | Không | `status               ServiceStatus    @default(ACTIVE)`  |
| version | Int (scalar) | Không | `version              Int              @default(1)`  |
| createdAt | DateTime (scalar) | Không | `createdAt            DateTime         @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt            DateTime         @updatedAt @map("updated_at")`  |
| deletedAt | DateTime (scalar) | Có | `deletedAt            DateTime?        @map("deleted_at")`  |
| ref_serviceId | BranchServiceOffering (object) | Không | `ref_serviceId BranchServiceOffering @relation("Audit_ServiceVariant_serviceId", fields: [serviceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| refs_ServicePriceRule_variantId | ServicePriceRule[] (object) | Không | `refs_ServicePriceRule_variantId ServicePriceRule[] @relation("Audit_ServicePriceRule_variantId")`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([serviceId, code])`
- `@@index([serviceId, status, deletedAt])`
- `@@map("service_variants")`

## ServicePriceRule

Bảng: `service_price_rules`; schema dòng 2268; miền Biến thể và phụ thuộc. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id              String       @id @default(uuid())`  |
| serviceId | String (scalar) | Không | `serviceId       String       @map("service_id")` **FK vật lý** |
| variantId | String (scalar) | Có | `variantId       String?      @map("variant_id")` **FK vật lý** |
| name | String (scalar) | Không | `name            String`  |
| priority | Int (scalar) | Không | `priority        Int          @default(100)`  |
| adjustmentType | DiscountType (enum) | Không | `adjustmentType  DiscountType @map("adjustment_type")`  |
| adjustmentValue | Decimal (scalar) | Không | `adjustmentValue Decimal      @map("adjustment_value") @db.Decimal(12, 2)`  |
| conditions | Json (scalar) | Không | `conditions      Json`  |
| active | Boolean (scalar) | Không | `active          Boolean      @default(true)`  |
| validFrom | DateTime (scalar) | Có | `validFrom       DateTime?    @map("valid_from")`  |
| validTo | DateTime (scalar) | Có | `validTo         DateTime?    @map("valid_to")`  |
| version | Int (scalar) | Không | `version         Int          @default(1)`  |
| createdAt | DateTime (scalar) | Không | `createdAt       DateTime     @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt       DateTime     @updatedAt @map("updated_at")`  |
| ref_serviceId | BranchServiceOffering (object) | Không | `ref_serviceId BranchServiceOffering @relation("Audit_ServicePriceRule_serviceId", fields: [serviceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_variantId | ServiceVariant (object) | Có | `ref_variantId ServiceVariant? @relation("Audit_ServicePriceRule_variantId", fields: [variantId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([serviceId, active, priority])`
- `@@map("service_price_rules")`

## ServiceDependency

Bảng: `service_dependencies`; schema dòng 2290; miền Biến thể và phụ thuộc. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                String                @id @default(uuid())`  |
| serviceId | String (scalar) | Không | `serviceId         String                @map("service_id")` **FK vật lý** |
| requiredServiceId | String (scalar) | Không | `requiredServiceId String                @map("required_service_id")` **FK vật lý** |
| dependencyType | ServiceDependencyType (enum) | Không | `dependencyType    ServiceDependencyType @map("dependency_type")`  |
| createdAt | DateTime (scalar) | Không | `createdAt         DateTime              @default(now()) @map("created_at")`  |
| ref_serviceId | BranchServiceOffering (object) | Không | `ref_serviceId BranchServiceOffering @relation("Audit_ServiceDependency_serviceId", fields: [serviceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_requiredServiceId | BranchServiceOffering (object) | Không | `ref_requiredServiceId BranchServiceOffering @relation("Audit_ServiceDependency_requiredServiceId", fields: [requiredServiceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([serviceId, requiredServiceId, dependencyType])`
- `@@map("service_dependencies")`

## BookingServiceAdjustment

Bảng: `booking_service_adjustments`; schema dòng 2303; miền Lịch và phần dịch vụ. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String            @id @default(uuid())`  |
| bookingServiceId | String (scalar) | Không | `bookingServiceId String            @map("booking_service_id")` **FK vật lý** |
| bookingId | String (scalar) | Không | `bookingId        String            @map("booking_id")` **FK vật lý** |
| actorId | String (scalar) | Không | `actorId          String            @map("actor_id")` **FK vật lý** |
| action | BookingItemAction (enum) | Không | `action           BookingItemAction`  |
| reason | String (scalar) | Không | `reason           String`  |
| beforeSnapshot | Json (scalar) | Không | `beforeSnapshot   Json              @map("before_snapshot")`  |
| afterSnapshot | Json (scalar) | Không | `afterSnapshot    Json              @map("after_snapshot")`  |
| amountDelta | Decimal (scalar) | Không | `amountDelta      Decimal           @default(0) @map("amount_delta") @db.Decimal(12, 2)`  |
| version | Int (scalar) | Không | `version          Int`  |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime          @default(now()) @map("created_at")`  |
| ref_bookingServiceId | BookingService (object) | Không | `ref_bookingServiceId BookingService @relation("Audit_BookingServiceAdjustment_bookingServiceId", fields: [bookingServiceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingId | Booking (object) | Không | `ref_bookingId Booking @relation("Audit_BookingServiceAdjustment_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_actorId | User (object) | Không | `ref_actorId User @relation("Audit_BookingServiceAdjustment_actorId", fields: [actorId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([bookingServiceId, version])`
- `@@index([bookingId, createdAt])`
- `@@map("booking_service_adjustments")`

## OperationalImpactCase

Bảng: `operational_impact_cases`; schema dòng 2324; miền Giám sát và tác động. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id          String            @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId  String            @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId    String?           @map("branch_id")` **FK vật lý** |
| subjectType | ImpactSubjectType (enum) | Không | `subjectType ImpactSubjectType @map("subject_type")`  |
| subjectId | String (scalar) | Không | `subjectId   String            @map("subject_id")` (Không suy FK từ hậu tố Id) |
| action | ImpactAction (enum) | Không | `action      ImpactAction`  |
| status | ImpactCaseStatus (enum) | Không | `status      ImpactCaseStatus  @default(OPEN)`  |
| reason | String (scalar) | Không | `reason      String`  |
| ownerId | String (scalar) | Không | `ownerId     String            @map("owner_id")` **FK vật lý** |
| deadlineAt | DateTime (scalar) | Không | `deadlineAt  DateTime          @map("deadline_at")`  |
| createdBy | String (scalar) | Không | `createdBy   String            @map("created_by")` **FK vật lý** |
| completedAt | DateTime (scalar) | Có | `completedAt DateTime?         @map("completed_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt   DateTime          @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt   DateTime          @updatedAt @map("updated_at")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_OperationalImpactCase_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_branchId | Branch (object) | Có | `ref_branchId Branch? @relation("Audit_OperationalImpactCase_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_ownerId | User (object) | Không | `ref_ownerId User @relation("Audit_OperationalImpactCase_ownerId", fields: [ownerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_createdBy | User (object) | Không | `ref_createdBy User @relation("Audit_OperationalImpactCase_createdBy", fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| refs_OperationalImpactItem_caseId | OperationalImpactItem[] (object) | Không | `refs_OperationalImpactItem_caseId OperationalImpactItem[] @relation("Audit_OperationalImpactItem_caseId")`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId, status, deadlineAt])`
- `@@index([subjectType, subjectId, status])`
- `@@map("operational_impact_cases")`

## OperationalImpactItem

Bảng: `operational_impact_items`; schema dòng 2350; miền Giám sát và tác động. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                  String            @id @default(uuid())`  |
| caseId | String (scalar) | Không | `caseId              String            @map("case_id")` **FK vật lý** |
| bookingId | String (scalar) | Không | `bookingId           String            @map("booking_id")` **FK vật lý** |
| resolution | ImpactResolution (enum) | Có | `resolution          ImpactResolution?`  |
| status | ImpactItemStatus (enum) | Không | `status              ImpactItemStatus  @default(PENDING)`  |
| replacementStaffId | String (scalar) | Có | `replacementStaffId  String?           @map("replacement_staff_id")` **FK vật lý** |
| replacementBranchId | String (scalar) | Có | `replacementBranchId String?           @map("replacement_branch_id")` **FK vật lý** |
| proposedStartAt | DateTime (scalar) | Có | `proposedStartAt     DateTime?         @map("proposed_start_at")`  |
| reason | String (scalar) | Có | `reason              String?`  |
| resolvedBy | String (scalar) | Có | `resolvedBy          String?           @map("resolved_by")` **FK vật lý** |
| resolvedAt | DateTime (scalar) | Có | `resolvedAt          DateTime?         @map("resolved_at")`  |
| financialSnapshot | Json (scalar) | Có | `financialSnapshot   Json?             @map("financial_snapshot")`  |
| createdAt | DateTime (scalar) | Không | `createdAt           DateTime          @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt           DateTime          @updatedAt @map("updated_at")`  |
| ref_caseId | OperationalImpactCase (object) | Không | `ref_caseId OperationalImpactCase @relation("Audit_OperationalImpactItem_caseId", fields: [caseId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingId | Booking (object) | Không | `ref_bookingId Booking @relation("Audit_OperationalImpactItem_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_replacementStaffId | StaffProfile (object) | Có | `ref_replacementStaffId StaffProfile? @relation("Audit_OperationalImpactItem_replacementStaffId", fields: [replacementStaffId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_replacementBranchId | Branch (object) | Có | `ref_replacementBranchId Branch? @relation("Audit_OperationalImpactItem_replacementBranchId", fields: [replacementBranchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_resolvedBy | User (object) | Có | `ref_resolvedBy User? @relation("Audit_OperationalImpactItem_resolvedBy", fields: [resolvedBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([caseId, bookingId])`
- `@@index([caseId, status])`
- `@@index([bookingId])`
- `@@map("operational_impact_items")`

## WaitlistEntry

Bảng: `waitlist_entries`; schema dòng 2377; miền DI SẢN: điểm thưởng và danh sách chờ. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String         @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId     String         @map("customer_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId     String         @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId       String         @map("branch_id")` **FK vật lý** |
| serviceId | String (scalar) | Không | `serviceId      String         @map("service_id")` **FK vật lý** |
| staffId | String (scalar) | Có | `staffId        String?        @map("staff_id")` **FK vật lý** |
| windowStart | DateTime (scalar) | Không | `windowStart    DateTime       @map("window_start")`  |
| windowEnd | DateTime (scalar) | Không | `windowEnd      DateTime       @map("window_end")`  |
| status | WaitlistStatus (enum) | Không | `status         WaitlistStatus @default(WAITING)`  |
| offeredStartAt | DateTime (scalar) | Có | `offeredStartAt DateTime?      @map("offered_start_at")`  |
| offerExpiresAt | DateTime (scalar) | Có | `offerExpiresAt DateTime?      @map("offer_expires_at")`  |
| offerTokenHash | String (scalar) | Có | `offerTokenHash String?        @unique @map("offer_token_hash")`  |
| offerSlotKey | String (scalar) | Có | `offerSlotKey   String?        @unique @map("offer_slot_key")`  |
| bookingId | String (scalar) | Có | `bookingId      String?        @unique @map("booking_id")` **FK vật lý** |
| acceptedAt | DateTime (scalar) | Có | `acceptedAt     DateTime?      @map("accepted_at")`  |
| cancelledAt | DateTime (scalar) | Có | `cancelledAt    DateTime?      @map("cancelled_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime       @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime       @updatedAt @map("updated_at")`  |
| ref_customerId | CustomerProfile (object) | Không | `ref_customerId CustomerProfile @relation("Audit_WaitlistEntry_customerId", fields: [customerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_WaitlistEntry_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_branchId | Branch (object) | Không | `ref_branchId Branch @relation("Audit_WaitlistEntry_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_serviceId | BranchServiceOffering (object) | Không | `ref_serviceId BranchServiceOffering @relation("Audit_WaitlistEntry_serviceId", fields: [serviceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_staffId | StaffProfile (object) | Có | `ref_staffId StaffProfile? @relation("Audit_WaitlistEntry_staffId", fields: [staffId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingId | Booking (object) | Có | `ref_bookingId Booking? @relation("Audit_WaitlistEntry_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: offerTokenHash, offerSlotKey, bookingId.

- `@@index([branchId, serviceId, status, createdAt])`
- `@@index([customerId, status])`
- `@@index([offerExpiresAt, status])`
- `@@map("waitlist_entries")`

## ReviewModerationEvent

Bảng: `review_moderation_events`; schema dòng 2409; miền Kiểm duyệt và khiếu nại. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String                 @id @default(uuid())`  |
| reviewId | String (scalar) | Không | `reviewId       String                 @map("review_id")` **FK vật lý** |
| actorId | String (scalar) | Không | `actorId        String                 @map("actor_id")` **FK vật lý** |
| action | ReviewModerationAction (enum) | Không | `action         ReviewModerationAction`  |
| fromStatus | ReviewStatus (enum) | Không | `fromStatus     ReviewStatus           @map("from_status")`  |
| toStatus | ReviewStatus (enum) | Không | `toStatus       ReviewStatus           @map("to_status")`  |
| reasonCode | String (scalar) | Không | `reasonCode     String                 @map("reason_code")`  |
| reason | String (scalar) | Không | `reason         String`  |
| reportCategory | String (scalar) | Có | `reportCategory String?                @map("report_category")`  |
| severity | String (scalar) | Có | `severity       String?`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime               @default(now()) @map("created_at")`  |
| ref_reviewId | Review (object) | Không | `ref_reviewId Review @relation("Audit_ReviewModerationEvent_reviewId", fields: [reviewId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_actorId | User (object) | Không | `ref_actorId User @relation("Audit_ReviewModerationEvent_actorId", fields: [actorId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([reviewId, createdAt])`
- `@@map("review_moderation_events")`

## ReviewAppeal

Bảng: `review_appeals`; schema dòng 2428; miền Kiểm duyệt và khiếu nại. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id          String             @id @default(uuid())`  |
| reviewId | String (scalar) | Không | `reviewId    String             @map("review_id")` **FK vật lý** |
| appellantId | String (scalar) | Không | `appellantId String             @map("appellant_id")` **FK vật lý** |
| reason | String (scalar) | Không | `reason      String`  |
| status | ReviewAppealStatus (enum) | Không | `status      ReviewAppealStatus @default(PENDING)`  |
| reviewedBy | String (scalar) | Có | `reviewedBy  String?            @map("reviewed_by")` **FK vật lý** |
| resolution | String (scalar) | Có | `resolution  String?`  |
| reviewedAt | DateTime (scalar) | Có | `reviewedAt  DateTime?          @map("reviewed_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt   DateTime           @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt   DateTime           @updatedAt @map("updated_at")`  |
| ref_reviewId | Review (object) | Không | `ref_reviewId Review @relation("Audit_ReviewAppeal_reviewId", fields: [reviewId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_appellantId | User (object) | Không | `ref_appellantId User @relation("Audit_ReviewAppeal_appellantId", fields: [appellantId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_reviewedBy | User (object) | Có | `ref_reviewedBy User? @relation("Audit_ReviewAppeal_reviewedBy", fields: [reviewedBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([reviewId, status])`
- `@@index([appellantId, createdAt])`
- `@@map("review_appeals")`

## LoyaltyRule

Bảng: `loyalty_rules`; schema dòng 2448; miền DI SẢN: điểm thưởng và danh sách chờ. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                      String    @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId              String    @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Có | `branchId                String?   @map("branch_id")` **FK vật lý** |
| version | Int (scalar) | Không | `version                 Int`  |
| earnPointsPerAmount | Int (scalar) | Không | `earnPointsPerAmount     Int       @map("earn_points_per_amount")`  |
| earnAmountUnit | Decimal (scalar) | Không | `earnAmountUnit          Decimal   @map("earn_amount_unit") @db.Decimal(12, 2)`  |
| redemptionValuePerPoint | Decimal (scalar) | Không | `redemptionValuePerPoint Decimal   @map("redemption_value_per_point") @db.Decimal(12, 2)`  |
| expiresAfterDays | Int (scalar) | Có | `expiresAfterDays        Int?      @map("expires_after_days")`  |
| active | Boolean (scalar) | Không | `active                  Boolean   @default(true)`  |
| validFrom | DateTime (scalar) | Không | `validFrom               DateTime  @map("valid_from")`  |
| validTo | DateTime (scalar) | Có | `validTo                 DateTime? @map("valid_to")`  |
| createdBy | String (scalar) | Không | `createdBy               String    @map("created_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt               DateTime  @default(now()) @map("created_at")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_LoyaltyRule_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_branchId | Branch (object) | Có | `ref_branchId Branch? @relation("Audit_LoyaltyRule_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_createdBy | User (object) | Không | `ref_createdBy User @relation("Audit_LoyaltyRule_createdBy", fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, branchId, version])`
- `@@index([businessId, active, validFrom])`
- `@@map("loyalty_rules")`

## LoyaltyAccount

Bảng: `loyalty_accounts`; schema dòng 2471; miền DI SẢN: điểm thưởng và danh sách chờ. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String   @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId String   @map("business_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId String   @map("customer_id")` **FK vật lý** |
| balance | Int (scalar) | Không | `balance    Int      @default(0)`  |
| version | Int (scalar) | Không | `version    Int      @default(0)`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt  DateTime @updatedAt @map("updated_at")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_LoyaltyAccount_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_customerId | CustomerProfile (object) | Không | `ref_customerId CustomerProfile @relation("Audit_LoyaltyAccount_customerId", fields: [customerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| refs_LoyaltyTransaction_accountId | LoyaltyTransaction[] (object) | Không | `refs_LoyaltyTransaction_accountId LoyaltyTransaction[] @relation("Audit_LoyaltyTransaction_accountId")`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, customerId])`
- `@@index([customerId, updatedAt])`
- `@@map("loyalty_accounts")`

## LoyaltyTransaction

Bảng: `loyalty_transactions`; schema dòng 2488; miền DI SẢN: điểm thưởng và danh sách chờ. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id              String                 @id @default(uuid())`  |
| accountId | String (scalar) | Không | `accountId       String                 @map("account_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId      String                 @map("business_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId      String                 @map("customer_id")` **FK vật lý** |
| bookingId | String (scalar) | Có | `bookingId       String?                @map("booking_id")` **FK vật lý** |
| refundRequestId | String (scalar) | Có | `refundRequestId String?                @map("refund_request_id")` **FK vật lý** |
| type | LoyaltyTransactionType (enum) | Không | `type            LoyaltyTransactionType`  |
| points | Int (scalar) | Không | `points          Int`  |
| balanceAfter | Int (scalar) | Không | `balanceAfter    Int                    @map("balance_after")`  |
| idempotencyKey | String (scalar) | Không | `idempotencyKey  String                 @unique @map("idempotency_key")`  |
| ruleSnapshot | Json (scalar) | Có | `ruleSnapshot    Json?                  @map("rule_snapshot")`  |
| expiresAt | DateTime (scalar) | Có | `expiresAt       DateTime?              @map("expires_at")`  |
| reversalOfId | String (scalar) | Có | `reversalOfId    String?                @map("reversal_of_id")` **FK vật lý** |
| reason | String (scalar) | Có | `reason          String?`  |
| createdBy | String (scalar) | Có | `createdBy       String?                @map("created_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt       DateTime               @default(now()) @map("created_at")`  |
| ref_accountId | LoyaltyAccount (object) | Không | `ref_accountId LoyaltyAccount @relation("Audit_LoyaltyTransaction_accountId", fields: [accountId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_LoyaltyTransaction_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_customerId | CustomerProfile (object) | Không | `ref_customerId CustomerProfile @relation("Audit_LoyaltyTransaction_customerId", fields: [customerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingId | Booking (object) | Có | `ref_bookingId Booking? @relation("Audit_LoyaltyTransaction_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_refundRequestId | RefundRequest (object) | Có | `ref_refundRequestId RefundRequest? @relation("Audit_LoyaltyTransaction_refundRequestId", fields: [refundRequestId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_reversalOfId | LoyaltyTransaction (object) | Có | `ref_reversalOfId LoyaltyTransaction? @relation("Audit_LoyaltyTransaction_reversalOfId", fields: [reversalOfId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| refs_LoyaltyTransaction_reversalOfId | LoyaltyTransaction[] (object) | Không | `refs_LoyaltyTransaction_reversalOfId LoyaltyTransaction[] @relation("Audit_LoyaltyTransaction_reversalOfId")`  |
| ref_createdBy | User (object) | Có | `ref_createdBy User? @relation("Audit_LoyaltyTransaction_createdBy", fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: idempotencyKey.

- `@@index([accountId, createdAt])`
- `@@index([businessId, customerId, createdAt])`
- `@@index([expiresAt, type])`
- `@@map("loyalty_transactions")`

## Invoice

Bảng: `invoices`; schema dòng 2520; miền DI SẢN: hóa đơn và phiếu thu. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                 String                     @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId         String                     @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId           String                     @map("branch_id")` **FK vật lý** |
| bookingId | String (scalar) | Có | `bookingId          String?                    @map("booking_id")` **FK vật lý** |
| paymentId | String (scalar) | Có | `paymentId          String?                    @map("payment_id")` **FK vật lý** |
| invoiceNumber | String (scalar) | Không | `invoiceNumber      String                     @map("invoice_number")`  |
| status | InvoiceStatus (enum) | Không | `status             InvoiceStatus              @default(DRAFT)`  |
| currency | String (scalar) | Không | `currency           String                     @default("VND")`  |
| subtotalAmount | Decimal (scalar) | Không | `subtotalAmount     Decimal                    @map("subtotal_amount") @db.Decimal(12, 2)`  |
| discountAmount | Decimal (scalar) | Không | `discountAmount     Decimal                    @default(0) @map("discount_amount") @db.Decimal(12, 2)`  |
| taxAmount | Decimal (scalar) | Không | `taxAmount          Decimal                    @default(0) @map("tax_amount") @db.Decimal(12, 2)`  |
| totalAmount | Decimal (scalar) | Không | `totalAmount        Decimal                    @map("total_amount") @db.Decimal(12, 2)`  |
| taxInclusive | Boolean (scalar) | Không | `taxInclusive       Boolean                    @default(true) @map("tax_inclusive")`  |
| taxRate | Decimal (scalar) | Không | `taxRate            Decimal                    @default(0) @map("tax_rate") @db.Decimal(5, 2)`  |
| buyerSnapshot | Json (scalar) | Có | `buyerSnapshot      Json?                      @map("buyer_snapshot")`  |
| sellerSnapshot | Json (scalar) | Không | `sellerSnapshot     Json                       @map("seller_snapshot")`  |
| version | Int (scalar) | Không | `version            Int                        @default(1)`  |
| replacesInvoiceId | String (scalar) | Có | `replacesInvoiceId  String?                    @unique @map("replaces_invoice_id")` **FK vật lý** |
| issuedAt | DateTime (scalar) | Có | `issuedAt           DateTime?                  @map("issued_at")`  |
| cancelledAt | DateTime (scalar) | Có | `cancelledAt        DateTime?                  @map("cancelled_at")`  |
| createdBy | String (scalar) | Không | `createdBy          String                     @map("created_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt          DateTime                   @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt          DateTime                   @updatedAt @map("updated_at")`  |
| replacesInvoice | Invoice (object) | Có | `replacesInvoice    Invoice?                   @relation("InvoiceReplacement", fields: [replacesInvoiceId], references: [id], onDelete: Restrict)`  |
| replacement | Invoice (object) | Có | `replacement        Invoice?                   @relation("InvoiceReplacement")`  |
| informationRequest | InvoiceInformationRequest (object) | Có | `informationRequest InvoiceInformationRequest?`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_Invoice_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_branchId | Branch (object) | Không | `ref_branchId Branch @relation("Audit_Invoice_branchId", fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingId | Booking (object) | Có | `ref_bookingId Booking? @relation("Audit_Invoice_bookingId", fields: [bookingId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_paymentId | Payment (object) | Có | `ref_paymentId Payment? @relation("Audit_Invoice_paymentId", fields: [paymentId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_createdBy | User (object) | Không | `ref_createdBy User @relation("Audit_Invoice_createdBy", fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| refs_InvoiceLine_invoiceId | InvoiceLine[] (object) | Không | `refs_InvoiceLine_invoiceId InvoiceLine[] @relation("Audit_InvoiceLine_invoiceId")`  |
| refs_InvoiceEvent_invoiceId | InvoiceEvent[] (object) | Không | `refs_InvoiceEvent_invoiceId InvoiceEvent[] @relation("Audit_InvoiceEvent_invoiceId")`  |

Khóa chính: id. Unique đơn: replacesInvoiceId.

- `@@unique([businessId, invoiceNumber])`
- `@@index([branchId, status, createdAt])`
- `@@index([bookingId])`
- `@@map("invoices")`

## InvoiceInformationRequest

Bảng: `invoice_information_requests`; schema dòng 2561; miền DI SẢN: hóa đơn và phiếu thu. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id             String               @id @default(uuid())`  |
| bookingId | String (scalar) | Không | `bookingId      String               @map("booking_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId     String               @map("customer_id")` **FK vật lý** |
| businessId | String (scalar) | Không | `businessId     String               @map("business_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId       String               @map("branch_id")` **FK vật lý** |
| invoiceId | String (scalar) | Có | `invoiceId      String?              @unique @map("invoice_id")` **FK vật lý** |
| status | InvoiceRequestStatus (enum) | Không | `status         InvoiceRequestStatus @default(PENDING)`  |
| buyerSnapshot | Json (scalar) | Không | `buyerSnapshot  Json                 @map("buyer_snapshot")`  |
| customerNote | String (scalar) | Có | `customerNote   String?              @map("customer_note")`  |
| resolutionNote | String (scalar) | Có | `resolutionNote String?              @map("resolution_note")`  |
| resolvedBy | String (scalar) | Có | `resolvedBy     String?              @map("resolved_by")`  |
| resolvedAt | DateTime (scalar) | Có | `resolvedAt     DateTime?            @map("resolved_at")`  |
| openKey | String (scalar) | Có | `openKey        String?              @unique @map("open_key")`  |
| idempotencyKey | String (scalar) | Không | `idempotencyKey String               @unique @map("idempotency_key")`  |
| createdAt | DateTime (scalar) | Không | `createdAt      DateTime             @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt      DateTime             @updatedAt @map("updated_at")`  |
| booking | Booking (object) | Không | `booking        Booking              @relation(fields: [bookingId], references: [id], onDelete: Restrict)`  |
| customer | CustomerProfile (object) | Không | `customer       CustomerProfile      @relation(fields: [customerId], references: [id], onDelete: Restrict)`  |
| business | Business (object) | Không | `business       Business             @relation(fields: [businessId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch         Branch               @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |
| invoice | Invoice (object) | Có | `invoice        Invoice?             @relation(fields: [invoiceId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: invoiceId, openKey, idempotencyKey.

- `@@index([customerId, createdAt])`
- `@@index([businessId, status, createdAt])`
- `@@index([branchId, status, createdAt])`
- `@@map("invoice_information_requests")`

## InvoiceLine

Bảng: `invoice_lines`; schema dòng 2590; miền DI SẢN: hóa đơn và phiếu thu. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id               String   @id @default(uuid())`  |
| invoiceId | String (scalar) | Không | `invoiceId        String   @map("invoice_id")` **FK vật lý** |
| bookingServiceId | String (scalar) | Có | `bookingServiceId String?  @map("booking_service_id")` **FK vật lý** |
| description | String (scalar) | Không | `description      String`  |
| quantity | Int (scalar) | Không | `quantity         Int      @default(1)`  |
| unitPrice | Decimal (scalar) | Không | `unitPrice        Decimal  @map("unit_price") @db.Decimal(12, 2)`  |
| discountAmount | Decimal (scalar) | Không | `discountAmount   Decimal  @default(0) @map("discount_amount") @db.Decimal(12, 2)`  |
| taxRate | Decimal (scalar) | Không | `taxRate          Decimal  @default(0) @map("tax_rate") @db.Decimal(5, 2)`  |
| taxAmount | Decimal (scalar) | Không | `taxAmount        Decimal  @default(0) @map("tax_amount") @db.Decimal(12, 2)`  |
| lineTotal | Decimal (scalar) | Không | `lineTotal        Decimal  @map("line_total") @db.Decimal(12, 2)`  |
| createdAt | DateTime (scalar) | Không | `createdAt        DateTime @default(now()) @map("created_at")`  |
| ref_invoiceId | Invoice (object) | Không | `ref_invoiceId Invoice @relation("Audit_InvoiceLine_invoiceId", fields: [invoiceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_bookingServiceId | BookingService (object) | Có | `ref_bookingServiceId BookingService? @relation("Audit_InvoiceLine_bookingServiceId", fields: [bookingServiceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([invoiceId])`
- `@@map("invoice_lines")`

## InvoiceEvent

Bảng: `invoice_events`; schema dòng 2609; miền DI SẢN: hóa đơn và phiếu thu. Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id        String   @id @default(uuid())`  |
| invoiceId | String (scalar) | Không | `invoiceId String   @map("invoice_id")` **FK vật lý** |
| actorId | String (scalar) | Không | `actorId   String   @map("actor_id")` **FK vật lý** |
| action | String (scalar) | Không | `action    String`  |
| reason | String (scalar) | Có | `reason    String?`  |
| snapshot | Json (scalar) | Không | `snapshot  Json`  |
| createdAt | DateTime (scalar) | Không | `createdAt DateTime @default(now()) @map("created_at")`  |
| ref_invoiceId | Invoice (object) | Không | `ref_invoiceId Invoice @relation("Audit_InvoiceEvent_invoiceId", fields: [invoiceId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_actorId | User (object) | Không | `ref_actorId User @relation("Audit_InvoiceEvent_actorId", fields: [actorId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([invoiceId, createdAt])`
- `@@map("invoice_events")`

## OwnershipTransfer

Bảng: `ownership_transfers`; schema dòng 2624; miền Chuyển chủ và phiên bản. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                     String                  @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId             String                  @map("business_id")` **FK vật lý** |
| oldOwnerId | String (scalar) | Không | `oldOwnerId             String                  @map("old_owner_id")` **FK vật lý** |
| newOwnerUserId | String (scalar) | Không | `newOwnerUserId         String                  @map("new_owner_user_id")` **FK vật lý** |
| status | OwnershipTransferStatus (enum) | Không | `status                 OwnershipTransferStatus @default(DRAFT)`  |
| effectiveAt | DateTime (scalar) | Không | `effectiveAt            DateTime                @map("effective_at")`  |
| reason | String (scalar) | Không | `reason                 String`  |
| scopeSnapshot | Json (scalar) | Không | `scopeSnapshot          Json                    @map("scope_snapshot")`  |
| settlementAgreement | Json (scalar) | Có | `settlementAgreement    Json?                   @map("settlement_agreement")`  |
| impactSnapshot | Json (scalar) | Có | `impactSnapshot         Json?                   @map("impact_snapshot")`  |
| legalEntityVersionId | String (scalar) | Có | `legalEntityVersionId   String?                 @map("legal_entity_version_id")` **FK vật lý** |
| payoutAccountVersionId | String (scalar) | Có | `payoutAccountVersionId String?                 @map("payout_account_version_id")` **FK vật lý** |
| requestedBy | String (scalar) | Không | `requestedBy            String                  @map("requested_by")` **FK vật lý** |
| acceptedByNewOwnerAt | DateTime (scalar) | Có | `acceptedByNewOwnerAt   DateTime?               @map("accepted_by_new_owner_at")`  |
| approvedBy | String (scalar) | Có | `approvedBy             String?                 @map("approved_by")` **FK vật lý** |
| approvedAt | DateTime (scalar) | Có | `approvedAt             DateTime?               @map("approved_at")`  |
| completedAt | DateTime (scalar) | Có | `completedAt            DateTime?               @map("completed_at")`  |
| failureReason | String (scalar) | Có | `failureReason          String?                 @map("failure_reason")`  |
| createdAt | DateTime (scalar) | Không | `createdAt              DateTime                @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt              DateTime                @updatedAt @map("updated_at")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_OwnershipTransfer_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_oldOwnerId | BusinessOwnerProfile (object) | Không | `ref_oldOwnerId BusinessOwnerProfile @relation("Audit_OwnershipTransfer_oldOwnerId", fields: [oldOwnerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_newOwnerUserId | User (object) | Không | `ref_newOwnerUserId User @relation("Audit_OwnershipTransfer_newOwnerUserId", fields: [newOwnerUserId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_legalEntityVersionId | LegalEntityVersion (object) | Có | `ref_legalEntityVersionId LegalEntityVersion? @relation("Audit_OwnershipTransfer_legalEntityVersionId", fields: [legalEntityVersionId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_payoutAccountVersionId | PayoutAccountVersion (object) | Có | `ref_payoutAccountVersionId PayoutAccountVersion? @relation("Audit_OwnershipTransfer_payoutAccountVersionId", fields: [payoutAccountVersionId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_requestedBy | User (object) | Không | `ref_requestedBy User @relation("Audit_OwnershipTransfer_requestedBy", fields: [requestedBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_approvedBy | User (object) | Có | `ref_approvedBy User? @relation("Audit_OwnershipTransfer_approvedBy", fields: [approvedBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| refs_OwnershipHistory_transferId | OwnershipHistory[] (object) | Không | `refs_OwnershipHistory_transferId OwnershipHistory[] @relation("Audit_OwnershipHistory_transferId")`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId, status, effectiveAt])`
- `@@index([newOwnerUserId, status])`
- `@@map("ownership_transfers")`

## OwnershipHistory

Bảng: `ownership_history`; schema dòng 2659; miền Chuyển chủ và phiên bản. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String    @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId String    @map("business_id")` **FK vật lý** |
| ownerId | String (scalar) | Không | `ownerId    String    @map("owner_id")` **FK vật lý** |
| transferId | String (scalar) | Có | `transferId String?   @map("transfer_id")` **FK vật lý** |
| validFrom | DateTime (scalar) | Không | `validFrom  DateTime  @map("valid_from")`  |
| validTo | DateTime (scalar) | Có | `validTo    DateTime? @map("valid_to")`  |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime  @default(now()) @map("created_at")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_OwnershipHistory_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_ownerId | BusinessOwnerProfile (object) | Không | `ref_ownerId BusinessOwnerProfile @relation("Audit_OwnershipHistory_ownerId", fields: [ownerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_transferId | OwnershipTransfer (object) | Có | `ref_transferId OwnershipTransfer? @relation("Audit_OwnershipHistory_transferId", fields: [transferId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@index([businessId, validFrom])`
- `@@map("ownership_history")`

## LegalEntityVersion

Bảng: `legal_entity_versions`; schema dòng 2675; miền Chuyển chủ và phiên bản. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                 String    @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId         String    @map("business_id")` **FK vật lý** |
| version | Int (scalar) | Không | `version            Int`  |
| legalName | String (scalar) | Không | `legalName          String    @map("legal_name")`  |
| taxCode | String (scalar) | Có | `taxCode            String?   @map("tax_code")`  |
| registrationNumber | String (scalar) | Có | `registrationNumber String?   @map("registration_number")`  |
| representativeName | String (scalar) | Có | `representativeName String?   @map("representative_name")`  |
| verificationStatus | String (scalar) | Không | `verificationStatus String    @default("PENDING") @map("verification_status")`  |
| isActive | Boolean (scalar) | Không | `isActive           Boolean   @default(false) @map("is_active")`  |
| validFrom | DateTime (scalar) | Không | `validFrom          DateTime  @map("valid_from")`  |
| validTo | DateTime (scalar) | Có | `validTo            DateTime? @map("valid_to")`  |
| createdBy | String (scalar) | Không | `createdBy          String    @map("created_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt          DateTime  @default(now()) @map("created_at")`  |
| refs_OwnershipTransfer_legalEntityVersionId | OwnershipTransfer[] (object) | Không | `refs_OwnershipTransfer_legalEntityVersionId OwnershipTransfer[] @relation("Audit_OwnershipTransfer_legalEntityVersionId")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_LegalEntityVersion_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_createdBy | User (object) | Không | `ref_createdBy User @relation("Audit_LegalEntityVersion_createdBy", fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, version])`
- `@@index([businessId, validFrom])`
- `@@map("legal_entity_versions")`

## PayoutAccountVersion

Bảng: `payout_account_versions`; schema dòng 2698; miền Chuyển chủ và phiên bản. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                      String    @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId              String    @map("business_id")` **FK vật lý** |
| version | Int (scalar) | Không | `version                 Int`  |
| bankName | String (scalar) | Không | `bankName                String    @map("bank_name")`  |
| accountHolder | String (scalar) | Không | `accountHolder           String    @map("account_holder")`  |
| accountNumberCiphertext | String (scalar) | Không | `accountNumberCiphertext String    @map("account_number_ciphertext")`  |
| accountNumberIv | String (scalar) | Không | `accountNumberIv         String    @map("account_number_iv")`  |
| authenticationTag | String (scalar) | Không | `authenticationTag       String    @map("authentication_tag")`  |
| keyVersion | String (scalar) | Không | `keyVersion              String    @map("key_version")`  |
| maskedAccountNumber | String (scalar) | Không | `maskedAccountNumber     String    @map("masked_account_number")`  |
| verificationStatus | String (scalar) | Không | `verificationStatus      String    @default("PENDING") @map("verification_status")`  |
| isActive | Boolean (scalar) | Không | `isActive                Boolean   @default(false) @map("is_active")`  |
| validFrom | DateTime (scalar) | Không | `validFrom               DateTime  @map("valid_from")`  |
| validTo | DateTime (scalar) | Có | `validTo                 DateTime? @map("valid_to")`  |
| createdBy | String (scalar) | Không | `createdBy               String    @map("created_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt               DateTime  @default(now()) @map("created_at")`  |
| refs_OwnershipTransfer_payoutAccountVersionId | OwnershipTransfer[] (object) | Không | `refs_OwnershipTransfer_payoutAccountVersionId OwnershipTransfer[] @relation("Audit_OwnershipTransfer_payoutAccountVersionId")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_PayoutAccountVersion_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_createdBy | User (object) | Không | `ref_createdBy User @relation("Audit_PayoutAccountVersion_createdBy", fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, version])`
- `@@index([businessId, validFrom])`
- `@@map("payout_account_versions")`

## CustomerSavedService

Bảng: `customer_saved_services`; schema dòng 2724; miền Quyền dữ liệu và dịch vụ lưu. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                      String                @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId              String                @map("customer_id")` **FK vật lý** |
| branchServiceOfferingId | String (scalar) | Không | `branchServiceOfferingId String                @map("branch_service_offering_id")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt               DateTime              @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt               DateTime              @updatedAt @map("updated_at")`  |
| customer | CustomerProfile (object) | Không | `customer                CustomerProfile       @relation(fields: [customerId], references: [id], onDelete: Restrict)`  |
| offering | BranchServiceOffering (object) | Không | `offering                BranchServiceOffering @relation(fields: [branchServiceOfferingId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([customerId, branchServiceOfferingId])`
- `@@index([customerId, createdAt])`
- `@@map("customer_saved_services")`

## VoucherBranchScope

Bảng: `voucher_branch_scopes`; schema dòng 2738; miền Voucher và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| voucherId | String (scalar) | Không | `voucherId  String    @map("voucher_id")` **FK vật lý** |
| branchId | String (scalar) | Không | `branchId   String    @map("branch_id")` **FK vật lý** |
| voucher | Voucher (object) | Không | `voucher    Voucher   @relation(fields: [voucherId], references: [id], onDelete: Restrict)`  |
| branch | Branch (object) | Không | `branch     Branch    @relation(fields: [branchId], references: [id], onDelete: Restrict)`  |

Khóa chính: voucherId + branchId. Unique đơn: không.

- `@@id([voucherId, branchId])`
- `@@index([branchId])`
- `@@map("voucher_branch_scopes")`

## VoucherServiceScope

Bảng: `voucher_service_scopes`; schema dòng 2749; miền Voucher và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| voucherId | String (scalar) | Không | `voucherId String                @map("voucher_id")` **FK vật lý** |
| serviceId | String (scalar) | Không | `serviceId String                @map("service_id")` **FK vật lý** |
| voucher | Voucher (object) | Không | `voucher   Voucher               @relation(fields: [voucherId], references: [id], onDelete: Restrict)`  |
| service | BranchServiceOffering (object) | Không | `service   BranchServiceOffering @relation(fields: [serviceId], references: [id], onDelete: Restrict)`  |

Khóa chính: voucherId + serviceId. Unique đơn: không.

- `@@id([voucherId, serviceId])`
- `@@index([serviceId])`
- `@@map("voucher_service_scopes")`

## VoucherComboScope

Bảng: `voucher_combo_scopes`; schema dòng 2760; miền Voucher và phạm vi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| voucherId | String (scalar) | Không | `voucherId String  @map("voucher_id")` **FK vật lý** |
| comboId | String (scalar) | Không | `comboId   String  @map("combo_id")` **FK vật lý** |
| voucher | Voucher (object) | Không | `voucher   Voucher @relation(fields: [voucherId], references: [id], onDelete: Restrict)`  |
| combo | Combo (object) | Không | `combo     Combo   @relation(fields: [comboId], references: [id], onDelete: Restrict)`  |

Khóa chính: voucherId + comboId. Unique đơn: không.

- `@@id([voucherId, comboId])`
- `@@index([comboId])`
- `@@map("voucher_combo_scopes")`

## CustomerBusinessSegment

Bảng: `customer_business_segments`; schema dòng 2771; miền Áp dụng ưu đãi. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id         String   @id @default(uuid())`  |
| businessId | String (scalar) | Không | `businessId String   @map("business_id")` **FK vật lý** |
| customerId | String (scalar) | Không | `customerId String   @map("customer_id")` **FK vật lý** |
| segment | String (scalar) | Không | `segment    String`  |
| assignedBy | String (scalar) | Có | `assignedBy String?  @map("assigned_by")` **FK vật lý** |
| createdAt | DateTime (scalar) | Không | `createdAt  DateTime @default(now()) @map("created_at")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt  DateTime @updatedAt @map("updated_at")`  |
| ref_businessId | Business (object) | Không | `ref_businessId Business @relation("Audit_CustomerBusinessSegment_businessId", fields: [businessId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_customerId | CustomerProfile (object) | Không | `ref_customerId CustomerProfile @relation("Audit_CustomerBusinessSegment_customerId", fields: [customerId], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |
| ref_assignedBy | User (object) | Có | `ref_assignedBy User? @relation("Audit_CustomerBusinessSegment_assignedBy", fields: [assignedBy], references: [id], onDelete: Restrict, onUpdate: Cascade)`  |

Khóa chính: id. Unique đơn: không.

- `@@unique([businessId, customerId, segment])`
- `@@index([businessId, segment])`
- `@@map("customer_business_segments")`

## MarketingPreference

Bảng: `marketing_preferences`; schema dòng 2788; miền Quyền dữ liệu và dịch vụ lưu. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                     String          @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId             String          @unique @map("customer_id")` **FK vật lý** |
| emailMarketing | Boolean (scalar) | Không | `emailMarketing         Boolean         @default(false) @map("email_marketing")`  |
| smsMarketing | Boolean (scalar) | Không | `smsMarketing           Boolean         @default(false) @map("sms_marketing")`  |
| pushMarketing | Boolean (scalar) | Không | `pushMarketing          Boolean         @default(false) @map("push_marketing")`  |
| personalizedPromotions | Boolean (scalar) | Không | `personalizedPromotions Boolean         @default(false) @map("personalized_promotions")`  |
| updatedAt | DateTime (scalar) | Không | `updatedAt              DateTime        @updatedAt @map("updated_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt              DateTime        @default(now()) @map("created_at")`  |
| customer | CustomerProfile (object) | Không | `customer               CustomerProfile @relation(fields: [customerId], references: [id], onDelete: Cascade)`  |

Khóa chính: id. Unique đơn: customerId.

- `@@map("marketing_preferences")`

## PrivacyExportPackage

Bảng: `privacy_export_packages`; schema dòng 2802; miền Quyền dữ liệu và dịch vụ lưu. 

| Trường | Loại | Null | Ràng buộc/annotation nguồn |
|---|---|---|---|
| id | String (scalar) | Không | `id                String             @id @default(uuid())`  |
| customerId | String (scalar) | Không | `customerId        String             @map("customer_id")` **FK vật lý** |
| requestId | String (scalar) | Không | `requestId         String             @unique @map("request_id")` **FK vật lý** |
| downloadTokenHash | String (scalar) | Không | `downloadTokenHash String             @unique @map("download_token_hash")`  |
| payloadCiphertext | String (scalar) | Không | `payloadCiphertext String             @map("payload_ciphertext")`  |
| encryptionIv | String (scalar) | Không | `encryptionIv      String             @map("encryption_iv")`  |
| authenticationTag | String (scalar) | Không | `authenticationTag String             @map("authentication_tag")`  |
| keyVersion | String (scalar) | Không | `keyVersion        String             @map("key_version")`  |
| expiresAt | DateTime (scalar) | Không | `expiresAt         DateTime           @map("expires_at")`  |
| downloadedAt | DateTime (scalar) | Có | `downloadedAt      DateTime?          @map("downloaded_at")`  |
| createdAt | DateTime (scalar) | Không | `createdAt         DateTime           @default(now()) @map("created_at")`  |
| customer | CustomerProfile (object) | Không | `customer          CustomerProfile    @relation(fields: [customerId], references: [id], onDelete: Restrict)`  |
| request | DataSubjectRequest (object) | Không | `request           DataSubjectRequest @relation(fields: [requestId], references: [id], onDelete: Restrict)`  |

Khóa chính: id. Unique đơn: requestId, downloadTokenHash.

- `@@index([customerId, createdAt])`
- `@@index([expiresAt])`
- `@@map("privacy_export_packages")`

# Enum trong schema

## BookingViolationKind

LATE_CANCELLATION, NO_SHOW

## PriceAdjustmentType

PROMOTION, VOUCHER, LOYALTY, PACKAGE, MANUAL, SURCHARGE, REFUND

## PriceAdjustmentStatus

RESERVED, APPLIED, RELEASED, REVERSED

## RedemptionStatus

RESERVED, APPLIED, RELEASED, REVERSED

## ServicePriceType

FIXED, FROM, RANGE, QUOTE

## ServiceDependencyType

REQUIRED, ADD_ON, INCOMPATIBLE

## BookingItemAction

ADD, REMOVE, REASSIGN, RESIZE, START, COMPLETE, SKIP, REPRICE

## ImpactSubjectType

STAFF, BRANCH, BUSINESS, SCHEDULE

## ImpactAction

OFFBOARD, PAUSE, SUSPEND, CLOSE, SCHEDULE_CHANGE, TRANSFER

## ImpactCaseStatus

OPEN, IN_PROGRESS, READY_TO_COMPLETE, COMPLETED, CANCELLED

## ImpactResolution

REASSIGN, RESCHEDULE, TRANSFER_BRANCH, CANCEL_REFUND, APPROVED_EXCEPTION

## ImpactItemStatus

PENDING, PROCESSING, RESOLVED, FAILED

## WaitlistStatus

WAITING, OFFERED, ACCEPTED, EXPIRED, CANCELLED

## ReviewModerationAction

REPORT, QUARANTINE, APPROVE, HIDE, RESTORE, APPEAL_SUBMITTED, APPEAL_APPROVED, APPEAL_REJECTED

## ReviewAppealStatus

PENDING, APPROVED, REJECTED

## LoyaltyTransactionType

EARN, REDEEM, EXPIRE, REVERSE, REFUND_ADJUSTMENT, MANUAL_ADJUSTMENT

## InvoiceStatus

DRAFT, ISSUED, CANCELLED, ADJUSTED

## InvoiceRequestStatus

PENDING, FULFILLED, REJECTED, CANCELLED

## OwnershipTransferStatus

DRAFT, PENDING_NEW_OWNER_ACCEPTANCE, UNDER_REVIEW, NEED_MORE_INFO, APPROVED, SCHEDULED, EXECUTING, COMPLETED, REJECTED, CANCELLED, EXECUTION_FAILED

## RoleLevel

PLATFORM, TENANT, BRANCH, CUSTOMER

## AccountTokenType

EMAIL_VERIFICATION, PASSWORD_RESET

## AuthWorkspace

CUSTOMER, SALON, PLATFORM

## InvitationStatus

PENDING, ACCEPTED, REVOKED, EXPIRED

## TenantStatus

PENDING, ACTIVE, SUSPENDED, REJECTED

## SubscriptionTier

FREE, PRO, ENTERPRISE

## PermissionScope

PLATFORM, TENANT, BRANCH, SELF, PUBLIC

## UserStatus

ACTIVE, SUSPENDED, DELETED

## BookingLifecycleStatus

PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW

## RoleCode

PLATFORM_ADMIN, BUSINESS_OWNER, RECEPTIONIST, STAFF, CUSTOMER, GUEST

## CanonicalServiceStatus

ACTIVE, DEPRECATED, MERGED

## ServiceMappingStatus

MAPPED, UNMAPPED, SUGGESTED

## Gender

MALE, FEMALE, OTHER

## DevicePlatform

IOS, ANDROID, WEB

## BusinessStatus

DRAFT, PENDING, PENDING_REVIEW, NEED_MORE_INFO, APPROVED, ACTIVE, SUSPENDED, REJECTED

## BranchStatus

PENDING, ACTIVE, INACTIVE

## BranchReviewStatus

DRAFT, SUBMITTED, PENDING_REVIEW, NEED_MORE_INFO, APPROVED, REJECTED

## BranchOperationalStatus

INACTIVE, READY_TO_PUBLISH, ACTIVE, PAUSED, SUSPENDED, CLOSED, ARCHIVED

## BranchServiceMode

AT_LOCATION, MOBILE, BOTH

## BranchDocumentType

OPERATING_LICENSE, LOCATION_DOCUMENT, SERVICE_LICENSE, FIRE_SAFETY, OTHER

## BranchDocumentStatus

DRAFT, SUBMITTED, NEED_MORE_INFO, APPROVED, REJECTED, ARCHIVED

## StaffAssignmentStatus

ACTIVE, INACTIVE, ENDED

## StaffStatus

PROFILE_ONLY, INVITED, ACTIVE, LOCKED, INACTIVE

## ServiceStatus

ACTIVE, INACTIVE

## ComboStatus

ACTIVE, INACTIVE, PAUSED, EXPIRED

## ComboPricingMode

FIXED_PRICE

## ComboStaffAssignmentMode

SINGLE_PROVIDER, PER_SERVICE_PROVIDER

## BookingServiceStatus

SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, SKIPPED

## BusinessDocumentType

BUSINESS_LICENSE, OWNER_ID_CARD, TAX_DOCUMENT, OTHER

## BusinessDocumentStatus

DRAFT, SUBMITTED, NEED_MORE_INFO, APPROVED, REJECTED, ARCHIVED

## DocumentReviewAction

SUBMIT, APPROVE, REQUEST_INFO, REJECT, ARCHIVE

## MediaVisibility

PUBLIC, PRIVATE

## DiscountType

PERCENTAGE, FIXED_AMOUNT

## PromotionStatus

ACTIVE, INACTIVE, EXPIRED

## BookingStatus

PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW, REJECTED, EXPIRED

## BookingConfirmationMode

MANUAL_CONFIRMATION, AUTO_CONFIRMATION

## StaffAssignmentMode

CUSTOMER_SELECTS_STAFF, AUTO_ASSIGN_IF_ANY_STAFF, MANUAL_ASSIGN_BY_RECEPTIONIST

## BookingSource

ONLINE_WEB, ONLINE_APP, WALK_IN, PHONE, STAFF_CREATED, ADMIN_CREATED

## RecurrenceFrequency

WEEKLY, BIWEEKLY, MONTHLY

## RecurringPlanStatus

CREATING, ACTIVE, PAUSED, FAILED, CANCELLED, COMPLETED

## RecurringStaffMode

SAME_STAFF, ANY_AVAILABLE

## PaymentMethod

CASH, MOCK_ONLINE, BANK_TRANSFER, MOMO, VNPAY, ZALOPAY, CREDIT_CARD

## RefundStatus

PENDING, APPROVED, REJECTED, PROCESSING, REFUNDED, FAILED

## PaymentStatus

PENDING, PAID, PARTIALLY_PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED

## PolicyVersionStatus

DRAFT, ACTIVE, ARCHIVED

## DepositType

NONE, FIXED, PERCENTAGE, FULL_PREPAYMENT

## PaymentIntentStatus

CREATED, PENDING, REQUIRES_ACTION, SUCCEEDED, FAILED, CANCELLED, EXPIRED

## PaymentTransactionStatus

PENDING, VERIFIED, FAILED, REVERSED

## FinancialLedgerType

SERVICE_CHARGE, PACKAGE_CHARGE, PROMOTION, VOUCHER, PAYMENT_RECEIVED, REFUND, REVERSAL, ADJUSTMENT, PLATFORM_FEE, PLATFORM_FEE_ADJUSTMENT

## LedgerDirection

DEBIT, CREDIT

## PlatformFeeStatus

ACCRUED, STATEMENTED, ADJUSTED

## PlatformStatementStatus

DRAFT, REVIEW, ISSUED, PAID, OVERDUE

## StatementLineType

FEE, ADJUSTMENT

## TreatmentPackageStatus

ACTIVE, INACTIVE, ARCHIVED

## PackagePurchaseStatus

PENDING_PAYMENT, ACTIVE, COMPLETED, EXPIRED, CANCELLED

## PackageInstallmentStatus

DUE, PENDING, PAID, FAILED, WAIVED

## PackageEntitlementStatus

AVAILABLE, RESERVED, REDEEMED, RELEASED, EXPIRED

## ReviewStatus

PENDING, APPROVED, REPORTED, HIDDEN

## CommentStatus

VISIBLE, HIDDEN, DELETED

## NotificationType

BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_REMINDER, PROMOTION, SYSTEM, PAYMENT, BOOKING_RESCHEDULE_REQUEST, BOOKING_RESCHEDULE_APPROVED, BOOKING_RESCHEDULE_REJECTED, BOOKING_PAYMENT_RECEIVED, BOOKING_COMPLETED, REVIEW_REMINDER, SALON_VIOLATION_ALERT

## NotificationSeverity

INFO, SUCCESS, WARNING, CRITICAL

## NotificationOutboxStatus

PENDING, PROCESSING, SENT, FAILED

## VoucherAudience

ALL, NEW_CUSTOMER, RETURNING_CUSTOMER, BIRTHDAY, VIP, SELECTED

## AuditAction

READ, CREATE, UPDATE, DELETE, LOGIN, LOGOUT, STATUS_CHANGE, CANCEL, FORCE_CANCEL, REFUND, ESCALATION, POLICY_OVERRIDE

## TrustActionType

WARNING_SENT, EXPLANATION_REQUESTED, MONITORING_STARTED, BOOKING_RESTRICTED, SUSPENDED, RESTORED, NOTE_ADDED

## SalonMemberRole

OWNER, RECEPTIONIST

## CancelledByType

CUSTOMER, SALON, ADMIN, SYSTEM

## ChangeRequestType

RESCHEDULE, STAFF_CHANGE, CANCEL

## ChangeRequestStatus

PENDING, APPROVED, REJECTED, EXPIRED

## VoucherStatus

ACTIVE, RESERVED, USED, EXPIRED, REVOKED

## VoucherScope

PLATFORM, TENANT, CUSTOMER, COMPENSATION, CAMPAIGN

## DataSubjectRequestType

EXPORT, RECTIFICATION, ERASURE, RESTRICT_PROCESSING, OBJECT_PROCESSING, DELETE_ACCOUNT

## DataSubjectRequestStatus

RECEIVED, IDENTITY_VERIFICATION, IN_PROGRESS, COMPLETED, REJECTED

