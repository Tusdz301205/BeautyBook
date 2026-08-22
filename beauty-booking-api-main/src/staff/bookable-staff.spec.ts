import { bookableStaffWhere, professionalTitle, staffRating } from './bookable-staff';

describe('bookable staff policy', () => {
  test('requires an active, non-deleted profile explicitly enabled for bookings', () => {
    expect(bookableStaffWhere()).toEqual(expect.objectContaining({
      status: 'ACTIVE', deletedAt: null, isBookable: true,
    }));
  });

  test('scopes providers to the requested branch', () => {
    expect(bookableStaffWhere({ branchId: 'branch-a' })).toEqual(expect.objectContaining({ branchId: 'branch-a' }));
  });

  test('requires public visibility only on customer-facing lists', () => {
    expect(bookableStaffWhere({ publicOnly: true })).toEqual(expect.objectContaining({ publicVisible: true }));
    expect(bookableStaffWhere()).not.toHaveProperty('publicVisible');
  });

  test('requires a configured working schedule when the caller requests it', () => {
    expect(bookableStaffWhere({ requireSchedule: true })).toEqual(expect.objectContaining({
      workingHours: { some: { isOff: false } },
    }));
  });

  test('requires at least one selected service assignment and deduplicates ids', () => {
    expect(bookableStaffWhere({ serviceIds: ['service-a', 'service-a', 'service-b'] })).toEqual(expect.objectContaining({
      staffServices: { some: { serviceId: { in: ['service-a', 'service-b'] } } },
    }));
  });

  test('accepts account-less profiles or active linked accounts, never inactive accounts', () => {
    expect(bookableStaffWhere().OR).toEqual([
      { userId: null },
      { user: { is: { isActive: true, deletedAt: null } } },
    ]);
  });

  test('does not infer provider eligibility from manager, receptionist or owner roles', () => {
    const serialized = JSON.stringify(bookableStaffWhere());
    expect(serialized).not.toContain('BRANCH_MANAGER');
    expect(serialized).not.toContain('RECEPTIONIST');
    expect(serialized).not.toContain('BUSINESS_OWNER');
  });

  test.each(['BRANCH_MANAGER', 'Branch Manager', 'RECEPTIONIST', 'BUSINESS_OWNER', 'Business Owner', 'Quản lý chi nhánh', 'Lễ tân', 'Chủ cơ sở'])(
    'never exposes internal position %s as a professional title',
    (position) => expect(professionalTitle(position)).toBe('Chuyên viên làm đẹp'),
  );

  test('preserves a real professional title', () => {
    expect(professionalTitle('Senior hair stylist')).toBe('Senior hair stylist');
  });

  test('returns only real approved-rating aggregates supplied by the query', () => {
    expect(staffRating([])).toEqual({ rating: null, ratingCount: 0 });
    expect(staffRating([{ rating: 5 }, { rating: 4 }, { rating: 5 }])).toEqual({ rating: 4.7, ratingCount: 3 });
  });
});
