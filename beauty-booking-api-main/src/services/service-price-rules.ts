type Rule = {
  id: string;
  name: string;
  version: number;
  priority: number;
  variantId: string | null;
  adjustmentType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  adjustmentValue: unknown;
  conditions: unknown;
};

const localClock = (at: Date) => `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

export function applyServicePriceRules(input: {
  basePrice: number;
  at: Date;
  variantId?: string | null;
  staffId?: string | null;
  rules: Rule[];
}) {
  let amount = input.basePrice;
  const applied: Array<Record<string, unknown>> = [];
  const clock = localClock(input.at);
  for (const rule of [...input.rules].sort((left, right) => left.priority - right.priority)) {
    if (rule.variantId && rule.variantId !== input.variantId) continue;
    const conditions = (rule.conditions && typeof rule.conditions === 'object' ? rule.conditions : {}) as Record<string, unknown>;
    const days = Array.isArray(conditions.daysOfWeek) ? conditions.daysOfWeek.map(Number) : [];
    if (days.length && !days.includes(input.at.getDay())) continue;
    if (typeof conditions.startTime === 'string' && clock < conditions.startTime) continue;
    if (typeof conditions.endTime === 'string' && clock >= conditions.endTime) continue;
    if (typeof conditions.staffId === 'string' && conditions.staffId !== input.staffId) continue;
    const value = Number(rule.adjustmentValue);
    if (!Number.isFinite(value)) continue;
    const delta = rule.adjustmentType === 'PERCENTAGE' ? amount * value / 100 : value;
    amount = Math.max(0, amount + delta);
    applied.push({ id: rule.id, version: rule.version, name: rule.name, adjustmentType: rule.adjustmentType, adjustmentValue: value, delta: Number(delta.toFixed(2)), conditions });
  }
  return { amount: Number(amount.toFixed(2)), applied };
}
