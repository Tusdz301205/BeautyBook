# BeautyBook — system-wide coverage

Generated inventory on 08/10/2026. Discovery is not code review or test acceptance. Existing76 cases are historical limited evidence, not a product completion percentage. New strict runs are recorded separately.

QA checkpoint before Git publish13/10: HEAD `6a2b43822b6444d9f041bf08f007ae2a75b7a46f` plus preserved dirty tree;659 code files SHA256 `c1bd2522356337d755b7d7d8d4fd53f8684788a554dbe3268aa385cdbd657d60`. Latest safe API145suites/1555PASS/type/build, web265PASS/build, mobile222source/mockPASS/type; Hermes export trước revision copy. QA3014PID15836; current readiness stored in checkpoint. Native sau thay đổi copy hiện NOT_RUN; bản demo dữ liệu phát triển dùng5173/API3000, QA5176/API3014 vẫn giữ riêng. **wholeProductComplete=false**; inventory discovery is not feature acceptance.

## Screens/routes/forms/workers

| ID | Role | Screen/flow | Action | API | Data state | Test type | Result | Evidence/source | Gap |
|---|---|---|---|---|---|---|---|---|---|
| BB-COV-0001 | PUBLIC / CUSTOMER_BOOKING | /login | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:282 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0002 | PUBLIC / CUSTOMER_BOOKING | /register | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:283 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0003 | PUBLIC / CUSTOMER_BOOKING | /register/business | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:284 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0004 | PUBLIC / CUSTOMER_BOOKING | /for-business | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:285 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0005 | PUBLIC / CUSTOMER_BOOKING | /business | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:286 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0006 | PUBLIC / CUSTOMER_BOOKING | /forgot-password | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:287 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0007 | PUBLIC / CUSTOMER_BOOKING | /reset-password | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:288 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0008 | PUBLIC / CUSTOMER_BOOKING | /verify-email | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:289 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0009 | PUBLIC / CUSTOMER_BOOKING | /accept-invitation | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:290 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0010 | PUBLIC / CUSTOMER_BOOKING | /explore | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:291 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0011 | PUBLIC / CUSTOMER_BOOKING | /explore/branches/:id | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:292 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0012 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/branches/:id/preview | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:293 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0013 | PUBLIC / CUSTOMER_BOOKING | /explore/services/:id | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:294 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0014 | PUBLIC / CUSTOMER_BOOKING | /explore/staff/:id | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:295 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0015 | WEB_CUSTOMER | /customer/* | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:298 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0016 | WEB_CUSTOMER | /customer | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:304 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0017 | WEB_CUSTOMER | /customer/appointments | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:305 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0018 | WEB_CUSTOMER | /customer/appointments/:id | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:306 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0019 | WEB_CUSTOMER | /customer/notifications | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:307 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0020 | WEB_CUSTOMER | /customer/vouchers | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:308 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0021 | WEB_CUSTOMER | /customer/reviews | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:309 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0022 | WEB_CUSTOMER | /customer/benefits | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:310 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0023 | WEB_CUSTOMER | /customer/security | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:311 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0024 | WEB_CUSTOMER | /customer/profile | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:312 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0025 | WEB_CUSTOMER | /customer/privacy | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | EXCLUDED_BY_PRODUCT_DECISION | src/App.jsx:313 | Finance hidden / data-request removed; unavailable view only |
| BB-COV-0026 | WEB_CUSTOMER | /customer/* | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:314 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0027 | PUBLIC / CUSTOMER_BOOKING | /book | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:322 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0028 | PUBLIC / CUSTOMER_BOOKING | /book/staff | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:323 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0029 | PUBLIC / CUSTOMER_BOOKING | /book/time | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:324 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0030 | PUBLIC / CUSTOMER_BOOKING | /book/info | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:325 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0031 | PUBLIC / CUSTOMER_BOOKING | /book/confirm | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:326 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0032 | PUBLIC / CUSTOMER_BOOKING | /book/success | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:327 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0033 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/* | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:330 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0034 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/notifications | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:336 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0035 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/onboarding | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:337 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0036 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/security | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:338 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0037 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/account | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:339 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0038 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/incoming-ownership | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:340 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0039 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:342 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0040 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/services | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:343 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0041 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/combos | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:344 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0042 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/appointments | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:345 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0043 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/staff | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:346 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0044 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/staff/schedule | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:348 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0045 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/staff/:staffId | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:349 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0046 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/branches/new | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:350 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0047 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/branches/:branchId/setup | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:351 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0048 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/promotions | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:352 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0049 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/reviews | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:353 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0050 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/stats | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:354 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0051 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/profile | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:355 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0052 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/payments | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | EXCLUDED_BY_PRODUCT_DECISION | src/App.jsx:356 | Finance hidden / data-request removed; unavailable view only |
| BB-COV-0053 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/operations | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:357 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0054 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/audit | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:358 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0055 | WEB_OWNER / WEB_RECEPTIONIST / WEB_STAFF (permission gating to verify) | /salon/* | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:360 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0056 | WEB_ADMIN | /admin/* | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:368 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0057 | WEB_ADMIN | /admin | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:374 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0058 | WEB_ADMIN | /admin/salons | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:375 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0059 | WEB_ADMIN | /admin/branches/:branchId | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:376 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0060 | WEB_ADMIN | /admin/businesses/:businessId | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:377 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0061 | WEB_ADMIN | /admin/users | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:378 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0062 | WEB_ADMIN | /admin/users/:userId | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:379 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0063 | WEB_ADMIN | /admin/appointments | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:380 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0064 | WEB_ADMIN | /admin/payments | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | EXCLUDED_BY_PRODUCT_DECISION | src/App.jsx:381 | Finance hidden / data-request removed; unavailable view only |
| BB-COV-0065 | WEB_ADMIN | /admin/reports | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:382 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0066 | WEB_ADMIN | /admin/reviews | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:383 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0067 | WEB_ADMIN | /admin/ownership | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:384 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0068 | WEB_ADMIN | /admin/violations | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:385 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0069 | WEB_ADMIN | /admin/audit | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:386 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0070 | WEB_ADMIN | /admin/notifications | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:387 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0071 | WEB_ADMIN | /admin/settings | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:388 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0072 | WEB_ADMIN | /admin/compliance | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:389 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0073 | WEB_ADMIN | /admin/security | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:390 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0074 | WEB_ADMIN | /admin/profile | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:391 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0075 | WEB_ADMIN | /admin/* | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:392 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0076 | PUBLIC / CUSTOMER_BOOKING | / | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:400 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0077 | PUBLIC / CUSTOMER_BOOKING | /* | Route load and controls/lifecycle to inventory | See controller/API manifest; binding pending | not reviewed | route discovery only | DISCOVERED_NOT_TESTED | src/App.jsx:417 | Data, permissions, actions, errors and E2E not inferred from route presence |
| BB-COV-0078 | NATIVE_CUSTOMER / shared auth | AccountMain | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0079 | NATIVE_CUSTOMER / shared auth | Favorites | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0080 | NATIVE_CUSTOMER / shared auth | Messages | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0081 | NATIVE_CUSTOMER / shared auth | Profile | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0082 | NATIVE_CUSTOMER / shared auth | Forms | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0083 | NATIVE_CUSTOMER / shared auth | Settings | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0084 | NATIVE_CUSTOMER / shared auth | Support | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0085 | NATIVE_CUSTOMER / shared auth | AddressForm | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0086 | NATIVE_CUSTOMER / shared auth | ChangePassword | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\AccountStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0087 | NATIVE_CUSTOMER / shared auth | HoatDongMain | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HoatDongStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0088 | NATIVE_CUSTOMER / shared auth | AppointmentDetail | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HoatDongStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0089 | NATIVE_CUSTOMER / shared auth | CalendarView | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HoatDongStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0090 | NATIVE_CUSTOMER / shared auth | Reschedule | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HoatDongStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0091 | NATIVE_CUSTOMER / shared auth | HomeMain | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HomeStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0092 | NATIVE_CUSTOMER / shared auth | ComboDetail | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HomeStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0093 | NATIVE_CUSTOMER / shared auth | VenueDetail | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HomeStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0094 | NATIVE_CUSTOMER / shared auth | Booking | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HomeStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0095 | NATIVE_CUSTOMER / shared auth | AddService | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HomeStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0096 | NATIVE_CUSTOMER / shared auth | BookingSuccess | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\HomeStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0097 | NATIVE_CUSTOMER / shared auth | MainTabs | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0098 | NATIVE_CUSTOMER / shared auth | UnsupportedWorkspace | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0099 | NATIVE_CUSTOMER / shared auth | Operations | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0100 | NATIVE_CUSTOMER / shared auth | OtpVerify | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0101 | NATIVE_CUSTOMER / shared auth | Login | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0102 | NATIVE_CUSTOMER / shared auth | Register | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0103 | NATIVE_CUSTOMER / shared auth | ForgotPassword | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0104 | NATIVE_CUSTOMER / shared auth | ResetPassword | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0105 | NATIVE_CUSTOMER / shared auth | VerifyEmail | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootStack.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0106 | NATIVE_CUSTOMER / shared auth | DiaDiem | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0107 | NATIVE_CUSTOMER / shared auth | TimKiem | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0108 | NATIVE_CUSTOMER / shared auth | LichHen | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0109 | NATIVE_CUSTOMER / shared auth | TaiKhoan | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\navigation\RootTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0110 | NATIVE_OWNER | TongQuan | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0111 | NATIVE_OWNER | VanHanh | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0112 | NATIVE_OWNER | ThongBao | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0113 | NATIVE_OWNER | TaiKhoan | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0114 | NATIVE_OWNER | OwnerHome | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0115 | NATIVE_OWNER | OwnerRequest | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0116 | NATIVE_OWNER | OwnerImpact | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0117 | NATIVE_OWNER | OwnerBooking | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\owner\OwnerTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0118 | NATIVE_STAFF | WorkList | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0119 | NATIVE_STAFF | WorkDetail | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0120 | NATIVE_STAFF | BookingWork | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0121 | NATIVE_STAFF | WorkList | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0122 | NATIVE_STAFF | BookingWork | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0123 | NATIVE_STAFF | WorkDetail | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0124 | NATIVE_STAFF | Hôm nay | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0125 | NATIVE_STAFF | Lịch | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0126 | NATIVE_STAFF | Thông báo | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0127 | NATIVE_STAFF | Tài khoản | Navigation and role scope | binding pending | device absent | source discovery | BLOCKED_NATIVE_DEVICE | mobile\src\operations\staff\StaffTabs.tsx | adb devices lists no connected emulator/device; Metro8081 not running |
| BB-COV-0128 | WEB_ADMIN | AdminServiceTaxonomy.jsx | 1 form(s); submit and direct API validation | servicesApi.getCanonicalManage, servicesApi.updateCanonical, servicesApi.createCanonical | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Admin\AdminServiceTaxonomy.jsx | Form field boundaries and server validation not certified |
| BB-COV-0129 | WEB_ADMIN | BookingStep4.jsx | 1 form(s); submit and direct API validation |  | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Customer\BookingStep4.jsx | Form field boundaries and server validation not certified |
| BB-COV-0130 | WEB_ADMIN | AuthActionPages.jsx | 3 form(s); submit and direct API validation | authApi.forgotPassword, authApi.resetPassword, authApi.verifyEmail, staffApi.getInvitationContext, staffApi.acceptInvitation, staffApi.acceptExistingInvitation | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Login\AuthActionPages.jsx | Form field boundaries and server validation not certified |
| BB-COV-0131 | WEB_ADMIN | LoginScreen.jsx | 1 form(s); submit and direct API validation |  | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Login\LoginScreen.jsx | Form field boundaries and server validation not certified |
| BB-COV-0132 | WEB_ADMIN | RegisterScreen.jsx | 1 form(s); submit and direct API validation |  | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Login\RegisterScreen.jsx | Form field boundaries and server validation not certified |
| BB-COV-0133 | WEB_ADMIN | ProfileSettings.jsx | 1 form(s); submit and direct API validation | usersApi.getMe, usersApi.updateMe | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\ProfileSettings.jsx | Form field boundaries and server validation not certified |
| BB-COV-0134 | WEB_ADMIN | PublicHome.jsx | 1 form(s); submit and direct API validation | savedServicesApi.list, savedServicesApi.remove, savedServicesApi.save, servicesApi.search, servicesApi.getCategories, branchesApi.getAll | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Public\PublicHome.jsx | Form field boundaries and server validation not certified |
| BB-COV-0135 | WEB_ADMIN | PaymentCorePanels.jsx | 3 form(s); submit and direct API validation | paymentsApi.getLedger, paymentsApi.getPolicies, paymentsApi.getPackages, paymentsApi.getStatements, paymentsApi.createPolicy, paymentsApi.createPackage, paymentsApi.generateStatement, paymentsApi.transitionStatement | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\PaymentCorePanels.jsx | Form field boundaries and server validation not certified |
| BB-COV-0136 | WEB_ADMIN | PaymentsWorkspace.jsx | 1 form(s); submit and direct API validation | paymentsApi.getAll, paymentsApi.collect, paymentsApi.verifyTransaction, paymentsApi.requestRefund, paymentsApi.reviewRefund, paymentsApi.processRefund | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\PaymentsWorkspace.jsx | Form field boundaries and server validation not certified |
| BB-COV-0137 | WEB_ADMIN | SalonAppointments.jsx | 1 form(s); submit and direct API validation | branchesApi.getAccessible, servicesApi.getAll, staffApi.getPublic, bookingsApi.counterSlots, bookingsApi.create | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\SalonAppointments.jsx | Form field boundaries and server validation not certified |
| BB-COV-0138 | WEB_ADMIN | SalonCombos.jsx | 1 form(s); submit and direct API validation | branchesApi.getAccessible, combosApi.getAll, servicesApi.getManage, combosApi.update, combosApi.create, combosApi.remove | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\SalonCombos.jsx | Form field boundaries and server validation not certified |
| BB-COV-0139 | WEB_ADMIN | SalonOperations.jsx | 4 form(s); submit and direct API validation | branchesApi.getAccessible, impactApi.detail, impactApi.resolveBatch, impactApi.resolve, impactApi.complete, ownershipApi.create, ownershipApi.legalVersion, ownershipApi.payoutVersion, ownershipApi.submitMoreInfo | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\SalonOperations.jsx | Form field boundaries and server validation not certified |
| BB-COV-0140 | WEB_ADMIN | SalonProfile.jsx | 1 form(s); submit and direct API validation | businessApi.getMyOnboarding, branchesApi.getAccessible, branchesApi.getAccessibleById, branchesApi.update, branchesApi.publish | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\SalonProfile.jsx | Form field boundaries and server validation not certified |
| BB-COV-0141 | WEB_ADMIN | SalonPromotions.jsx | 2 form(s); submit and direct API validation | branchesApi.getAccessible, servicesApi.getManage, combosApi.getAll, vouchersApi.update, vouchersApi.create, promotionsApi.update, promotionsApi.create, promotionsApi.getAll, vouchersApi.getAll, vouchersApi.remove, promotionsApi.remove, vouchersApi.grant | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\SalonPromotions.jsx | Form field boundaries and server validation not certified |
| BB-COV-0142 | WEB_ADMIN | SalonServices.jsx | 2 form(s); submit and direct API validation | servicesApi.updateCatalog, servicesApi.createCatalog, servicesApi.getById, mediaApi.remove, servicesApi.getVariants, servicesApi.getAll, servicesApi.createVariant, servicesApi.addDependency, servicesApi.createPriceRule, servicesApi.updateVariant, servicesApi.getCanonical, branchesApi.getAccessible, servicesApi.getWorkspace, servicesApi.setBranchAvailability, servicesApi.archiveCatalog | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\SalonServices.jsx | Form field boundaries and server validation not certified |
| BB-COV-0143 | WEB_ADMIN | SalonStaffManagement.jsx | 2 form(s); submit and direct API validation | staffApi.update, staffApi.create, staffApi.invite, servicesApi.getManage, staffApi.assignServices, staffApi.getAll, branchesApi.getAccessible, staffApi.getOffboardingImpact, staffApi.deactivate | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\Salon\SalonStaffManagement.jsx | Form field boundaries and server validation not certified |
| BB-COV-0144 | WEB_ADMIN | SecuritySettings.jsx | 1 form(s); submit and direct API validation | authApi.getSessions, authApi.getSecurityHistory, authApi.changePassword, authApi.revokeSession, authApi.revokeOtherSessions | new/edited/invalid/conflict to test | discovery only | DISCOVERED_NOT_TESTED | beauty-booking-web-main\beauty-booking-web-main\src\pages\SecuritySettings.jsx | Form field boundaries and server validation not certified |
| BB-COV-0145 | BACKGROUND_WORKER | change-request-expiry.worker.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\bookings\change-request-expiry.worker.ts | Isolated run for identified new QA rows required; no broad worker sweep |
| BB-COV-0146 | BACKGROUND_WORKER | pending-bookings.cron.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\bookings\pending-bookings.cron.ts | Isolated run for identified new QA rows required; no broad worker sweep |
| BB-COV-0147 | BACKGROUND_WORKER | notification-outbox.worker.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\notifications\notification-outbox.worker.ts | Isolated run for identified new QA rows required; no broad worker sweep |
| BB-COV-0148 | BACKGROUND_WORKER | impact-deadline.worker.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\operations\impact-deadline.worker.ts | Isolated run for identified new QA rows required; no broad worker sweep |
| BB-COV-0149 | BACKGROUND_WORKER | ownership-execution.worker.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\ownership\ownership-execution.worker.ts | Isolated run for identified new QA rows required; no broad worker sweep |
| BB-COV-0150 | BACKGROUND_WORKER | recurring-plan-recovery.worker.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\recurring\recurring-plan-recovery.worker.ts | Isolated run for identified new QA rows required; no broad worker sweep |
| BB-COV-0151 | BACKGROUND_WORKER | policy-notification.cron.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\scheduler\policy-notification.cron.ts | Isolated run for identified new QA rows required; no broad worker sweep |
| BB-COV-0152 | BACKGROUND_WORKER | trust-snapshot.cron.ts | Claim/delivery/retry/concurrency/expiry and rollback behavior | internal scheduler / outbox | QA runtime disabled workers | source discovery; selected historical unit suites only | DISCOVERED_NOT_TESTED | beauty-booking-api-main\src\scheduler\trust-snapshot.cron.ts | Isolated run for identified new QA rows required; no broad worker sweep |

## API manifest

Each endpoint below is discovered, not acceptance-tested solely because it exists. Role/tenant guards and read/write effects must be reviewed before execution.

| Method | Route | Source | Status |
|---|---|---|---|
| GET | /api/v1/admin/settings | beauty-booking-api-main\src\admin\admin.controller.ts:32 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/admin/settings | beauty-booking-api-main\src\admin\admin.controller.ts:39 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/admin/settings/reset | beauty-booking-api-main\src\admin\admin.controller.ts:47 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/trust-snapshots | beauty-booking-api-main\src\admin\admin.controller.ts:57 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/admin/trust-snapshots/rebuild | beauty-booking-api-main\src\admin\admin.controller.ts:64 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/trust-actions | beauty-booking-api-main\src\admin\admin.controller.ts:71 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/admin/trust-actions | beauty-booking-api-main\src\admin\admin.controller.ts:78 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/audit-logs | beauty-booking-api-main\src\admin\admin.controller.ts:91 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/business-directory | beauty-booking-api-main\src\admin\admin.controller.ts:106 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/branch-directory | beauty-booking-api-main\src\admin\admin.controller.ts:179 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/compliance-queue | beauty-booking-api-main\src\admin\admin.controller.ts:264 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/finance-overview | beauty-booking-api-main\src\admin\admin.controller.ts:308 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/admin/marketing-overview | beauty-booking-api-main\src\admin\admin.controller.ts:333 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/ | beauty-booking-api-main\src\app.controller.ts:10 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/login | beauty-booking-api-main\src\auth\auth.controller.ts:72 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/register | beauty-booking-api-main\src\auth\auth.controller.ts:97 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/refresh | beauty-booking-api-main\src\auth\auth.controller.ts:113 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/verify-email | beauty-booking-api-main\src\auth\auth.controller.ts:132 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/forgot-password | beauty-booking-api-main\src\auth\auth.controller.ts:139 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/reset-password | beauty-booking-api-main\src\auth\auth.controller.ts:147 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/logout | beauty-booking-api-main\src\auth\auth.controller.ts:154 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/auth/change-password | beauty-booking-api-main\src\auth\auth.controller.ts:168 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/auth/sessions | beauty-booking-api-main\src\auth\auth.controller.ts:182 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/auth/sessions/:sessionId | beauty-booking-api-main\src\auth\auth.controller.ts:187 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/auth/sessions | beauty-booking-api-main\src\auth\auth.controller.ts:196 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/auth/security-history | beauty-booking-api-main\src\auth\auth.controller.ts:201 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/actual-time-grants | beauty-booking-api-main\src\bookings\bookings.controller.ts:221 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/actual-time-grants/:grantId/revoke | beauty-booking-api-main\src\bookings\bookings.controller.ts:228 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/:id/items/:itemId/actual-time | beauty-booking-api-main\src\bookings\bookings.controller.ts:236 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/:id/items/:itemId/actual-time | beauty-booking-api-main\src\bookings\bookings.controller.ts:243 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/self-booking-policy | beauty-booking-api-main\src\bookings\bookings.controller.ts:251 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/guest | beauty-booking-api-main\src\bookings\bookings.controller.ts:265 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings | beauty-booking-api-main\src\bookings\bookings.controller.ts:303 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/preview-price | beauty-booking-api-main\src\bookings\bookings.controller.ts:375 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings | beauty-booking-api-main\src\bookings\bookings.controller.ts:485 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/my-work-items | beauty-booking-api-main\src\bookings\bookings.controller.ts:609 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/my-work-items/:itemId | beauty-booking-api-main\src\bookings\bookings.controller.ts:620 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/my-appointments | beauty-booking-api-main\src\bookings\bookings.controller.ts:631 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/salon-queue | beauty-booking-api-main\src\bookings\bookings.controller.ts:725 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/salon-violations | beauty-booking-api-main\src\bookings\bookings.controller.ts:766 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/available-slots | beauty-booking-api-main\src\bookings\bookings.controller.ts:814 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/counter-slots | beauty-booking-api-main\src\bookings\bookings.controller.ts:841 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/scheduler | beauty-booking-api-main\src\bookings\bookings.controller.ts:871 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/stats | beauty-booking-api-main\src\bookings\bookings.controller.ts:902 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/by-category | beauty-booking-api-main\src\bookings\bookings.controller.ts:924 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/by-branch/:branchId | beauty-booking-api-main\src\bookings\bookings.controller.ts:937 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/by-customer/:userId | beauty-booking-api-main\src\bookings\bookings.controller.ts:948 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/:id | beauty-booking-api-main\src\bookings\bookings.controller.ts:982 | NOT_RUN (manifest, not behavior proof) |
| PUT | /api/v1/bookings/:id | beauty-booking-api-main\src\bookings\bookings.controller.ts:1033 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/:id/status | beauty-booking-api-main\src\bookings\bookings.controller.ts:1112 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/:id/force-cancel-preview | beauty-booking-api-main\src\bookings\bookings.controller.ts:1165 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/:id/move | beauty-booking-api-main\src\bookings\bookings.controller.ts:1209 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/:id/resize | beauty-booking-api-main\src\bookings\bookings.controller.ts:1229 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/:id/assign | beauty-booking-api-main\src\bookings\bookings.controller.ts:1243 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/:id/items | beauty-booking-api-main\src\bookings\bookings.controller.ts:1256 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/:id/items/:itemId | beauty-booking-api-main\src\bookings\bookings.controller.ts:1285 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/:id/change-requests | beauty-booking-api-main\src\bookings\bookings.controller.ts:1326 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/change-requests/:reqId/approve | beauty-booking-api-main\src\bookings\bookings.controller.ts:1349 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/bookings/change-requests/:reqId/reject | beauty-booking-api-main\src\bookings\bookings.controller.ts:1368 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/bookings/change-requests/pending | beauty-booking-api-main\src\bookings\bookings.controller.ts:1386 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/:id/refund | beauty-booking-api-main\src\bookings\bookings.controller.ts:1411 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/bookings/:id/checkin | beauty-booking-api-main\src\bookings\bookings.controller.ts:1439 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches | beauty-booking-api-main\src\branches\branches.controller.ts:59 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/manage | beauty-booking-api-main\src\branches\branches.controller.ts:77 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/locations/districts | beauty-booking-api-main\src\branches\branches.controller.ts:90 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/accessible | beauty-booking-api-main\src\branches\branches.controller.ts:96 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/accessible/:id | beauty-booking-api-main\src\branches\branches.controller.ts:103 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/:id/preview | beauty-booking-api-main\src\branches\branches.controller.ts:111 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/:id/services | beauty-booking-api-main\src\branches\branches.controller.ts:118 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/:id/reviews | beauty-booking-api-main\src\branches\branches.controller.ts:127 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/branches/:id | beauty-booking-api-main\src\branches\branches.controller.ts:136 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/branches/:id/status | beauty-booking-api-main\src\branches\branches.controller.ts:148 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/branches | beauty-booking-api-main\src\branches\branches.controller.ts:174 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/branches/:id/onboarding | beauty-booking-api-main\src\branches\branches.controller.ts:186 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/branches/:id/copy-services | beauty-booking-api-main\src\branches\branches.controller.ts:199 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/branches/:id/documents | beauty-booking-api-main\src\branches\branches.controller.ts:214 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/branches/:id/documents/:documentId | beauty-booking-api-main\src\branches\branches.controller.ts:236 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/branches/:id/submit | beauty-booking-api-main\src\branches\branches.controller.ts:249 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/branches/:id/review | beauty-booking-api-main\src\branches\branches.controller.ts:261 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/branches/:id/publish | beauty-booking-api-main\src\branches\branches.controller.ts:285 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/branches/:id/transition | beauty-booking-api-main\src\branches\branches.controller.ts:297 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/branches/:id | beauty-booking-api-main\src\branches\branches.controller.ts:338 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/business/onboarding/draft | beauty-booking-api-main\src\business\business.controller.ts:29 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/business/onboarding/config | beauty-booking-api-main\src\business\business.controller.ts:37 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/business/mobile-context | beauty-booking-api-main\src\business\business.controller.ts:44 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/business/onboarding/mine | beauty-booking-api-main\src\business\business.controller.ts:51 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/business/:businessId/onboarding | beauty-booking-api-main\src\business\business.controller.ts:58 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/business/:businessId/submit | beauty-booking-api-main\src\business\business.controller.ts:70 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/business/:businessId/review | beauty-booking-api-main\src\business\business.controller.ts:81 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/business/:businessId/detail | beauty-booking-api-main\src\business\business.controller.ts:93 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/business/:businessId/members | beauty-booking-api-main\src\business\business.controller.ts:191 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/business/:businessId/cancellation-policy | beauty-booking-api-main\src\business\business.controller.ts:206 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/business/:businessId/cancellation-policy | beauty-booking-api-main\src\business\business.controller.ts:219 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/combos/public | beauty-booking-api-main\src\combos\combos.controller.ts:17 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/combos | beauty-booking-api-main\src\combos\combos.controller.ts:22 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/combos/:id | beauty-booking-api-main\src\combos\combos.controller.ts:29 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/combos | beauty-booking-api-main\src\combos\combos.controller.ts:36 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/combos/:id | beauty-booking-api-main\src\combos\combos.controller.ts:44 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/combos/:id | beauty-booking-api-main\src\combos\combos.controller.ts:52 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/health | beauty-booking-api-main\src\health.controller.ts:9 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/health/live | beauty-booking-api-main\src\health.controller.ts:21 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/health/ready | beauty-booking-api-main\src\health.controller.ts:31 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/media/upload | beauty-booking-api-main\src\media\media.controller.ts:29 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/media/public/:id | beauty-booking-api-main\src\media\media.controller.ts:45 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/media/:id/content | beauty-booking-api-main\src\media\media.controller.ts:54 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/media/:id | beauty-booking-api-main\src\media\media.controller.ts:63 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/notifications | beauty-booking-api-main\src\notifications\notifications.controller.ts:36 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/notifications/unread-count | beauty-booking-api-main\src\notifications\notifications.controller.ts:63 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/notifications/:id/read | beauty-booking-api-main\src\notifications\notifications.controller.ts:73 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/notifications/read-all | beauty-booking-api-main\src\notifications\notifications.controller.ts:86 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/notifications/device-token | beauty-booking-api-main\src\notifications\notifications.controller.ts:96 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/notifications/device-token/remove | beauty-booking-api-main\src\notifications\notifications.controller.ts:115 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/operational-impacts | beauty-booking-api-main\src\operations\impact.controller.ts:28 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/operational-impacts/:id | beauty-booking-api-main\src\operations\impact.controller.ts:34 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/operational-impacts/:id/items/:itemId | beauty-booking-api-main\src\operations\impact.controller.ts:40 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/operational-impacts/:id/items | beauty-booking-api-main\src\operations\impact.controller.ts:46 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/operational-impacts/:id/complete | beauty-booking-api-main\src\operations\impact.controller.ts:52 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/ownership-transfers | beauty-booking-api-main\src\ownership\ownership.controller.ts:14 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/ownership-transfers/pending-for-me | beauty-booking-api-main\src\ownership\ownership.controller.ts:23 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/ownership-transfers/platform/pending | beauty-booking-api-main\src\ownership\ownership.controller.ts:28 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/ownership-transfers/:id/accept | beauty-booking-api-main\src\ownership\ownership.controller.ts:35 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/ownership-transfers/:id/submit-more-info | beauty-booking-api-main\src\ownership\ownership.controller.ts:40 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/ownership-transfers | beauty-booking-api-main\src\ownership\ownership.controller.ts:47 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/ownership-transfers/:id/cancel | beauty-booking-api-main\src\ownership\ownership.controller.ts:56 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/ownership-transfers/:id/review | beauty-booking-api-main\src\ownership\ownership.controller.ts:63 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/ownership-transfers/platform/legal-entity/:id/verify | beauty-booking-api-main\src\ownership\ownership.controller.ts:70 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/ownership-transfers/platform/payout-account/:id/verify | beauty-booking-api-main\src\ownership\ownership.controller.ts:77 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/ownership-transfers/:id/execute | beauty-booking-api-main\src\ownership\ownership.controller.ts:84 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/ownership-transfers/business/:businessId/versions | beauty-booking-api-main\src\ownership\ownership.controller.ts:91 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/ownership-transfers/business/:businessId/legal-entity | beauty-booking-api-main\src\ownership\ownership.controller.ts:99 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/ownership-transfers/business/:businessId/payout-account | beauty-booking-api-main\src\ownership\ownership.controller.ts:107 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments | beauty-booking-api-main\src\payments\payments.controller.ts:29 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/collect | beauty-booking-api-main\src\payments\payments.controller.ts:36 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments/providers | beauty-booking-api-main\src\payments\payments.controller.ts:47 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments/checkout/:bookingId | beauty-booking-api-main\src\payments\payments.controller.ts:54 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/transactions/:transactionId/verify | beauty-booking-api-main\src\payments\payments.controller.ts:61 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/transactions/:transactionId/reverse | beauty-booking-api-main\src\payments\payments.controller.ts:77 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments/policies | beauty-booking-api-main\src\payments\payments.controller.ts:97 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/policies | beauty-booking-api-main\src\payments\payments.controller.ts:104 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments/ledger | beauty-booking-api-main\src\payments\payments.controller.ts:111 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/platform-statements/generate | beauty-booking-api-main\src\payments\payments.controller.ts:125 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments/platform-statements | beauty-booking-api-main\src\payments\payments.controller.ts:135 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/payments/platform-statements/:id/status | beauty-booking-api-main\src\payments\payments.controller.ts:142 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments/packages | beauty-booking-api-main\src\payments\payments.controller.ts:153 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/packages | beauty-booking-api-main\src\payments\payments.controller.ts:163 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/packages/:packageId/purchases | beauty-booking-api-main\src\payments\payments.controller.ts:174 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/payments/package-purchases | beauty-booking-api-main\src\payments\payments.controller.ts:188 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/package-installments/:installmentId/pay | beauty-booking-api-main\src\payments\payments.controller.ts:198 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/package-purchases/:purchaseId/sessions/reserve | beauty-booking-api-main\src\payments\payments.controller.ts:212 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/:paymentId/refund-requests | beauty-booking-api-main\src\payments\payments.controller.ts:227 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/payments/refunds/:refundId/review | beauty-booking-api-main\src\payments\payments.controller.ts:239 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/payments/refunds/:refundId/process | beauty-booking-api-main\src\payments\payments.controller.ts:251 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/platform-settings/public | beauty-booking-api-main\src\platform-settings\platform-settings.controller.ts:9 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/privacy/center | beauty-booking-api-main\src\privacy\privacy.controller.ts:24 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/privacy/data-requests | beauty-booking-api-main\src\privacy\privacy.controller.ts:32 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/privacy/marketing-preferences | beauty-booking-api-main\src\privacy\privacy.controller.ts:39 | NOT_RUN (manifest, not behavior proof) |
| PUT | /api/v1/privacy/marketing-preferences | beauty-booking-api-main\src\privacy\privacy.controller.ts:46 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/privacy/exports/:id/download | beauty-booking-api-main\src\privacy\privacy.controller.ts:56 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/promotions | beauty-booking-api-main\src\promotions\promotions.controller.ts:44 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/promotions/service/:serviceId | beauty-booking-api-main\src\promotions\promotions.controller.ts:66 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/promotions | beauty-booking-api-main\src\promotions\promotions.controller.ts:78 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/promotions/:id | beauty-booking-api-main\src\promotions\promotions.controller.ts:132 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/promotions/:id | beauty-booking-api-main\src\promotions\promotions.controller.ts:148 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/vouchers/mine | beauty-booking-api-main\src\promotions\vouchers.controller.ts:34 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/vouchers | beauty-booking-api-main\src\promotions\vouchers.controller.ts:45 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/vouchers | beauty-booking-api-main\src\promotions\vouchers.controller.ts:56 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/vouchers/:id | beauty-booking-api-main\src\promotions\vouchers.controller.ts:82 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/vouchers/:id/grant | beauty-booking-api-main\src\promotions\vouchers.controller.ts:98 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/vouchers/:id | beauty-booking-api-main\src\promotions\vouchers.controller.ts:117 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/recurring/preview | beauty-booking-api-main\src\recurring\recurring.controller.ts:16 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/recurring | beauty-booking-api-main\src\recurring\recurring.controller.ts:22 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/recurring/mine | beauty-booking-api-main\src\recurring\recurring.controller.ts:29 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/recurring/:id/status | beauty-booking-api-main\src\recurring\recurring.controller.ts:35 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/recurring/:id/occurrences/:bookingId | beauty-booking-api-main\src\recurring\recurring.controller.ts:42 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/recurring/:id | beauty-booking-api-main\src\recurring\recurring.controller.ts:49 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/overview | beauty-booking-api-main\src\reports\reports.controller.ts:25 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/owner-dashboard | beauty-booking-api-main\src\reports\reports.controller.ts:35 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/revenue | beauty-booking-api-main\src\reports\reports.controller.ts:62 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/financial-summary | beauty-booking-api-main\src\reports\reports.controller.ts:75 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/categories | beauty-booking-api-main\src\reports\reports.controller.ts:94 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/services | beauty-booking-api-main\src\reports\reports.controller.ts:101 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/top-salons | beauty-booking-api-main\src\reports\reports.controller.ts:108 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/user-growth | beauty-booking-api-main\src\reports\reports.controller.ts:117 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reports/staff-performance | beauty-booking-api-main\src\reports\reports.controller.ts:124 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reviews/business/:businessId | beauty-booking-api-main\src\reviews\reviews.controller.ts:41 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reviews/manage | beauty-booking-api-main\src\reviews\reviews.controller.ts:59 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reviews/staff/:staffId | beauty-booking-api-main\src\reviews\reviews.controller.ts:74 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reviews/public/staff/:staffId | beauty-booking-api-main\src\reviews\reviews.controller.ts:90 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/reviews/service/:serviceId | beauty-booking-api-main\src\reviews\reviews.controller.ts:96 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/reviews | beauty-booking-api-main\src\reviews\reviews.controller.ts:106 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/reviews/:id/report | beauty-booking-api-main\src\reviews\reviews.controller.ts:147 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/reviews/:id/reply | beauty-booking-api-main\src\reviews\reviews.controller.ts:163 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/reviews/:id/moderate | beauty-booking-api-main\src\reviews\reviews.controller.ts:189 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/reviews/:id/appeals | beauty-booking-api-main\src\reviews\reviews.controller.ts:204 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/reviews/appeals/:appealId | beauty-booking-api-main\src\reviews\reviews.controller.ts:216 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/ | beauty-booking-api-main\src\saved-services\saved-services.controller.ts:14 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/ | beauty-booking-api-main\src\saved-services\saved-services.controller.ts:19 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1//:serviceId | beauty-booking-api-main\src\saved-services\saved-services.controller.ts:24 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1//:serviceId | beauty-booking-api-main\src\saved-services\saved-services.controller.ts:29 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/search | beauty-booking-api-main\src\services\services.controller.ts:70 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/canonical | beauty-booking-api-main\src\services\services.controller.ts:98 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/canonical/manage | beauty-booking-api-main\src\services\services.controller.ts:104 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services/canonical | beauty-booking-api-main\src\services\services.controller.ts:111 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/services/canonical/:id | beauty-booking-api-main\src\services\services.controller.ts:119 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/categories | beauty-booking-api-main\src\services\services.controller.ts:128 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/categories/manage | beauty-booking-api-main\src\services\services.controller.ts:134 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services/categories | beauty-booking-api-main\src\services\services.controller.ts:143 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services | beauty-booking-api-main\src\services\services.controller.ts:152 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/manage | beauty-booking-api-main\src\services\services.controller.ts:162 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/workspace/manage | beauty-booking-api-main\src\services\services.controller.ts:176 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services/catalog | beauty-booking-api-main\src\services\services.controller.ts:187 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/services/catalog/:id | beauty-booking-api-main\src\services\services.controller.ts:197 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/services/catalog/:id | beauty-booking-api-main\src\services\services.controller.ts:214 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services/catalog/:id/branches/:branchId/:action | beauty-booking-api-main\src\services\services.controller.ts:227 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/services/offerings/:id/status | beauty-booking-api-main\src\services\services.controller.ts:248 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/services/offerings/:id/pricing | beauty-booking-api-main\src\services\services.controller.ts:265 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/admin-curated/all | beauty-booking-api-main\src\services\services.controller.ts:282 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/:id/variants | beauty-booking-api-main\src\services\services.controller.ts:289 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services/:id/variants | beauty-booking-api-main\src\services\services.controller.ts:295 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/services/variants/:variantId | beauty-booking-api-main\src\services\services.controller.ts:309 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services/:id/dependencies | beauty-booking-api-main\src\services\services.controller.ts:327 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services/:id/price-rules | beauty-booking-api-main\src\services\services.controller.ts:341 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/services/:id | beauty-booking-api-main\src\services\services.controller.ts:355 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/services | beauty-booking-api-main\src\services\services.controller.ts:362 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/services/:id | beauty-booking-api-main\src\services\services.controller.ts:372 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/services/:id | beauty-booking-api-main\src\services\services.controller.ts:395 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/staff/invitations | beauty-booking-api-main\src\staff\staff.controller.ts:80 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/invitations | beauty-booking-api-main\src\staff\staff.controller.ts:93 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/invitations/context | beauty-booking-api-main\src\staff\staff.controller.ts:107 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/staff/invitations/accept | beauty-booking-api-main\src\staff\staff.controller.ts:114 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/staff/invitations/accept-existing | beauty-booking-api-main\src\staff\staff.controller.ts:122 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/staff/invitations/:invitationId/resend | beauty-booking-api-main\src\staff\staff.controller.ts:130 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/staff/invitations/:invitationId/email | beauty-booking-api-main\src\staff\staff.controller.ts:141 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/staff/invitations/:invitationId | beauty-booking-api-main\src\staff\staff.controller.ts:153 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/public | beauty-booking-api-main\src\staff\staff.controller.ts:168 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/public/:id | beauty-booking-api-main\src\staff\staff.controller.ts:175 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/me | beauty-booking-api-main\src\staff\staff.controller.ts:181 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff | beauty-booking-api-main\src\staff\staff.controller.ts:193 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/:id | beauty-booking-api-main\src\staff\staff.controller.ts:212 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/staff | beauty-booking-api-main\src\staff\staff.controller.ts:233 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/staff/:id | beauty-booking-api-main\src\staff\staff.controller.ts:261 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/staff/:id/branch-assignments | beauty-booking-api-main\src\staff\staff.controller.ts:282 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/staff/:id | beauty-booking-api-main\src\staff\staff.controller.ts:308 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/:id/offboarding-impact | beauty-booking-api-main\src\staff\staff.controller.ts:322 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/staff/branches/:branchId/holidays | beauty-booking-api-main\src\staff\staff.controller.ts:334 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/staff/branches/:branchId/special-days | beauty-booking-api-main\src\staff\staff.controller.ts:347 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/:id/services | beauty-booking-api-main\src\staff\staff.controller.ts:368 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/staff/:id/services | beauty-booking-api-main\src\staff\staff.controller.ts:383 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/staff/:id/commission | beauty-booking-api-main\src\staff\staff.controller.ts:409 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/users/me/profile | beauty-booking-api-main\src\users\users.controller.ts:35 | NOT_RUN (manifest, not behavior proof) |
| PATCH | /api/v1/users/me/profile | beauty-booking-api-main\src\users\users.controller.ts:42 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/users | beauty-booking-api-main\src\users\users.controller.ts:55 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/users/:id | beauty-booking-api-main\src\users\users.controller.ts:90 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/users/:id/suspension-impact | beauty-booking-api-main\src\users\users.controller.ts:110 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/users/:id/suspend | beauty-booking-api-main\src\users\users.controller.ts:117 | NOT_RUN (manifest, not behavior proof) |
| GET | /api/v1/users/:id/permissions | beauty-booking-api-main\src\users\users.controller.ts:129 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/users/:id/permissions | beauty-booking-api-main\src\users\users.controller.ts:136 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/users/:id/permissions/:permissionCode | beauty-booking-api-main\src\users\users.controller.ts:152 | NOT_RUN (manifest, not behavior proof) |
| POST | /api/v1/users/:id/roles | beauty-booking-api-main\src\users\users.controller.ts:168 | NOT_RUN (manifest, not behavior proof) |
| DELETE | /api/v1/users/:id/roles/:roleCode | beauty-booking-api-main\src\users\users.controller.ts:185 | NOT_RUN (manifest, not behavior proof) |

## Backend suite inventory

117 backend spec files discovered. Prior122 tests belonged to11 selected suites; no universal acceptance claim. Integration suites need explicit database/transport guards; unit candidates are not automatically classified safe.

- beauty-booking-api-main\src\admin\trust-snapshot.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\app.controller.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\account-separation.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\auth-mobile-challenge.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\auth-remediation.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\auth-workspace.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\auth.controller.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\auth.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\dto\auth.dto.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\auth\token-blacklist.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\actual-time-corrections.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\available-slots-policy.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-actual-timing.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-item-lifecycle.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-item-values.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-lead-channel.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-overrun.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-postcommit.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-provider-audit.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\booking-role-refactor.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings-access.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings-channel-policy.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings-tenant-scope.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings-time-guard.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings-voucher-lifecycle.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings.controller.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings.scheduler.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bookings.validation.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\bulk-assignment-integrity.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\change-request-expiry.worker.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\change-requests.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\customer-booking-policy.integration.spec.ts — integration_requires_guarded_environment — NOT_RUN this run
- beauty-booking-api-main\src\bookings\customer-booking-policy.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\customer-cancellation-policy.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\customer-change-request.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\dto\bookings.dto.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\late-cancellation-approval.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\mobile-owner-finance-guard.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\no-show-policy.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\pending-execution-expiry.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\bookings\postgres-hardening.integration.spec.ts — integration_requires_guarded_environment — NOT_RUN this run
- beauty-booking-api-main\src\bookings\staff-work-items.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\branches\branch-state.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\branches\branches-mobile-scope.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\branches\branches-onboarding.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\branches\branches-preview.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\branches\branches-transition.controller.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\branches\branches.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\business\business-mobile-context.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\business\business-onboarding.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\business\cancellation-policies.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\business\salon-members.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\combos\combos.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\filters\prisma-exception.filter.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\guards\guards.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\guards\user-aware-throttler.guard.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\interceptors\idempotency.interceptor.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\permissions\administrative-role-scope.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\permissions\controller-metadata.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\permissions\management-role-scope.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\permissions\manager-migration.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\permissions\openapi-contract.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\permissions\permission-catalog.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\permissions\resource-bound-permissions.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\security\serialization-contract.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\utils\booking-datetime.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\utils\multi-tenancy.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\utils\name-search.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\utils\notify.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\utils\policy.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\common\utils\serializable-transaction.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\mail\mail.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\main.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\media\media-access.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\media\media.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\notifications\notification-outbox-retry.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\notifications\notification-outbox.worker.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\notifications\notifications-pagination.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\operations\impact-deadline.worker.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\operations\impact.controller.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\operations\impact.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\ownership\ownership.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\payments\financial-metrics.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\payments\payments.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\platform-settings\platform-settings.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\prisma\account-separation.integration.spec.ts — integration_requires_guarded_environment — NOT_RUN this run
- beauty-booking-api-main\src\prisma\audit-integrity.integration.spec.ts — integration_requires_guarded_environment — NOT_RUN this run
- beauty-booking-api-main\src\prisma\health-archive.integration.spec.ts — integration_requires_guarded_environment — NOT_RUN this run
- beauty-booking-api-main\src\prisma\manager-retirement.integration.spec.ts — integration_requires_guarded_environment — NOT_RUN this run
- beauty-booking-api-main\src\prisma\schema-alignment.integration.spec.ts — integration_requires_guarded_environment — NOT_RUN this run
- beauty-booking-api-main\src\privacy\privacy-center.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\privacy\sensitive-data-cipher.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\promotions\campaign-ownership.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\promotions\pricing-engine.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\promotions\promotion-quota.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\recurring\recurring-creation-fence.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\recurring\recurring-plan-recovery.worker.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\recurring\recurring.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\reports\owner-dashboard.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\reviews\review-moderation.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\reviews\reviews-public-identity.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\reviews\reviews-public-summary.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\reviews\reviews.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\saved-services\saved-services.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\scheduler\scheduler-reauthorization.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\scheduler\scheduler-socket-transport.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\scheduler\scheduler.gateway.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\scheduler\trust-snapshot.cron.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\services\service-price-rules.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\services\services.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\staff\bookable-staff.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\staff\staff-invitations.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\staff\staff-mobile-profile.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\staff\staff.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\users\dto\update-self.dto.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\users\users-suspension.spec.ts — unit_candidate_requires_review — NOT_RUN this run
- beauty-booking-api-main\src\users\users.service.spec.ts — unit_candidate_requires_review — NOT_RUN this run


## Actual verification overlays — 08/10 continuation

| Scope | Evidence | Result | Remaining gap |
|---|---|---|---|
| Customer/owner/receptionist/staff/admin login, role shell, notifications | strict-2026-10-08T05-04-05-935Z/results.json |20PASS; source-bound strictnewrun| Other routes/actions/E2E not implied |
| Account lock/open→scopedoutbox→2workers→recipientAPI/UI/read/badge/target | outbox-885f0d63-842e-48f7-b119-5561739e4a9c/results.json |13actualchecks +4browsercases PASS| Other producer events/reconnect/native pending |
| Backend selected safeunit+reviewedloopbacksockettransport | backend-unit-auth-final-20261008.json |114suite /1113tests PASS|7databaseintegration NOT_RUN; notfullE2E |
| Nativecustomer/staff/owner |adb devices empty;Metro8081absent|BLOCKED_NATIVE_DEVICE|Connectdevelopmentdevice/emulator and verifybuild/endpoint |
| Payment/finance workspace |Productdecision|EXCLUDED_PAYMENT_SCOPE|Keptimplementation/data; no paymentacceptance thisphase|
| BackendAPImanifest/remainingroutes/forms |Staticinventory|DISCOVERED_NOT_TESTED|Do notinferPASS fromexistence/viewport|

The historical76browsercases are not reclassified as complete acceptance by these overlays. Authsame-second baseline401 and allrawfailures remain traceable in remediationreport.


## Overlay đợt booking/counter

| ID | Vai trò | Luồng/thao tác | API/trạng thái | Loại kiểm thử | Kết quả | Evidence | Còn thiếu |
|---|---|---|---|---|---|---|---|
| BB-LIVE-BOOK-01 | Customer QA mới | Public service→staff→slot→contact/consent→policy→rapid confirm→reload | one POST201, one DB booking PENDING |Actual browser+API+DB|6 browser cases +10 checks PASS|booking-38764f5d-0bfa-4492-83a0-251b53c436d2|Unknown commit/race/registration OTP not tested|
| BB-LIVE-BOOK-02 | Owner/receptionist/staff | Confirmed read; owner confirm/cancel; retained cancelled views |BB0100099, one CONFIRMED +one CANCELLED; foreign403; capacity released|Actual UI+API+DB proof chain|Mutation receipts retained; final9 browser cases +8 checks PASS|booking-followup-4ff6e13a-3c2b-4bed-b8b3-fffd4675f40f +raw earlier runs|Customer cancel/reschedule and held auto-sync not proven|
| BB-LIVE-COUNTER-01 | Receptionist | Walk-in ngoài giờ |400 đúngreason; zero booking/shadow guest|Actual API+DB|5PASS after atomic fix|walkin-closed-8462d00e-324c-4438-8b8e-f360739defae|Positive now/check-in/start/complete not run|
| BB-LIVE-COUNTER-02 | Receptionist | PHONE counter future +cancel same new record |201 commit guest/booking;200 cancel; no payment|Actual API+DB|8PASS|counter-phone-b1aaf6df-6c32-4840-b25c-f782a3c22b80|PHONE UI and natural walk-in not inferred|
| BB-REGRESSION-02 | Backend |Full reviewed safe unit+loopback transport|7 DBintegration excluded|Unit/transport|116 suites /1125 PASS|backend-counter-final.json|DB integration/E2E not implied|
| BB-REGRESSION-03 | Web |Socket endpoint/burst/terminal controls +existing helpers|No weakened policy/quota|Unit/build|121PASS; buildPASS|web-booking-fixes-tests.log +web-terminal-build-status.json|Remaining screens/forms still discovered/not-tested|

GET /api/v1/bookings/scheduler/batch was added: authenticated same role/permission contract as single scheduler; authorize entire branch set before payloads; max50branch/92days per request. Initial static API manifest260 predates this added endpoint; effective count now261. New backend src spec files include token-revocation precision, scheduler batch and atomic walk-in; initial117 inventory is historical, not current test count. No product completion percentage is derived from these counts.


## Overlay 09/10 — PDF/media/storage/search/session context

| ID | Vai trò | Luồng/thao tác | Trạng thái/API | Loại | Kết quả | Evidence | Còn thiếu |
|---|---|---|---|---|---|---|---|
| BB-PDF-READ-01 | Admin/foreign owner/public | Hai bản PDF hai trang, current/history ở4width | private bytes exact; foreign403/public404 |Actual API/DB/browser +visual review|22 browser +11 API/DB PASS|pdf-readable-ac1cff4d-25ef-4541-8bb9-280e0b34aa54/results.json|Encrypted/corrupt/scan-only acceptance NOT_RUN|
| BB-MEDIA-READ-01 | Owner/public | Ngang/dọc/large, reload/gallery/crop, gỡ QA secondary |3 images first,2retained; exact primary/IDs |Actual API/browser/DB +visual|11 browser +15 API/DB PASS|media-readable-58c4eae0-e0e3-4290-96fe-018079874a9e/results.json|Other branches/full gallery edit/reorder not inferred; QA images not production asset count|
| BB-MEDIA-DECODE-01 | API | Magic/truncated/MIME/ext/size/pixels/static/concurrency/rollback |Before FS/DB writes |Unit with real temp FS/Sharp; API corrupt separately|PASS; included in1142|media-storage.spec +backend-media-regression.json|PDF structure decode not implemented; crash/OS-failure broader cases not inferred|
| BB-OWNER-CONTEXT-01 | Owner | New draft alongside approved business |mine keeps selected business +owner scope |Unit +actual API/browser|PASS after fix|business-onboarding-context.spec +filter-live-1791557058420.json|Full business switch UI/manager NOT_RUN|
| BB-SEARCH-02 | Public/customer | No-diacritic area/service; exact district/category/price/page |SQL text IDs; scope/paging retained |Unit +actual API|7PASS live; SQL500 preserved/closed|filter-live-1791557058420.json|Positive combined area/district/service NOT_RUN: base district null; booking filter live UI not separately exercised|
| BB-STORAGE-02 | Local QA | Prefix/24h inventory dry-run |56 files /0candidate /0missing |Actual readonly DB/FS +temp unit|PASS|storage-inventory-live.json|No automatic deletion; orphan process-crash simulation not actual OS crash|
| BB-STORAGE-03 | Local QA/public | Copy4QAfiles→new backup/restore; read afterrestart |Hash exact;2public API bytes exact |Actual file/API/DB|12PASS|media-backup-d489efce-6bdf-48db-83cc-33a20cd3b090/results.json|File-byte test, no database restore/redeploy production|
| BB-REGRESSION-04 | API/web |Reviewed safe suite list +4 new; build/typecheck |DB impossible target for unit |Unit/loopback FS/transport/build|120 suites1142API tests;121web tests PASS|backend-media-regression.json;media-gate-web-status.json|7DBintegration excluded; no completion percentage derived|
| BB-NATIVE-02 | Customer/owner/staff |Real app runtime |adb empty;Metro8081 absent |Environment inspection|BLOCKED_NO_CONNECTED_DEVELOPMENT_DEVICE|09/10 adb output preserved in turn/checkpoint|Need connected devdevice/build;375web not native|

Source binding: HEAD38c5fb68859135c9a8c458eb053d894a92eb97be, dirtysrcSHA2ca699f204537d392d293953f0de15547912a3269561266d9dcbefc675630776. All paths above under report-output/bugreport-remediation unless source-test names. Selected proof/limits/package hashes: delivery-media-storage-20261009.json. Prior overlays remain historical and are not rewritten to make the whole product PASS. Next priorities and current FAIL/BLOCKED/NOT_RUN are in the matching remediation section.


### Overlay bổ sung natural lifecycle /controlled preview —09/10

| ID | Vai trò | Luồng/thao tác | API/dữ liệu | Loại | Kết quả | Evidence | Giới hạn |
|---|---|---|---|---|---|---|---|
| BB-PDF-ERROR-01 | Admin |PDF cắt cụt→thông báo/tải, không blank frame |Authorized200 prerequisite; controlled replacement response |Negative UI, **not product PDF validity**|4 browser PASS|pdf-fallback-92f37aeb-ea57-439e-9e5f-763807b8d999|No encrypted/scan-only proof|
| BB-WALKIN-NATURAL-01 | Owner/assigned STAFF |Next-minute WALK_IN→real clockwait→CHECKED_IN→START→COMPLETE item |BB0100101; only1guest/book; audit times; unpaid parent409 retained |Actual API/DB; **new facility/staff seeded prerequisite**|21PASS|walkin-natural-5dce5023-86bb-4328-8466-fa5ec4e1a14a|No branch approval acceptance; no actual treatment/payment; parentIN_PROGRESS|
| BB-WALKIN-RETRY-01 | Owner |Samekey retry; occupied slot different guest |SameUUID201; conflict409 zeroorphan |Actual API/DB|PASS within21|same natural evidence|Not simultaneous online race or timeout lostresponse|
| BB-WALKIN-UI-01 | Owner web |Readonly exact drawer/actual vs planned at4width |Exact item COMPLETED, parentIN_PROGRESS |Actual browser/API +visual |6PASS|walkin-read-ad122e44-6ba1-4d57-95fa-c123f9a2bd20|Staff API proven, staff/native UI NOT_RUN; no write by browser|

Previous positive natural counter gap is covered by these narrowly stated cases; other prior NOT_RUN rows remain unchanged/historical. No combined pass total is used as a product completion percentage. Application source SHA remains2ca699f204537d392d293953f0de15547912a3269561266d9dcbefc675630776.

## Overlay customer lifecycle —09/10 continuation

| ID | Scope | Actual proof | Result | Gap |
|---|---|---|---|---|
| BB-CUSTOMER-RACE-01 |Two new QA customers, same staff/slot concurrent|201/409,1DBbooking, loser403|PASS within10checks|Not durable replay after process restart|
| BB-CUSTOMER-LIFECYCLE-01 |Customer UI change/cancel/rebook; owner APIconfirm/approve|BB0100106/0100107; exactrequest APPROVED; bothhistoriesretainedCANCELLED|15browser+10checksPASS|RegistrationOTP/payment excluded|
| BB-CUSTOMER-HELD-01 |Held detail status/newdate|No input/reload while owner changes; actualAPIreadback|PASS after fix|Native not implied|
| BB-CUSTOMER-OFFLINE-01 |Browser offline/online list|Same list latestCONFIRMED afterrestore|LIMITED:42ms offline|Need positive failedrequest/socketclose proof before fullreconnect claim|
| BB-CUSTOMER-REGRESSION-01 |Hook/session/context +controller +webbuild|5hook tests,12controller,126webtests|PASS|Previous1142APItests historical; no fullproduct percentage|

Selected evidence: report-output/bugreport-remediation/customer-lifecycle-88c3c3ca-44f6-4cc2-9fa1-4a8069da00d6/results.json. SourceSHA a2967e88784bcd91d4989b80da5847d484996d92dd57d0ac0336ea4bd73a1e22. All raw failures and cleanup continuation retained; no historicalrow deleted.


## Overlay 10/10 — kết quả tại checkpoint, không thay lịch sử

| ID | Vai trò/luồng | Proof / loại | Kết quả | Evidence dưới report-output/bugreport-remediation | Giới hạn |
|---|---|---|---|---|---|
| BB-TRANSPORT-01 |Customer booking commit→lost response→reload→same journal replay|Actual backend+browser controlled response fault;1DB row|12browser+4checksPASS|transport-331cc13c-2caf-4bc8-b633-b14522ec933b/results.json|No API-restart durability/native proof|
| BB-RECONNECT-02 |Held customer detail offline ownerCONFIRM then restore|Positive failed HTTP+navigatorfalse,2.6sec disconnect;APIrefetch no input|PASS within transport run|held-offline-pending/held-recovered screenshots|Browser only;not production latencySLA|
| BB-LEGAL-01 |Explicit subject/representative catalog; legacy and wrong new data|Unit+API actual; no guessed backfill|PASS scoped|legal-registration.spec.ts;legal-flow selected|Shape only;identity not verified; allsubjectlive NOT_RUN|
| BB-LEGAL-SHARED-01 |Draft cannot rewrite shared owner identity under approved business|Guarded transaction409,no newbusiness/profile changes|PASS live+unit|legal-flow selected|Independent perbusiness legal identities not implemented|
| BB-REVIEW-02 |Draft→submit→info→documentv2→resubmit→competing decisions|Actual API/DB and owner browser|30checks+9browserPASS|legal-flow-3cd0898f-5e14-4ccc-a6e2-1cf07fc1d894/results.json|Verified-owner seeded;OTP/signup/adminmutationUI NOT_RUN|
| BB-REVIEW-INPUT-01 |Unknown decision/whitespace reason|Source+unit reproduced3FAIL then fixed|PASS|business-review-input-baseline.json;legal-notification-unit-final.json|Do not claim baselineHTTP500|
| BB-REVIEW-NOTIFY-01 |Review result→outbox→2workers→owner list/read/target;foreign isolation|Actual restricted-worker delivery+browser;2SENT/2notifications|PASS|selected legal flow; prior missing-notification baseline|Other event producers not covered;external channels off|
| BB-LEGAL-ADMIN-02 |Admin actual classification +current readableprivatePDFv2|Readonly browser375/1440,realcanvas/text|6PASS|legal-admin-47d05a4a-f0c5-4772-9fe6-2c45e4c22456/results.json|Reviewbuttons not exercised|
| BB-LEGAL-TAX-UI-01 |Legacy10 exception conditional TAX_DOCUMENT checklist|MockedtransportUI4widths+helper|5Playwright incl prior save testPASS;13helperPASS|legal-checklist-ui.log|Not actual exception dossier submission|
| BB-REGRESSION-05 |Reviewedsafe backend suites;web unit/build;APItype/build|123suites1171unitPASS;131webPASS;buildsPASS|PASS|backend-legal-final.json;final-api/web-status.json|Separate fromDB/native/full-product acceptance|
| BB-DB-READONLY-01 |Manager conversion/defaults/archives/FKmetadata|PostgreSQL read-only enforced59allowlistedcases|58PASS1FAIL;runnerexit1|db-readonly-summary.json|79othersskipped;3write suites not run|
| BB-DB-HISTORY-01 |Two original historicalconsents retained|Actual readonly archive0rows|BLOCKED fixture;rawassertionFAIL retained|health-archive-fixture-readback.json|Need correct rehearsal history;do not synthesizepastconsents|
| BB-NATIVE-03 |Customer/staff/owner runtime|adb device inventory empty|BLOCKED_NO_CONNECTED_DEVELOPMENT_DEVICE|checkpoint notes|No native acceptance inferredfromweb375|

Source binding and exact failure classifications are recorded in remediation checkpoint10/10. All prior discovery rows remain historical; overlay does not label all routes/buttons tested. Finance/payment remains EXCLUDED.


### Overlay 10/10 — kết quả tiếp theo

| ID | Vai trò/flow | Loại / proof | Result | Evidence | Gap |
|---|---|---|---|---|---|
| BB-AVAILABILITY-RACE-01 |Customer branchcatalog/date slots latest request|Mockedtransport Chromium375/1440;late success/error500|6/6PASS|booking-request-race-ready.log +screenshots|Not real backend/race STAFF/sessionexpiry|
| BB-BRANCH-REVIEW-ATOMIC-01 |Adminbranchreview state/request/event/document/outbox|Realstate service with transaction unit;stale/outbox fault/input guard|5suites59PASS|branch-review-selected.json|Unit failure injection not actualDBfault|
| BB-BRANCH-REVIEW-NOTIFY-01 |Three decisions+race→activeowner→restrictedworker→unread API|4newseededpendingbranches,27checks,4SENT/4notices,public404|PASS|branch-review-f0940985-dd90-400e-bfd3-d0fd636b8a1a/results.json|No branchwizard submit/signup;ownerUIclick/native NOT_RUN|

This overlay does not close staff reassignment/branch-operation/review moderation event matrix or every form/action. Historical failures and prerequisites remain in remediation document.


Final gate10/10: backend124suites1179PASS on srcSHA b31c1ff812825e5c653a01974c93878bbd2377588ce2ec15edfe9c5398c045a3;web131PASS/buildPASS;APItype/buildPASS. DBreadonly58PASS/1fixtureFAIL preserved. Machine checkpoint `report-output/bugreport-remediation/checkpoint-20261010.json` has wholeProductComplete=false. Reassignment durable producer source gap, allform action/session/native/productionrestore coverage remains pending as listed; no product completion percentage.


## Overlay11/10 — exactproofs và sourcefixes mới

| ID | Role/flow | Type/proof | Result | Evidence dưới report-output/bugreport-remediation | Limit |
|---|---|---|---|---|---|
| BB-ASSIGN-PRODUCER-01 |Item/bulk/customerSTAFF_CHANGE→currentprovider |Oldcompiledaudit1/outbox0;new6outboxes/2actualworkerinstances;exactold/newscope |20actualchecksPASS |provider-regression-4b5a3878-5934-4d79-b038-4d6f18f3a3ba/results.json |1ownedQAbooking;seededbranch/profiles prerequisite;nofinance;4priorQAoutboxesleftpendingexcluded |
| BB-ASSIGN-UI-01 |Current/formerSTAFF notification/list→bookingpermission |4fixedcontexts375/1440;exact3rows;current200/former403,nosummarydisclosure |16strictbrowserPASS |provider-read-fixed-0126814b-b776-4ccb-ba53-8b948b974120/results.json |readonly;actualmarkonce proofseparateoldrole6cases frominterrupteddriver |
| BB-NOTIFICATION-WEB-02 |Race/read/readall/pagination/linkscope |Newcontroller+helper;mockedtransport375/1440 |147fullwebPASS+build;mockUI2widthPASS |web-notification-final-status.json;notification-ui-1791717570705/evidence.json |NoadditionalrealwritesfrommockUI;routeparitylatepatch16unitPASS |
| BB-NOTIFICATION-MOBILE-01 |Customerloadmore/readall;opsbusy/context/session/count |Actualhelpers/hooks/component surfaces withmocks |Scoped134PASSbeforefinalcountfix;21helperPASSafter;typecheckPASS |mobile-notification-current-status.json/log finalcounts |No native runtime;device absent |
| BB-OWNER-NOTIFY-BRANCH-01 |OwnedBbookingnotificationwhileAselected |Explicitnotificationdetail scope;backendAPI/allowliststillboundbusiness;actionsverifyB |Scopedmock114PASS;includedlatercombo |mobile/tests/owner-operations.test.cjs |BOOKINGonly;Impactnotification remainsselectedcontext/nativeNOT_RUN |
| BB-REVIEW-INPUT-01 |Report/reply/appeal/moderateinvalidtypes |4actual500baseline→4actual400;fakeIDsneverexist |PASSnegativeAPI |reviews-input-regression-dabf9169-4902-47e9-982f-afa8213b43b1/results.json |No validreviewdecision action executed |
| BB-REVIEW-CREATE-INPUT-01 |Starsinteger/comments/anon/service array |8unitredbeforefix;6actual400+validunknown404 |31selectedunitPASS;7negativeAPIchecksPASS |reviews-all-input-final.json;reviews-input-creation-19cc1caf-fe02-4fcf-9379-c137b3a70266/results.json |Positivecompletionrequiresfinanceinteraction;didnotstagefakecompletedbooking |
| BB-CRASH-ORPHAN-01 |Processstopsafterdiskbeforemetadata |RealMediaService/FS/childSIGKILL;metadataDBmock;ownmtimeage;dryrunonly |PASSbounded |storage-crash-bee390b8-49e8-4157-a4ac-66159dc1d94e/results.json |Not wholeNest/productionDBcrash;no filedeletion |

Correction: branch-review10/10 harness called overlapping drains ononeinstance; uselegal10/10/provider11/10twoinstances for distributedworkerproof. HistoricalPASSentries remain, wording corrected rather than erased. Current fullgate/sourcehash in final11/10 checkpoint summary, wholeProductComplete=false.


## Overlay11/10 tiếp tục — bằng chứng mới

| ID | Role/flow | Test / result | Evidence trong report-output/bugreport-remediation | Limit |
|---|---|---|---|---|
| BB-NOTIFICATION-SEARCH-01 |Staff self notice title/body, accent/filter/page |5 actualAPI checks;40 strictbrowser cases PASS ở4widths |notification-search-live.json;provider-read-fixed-7d51872b-a63b-42ca-a7f1-fa656ade898a/results.json |No business writes; native NOT_RUN; no production query-performance claim |
| BB-ACCOUNT-SEPARATION-DB-01 |Customer/operational role grants |6 actualPostgreSQL integration PASS;all prior user/grant hashes same |account-separation-db-summary.json |Only new suite accounts cleaned; separate from unit gate |
| BB-SESSION-EXPIRY-UI-01 |Staff loaded notices→expire→clear→reauth |10 actualAPI+Edge cases PASS375/1440 |session-expiry-ce0481bf-06a5-434b-b166-6489bd463696/results.json |Only own newly issued sessions staged expired;not natural TTLwait/native |
| BB-NOTIFICATION-MOBILE-02 |Shared notifications/session/branch helpers |139 final mocked tests PASS+typecheck |mobile-notification-current-status.json;mobile-notification-current.log |Supersedes134count before final countfix;no device runtime |
| BB-REGRESSION-06 |Backend safe unit suites |128suites1216PASS,0FAIL |backend-search-final-20261011.json |DBintegration and finance QA excluded/separate;full-product completion not inferred |

All earlier discovery rows remain historical inventory. These overlays identify the actual tested actions; they do not grant untested controls an acceptance result.


## Overlay cuối11/10 — appeal, auth và gate mới

| ID | Vai trò/luồng | Loại kiểm thử / kết quả | Bằng chứng dưới report-output/bugreport-remediation | Khoảng trống |
|---|---|---|---|---|
| BB-AUTH-GENERATION-01 |Old401/refresh/init/logout sau login/context mới |Actualsource VM deferred29targeted;8Chromium controlledPASS |auth-context-1791725161505/summary.json;auth-session-browser-762f91bb-c941-4d98-9dc7-f3af7a9594d8/results.json |Transport mocked;Set-Cookie nhiều tab chưa chứng minh |
| BB-AUTH-REFRESH-LIVE-01 |Hai request accessexpired cùng validrefresh |6actualAPI/EdgePASS,1refresh hai401→200,exactsession |access-refresh-fb31eea7-ff1d-467f-b0db-2b65d43893eb/results.json |JWTexpiry synthetic trongmemory;server session không sửa |
| BB-AUTH-SESSION-LIVE-02 |Expiredserver session→login→reauth |10actualAPI/EdgePASS375/1440 saufreeze |session-expiry-de78f3b8-9783-4028-b7b4-1fd2c0b55a87/results.json |Đúng ownsession mới staged;no naturalTTL/native |
| BB-REVIEW-APPEAL-SCOPE-01 |Author/currenttenantowner vs expired/foreignscope |Controlledmodel baseline8FAIL3PASS→11newPASS;6reviewsuites50PASS |reviews-appeal-historical-baseline.json;reviews-appeal-final.json |No actualreviewfixture/full positiveE2E |
| BB-REVIEW-APPEAL-RACE-01 |Concurrent submit/approve/reject +noticefault |1winner/1conflict/event+noticeonce;faultrollbackPASS |reviews-appeal-integrity.spec.ts;reviews-appeal-final.json |Transaction model notPostgreSQL concurrency/deadlock proof |
| BB-AUTH-HEADER-01 |4forms4widths,back/brandgap/inputloaded |16strictread-only UI PASS;gap≥12px |auth-layout-59fcab7b-0b66-4812-bbd8-7fb4de6699ac/results.json |Không submit forms;baseline boundingboxes không overlap nhưng gap0 |
| BB-REGRESSION-07 |Unique latestbackend safe suites/web/mobile |129suites1227PASS,web171PASS/build,mobile139mock/type |backend-appeal-final-20261011.json +backend-appeal-testfolder-final.json;auth-context summary;mobile currentstatus |DB6integration riêng;readonly historical58/1FAIL retained;no productpercentage |

Current srcSHA7c572b763de5a8aef9fdc716266ea9cbeb92164cf8dc163116622c299f4cf79b. The final remediation section lists every PARTIAL/BLOCKED/EXCLUDED category; inventory rows without action proof remain unaccepted. wholeProductComplete=false.

## Overlay12/10 — tiếp tục từ source đã merge và dọn UI

Các dòng phía trên giữ bằng chứng lịch sử11/10; source và gate mới dưới đây không gắn lại cho các run cũ.

| ID | Vai trò/luồng | Kết quả thực tế | Evidence dưới report-output/bugreport-continuation-20261012 | Giới hạn |
|---|---|---|---|---|
| BB-OWNER-NOTIFICATION-03 |Owner chọn A, mở Impact/request B cùng business |Baseline component2+4 FAIL được sửa;48 targeted PASS trong220 mobile tests; branch/action/session fencing |impact-baseline.log;request-baseline.log;mobile-tests-final2.log |Mock transport +actual source, native/live notification PARTIAL; không invent request target |
| BB-REVIEW-POSITIVE-02 |Customer create→Owner report→platform hide→author appeal→approve |Một review/report/appeal,4events/4notices; final16checks PASS, public/owner content đúng |review-positive-lifecycle.json;review-positive-verification-fixed-ip.json |Initial trimmed-comment harnessFAIL giữ; UI submit/concurrent DB race NOT_RUN; lifecycle-first full protected hash unavailable |
| BB-AUDIT-ONCE-01 |Global plus local audit registration9controllers |11FAIL2PASS baseline→13PASS composition; live19checksPASS, hai reject requests mỗi ID1audit, hashes không đổi |audit-baseline.log;audit-registration-final.log;review-positive-audit-regression.json;review-positive-audit-final.json |Không xóa duplicate history; live success sau deploy chưa mutation lại |
| BB-REVIEW-DATE-01 |Customer review calendar date |ActualUI3rows1970 baseline→correct appointmentDate; customer+Owner8viewportcasesPASS |review-ui-date-baseline.json;review-ui-regression.json;review-owner-ui.json |Final state read-only, không submit review qua UI; browser responsive không phải native |
| BB-ROOT-SESSION-01 |Logout→Trang chủ không stale private redirect |5source behavior FAIL→PASS; real Owner login/reload/logout/homePASS |root-route-baseline.log;root-route-regression.log;root-route-ui-regression.json |Three workspace statecases mocked, real browser round Owner only |
| BB-REGRESSION-08 |Code gates sau checkpoint12/10 |API127safe suites1212PASS,type/build;web176PASS/build;mobile220PASS/type/Hermesexport |backend-unit-final.log;backend-typecheck-final.log;backend-build.log;web-tests-complete.log;web-build-complete.log;mobile-tests-final2.log;android-final.log |Exclude backend integration spec selection; no real finance acceptance; no emulator/Metro |

Current code manifest629files sourceSHA **01c1bb06e4e50cdef31d981a7844d3b37cfaa41c02f8a017467064bf828a388e**. `checkpoint-final.json` keeps wholeProductComplete=false and outstanding categories. Native, UI review form submits, historical consent sources, production targets/external OTP-email, all controls/late/day-boundary/overrun and cron matrix remain unaccepted or blocked; finance/refund live QA remains EXCLUDED. Full details and screenshots in the12/10 remediation section.

## Overlay12/10 — hành động thật, race và local restore tiếp theo

Các rows trước là lịch sử; kết quả dưới đây chỉ đóng case tương ứng. Evidence dưới `report-output/bugreport-completion-20261012/`.

| ID | Acceptance | Kết quả | Evidence | Giới hạn |
|---|---|---|---|---|
| BB-REVIEW-UI-03 |Create/report/hide/appeal/approve qua các form thật |Một chuỗi persisted; required-reason gates;4 events/4 notices; protected hash không đổi |root/review-ui-steps-final.json;review-ui-before.json;review-ui-after.json;review-*.png |Existing COMPLETED QA booking, không finance/complete/backdate |
| BB-REVIEW-STATE-02 |REPORTED và pending appeal reload/lost response |2API baseline FAIL và3web FAIL→3API/3web PASS; pending UI thật, duplicate invitation bị gỡ |root logs;CustomerReviewAppeal.test.js;customer-review-appeal-state.spec.ts |Chỉ own-customer projection, không mở tenant scope |
| BB-REVIEW-PG-RACE-02 |Concurrent submit và quyết định trên PostgreSQL |64 checks PASS; một winner/terminal event/notice, live audit once |concurrent-review/race-results.json;final-audit.json |Own separate review; historical helper failures giữ |
| BB-NOTICE-PRESENTATION-01 |Legacy report human labels và search trước paging |18checks/12requests live PASS;375/1440 UI PASS |root/notice-and-validation-live.json;notice-ui-regression.json;notice-localized-search-*.png |Không rewrite lịch sử, chỉ đúng report-notice scope |
| BB-REVIEW-BOUNDARY-02 |Reason1000/category/severity validation |4targeted PASS;4actual rejected inputs400/no domain delta |reviews-report-boundaries.spec.ts;root/notice-and-validation-live.json |Không legal authenticity/abuse-content classification |
| BB-STORAGE-FULL-RESTORE-02 |Exported read-only DB snapshot+referenced files |171tables9360rows equal;65files equal;schema/ACL equal |storage-restore/results.json |Local separate scratch; no atomic DB+FS/cloud proof |
| BB-STORAGE-APP-RESTORE-03 |Restored app can read public/private volume |208checks137requests PASS;65byte hashes;61private public404;owner/foreign/anon access |storage-restore/restored-app-results.json |Required READ audit/auth telemetry on scratch; source unchanged; production NOT_RUN |
| BB-REGRESSION-09 |Current code gates before PDF followup |API130suites1222PASS/type/build;web179PASS/build |root/backend-unit-final.log;backend-typecheck-notice.log;backend-build-notice.log;web-tests-final.log;web-build-final.log |Mobile unchanged220previous; excludes backend integration selection |

wholeProductComplete=false. PDF parser gap, onboarding/admin UI mutations, named timing/context/filter/notification matrix and external/native prerequisites remain open. The older629-file hash is historical; do not bind newly changed code to it. Updated source manifest will be captured after the next scoped PDF change/gates. Finance stays EXCLUDED; no untested discovered control promoted.

## Overlay12/10 — PDF/onboarding hoàn chỉnh trong phạm vi QA

| ID | Acceptance | Evidence/kết quả | Giới hạn |
|---|---|---|---|
| BB-PDF-VALIDATION-03 |Actual parser, page-tree/count/Contents trước lưu |97scopedPASS/type/build; root/pdf-upload-live.json15checks/8requestsPASS, negative uploads no media/files delta |Rejected-action audit expected; targeted invariants/readability, no AV/legal/conformance/load claim |
| BB-PDF-VIEW-04 |Không loading-loop khi modal scrollbar đổi |Actualbaseline718↔729width/hidden; cold v1/v2,2pages,4widths stable/labels đọc được |root/pdf-preview-layout-baseline.json;onboarding-pdf-v2-*.png;responsive browser, không native |
| BB-ONBOARDING-UI-05 |Save→submit→REQUEST_INFO→v2→resubmit→APPROVE |root/onboarding-ui-steps.json +phase DBsnapshots;3media/3versions/4events, protected hashes unchanged |New Owner setup via API; OTP/email/signup UI not claimed; validQA legalsamples not actualverification |
| BB-ONBOARDING-NOTICE-04 |Two workers same allowlisted events, Owner notice/currentstate |root/onboarding-notice-delivery.json5PASS;2notices/2SENT/attempt1;other rows hashes unchanged;oldnotice currentAPPROVEDprofile |Only2new events, no global drain/email/push |
| BB-OWNER-SETUP-04 |Approved business0branches truthfulempty/error/loading |10actualsource tests +4actualUI widthsPASS;root/owner-no-branch-ui.json |Context fences controlled deferred; native not claimed |
| BB-PROFILE-STATE-02 |Owner status localized |Actualprofile coldreload “Doanh nghiệp: Đã duyệt”, correcttone |Oneexistingmappingused, no statusrules changed |
| BB-REGRESSION-10 |Gates after PDF/overview |API137suites1319PASS;web189PASS/Vite;mobile220priorunchanged |Availability change next requires new gate; no summed reruns/productpercentage |

Remaining: finite booking/time/context/positive geo/service/restricted-event cases and native/production/consent-source/external transport prerequisites. Detailed updated checkpoint in remediation. Earlier rows preserved; no historical evidence rebinding.

## Overlay12/10 — pagination và dữ liệu thật

| ID | Acceptance | Evidence/kết quả | Giới hạn |
|---|---|---|---|
| BB-AVAILABILITY-INPUT-03 |Invalid date/map trước hold expiry/query |13FAIL/2PASS baseline→16targetedPASS; root/availability-input-live.json13checks11requestsPASS/no protected delta |Valid leap-day reaches readiness, không live available-slot proof |
| BB-GEO-POSITIVE-04 |Area+district+service exact positive intersection/folding/page |geo-filter-positive/positive-handoff.md/json81checks65HTTP;2newbranches,4offerings, expectedIDs/total/order đúng |API-only ownfixtures; QA geography; no source/worker/finance updates |
| BB-PUBLIC-SORT-04 |Global metric order trước page; stable ties |23FAIL6PASS→49targetedPASS;root/global-sort-live.json142checks65GETPASS/all10eligiblebranches5sorts |Lightweight candidateIDs cost; no production-scale/concurrent snapshot guarantee |
| BB-GEO-UI-05 |Actual noaccent form và sort control |root/explore-positive-ui.json exact2IDs;4widths PASS |Samepricefixtures UI không prove globaldisplacement; placeholders không image completion |
| BB-OWNER-TOTAL-05 |Counts vượt page100 và earliest active next6 |18targeted/197webPASS; actualSQL112/4/0;root/owner-overview-counts-ui.json exact6IDs;4widths |Date-only backend requires paging past today'selapsed rows; no finance totals |
| BB-REGRESSION-11 |Final current safe gates |139API suites1365PASS/build;197webPASS/build;mobile220priorunchanged |Exclude integration selection; active checkpoint binds source snapshots separately |

Remaining positive geo/default/global-sort/overview cases above are now accepted within stated scope. WholeProductComplete remains false for named timing/context/event/native/production/consent/external prerequisites. Finite acceptance list is preserved; no product-percentage claim.

## Overlay12/10 — ảnh upload ở search và giờ phục vụ

| ID | Acceptance | Evidence/kết quả | Giới hạn |
|---|---|---|---|
| BB-MEDIA-SEARCH-06 |Ưu tiên đúng ảnh upload cho exact public offering |Root oneQA media fixture26PASS →actualplaceholder baseline→API11checks/coldUI4widthsPASS; root/public-media-fixture.json;public-media-live.json;public-image-card-after.json/png |Chỉ một sample hình học QA, không mọiảnh/entity; oldineligible attachments baseline NOMATCH giữ |
| BB-SEARCH-PROVIDER-03 |Search staff-count không coi linked account inactive/deleted là bookable |Actual SQL contract/model29targeted/typePASS, includesnull-user providers |Không có liveinactivefixture hiện tại; không tái hiện account bypass |
| BB-TIMING-NEXT-03 |Natural late-not-started/running-overrun/closing boundaries |timing-final/plan.md/scope/script prepared;READONLY/syntax/guardsPASS |Live NOT_RUN; next legal window+Rootreview/binding; nofakeclock/baseupdates/providerreset |
| BB-REGRESSION-12 |Current source safe backend gates |140suites1370PASS/build;web197previousunchanged;mobile220previousunchanged |Source manifest must resnapshot after search change; no broadcompleteclaim |

wholeProductComplete=false. Evidence for source-only, mocked, actual API and actual UI remains distinguished above. Do not count the QA image sample as a completed production imagery project or prepared timing code as an executed lifecycle.

## Overlay13/10 — timing, minimum duration và selection đã chạy

Rows/preparation/FAIL/BLOCKED trước giữ nguyên lịch sử; chỉ bổ sung proof tương ứng dưới đây. Root sở hữu checkpoint/source manifest, không rebind các run cũ.

| ID | Acceptance/kết quả mới | Evidence (full relative path) | Giới hạn |
|---|---|---|---|
| BB-TIMING-NEXT-03 |13/10local00:00:31–00:06:04,90 assertions PASS/37HTTP; late-not-started→START→overrun→COMPLETE/running SKIP; reservation block/release;2bookings/2guests/1variant mới;5failedcreates no orphan;19financial tables exact/7old tables retained |`report-output/bugreport-completion-20261012/timing-final/execution-qa-timing-747d7981-004d-48bf-bfb4-4f6380665b4a.json`; `report-output/bugreport-completion-20261012/timing-final/plan.md` |Giờ branch thật, no fakeclock; START sau midnight, **physical midnight crossing NOT_PROVEN**;90 không là unique scenarios |
| BB-AVAILABILITY-MINIMUM-04 |Shared assertValidDuration(totalDuration); baseline4FAIL37PASS→41PASS; live7checks before/7after:15min explicit/auto200 sai→400 minimum30; valid30/45 vẫn200/protected rows identical |`report-output/bugreport-completion-20261012/availability-minimum/evidence.md`; `report-output/bugreport-completion-20261012/availability-minimum/jest-final.json`; `report-output/bugreport-completion-20261012/availability-minimum/live-baseline.json`; `report-output/bugreport-completion-20261012/availability-minimum/live-after.json` |BaselinePASS tái hiện defect; tổng occupied duration, không từngservice; không live15mincreate |
| BB-SELECTION-LATEST-04 |15source/JSX baselinePASS không production fix; CUA actual DOM/proxy3strongPASS+1OBSERVED;375px current-error/retry thêmPASS→**4strongPASS+1weak observation**; no bookingwrites |`report-output/bugreport-completion-20261012/latest-selection/handoff.md`; `report-output/bugreport-completion-20261012/root/selection-ui.json` |Old/current staff slots giống nhau nên không phân biệt stale slot content; controlled errors, không native/all combinations |
| BB-REGRESSION-13 |Backend141suites1382PASS/type/build; normal npmtest integrated212PASS/webbuild |`report-output/bugreport-completion-20261012/availability-minimum/backend-full-final.log`; `report-output/bugreport-completion-20261012/latest-selection/npm-test-integrated.txt` |Safe suite selection; mobile220prior không nâng thành native; runtime3014PID22348/workers-emailoff là historical marker |

## Overlay13/10 — native proof lịch sử, blocker mới khi resume

Primary Pixel_7a / `emulator-5554` / `com.beautybook.mobile` được xác nhận trong prep; served bundle HTTP200/6,292,275bytes/SHA256 `1eb0c11ae551a251fb355311a75a3e4c025a67637de7b12fade9eff554a1d6b8`. Root capture12/10 17:13UTC (13/10 00:13local) xác minh **HOME_LOADED**, read-only bounded proof; old first-open spinner không là permanent bug. Evidence: `report-output/bugreport-completion-20261012/native-prep/native-prep-summary-20261013-000516.md`; `report-output/bugreport-completion-20261012/native-prep/served-bundle-proof.json`; `report-output/bugreport-completion-20261012/native-prep/primary-load-observation.json`; `report-output/bugreport-completion-20261012/native-prep/primary-load-observation.png`. Native all-roles acceptance chưa có.

**Later resume13/10 02:40UTC/09:40local, theo Root:** independent get-state `emulator-5554 NOT FOUND`; stopped ADB daemon auto-started, không emulator/app actions mới. Current role QA **BLOCKED_NO_CONNECTED_DEVICE**. Giữ HOME_LOADED và old blocked checks theo timestamp; không undo proof cũ. API/Metro markers historical; Root đang xác minh current listeners/health, chưa claim runtimeREADY hiện tại.

**wholeProductComplete=false.** Uncovered native/event/notification, external/production/authentic consent-source và physical midnight crossing vẫn partial/blocked/not run; finance EXCLUDED. Giữ mục12 bỏUI/flow,14 ẩnUI giữcode/data,17 bỏraw-detail giữaudit. Tests không là product percentage. Evidence dưới ignored report root không commit private; Root skipped prompt lookup vì checklist sẵn có và tiếp tục sở hữu checkpoint/source manifest.


## Overlay13/10 — scoped workers và notification privacy

| ID | Acceptance/evidence mới | Kết quả | Giới hạn |
|---|---|---|---|
| BB-REQUEST-NOTICE-06 |request-worker/created-booking-request-header-harness-failure.json + results.json + REPORT.md |First-stage real outbox2workers/once/badge/foreign isolation; continuation56assertions14HTTP PASS, create/reject/current-owner+customer notices |Historical final FAIL là missing-header harness; reuseexactbooking, không cộng reruns/retention assertions thành scenarios |
| BB-REQUEST-EXPIRY-05 |request-worker/results.json |Hai real compiled expiry workers,1winner/repeatzero; requestEXPIRED, bookingPENDING giữ; no falseapproval/cancel notice |Synthetic deadline riêng newrequest; gateway seam event only, không24h natural/socket/native |
| BB-IMPACT-PRIVACY-06 |impact-notification/baseline-report.md; jest-final.log; REPORT.md |Actual source/model19FAIL6PASS→25newPASS; provider current permission inside finaltx, no relation/code/reason; customer projection intact |Pre-fix source/model reproduction, không claim actual pre-fix staff-session exploit |
| BB-IMPACT-WORKER-07 |impact-notification/live-results.json; readback.json |59assertions13HTTP PASS +5independentSQLchecks; deadline2workers/dedupe,3SENTonce; foreign403, resolvedretry409, complete/exclusion, bookingunchanged |Newsyntheticcase/item/deadline; one real linked provider; direct actualNotificationsService list, no JWT/native staff login, no branchpause/finance |
| BB-MOBILE-IMPACT-LINK-05 |impact-mobile-target/baseline.txt; targeted-test.txt; mobile-full.txt; typecheck.txt; android-export.txt |Actualbackendproducer target contractFAIL→PASS; OWNERcanonical+legacy/STAFFdeny;67focused/222fullPASS,type/export |Mock/source proof; compilerEPERM sandbox preserved then successful authorized retry; connectednative NOT_RUN |
| BB-REGRESSION-14 |impact-notification/backend-full.log,typecheck.log,build.log;latest-selection/web logs;impact-mobile-target/mobile logs |API142suites1407PASS/type/build,web212PASS/build unchanged,mobile222PASS/type/Hermes |integration.spec.ts excluded safegate; native/device/external/production gaps remain |

Source649files SHA256 `682a248296dc72f898d724935ad4979f073a3cf8fc2c453bbfaf55a3ada8c070`, HEAD6a2b438+preserved dirty tree; checkpoint binds extra test/package/dist hashes. Current QA3014PID22456/database-up and demo5176HTTP200 fresh. Browser historical tab binding was protocol-policy rejected; no current browser acceptance/screenshot from that action. Independent reviewer no actionable findings in bounded impact/mobile fixes. Keep original12UI removed/14finance hidden+data retained/17rawdetail removed+audit retained. `wholeProductComplete=false`; remaining native/form/onboarding/action/external/production/historical-source conditions not promoted to PASS.


## Overlay13/10 — footer không bị thanh điều hướng che và CTA khách hàng

Lỗi mới tái hiện trên customer notifications: khi cuộn hết trang, thanh điều hướng cố định che liên kết “Dành cho cơ sở”; hit-test tại tâm liên kết trả về mục lịch hẹn. Baseline `footer-clearance/baseline.json` và ảnh694px được giữ. Root cause: footer nằm ngoài main, nên padding của main không tạo khoảng trống cuối shell. Sửa `CustomerShell.jsx` bằng padding dưới65px cộng safe-area ở mobile, md trở lên0; không giấu overflow hay thu nhỏ chữ.

Actual browser regression375/768/1024/1440px: cả20 liên kết footer hit đúng href, không bị nav che, không tràn ngang; screenshot `footer-375.png` tới `footer-1440.png`. Bấm thật mobile và desktop mở `/for-business`, CTA đi `/register/business` và khách hàng nhận thông báo chưa có quyền tạo doanh nghiệp, không bị đưa sang lịch hẹn. Refresh chờ auth/render hoàn tất vẫn giữ thông báo đúng quyền; không submit form, không tạo doanh nghiệp/nâng quyền. Quan sát reload quá sớm trả false được giữ và giải thích riêng trong `cta-checks.json`, không tính thành product failure/PASS. Logs chỉ có React Router future warnings đã có, không có error trong tập logs thu được.

Web212/212 tests và build đạt sau bản sửa, initial sandbox spawn EPERM giữ riêng. Evidence toàn đợt tại `report-output/bugreport-completion-20261012/footer-clearance/`; current manifest/checkpoint đã rebind SHA `e24aa86c0fbd67d0be5b199a30f9865ff5d32af68db40855c90087b0385ccbbb`. Backend/mobile gates giữ nguyên phạm vi trước; native vẫn cần thiết bị phát triển kết nối. Whole-product chưa hoàn tất.

| ID | Vai trò | Màn hình | Thao tác | API | Dữ liệu | Loại kiểm tra | Kết quả | Bằng chứng | Giới hạn |
|---|---|---|---|---|---|---|---|---|---|
| BB-EXEC-FOOTER-08 | WEB_CUSTOMER | Footer375/768/1024/1440 | Actual hit-test20 links + click mobile/desktop | No domain submit | Authenticated customer | Browser actual | PASS scoped | footer-clearance/regression.json + cta-checks.json | Không suy ra mọi CTA/role đã nghiệm thu |


## Overlay13/10 — sidebar, actual CTA, deadline owner scope và nhãn lịch sử

Hai lỗi layout dùng chung đã xác minh actual browser: CustomerShell footer bị nav dưới che đã sửa; AppShell sidebar đóng vẫn nằm trong tab order, Tab đi vào “Đóng menu” ở x<0. Sửa `invisible lg:visible` khi đóng, `visible` khi mở;375/768 Tab tới Mở menu hiện trên màn hình,1024/1440 tới navigation desktop;4widths không tràn ngang. Mở menu375→Tài khoản đúng `/salon/account`, sidebar đóng lại. Không suy ra native hoặc tất cả vai trò từ một Owner run. Evidence `navigation-keyboard/baseline.json`, `regression.json`, `open-navigate.json` và ảnh trước/sau.

Business CTA actual browser: chưa đăng nhập→form Owner→login `from=/register/business` và refresh giữ intent; customer12 login trở lại thông báo giới hạn quyền, Owner0 APPROVED login tới hồ sơ BeautyBook QA0, refresh/Back đúng. Không submit đăng ký/đồng ý điều khoản/tạo doanh nghiệp hoặc nâng quyền. Existing draft/pending/info/rejected entry-path combinations chưa khép bằng cùng lượt UI. Form DOB Owner375 nhập bàn phím ngày tương lai có inline error/aria-invalid, submit bị chặn, reload ngày cũ còn nguyên; initial date fill không phát onChange được giữ như harness observation. Evidence `registration-intent/results.json`, `profile-birthdate-ui/results.json`.

Deadline privacy: worker cũ gửi reason mới cho stored case owner sau mất quyền/chuyển chủ; baseline actual-worker doubles19FAIL/12PASS. Sửa Serializable enqueue chọn actual Business.owner.userId, active/nondeleted account, live owner grant theo resolver; dedupe case/deadline/recipient, legacy same-recipient không replay và warning của người cũ không chặn chủ mới.31 focusedPASS; existing test double được cập nhật transaction/access contract, không fallback bỏ guard. Một case QA mới `32cb0040-0270-441a-9fd2-7c8ca0a3f62d` có historical ownerId=foreignowner1 là prerequisite synthetic; không chuyển chủ business hay pause chi nhánh thật. Hai compiled workers trên PostgreSQL→1warning, hai deliveryworkers→1notice/attempt1; Owner0 GETcase/notice200, Owner1 case403/notice không thấy.51assertions/8HTTP;19financialtables exact và oldrows11tables retained. Syntheticcase cuối CANCELLED bằng DBguard để tránh futurewarn, history giữ nguyên; không gọi đó là product lifecycle.

Nhãn deadline mới và lịch sử dùng tiếng Việt: helper chỉ thay known anchored enum prefix của đúng SYSTEM/impact/deadline title; giữ reason chính xác, không sửa từ enum-like trong ghi chú và không update database. SQL search dùng cùng presentation trước paging. Baseline2FAIL/3PASS→5PASS; realAPI12assertions/4HTTP +4browserwidths xác minh legacy warning được đọc/tìm với “tạm ngừng”, toàn notifications/outbox/cases giữ exact. Search UI cần Enter; initial fill-only timeout là harness chưa submit, được ghi riêng. Cảnh báo đã enqueue trước khi quyền thay đổi vẫn là historical intent; chưa thêm delivery-time reauthorization/history cleanup.

Latest gates: API143suites/1440PASS/type/build; production lint0errors ở worker +hai label helpers; web212PASS/build sau AppShell fix; mobile222source/mockPASS sau cập nhật actual producer boundary, production mobile không thay. Current QA3014PID19140 freshdatabase-up,8globalworkers/emailoff; Vite5176đang chạy. Bản compiledworker test trước refactor labels và API request logs giữ hash/runtime ban đầu; current manifest651codefiles SHA `bd3f8b8ab6746555121ba9f9dc0fd3abbfeba99b8d2a9fe6d439bf550d08f03d`. Provider JWT gap BLOCKED vì password hiện có không match,19guardchecks+SQL notice/outbox exact nhưng không login/reset/forge; distinct-staff DOM gap chưa có dữ liệu khác nhau, không sửa fixture để ép PASS. Remaining native/production/external/consent/timewindow vẫn chưa hoàn tất; không tuyên bố100%.

| ID | Vai trò | Màn hình | Thao tác | API | Dữ liệu | Loại kiểm tra | Kết quả | Bằng chứng | Giới hạn |
|---|---|---|---|---|---|---|---|---|---|
| BB-EXEC-NAV-09 | WEB_OWNER/common AppShell | Sidebar4widths | Tab/Open/menu navigation | GET/self profile only | Menu closed/open | Actual browser | PASS scoped | navigation-keyboard/ | Native/other-role keyboard not inferred |
| BB-EXEC-INTENT-10 | PUBLIC/CUSTOMER/OWNER | Business CTA/login/refresh/Back | Existing auth only | GET/onboarding | Anonymous/Customer/ApprovedOwner | Actual browser | PASS scoped | registration-intent/results.json | Other status entry paths remain |
| BB-EXEC-DEADLINE-11 | OWNER/foreign OWNER | Current owner deadline privacy | Concurrent enqueue/delivery | Compiled worker+realPG/API | New synthetic case | 51assertions/8HTTP | PASS scoped | impact-deadline-owner-scope/live-results.json | No real ownership transfer/branch pause |
| BB-EXEC-NOTICE-12 | OWNER | Legacy label/search | Historical read/search4widths | GET notifications+SQL | Stored legacy enum | API12/browser4 | PASS scoped | legacy-live-read.json+legacy-browser.json | No stored-row rewriting |
| BB-EXEC-PROVIDER-JWT-13 | STAFF | Exact impact notice | Credential prerequisite | Read-only DB+health | Existing provider | 19guardchecks | BLOCKED credential | provider-notification-api/FINAL.md | Authenticated controller NOT_RUN |


## Overlay13/10 — vận hành theo tên, accessibility và chặn hold quá hạn

Operations dùng tên nhân viên/chi nhánh có scope, clear và fence lựa chọn cũ; giao diện lỗi/trống/retry rõ, required đúng field. Nhãn enum và legal keys thô được thay bằng tiếng Việt. Finance flag ẩn CANCEL_REFUND và payout form, guard stale choice, code/data vẫn giữ.11 actual JSX/helper tests; Field sửa primary control khi children có sibling/false,13 baseline failures→21 tests đạt, label/required/error association giữ đầy đủ. Menu mobile trap Tab/ShiftTab, Escape trả focus, resize mở khóa scroll; final actual focus proof đạt.

Actual Operations375/768/1024/1440: named staff/transfer choices, legal required/finance exclusion và empty detail được kiểm tra. Một REASSIGN trên lịch QA mới persist đúngstaff/revision,38 SQL checks giữ19financialtables exact và oldrows; nó xảy ra sau hold deadline khi policy còn chưa chốt, nên được giữ làm **baseline behavior**, không là nghiệm thu policy mới. Lịch này sau đó EXPIRED qua luồng expiry bình thường. Một lịch PHONE mới khác được xác nhận trước deadline cung cấp slot khác nhau thật cho hai nhân viên; actual back/change-staff/return, release old HTTP200 không đưa00:00 vào lịch mới hoặc xóa selection00:30. Bốn widths không overflow. Không suy ra old response được browser tiêu thụ hay same-mounted/native race.

Provider controller gap được khép trong phạm vi bằng normalJWT của một provider QA mới,58assertions/17HTTP: notification generic/no live booking relation/private reason; personal work scoped, foreign owner không thấy;19finance exact/old28tables retained. Identity/mapping/case prerequisite synthetic được ghi rõ; không đổi password/grant cũ. Evidence cũ BLOCKED credential giữ nguyên theo timestamp.

Người dùng chốt chặn ngay khi hết hạn, muốn tiếp tục phải đặt lại. Shared backend guard đọc sau parent lock, deadline<=serverNow và không có execution status evidence; áp dụng confirm/add/reassign/move/resize/bulk assign/request scheduling approval và direct branch transfer. Legacy null deadline, execution exception, cancel/reject/REPRICE và lifecycle hiện tại giữ nguyên.93newactual-service tests đạt (baseline38failure);6transfer tests thêm, baseline3failure;3oldfixtures bổ sung locked parent read, không bỏ assertion. Safe full gate144suites1539PASS/type/build,web257PASS/build,mobile222source/mock giữ phạm vi trước. Live tái sử dụng đúng lịchQA mới của đợt này, deadline tự nhiên03:26UTC đã qua nhưng parent cònPENDING:7 scheduling entrypoints409 đúngcode, không tạo thêm lịch/sửa deadline;5continuation requests có oracle exact158domain tables và audit table riêng chỉ thêm failed security records được chứng minh, stage1 hai calls/failure oracle itemId được giữ. Không audit thành công/outbox/tài chính do rejection; không tắt security audit. Approval live NOT_RUN vì không có request hợp lệ;93service tests kiểm cả hai approval paths.

Drawer web dùng server clock anchor, hiện cảnh báo cố định và bỏ confirm/add/reassign/resize/START của pending unserved đã hết hạn; hủy và các quyền độc lập giữ nguyên.13 helper tests kiểm boundary/null/unknown/execution exception. Actual375/768/1024/1440 cảnh báo hiện, confirm/add không còn, hủy enabled, no overflow; menu chỉ đọc không submit. Lượt sai tab viewport/Escape đóngdrawer giữ artifact, không tính product failure. Native/mobile UI không suy ra từ browser. Evidence pending-hold-live/ui-regression.json và hold-ui-*.png.

Current runtime26672/QA3014 freshdatabase-up,8workers/emailoff; source 659 files SHA `b60cb2dd099bc43b45dfa35c68ed94eea2d128c6bc79e7c038501b01f91229d9`. Không reset/seed/drop/delete/history backfill, không live finance. Native device/external/production/authentic consent và physical midnight còn thiếu; wholeProductComplete=false.

| ID | Acceptance mới | Bằng chứng | Giới hạn |
|---|---|---|---|
| BB-EXEC-OPS-14 | Named choices/legal/empty4widths, actual reassign persist | operations-product-ui/ | Reassign latehold là historical baseline trước quyết định |
| BB-EXEC-FIELD-15 | Primary control naming/error/required21tests | field-accessibility/ | Source React semantic tests; actual transfer combobox tên đúng |
| BB-EXEC-FOCUS-16 | Open trap/ShiftTab/Escape/resize | navigation-keyboard/open-focus-final.json | Owner common shell; không native/allroles |
| BB-EXEC-PROVIDER-17 | Authenticated controller + personal work + foreign isolation | provider-notification-fresh/results.json | Fresh synthetic identity; old password không đổi |
| BB-EXEC-STAFF-18 | Different real slots + delayed old normal UI return4widths | staff-distinct-transport/ | Không same-mounted programmatic/native claim |
| BB-EXEC-HOLD-19 | Shared deadline guards/source99newcases + natural live | pending-hold-deadline/ + pending-hold-live/ | Fakeclock source và naturalAPI phân biệt; finance excluded |


## Overlay13/10 — yêu cầu sau hold deadline và Pixel 7a hiện tại

Gửi yêu cầu đổi giờ/đổi nhân viên mới cũng bị chặn khi PENDING chưa phục vụ đã hết thời gian giữ chỗ. Guard chạy sau parent lock/fresh read và quyền sở hữu, trước policy, lazy request expiry, request create và thông báo. Yêu cầu hủy vẫn giữ rule cũ; foreign customer nhận lỗi quyền trước thông tin deadline.16 actual-class regression tests: baseline6FAIL/10PASS →16PASS; không sửa scheduled/actual/finance. Safe full gate mới **145 suites/1555 tests**, typecheck/build đạt trên compiled QA3014PID15836. Lượt concurrent timeout PDF do áp lực RAM và interruption được giữ; lượt sequential dùng timeout/assertions bình thường, không loại PDF để lấy PASS.

Actual API dùng customer9 hợp lệ và đúng lịch QA mới của đợt này, deadline tự nhiên đã qua: hai POST RESCHEDULE/STAFF_CHANGE mỗi loại một lần trả409 PENDING_HOLD_EXPIRED.327 retention checks gồm158 domain tables exact, audit cũ giữ nguyên và chỉ hai failed security records đúng actor/target/request; không tạo request/lịch/deadline hoặc ghi tài chính.327checks là assertion, không phải327scenarios. Live approval còn NOT_RUN do không có request hợp lệ; source/service approval đã được kiểm thử riêng. Evidence: pending-hold-live/request-create-live.json; oracle preflight table-name failure được giữ, không replay writer.

Pixel_7a/emulator-5554 được người dùng bật. Sau ADB/VM mất phản hồi vì RAM pressure, phục hồi bằng cold boot đúng AVD cũ, không wipe userdata/reinstall/clone. Current Metro18136 phục vụ Android bundle200,6292329bytes SHA256 8b42ac800781814b4c9659003cad8c192b553cb642e0cc9a8b7903c058fd1265 với QA override3014; host bundle proof không chứng minh thiết bị tiêu thụ đúng hash. Fresh HOME PNG/XML nhìn thấy category/branch QA; Account tab và login form entry có fresh hierarchy và ảnh kế tiếp. PNG/XML không atomic: account-public-01.png cònHOME; login-empty-01.png cònAccount; không dùng ảnh trước-transition để chấm màn hình sau.

Một bulk ADB email input bị rơi ký tự; chưa gửi đăng nhập, chưa xác định nguyên nhân sản phẩm. Paced retry đã chuẩn bị nhưng **chưa thực thi** vì automatic approval review hết hạn mức, báo thử lại17:10 local; đây là lỗi review availability, không phải unsafe-action rejection. Không dùng tool/sandbox khác để vượt. Native CUSTOMER/STAFF/OWNER authenticated, keyboard/Back, offline/foreground, notification và media picker vẫn NOT_RUN. recovered-primary.xml bị INVALIDATED vì UIAutomator null-root nhưng helper đọc XML cũ; đã sửa unique path/error check/password redaction và giữ artifact cũ. Native acceptance-current.json ghi riêng giới hạn này.

Current source 660 files SHA256 `4abb4340fe0f8196750defe44e16424964feff646216e1374025d63b8bc1dd12`; 172 tracked dirty/45 untracked, không reset/commit/push. Hai code paths delta từ checkpoint trước được kiểm chứng; mọi thay đổi hợp lệ khác giữ nguyên. **wholeProductComplete=false**; external sandbox/production/consent và các acceptance gaps vẫn được liệt kê, không lấy unit count hoặc HOME proof thay cho toàn hệ thống.

| ID | Acceptance mới | Bằng chứng | Giới hạn |
|---|---|---|---|
| BB-EXEC-HOLD-20 | New scheduling request deadline16source +2live409 | pending-hold-live/request-create-live.json | No new request; audit-only rejection; approval live NOT_RUN |
| BB-EXEC-NATIVE-21 | Fresh HOME/data, Account/login entry | native-final-20261013/acceptance-current.json | Partial native; role authentication/recovery/keyboard acceptance remains NOT_RUN |


## Bổ sung13/10 — gỡ chuyển chủ và tab nhân sự

Theo yêu cầu mới, đã gỡ giao diện chuyển quyền sở hữu khỏi Staff/Lễ tân/Owner/Admin: menu, trang IncomingOwnership/AdminOwnership, tab vận hành, form/phần pháp nhân-payout chỉ dùng cho chuyển chủ, client ownershipApi và helper độc lập. Vận hành giữ xử lý lịch bị ảnh hưởng. Backend ownership/data/audit giữ nguyên; không tuyên bố endpoint server đã bị bỏ. Link cũ salon/incoming-ownership về account, admin/ownership về admin; customer benefits?tab=ownership về màn hợp lệ theo vai trò. Notification allowlist không mở hai route đã gỡ.

Chi tiết nhân sự còn Tổng quan/Tài khoản/Vai trò & chi nhánh/Dịch vụ; documents/audit/unknown query được replace về profile, giữ query khác. Không render raw auditTrail; nhân sự, tài khoản/mời nhân viên và dịch vụ độc lập giữ nguyên. Nhãn trạng thái/position mã role được trình bày tiếng Việt, tên vị trí tự nhập giữ nguyên.

Gỡ hai câu trong ảnh cùng9mô tả giới thiệu lặp ở web, metadata kỹ thuật trong lịch sử bảo mật; đổi KYC/private/public URL thành hướng dẫn ngắn về ảnh công khai và giấy tờ riêng. Mobile dọn8file copy, subtitle tùy chọn không còn element trống. Giữ validation/consent/hậu quả/quyền/actual timing/unknown/ảnh minh họa; không xóa comment mã nguồn hữu ích.

Web **265tests/build đạt**, mobile **222Node/typecheck đạt** qua agent (raw logs chỉ tool output), native không chạy cho revision này. Actual demo5173/databaseglowbook:12observations đạt ở5roles,4widths375/768/1024/1440 staff tabs/no horizontal overflow; Reviews/Vouchers375/1440 không còn hai câu. Old links/reload giữ phiên và về đúng màn. Không coi đây là mọi nút/E2E; timestamp artifact là evidence time, không đo latency.

Browser phát hiện empty ImpactPanel thiếu AlertTriangle sau dọn import; sửa +actual JSX regression, error baseline giữ. Đổi tài khoản nhanh lộ STALE_SESSION từ logout cũ; actual store/API regression baselineFAIL→PASS, giữ transport error thật, không clear/navigate sau phiên mới. Hai shell đi login ngay khi user yêu cầu logout; normal fast switch/reload cuối không console error. Các lần goto trước khi login hoàn tất, selector nhãn sai, chờ root/salon trong khi receptionist vềappointments và scrollbar15px gây falseFAIL được giữ như harness findings. Build preview thống nhất API127.0.0.1 để khớp host; initial login trace không dùng làm bằng chứng duy nhất của lỗi SameSite.

Evidence: report-output/ui-prune-20261013/ (validation.json/browser-cases.json/staff-widths.json/logout-browser-final.json +PNG/logs). Source659files SHA256 `c1bd2522356337d755b7d7d8d4fd53f8684788a554dbe3268aa385cdbd657d60`. Backend source không đổi; old gates/timestamps giữ lịch sử. Không chủ động tạo/sửa/hủy lịch, ghi tài chính, reset/seed/drop hoặc xóa lịch sử. **wholeProductComplete=false** cho goal hệ thống còn native/external/production/consent gaps.


## Luồng check-in thay START/COMPLETE bắt buộc — 13/10/2026

Quyết định mới: lễ tân xác nhận khách đến, Staff chỉ xem lịch; buổi trong gói được ghi dùng ở check-in. Backend chặn mutation Staff, giữ Owner exception/audit/permission correction. Lịch CHECKED_IN qua giờ dự kiến vào HISTORY qua read projection, không tự đổi COMPLETED hoặc điền actual time/ghi đã thanh toán. No-show vẫn dựa vào khách chưa đến và xác nhận thủ công; chưa START không phải no-show.

Đã đồng bộ web/mobile, phân trang/snapshot/timer refresh, quyền đánh giá, khách quay lại, dùng buổi đúng chi nhánh, doanh thu dựa khoản thu ròng và phí điều chỉnh append-only. Browser phát hiện và sửa giá 0 giả ở màn Staff và câu form đánh giá gán nhầm “đã hoàn thành”. Các kết luận START/COMPLETE bắt buộc của lượt cũ được thay thế bằng quyết định này, bằng chứng cũ giữ nguyên.

Backend typecheck/build đạt; 146 suites/1.606 tests đạt, 7 suites/158 integration tests bỏ qua. Web281tests/build đạt; mobile225tests/typecheck đạt. PostgreSQL READ ONLY177lịch/3nhóm phân loại đạt; API thật38checks đạt (quyền Staff, cùng server cutoff, domain hash không đổi). Browser15cases đạt trên Receptionist/Staff/Customer ở375/768/1024/1440, không tràn ngang tại các màn kiểm tra; hai tab Staff/Customer không console error trong cửa sổ kiểm tra. Lint hai file attendance mới đạt, không tuyên bố toàn repo lint sạch.

Chi tiết và giới hạn: [check-in-only-booking-workflow.md](check-in-only-booking-workflow.md). Evidence: report-output/check-in-only-20261013/validation.json + api-live.json + browser-cases.json + PNG. API3000 giữ glowbook_db; QA3014 dùng DB riêng. Không seed/reset/migrate/backfill/xóa lịch sử hoặc ghi tài chính trong demo; browser không ghi booking/review. Native bản này NOT_RUN theo mobile/AGENTS.md; package/payment live mutation chưa nghiệm thu. **wholeProductComplete=false**; không dùng các kết quả này thay nghiệm thu toàn BugReport/native/external/production.
