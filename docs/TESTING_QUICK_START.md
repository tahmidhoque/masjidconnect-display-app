# Testing Quick Start Guide

**65 Tests | 100% Passing | ~0.7s Runtime**

## 🚀 Run All Tests

```bash
npm test
```

## 🎯 Run Specific Tests

### Prayer Time Issues?

```bash
# Test prayer time calculations
npm test -- prayerTimes.integration

# Test date utilities
npm test -- dateUtils
```

### Storage Issues?

```bash
# Test storage operations
npm test -- storage.integration
```

### API Error Issues?

```bash
# Test error handling
npm test -- errorHandling.integration

# Test error utilities
npm test -- apiErrorHandler
```

### Run All Integration Tests

```bash
npm test -- --testPathPattern=integration
```

### Run All Unit Tests

```bash
npm test -- --testPathPattern="dateUtils|apiErrorHandler"
```

## 🔍 Debug Mode

### Watch Mode (Auto-rerun)

```bash
npm test -- --watch
```

### Verbose Output

```bash
npm test -- --verbose
```

### Coverage Report

```bash
npm test -- --coverage --watchAll=false
```

### Run Specific Test by Name

```bash
npm test -- --testNamePattern="should calculate next prayer"
```

## 📊 What's Tested

### ✅ Prayer Times (37 tests)

- Time formatting & conversion
- Next prayer calculation
- Time until prayer
- Hijri date conversion
- Edge cases (midnight transitions)

### ✅ Storage (9 tests)

- Save/retrieve operations
- Credentials management
- Emergency alerts
- Clear operations

### ✅ Error Handling (19 tests)

- API error responses
- Response validation
- Error consistency
- Network errors

## 🐛 Common Debugging Scenarios

### Prayer Times Wrong

```bash
npm test -- prayerTimes.integration
```

**What it tests:**

- Time calculations
- Formatting
- Next prayer logic
- Edge cases

### Data Not Saving

```bash
npm test -- storage.integration
```

**What it tests:**

- Save operations
- Retrieve operations
- Clear operations

### API Errors

```bash
npm test -- errorHandling.integration
```

**What it tests:**

- Error responses
- Response validation
- Error codes

### Date Display Issues

```bash
npm test -- dateUtils
```

**What it tests:**

- Time formatting
- Date conversions
- Hijri calculations

## 📝 Test Files

```
src/
├── __tests__/
│   └── integration/
│       ├── storage.integration.test.ts (9 tests)
│       ├── prayerTimes.integration.test.ts (17 tests)
│       └── errorHandling.integration.test.ts (8 tests)
│
└── utils/__tests__/
    ├── dateUtils.test.ts (20 tests)
    └── apiErrorHandler.test.ts (11 tests)
```

## 🎓 Tips

1. **Tests are fast** - Run them frequently while developing
2. **Tests are independent** - Each test runs in isolation
3. **Tests are practical** - They test real scenarios, not mocks
4. **Tests are documented** - Read test names to understand what's tested

## 📖 More Information

- **TESTING_GUIDE.md** - Comprehensive guide
- **FINAL_TEST_SUMMARY.md** - Complete overview
- **TEST_IMPLEMENTATION_SUMMARY.md** - Technical details

## 🎉 Success!

You have 65 working tests that help you debug common issues without digging through code!
