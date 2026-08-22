# Frontend route migration inventory

Status values: `NOT_STARTED`, `IN_PROGRESS`, `MIGRATED`, `VERIFIED`.

| Zone | Route | Current page | Decision | Status |
|---|---|---|---|---|
| Public | `/login` | LoginScreen | REFACTOR | NOT_STARTED |
| Public | `/forgot-password` | ForgotPassword | REFACTOR | NOT_STARTED |
| Public | `/reset-password` | ResetPassword | REFACTOR | NOT_STARTED |
| Public | `/verify-email` | VerifyEmail | REFACTOR | NOT_STARTED |
| Public | `/accept-invitation` | AcceptInvitation | REFACTOR | NOT_STARTED |
| Public | `/book` | BookingStep1 | REFACTOR | NOT_STARTED |
| Public | `/book/staff` | BookingStep2 | REFACTOR | NOT_STARTED |
| Public | `/book/time` | BookingStep3 | REFACTOR | NOT_STARTED |
| Public | `/book/info` | BookingStep4 | REFACTOR | NOT_STARTED |
| Public | `/book/confirm` | BookingConfirm | REFACTOR | NOT_STARTED |
| Public | `/book/success` | BookingSuccess | REFACTOR | NOT_STARTED |
| Customer | `/customer/appointments` | CustomerAppointments | REFACTOR | NOT_STARTED |
| Customer | `/customer/profile` | ProfileSettings | REFACTOR | NOT_STARTED |
| Customer | `/customer/privacy` | PrivacySettings | REFACTOR | NOT_STARTED |
| Customer | `/customer/security` | SecuritySettings | REFACTOR | NOT_STARTED |
| Salon | `/salon` | SalonLanding/SalonOverview | REFACTOR | NOT_STARTED |
| Salon | `/salon/appointments` | SalonAppointments | REFACTOR | NOT_STARTED |
| Salon | `/salon/services` | SalonServices | REFACTOR | NOT_STARTED |
| Salon | `/salon/staff` | SalonStaffManagement | REFACTOR | NOT_STARTED |
| Salon | `/salon/promotions` | SalonPromotions | REFACTOR | NOT_STARTED |
| Salon | `/salon/reviews` | SalonReviews | REFACTOR | NOT_STARTED |
| Salon | `/salon/payments` | PaymentsWorkspace | REFACTOR | NOT_STARTED |
| Salon | `/salon/stats` | SalonStats | REFACTOR | NOT_STARTED |
| Salon | `/salon/notifications` | SalonNotifications | REFACTOR | NOT_STARTED |
| Salon | `/salon/profile` | SalonProfile | REFACTOR | NOT_STARTED |
| Salon | `/salon/onboarding` | BusinessOnboarding | REFACTOR | NOT_STARTED |
| Salon | `/salon/account` | ProfileSettings | REFACTOR | NOT_STARTED |
| Salon | `/salon/security` | SecuritySettings | REFACTOR | NOT_STARTED |
| Platform | `/admin` | AdminLanding/AdminOverview | REFACTOR | NOT_STARTED |
| Platform | `/admin/salons` | AdminSalons | REPLACE INCREMENTALLY | VERIFIED |
| Platform | `/admin/users` | AdminUsers | REPLACE INCREMENTALLY | VERIFIED |
| Platform | `/admin/appointments` | AdminAppointmentsView | REPLACE INCREMENTALLY | VERIFIED |
| Platform | `/admin/payments` | PaymentsWorkspace | REFACTOR | NOT_STARTED |
| Platform | `/admin/promotions` | SalonPromotions | REFACTOR | NOT_STARTED |
| Platform | `/admin/reports` | AdminReports | REFACTOR | NOT_STARTED |
| Platform | `/admin/reviews` | AdminReviewsModeration | REFACTOR | NOT_STARTED |
| Platform | `/admin/violations` | AdminViolations | REFACTOR | NOT_STARTED |
| Platform | `/admin/notifications` | AdminNotifications | REFACTOR | NOT_STARTED |
| Platform | `/admin/settings` | AdminSettings | REFACTOR | NOT_STARTED |
| Platform | `/admin/compliance` | AdminCompliance | REFACTOR | NOT_STARTED |
| Platform | `/admin/profile` | ProfileSettings | REFACTOR | NOT_STARTED |
| Platform | `/admin/security` | SecuritySettings | REFACTOR | NOT_STARTED |

## KEEP

- React Router route structure and legacy URLs.
- Zustand authentication persistence and backend-provided permissions.
- Central API client with token refresh and scope headers.
- Existing charts and domain-specific salon/customer components where behavior is correct.

## REFACTOR

- Shell, page headers, filter bars, tables, loading/empty/error states, dialogs, drawers, and status presentation.

## REPLACE INCREMENTALLY

- Scheduler rendering engine.
- Admin salons and users page composition after API capability audit.

## DELETE

Only after replacements are verified: obsolete scheduler sidebar/horizontal-time components and duplicated page-local presentation helpers.
