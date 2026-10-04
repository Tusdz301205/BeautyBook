# Bằng chứng kiểm thử

Phân biệt kết quả chạy với nội dung assertion. PASS của mock không chứng minh constraint/lock của PostgreSQL thật. Danh sách tên dưới đây là chỉ mục; phạm vi assertion được phân tích trong ma trận và báo cáo, không suy ra coverage từ tên.

Backend: 93 suites, 92 pass/1 fail; 774/775 assertions pass, 1 fail; không pending/skipped trong tập đã chọn. Loại 7 integration suites trước khi chạy, không gọi đó là pass. Frontend: 7 file Node test, 57 pass/0 fail/0 skip. Mobile: chưa chạy test.

Log: [backend](backend-tests.log), [Jest JSON](backend-tests.json), [frontend](web-tests.log).

<a id="test-beauty-booking-api-main-src-admin-trust-snapshot-service-spec-ts"></a>

## beauty-booking-api-main/src/admin/trust-snapshot.service.spec.ts

[beauty-booking-api-main/src/admin/trust-snapshot.service.spec.ts:1](../../beauty-booking-api-main/src/admin/trust-snapshot.service.spec.ts) — **PASSED**.

- PASSED: TrustSnapshotService fairness customer-caused cancellation and no-show do not penalize the salon
- PASSED: TrustSnapshotService fairness restore returns a suspended business to its recorded prior lifecycle state

<a id="test-beauty-booking-api-main-src-app-controller-spec-ts"></a>

## beauty-booking-api-main/src/app.controller.spec.ts

[beauty-booking-api-main/src/app.controller.spec.ts:1](../../beauty-booking-api-main/src/app.controller.spec.ts) — **PASSED**.

- PASSED: AppController root should return "Hello World!"

<a id="test-beauty-booking-api-main-src-auth-account-separation-spec-ts"></a>

## beauty-booking-api-main/src/auth/account-separation.spec.ts

[beauty-booking-api-main/src/auth/account-separation.spec.ts:1](../../beauty-booking-api-main/src/auth/account-separation.spec.ts) — **PASSED**.

- PASSED: Customer and operational account separation a real Customer retains self-booking and does not gain management permissions
- PASSED: Customer and operational account separation BUSINESS_OWNER cannot borrow Customer capabilities even through a legacy mixed principal
- PASSED: Customer and operational account separation RECEPTIONIST cannot borrow Customer capabilities even through a legacy mixed principal
- PASSED: Customer and operational account separation STAFF cannot borrow Customer capabilities even through a legacy mixed principal
- PASSED: Customer and operational account separation PLATFORM_ADMIN cannot borrow Customer capabilities even through a legacy mixed principal
- PASSED: Customer and operational account separation a forged customer role does not override a salon-bound session
- PASSED: Customer and operational account separation granting CUSTOMER checks for the opposite active account domain
- PASSED: Customer and operational account separation granting BUSINESS_OWNER checks for the opposite active account domain
- PASSED: Customer and operational account separation granting RECEPTIONIST checks for the opposite active account domain
- PASSED: Customer and operational account separation granting STAFF checks for the opposite active account domain
- PASSED: Customer and operational account separation granting PLATFORM_ADMIN checks for the opposite active account domain

<a id="test-beauty-booking-api-main-src-auth-auth-workspace-spec-ts"></a>

## beauty-booking-api-main/src/auth/auth-workspace.spec.ts

[beauty-booking-api-main/src/auth/auth-workspace.spec.ts:1](../../beauty-booking-api-main/src/auth/auth-workspace.spec.ts) — **PASSED**.

- PASSED: workspace-bound authentication rejects a persisted retired Manager assignment without silently upgrading it
- PASSED: workspace-bound authentication requires exact branch scope for RECEPTIONIST
- PASSED: workspace-bound authentication requires exact branch scope for STAFF
- PASSED: workspace-bound authentication legacy mixed accounts only resolve their operational workspace
- PASSED: workspace-bound authentication cannot select CUSTOMER to bypass an operational role
- PASSED: workspace-bound authentication does not infer a Customer role from CustomerProfile
- PASSED: workspace-bound authentication does not fall back to Customer when an operational grant has an invalid scope
- PASSED: workspace-bound authentication does not leak customer or platform roles into a salon session
- PASSED: workspace-bound authentication rejects a salon business outside active scoped assignments

<a id="test-beauty-booking-api-main-src-auth-auth-controller-spec-ts"></a>

## beauty-booking-api-main/src/auth/auth.controller.spec.ts

[beauty-booking-api-main/src/auth/auth.controller.spec.ts:1](../../beauty-booking-api-main/src/auth/auth.controller.spec.ts) — **PASSED**.

- PASSED: AuthController refresh cookie development, request.secure=false login applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie development, request.secure=false register applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie development, request.secure=false refresh applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie development, request.secure=false logout clears the same cookie attributes without extending its lifetime
- PASSED: AuthController refresh cookie development, request.secure=true login applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie development, request.secure=true register applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie development, request.secure=true refresh applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie development, request.secure=true logout clears the same cookie attributes without extending its lifetime
- PASSED: AuthController refresh cookie production, request.secure=false login applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie production, request.secure=false register applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie production, request.secure=false refresh applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie production, request.secure=false logout clears the same cookie attributes without extending its lifetime
- PASSED: AuthController refresh cookie production, request.secure=true login applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie production, request.secure=true register applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie production, request.secure=true refresh applies the transport policy and omits the refresh token from JSON
- PASSED: AuthController refresh cookie production, request.secure=true logout clears the same cookie attributes without extending its lifetime
- PASSED: AuthController refresh cookie does not directly trust a forwarded protocol header when Express reports HTTP
- PASSED: AuthController refresh cookie decodes the refresh cookie before passing it to the token verifier
- PASSED: AuthController refresh cookie rejects malformed refresh-cookie encoding as an authentication error
- PASSED: AuthController refresh cookie preserves explicit body-token precedence for API clients
- PASSED: AuthController refresh cookie login returns a rotating token to explicit native body clients
- PASSED: AuthController refresh cookie register returns a rotating token to explicit native body clients
- PASSED: AuthController refresh cookie refresh returns a rotating token to explicit native body clients
- PASSED: AuthController refresh cookie does not return a cookie sourced refresh token to a body transport request

<a id="test-beauty-booking-api-main-src-auth-auth-service-spec-ts"></a>

## beauty-booking-api-main/src/auth/auth.service.spec.ts

[beauty-booking-api-main/src/auth/auth.service.spec.ts:1](../../beauty-booking-api-main/src/auth/auth.service.spec.ts) — **PASSED**.

- PASSED: AuthService registration creates a CUSTOMER role and customer profile by default
- PASSED: AuthService registration creates a BUSINESS_OWNER applicant with a non-public draft business
- PASSED: AuthService registration returns a conflict for an existing email
- PASSED: AuthService logout revokes the current persistent session and records a logout event

<a id="test-beauty-booking-api-main-src-auth-dto-auth-dto-spec-ts"></a>

## beauty-booking-api-main/src/auth/dto/auth.dto.spec.ts

[beauty-booking-api-main/src/auth/dto/auth.dto.spec.ts:1](../../beauty-booking-api-main/src/auth/dto/auth.dto.spec.ts) — **PASSED**.

- PASSED: RegisterDto normalizes customer registration fields
- PASSED: RegisterDto rejects a client-supplied role
- PASSED: RegisterDto rejects a weak password and an invalid Vietnamese phone number

<a id="test-beauty-booking-api-main-src-auth-token-blacklist-service-spec-ts"></a>

## beauty-booking-api-main/src/auth/token-blacklist.service.spec.ts

[beauty-booking-api-main/src/auth/token-blacklist.service.spec.ts:1](../../beauty-booking-api-main/src/auth/token-blacklist.service.spec.ts) — **PASSED**.

- PASSED: TokenBlacklistService production safety requires Redis in production instead of falling back to process memory
- PASSED: TokenBlacklistService production safety allows the in-memory fallback in development only

<a id="test-beauty-booking-api-main-src-bookings-available-slots-policy-spec-ts"></a>

## beauty-booking-api-main/src/bookings/available-slots-policy.spec.ts

[beauty-booking-api-main/src/bookings/available-slots-policy.spec.ts:1](../../beauty-booking-api-main/src/bookings/available-slots-policy.spec.ts) — **PASSED**.

- PASSED: Available slots respect the same advance policy as booking creation filters starts below two hours, retaining exact boundary (any staff=false)
- PASSED: Available slots respect the same advance policy as booking creation filters starts below two hours, retaining exact boundary (any staff=true)
- PASSED: Available slots respect the same advance policy as booking creation accepts exact maximum advance boundary, excludes later starts
- PASSED: Available slots respect the same advance policy as booking creation returns no slots beyond the maximum booking horizon
- PASSED: Available slots respect the same advance policy as booking creation zero lead time still rejects the current instant and past starts

<a id="test-beauty-booking-api-main-src-bookings-booking-item-lifecycle-spec-ts"></a>

## beauty-booking-api-main/src/bookings/booking-item-lifecycle.spec.ts

[beauty-booking-api-main/src/bookings/booking-item-lifecycle.spec.ts:1](../../beauty-booking-api-main/src/bookings/booking-item-lifecycle.spec.ts) — **PASSED**.

- PASSED: Terminal booking item lifecycle CANCELLED closes only unfinished items and returns the synchronized state
- PASSED: Terminal booking item lifecycle REJECTED closes only unfinished items and returns the synchronized state
- PASSED: Terminal booking item lifecycle EXPIRED closes only unfinished items and returns the synchronized state
- PASSED: Terminal booking item lifecycle child-update failure rolls back the parent and its history
- PASSED: Terminal booking item lifecycle a lost parent compare-and-set never cancels items
- PASSED: Terminal booking item lifecycle expire uses the same transactional cascade
- PASSED: Terminal booking item lifecycle compensate uses the same transactional cascade
- PASSED: Terminal booking item lifecycle cancel-series uses the same transactional cascade
- PASSED: Terminal booking item lifecycle cascade is idempotent for already terminal items

<a id="test-beauty-booking-api-main-src-bookings-booking-item-values-spec-ts"></a>

## beauty-booking-api-main/src/bookings/booking-item-values.spec.ts

[beauty-booking-api-main/src/bookings/booking-item-values.spec.ts:1](../../beauty-booking-api-main/src/bookings/booking-item-values.spec.ts) — **PASSED**.

- PASSED: Booking item numeric validation rejects malformed price undefined
- PASSED: Booking item numeric validation rejects malformed price null
- PASSED: Booking item numeric validation rejects malformed price "100"
- PASSED: Booking item numeric validation rejects malformed price NaN
- PASSED: Booking item numeric validation rejects malformed price Infinity
- PASSED: Booking item numeric validation rejects malformed price -Infinity
- PASSED: Booking item numeric validation rejects malformed price -1
- PASSED: Booking item numeric validation rejects malformed price 0.001
- PASSED: Booking item numeric validation rejects malformed price 10000000000.99
- PASSED: Booking item numeric validation rejects malformed price {}
- PASSED: Booking item numeric validation rejects malformed price true
- PASSED: Booking item numeric validation accepts storage-valid price 0
- PASSED: Booking item numeric validation accepts storage-valid price 0.01
- PASSED: Booking item numeric validation accepts storage-valid price 100000
- PASSED: Booking item numeric validation accepts storage-valid price 123.45
- PASSED: Booking item numeric validation accepts storage-valid price 9999999999.99
- PASSED: Booking item numeric validation rejects malformed duration undefined
- PASSED: Booking item numeric validation rejects malformed duration null
- PASSED: Booking item numeric validation rejects malformed duration "60"
- PASSED: Booking item numeric validation rejects malformed duration NaN
- PASSED: Booking item numeric validation rejects malformed duration Infinity
- PASSED: Booking item numeric validation rejects malformed duration -Infinity
- PASSED: Booking item numeric validation rejects malformed duration -1
- PASSED: Booking item numeric validation rejects malformed duration 0
- PASSED: Booking item numeric validation rejects malformed duration 1.5
- PASSED: Booking item numeric validation rejects malformed duration 2147483648
- PASSED: Booking item numeric validation rejects malformed duration {}
- PASSED: Booking item numeric validation rejects malformed duration true
- PASSED: Booking item numeric validation accepts integer minutes 1
- PASSED: Booking item numeric validation accepts integer minutes 60
- PASSED: Booking item numeric validation accepts integer minutes 135
- PASSED: Booking item numeric validation rejects unsafe update before starting a transaction: {"action": "REPRICE", "price": NaN}
- PASSED: Booking item numeric validation rejects unsafe update before starting a transaction: {"action": "REPRICE", "price": Infinity}
- PASSED: Booking item numeric validation rejects unsafe update before starting a transaction: {"action": "REPRICE", "price": null}
- PASSED: Booking item numeric validation rejects unsafe update before starting a transaction: {"action": "REPRICE"}
- PASSED: Booking item numeric validation rejects unsafe update before starting a transaction: {"action": "RESIZE", "durationMinutes": Infinity}
- PASSED: Booking item numeric validation rejects unsafe update before starting a transaction: {"action": "RESIZE", "durationMinutes": 1.5}
- PASSED: Booking item numeric validation rejects unsafe update before starting a transaction: {"action": "RESIZE", "durationMinutes": "60"}
- PASSED: Booking item numeric validation rejects unsafe add override before starting a transaction: {"price": null}
- PASSED: Booking item numeric validation rejects unsafe add override before starting a transaction: {"price": 0.001}
- PASSED: Booking item numeric validation rejects unsafe add override before starting a transaction: {"durationMinutes": null}
- PASSED: Booking item numeric validation rejects unsafe add override before starting a transaction: {"durationMinutes": 0.5}

<a id="test-beauty-booking-api-main-src-bookings-booking-role-refactor-spec-ts"></a>

## beauty-booking-api-main/src/bookings/booking-role-refactor.spec.ts

[beauty-booking-api-main/src/bookings/booking-role-refactor.spec.ts:1](../../beauty-booking-api-main/src/bookings/booking-role-refactor.spec.ts) — **PASSED**.

- PASSED: Booking responsibilities without Manager receptionist cancel is bound to its own branch
- PASSED: Booking responsibilities without Manager receptionist assign is bound to its own branch
- PASSED: Booking responsibilities without Manager receptionist reschedule is bound to its own branch
- PASSED: Booking responsibilities without Manager receptionist check_in is bound to its own branch
- PASSED: Booking responsibilities without Manager receptionist reads its full branch, not a separate staff assignment
- PASSED: Booking responsibilities without Manager an unrelated receptionist role cannot bypass assigned-staff checks
- PASSED: Booking responsibilities without Manager retired Manager cannot create, read, or update bookings
- PASSED: Booking responsibilities without Manager owner independently permits PENDING to CONFIRMED
- PASSED: Booking responsibilities without Manager owner independently permits CONFIRMED to NO_SHOW
- PASSED: Booking responsibilities without Manager owner independently permits CHECKED_IN to IN_PROGRESS
- PASSED: Booking responsibilities without Manager owner independently permits IN_PROGRESS to COMPLETED
- PASSED: Booking responsibilities without Manager owner independently permits IN_PROGRESS to CANCELLED
- PASSED: Booking responsibilities without Manager receptionist does not inherit owner service lifecycle or override authority
- PASSED: Booking responsibilities without Manager getByBranch exposes the counter workflow but not Manager
- PASSED: Booking responsibilities without Manager approveChangeRequest exposes the counter workflow but not Manager
- PASSED: Booking responsibilities without Manager rejectChangeRequest exposes the counter workflow but not Manager
- PASSED: Booking responsibilities without Manager pendingChangeRequests exposes the counter workflow but not Manager
- PASSED: Booking responsibilities without Manager resize stays owner-only while assignment and move keep scoped permissions
- PASSED: Booking responsibilities without Manager a receptionist role at another branch cannot add a service as assigned staff
- PASSED: Booking responsibilities without Manager an owner role in another tenant cannot authorize resize for a receptionist booking
- PASSED: Booking responsibilities without Manager owner-only booking metrics omit other roles and their tenant scopes
- PASSED: Booking responsibilities without Manager controller preserves exact staff authorization for START
- PASSED: Booking responsibilities without Manager controller preserves exact staff authorization for COMPLETE
- PASSED: Assigned service item authorization under transaction lock staff assigned another item cannot complete this item
- PASSED: Assigned service item authorization under transaction lock assigned staff can complete with optimistic revision check preserved

<a id="test-beauty-booking-api-main-src-bookings-bookings-access-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings-access.spec.ts

[beauty-booking-api-main/src/bookings/bookings-access.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings-access.spec.ts) — **PASSED**.

- PASSED: BookingsAccessService — cross-tenant blocking owner of tenant 2 cannot read a booking in tenant 1
- PASSED: BookingsAccessService — cross-tenant blocking owner of tenant 1 can read a booking in their own tenant
- PASSED: BookingsAccessService — cross-tenant blocking platform admin can read any tenant booking
- PASSED: BookingsAccessService — cross-tenant blocking platform admin cannot create a tenant booking
- PASSED: BookingsAccessService — cross-tenant blocking RECEPTIONIST cannot create at another branch of the same business
- PASSED: BookingsAccessService — cross-tenant blocking owner can create across their branches but not another business
- PASSED: BookingsAccessService — cross-tenant blocking a second assigned provider can update a multi-provider booking
- PASSED: BookingsAccessService — cross-tenant blocking platform refund operator can authorize a refund without force-cancel permission
- PASSED: BookingsAccessService — cross-tenant blocking staff can update an assigned booking
- PASSED: BookingsAccessService — cross-tenant blocking staff cannot update a booking assigned to another staff member
- PASSED: BookingsAccessService — cross-tenant blocking deleted booking throws NotFoundException
- PASSED: BookingsAccessService — cross-tenant blocking non-existent booking throws NotFoundException

<a id="test-beauty-booking-api-main-src-bookings-bookings-channel-policy-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings-channel-policy.spec.ts

[beauty-booking-api-main/src/bookings/bookings-channel-policy.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings-channel-policy.spec.ts) — **PASSED**.

- PASSED: Booking creation channel policy checks the recurring plan fence inside the booking transaction before inserting an occurrence
- PASSED: Booking creation channel policy rejects direct service creation for disabled WALK_IN
- PASSED: Booking creation channel policy rejects direct service creation for disabled PHONE
- PASSED: Booking creation channel policy rejects direct service creation for disabled STAFF_CREATED
- PASSED: Booking creation channel policy rechecks WALK_IN when policy changes during quote/availability calculation
- PASSED: Booking creation channel policy rechecks PHONE when policy changes during quote/availability calculation
- PASSED: Booking creation channel policy rechecks STAFF_CREATED when policy changes during quote/availability calculation
- PASSED: Booking creation channel policy rejects creation when the branch closes after the initial availability check

<a id="test-beauty-booking-api-main-src-bookings-bookings-tenant-scope-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings-tenant-scope.spec.ts

[beauty-booking-api-main/src/bookings/bookings-tenant-scope.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings-tenant-scope.spec.ts) — **PASSED**.

- PASSED: BookingsService fail-closed tenant filters keeps an explicitly empty branch scope on statistics queries
- PASSED: BookingsService fail-closed tenant filters applies an empty branch scope to category drill-down
- PASSED: BookingsService fail-closed tenant filters applies the allowed branches to customer drill-down

<a id="test-beauty-booking-api-main-src-bookings-bookings-time-guard-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings-time-guard.spec.ts

[beauty-booking-api-main/src/bookings/bookings-time-guard.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings-time-guard.spec.ts) — **PASSED**.

- PASSED: BookingsService time transition guard direct service call cannot complete a future booking
- PASSED: BookingsService time transition guard past booking completes without overwriting the discounted finalAmount snapshot
- PASSED: BookingsService time transition guard rejects a stale transition when another request already changed the status
- PASSED: BookingsService time transition guard confirmation commits a reserved voucher redemption in the same transaction
- PASSED: BookingsService time transition guard two competing transitions from one state commit exactly once

<a id="test-beauty-booking-api-main-src-bookings-bookings-voucher-lifecycle-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings-voucher-lifecycle.spec.ts

[beauty-booking-api-main/src/bookings/bookings-voucher-lifecycle.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings-voucher-lifecycle.spec.ts) — **PASSED**.

- PASSED: BookingsService voucher/combo reservation lifecycle expired pending hold releases voucher and combo capacity atomically
- PASSED: BookingsService voucher/combo reservation lifecycle does not release capacity when another worker already claimed the hold

<a id="test-beauty-booking-api-main-src-bookings-bookings-controller-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings.controller.spec.ts

[beauty-booking-api-main/src/bookings/bookings.controller.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings.controller.spec.ts) — **PASSED**.

- PASSED: Customer booking request projection preserves pending request metadata without exposing actor internals
- PASSED: BookingsController authenticated customer checkout rejects forged staff booking source ONLINE_WEB before creating a guest
- PASSED: BookingsController authenticated customer checkout rejects forged staff booking source ONLINE_APP before creating a guest
- PASSED: BookingsController authenticated customer checkout rejects forged staff booking source ADMIN_CREATED before creating a guest
- PASSED: BookingsController authenticated customer checkout rejects disabled channel WALK_IN before creating a guest
- PASSED: BookingsController authenticated customer checkout rejects disabled channel PHONE before creating a guest
- PASSED: BookingsController authenticated customer checkout rejects disabled channel STAFF_CREATED before creating a guest
- PASSED: BookingsController authenticated customer checkout customer booking uses the authenticated profile and online source regardless of client fields
- PASSED: BookingsController authenticated customer checkout preserves the mobile online booking source
- PASSED: BookingsController authenticated customer checkout keeps cancelled item status and historical service snapshot in the customer response
- PASSED: BookingsController authenticated customer checkout reuses the booking service for an authenticated customer
- PASSED: BookingsController authenticated customer checkout rejects an authenticated account without a customer profile

<a id="test-beauty-booking-api-main-src-bookings-bookings-scheduler-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings.scheduler.spec.ts

[beauty-booking-api-main/src/bookings/bookings.scheduler.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings.scheduler.spec.ts) — **PASSED**.

- PASSED: operational scheduler scope staff-only scheduler constrains staff and bookings and removes contact data
- PASSED: operational scheduler scope an explicitly empty branch scope returns no booking rows

<a id="test-beauty-booking-api-main-src-bookings-bookings-validation-spec-ts"></a>

## beauty-booking-api-main/src/bookings/bookings.validation.spec.ts

[beauty-booking-api-main/src/bookings/bookings.validation.spec.ts:1](../../beauty-booking-api-main/src/bookings/bookings.validation.spec.ts) — **PASSED**.

- PASSED: booking status authorization receptionist confirms and checks in but cannot complete service
- PASSED: booking status authorization staff starts checked-in work and completes in-progress work
- PASSED: booking status authorization customer may cancel but cannot confirm their own booking
- PASSED: booking status authorization global state machine requires CHECKED_IN before IN_PROGRESS
- PASSED: booking status time guard future CONFIRMED booking cannot check in
- PASSED: booking status time guard future CHECKED_IN booking cannot start service
- PASSED: booking status time guard future IN_PROGRESS booking cannot complete
- PASSED: booking status time guard past IN_PROGRESS booking can complete
- PASSED: booking status time guard CONFIRMED booking cannot be marked no-show during grace period
- PASSED: branch-based staff availability active skilled provider is valid without an individual schedule
- PASSED: branch-based staff availability branch closure blocks assignment
- PASSED: branch-based staff availability special branch opening overrides a closed holiday
- PASSED: branch-based staff availability profile disabled for booking cannot be assigned even when it has the skill
- PASSED: branch-based staff availability inactive linked account cannot receive a booking
- PASSED: date-aware booking overlap provider overlap uses item intervals and a date-aware legacy fallback
- PASSED: date-aware booking overlap customer overlap query uses half-open adjacent intervals on one date

<a id="test-beauty-booking-api-main-src-bookings-change-request-expiry-worker-spec-ts"></a>

## beauty-booking-api-main/src/bookings/change-request-expiry.worker.spec.ts

[beauty-booking-api-main/src/bookings/change-request-expiry.worker.spec.ts:1](../../beauty-booking-api-main/src/bookings/change-request-expiry.worker.spec.ts) — **PASSED**.

- PASSED: ChangeRequestExpiryWorker expires only overdue pending requests without any user interaction
- PASSED: ChangeRequestExpiryWorker runs at startup and every minute, and stops on shutdown
- PASSED: ChangeRequestExpiryWorker does not overlap slow ticks and retries after database failure

<a id="test-beauty-booking-api-main-src-bookings-change-requests-service-spec-ts"></a>

## beauty-booking-api-main/src/bookings/change-requests.service.spec.ts

[beauty-booking-api-main/src/bookings/change-requests.service.spec.ts:1](../../beauty-booking-api-main/src/bookings/change-requests.service.spec.ts) — **PASSED**.

- PASSED: ChangeRequestsService expiration and concurrency does not create a second active pending request for one booking
- PASSED: ChangeRequestsService expiration and concurrency expired request cannot be approved and is lazily marked expired
- PASSED: ChangeRequestsService expiration and concurrency pending list expires stale rows and excludes them from the query
- PASSED: ChangeRequestsService expiration and concurrency pending list prefers explicit branch scope over tenant-wide scope
- PASSED: ChangeRequestsService expiration and concurrency approved cancellation closes unfinished items before returning the booking detail

<a id="test-beauty-booking-api-main-src-bookings-customer-booking-policy-integration-spec-ts"></a>

## beauty-booking-api-main/src/bookings/customer-booking-policy.integration.spec.ts

[beauty-booking-api-main/src/bookings/customer-booking-policy.integration.spec.ts:1](../../beauty-booking-api-main/src/bookings/customer-booking-policy.integration.spec.ts) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-api-main-src-bookings-customer-booking-policy-spec-ts"></a>

## beauty-booking-api-main/src/bookings/customer-booking-policy.spec.ts

[beauty-booking-api-main/src/bookings/customer-booking-policy.spec.ts:1](../../beauty-booking-api-main/src/bookings/customer-booking-policy.spec.ts) — **PASSED**.

- PASSED: Customer booking warning/restriction score 0 never blocks or requires acknowledgment
- PASSED: Customer booking warning/restriction score 1 never blocks or requires acknowledgment
- PASSED: Customer booking warning/restriction score 2 never blocks or requires acknowledgment
- PASSED: Customer booking warning/restriction score 3 rejects non-explicit ack false
- PASSED: Customer booking warning/restriction score 3 rejects non-explicit ack undefined
- PASSED: Customer booking warning/restriction score 3 rejects non-explicit ack null
- PASSED: Customer booking warning/restriction score 3 rejects non-explicit ack true
- PASSED: Customer booking warning/restriction score 3 rejects non-explicit ack 1
- PASSED: Customer booking warning/restriction score 3 accepts true and records business-bound evidence
- PASSED: Customer booking warning/restriction active restriction denies even true acknowledgment
- PASSED: Customer booking warning/restriction exact expiry with score >=4 allows booking and GET never writes a restriction
- PASSED: Customer booking warning/restriction restriction expiring while waiting on the fence uses time after the wait
- PASSED: Customer booking warning/restriction score query is exact business/customer, inclusive 90-day window, excludes VOID/future
- PASSED: Customer booking warning/restriction new event 3 -> 4 activates exactly 30 days
- PASSED: Customer booking warning/restriction no-show has weight 2 and two events reach 4
- PASSED: Customer booking warning/restriction exact 90-day boundary counts but older event does not
- PASSED: Customer booking warning/restriction new event extends active restriction even if old score aged out
- PASSED: Customer booking warning/restriction no event after expiry does not restart; next qualifying event does
- PASSED: Customer booking warning/restriction VOID recomputes dependent restriction, not just current score
- PASSED: Customer booking warning/restriction out of order processing cannot shorten an extension
- PASSED: Customer booking warning/restriction legacy events count towards a new violation but never backfill a restriction
- PASSED: Customer booking warning/restriction DTO cannot coerce acknowledgment true into acceptance
- PASSED: Customer booking warning/restriction DTO cannot coerce acknowledgment false into acceptance
- PASSED: Customer booking warning/restriction DTO cannot coerce acknowledgment 1 into acceptance

<a id="test-beauty-booking-api-main-src-bookings-customer-cancellation-policy-spec-ts"></a>

## beauty-booking-api-main/src/bookings/customer-cancellation-policy.spec.ts

[beauty-booking-api-main/src/bookings/customer-cancellation-policy.spec.ts:1](../../beauty-booking-api-main/src/bookings/customer-cancellation-policy.spec.ts) — **PASSED**.

- PASSED: Fixed four-hour customer cancellation allows 14400000 ms before start
- PASSED: Fixed four-hour customer cancellation allows 14400001 ms before start
- PASSED: Fixed four-hour customer cancellation allows 86400000 ms before start
- PASSED: Fixed four-hour customer cancellation rejects 14399999 ms before start
- PASSED: Fixed four-hour customer cancellation rejects 3600000 ms before start
- PASSED: Fixed four-hour customer cancellation rejects 1 ms before start
- PASSED: Fixed four-hour customer cancellation rejects 0 ms before start
- PASSED: Fixed four-hour customer cancellation rejects -1 ms before start
- PASSED: Fixed four-hour customer cancellation invalid timestamps fail closed
- PASSED: Fixed four-hour customer cancellation legacy business/platform cutoff does not override four hours or introduce fees
- PASSED: Fixed four-hour customer cancellation service cancels exactly four hours before start and releases items
- PASSED: Fixed four-hour customer cancellation service refuses late direct cancellation before any write
- PASSED: Fixed four-hour customer cancellation changing the actor type cannot bypass the customer role cutoff
- PASSED: Fixed four-hour customer cancellation a reschedule between initial read and transaction is revalidated under lock
- PASSED: Fixed four-hour customer cancellation recurring cancellation cannot bypass the cutoff

<a id="test-beauty-booking-api-main-src-bookings-customer-change-request-spec-ts"></a>

## beauty-booking-api-main/src/bookings/customer-change-request.spec.ts

[beauty-booking-api-main/src/bookings/customer-change-request.spec.ts:1](../../beauty-booking-api-main/src/bookings/customer-change-request.spec.ts) — **PASSED**.

- PASSED: Customer cancellation request under booking lock creates a pending request without cancelling and notifies scoped salon recipients in the same transaction
- PASSED: Customer cancellation request under booking lock rejects a concurrently changed CANCELLED booking
- PASSED: Customer cancellation request under booking lock rejects a concurrently changed NO_SHOW booking
- PASSED: Customer cancellation request under booking lock rejects a concurrently changed CHECKED_IN booking
- PASSED: Customer cancellation request under booking lock rejects a concurrently changed COMPLETED booking
- PASSED: Customer cancellation request under booking lock cannot request cancellation of another customer booking through direct service invocation
- PASSED: Customer cancellation request under booking lock cannot create a customer request at/past appointment start (0 ms)
- PASSED: Customer cancellation request under booking lock cannot create a customer request at/past appointment start (-1 ms)
- PASSED: Customer cancellation request under booking lock does not create a second pending request
- PASSED: Customer cancellation request under booking lock notification write failure prevents the request transaction from committing
- PASSED: Customer cancellation request under booking lock exactly four hours is not a late-cancellation event
- PASSED: Customer cancellation request under booking lock event failure prevents request transaction success

<a id="test-beauty-booking-api-main-src-bookings-dto-bookings-dto-spec-ts"></a>

## beauty-booking-api-main/src/bookings/dto/bookings.dto.spec.ts

[beauty-booking-api-main/src/bookings/dto/bookings.dto.spec.ts:1](../../beauty-booking-api-main/src/bookings/dto/bookings.dto.spec.ts) — **PASSED**.

- PASSED: CreateGuestBookingDto normalizes the guest identity and accepts a one-time booking payload
- PASSED: CreateGuestBookingDto rejects invalid phone numbers
- PASSED: CreateGuestBookingDto allows combo checkout without a serviceIds array

<a id="test-beauty-booking-api-main-src-bookings-late-cancellation-approval-spec-ts"></a>

## beauty-booking-api-main/src/bookings/late-cancellation-approval.spec.ts

[beauty-booking-api-main/src/bookings/late-cancellation-approval.spec.ts:1](../../beauty-booking-api-main/src/bookings/late-cancellation-approval.spec.ts) — **PASSED**.

- PASSED: Late cancellation is classified at request time approves after start in the original 24h window, without recording points again
- PASSED: Late cancellation is classified at request time a changed booking time cannot change the stored request-time classification
- PASSED: Late cancellation is classified at request time exactly 24h expires processing, not the violation event
- PASSED: Late cancellation is classified at request time a valid late request cannot be rejected
- PASSED: Late cancellation is classified at request time voided request cannot be approved
- PASSED: Late cancellation is classified at request time duplicate approval loses request claim before any second status write

<a id="test-beauty-booking-api-main-src-bookings-no-show-policy-spec-ts"></a>

## beauty-booking-api-main/src/bookings/no-show-policy.spec.ts

[beauty-booking-api-main/src/bookings/no-show-policy.spec.ts:1](../../beauty-booking-api-main/src/bookings/no-show-policy.spec.ts) — **PASSED**.

- PASSED: No-show policy and evidence BUSINESS_OWNER records absence and atomic evidence
- PASSED: No-show policy and evidence RECEPTIONIST records absence and atomic evidence
- PASSED: No-show policy and evidence rejects roles "STAFF" even with confirmation
- PASSED: No-show policy and evidence rejects roles "CUSTOMER" even with confirmation
- PASSED: No-show policy and evidence rejects roles "PLATFORM_ADMIN" even with confirmation
- PASSED: No-show policy and evidence rejects roles "PLATFORM_ADMIN" even with confirmation
- PASSED: No-show policy and evidence rejects roles "CUSTOMER" even with confirmation
- PASSED: No-show policy and evidence rejects roles %j even with confirmation
- PASSED: No-show policy and evidence requires explicit confirmation (undefined)
- PASSED: No-show policy and evidence requires explicit confirmation (false)
- PASSED: No-show policy and evidence strict fifteen-minute boundary: offset -1
- PASSED: No-show policy and evidence strict fifteen-minute boundary: offset 0
- PASSED: No-show policy and evidence strict fifteen-minute boundary: offset 1
- PASSED: No-show policy and evidence missing/invalid timestamps cannot authorize absence
- PASSED: No-show policy and evidence any recorded cancellation request prevents no-show (PENDING)
- PASSED: No-show policy and evidence any recorded cancellation request prevents no-show (REJECTED)
- PASSED: No-show policy and evidence any recorded cancellation request prevents no-show (EXPIRED)
- PASSED: No-show policy and evidence any recorded cancellation request prevents no-show (APPROVED)
- PASSED: No-show policy and evidence revalidates time after a concurrent reschedule
- PASSED: No-show policy and evidence concurrent status CHECKED_IN aborts operation
- PASSED: No-show policy and evidence concurrent status CANCELLED aborts operation
- PASSED: No-show policy and evidence concurrent status NO_SHOW aborts operation
- PASSED: No-show policy and evidence arrival history blocks absence even if current status is inconsistent
- PASSED: No-show policy and evidence service status IN_PROGRESS proves customer attendance
- PASSED: No-show policy and evidence service status COMPLETED proves customer attendance
- PASSED: No-show policy and evidence audit failure aborts the status change
- PASSED: No-show policy and evidence confirmation DTO rejects a string boolean
- PASSED: No-show policy and evidence service-state rules still reject checked-in customers

<a id="test-beauty-booking-api-main-src-bookings-postgres-hardening-integration-spec-ts"></a>

## beauty-booking-api-main/src/bookings/postgres-hardening.integration.spec.ts

[beauty-booking-api-main/src/bookings/postgres-hardening.integration.spec.ts:1](../../beauty-booking-api-main/src/bookings/postgres-hardening.integration.spec.ts) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-api-main-src-branches-branch-state-service-spec-ts"></a>

## beauty-booking-api-main/src/branches/branch-state.service.spec.ts

[beauty-booking-api-main/src/branches/branch-state.service.spec.ts:1](../../beauty-booking-api-main/src/branches/branch-state.service.spec.ts) — **PASSED**.

- PASSED: BranchStateService uses one canonical definition for public visibility and bookability
- PASSED: BranchStateService requires an actor reason for every transition
- PASSED: BranchStateService revalidates transition guards after taking the row lock

<a id="test-beauty-booking-api-main-src-branches-branches-onboarding-spec-ts"></a>

## beauty-booking-api-main/src/branches/branches-onboarding.spec.ts

[beauty-booking-api-main/src/branches/branches-onboarding.spec.ts:1](../../beauty-booking-api-main/src/branches/branches-onboarding.spec.ts) — **PASSED**.

- PASSED: Branch onboarding settings safety rejects protected fields and nested database operations: {"bookingPolicy":{"branchId":"another-branch"}}
- PASSED: Branch onboarding settings safety rejects protected fields and nested database operations: {"bookingPolicy":{"branch":{"connect":{"id":"another-branch"}}}}
- PASSED: Branch onboarding settings safety rejects protected fields and nested database operations: {"bookingPolicy":{"confirmedAt":"2026-01-01T00:00:00Z"}}
- PASSED: Branch onboarding settings safety rejects protected fields and nested database operations: {"bookingPolicy":{"leadTimeMinutes":{"increment":1}}}
- PASSED: Branch onboarding settings safety rejects protected fields and nested database operations: {"branch":{"businessId":"another-business"}}
- PASSED: Branch onboarding settings safety rejects protected fields and nested database operations: {"branch":{"status":"ACTIVE","reviewStatus":"APPROVED"}}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"leadTimeMinutes":-1}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"bookingHorizonDays":0}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"cancellationHours":0.5}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"rescheduleHours":null}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"defaultBufferMinutes":2147483648}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"maxOverbookedSlots":6}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"allowWalkIn":"false"}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"allowCounterBooking":"true"}
- PASSED: Branch onboarding settings safety rejects malformed policy values before persisting a branch change: {"overbookingEnabled":1}
- PASSED: Branch onboarding settings safety rejects invalid or duplicate opening hours before any write: {"dayOfWeek":1,"openTime":"24:00","closeTime":"25:00"}
- PASSED: Branch onboarding settings safety rejects invalid or duplicate opening hours before any write: {"dayOfWeek":1,"openTime":"09:00","closeTime":"08:00"}
- PASSED: Branch onboarding settings safety rejects invalid or duplicate opening hours before any write: {"dayOfWeek":1,"openTime":"09:00","closeTime":"09:00"}
- PASSED: Branch onboarding settings safety rejects invalid or duplicate opening hours before any write: {"dayOfWeek":1,"openTime":"09:00","closeTime":"18:00"}
- PASSED: Branch onboarding settings safety accepts current frontend fields and writes only the authorized branch inside one transaction
- PASSED: Branch onboarding settings safety propagates a policy write failure from the shared onboarding transaction

<a id="test-beauty-booking-api-main-src-branches-branches-preview-spec-ts"></a>

## beauty-booking-api-main/src/branches/branches-preview.spec.ts

[beauty-booking-api-main/src/branches/branches-preview.spec.ts:1](../../beauty-booking-api-main/src/branches/branches-preview.spec.ts) — **PASSED**.

- PASSED: Public/preview branch projection public projection requires publication and never returns management/private data
- PASSED: Public/preview branch projection owner preview reuses the projection without live-only filters or publishing writes
- PASSED: Public/preview branch projection denies CUSTOMER preview even though public content remains available
- PASSED: Public/preview branch projection denies STAFF preview even though public content remains available
- PASSED: Public/preview branch projection denies RECEPTIONIST preview even though public content remains available
- PASSED: Public/preview branch projection denies PLATFORM_ADMIN preview even though public content remains available
- PASSED: Public/preview branch projection an owner cannot preview a foreign business through a Staff scope

<a id="test-beauty-booking-api-main-src-branches-branches-service-spec-ts"></a>

## beauty-booking-api-main/src/branches/branches.service.spec.ts

[beauty-booking-api-main/src/branches/branches.service.spec.ts:1](../../beauty-booking-api-main/src/branches/branches.service.spec.ts) — **PASSED**.

- PASSED: BranchesService marketplace listing rejects invalid pendingHoldMinutes value 0
- PASSED: BranchesService marketplace listing rejects invalid pendingHoldMinutes value 4
- PASSED: BranchesService marketplace listing rejects invalid pendingHoldMinutes value 1441
- PASSED: BranchesService marketplace listing paginates cards and aggregates ratings without hydrating bookings
- PASSED: BranchesService marketplace listing caps public page size at 100
- PASSED: BranchesService marketplace listing validates public service and review pagination queries
- PASSED: BranchesService marketplace listing rejects the removed fourteenth onboarding step
- PASSED: BranchesService marketplace listing groups active public services by category and paginates them
- PASSED: BranchesService marketplace listing returns approved reviews and masks anonymous customer names
- PASSED: BranchesService branch lifecycle routes a different legal entity to new-business registration without creating a branch
- PASSED: BranchesService branch lifecycle creates an isolated draft and never activates it during creation
- PASSED: BranchesService branch lifecycle keeps an approved branch inactive when the operational checklist is incomplete
- PASSED: BranchesService branch lifecycle does not approve a branch before its parent business is approved
- PASSED: BranchesService branch lifecycle publishes only an approved and operationally ready branch

<a id="test-beauty-booking-api-main-src-business-business-onboarding-service-spec-ts"></a>

## beauty-booking-api-main/src/business/business-onboarding.service.spec.ts

[beauty-booking-api-main/src/business/business-onboarding.service.spec.ts:1](../../beauty-booking-api-main/src/business/business-onboarding.service.spec.ts) — **PASSED**.

- PASSED: BusinessOnboardingService state machine review requires a pending-review business
- PASSED: BusinessOnboardingService state machine request-info requires a reason
- PASSED: BusinessOnboardingService state machine approve moves pending review to approved

<a id="test-beauty-booking-api-main-src-business-cancellation-policies-service-spec-ts"></a>

## beauty-booking-api-main/src/business/cancellation-policies.service.spec.ts

[beauty-booking-api-main/src/business/cancellation-policies.service.spec.ts:1](../../beauty-booking-api-main/src/business/cancellation-policies.service.spec.ts) — **PASSED**.

- PASSED: Cancellation policy validation uses the validated DTO on the API endpoint
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours -1 without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours 0.5 without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours "2" without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours "" without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours 2147483648 without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours true without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours [] without database writes
- PASSED: Cancellation policy validation freeCancelHours rejects invalid hours {"increment":1} without database writes
- PASSED: Cancellation policy validation freeCancelHours accepts supported integer hours 4
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours -1 without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours 0.5 without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours "2" without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours "" without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours 2147483648 without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours null without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours true without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours [] without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours rejects invalid hours {"increment":1} without database writes
- PASSED: Cancellation policy validation rescheduleAllowedHours accepts supported integer hours 0
- PASSED: Cancellation policy validation rescheduleAllowedHours accepts supported integer hours 1
- PASSED: Cancellation policy validation rescheduleAllowedHours accepts supported integer hours 2147483647
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"id":"other-policy"}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"businessId":"other-business"}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"business":{"connect":{"id":"other-business"}}}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"updatedBy":"other-owner"}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"createdAt":"2026-01-01T00:00:00Z"}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"updatedAt":"2026-01-01T00:00:00Z"}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"lateCancelFeePercent":10}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"noShowFeePercent":10}
- PASSED: Cancellation policy validation rejects protected, retired, or unknown fields: {"unknownSetting":true}
- PASSED: Cancellation policy validation rejects malformed notes case 0
- PASSED: Cancellation policy validation rejects malformed notes case 1
- PASSED: Cancellation policy validation rejects malformed notes case 2
- PASSED: Cancellation policy validation rejects malformed notes case 3
- PASSED: Cancellation policy validation rejects malformed notes case 4
- PASSED: Cancellation policy validation rejects malformed notes case 5
- PASSED: Cancellation policy validation accepts and preserves safe notes case 0
- PASSED: Cancellation policy validation accepts and preserves safe notes case 1
- PASSED: Cancellation policy validation accepts and preserves safe notes case 2
- PASSED: Cancellation policy validation accepts and preserves safe notes case 3
- PASSED: Cancellation policy validation rejects non-object input at the service boundary: null
- PASSED: Cancellation policy validation rejects non-object input at the service boundary: undefined
- PASSED: Cancellation policy validation rejects non-object input at the service boundary: []
- PASSED: Cancellation policy validation rejects non-object input at the service boundary: "policy"
- PASSED: Cancellation policy validation rejects non-object input at the service boundary: 1
- PASSED: Cancellation policy validation rejects non-object input at the service boundary: true
- PASSED: Cancellation policy validation keeps omitted fields unchanged, retains legacy fee data privately, and audits the actor
- PASSED: Cancellation policy validation cannot override the fixed 4-hour cutoff with 0
- PASSED: Cancellation policy validation cannot override the fixed 4-hour cutoff with 1
- PASSED: Cancellation policy validation cannot override the fixed 4-hour cutoff with 2
- PASSED: Cancellation policy validation cannot override the fixed 4-hour cutoff with 3
- PASSED: Cancellation policy validation cannot override the fixed 4-hour cutoff with 5
- PASSED: Cancellation policy validation cannot override the fixed 4-hour cutoff with 24
- PASSED: Cancellation policy validation cannot override the fixed 4-hour cutoff with 2147483647
- PASSED: Cancellation policy validation projects the fixed cutoff without rewriting historical policy rows

<a id="test-beauty-booking-api-main-src-business-salon-members-service-spec-ts"></a>

## beauty-booking-api-main/src/business/salon-members.service.spec.ts

[beauty-booking-api-main/src/business/salon-members.service.spec.ts:1](../../beauty-booking-api-main/src/business/salon-members.service.spec.ts) — **PASSED**.

- PASSED: SalonMembersService supported metadata roles rejects retired membership role MANAGER before writing metadata
- PASSED: SalonMembersService supported metadata roles rejects retired membership role BRANCH_MANAGER before writing metadata
- PASSED: SalonMembersService supported metadata roles requires a branch for Receptionist metadata
- PASSED: SalonMembersService supported metadata roles rejects a branch that is not in the selected business
- PASSED: SalonMembersService supported metadata roles writes valid branch-scoped Receptionist metadata without inferring ownership

<a id="test-beauty-booking-api-main-src-combos-combos-service-spec-ts"></a>

## beauty-booking-api-main/src/combos/combos.service.spec.ts

[beauty-booking-api-main/src/combos/combos.service.spec.ts:1](../../beauty-booking-api-main/src/combos/combos.service.spec.ts) — **PASSED**.

- PASSED: CombosService domain validation rejects a bundle with fewer than two distinct services
- PASSED: CombosService domain validation rejects a service outside the selected branch
- PASSED: CombosService domain validation normalizes item order and snapshots price and duration from the server
- PASSED: CombosService domain validation rejects a combo for an inactive branch
- PASSED: CombosService domain validation presents snapshot totals even after a service catalog price changes

<a id="test-beauty-booking-api-main-src-common-filters-prisma-exception-filter-spec-ts"></a>

## beauty-booking-api-main/src/common/filters/prisma-exception.filter.spec.ts

[beauty-booking-api-main/src/common/filters/prisma-exception.filter.spec.ts:1](../../beauty-booking-api-main/src/common/filters/prisma-exception.filter.spec.ts) — **PASSED**.

- PASSED: mapKnownPrismaError maps P2002 to a safe HTTP response
- PASSED: mapKnownPrismaError maps P2003 to a safe HTTP response
- PASSED: mapKnownPrismaError maps P2025 to a safe HTTP response
- PASSED: mapKnownPrismaError maps P2034 to a safe HTTP response
- PASSED: mapKnownPrismaError maps P2024 to a safe HTTP response
- PASSED: mapKnownPrismaError maps P2021 to a safe HTTP response
- PASSED: mapKnownPrismaError maps P2022 to a safe HTTP response
- PASSED: mapKnownPrismaError does not expose unknown database failures

<a id="test-beauty-booking-api-main-src-common-guards-guards-spec-ts"></a>

## beauty-booking-api-main/src/common/guards/guards.spec.ts

[beauty-booking-api-main/src/common/guards/guards.spec.ts:1](../../beauty-booking-api-main/src/common/guards/guards.spec.ts) — **PASSED**.

- PASSED: RolesGuard skips when @Public() is set
- PASSED: RolesGuard throws when no user attached
- PASSED: RolesGuard passes when @Roles matches user
- PASSED: RolesGuard throws when @Roles does not match
- PASSED: RolesGuard enforces @RequireScope new shape (BRANCH)
- PASSED: RolesGuard blocks cross-tenant access via @RequireScope
- PASSED: RolesGuard accepts back-compat @RequireScope with roles[]
- PASSED: ScopeGuard skips when no metadata
- PASSED: ScopeGuard skips when @Public() is set
- PASSED: ScopeGuard blocks when scope does not match
- PASSED: PolicyGuard skips when no metadata
- PASSED: PolicyGuard passes when ANY required permission resolves
- PASSED: PolicyGuard blocks when none of the required permissions resolve

<a id="test-beauty-booking-api-main-src-common-guards-user-aware-throttler-guard-spec-ts"></a>

## beauty-booking-api-main/src/common/guards/user-aware-throttler.guard.spec.ts

[beauty-booking-api-main/src/common/guards/user-aware-throttler.guard.spec.ts:1](../../beauty-booking-api-main/src/common/guards/user-aware-throttler.guard.spec.ts) — **PASSED**.

- PASSED: throttleTracker isolates login quotas by normalized account and IP
- PASSED: throttleTracker tracks authenticated requests by user and IP

<a id="test-beauty-booking-api-main-src-common-interceptors-idempotency-interceptor-spec-ts"></a>

## beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.spec.ts

[beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.spec.ts:1](../../beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.spec.ts) — **PASSED**.

- PASSED: IdempotencyInterceptor fingerprint is stable across object key order
- PASSED: IdempotencyInterceptor never stores authentication responses in the idempotency store
- PASSED: IdempotencyInterceptor requires idempotency for financial package and settlement writes
- PASSED: IdempotencyInterceptor same key and same payload replays the completed response
- PASSED: IdempotencyInterceptor same key with a different payload is rejected
- PASSED: IdempotencyInterceptor the same key is isolated between concrete resource ids

<a id="test-beauty-booking-api-main-src-common-permissions-administrative-role-scope-spec-ts"></a>

## beauty-booking-api-main/src/common/permissions/administrative-role-scope.spec.ts

[beauty-booking-api-main/src/common/permissions/administrative-role-scope.spec.ts:1](../../beauty-booking-api-main/src/common/permissions/administrative-role-scope.spec.ts) — **PASSED**.

- PASSED: administrative capabilities do not combine unrelated branch roles cannot edit the booking policy of a non-owned business
- PASSED: administrative capabilities do not combine unrelated branch roles cannot publish or onboard a non-owned branch: reception-branch
- PASSED: administrative capabilities do not combine unrelated branch roles cannot publish or onboard a non-owned branch: staff-branch
- PASSED: administrative capabilities do not combine unrelated branch roles cannot create a branch in a business where the owner is only staff or receptionist
- PASSED: administrative capabilities do not combine unrelated branch roles still allows publishing a branch in the owned business
- PASSED: administrative capabilities do not combine unrelated branch roles does not copy services from a non-owned source or transition its status
- PASSED: administrative capabilities do not combine unrelated branch roles limits operational impact lists and details to ownership
- PASSED: administrative capabilities do not combine unrelated branch roles reports keep all owned branches and never import unrelated branch scopes
- PASSED: administrative capabilities do not combine unrelated branch roles rejects an explicit non-owned branch before querying financial reports

<a id="test-beauty-booking-api-main-src-common-permissions-controller-metadata-spec-ts"></a>

## beauty-booking-api-main/src/common/permissions/controller-metadata.spec.ts

[beauty-booking-api-main/src/common/permissions/controller-metadata.spec.ts:1](../../beauty-booking-api-main/src/common/permissions/controller-metadata.spec.ts) — **PASSED**.

- PASSED: Controller metadata AST scanner flags an authenticated route with no role or permission decorator
- PASSED: Controller metadata AST scanner inherits class metadata and lets method metadata override, including empty arrays
- PASSED: Controller metadata AST scanner handles aliased imports, static constants, multiline decorators and nested objects
- PASSED: Controller metadata AST scanner does not mistake RequireScope permissions for PolicyGuard enforcement
- PASSED: Controller metadata AST scanner a reviewed exception does not exempt another HTTP method or a new child route
- PASSED: Controller metadata AST scanner fails rather than silently dropping unresolved permission expressions

<a id="test-beauty-booking-api-main-src-common-permissions-management-role-scope-spec-ts"></a>

## beauty-booking-api-main/src/common/permissions/management-role-scope.spec.ts

[beauty-booking-api-main/src/common/permissions/management-role-scope.spec.ts:1](../../beauty-booking-api-main/src/common/permissions/management-role-scope.spec.ts) — **PASSED**.

- PASSED: management scopes after retiring Manager payment lists include all owned branches plus exact counter assignments, never staff-only branches
- PASSED: management scopes after retiring Manager ledger, statements and package-purchase lists cannot import another role business
- PASSED: management scopes after retiring Manager payment policy and treatment-package management require actual ownership
- PASSED: management scopes after retiring Manager checkout access is role-bound at owned-one
- PASSED: management scopes after retiring Manager checkout access is role-bound at owned-two
- PASSED: management scopes after retiring Manager checkout access is role-bound at counter
- PASSED: management scopes after retiring Manager checkout access is role-bound at staff-only
- PASSED: management scopes after retiring Manager business onboarding cannot use receptionist membership to modify another legal entity
- PASSED: management scopes after retiring Manager uploading branch media is rejected before filesystem writes at counter
- PASSED: management scopes after retiring Manager uploading branch media is rejected before filesystem writes at staff-only
- PASSED: management scopes after retiring Manager service management cannot use a branch role at counter
- PASSED: management scopes after retiring Manager service management cannot use a branch role at staff-only
- PASSED: management scopes after retiring Manager service management includes all owned branches only
- PASSED: management scopes after retiring Manager staff list excludes Staff-only authority while retaining the assigned counter branch
- PASSED: management scopes after retiring Manager staff cannot read another profile or its commission through an unrelated owner role
- PASSED: management scopes after retiring Manager counter profile reads do not imply access to other employees commissions
- PASSED: management scopes after retiring Manager staff invitations and edits require ownership of the target business
- PASSED: management scopes after retiring Manager promotion and voucher lists cannot import tenants from unrelated branch memberships
- PASSED: management scopes after retiring Manager combo management limits lists and rejects edits at non-owned branches
- PASSED: management scopes after retiring Manager review-management queries cover owned branches only
- PASSED: management scopes after retiring Manager role assignment cannot grant a colleague a role in a non-owned business
- PASSED: management scopes after retiring Manager ownership and legal-account versions cannot be read or changed using counter membership

<a id="test-beauty-booking-api-main-src-common-permissions-manager-migration-spec-ts"></a>

## beauty-booking-api-main/src/common/permissions/manager-migration.spec.ts

[beauty-booking-api-main/src/common/permissions/manager-migration.spec.ts:1](../../beauty-booking-api-main/src/common/permissions/manager-migration.spec.ts) — **PASSED**.

- PASSED: Manager retirement migration contract persists current account-role grants and only the approved historical Guest grants
- PASSED: Manager retirement migration contract includes all catalog permission definitions and retained role levels
- PASSED: Manager retirement migration contract archives before changing grants and preserves booking/staff data
- PASSED: Manager retirement migration contract fails closed on unapproved data shapes and revokes only affected salon sessions

<a id="test-beauty-booking-api-main-src-common-permissions-openapi-contract-spec-ts"></a>

## beauty-booking-api-main/src/common/permissions/openapi-contract.spec.ts

[beauty-booking-api-main/src/common/permissions/openapi-contract.spec.ts:1](../../beauty-booking-api-main/src/common/permissions/openapi-contract.spec.ts) — **FAILED**.

- FAILED: Generated OpenAPI route/security contract includes every controller operation with effective roles/permissions and authentication
- PASSED: Generated OpenAPI route/security contract Idempotency-Key requirements match the runtime interceptor for all operations
- PASSED: Generated OpenAPI route/security contract documents service-bound exceptions without advertising them as public

<a id="test-beauty-booking-api-main-src-common-permissions-permission-catalog-spec-ts"></a>

## beauty-booking-api-main/src/common/permissions/permission-catalog.spec.ts

[beauty-booking-api-main/src/common/permissions/permission-catalog.spec.ts:1](../../beauty-booking-api-main/src/common/permissions/permission-catalog.spec.ts) — **PASSED**.

- PASSED: permission catalog contract exposes exactly five account roles; Guest is a public actor only
- PASSED: permission catalog contract keeps branch creation fail-closed by default
- PASSED: permission catalog contract every permission declared on a class, method or scope exists in the catalog
- PASSED: permission catalog contract customer booking creation is guarded by booking:create:self
- PASSED: permission catalog contract every effective role can satisfy at least one enforced permission
- PASSED: permission catalog contract all production route and scope roles are supported
- PASSED: permission catalog contract every authenticated route has enforced permission metadata or a reviewed resource-authorization exception
- PASSED: permission catalog contract exceptions stay narrow, documented and attached to a real authenticated route
- PASSED: permission catalog contract legacy RequireScope permission hints must also be enforced by RequirePermission

<a id="test-beauty-booking-api-main-src-common-permissions-resource-bound-permissions-spec-ts"></a>

## beauty-booking-api-main/src/common/permissions/resource-bound-permissions.spec.ts

[beauty-booking-api-main/src/common/permissions/resource-bound-permissions.spec.ts:1](../../beauty-booking-api-main/src/common/permissions/resource-bound-permissions.spec.ts) — **PASSED**.

- PASSED: Resource-bound controller permissions receptionist sees their branch but cannot combine a receptionist role with staff membership elsewhere
- PASSED: Resource-bound controller permissions expired receptionist grants cannot read the branch-wide list
- PASSED: Resource-bound controller permissions the list controller checks access before reading any appointment rows
- PASSED: Resource-bound controller permissions branch edit checks the update permission at the target branch, not just membership
- PASSED: Resource-bound controller permissions ordinary staff cannot read the business-wide membership/contact directory

<a id="test-beauty-booking-api-main-src-common-security-serialization-contract-spec-ts"></a>

## beauty-booking-api-main/src/common/security/serialization-contract.spec.ts

[beauty-booking-api-main/src/common/security/serialization-contract.spec.ts:1](../../beauty-booking-api-main/src/common/security/serialization-contract.spec.ts) — **PASSED**.

- PASSED: response serialization security contract never expands the complete User record through a relation

<a id="test-beauty-booking-api-main-src-common-utils-booking-datetime-spec-ts"></a>

## beauty-booking-api-main/src/common/utils/booking-datetime.spec.ts

[beauty-booking-api-main/src/common/utils/booking-datetime.spec.ts:1](../../beauty-booking-api-main/src/common/utils/booking-datetime.spec.ts) — **PASSED**.

- PASSED: booking datetime canonical helpers round-trips a Vietnam local appointment without timezone drift
- PASSED: booking datetime canonical helpers keeps equal wall-clock times on different dates distinct
- PASSED: booking datetime canonical helpers adjacent booking intervals do not overlap
- PASSED: booking datetime canonical helpers supports reading an existing cross-midnight interval

<a id="test-beauty-booking-api-main-src-common-utils-multi-tenancy-spec-ts"></a>

## beauty-booking-api-main/src/common/utils/multi-tenancy.spec.ts

[beauty-booking-api-main/src/common/utils/multi-tenancy.spec.ts:1](../../beauty-booking-api-main/src/common/utils/multi-tenancy.spec.ts) — **PASSED**.

- PASSED: remaining salon roles preserve branch isolation does not import legacy membership scopes or authorize a sibling branch
- PASSED: remaining salon roles preserve branch isolation does not use an owner role in another business to widen receptionist scope
- PASSED: remaining salon roles preserve branch isolation allows the owner all branches in their own business, even with another branch role
- PASSED: remaining salon roles preserve branch isolation preserves the verified owner onboarding fallback without granting other businesses
- PASSED: remaining salon roles preserve branch isolation denies expired and unscoped branch grants, including cached permissions
- PASSED: remaining salon roles preserve branch isolation does not promote a separate staff membership through an unscoped onboarding owner
- PASSED: remaining salon roles preserve branch isolation limits a capability principal to matching role assignments without changing the original user
- PASSED: remaining salon roles preserve branch isolation receptionist booking:assign:branch is granted only in the assigned branch
- PASSED: remaining salon roles preserve branch isolation receptionist booking:cancel:branch is granted only in the assigned branch
- PASSED: remaining salon roles preserve branch isolation receptionist booking:reschedule:branch is granted only in the assigned branch
- PASSED: remaining salon roles preserve branch isolation receptionist booking:check_in:branch is granted only in the assigned branch

<a id="test-beauty-booking-api-main-src-common-utils-notify-spec-ts"></a>

## beauty-booking-api-main/src/common/utils/notify.spec.ts

[beauty-booking-api-main/src/common/utils/notify.spec.ts:1](../../beauty-booking-api-main/src/common/utils/notify.spec.ts) — **PASSED**.

- PASSED: business governance notification recipients selects active unexpired tenant owner grants and deduplicates recipients
- PASSED: business governance notification recipients does not fall back to old membership metadata when there is no active owner grant
- PASSED: booking notification recipient scopes uses current role assignments, affected branch and deduplicated users
- PASSED: booking notification recipient scopes never leaks a booking through a mismatched business notification

<a id="test-beauty-booking-api-main-src-common-utils-policy-spec-ts"></a>

## beauty-booking-api-main/src/common/utils/policy.spec.ts

[beauty-booking-api-main/src/common/utils/policy.spec.ts:1](../../beauty-booking-api-main/src/common/utils/policy.spec.ts) — **PASSED**.

- PASSED: policy.can — matrix Customer may read their own booking but not others
- PASSED: policy.can — matrix Customer may cancel own booking only
- PASSED: policy.can — matrix Staff may read/update bookings in their branch
- PASSED: policy.can — matrix Staff cannot read a different tenant's branch bookings
- PASSED: policy.can — matrix Business owner may read/update any branch in their tenant
- PASSED: policy.can — matrix catalog ownership is fail-closed for manager and platform administration
- PASSED: policy.can — matrix Cross-tenant owner blocked from another tenant
- PASSED: policy.can — matrix Platform admin may use explicitly granted platform capabilities
- PASSED: policy.can — matrix Platform administrator has governance read/refund but not tenant operation update
- PASSED: policy.can — matrix Platform administrator role supplies the audited exceptional refund capability
- PASSED: policy.can — matrix Retired health-record permissions are denied
- PASSED: policy.can — matrix Unknown permission is denied (fail-closed)
- PASSED: policy.can — matrix Expired scope is skipped
- PASSED: policy.can — matrix Public permissions pass for everyone
- PASSED: policy.cannot throws CannotError when denied
- PASSED: policy.cannot does not throw when allowed
- PASSED: canOnResource / ensureCanOnResource canOnResource maps businessId/branchId/ownerUserId
- PASSED: canOnResource / ensureCanOnResource ensureCanOnResource throws ForbiddenException
- PASSED: role / permission catalog helpers roleGrantsPermission matches the ROLE_PERMISSIONS matrix
- PASSED: role / permission catalog helpers expandRolePermissions returns the union
- PASSED: role / permission catalog helpers every catalog code has at least one role grant
- PASSED: role / permission catalog helpers every role has at least one permission

<a id="test-beauty-booking-api-main-src-common-utils-serializable-transaction-spec-ts"></a>

## beauty-booking-api-main/src/common/utils/serializable-transaction.spec.ts

[beauty-booking-api-main/src/common/utils/serializable-transaction.spec.ts:1](../../beauty-booking-api-main/src/common/utils/serializable-transaction.spec.ts) — **PASSED**.

- PASSED: Serializable transaction retry classification retries known serialization/deadlock conflicts ({"code":"P2034","clientVersion":"test","name":"PrismaClientKnownRequestError"})
- PASSED: Serializable transaction retry classification retries known serialization/deadlock conflicts ({"code":"P2010","meta":{"code":"40001"},"clientVersion":"test","name":"PrismaClientKnownRequestError"})
- PASSED: Serializable transaction retry classification retries known serialization/deadlock conflicts ({"code":"P2010","meta":{"driverAdapterError":{"cause":{"kind":"TransactionWriteConflict","originalCode":"40001"}}},"clientVersion":"test","name":"PrismaClientKnownRequestError"})
- PASSED: Serializable transaction retry classification retries known serialization/deadlock conflicts ({"code":"P2010","meta":{"driverAdapterError":{"cause":{"originalCode":"40P01"}}},"clientVersion":"test","name":"PrismaClientKnownRequestError"})
- PASSED: Serializable transaction retry classification exhausted raw-query serialization conflict becomes HTTP 409
- PASSED: Serializable transaction retry classification maps structured PostgreSQL exclusion conflicts to HTTP 409 ({"cause":{"originalCode":"23P01"}})
- PASSED: Serializable transaction retry classification maps structured PostgreSQL exclusion conflicts to HTTP 409 ({"meta":{"driverAdapterError":{"cause":{"constraint":"booking_services_staff_slot_no_overlap"}}}})
- PASSED: Serializable transaction retry classification does not retry unrelated errors
- PASSED: Serializable transaction retry classification does not retry unrelated errors
- PASSED: Serializable transaction retry classification does not retry unrelated errors
- PASSED: Serializable transaction retry classification does not retry unrelated errors

<a id="test-beauty-booking-api-main-src-mail-mail-service-spec-ts"></a>

## beauty-booking-api-main/src/mail/mail.service.spec.ts

[beauty-booking-api-main/src/mail/mail.service.spec.ts:1](../../beauty-booking-api-main/src/mail/mail.service.spec.ts) — **PASSED**.

- PASSED: MailService production safety fails closed when production email credentials are missing

<a id="test-beauty-booking-api-main-src-main-spec-ts"></a>

## beauty-booking-api-main/src/main.spec.ts

[beauty-booking-api-main/src/main.spec.ts:1](../../beauty-booking-api-main/src/main.spec.ts) — **PASSED**.

- PASSED: production environment validation rejects default production JWT secrets
- PASSED: production environment validation accepts strong non-default production secrets
- PASSED: production environment validation rejects a missing production data-encryption key

<a id="test-beauty-booking-api-main-src-media-media-access-spec-ts"></a>

## beauty-booking-api-main/src/media/media-access.spec.ts

[beauty-booking-api-main/src/media/media-access.spec.ts:1](../../beauty-booking-api-main/src/media/media-access.spec.ts) — **PASSED**.

- PASSED: Current media scope after membership changes denies deleting an image in another branch even when the caller originally uploaded it
- PASSED: Current media scope after membership changes allows an active member to delete branch media in their current branch
- PASSED: Current media scope after membership changes denies a retired Manager grant even in its former branch
- PASSED: Current media scope after membership changes denies former/expired membership, even for an uploader
- PASSED: Current media scope after membership changes denies read of a private document by a former branch uploader
- PASSED: Current media scope after membership changes denies delete of a private document by a former branch uploader
- PASSED: Current media scope after membership changes preserves private document access for its currently assigned uploader
- PASSED: Current media scope after membership changes allows the current owner across branches but denies an owner of another business
- PASSED: Current media scope after membership changes requires tenant-wide authority for a business logo, not just a branch assignment
- PASSED: Current media scope after membership changes preserves self-owned avatar deletion without granting access to another avatar
- PASSED: Current media scope after membership changes rejects unauthorized PUBLIC deletion before detach/delete transaction
- PASSED: Current media scope after membership changes rejects unauthorized PRIVATE deletion before detach/delete transaction
- PASSED: Current media scope after membership changes rejects the former uploader before reading private bytes

<a id="test-beauty-booking-api-main-src-media-media-service-spec-ts"></a>

## beauty-booking-api-main/src/media/media.service.spec.ts

[beauty-booking-api-main/src/media/media.service.spec.ts:1](../../beauty-booking-api-main/src/media/media.service.spec.ts) — **PASSED**.

- PASSED: MediaService entity-derived tenant scope rejects a client business id that does not match the target service
- PASSED: MediaService entity-derived tenant scope rejects a cross-tenant target even when no scope ids are supplied
- PASSED: MediaService entity-derived tenant scope derives the legal-document tenant from entityId

<a id="test-beauty-booking-api-main-src-notifications-notification-outbox-retry-spec-ts"></a>

## beauty-booking-api-main/src/notifications/notification-outbox-retry.spec.ts

[beauty-booking-api-main/src/notifications/notification-outbox-retry.spec.ts:1](../../beauty-booking-api-main/src/notifications/notification-outbox-retry.spec.ts) — **PASSED**.

- PASSED: Notification outbox retry exhaustion and fencing tenth failure becomes terminal and is not retried
- PASSED: Notification outbox retry exhaustion and fencing ninth failure uses backoff rather than premature dead-lettering
- PASSED: Notification outbox retry exhaustion and fencing the final permitted attempt may still succeed
- PASSED: Notification outbox retry exhaustion and fencing discovers historical exhausted FAILED rows without sending or deleting them
- PASSED: Notification outbox retry exhaustion and fencing discovers historical exhausted PENDING rows without sending or deleting them
- PASSED: Notification outbox retry exhaustion and fencing discovers historical exhausted PROCESSING rows without sending or deleting them
- PASSED: Notification outbox retry exhaustion and fencing does not steal a live tenth-attempt claim
- PASSED: Notification outbox retry exhaustion and fencing an old attempt cannot project a row reclaimed under a newer attempt
- PASSED: Notification outbox retry exhaustion and fencing a failed stale attempt cannot overwrite the new worker claim

<a id="test-beauty-booking-api-main-src-notifications-notification-outbox-worker-spec-ts"></a>

## beauty-booking-api-main/src/notifications/notification-outbox.worker.spec.ts

[beauty-booking-api-main/src/notifications/notification-outbox.worker.spec.ts:1](../../beauty-booking-api-main/src/notifications/notification-outbox.worker.spec.ts) — **PASSED**.

- PASSED: NotificationOutboxWorker claims and projects one outbox row exactly once
- PASSED: NotificationOutboxWorker does not project a row another worker already claimed

<a id="test-beauty-booking-api-main-src-operations-impact-deadline-worker-spec-ts"></a>

## beauty-booking-api-main/src/operations/impact-deadline.worker.spec.ts

[beauty-booking-api-main/src/operations/impact-deadline.worker.spec.ts:1](../../beauty-booking-api-main/src/operations/impact-deadline.worker.spec.ts) — **PASSED**.

- PASSED: ImpactDeadlineWorker queues one deduplicated critical warning per overdue case deadline

<a id="test-beauty-booking-api-main-src-operations-impact-controller-spec-ts"></a>

## beauty-booking-api-main/src/operations/impact.controller.spec.ts

[beauty-booking-api-main/src/operations/impact.controller.spec.ts:1](../../beauty-booking-api-main/src/operations/impact.controller.spec.ts) — **PASSED**.

- PASSED: ImpactController access errors rejects RECEPTIONIST before loading an operational impact case
- PASSED: ImpactController access errors rejects STAFF before loading an operational impact case
- PASSED: ImpactController access errors rejects BRANCH_MANAGER before loading an operational impact case

<a id="test-beauty-booking-api-main-src-operations-impact-service-spec-ts"></a>

## beauty-booking-api-main/src/operations/impact.service.spec.ts

[beauty-booking-api-main/src/operations/impact.service.spec.ts:1](../../beauty-booking-api-main/src/operations/impact.service.spec.ts) — **PASSED**.

- PASSED: ImpactService scoped listing does not expose business-wide or sibling-branch cases when a branch filter is supplied

<a id="test-beauty-booking-api-main-src-ownership-ownership-service-spec-ts"></a>

## beauty-booking-api-main/src/ownership/ownership.service.spec.ts

[beauty-booking-api-main/src/ownership/ownership.service.spec.ts:1](../../beauty-booking-api-main/src/ownership/ownership.service.spec.ts) — **PASSED**.

- PASSED: OwnershipService verification workflow blocks approval until both legal entity and payout versions are verified
- PASSED: OwnershipService verification workflow snapshots verified version ids when platform approves
- PASSED: OwnershipService verification workflow marks a verified transfer due now as approved and ready to execute
- PASSED: OwnershipService verification workflow only lets the original requester resubmit a NEED_MORE_INFO case

<a id="test-beauty-booking-api-main-src-payments-financial-metrics-service-spec-ts"></a>

## beauty-booking-api-main/src/payments/financial-metrics.service.spec.ts

[beauty-booking-api-main/src/payments/financial-metrics.service.spec.ts:1](../../beauty-booking-api-main/src/payments/financial-metrics.service.spec.ts) — **PASSED**.

- PASSED: FinancialMetricsService branch timezone reporting attributes collection and refund to the branch-local month at a UTC boundary

<a id="test-beauty-booking-api-main-src-payments-payments-service-spec-ts"></a>

## beauty-booking-api-main/src/payments/payments.service.spec.ts

[beauty-booking-api-main/src/payments/payments.service.spec.ts:1](../../beauty-booking-api-main/src/payments/payments.service.spec.ts) — **PASSED**.

- PASSED: PaymentsService authorization and amounts branch-scoped collector cannot collect another branch payment
- PASSED: PaymentsService authorization and amounts collector creates a paid cash payment for completed booking
- PASSED: PaymentsService authorization and amounts refund request cannot exceed remaining paid amount
- PASSED: PaymentsService authorization and amounts pending refunds reserve the remaining refundable amount
- PASSED: PaymentsService authorization and amounts requester cannot approve their own refund
- PASSED: PaymentsService authorization and amounts unimplemented payment providers are rejected honestly
- PASSED: PaymentsService authorization and amounts customer cannot self-confirm a cash payment
- PASSED: PaymentsService authorization and amounts owner cannot query another tenant package purchases
- PASSED: PaymentsService authorization and amounts concurrent refund review uses a conditional state transition
- PASSED: PaymentsService authorization and amounts refund processing starts without claiming that money was settled
- PASSED: PaymentsService authorization and amounts processing refund requires settlement evidence before marking refunded
- PASSED: PaymentsService authorization and amounts settlement reference completes refund and updates payment ledger state

<a id="test-beauty-booking-api-main-src-platform-settings-platform-settings-service-spec-ts"></a>

## beauty-booking-api-main/src/platform-settings/platform-settings.service.spec.ts

[beauty-booking-api-main/src/platform-settings/platform-settings.service.spec.ts:1](../../beauty-booking-api-main/src/platform-settings/platform-settings.service.spec.ts) — **PASSED**.

- PASSED: PlatformSettingsService validation rejects invalid maxAdvanceBookingDays
- PASSED: PlatformSettingsService validation rejects invalid minBookingLeadTimeHours
- PASSED: PlatformSettingsService validation rejects invalid maxRescheduleCountPerBooking
- PASSED: PlatformSettingsService validation rejects invalid reviewMinLength
- PASSED: PlatformSettingsService validation rejects invalid autoHideReviewReportThreshold
- PASSED: PlatformSettingsService validation rejects invalid freeCancellationHours
- PASSED: PlatformSettingsService validation rejects invalid freeCancellationHours
- PASSED: PlatformSettingsService validation normalizes supported legacy aliases
- PASSED: PlatformSettingsService validation does not allow the legacy alias to weaken the cancellation cutoff
- PASSED: PlatformSettingsService validation returns 4 hours even when the stored configuration predates the rule

<a id="test-beauty-booking-api-main-src-prisma-account-separation-integration-spec-ts"></a>

## beauty-booking-api-main/src/prisma/account-separation.integration.spec.ts

[beauty-booking-api-main/src/prisma/account-separation.integration.spec.ts:1](../../beauty-booking-api-main/src/prisma/account-separation.integration.spec.ts) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-api-main-src-prisma-audit-integrity-integration-spec-ts"></a>

## beauty-booking-api-main/src/prisma/audit-integrity.integration.spec.ts

[beauty-booking-api-main/src/prisma/audit-integrity.integration.spec.ts:1](../../beauty-booking-api-main/src/prisma/audit-integrity.integration.spec.ts) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-api-main-src-prisma-health-archive-integration-spec-ts"></a>

## beauty-booking-api-main/src/prisma/health-archive.integration.spec.ts

[beauty-booking-api-main/src/prisma/health-archive.integration.spec.ts:1](../../beauty-booking-api-main/src/prisma/health-archive.integration.spec.ts) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-api-main-src-prisma-manager-retirement-integration-spec-ts"></a>

## beauty-booking-api-main/src/prisma/manager-retirement.integration.spec.ts

[beauty-booking-api-main/src/prisma/manager-retirement.integration.spec.ts:1](../../beauty-booking-api-main/src/prisma/manager-retirement.integration.spec.ts) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-api-main-src-prisma-schema-alignment-integration-spec-ts"></a>

## beauty-booking-api-main/src/prisma/schema-alignment.integration.spec.ts

[beauty-booking-api-main/src/prisma/schema-alignment.integration.spec.ts:1](../../beauty-booking-api-main/src/prisma/schema-alignment.integration.spec.ts) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-api-main-src-privacy-privacy-center-service-spec-ts"></a>

## beauty-booking-api-main/src/privacy/privacy-center.service.spec.ts

[beauty-booking-api-main/src/privacy/privacy-center.service.spec.ts:1](../../beauty-booking-api-main/src/privacy/privacy-center.service.spec.ts) — **PASSED**.

- PASSED: PrivacyCenterService export isolation every exported domain is filtered by the authenticated customer or user

<a id="test-beauty-booking-api-main-src-privacy-sensitive-data-cipher-service-spec-ts"></a>

## beauty-booking-api-main/src/privacy/sensitive-data-cipher.service.spec.ts

[beauty-booking-api-main/src/privacy/sensitive-data-cipher.service.spec.ts:1](../../beauty-booking-api-main/src/privacy/sensitive-data-cipher.service.spec.ts) — **PASSED**.

- PASSED: SensitiveDataCipherService encrypts with authenticated encryption and does not persist plaintext
- PASSED: SensitiveDataCipherService fails closed when no valid 32-byte key is configured

<a id="test-beauty-booking-api-main-src-promotions-campaign-ownership-spec-ts"></a>

## beauty-booking-api-main/src/promotions/campaign-ownership.spec.ts

[beauty-booking-api-main/src/promotions/campaign-ownership.spec.ts:1](../../beauty-booking-api-main/src/promotions/campaign-ownership.spec.ts) — **PASSED**.

- PASSED: campaign tenant ownership owner cannot update another tenant promotion
- PASSED: campaign tenant ownership owner cannot revoke another tenant voucher
- PASSED: campaign tenant ownership owner cannot edit platform voucher
- PASSED: campaign tenant ownership platform cannot update a tenant promotion even with platform permission
- PASSED: campaign tenant ownership platform cannot create a promotion linked to tenant resources
- PASSED: campaign tenant ownership platform cannot update or grant a tenant voucher

<a id="test-beauty-booking-api-main-src-promotions-pricing-engine-service-spec-ts"></a>

## beauty-booking-api-main/src/promotions/pricing-engine.service.spec.ts

[beauty-booking-api-main/src/promotions/pricing-engine.service.spec.ts:1](../../beauty-booking-api-main/src/promotions/pricing-engine.service.spec.ts) — **PASSED**.

- PASSED: PricingEngineService quote applies a service-scoped promotion only to the eligible line value
- PASSED: PricingEngineService quote explains why an exhausted promotion was not applied

<a id="test-beauty-booking-api-main-src-promotions-promotion-quota-spec-ts"></a>

## beauty-booking-api-main/src/promotions/promotion-quota.spec.ts

[beauty-booking-api-main/src/promotions/promotion-quota.spec.ts:1](../../beauty-booking-api-main/src/promotions/promotion-quota.spec.ts) — **PASSED**.

- PASSED: Promotion quota update safety does not lower total quota below reserved/applied redemptions
- PASSED: Promotion quota update safety does not lower per-customer quota below actual usage
- PASSED: Promotion quota update safety increments the rule version when a safe quota change is accepted
- PASSED: Promotion quota update safety replaces tenant scopes atomically while versioning the rule

<a id="test-beauty-booking-api-main-src-recurring-recurring-creation-fence-spec-ts"></a>

## beauty-booking-api-main/src/recurring/recurring-creation-fence.spec.ts

[beauty-booking-api-main/src/recurring/recurring-creation-fence.spec.ts:1](../../beauty-booking-api-main/src/recurring/recurring-creation-fence.spec.ts) — **PASSED**.

- PASSED: Recurring occurrence transaction fence atomically checks ownership, branch and creation state and records progress
- PASSED: Recurring occurrence transaction fence rejects a recovered, cancelled, deleted or differently scoped plan
- PASSED: Recurring occurrence transaction fence does not drop the ownership filter for a missing customer

<a id="test-beauty-booking-api-main-src-recurring-recurring-plan-recovery-worker-spec-ts"></a>

## beauty-booking-api-main/src/recurring/recurring-plan-recovery.worker.spec.ts

[beauty-booking-api-main/src/recurring/recurring-plan-recovery.worker.spec.ts:1](../../beauty-booking-api-main/src/recurring/recurring-plan-recovery.worker.spec.ts) — **PASSED**.

- PASSED: Recurring plan crash recovery fails only stale creation, counts committed bookings and queues one durable notice in the transaction
- PASSED: Recurring plan crash recovery does nothing after a fresh heartbeat or a competing recovery wins
- PASSED: Recurring plan crash recovery propagates notice failure out of the transaction so state and notice roll back together
- PASSED: Recurring plan crash recovery continues with other plans after one recovery fails
- PASSED: Recurring plan crash recovery releases its running guard after a scan failure
- PASSED: Recurring plan crash recovery does not overlap local ticks
- PASSED: Recurring plan crash recovery runs on startup, once a minute and stops on shutdown

<a id="test-beauty-booking-api-main-src-recurring-recurring-service-spec-ts"></a>

## beauty-booking-api-main/src/recurring/recurring.service.spec.ts

[beauty-booking-api-main/src/recurring/recurring.service.spec.ts:1](../../beauty-booking-api-main/src/recurring/recurring.service.spec.ts) — **PASSED**.

- PASSED: RecurringService creation saga keeps an explicit CREATING state until every occurrence succeeds
- PASSED: RecurringService creation saga compensates successful reservations instead of hard-deleting them
- PASSED: RecurringService creation saga does not compensate or overwrite a plan already recovered by another worker
- PASSED: RecurringService creation saga cannot overwrite recovery with late activation after all occurrences return
- PASSED: RecurringService creation saga compensates a committed booking even when its response failed before returning its id
- PASSED: RecurringService creation saga cannot resume a CREATING plan
- PASSED: RecurringService creation saga cannot resume a FAILED plan
- PASSED: RecurringService creation saga cannot resume a CANCELLED plan
- PASSED: RecurringService creation saga cannot resume a COMPLETED plan
- PASSED: RecurringService creation saga a stale pause request cannot reactivate a concurrently cancelled plan

<a id="test-beauty-booking-api-main-src-reports-owner-dashboard-service-spec-ts"></a>

## beauty-booking-api-main/src/reports/owner-dashboard.service.spec.ts

[beauty-booking-api-main/src/reports/owner-dashboard.service.spec.ts:1](../../beauty-booking-api-main/src/reports/owner-dashboard.service.spec.ts) — **PASSED**.

- PASSED: ReportsService owner dashboard applies the same branch and date scope to KPI and chart source queries

<a id="test-beauty-booking-api-main-src-reviews-review-moderation-spec-ts"></a>

## beauty-booking-api-main/src/reviews/review-moderation.spec.ts

[beauty-booking-api-main/src/reviews/review-moderation.spec.ts:1](../../beauty-booking-api-main/src/reviews/review-moderation.spec.ts) — **PASSED**.

- PASSED: Review moderation lifecycle quarantines severe/PII reports so public APPROVED queries cannot include them
- PASSED: Review moderation lifecycle blocks duplicate reports from the same actor
- PASSED: Review moderation lifecycle creates one pending appeal with immutable moderation history

<a id="test-beauty-booking-api-main-src-reviews-reviews-public-identity-spec-ts"></a>

## beauty-booking-api-main/src/reviews/reviews-public-identity.spec.ts

[beauty-booking-api-main/src/reviews/reviews-public-identity.spec.ts:1](../../beauty-booking-api-main/src/reviews/reviews-public-identity.spec.ts) — **PASSED**.

- PASSED: Public review identity does not disclose an anonymous customer identity through the business feed
- PASSED: Public review identity does not disclose an anonymous customer identity through the staff feed
- PASSED: Public review identity does not disclose an anonymous customer identity through the service feed
- PASSED: Public review identity retains the chosen public display name across every public feed
- PASSED: Public review identity does not publish a private avatar even when the reviewer is not anonymous
- PASSED: Public review identity preserves identity for the separately authorized management view

<a id="test-beauty-booking-api-main-src-reviews-reviews-public-summary-spec-ts"></a>

## beauty-booking-api-main/src/reviews/reviews-public-summary.spec.ts

[beauty-booking-api-main/src/reviews/reviews-public-summary.spec.ts:1](../../beauty-booking-api-main/src/reviews/reviews-public-summary.spec.ts) — **PASSED**.

- PASSED: Public service rating summary includes older ratings in the summary while returning only the latest 50 reviews
- PASSED: Public service rating summary excludes hidden, reported, pending and deleted reviews from both the feed and its summary

<a id="test-beauty-booking-api-main-src-reviews-reviews-service-spec-ts"></a>

## beauty-booking-api-main/src/reviews/reviews.service.spec.ts

[beauty-booking-api-main/src/reviews/reviews.service.spec.ts:1](../../beauty-booking-api-main/src/reviews/reviews.service.spec.ts) — **PASSED**.

- PASSED: ReviewsService tenant and booking integrity denies platform review moderation to BUSINESS_OWNER even in its own branch
- PASSED: ReviewsService tenant and booking integrity denies platform review moderation to RECEPTIONIST even in its own branch
- PASSED: ReviewsService tenant and booking integrity denies platform review moderation to STAFF even in its own branch
- PASSED: ReviewsService tenant and booking integrity denies platform review moderation to BRANCH_MANAGER even in its own branch
- PASSED: ReviewsService tenant and booking integrity rejects service ratings copied from another booking
- PASSED: ReviewsService tenant and booking integrity publishes a valid completed-booking review immediately

<a id="test-beauty-booking-api-main-src-saved-services-saved-services-service-spec-ts"></a>

## beauty-booking-api-main/src/saved-services/saved-services.service.spec.ts

[beauty-booking-api-main/src/saved-services/saved-services.service.spec.ts:1](../../beauty-booking-api-main/src/saved-services/saved-services.service.spec.ts) — **PASSED**.

- PASSED: SavedServicesService only saves an offering that is publicly bookable through its branch and business state
- PASSED: SavedServicesService scopes removal to the authenticated customer and offering pair

<a id="test-beauty-booking-api-main-src-scheduler-scheduler-reauthorization-spec-ts"></a>

## beauty-booking-api-main/src/scheduler/scheduler-reauthorization.spec.ts

[beauty-booking-api-main/src/scheduler/scheduler-reauthorization.spec.ts:1](../../beauty-booking-api-main/src/scheduler/scheduler-reauthorization.spec.ts) — **PASSED**.

- PASSED: Scheduler socket authorization renewal delivers once to an authorized socket even if several target rooms match
- PASSED: Scheduler socket authorization renewal sends staff only a resync signal rather than another booking payload
- PASSED: Scheduler socket authorization renewal rechecks the current session and disconnects a revoked socket at the next interval
- PASSED: Scheduler socket authorization renewal replaces branch rooms after membership changes, without retaining the old branch
- PASSED: Scheduler socket authorization renewal blocks delivery from an expired lease even when the interval has not run
- PASSED: Scheduler socket authorization renewal never extends a lease past the signed JWT expiry
- PASSED: Scheduler socket authorization renewal never extends a lease past a scoped role expiry
- PASSED: Scheduler socket authorization renewal does not send booking data during revalidation and requests a resync after successful renewal
- PASSED: Scheduler socket authorization renewal times out a stalled auth lookup and a late response cannot rejoin rooms
- PASSED: Scheduler socket authorization renewal cannot resurrect a disconnected socket while authorization is pending
- PASSED: Scheduler socket authorization renewal rejects a token without expiry instead of granting a forever connection
- PASSED: Scheduler socket authorization renewal stops renewal and clears delivery authorization on module shutdown

<a id="test-beauty-booking-api-main-src-scheduler-scheduler-socket-transport-spec-ts"></a>

## beauty-booking-api-main/src/scheduler/scheduler-socket-transport.spec.ts

[beauty-booking-api-main/src/scheduler/scheduler-socket-transport.spec.ts:1](../../beauty-booking-api-main/src/scheduler/scheduler-socket-transport.spec.ts) — **PASSED**.

- PASSED: Scheduler authorization over a real local socket transport delivers a scoped event, then disconnects the same open socket after revocation

<a id="test-beauty-booking-api-main-src-scheduler-scheduler-gateway-spec-ts"></a>

## beauty-booking-api-main/src/scheduler/scheduler.gateway.spec.ts

[beauty-booking-api-main/src/scheduler/scheduler.gateway.spec.ts:1](../../beauty-booking-api-main/src/scheduler/scheduler.gateway.spec.ts) — **PASSED**.

- PASSED: SchedulerGateway security staff get no booking details through a branch room, including mixed-role scopes
- PASSED: SchedulerGateway security production CORS rejects wildcard origins
- PASSED: SchedulerGateway security customer only joins their own user room
- PASSED: SchedulerGateway security branch-scoped booking reader cannot join another branch
- PASSED: SchedulerGateway security platform role without booking-read permission does not join platform room
- PASSED: SchedulerGateway security realtime payload excludes customer PII and internal booking data
- PASSED: SchedulerGateway security anonymous handshake is rejected before connection

<a id="test-beauty-booking-api-main-src-scheduler-trust-snapshot-cron-spec-ts"></a>

## beauty-booking-api-main/src/scheduler/trust-snapshot.cron.spec.ts

[beauty-booking-api-main/src/scheduler/trust-snapshot.cron.spec.ts:1](../../beauty-booking-api-main/src/scheduler/trust-snapshot.cron.spec.ts) — **PASSED**.

- PASSED: TrustSnapshotCron catch-up a tick outside the old five-minute window catches up missing/old snapshots only
- PASSED: TrustSnapshotCron catch-up a restarted worker does not repeat fresh snapshots, but runs again the next day
- PASSED: TrustSnapshotCron catch-up waits until 02:00 and catches up at startup after 02:00
- PASSED: TrustSnapshotCron catch-up failed businesses remain due and are retried without repeating successful ones
- PASSED: TrustSnapshotCron catch-up scan failures are caught and do not disable later ticks
- PASSED: TrustSnapshotCron catch-up slow scans cannot overlap in one worker
- PASSED: TrustSnapshotCron catch-up snapshot service advances computedAt for both create and update

<a id="test-beauty-booking-api-main-src-services-service-price-rules-spec-ts"></a>

## beauty-booking-api-main/src/services/service-price-rules.spec.ts

[beauty-booking-api-main/src/services/service-price-rules.spec.ts:1](../../beauty-booking-api-main/src/services/service-price-rules.spec.ts) — **PASSED**.

- PASSED: applyServicePriceRules applies matching rules in priority order and snapshots each delta
- PASSED: applyServicePriceRules enforces variant, staff, day and time conditions
- PASSED: applyServicePriceRules never produces a negative price

<a id="test-beauty-booking-api-main-src-services-services-service-spec-ts"></a>

## beauty-booking-api-main/src/services/services.service.spec.ts

[beauty-booking-api-main/src/services/services.service.spec.ts:1](../../beauty-booking-api-main/src/services/services.service.spec.ts) — **PASSED**.

- PASSED: ServicesService branch availability creates a hidden compatibility category when owner omits categoryId
- PASSED: ServicesService branch availability pausing a service updates only the selected branch row
- PASSED: ServicesService branch availability applying a catalog creates a real branch service using base values
- PASSED: ServicesService branch availability public listing always filters inactive branch services
- PASSED: ServicesService branch availability does not archive a catalog while future bookings still reference it
- PASSED: ServicesService branch availability does not soft-delete a branch service with a future booking

<a id="test-beauty-booking-api-main-src-staff-bookable-staff-spec-ts"></a>

## beauty-booking-api-main/src/staff/bookable-staff.spec.ts

[beauty-booking-api-main/src/staff/bookable-staff.spec.ts:1](../../beauty-booking-api-main/src/staff/bookable-staff.spec.ts) — **PASSED**.

- PASSED: bookable staff policy requires an active, non-deleted profile explicitly enabled for bookings
- PASSED: bookable staff policy scopes providers to the requested branch
- PASSED: bookable staff policy requires public visibility only on customer-facing lists
- PASSED: bookable staff policy does not require employee schedule data
- PASSED: bookable staff policy requires at least one selected service assignment and deduplicates ids
- PASSED: bookable staff policy accepts account-less profiles or active linked accounts, never inactive accounts
- PASSED: bookable staff policy does not infer provider eligibility from manager, receptionist or owner roles
- PASSED: bookable staff policy never exposes internal position BRANCH_MANAGER as a professional title
- PASSED: bookable staff policy never exposes internal position Branch Manager as a professional title
- PASSED: bookable staff policy never exposes internal position RECEPTIONIST as a professional title
- PASSED: bookable staff policy never exposes internal position BUSINESS_OWNER as a professional title
- PASSED: bookable staff policy never exposes internal position Business Owner as a professional title
- PASSED: bookable staff policy never exposes internal position Quản lý chi nhánh as a professional title
- PASSED: bookable staff policy never exposes internal position Lễ tân as a professional title
- PASSED: bookable staff policy never exposes internal position Chủ cơ sở as a professional title
- PASSED: bookable staff policy preserves a real professional title
- PASSED: bookable staff policy returns only real approved-rating aggregates supplied by the query

<a id="test-beauty-booking-api-main-src-staff-staff-invitations-service-spec-ts"></a>

## beauty-booking-api-main/src/staff/staff-invitations.service.spec.ts

[beauty-booking-api-main/src/staff/staff-invitations.service.spec.ts:1](../../beauty-booking-api-main/src/staff/staff-invitations.service.spec.ts) — **PASSED**.

- PASSED: StaffInvitationsService rejects unsupported invitation role BRANCH_MANAGER before loading profiles or writing data
- PASSED: StaffInvitationsService rejects unsupported invitation role MANAGER before loading profiles or writing data
- PASSED: StaffInvitationsService rejects unsupported invitation role BUSINESS_OWNER before loading profiles or writing data
- PASSED: StaffInvitationsService rejects a persisted pending Manager invitation during context lookup and acceptance
- PASSED: StaffInvitationsService rejects a branch from another business
- PASSED: StaffInvitationsService normalizes email and revokes an older pending invitation
- PASSED: StaffInvitationsService does not accept an invalid or expired token

<a id="test-beauty-booking-api-main-src-staff-staff-service-spec-ts"></a>

## beauty-booking-api-main/src/staff/staff.service.spec.ts

[beauty-booking-api-main/src/staff/staff.service.spec.ts:1](../../beauty-booking-api-main/src/staff/staff.service.spec.ts) — **PASSED**.

- PASSED: StaffService provider management deactivates staff without deleting the manageable profile
- PASSED: StaffService provider management rejects a service that is not active at the provider branch
- PASSED: StaffService provider management upserts a branch-wide special opening
- PASSED: StaffService provider management rejects an invalid special opening interval

<a id="test-beauty-booking-api-main-src-users-users-service-spec-ts"></a>

## beauty-booking-api-main/src/users/users.service.spec.ts

[beauty-booking-api-main/src/users/users.service.spec.ts:1](../../beauty-booking-api-main/src/users/users.service.spec.ts) — **PASSED**.

- PASSED: UsersService role scope validation rejects retired platform role ADMIN
- PASSED: UsersService role scope validation rejects retired platform role COMPLIANCE
- PASSED: UsersService role scope validation rejects retired platform role SUPPORT
- PASSED: UsersService role scope validation rejects retired platform role MARKETING
- PASSED: UsersService role scope validation rejects retired platform role FINANCE
- PASSED: UsersService role scope validation rejects retired Manager role BRANCH_MANAGER even with complete branch scope
- PASSED: UsersService role scope validation rejects retired Manager role MANAGER even with complete branch scope
- PASSED: UsersService role scope validation rejects RECEPTIONIST without a branch even for platform actors
- PASSED: UsersService role scope validation rejects STAFF without a branch even for platform actors
- PASSED: UsersService role scope validation rejects a branch/business mismatch
- PASSED: UsersService role scope validation rejects direct platform grants that turn Platform Admin into a salon operator

<a id="test-beauty-booking-api-main-test-guards-spec-ts"></a>

## beauty-booking-api-main/test/guards.spec.ts

[beauty-booking-api-main/test/guards.spec.ts:1](../../beauty-booking-api-main/test/guards.spec.ts) — **PASSED**.

- PASSED: RolesGuard returns true when no @Roles is set (coarse opt-out)
- PASSED: RolesGuard passes when the principal carries the required role globally
- PASSED: RolesGuard throws ForbiddenException when missing the role
- PASSED: RolesGuard passes for @Roles(CUSTOMER) when caller is a customer
- PASSED: PolicyGuard passes when no @RequirePermission is set
- PASSED: PolicyGuard passes when the permission is backed by a supported scoped role
- PASSED: PolicyGuard throws when the permission is missing
- PASSED: PolicyGuard does not authorize a retired Manager using a stale flattened permission
- PASSED: ScopeGuard passes when no @RequireScope is set
- PASSED: ScopeGuard throws when scopeLevel does not match principal scopes
- PASSED: ScopeGuard passes when branch-scope role matches declared scope + header
- PASSED: ScopeGuard rejects when scope has expired (expiresAt in past)

<a id="test-beauty-booking-api-main-test-multi-tenancy-spec-ts"></a>

## beauty-booking-api-main/test/multi-tenancy.spec.ts

[beauty-booking-api-main/test/multi-tenancy.spec.ts:1](../../beauty-booking-api-main/test/multi-tenancy.spec.ts) — **PASSED**.

- PASSED: multi-tenancy PLATFORM_ADMIN bypasses business scoping
- PASSED: multi-tenancy BUSINESS_OWNER scoped to a business appears in business list
- PASSED: multi-tenancy STAFF with no business scope returns empty
- PASSED: multi-tenancy assertBranchAccess throws for cross-branch access
- PASSED: multi-tenancy assertBranchAccess allows platform admin anywhere
- PASSED: multi-tenancy resolveBranchIdsForUser returns all tenant branches for owner
- PASSED: multi-tenancy resolveBranchIdsForUser returns exact branches for branch-scoped roles
- PASSED: multi-tenancy tenantScope returns tautology for platform access
- PASSED: multi-tenancy resolves a newly created owner business while the JWT scope is still empty
- PASSED: multi-tenancy tenantScope returns safe "no access" filter for users with no scope

<a id="test-beauty-booking-api-main-test-policy-spec-ts"></a>

## beauty-booking-api-main/test/policy.spec.ts

[beauty-booking-api-main/test/policy.spec.ts:1](../../beauty-booking-api-main/test/policy.spec.ts) — **PASSED**.

- PASSED: policy engine integration coarse checks use the catalog role grant
- PASSED: policy engine integration retired Manager role grants no permissions even with a valid branch scope
- PASSED: policy engine integration tenant checks reject another business
- PASSED: policy engine integration self checks require the resource owner
- PASSED: policy engine integration ensureCanOnResource fails closed
- PASSED: policy engine integration role matrix contains only catalog permissions

<a id="test-beauty-booking-web-main-beauty-booking-web-main-src-store-bookingstore-test-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/src/store/bookingStore.test.js

[beauty-booking-web-main/beauty-booking-web-main/src/store/bookingStore.test.js:1](../../beauty-booking-web-main/beauty-booking-web-main/src/store/bookingStore.test.js) — **PASS — Node test thuần**.

Assertion thực thi nằm trong log frontend; không phải browser/E2E.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-src-utils-authscope-test-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/src/utils/authScope.test.js

[beauty-booking-web-main/beauty-booking-web-main/src/utils/authScope.test.js:1](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/authScope.test.js) — **PASS — Node test thuần**.

Assertion thực thi nằm trong log frontend; không phải browser/E2E.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-src-utils-businesscompletionrules-test-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/src/utils/businessCompletionRules.test.js

[beauty-booking-web-main/beauty-booking-web-main/src/utils/businessCompletionRules.test.js:1](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/businessCompletionRules.test.js) — **PASS — Node test thuần**.

Assertion thực thi nằm trong log frontend; không phải browser/E2E.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-src-utils-customercancellation-test-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/src/utils/customerCancellation.test.js

[beauty-booking-web-main/beauty-booking-web-main/src/utils/customerCancellation.test.js:1](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/customerCancellation.test.js) — **PASS — Node test thuần**.

Assertion thực thi nằm trong log frontend; không phải browser/E2E.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-src-utils-latestrequest-test-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/src/utils/latestRequest.test.js

[beauty-booking-web-main/beauty-booking-web-main/src/utils/latestRequest.test.js:1](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/latestRequest.test.js) — **PASS — Node test thuần**.

Assertion thực thi nằm trong log frontend; không phải browser/E2E.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-src-utils-operationsscope-test-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/src/utils/operationsScope.test.js

[beauty-booking-web-main/beauty-booking-web-main/src/utils/operationsScope.test.js:1](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/operationsScope.test.js) — **PASS — Node test thuần**.

Assertion thực thi nằm trong log frontend; không phải browser/E2E.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-src-utils-schedulersocketevents-test-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/src/utils/schedulerSocketEvents.test.js

[beauty-booking-web-main/beauty-booking-web-main/src/utils/schedulerSocketEvents.test.js:1](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/schedulerSocketEvents.test.js) — **PASS — Node test thuần**.

Assertion thực thi nằm trong log frontend; không phải browser/E2E.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-auth-login-and-rbac-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/auth/login-and-rbac.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/auth/login-and-rbac.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/auth/login-and-rbac.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-booking-customer-booking-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/booking/customer-booking.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/booking/customer-booking.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/booking/customer-booking.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-booking-restriction-policy-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/booking/restriction-policy.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/booking/restriction-policy.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/booking/restriction-policy.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-concurrency-booking-concurrency-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/concurrency/booking-concurrency.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/concurrency/booking-concurrency.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/concurrency/booking-concurrency.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-rbac-api-authorization-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/api-authorization.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/api-authorization.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/api-authorization.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-rbac-owner-public-preview-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/owner-public-preview.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/owner-public-preview.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/owner-public-preview.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-rbac-removed-workforce-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/removed-workforce.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/removed-workforce.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/rbac/removed-workforce.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-responsive-critical-layouts-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/responsive/critical-layouts.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/responsive/critical-layouts.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/responsive/critical-layouts.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-salon-booking-lifecycle-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/salon/booking-lifecycle.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/salon/booking-lifecycle.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/salon/booking-lifecycle.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-salon-cancellation-policy-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/salon/cancellation-policy.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/salon/cancellation-policy.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/salon/cancellation-policy.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-setup-seed-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/setup/seed.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/setup/seed.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/setup/seed.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

<a id="test-beauty-booking-web-main-beauty-booking-web-main-tests-e2e-smoke-public-routes-spec-js"></a>

## beauty-booking-web-main/beauty-booking-web-main/tests/e2e/smoke/public-routes.spec.js

[beauty-booking-web-main/beauty-booking-web-main/tests/e2e/smoke/public-routes.spec.js:1](../../beauty-booking-web-main/beauty-booking-web-main/tests/e2e/smoke/public-routes.spec.js) — **CHƯA CHẠY — integration/E2E**.

Không chạy vì chưa xác minh database riêng có thể bỏ đi và side effects. Các integration có RUN_POSTGRES_INTEGRATION và database-name guards; cấu hình Playwright có thể tự start API/worker. Không kích hoạt trong audit.

