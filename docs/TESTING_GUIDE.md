# MasjidConnect Display App - Testing Guide

## Overview

This guide provides comprehensive information about the testing infrastructure for the MasjidConnect Display App. The test suite covers API clients, services, hooks, utilities, Redux slices, and React components.

## Table of Contents

1. [Test Infrastructure](#test-infrastructure)
2. [Running Tests](#running-tests)
3. [Test Structure](#test-structure)
4. [Writing Tests](#writing-tests)
5. [Testing Patterns](#testing-patterns)
6. [Debugging Tests](#debugging-tests)
7. [Coverage Reports](#coverage-reports)

## Test Infrastructure

### Technologies

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **@testing-library/user-event**: User interaction simulation
- **jest-canvas-mock**: Mock canvas API for testing

### Configuration

Tests are configured through:
- `src/setupTests.ts` - Global test setup and mocks
- `package.json` - Jest configuration via react-scripts

### Test Utilities

Located in `src/test-utils/`:
- **mocks.ts**: Mock data factories and utilities
- **test-providers.tsx**: Provider wrappers for testing components

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- apiErrorHandler.test

# Run tests matching a pattern
npm test -- --testNamePattern="should create error response"
```

### Watch Mode Options

When in watch mode, press:
- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by file name pattern
- `t` - Filter by test name pattern
- `q` - Quit watch mode

## Test Structure

### Directory Organization

```
src/
├── api/
│   ├── __tests__/
│   │   └── masjidDisplayClient.test.ts
│   ├── masjidDisplayClient.ts
│   └── models.ts
├── services/
│   ├── __tests__/
│   │   ├── analyticsService.test.ts
│   │   ├── dataSyncService.test.ts
│   │   └── storageService.test.ts
│   └── *.ts
├── utils/
│   ├── __tests__/
│   │   ├── apiErrorHandler.test.ts
│   │   └── dateUtils.test.ts
│   └── *.ts
└── test-utils/
    ├── mocks.ts
    └── test-providers.tsx
```

### Test Categories

1. **API Tests** - Test API client methods and error handling
2. **Service Tests** - Test business logic and data synchronization
3. **Utility Tests** - Test helper functions and utilities
4. **Hook Tests** - Test custom React hooks
5. **Redux Tests** - Test state management
6. **Component Tests** - Test UI components

## Writing Tests

### Test File Naming

- Test files: `*.test.ts` or `*.test.tsx`
- Location: `__tests__/` directory next to source files
- Naming convention: `{filename}.test.{ts|tsx}`

### Basic Test Structure

```typescript
describe('ComponentName or FunctionName', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Cleanup
  afterEach(() => {
    // cleanup code
  });

  describe('specific functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = someFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Using Mock Data

```typescript
import {
  mockApiCredentials,
  mockPrayerTimes,
  mockScreenContent,
  createSuccessResponse,
  createErrorResponse,
} from '../../test-utils/mocks';

describe('API Test', () => {
  it('should handle successful response', async () => {
    const mockResponse = createSuccessResponse(mockScreenContent);
    // Use mock data in test
  });
});
```

### Testing Components

```typescript
import { renderWithProviders } from '../../test-utils/test-providers';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('MyComponent', () => {
  it('should render correctly', () => {
    renderWithProviders(<MyComponent />);
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyComponent />);
    
    await user.click(screen.getByRole('button'));
    
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### Testing with Redux

```typescript
import { renderWithProviders, setupStore } from '../../test-utils/test-providers';
import { mockReduxState } from '../../test-utils/mocks';

describe('Component with Redux', () => {
  it('should use Redux state', () => {
    const store = setupStore(mockReduxState);
    
    renderWithProviders(<MyComponent />, { store });
    
    // Test component behavior with store
  });
});
```

### Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react';

describe('Async Test', () => {
  it('should handle async operations', async () => {
    const promise = asyncFunction();
    
    await waitFor(() => {
      expect(mockFunction).toHaveBeenCalled();
    });
    
    const result = await promise;
    expect(result).toBeDefined();
  });
});
```

## Testing Patterns

### 1. API Client Testing

Test the API client by mocking axios:

```typescript
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Client', () => {
  beforeEach(() => {
    mockedAxios.create.mockReturnValue({
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as any);
  });

  it('should make API call', async () => {
    // Test implementation
  });
});
```

### 2. Service Testing

Test services by mocking dependencies:

```typescript
import masjidDisplayClient from '../api/masjidDisplayClient';
jest.mock('../api/masjidDisplayClient');

describe('DataSyncService', () => {
  beforeEach(() => {
    (masjidDisplayClient.getScreenContent as jest.Mock)
      .mockResolvedValue(mockResponse);
  });
  
  it('should sync data', async () => {
    // Test implementation
  });
});
```

### 3. Hook Testing

Test hooks using `renderHook` from React Testing Library:

```typescript
import { renderHook, waitFor } from '@testing-library/react';

describe('useCustomHook', () => {
  it('should return expected value', () => {
    const { result } = renderHook(() => useCustomHook());
    
    expect(result.current.value).toBe('expected');
  });
});
```

### 4. Error Handling

Always test error scenarios:

```typescript
describe('Error Handling', () => {
  it('should handle errors gracefully', async () => {
    mockFunction.mockRejectedValue(new Error('Failed'));
    
    const result = await functionUnderTest();
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### 5. Edge Cases

Test boundary conditions:

```typescript
describe('Edge Cases', () => {
  it('should handle empty input', () => {
    expect(processData([])).toEqual([]);
  });

  it('should handle null input', () => {
    expect(processData(null)).toBeNull();
  });

  it('should handle undefined input', () => {
    expect(processData(undefined)).toBeUndefined();
  });
});
```

## Debugging Tests

### Console Logging

```typescript
// Debug component render
import { screen, debug } from '@testing-library/react';

it('debug test', () => {
  renderWithProviders(<MyComponent />);
  debug(); // Prints DOM tree
});
```

### Debugging Async Issues

```typescript
import { waitFor } from '@testing-library/react';

it('async debug', async () => {
  // Add logging
  console.log('Before async call');
  
  await waitFor(() => {
    console.log('Inside waitFor');
    expect(condition).toBe(true);
  }, { timeout: 5000 }); // Increase timeout for debugging
  
  console.log('After async call');
});
```

### Using VS Code Debugger

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug",
      "program": "${workspaceFolder}/node_modules/.bin/react-scripts",
      "args": ["test", "--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Coverage Reports

### Generating Coverage

```bash
# Generate coverage report
npm test -- --coverage --watchAll=false

# Generate coverage with HTML report
npm test -- --coverage --coverageReporters=html --watchAll=false
```

### Coverage Thresholds

Current thresholds (can be configured in package.json):
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

### Viewing Coverage

After running tests with coverage:
1. Open `coverage/lcov-report/index.html` in browser
2. Navigate through files to see line-by-line coverage
3. Red lines = not covered
4. Green lines = covered

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
describe('Isolated Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Reset any global state
  });

  it('test 1', () => {
    // This test doesn't depend on test 2
  });

  it('test 2', () => {
    // This test doesn't depend on test 1
  });
});
```

### 2. Descriptive Test Names

```typescript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should return user data when API call succeeds', () => { ... });
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should calculate total', () => {
  // Arrange - Set up test data
  const items = [1, 2, 3];
  
  // Act - Execute the function
  const result = calculateTotal(items);
  
  // Assert - Verify the result
  expect(result).toBe(6);
});
```

### 4. Mock External Dependencies

```typescript
// Mock at the top of the file
jest.mock('../external-service');

describe('Tests', () => {
  it('should use mocked service', () => {
    // Service is automatically mocked
  });
});
```

### 5. Test User Behavior, Not Implementation

```typescript
// ❌ Bad - Testing implementation
it('should call setState', () => {
  expect(component.setState).toHaveBeenCalled();
});

// ✅ Good - Testing user-visible behavior
it('should display success message after submission', async () => {
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

## Common Issues and Solutions

### Issue: Tests Timeout

**Solution**: Increase timeout or check for unresolved promises

```typescript
jest.setTimeout(10000); // 10 seconds

// Or per test
it('long test', async () => {
  // test code
}, 10000);
```

### Issue: State Not Updating

**Solution**: Use `waitFor` for async state updates

```typescript
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

### Issue: Mock Not Working

**Solution**: Ensure mock is hoisted above imports

```typescript
jest.mock('./module'); // Must be at the top

import { something } from './module';
```

### Issue: Canvas Errors

**Solution**: jest-canvas-mock is configured in setupTests.ts

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm ci
      - run: npm test -- --coverage --watchAll=false
      - uses: codecov/codecov-action@v2
```

## Useful Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Quick Reference

### Common Jest Matchers

```typescript
expect(value).toBe(expected);           // Strict equality
expect(value).toEqual(expected);        // Deep equality
expect(value).toBeTruthy();             // Truthy value
expect(value).toBeFalsy();              // Falsy value
expect(value).toBeNull();               // null
expect(value).toBeUndefined();          // undefined
expect(value).toBeDefined();            // not undefined
expect(array).toContain(item);          // Array contains
expect(string).toMatch(/pattern/);      // Regex match
expect(fn).toHaveBeenCalled();          // Mock was called
expect(fn).toHaveBeenCalledWith(arg);   // Mock called with args
expect(value).toBeGreaterThan(3);       // Numeric comparison
expect(value).toBeCloseTo(0.3, 1);      // Floating point
```

### Testing Library Queries

```typescript
// Preferred queries (accessible)
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText('Email');
screen.getByPlaceholderText('Enter email');
screen.getByText('Hello World');

// Query variants
getBy... // Throws if not found
queryBy... // Returns null if not found
findBy... // Async, waits for element

// Multiple elements
getAllBy...
queryAllBy...
findAllBy...
```

## Troubleshooting Checklist

- [ ] Are all mocks cleared in `beforeEach`?
- [ ] Are async operations awaited?
- [ ] Is `waitFor` used for state updates?
- [ ] Are test names descriptive?
- [ ] Is each test independent?
- [ ] Are external dependencies mocked?
- [ ] Is coverage above thresholds?
- [ ] Do tests pass in CI?

---

**Last Updated**: October 2025
**Maintainer**: MasjidConnect Development Team

