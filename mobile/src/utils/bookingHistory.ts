export interface HistoryEntry {
  id: string;
  isReal: boolean;
  date: string;
  rawStatus?: string;
}

export interface HistoryPeriod {
  month: number | null;
  year: number | null;
}

/** Appointment dates are already branch wall dates (dd/MM/yyyy), not device instants. */
export function historyDate(date: string): { month: number; year: number } | null {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(date);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? { month, year } : null;
}

export function filterHistory<T extends HistoryEntry>(entries: T[], period: HistoryPeriod): T[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    if (!entry.isReal || seen.has(entry.id)) return false;
    seen.add(entry.id);
    if (period.month === null && period.year === null) return true;
    const date = historyDate(entry.date);
    return Boolean(date && (period.month === null || date.month === period.month)
      && (period.year === null || date.year === period.year));
  });
}

export function historySummary(entries: HistoryEntry[]) {
  const rows = filterHistory(entries, { month: null, year: null });
  return {
    total: rows.length,
    completed: rows.filter(entry => entry.rawStatus === 'COMPLETED').length,
    cancelled: rows.filter(entry => entry.rawStatus === 'CANCELLED').length,
  };
}

export function historyYears(entries: HistoryEntry[], currentYear: number): number[] {
  return [...new Set([currentYear, ...entries.filter(entry => entry.isReal)
    .flatMap(entry => { const date = historyDate(entry.date); return date ? [date.year] : []; })])]
    .sort((a, b) => b - a);
}
