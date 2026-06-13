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

/**
 * How a MEDIA_SLIDE asset is fitted to the display area:
 * - `smart`   — edge-to-edge; whole image shown over a blurred zoomed copy of itself
 *               (best for posters whose aspect ratio differs from the screen)
 * - `cover`   — edge-to-edge; fills the screen, edges may be cropped
 * - `contain` — inline within the carousel content box; whole image, plain letterbox
 */
export type MediaFit = 'smart' | 'contain' | 'cover';

const MEDIA_FIT_VALUES: readonly MediaFit[] = ['smart', 'contain', 'cover'];

/**
 * Resolve the effective fit mode for a MEDIA_SLIDE content blob.
 *
 * Prefers the explicit `mediaFit` field. Falls back to the legacy `fullscreen`
 * boolean for content saved before fit modes existed: `fullscreen === true`
 * maps to `cover`, anything else to `contain`. This preserves the original
 * look of old slides while letting new content opt into `smart`.
 */
export function resolveMediaFit(content: unknown): MediaFit {
  const raw =
    content && typeof content === 'object'
      ? (content as { mediaFit?: unknown }).mediaFit
      : undefined;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if ((MEDIA_FIT_VALUES as string[]).includes(s)) return s as MediaFit;
  }
  const fullscreen =
    content && typeof content === 'object'
      ? parseMediaFullscreenFlag((content as { fullscreen?: unknown }).fullscreen)
      : false;
  return fullscreen ? 'cover' : 'contain';
}
