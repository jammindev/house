// nextjs/src/features/projects/components/__tests__/ProjectTimeline.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectTimeline from '../ProjectTimeline';
import type { Interaction, Document } from '@interactions/types';

// Mock the i18n provider
vi.mock('@/lib/i18n/I18nProvider', () => ({
    useI18n: () => ({
        t: (key: string, args?: Record<string, string | number>) => {
            if (key === 'projects.timeline.empty') return 'No interactions linked to this project yet.';
            if (args && typeof args.count === 'number') {
                return key.replace('{count}', args.count.toString());
            }
            return key;
        }
    })
}));

// Mock InteractionItem component
vi.mock('@interactions/components/InteractionItem', () => ({
    default: ({ interaction }: { interaction: Interaction }) => (
        <div data-testid={`interaction-${interaction.id}`}>
            <h3>{interaction.subject}</h3>
            <span>{interaction.type}</span>
            <span>{interaction.status}</span>
        </div>
    )
}));

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

describe('ProjectTimeline', () => {
    const mockDocumentsByInteraction: Record<string, Document[]> = {};

    it('should render empty state when no interactions', () => {
        render(
            <ProjectTimeline
                interactions={[]}
                documentsByInteraction={mockDocumentsByInteraction}
            />
        );

        expect(screen.getByText('No interactions linked to this project yet.')).toBeInTheDocument();
    });

    it('should render interactions when provided', () => {
        const interactions = [
            createMockInteraction({ id: '1', subject: 'First Interaction', type: 'note' }),
            createMockInteraction({ id: '2', subject: 'Second Interaction', type: 'expense' })
        ];

        render(
            <ProjectTimeline
                interactions={interactions}
                documentsByInteraction={mockDocumentsByInteraction}
            />
        );

        expect(screen.getByTestId('interaction-1')).toBeInTheDocument();
        expect(screen.getByTestId('interaction-2')).toBeInTheDocument();
        expect(screen.getByText('First Interaction')).toBeInTheDocument();
        expect(screen.getByText('Second Interaction')).toBeInTheDocument();
    });

    it('should apply default filters to hide incomplete tasks', () => {
        const interactions = [
            createMockInteraction({ id: '1', subject: 'Completed Task', type: 'todo', status: 'done' }),
            createMockInteraction({ id: '2', subject: 'Pending Task', type: 'todo', status: 'pending' }),
            createMockInteraction({ id: '3', subject: 'Regular Note', type: 'note', status: null })
        ];

        render(
            <ProjectTimeline
                interactions={interactions}
                documentsByInteraction={mockDocumentsByInteraction}
            />
        );

        // Should show completed task and note
        expect(screen.getByTestId('interaction-1')).toBeInTheDocument();
        expect(screen.getByTestId('interaction-3')).toBeInTheDocument();

        // Should hide pending task
        expect(screen.queryByTestId('interaction-2')).not.toBeInTheDocument();
    });

    it('should respect custom filter keys', () => {
        const interactions = [
            createMockInteraction({ id: '1', subject: 'Note', type: 'note' }),
            createMockInteraction({ id: '2', subject: 'Expense', type: 'expense' }),
            createMockInteraction({ id: '3', subject: 'Todo', type: 'todo', status: 'done' })
        ];

        render(
            <ProjectTimeline
                interactions={interactions}
                documentsByInteraction={mockDocumentsByInteraction}
                filterKeys={['showOnlyNotes']}
            />
        );

        // Should only show note interaction
        expect(screen.getByTestId('interaction-1')).toBeInTheDocument();
        expect(screen.queryByTestId('interaction-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('interaction-3')).not.toBeInTheDocument();
    });

    it('should show all interactions when filter keys is empty array', () => {
        const interactions = [
            createMockInteraction({ id: '1', subject: 'Completed Task', type: 'todo', status: 'done' }),
            createMockInteraction({ id: '2', subject: 'Pending Task', type: 'todo', status: 'pending' }),
            createMockInteraction({ id: '3', subject: 'Regular Note', type: 'note' })
        ];

        render(
            <ProjectTimeline
                interactions={interactions}
                documentsByInteraction={mockDocumentsByInteraction}
                filterKeys={[]}
            />
        );

        // Should show all interactions
        expect(screen.getByTestId('interaction-1')).toBeInTheDocument();
        expect(screen.getByTestId('interaction-2')).toBeInTheDocument();
        expect(screen.getByTestId('interaction-3')).toBeInTheDocument();
    });

    it('should render empty state when all interactions are filtered out', () => {
        const interactions = [
            createMockInteraction({ id: '1', type: 'note' }),
            createMockInteraction({ id: '2', type: 'todo' })
        ];

        render(
            <ProjectTimeline
                interactions={interactions}
                documentsByInteraction={mockDocumentsByInteraction}
                filterKeys={['showOnlyExpenses']}
            />
        );

        expect(screen.getByText('No interactions linked to this project yet.')).toBeInTheDocument();
        expect(screen.queryByTestId('interaction-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('interaction-2')).not.toBeInTheDocument();
    });

    it('should pass document counts to InteractionItem', () => {
        const interactions = [
            createMockInteraction({ id: '1', subject: 'With Documents' })
        ];

        const documentsWithCounts = {
            '1': [
                { id: 'doc1' } as Document,
                { id: 'doc2' } as Document
            ]
        };

        render(
            <ProjectTimeline
                interactions={interactions}
                documentsByInteraction={documentsWithCounts}
            />
        );

        expect(screen.getByTestId('interaction-1')).toBeInTheDocument();
    });
});