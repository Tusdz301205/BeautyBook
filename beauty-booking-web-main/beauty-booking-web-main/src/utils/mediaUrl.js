// Uploaded media paths belong to the API origin; generated assets stay on the frontend.
export function uploadedMediaUrl(value, apiBase = import.meta.env?.VITE_API_BASE || 'http://localhost:3000/api/v1') {
  if (!value) return '';
  try {
    const url = new URL(value, new URL(apiBase).origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
