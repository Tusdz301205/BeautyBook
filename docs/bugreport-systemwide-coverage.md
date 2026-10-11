# BeautyBook — system-wide coverage

Generated inventory on 08/10/2026. Discovery is not code review or test acceptance. Existing76 cases are historical limited evidence, not a product completion percentage. New strict runs are recorded separately.

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
