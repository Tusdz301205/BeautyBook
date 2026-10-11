// Memory-only lease: credential transitions invalidate work even when a user
// logs back into the same account. Ordinary refresh keeps the current lease.
let generation = 0;

// Compare the server's session context, not rotating tokens or refreshed role
// grants. Missing optional context fields normalize to null on both sides.
export function sameSessionIdentity(left, right) {
  return ['id', 'sessionType', 'workspace', 'businessId', 'branchId', 'sessionId']
    .every(field => (left?.[field] ?? null) === (right?.[field] ?? null));
}

export function captureSessionGeneration() { return generation; }
export function advanceSessionGeneration() { return ++generation; }
export function isSessionGenerationCurrent(lease) { return lease === generation; }
export function assertSessionGeneration(lease) {
  if (!isSessionGenerationCurrent(lease)) {
    const error = new Error('Phiên đăng nhập đã thay đổi.');
    error.code = 'STALE_SESSION';
    throw error;
  }
}
