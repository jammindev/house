# Feature Tests

## Purpose
Unit and integration tests for feature modules. Tests individual components, hooks, and utilities in isolation.

## Structure
```
__tests__/
├─ interactions/
│  ├─ hooks/
│  └─ utils/
├─ zones/
└─ shared/
```

## Test Patterns
- **Unit tests**: Components, hooks, utilities
- **Integration tests**: Feature workflows
- **Mocking**: Supabase client, context providers

## Running Tests
```bash
cd nextjs
yarn test              # Run all tests
yarn test:watch        # Watch mode
yarn test:coverage     # Coverage report
```

## Conventions
- Filename: `*.test.ts` or `*.test.tsx`
- Co-locate: Tests mirror feature structure
- Fixtures: Shared test data in `__fixtures__/`
- Mocks: Shared mocks in `__mocks__/`

## Tools
- **Vitest**: Test runner
- **Testing Library**: React component testing
- **MSW**: API mocking

## Related
- E2E tests: `nextjs/tests/e2e/` (Playwright)
- Test config: `nextjs/vitest.config.ts`
