/**
 * Tests for DisplayScreen — schedule-to-carousel mapping (DUA and other types).
 */

import { describe, it, expect } from 'vitest';
import { scheduleItemToCarouselItems } from './DisplayScreen';

describe('scheduleItemToCarouselItems', () => {
  it('maps DUA schedule item to carousel item with arabicBody, transliteration, body, and source', () => {
    const scheduleItem = {
      id: 'dua-1',
      order: 0,
      type: 'DUA',
      title: 'Dua for guidance',
      content: {
        arabicText: 'اَهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
        transliteration: 'Ihdina as-sirata al-mustaqim',
        translation: 'Guide us to the straight path',
        reference: 'Surah Al-Fatiha, 1:6',
      },
      duration: 25,
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 0);
    expect(result).toHaveLength(1);
    const carouselItem = result[0];
    expect(carouselItem.type).toBe('DUA');
    expect(carouselItem.id).toBe('dua-1');
    expect(carouselItem.title).toBe('Dua for guidance');
    expect(carouselItem.arabicBody).toBe('اَهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ');
    expect(carouselItem.transliteration).toBe('Ihdina as-sirata al-mustaqim');
    expect(carouselItem.body).toBe('Guide us to the straight path');
    expect(carouselItem.source).toBe('Surah Al-Fatiha, 1:6');
    expect(carouselItem.duration).toBe(25);
  });

  it('maps DUA item with alternative content keys (latin, english, source)', () => {
    const scheduleItem = {
      id: 'dua-2',
      order: 1,
      type: 'DUA',
      content: {
        arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي',
        latin: 'Rabbishrah li sadri',
        english: 'My Lord, expand my breast',
        source: 'Surah Taha 20:25',
      },
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 1);
    expect(result).toHaveLength(1);
    const carouselItem = result[0];
    expect(carouselItem.type).toBe('DUA');
    expect(carouselItem.arabicBody).toBe('رَبِّ اشْرَحْ لِي صَدْرِي');
    expect(carouselItem.transliteration).toBe('Rabbishrah li sadri');
    expect(carouselItem.body).toBe('My Lord, expand my breast');
    expect(carouselItem.source).toBe('Surah Taha 20:25');
  });

  it('maps flattened DUA item (content at top level) from normalized schedule', () => {
    const normalizedItem = {
      id: 'n-dua-1',
      order: 0,
      type: 'DUA',
      title: 'Dua',
      content: {
        arabicText: 'نص',
        transliteration: 'nun',
        translation: 'Text',
      },
      duration: 20,
      contentItem: {
        id: 'c1',
        type: 'DUA',
        title: 'Dua',
        content: {
          arabicText: 'نص',
          transliteration: 'nun',
          translation: 'Text',
        },
        duration: 20,
      },
    };
    const result = scheduleItemToCarouselItems(normalizedItem, 0);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('DUA');
    expect(result[0].arabicBody).toBe('نص');
    expect(result[0].transliteration).toBe('nun');
    expect(result[0].body).toBe('Text');
  });

  it('maps ANNOUNCEMENT with isHTML and fontSize to bodyIsHTML and bodyFontSize', () => {
    const scheduleItem = {
      id: 'ann-1',
      order: 0,
      type: 'ANNOUNCEMENT',
      title: 'Important notice',
      content: {
        text: '<p>Please <strong>attend</strong> the meeting.</p>',
        isHTML: true,
        fontSize: 'large',
      },
      duration: 15,
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 0);
    expect(result).toHaveLength(1);
    const carouselItem = result[0];
    expect(carouselItem.type).toBe('ANNOUNCEMENT');
    expect(carouselItem.body).toBe('<p>Please <strong>attend</strong> the meeting.</p>');
    expect(carouselItem.bodyIsHTML).toBe(true);
    expect(carouselItem.bodyFontSize).toBe('large');
  });

  it('maps CUSTOM with isHTML false to plain body (no bodyIsHTML)', () => {
    const scheduleItem = {
      id: 'custom-1',
      order: 0,
      type: 'CUSTOM',
      title: 'Custom content',
      content: {
        text: 'Plain text with line breaks',
        isHTML: false,
      },
      duration: 20,
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 0);
    expect(result).toHaveLength(1);
    const carouselItem = result[0];
    expect(carouselItem.body).toBe('Plain text with line breaks');
    expect(carouselItem.bodyIsHTML).toBeUndefined();
    expect(carouselItem.bodyFontSize).toBeUndefined();
  });

  it('maps VERSE_HADITH with HTML body but no isHTML flag to bodyIsHTML true', () => {
    const scheduleItem = {
      id: 'verse-1',
      order: 0,
      type: 'VERSE_HADITH',
      title: 'Al-Fatiha',
      content: {
        translation: '<p>In the name of <strong>Allah</strong>, the Most Gracious.</p>',
        arabicText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      },
      duration: 30,
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 0);
    expect(result).toHaveLength(1);
    const carouselItem = result[0];
    expect(carouselItem.body).toBe('<p>In the name of <strong>Allah</strong>, the Most Gracious.</p>');
    expect(carouselItem.bodyIsHTML).toBe(true);
    expect(carouselItem.arabicBody).toBe('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  });

  it('maps legacy item without isHTML (backward compatibility)', () => {
    const scheduleItem = {
      id: 'legacy-1',
      order: 0,
      type: 'ANNOUNCEMENT',
      title: 'Legacy announcement',
      content: {
        text: 'Old format without isHTML flag',
      },
      duration: 10,
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 0);
    expect(result).toHaveLength(1);
    const carouselItem = result[0];
    expect(carouselItem.body).toBe('Old format without isHTML flag');
    expect(carouselItem.bodyIsHTML).toBeUndefined();
    expect(carouselItem.bodyFontSize).toBeUndefined();
  });

  it('maps MEDIA_SLIDE with image/webp, fullscreen, and duration', () => {
    const scheduleItem = {
      id: 'ms-1',
      order: 0,
      type: 'MEDIA_SLIDE',
      title: 'Ramadan poster',
      duration: 25,
      content: {
        mediaUrl: 'https://example.com/poster.webp',
        mimeType: 'image/webp',
        storageKey: 'm/poster.webp',
        fullscreen: true,
      },
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 0);
    expect(result).toHaveLength(1);
    const ci = result[0];
    expect(ci.type).toBe('MEDIA_SLIDE');
    expect(ci.id).toBe('ms-1');
    expect(ci.title).toBe('Ramadan poster');
    expect(ci.mediaUrl).toBe('https://example.com/poster.webp');
    expect(ci.mediaKind).toBe('image');
    expect(ci.fullscreen).toBe(true);
    expect(ci.duration).toBe(25);
    expect(ci.imageUrl).toBeUndefined();
  });

  it('maps MEDIA_slide case-insensitively', () => {
    const scheduleItem = {
      id: 'ms-2',
      order: 1,
      type: 'media_slide',
      title: 'Poster',
      content: {
        mediaUrl: 'https://example.com/a.jpg',
        mimeType: 'image/jpeg',
      },
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 1);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('MEDIA_SLIDE');
    expect(result[0].mediaKind).toBe('image');
  });

  it('maps MEDIA_SLIDE PDF to mediaKind pdf', () => {
    const scheduleItem = {
      id: 'ms-pdf',
      order: 0,
      type: 'MEDIA_SLIDE',
      title: 'Fundraising leaflet',
      content: {
        mediaUrl: 'https://example.com/doc.pdf',
        mimeType: 'application/pdf',
      },
      duration: 40,
    };
    const result = scheduleItemToCarouselItems(scheduleItem, 0);
    expect(result).toHaveLength(1);
    expect(result[0].mediaKind).toBe('pdf');
    expect(result[0].duration).toBe(40);
  });

  it('returns empty array when MEDIA_SLIDE has missing mediaUrl', () => {
    const scheduleItem = {
      id: 'bad-1',
      type: 'MEDIA_SLIDE',
      content: { mimeType: 'image/png' },
    };
    expect(scheduleItemToCarouselItems(scheduleItem, 0)).toEqual([]);
  });

  it('returns empty array when MEDIA_SLIDE has invalid mimeType', () => {
    const scheduleItem = {
      id: 'bad-2',
      type: 'MEDIA_SLIDE',
      content: {
        mediaUrl: 'https://example.com/x',
        mimeType: 'application/octet-stream',
      },
    };
    expect(scheduleItemToCarouselItems(scheduleItem, 0)).toEqual([]);
  });

  it('coerces fullscreen from string for MEDIA_SLIDE', () => {
    const result = scheduleItemToCarouselItems(
      {
        id: 'ms-fs',
        type: 'MEDIA_SLIDE',
        content: {
          mediaUrl: 'https://example.com/p.png',
          mimeType: 'image/png',
          fullscreen: 'true',
        },
      },
      0,
    );
    expect(result[0].fullscreen).toBe(true);
  });
});
