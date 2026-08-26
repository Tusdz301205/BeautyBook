import { applyServicePriceRules } from './service-price-rules';

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: 'rule-1', name: 'Phụ thu', version: 1, priority: 1, variantId: null,
  adjustmentType: 'FIXED_AMOUNT' as const, adjustmentValue: 20_000, conditions: {},
  ...overrides,
});

describe('applyServicePriceRules', () => {
  it('applies matching rules in priority order and snapshots each delta', () => {
    const result = applyServicePriceRules({
      basePrice: 100_000,
      at: new Date(2026, 7, 22, 18, 30),
      rules: [
        rule({ id: 'fixed', priority: 2 }),
        rule({ id: 'percent', priority: 1, adjustmentType: 'PERCENTAGE', adjustmentValue: 10 }),
      ],
    });
    expect(result.amount).toBe(130_000);
    expect(result.applied.map((item) => item.id)).toEqual(['percent', 'fixed']);
  });

  it('enforces variant, staff, day and time conditions', () => {
    const at = new Date(2026, 7, 22, 9, 0);
    const result = applyServicePriceRules({
      basePrice: 100_000,
      at,
      variantId: 'variant-a',
      staffId: 'staff-a',
      rules: [
        rule({ id: 'match', variantId: 'variant-a', conditions: { daysOfWeek: [at.getDay()], startTime: '08:00', endTime: '10:00', staffId: 'staff-a' } }),
        rule({ id: 'wrong-variant', variantId: 'variant-b' }),
        rule({ id: 'wrong-time', conditions: { startTime: '10:00' } }),
      ],
    });
    expect(result.amount).toBe(120_000);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].id).toBe('match');
  });

  it('never produces a negative price', () => {
    const result = applyServicePriceRules({
      basePrice: 50_000,
      at: new Date(2026, 7, 22, 9, 0),
      rules: [rule({ adjustmentValue: -100_000 })],
    });
    expect(result.amount).toBe(0);
  });
});
