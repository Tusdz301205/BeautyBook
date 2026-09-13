# BeautyBook End-to-End Test Plan

## Application Overview

BeautyBook is a multi-tenant salon/spa booking platform. This plan verifies public discovery, customer booking, salon operations, platform administration, frontend route guards, backend RBAC, tenant isolation, and booking consistency without restoring removed HR/workforce behavior.

## Test Scenarios

### 1. Runtime and smoke

**Seed:** `tests/e2e/setup/seed.spec.js`

#### 1.1. public-routes-render-without-fatal-errors

**File:** `tests/e2e/smoke/public-routes.spec.js`

**Steps:**
  1. Open the health endpoint and each public route.
    - expect: health reports a live database connection.
    - expect: each page renders meaningful content without a blank screen.
    - expect: no page error, important asset 404, CORS failure, redirect loop, or unexpected 5xx occurs.
  2. Open `/book` while signed out.
    - expect: the user is redirected once to login and the original route is retained.

### 2. Authentication and RBAC

**Seed:** `tests/e2e/setup/seed.spec.js`

#### 2.1. login-validation-and-role-destinations

**File:** `tests/e2e/auth/login-and-rbac.spec.js`

**Steps:**
  1. Submit a known email with a wrong password.
    - expect: a user-facing authentication error appears and no protected route is opened.
  2. Login independently as each configured role.
    - expect: Customer opens the customer area, salon roles open the salon area, and Platform Admin opens the admin area.
  3. Reload an authenticated page.
    - expect: the refresh cookie restores the correct workspace.
  4. Access protected URLs directly from the wrong role.
    - expect: frontend redirects to the role home and protected API requests return 401/403.
  5. Login in isolated browser contexts.
    - expect: sessions do not overwrite or leak between roles.
  6. Logout.
    - expect: protected history cannot be reopened.

### 3. Removed workforce surfaces

**Seed:** `tests/e2e/setup/seed.spec.js`

#### 3.1. removed-workforce-routes-remain-absent

**File:** `tests/e2e/rbac/removed-workforce.spec.js`

**Steps:**
  1. Inspect salon navigation and visit historical HR URLs directly.
    - expect: no attendance, QR attendance, workforce, shift scheduling, leave, timesheet, payroll, payrun, or compensation page is rendered.
    - expect: no removed HR API is requested.
  2. Request historical HR API roots.
    - expect: each endpoint returns 404 and never 500.

### 4. Customer booking

**Seed:** `tests/e2e/setup/seed.spec.js`

#### 4.1. customer-creates-and-reads-booking

**File:** `tests/e2e/booking/customer-booking.spec.js`

**Steps:**
  1. Discover an active branch and bookable service, then choose a qualified active staff member and live slot.
    - expect: inactive or unqualified choices are not offered.
  2. Confirm the booking once and then by rapid double click.
    - expect: one booking is created with correct branch, service, staff, time, price snapshot, status, and code.
    - expect: the confirm button prevents duplicate submission.
  3. Open the customer appointment.
    - expect: the same current status and non-epoch date are displayed.

### 5. Salon lifecycle

**Seed:** `tests/e2e/setup/seed.spec.js`

#### 5.1. receptionist-and-salon-booking-lifecycle

**File:** `tests/e2e/salon/booking-lifecycle.spec.js`

**Steps:**
  1. Open day, week, and month scheduler views and create an in-store appointment within scope.
    - expect: scheduler stays a calendar and shows the persisted duration.
  2. Confirm, check in, start, complete, cancel, move, resize, and reassign only when each transition is allowed.
    - expect: every action reports its final state immediately without requiring refresh.
    - expect: customer detail reflects salon state and never shows 01/01/1970.
  3. Read booking detail as a branch-scoped account.
    - expect: valid `booking:read:branch` access succeeds while another branch is rejected.

### 6. Booking concurrency

**Seed:** `tests/e2e/setup/seed.spec.js`

#### 6.1. booking-and-voucher-races-remain-atomic

**File:** `tests/e2e/concurrency/booking-concurrency.spec.js`

**Steps:**
  1. Submit 5 and then 10 independent customer requests for one staff slot concurrently.
    - expect: exactly one succeeds, all others return conflict, and none return 500.
  2. Race customer/receptionist create, create/reschedule, and create/cancel.
    - expect: commit order decides the winner and prior state remains intact on loser rollback.
  3. Retry one idempotency key with the same and then a different payload.
    - expect: the same payload returns the same booking and a changed payload is rejected without a second record.
  4. Race multi-service, voucher quota one, and waitlist accept.
    - expect: all affected resources commit once or roll back together.

### 7. Responsive and accessibility

**Seed:** `tests/e2e/setup/seed.spec.js`

#### 7.1. critical-pages-fit-desktop-tablet-and-mobile

**File:** `tests/e2e/responsive/critical-layouts.spec.js`

**Steps:**
  1. Open home, explore, login, booking entry, and authenticated role homes on desktop, tablet, and mobile projects.
    - expect: there is no horizontal overflow, covered content, off-screen primary action, or blank `/book` page.
  2. Navigate forms and dialogs by keyboard.
    - expect: controls have labels/accessibility names and focus stays inside open dialogs.
