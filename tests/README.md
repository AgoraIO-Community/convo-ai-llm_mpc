# Testing Guide

This directory contains the test suite for the Custom LLM Cerebras service.

## Test Structure

```
tests/
├── setup.ts                    # Jest configuration and global test setup
├── unit/                       # Unit tests for individual modules
│   ├── libs/                   # Library/utility tests
│   │   ├── utils.test.ts      # Configuration and utilities
│   │   └── versionedTools.test.ts # Tool versioning logic
│   └── middleware/             # Middleware tests
│       └── auth.test.ts       # Authentication middleware
├── integration/                # Integration tests
│   └── routes.test.js         # API endpoint testing
└── README.md                  # This file
```

## Running Tests

### All Tests

```bash
npm test
```

### With Coverage

```bash
npm run test:coverage
```

### Watch Mode (during development)

```bash
npm run test:watch
```

### CI Mode (non-interactive)

```bash
npm run test:ci
```

### Integration Tests Only

```bash
npm run test:integration
```

### Existing Legacy Tests

```bash
npm run test:pinecone
```

## Test Environment

Tests use a separate environment configuration:

- Environment variables are loaded from `.env.test`
- Mock API keys are used for external services
- Test database/service configurations are isolated
- Console output is suppressed during tests (except errors)

## Coverage Thresholds

The project maintains minimum coverage thresholds:

- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## GitHub Actions Integration

The test suite runs automatically on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The CI pipeline includes:

1. **Linting** - Code quality checks
2. **Building** - TypeScript compilation
3. **Unit Tests** - Module-level testing
4. **Integration Tests** - API endpoint testing
5. **Coverage** - Coverage reporting to Codecov
6. **Docker Build** - Container build and basic smoke test

## Writing Tests

### Unit Tests

- Test individual functions and modules
- Mock external dependencies
- Focus on business logic and edge cases
- Use TypeScript for type safety

Example:

```typescript
import { someFunction } from '../../../src/libs/utils'

describe('SomeFunction', () => {
  it('should handle valid input', () => {
    const result = someFunction('valid input')
    expect(result).toBe('expected output')
  })
})
```

### Integration Tests

- Test API endpoints end-to-end
- Use real HTTP requests
- Test authentication and validation
- Verify response structures

Example:

```javascript
describe('API Endpoint', () => {
  test('should handle valid requests', async () => {
    const response = await axios.post('/api/endpoint', data, {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty('expectedField')
  })
})
```

## Mocking Strategy

### External APIs

- Cerebras SDK is mocked in unit tests
- Pinecone SDK is mocked when not available
- OpenAI API calls are mocked
- YELP API calls are mocked

### Environment Variables

- Test environment uses safe mock values
- Real API keys are never required for tests
- Configuration is isolated from development/production

## Test Data

Test data is minimal and focused:

- Mock restaurant data for RAG testing
- Sample chat messages for API testing
- Predefined user scenarios for integration tests

## Debugging Tests

### Running Individual Tests

```bash
npm test -- --testNamePattern="specific test name"
```

### Verbose Output

```bash
npm test -- --verbose
```

### Debug Mode

```bash
npm test -- --detectOpenHandles --forceExit
```

## Best Practices

1. **Isolation** - Each test should be independent
2. **Clarity** - Test names should clearly describe what's being tested
3. **Coverage** - Aim for meaningful coverage, not just high numbers
4. **Speed** - Keep tests fast by mocking expensive operations
5. **Maintenance** - Update tests when functionality changes

## Troubleshooting

### Common Issues

**Tests timeout**

- Increase Jest timeout in jest.config or test file
- Check for unresolved promises or async operations

**Module not found errors**

- Ensure proper TypeScript compilation with `pnpm run build`
- Check import paths and file extensions

**Mock conflicts**

- Clear mocks between tests with `jest.clearAllMocks()`
- Reset modules if needed with `jest.resetModules()`

**CI failures but local success**

- Check environment variable differences
- Ensure deterministic test behavior
- Verify Node.js version compatibility
