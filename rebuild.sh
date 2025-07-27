#!/bin/bash

# Exit on error
set -e

echo "Rebuilding MasjidConnect Display Application..."

# Clean up previous builds
echo "Cleaning up previous builds..."
rm -rf build dist

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Ensure electron-store is installed
echo "Ensuring electron-store is installed..."
npm install electron-store --save

# Create a modified index.html for the build that uses relative paths
echo "Creating relative path index.html..."
cat > public/index.html << 'EOL'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="./favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="MasjidConnect Display App - A digital signage solution for mosques"
    />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file:; script-src 'self' 'unsafe-inline' 'unsafe-eval' file:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com file: data:; font-src 'self' 'unsafe-inline' data: file: https://fonts.gstatic.com; connect-src 'self' http: https: ws: wss: file:; img-src 'self' data: blob: file: https:; media-src 'self' data: blob: file:;" />
    <link rel="apple-touch-icon" href="./logo192.png" />
    <link rel="manifest" href="./manifest.json" />
    <base href="./" />
    <title>MasjidConnect Display</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOL

# Create/modify the webpack config overrides for relative paths
echo "Updating webpack config overrides..."
cat > config-overrides.js << 'EOL'
const { override } = require('customize-cra');
const webpack = require('webpack');

module.exports = override(
  // Force webpack to use relative paths instead of absolute paths
  function(config) {
    // Change the output path configuration to use relative paths
    config.output.publicPath = './';
    
    // Use relative paths for chunks
    if (config.optimization && config.optimization.splitChunks) {
      config.optimization.runtimeChunk = 'single';
    }
    
    // Force use of relative paths for assets
    if (config.plugins) {
      config.plugins.forEach(plugin => {
        if (plugin.constructor.name === 'MiniCssExtractPlugin') {
          plugin.options.publicPath = './';
        }
        if (plugin.constructor.name === 'HtmlWebpackPlugin') {
          if (!plugin.userOptions) plugin.userOptions = {};
          plugin.userOptions.publicPath = './';
        }
      });
    }
    
    // Log the config options for debugging
    console.log("Webpack publicPath:", config.output.publicPath);
    
    return config;
  },
  
  // Add webpack define plugin to set runtime variables
  function(config) {
    if (!config.plugins) config.plugins = [];
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.RUNNING_IN_ELECTRON': JSON.stringify(true),
      })
    );
    return config;
  }
);
EOL

# Tell create-react-app to use our config-overrides.js
echo "Modifying package.json to use react-app-rewired..."
npm install --save-dev react-app-rewired

# Build the React app
echo "Building React application with relative paths..."
PUBLIC_URL="./" npm run build

# Fix paths in the index.html file directly after build
echo "Fixing path references in build/index.html..."
# Replace all absolute paths with relative paths in the generated index.html
sed -i.bak 's|src="/static/|src="./static/|g' build/index.html
sed -i.bak 's|href="/static/|href="./static/|g' build/index.html
rm -f build/index.html.bak

# Also fix the asset-manifest.json file to use relative paths
echo "Fixing asset-manifest.json to use relative paths..."
if [ -f "build/asset-manifest.json" ]; then
  sed -i.bak 's|": "/static/|": "./static/|g' build/asset-manifest.json
  rm -f build/asset-manifest.json.bak
fi

# Ensure the static directory exists in electron
if [ ! -d "electron/static" ]; then
  echo "Creating electron/static directory..."
  mkdir -p electron/static/js
  mkdir -p electron/static/css
  mkdir -p electron/static/media
fi

# Copy index.html to electron directory for fallback
echo "Copying index.html to electron directory..."
cp build/index.html electron/index.html

# Make sure base href is set
if ! grep -q "<base href=\"\.\/\"" electron/index.html; then
  echo "Adding base href to electron/index.html..."
  sed -i.bak 's|</head>|<base href="./" /></head>|' electron/index.html
  rm -f electron/index.html.bak
fi

# Copy static assets to electron/static for fallback access
echo "Copying static assets to electron/static..."
cp -r build/static/js/* electron/static/js/
cp -r build/static/css/* electron/static/css/
if [ -d "build/static/media" ]; then
  cp -r build/static/media/* electron/static/media/
fi

# Copy other important files
echo "Copying other important files..."
cp build/favicon.ico electron/favicon.ico
cp build/manifest.json electron/manifest.json
if [ -f "build/logo192.png" ]; then
  cp build/logo192.png electron/logo192.png
fi

# Create a version file for debugging
echo "Creating version file for debugging..."
echo "Build created on $(date)" > build/version.txt
echo "Node version: $(node -v)" >> build/version.txt
echo "NPM version: $(npm -v)" >> build/version.txt
echo "electron-store version: $(npm list electron-store | grep electron-store)" >> build/version.txt

# Create a patched main.html with fixed paths as an alternative entry point
echo "Creating patched index.html with fixed paths..."
cat > build/main.html << 'EOL'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="./favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="MasjidConnect Display App - A digital signage solution for mosques"
    />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file:; script-src 'self' 'unsafe-inline' 'unsafe-eval' file:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com file: data:; font-src 'self' 'unsafe-inline' data: file: https://fonts.gstatic.com; connect-src 'self' http: https: ws: wss: file:; img-src 'self' data: blob: file: https:; media-src 'self' data: blob: file:;" />
    <link rel="apple-touch-icon" href="./logo192.png" />
    <link rel="manifest" href="./manifest.json" />
    <base href="./" />
    <title>MasjidConnect Display</title>
    <script defer="defer" src="./static/js/main.9ca1e6b8.js"></script>
    <link href="./static/css/main.81d84cc7.css" rel="stylesheet">
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOL

# Update the main.js file to try this patched file as a fallback
echo "Patching electron/main.js to try patched index.html..."
cat > electron/main.js.patch << 'EOL'
// Add patched main.html to the list of possible index paths
const possibleIndexPaths = [
  path.join(appDirectory, 'build/index.html'),
  path.join(appDirectory, 'build/main.html'),
  path.join(appDirectory, 'electron/index.html'),
  path.join(appDirectory, 'index.html'),
  path.join(path.dirname(app.getPath('exe')), 'resources/app/build/index.html'),
  path.join(path.dirname(app.getPath('exe')), 'resources/app/build/main.html'),
  path.join(path.dirname(app.getPath('exe')), 'resources/app/electron/index.html')
];
EOL
echo "NOTE: Manually update electron/main.js to include build/main.html in the possibleIndexPaths list"

# Create a test HTML to verify static file loading
echo "Creating test HTML file..."
cat > electron/test.html << 'EOL'
<!DOCTYPE html>
<html>
<head>
  <title>Static File Test</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .success { color: green; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>Static File Loading Test</h1>
  <div>
    <h3>JS File:</h3>
    <div id="js-test">Testing...</div>
  </div>
  <div>
    <h3>CSS File:</h3>
    <div id="css-test">This should be blue if CSS loads correctly</div>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // JS file was loaded if this script runs
      document.getElementById('js-test').className = 'success';
      document.getElementById('js-test').textContent = 'JavaScript file loaded successfully!';
      
      // Check if CSS was loaded
      const style = window.getComputedStyle(document.getElementById('css-test'));
      if (style.color === 'rgb(0, 0, 255)') {
        document.getElementById('css-test').textContent += ' - CSS loaded successfully!';
      } else {
        document.getElementById('css-test').className = 'error';
        document.getElementById('css-test').textContent += ' - CSS failed to load!';
      }
    });
  </script>
  <link rel="stylesheet" href="./test-style.css">
</body>
</html>
EOL

# Create test CSS file
echo "Creating test CSS file..."
cat > electron/test-style.css << 'EOL'
#css-test {
  color: blue;
}
EOL

# Build the Electron app
echo "Building Electron application..."
npm run electron:build:rpi:noicon

echo "Build completed! The application is available in the dist directory."
echo "Install with: sudo dpkg -i dist/masjidconnect-display-*.deb" 