# Testing Infrastructure Setup Guide

## Overview

This guide explains the testing infrastructure added to the Custom LLM Cerebras project. This setup includes unit tests, integration tests, code coverage, linting, and automated GitHub Actions workflows.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd custom_llm_cerebras
npm install
```

### 2. Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch
```

## 📁 Project Structure

The testing infrastructure follows these conventions:

```
custom_llm_cerebras/
├── .github/workflows/test.yml    # GitHub Actions CI/CD
├── tests/                        # Test directory
│   ├── setup.ts                  # Jest configuration
│   ├── unit/                     # Unit tests
│   │   ├── libs/                 # Library tests
│   │   └── middleware/           # Middleware tests
│   ├── integration/              # Integration tests
│   └── README.md                 # Testing documentation
├── .env.test                     # Test environment config
├── eslint.config.js              # Code quality rules
├── .prettierrc                   # Code formatting rules
└── package.json                  # Updated with test scripts
```

## 🧪 Testing Strategy

### Unit Tests

- **Purpose**: Test individual functions and modules in isolation
- **Location**: `tests/unit/`
- **Technology**: Jest + TypeScript
- **Coverage**: Aim for 70%+ coverage on critical modules

**Example modules tested:**

- Configuration utilities (`utils.test.ts`)
- Versioned tools logic (`versionedTools.test.ts`)
- Authentication middleware (`auth.test.ts`)

### Integration Tests

- **Purpose**: Test API endpoints end-to-end
- **Location**: `tests/integration/`
- **Technology**: Jest + Axios
- **Focus**: HTTP requests, authentication, response validation

**What's tested:**

- All versioned API endpoints (`/v1`, `/v2`, `/v3`)
- Authentication and authorization
- Request validation
- Error handling
- Health endpoints

## 🔧 Available Commands

### Testing Commands

```bash
# Core testing
npm test                    # Run all tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report
npm run test:ci           # CI mode (no watch, coverage)

# Specific test types
npm run test:integration  # Integration tests only
npm run test:pinecone    # Legacy Pinecone integration test

# Code quality
npm run lint             # Check code quality
npm run lint:fix        # Auto-fix linting issues
```

### Development Commands

```bash
npm run dev             # Development server
npm run build          # Build for production
npm start              # Start production server
```

## 🔄 GitHub Actions Workflow

### Triggers

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Pipeline Steps

1. **Setup** - Checkout code, install Node.js
2. **Dependencies** - Install npm packages
3. **Environment** - Setup test environment
4. **Linting** - Code quality checks
5. **Build** - TypeScript compilation
6. **Unit Tests** - Run Jest unit tests
7. **Integration Tests** - API endpoint testing
8. **Coverage** - Upload to Codecov
9. **Docker** - Build and test container

### Matrix Testing

- Node.js versions: 18.x, 20.x
- Operating system: Ubuntu Latest

## ⚙️ Configuration Details

### Jest Configuration (`package.json`)

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "roots": ["<rootDir>/src", "<rootDir>/tests"],
    "collectCoverageFrom": ["src/**/*.ts"],
    "coverageThresholds": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      }
    }
  }
}
```

### ESLint Configuration

- TypeScript support
- Prettier integration
- Jest environment recognition
- Custom rules for Node.js/Express projects

### Test Environment (`.env.test`)

- Mock API keys for external services
- Test database configurations
- Safe default values for all required environment variables

## 🔍 Coverage Reporting

### Local Coverage

```bash
pnpm run test:coverage
```

- Generates HTML report in `coverage/` directory
- Terminal summary with threshold validation
- LCOV format for CI integration

### CI Coverage

- Automatic upload to Codecov
- Coverage badges available for README
- Pull request coverage comments
- Historical coverage tracking

## 🚨 Error Handling & Troubleshooting

### Common Issues

**"Cannot find module" errors**

```bash
# Solution: Ensure build is up to date
pnpm run build
pnpm test
```

**TypeScript compilation errors**

```bash
# Solution: Check TypeScript configuration
pnpm exec tsc --noEmit
pnpm run build
```

**Port conflicts in integration tests**

```bash
# Solution: Check for running services
lsof -i :3001
# Kill conflicting processes or update test port
```

**Environment variable issues**

```bash
# Solution: Verify test environment file
cat .env.test
# Ensure all required variables are set with test values
```

### Debug Mode

```bash
# Run tests with detailed output
pnpm test -- --verbose

# Run specific test file
pnpm test -- tests/unit/libs/utils.test.ts

# Debug hanging tests
pnpm test -- --detectOpenHandles --forceExit
```

## 📊 Coverage Targets

### Current Thresholds

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Excluded from Coverage

- Build artifacts (`dist/`)
- Test files themselves
- Configuration files
- Data files (`src/data/`)
- Main server entry point

## 🔄 Continuous Integration Benefits

### For Developers

- **Early bug detection** - Catch issues before merge
- **Code quality assurance** - Consistent formatting and standards
- **Coverage tracking** - Maintain test coverage over time
- **Automated validation** - No manual testing required for basic functionality

### For the Project

- **Reliability** - Reduced production bugs
- **Maintainability** - Easier refactoring with test safety net
- **Documentation** - Tests serve as living documentation
- **Onboarding** - New developers can understand functionality through tests

## 🚀 Next Steps

### Immediate

1. Run `pnpm install` to get new dependencies
2. Run `pnpm test` to verify everything works
3. Run `pnpm run test:coverage` to see current coverage
4. Commit and push to trigger GitHub Actions

### Ongoing

1. Write tests for new features as you develop them
2. Maintain coverage above thresholds
3. Update tests when functionality changes
4. Review coverage reports in pull requests

### Future Enhancements

- Add performance/load testing
- Implement E2E testing with real API calls
- Add visual regression testing for UI components
- Set up automated dependency updates

## 📝 Best Practices

### Writing Tests

- **Descriptive names** - Test names should explain what they verify
- **Single responsibility** - One concept per test
- **Independent** - Tests shouldn't depend on each other
- **Fast** - Mock expensive operations
- **Deterministic** - Same input should always produce same output

### Maintaining Tests

- **Update with code changes** - Keep tests in sync with functionality
- **Remove dead tests** - Delete tests for removed features
- **Refactor test code** - Apply same quality standards as production code
- **Monitor coverage trends** - Don't let coverage decrease over time

This testing infrastructure provides a solid foundation for maintaining code quality and reliability as your project grows. The automated workflows ensure that all changes are validated before they reach production.
