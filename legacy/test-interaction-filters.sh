#!/bin/bash
# Run tests for interaction filtering system
# Usage: ./test-interaction-filters.sh

echo "🧪 Running Interaction Filter Tests"
echo "=================================="

echo ""
echo "📋 1. Running unit tests for filter logic..."
cd nextjs
yarn vitest run src/features/projects/lib/__tests__/interactionFilters.test.ts

echo ""
echo "🔧 2. Running component tests..."
yarn vitest run src/features/projects/components/__tests__/

echo ""
echo "🌐 3. Running E2E tests for filter UI..."
yarn test:e2e project-interaction-filters.spec.ts

echo ""
echo "✅ All interaction filter tests completed!"
echo ""
echo "📊 Test Coverage:"
echo "  - Filter logic (unit): interactionFilters.test.ts"
echo "  - ProjectTimeline component: ProjectTimeline.test.tsx"  
echo "  - InteractionFilterToggle component: InteractionFilterToggle.test.tsx"
echo "  - End-to-end functionality: project-interaction-filters.spec.ts"
echo ""
echo "🚀 To run individual test suites:"
echo "  Unit tests: yarn test:unit"
echo "  E2E tests:  yarn test:e2e"
echo "  All tests:  yarn test && yarn test:e2e"