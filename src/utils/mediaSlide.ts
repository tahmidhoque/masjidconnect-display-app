/**
 * Coerce API / JSON values for MEDIA_SLIDE `fullscreen` (boolean, string, 0/1).
 */
export function parseMediaFullscreenFlag(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false || raw == null) return false;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw === 1;
  return false;
}
