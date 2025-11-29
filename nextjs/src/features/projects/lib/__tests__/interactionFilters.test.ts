// nextjs/src/features/projects/lib/__tests__/interactionFilters.test.ts
import { describe, it, expect } from 'vitest';
import type { Interaction } from '@interactions/types';
import { applyFilters, INTERACTION_FILTERS, DEFAULT_PROJECT_FILTERS } from '../interactionFilters';

// Mock interaction data
const createMockInteraction = (overrides: Partial<Interaction> = {}): Interaction => ({
    id: 'test-id',
    household_id: 'household-1',
    subject: 'Test Interaction',
    content: 'Test content',
    type: 'note',
    status: null,
    occurred_at: new Date().toISOString(),
    project_id: null,
    project: null,
    tags: [],
    contacts: [],
    structures: [],
    metadata: {},
    enriched_text: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'user-1',
    updated_by: 'user-1',
    ...overrides
});

describe('interactionFilters', () => {
    describe('hideIncompleteTasks filter', () => {
        const filter = INTERACTION_FILTERS.hideIncompleteTasks;

        it('should show all non-todo interactions regardless of status', () => {
            const interactions = [
                createMockInteraction({ type: 'note', status: 'pending' }),
                createMockInteraction({ type: 'expense', status: 'in_progress' }),
                createMockInteraction({ type: 'call', status: null }),
            ];

            interactions.forEach(interaction => {
                expect(filter.filter(interaction)).toBe(true);
            });
        });

        it('should hide todo interactions with pending status', () => {
            const interaction = createMockInteraction({ type: 'todo', status: 'pending' });
            expect(filter.filter(interaction)).toBe(false);
        });

        it('should hide todo interactions with in_progress status', () => {
            const interaction = createMockInteraction({ type: 'todo', status: 'in_progress' });
            expect(filter.filter(interaction)).toBe(false);
        });

        it('should show todo interactions with done status', () => {
            const interaction = createMockInteraction({ type: 'todo', status: 'done' });
            expect(filter.filter(interaction)).toBe(true);
        });

        it('should show todo interactions with archived status', () => {
            const interaction = createMockInteraction({ type: 'todo', status: 'archived' });
            expect(filter.filter(interaction)).toBe(true);
        });

        it('should hide todo interactions with null status', () => {
            const interaction = createMockInteraction({ type: 'todo', status: null });
            expect(filter.filter(interaction)).toBe(false);
        });
    });

    describe('hideArchived filter', () => {
        const filter = INTERACTION_FILTERS.hideArchived;

        it('should hide interactions with archived status', () => {
            const interaction = createMockInteraction({ status: 'archived' });
            expect(filter.filter(interaction)).toBe(false);
        });

        it('should show interactions with non-archived status', () => {
            const statuses = ['pending', 'in_progress', 'done', null] as const;

            statuses.forEach(status => {
                const interaction = createMockInteraction({ status });
                expect(filter.filter(interaction)).toBe(true);
            });
        });
    });

    describe('type-specific filters', () => {
        it('showOnlyNotes should show only note interactions', () => {
            const filter = INTERACTION_FILTERS.showOnlyNotes;
            const noteInteraction = createMockInteraction({ type: 'note' });
            const todoInteraction = createMockInteraction({ type: 'todo' });

            expect(filter.filter(noteInteraction)).toBe(true);
            expect(filter.filter(todoInteraction)).toBe(false);
        });

        it('showOnlyExpenses should show only expense interactions', () => {
            const filter = INTERACTION_FILTERS.showOnlyExpenses;
            const expenseInteraction = createMockInteraction({ type: 'expense' });
            const noteInteraction = createMockInteraction({ type: 'note' });

            expect(filter.filter(expenseInteraction)).toBe(true);
            expect(filter.filter(noteInteraction)).toBe(false);
        });
    });

    describe('showCompletedOnly filter', () => {
        const filter = INTERACTION_FILTERS.showCompletedOnly;

        it('should show only interactions with done status', () => {
            const doneInteraction = createMockInteraction({ status: 'done' });
            const pendingInteraction = createMockInteraction({ status: 'pending' });
            const nullInteraction = createMockInteraction({ status: null });

            expect(filter.filter(doneInteraction)).toBe(true);
            expect(filter.filter(pendingInteraction)).toBe(false);
            expect(filter.filter(nullInteraction)).toBe(false);
        });
    });

    describe('applyFilters function', () => {
        const interactions = [
            createMockInteraction({ id: '1', type: 'note', status: 'done' }),
            createMockInteraction({ id: '2', type: 'todo', status: 'pending' }),
            createMockInteraction({ id: '3', type: 'todo', status: 'done' }),
            createMockInteraction({ id: '4', type: 'expense', status: 'archived' }),
            createMockInteraction({ id: '5', type: 'call', status: null }),
        ];

        it('should return all interactions when no filters applied', () => {
            const result = applyFilters(interactions, []);
            expect(result).toHaveLength(5);
            expect(result).toEqual(interactions);
        });

        it('should apply single filter correctly', () => {
            const result = applyFilters(interactions, ['hideIncompleteTasks']);

            // Should exclude todo with pending status (id: '2')
            expect(result).toHaveLength(4);
            expect(result.map(i => i.id)).toEqual(['1', '3', '4', '5']);
        });

        it('should apply multiple filters correctly', () => {
            const result = applyFilters(interactions, ['hideIncompleteTasks', 'hideArchived']);

            // Should exclude todo with pending status (id: '2') and expense with archived status (id: '4')
            expect(result).toHaveLength(3);
            expect(result.map(i => i.id)).toEqual(['1', '3', '5']);
        });

        it('should apply default project filters', () => {
            const result = applyFilters(interactions, DEFAULT_PROJECT_FILTERS);

            // Default should be hideIncompleteTasks, so should exclude pending todo
            expect(result).toHaveLength(4);
            expect(result.map(i => i.id)).toEqual(['1', '3', '4', '5']);
        });

        it('should handle unknown filter keys gracefully', () => {
            const result = applyFilters(interactions, ['unknownFilter']);

            // Should return all interactions when filter doesn't exist
            expect(result).toHaveLength(5);
            expect(result).toEqual(interactions);
        });

        it('should combine filters with AND logic', () => {
            const result = applyFilters(interactions, ['showOnlyExpenses', 'hideArchived']);

            // Should show only expenses that are not archived (none in this case)
            expect(result).toHaveLength(0);
        });
    });

    describe('filter definitions', () => {
        it('should have required properties for all filters', () => {
            Object.entries(INTERACTION_FILTERS).forEach(([key, filter]) => {
                expect(filter).toHaveProperty('name');
                expect(filter).toHaveProperty('description');
                expect(filter).toHaveProperty('filter');
                expect(typeof filter.name).toBe('string');
                expect(typeof filter.description).toBe('string');
                expect(typeof filter.filter).toBe('function');
                expect(filter.name.length).toBeGreaterThan(0);
                expect(filter.description.length).toBeGreaterThan(0);
            });
        });

        it('should have hideIncompleteTasks as default filter', () => {
            expect(DEFAULT_PROJECT_FILTERS).toContain('hideIncompleteTasks');
        });
    });
});