# MasjidConnect Display Layout Ideas

## Overview

This document outlines various layout ideas for the MasjidConnect Display App, focusing on effective presentation of prayer times and other content in both landscape and portrait orientations.

## Key Design Principles

1. **Prayer Times Always Visible**: Prayer times should always be visible regardless of what other content is being displayed
2. **Clear Readability**: Content should be readable from a distance (minimum 10-15 feet)
3. **Visual Hierarchy**: Most important information (next prayer, current announcements) should be most prominent
4. **Consistent Branding**: Follow MasjidConnect design system (colors, typography, etc.)
5. **Responsive Design**: Layouts should adapt to different screen sizes and orientations

## Landscape Orientation Layouts

### Layout 1: Sidebar with Prayer Times

```
+-----------------------------------------------+
| HEADER: MASJID NAME                           |
+---------------+-------------------------------+
|               |                               |
|               |                               |
|  PRAYER TIMES |         MAIN CONTENT         |
|               |                               |
|               |                               |
|               |                               |
+---------------+-------------------------------+
| FOOTER: DATE / TIME / STATUS                  |
+-----------------------------------------------+
```

**Features:**
- Prayer times displayed in left sidebar (always visible)
- Main content area for announcements, events, etc.
- Next prayer highlighted prominently in sidebar
- Current date/time in footer

### Layout 2: Prayer Times Header with Content Rotation

```
+-----------------------------------------------+
| HEADER: MASJID NAME                           |
+-----------------------------------------------+
| NEXT PRAYER | FAJR | ZUHR | ASR | MAGHRIB | ISHA |
+-----------------------------------------------+
|                                               |
|                                               |
|              MAIN CONTENT AREA                |
|                                               |
|                                               |
+-----------------------------------------------+
| ANNOUNCEMENTS TICKER                          |
+-----------------------------------------------+
```

**Features:**
- Compact prayer times row below header
- Next prayer displayed prominently with countdown
- Large main content area for featured content
- Scrolling announcements ticker at bottom

### Layout 3: Split Screen with Featured Content

```
+-----------------------------------------------+
| HEADER: MASJID NAME                           |
+---------------+-------------------------------+
|               |                               |
| PRAYER TIMES  |      FEATURED CONTENT        |
|               |                               |
+---------------+-------------------------------+
|                                               |
|           SECONDARY CONTENT                   |
|                                               |
+-----------------------------------------------+
| FOOTER: DATE / TIME / STATUS                  |
+-----------------------------------------------+
```

**Features:**
- Prayer times in top-left quadrant
- Featured content (e.g., verse of the day) in top-right
- Secondary content (announcements, events) in bottom section
- Good for displaying multiple types of content simultaneously

## Portrait Orientation Layouts

### Layout 1: Stacked Content with Prayer Times Header

```
+-------------------+
| MASJID NAME       |
+-------------------+
| PRAYER TIMES ROW  |
+-------------------+
|                   |
|                   |
|  MAIN CONTENT     |
|                   |
|                   |
|                   |
|                   |
+-------------------+
| NEXT PRAYER       |
| COUNTDOWN         |
+-------------------+
```

**Features:**
- Compact prayer times row at top
- Large main content area
- Next prayer countdown prominently at bottom
- Good for vertical displays like tablets

### Layout 2: Split Content with Prayer Focus

```
+-------------------+
| MASJID NAME       |
+-------------------+
|                   |
|  NEXT PRAYER      |
|  COUNTDOWN        |
|                   |
+-------------------+
| PRAYER TIMES      |
+-------------------+
|                   |
|                   |
|  CONTENT          |
|                   |
|                   |
+-------------------+
| ANNOUNCEMENTS     |
+-------------------+
```

**Features:**
- Next prayer with countdown at top (high visibility)
- All prayer times in middle section
- Content area for announcements, events, etc.
- Scrolling announcements at bottom

### Layout 3: Full Prayer Dashboard

```
+-------------------+
| MASJID NAME       |
+-------------------+
|                   |
|  NEXT PRAYER      |
|  LARGE DISPLAY    |
|                   |
+-------------------+
| FAJR   | ZUHR     |
+--------+----------+
| ASR    | MAGHRIB  |
+--------+----------+
| ISHA   | JUMU'AH  |
+-------------------+
|                   |
|  CONTENT          |
|                   |
+-------------------+
```

**Features:**
- Prayer-focused layout
- Next prayer prominently displayed
- Grid layout for all prayer times
- Smaller content area at bottom
- Good for primary prayer hall displays

## Special Purpose Layouts

### Jumu'ah (Friday Prayer) Focus Layout

```
+-----------------------------------------------+
| HEADER: MASJID NAME                           |
+-----------------------------------------------+
|                                               |
|           JUMU'AH PRAYER TIME                 |
|           LARGE COUNTDOWN                     |
|                                               |
+-----------------------------------------------+
| KHUTBAH: 1:00 PM | PRAYER: 1:30 PM            |
+-----------------------------------------------+
|                                               |
|           ANNOUNCEMENTS / CONTENT             |
|                                               |
+-----------------------------------------------+
| OTHER PRAYER TIMES                            |
+-----------------------------------------------+
```

**Features:**
- Special layout for Fridays
- Prominent display of Jumu'ah time and countdown
- Khutbah (sermon) and prayer times clearly separated
- Other prayer times in smaller format at bottom

### Ramadan Special Layout

```
+-----------------------------------------------+
| HEADER: MASJID NAME                           |
+-----------------------------------------------+
| SUHOOR ENDS: 4:15 AM | IFTAR TIME: 7:45 PM    |
+-----------------------------------------------+
|                                               |
| NEXT PRAYER |         ISLAMIC CONTENT         |
| COUNTDOWN   |                                 |
|             |                                 |
+-----------------------------------------------+
| PRAYER TIMES | TARAWEEH: 9:00 PM              |
+-----------------------------------------------+
| ANNOUNCEMENTS / EVENTS                        |
+-----------------------------------------------+
```

**Features:**
- Ramadan-specific information (Suhoor/Iftar times)
- Next prayer countdown
- Taraweeh prayer time highlighted
- Space for Islamic content and announcements

## Interactive Elements (For Future Phases)

While the current phase focuses on a non-interactive display, future phases could include:

1. **QR Codes**: For downloading prayer times or event details
2. **Weather Information**: Current weather and forecast
3. **Community Metrics**: Donation progress, attendance, etc.
4. **Multi-language Support**: Toggle between languages
5. **Audio Indicators**: Visual cues when adhan (call to prayer) is playing

## Implementation Recommendations

1. **Start with Landscape Layout 1 and Portrait Layout 1**: These provide the best balance of prayer times visibility and content display
2. **Use Material UI Grid System**: For responsive layouts that adapt to different screen sizes
3. **Implement Smooth Transitions**: When switching between content items
4. **Use Bold Colors for Next Prayer**: Make the next prayer stand out visually
5. **Test Readability at Distance**: Ensure text is readable from at least 15 feet away

## Conclusion

These layout ideas provide a starting point for the MasjidConnect Display App. The implementation should prioritize prayer times visibility while maintaining a clean, readable design that works well in both orientations. As the app evolves, additional layouts can be added for special purposes or to accommodate new content types. 