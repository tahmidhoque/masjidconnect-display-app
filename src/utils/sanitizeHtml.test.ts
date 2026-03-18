/**
 * Tests for sanitizeHtml — XSS prevention and allowed tags.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('returns empty string for null or undefined', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('allows safe inline formatting tags', () => {
    const html = '<p>Hello <strong>bold</strong> and <em>italic</em> text.</p>';
    expect(sanitizeHtml(html)).toContain('<strong>bold</strong>');
    expect(sanitizeHtml(html)).toContain('<em>italic</em>');
    expect(sanitizeHtml(html)).toContain('<p>');
  });

  it('allows lists (ul, ol, li)', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(sanitizeHtml(html)).toContain('<ul>');
    expect(sanitizeHtml(html)).toContain('<li>Item 1</li>');
  });

  it('allows links with href', () => {
    const html = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(html)).toContain('href="https://example.com"');
    expect(sanitizeHtml(html)).toContain('<a ');
  });

  it('strips script tags', () => {
    const html = '<p>Safe</p><script>alert("xss")</script>';
    expect(sanitizeHtml(html)).not.toContain('<script>');
    expect(sanitizeHtml(html)).not.toContain('alert');
  });

  it('strips event handlers', () => {
    const html = '<p onclick="alert(1)">Click</p>';
    expect(sanitizeHtml(html)).not.toContain('onclick');
  });

  it('strips style and iframe', () => {
    const html = '<style>body{color:red}</style><iframe src="evil.com"></iframe>';
    expect(sanitizeHtml(html)).not.toContain('<style>');
    expect(sanitizeHtml(html)).not.toContain('<iframe>');
  });
});
