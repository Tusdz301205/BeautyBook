export function operationsWebUrl(path = '/salon'): string | null {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (!configured || !/^\/(salon|login)(\/|$)/.test(path) || path.includes('..') || path.includes('?')) return null;
  try { const base = new URL(configured); if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) return null; return new URL(path, base.origin).toString(); } catch { return null; }
}
