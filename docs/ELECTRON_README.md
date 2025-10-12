# MasjidConnect Display App (Electron)

A digital signage application for mosques built with Electron, React, and TypeScript. This app displays prayer times, announcements, events, and other content for mosque digital displays.

## Features

- 📱 Support for both portrait and landscape orientations
- 🕌 Real-time prayer time display
- 📅 Events and announcements display
- 🔄 Automatic content updates
- 💾 Full offline support
- 🚀 Over-the-Air (OTA) updates
- 🖥️ Optimized for Raspberry Pi and macOS

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Git

### Installation

#### Development

```bash
# Clone the repository
git clone https://github.com/masjidSolutions/masjidconnect-display-app.git
cd masjidconnect-display-app

# Install dependencies
npm install

# Start the development server
npm run electron:dev
```

#### Production

Download the latest release from:
https://github.com/masjidSolutions/masjidconnect-display-app/releases

Available packages:
- macOS: `.dmg`
- Raspberry Pi / Linux: `.AppImage` or `.deb`

## Development

### Project Structure

```
├── electron/             # Electron-specific files
│   ├── main.js           # Main process entry point
│   └── preload.js        # Preload script for IPC
├── src/                  # React application source
│   ├── api/              # API client and models
│   ├── components/       # React components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Services for data handling
│   ├── theme/            # Theme configuration
│   └── utils/            # Utility functions
├── docs/                 # Documentation
│   ├── ELECTRON.md       # Electron app documentation
│   └── OTA_UPDATES.md    # OTA update system documentation
└── assets/               # Application assets
```

### Available Scripts

- `npm run electron:dev` - Start the development server with hot reload
- `npm run electron:build` - Build the application for production (without publishing)
- `npm run electron:build:publish` - Build and publish a new release
- `npm run electron:start` - Start the Electron app using the built files

## Deployment

### Building for Different Platforms

```bash
# Build for macOS and Linux
npm run electron:build

# Build and publish to GitHub Releases
npm run electron:build:publish
```

### Raspberry Pi Deployment

See [ELECTRON.md](docs/ELECTRON.md) for detailed instructions on deploying to Raspberry Pi.

## Updates

The app includes an OTA update system that automatically checks for and installs updates. For detailed information on the update process, see [OTA_UPDATES.md](docs/OTA_UPDATES.md).

## Issues and Support

If you encounter any issues, please report them on the [GitHub issues page](https://github.com/masjidSolutions/masjidconnect-display-app/issues).

## License

This project is proprietary software owned by MasjidConnect. 