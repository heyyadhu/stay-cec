# StayCEC Testing Guide

## Test Structure

```
tests/
├── setup.js              # Test configuration and mocks
├── unit/
│   ├── auth.test.js      # Unit tests for authentication
│   └── data.test.js      # Unit tests for data operations
└── system/
    └── app.test.js       # System/integration tests
```

## Running Tests

### Install dependencies first:
```bash
npm install
```

### Run all tests (interactive mode):
```bash
npm test
```

### Run unit tests only:
```bash
npm run test:unit
```

### Run system tests only:
```bash
npm run test:system
```

### Run with coverage:
```bash
npx vitest run --coverage
```

### Run with UI:
```bash
npx vitest --ui
```

## Test Categories

### Unit Tests
Test individual functions in isolation:
- **auth.test.js**: Authentication functions (signUp, signIn, logOut, etc.)
- **data.test.js**: Data operations (fee calculation, complaints, notifications, etc.)

### System Tests
Test complete user workflows:
- Student registration → login → dashboard → mess reduction → payment
- Warden operations (complaints, broadcasts, approvals)
- Head Warden operations (registration management, stats)
- Mess Manager operations (meal stats, reduction approvals)
- Role-based access control
- Fee calculation with mess reductions
- Data consistency across operations

## Firebase Mocking

Tests use mocked Firebase to avoid requiring real database connections:
- `firebase/auth` operations are mocked
- `firebase/firestore` operations are mocked
- Window location, localStorage, sessionStorage are mocked

## Adding New Tests

1. Create test file in `tests/unit/` or `tests/system/`
2. Import required functions from source files
3. Use `describe()` for test suites and `it()` for individual tests
4. Use `expect()` for assertions

Example:
```javascript
import { describe, it, expect } from 'vitest'
import { myFunction } from '../myModule.js'

describe('My Module', () => {
  it('should do something', () => {
    const result = myFunction()
    expect(result).toBe('expected value')
  })
})
```

## CI/CD Integration

Tests run automatically on push via GitHub Actions. See `.github/workflows/deploy.yml`.

## Coverage Reports

Coverage reports are generated in:
- Terminal (text format)
- `coverage/` directory (HTML and JSON formats)

Open `coverage/index.html` in browser for detailed report.
