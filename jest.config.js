module.exports = {
  // Use react-scripts Jest configuration as base
  ...require('react-scripts/scripts/utils/createJestConfig')(__dirname),
  
  // Transform ESM modules from node_modules (axios uses ESM)
  transformIgnorePatterns: [
    'node_modules/(?!(axios|@jridgewell)/)',
  ],
  
  // Mock axios module globally and handle CSS imports
  moduleNameMapper: {
    '^axios$': require.resolve('./src/__mocks__/axios.js'),
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/reportWebVitals.ts',
    '!src/serviceWorkerRegistration.ts',
  ],
  
  // Module directories
  moduleDirectories: ['node_modules', 'src'],
};

