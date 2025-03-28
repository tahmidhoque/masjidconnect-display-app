# MasjidConnect Display App

A digital signage application for mosques to display prayer times, announcements, events, and other content.

## Overview

The MasjidConnect Display App is designed to be run on screens throughout a mosque/masjid to provide real-time information to worshippers. It features:

- Prayer times display with countdown to next prayer
- Announcements and events
- Islamic content (verses, hadiths, etc.)
- Support for both landscape and portrait orientations
- Offline functionality
- Automatic updates

## Key Features

- **No User Input Required**: This is a display-only application designed for digital signage. Users do not interact with the app directly.
- **Pairing System**: Screens are paired with the MasjidConnect management system using a simple code.
- **Responsive Design**: Adapts to different screen sizes and orientations.
- **Offline Support**: Continues to function even when internet connectivity is lost.
- **Real-time Updates**: Automatically syncs with the management system for up-to-date content.

## Technical Details

- Built with React and TypeScript
- Uses Material UI for components
- Implements a service worker for offline functionality
- Uses local storage and IndexedDB (via localforage) for data persistence

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm 7.x or higher

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   REACT_APP_API_URL=https://api.masjidconnect.com
   ```
4. Start the development server:
   ```
   npm start
   ```

### Building for Production

```
npm run build
```

This will create a production-ready build in the `build` folder.

## Deployment

The app is designed to be deployed on any static hosting service or directly on devices like Raspberry Pi, Android tablets, or dedicated digital signage hardware.

### Recommended Deployment Options

1. **Web Hosting**: Deploy to services like Netlify, Vercel, or Firebase Hosting
2. **Dedicated Hardware**: Run on a Raspberry Pi in kiosk mode
3. **Tablets**: Use in full-screen mode on Android or iOS tablets

## Development Notes

- This is a "no user input" application - it's designed to be displayed on screens without user interaction
- The app automatically handles orientation changes
- Service workers are used for offline functionality and caching
- The app sends heartbeats to the server to indicate it's online and functioning

## Offline Capabilities

The MasjidConnect Display App includes robust offline support features:

### Implemented Features:

1. **Service Worker with Workbox**:
   - Strategic caching of static assets, API responses, and critical resources
   - Background sync when connection is restored
   - Automatic updates when new content is available

2. **Intelligent Data Caching**:
   - All API responses are cached locally using IndexedDB (via localforage)
   - Cached data is served when offline
   - Automatic synchronization when connection is restored

3. **Prayer Timing Logic**:
   - Locally calculates prayer times when offline
   - Uses device clock to maintain accurate timing even without connectivity

4. **User Experience**:
   - Visual indicator showing offline status
   - Duration of offline state
   - Automatic reconnection handling

5. **Multi-Layer Data Persistence**:
   - Browser cache for assets via service worker
   - IndexedDB for API data
   - LocalStorage for critical configuration

### How It Works:

- On first load, all critical data is cached
- The app checks connection status continuously
- When offline, it serves cached content
- When connection is restored, data is synchronized in background
- Display automatically updates when new data is available

### Development Testing:

You can test offline capabilities by:
1. Loading the app while online
2. Using browser dev tools to switch to offline mode (Network tab)
3. Refreshing the page to see offline behavior
4. The application should continue to function with the last cached data

## License

This project is proprietary software owned by MasjidConnect.

## Contact

For support or inquiries, contact support@masjidconnect.com 