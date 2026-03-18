/**
 * sanitizeHtml
 *
 * Sanitises HTML for safe rendering via dangerouslySetInnerHTML.
 * Uses DOMPurify with a strict allowlist to prevent XSS.
 *
 * Allowed tags: p, strong, b, em, i, u, ul, ol, li, br, a
 * Allowed attributes: href (on a only)
 */

import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'br', 'a'];
const ALLOWED_ATTR = ['href'];

/**
 * Sanitise HTML for safe display. Strips scripts, styles, iframes, and other
 * dangerous content. Returns empty string for null/undefined input.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (html == null || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
