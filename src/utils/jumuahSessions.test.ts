import { describe, it, expect } from 'vitest';
import { normaliseJumuahSessions } from './jumuahSessions';

describe('normaliseJumuahSessions', () => {
  it('returns all sessions from jumuahSessions[] when present', () => {
    const sessions = normaliseJumuahSessions({
      jummahKhutbah: '13:00',
      jummahJamaat: '13:30',
      jumuahSessions: [
        { label: "1st Jumu'ah", khutbah: '13:00', jamaat: '13:30' },
        { label: "2nd Jumu'ah", khutbah: '14:15', jamaat: '14:45' },
      ],
    });
    expect(sessions).toEqual([
      { label: "1st Jumu'ah", khutbah: '13:00', jamaat: '13:30' },
      { label: "2nd Jumu'ah", khutbah: '14:15', jamaat: '14:45' },
    ]);
  });

  it('falls back to legacy jummahKhutbah/jummahJamaat when the array is absent', () => {
    expect(
      normaliseJumuahSessions({
        jummahKhutbah: '13:00',
        jummahJamaat: '13:30',
      }),
    ).toEqual([{ label: "Jumu'ah", khutbah: '13:00', jamaat: '13:30' }]);
  });

  it('falls back to legacy fields when jumuahSessions is empty', () => {
    expect(
      normaliseJumuahSessions({
        jummahJamaat: '13:30',
        jumuahSessions: [],
      }),
    ).toEqual([{ label: "Jumu'ah", khutbah: null, jamaat: '13:30' }]);
  });

  it('skips invalid array entries and still uses valid sessions', () => {
    expect(
      normaliseJumuahSessions({
        jumuahSessions: [
          { label: 'Broken' },
          { label: "1st Jumu'ah", khutbah: '13:00', jamaat: '13:30' },
        ],
      }),
    ).toEqual([{ label: "1st Jumu'ah", khutbah: '13:00', jamaat: '13:30' }]);
  });

  it('returns an empty list when neither array nor legacy jamaat is present', () => {
    expect(normaliseJumuahSessions({ fajr: '05:30' })).toEqual([]);
    expect(normaliseJumuahSessions(null)).toEqual([]);
  });
});
