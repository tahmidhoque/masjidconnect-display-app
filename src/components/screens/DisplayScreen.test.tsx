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
});
