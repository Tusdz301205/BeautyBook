const roleEnvironment = {
  customer: ['PW_CUSTOMER_EMAIL', 'PW_CUSTOMER_PASSWORD', 'CUSTOMER'],
  bookingCustomer: ['PW_BOOKING_CUSTOMER_EMAIL', 'PW_BOOKING_CUSTOMER_PASSWORD', 'CUSTOMER'],
  anyStaffCustomer: ['PW_ANY_STAFF_CUSTOMER_EMAIL', 'PW_ANY_STAFF_CUSTOMER_PASSWORD', 'CUSTOMER'],
  responsiveCustomer: ['PW_RESPONSIVE_CUSTOMER_EMAIL', 'PW_RESPONSIVE_CUSTOMER_PASSWORD', 'CUSTOMER'],
  lifecycleCustomer: ['PW_LIFECYCLE_CUSTOMER_EMAIL', 'PW_LIFECYCLE_CUSTOMER_PASSWORD', 'CUSTOMER'],
  staff: ['PW_STAFF_EMAIL', 'PW_STAFF_PASSWORD', 'SALON'],
  receptionist: ['PW_RECEPTIONIST_EMAIL', 'PW_RECEPTIONIST_PASSWORD', 'SALON'],
  businessOwner: ['PW_BUSINESS_OWNER_EMAIL', 'PW_BUSINESS_OWNER_PASSWORD', 'SALON'],
  platformAdmin: ['PW_PLATFORM_ADMIN_EMAIL', 'PW_PLATFORM_ADMIN_PASSWORD', 'PLATFORM'],
  inactive: ['PW_INACTIVE_EMAIL', 'PW_INACTIVE_PASSWORD', undefined],
  noScope: ['PW_NO_SCOPE_EMAIL', 'PW_NO_SCOPE_PASSWORD', undefined],
};

export const apiBaseURL = process.env.PW_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export function credentialsFor(role) {
  const keys = roleEnvironment[role];
  if (!keys) throw new Error(`Unknown E2E role: ${role}`);
  const [emailKey, passwordKey, workspace] = keys;
  const email = process.env[emailKey]?.trim();
  const password = process.env[passwordKey];
  return email && password ? { email, password, workspace } : null;
}

export function mutationGate() {
  return process.env.PW_RUN_MUTATING_E2E === '1';
}

export function concurrencyGate() {
  return mutationGate()
    && process.env.PW_RUN_CONCURRENCY_E2E === '1'
    && Boolean(process.env.PW_TEST_DATABASE_URL);
}

export function testName(prefix = 'record') {
  return `PW-E2E-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
