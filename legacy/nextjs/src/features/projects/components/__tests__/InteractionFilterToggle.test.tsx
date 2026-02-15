// nextjs/src/features/projects/components/__tests__/InteractionFilterToggle.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import InteractionFilterToggle from '../InteractionFilterToggle';

// Mock the i18n provider
vi.mock('@/lib/i18n/I18nProvider', () => ({
    useI18n: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'projects.timeline.filters': 'Filters',
                'projects.timeline.filterTitle': 'Filter interactions',
                'projects.timeline.defaultFilters': 'Default',
                'projects.timeline.clearAll': 'Clear all'
            };
            return translations[key] || key;
        }
    })
}));

describe('InteractionFilterToggle', () => {
    const defaultProps = {
        activeFilters: [],
        onFiltersChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render filter button with correct count', () => {
        render(
            <InteractionFilterToggle
                {...defaultProps}
                activeFilters={['hideIncompleteTasks', 'hideArchived']}
            />
        );

        expect(screen.getByRole('button', { name: /Filters \(2\)/ })).toBeInTheDocument();
    });

    it('should show dropdown when filter button is clicked', async () => {
        const user = userEvent.setup();

        render(<InteractionFilterToggle {...defaultProps} />);

        const filterButton = screen.getByRole('button', { name: /Filters/ });
        await user.click(filterButton);

        expect(screen.getByText('Filter interactions')).toBeInTheDocument();
        expect(screen.getByText('Hide Incomplete Tasks')).toBeInTheDocument();
        expect(screen.getByText('Default')).toBeInTheDocument();
        expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('should display all available filters with descriptions', async () => {
        const user = userEvent.setup();

        render(<InteractionFilterToggle {...defaultProps} />);

        const filterButton = screen.getByRole('button');
        await user.click(filterButton);

        // Check that all filter options are displayed
        expect(screen.getByText('Hide Incomplete Tasks')).toBeInTheDocument();
        expect(screen.getByText('Hide all archived interactions')).toBeInTheDocument();
        expect(screen.getByText('Show Only Notes')).toBeInTheDocument();
        expect(screen.getByText('Show Only Expenses')).toBeInTheDocument();
        expect(screen.getByText('Show Completed Only')).toBeInTheDocument();
    });

    it('should show checked state for active filters', async () => {
        const user = userEvent.setup();

        render(
            <InteractionFilterToggle
                {...defaultProps}
                activeFilters={['hideIncompleteTasks']}
            />
        );

        const filterButton = screen.getByRole('button');
        await user.click(filterButton);

        const checkbox = screen.getAllByRole('checkbox')[0]; // hideIncompleteTasks is first
        expect(checkbox).toBeChecked();
    });

    it('should call onFiltersChange when filter is toggled', async () => {
        const user = userEvent.setup();
        const mockOnFiltersChange = vi.fn();

        render(
            <InteractionFilterToggle
                {...defaultProps}
                onFiltersChange={mockOnFiltersChange}
                activeFilters={[]}
            />
        );

        const filterButton = screen.getByRole('button');
        await user.click(filterButton);

        const checkbox = screen.getAllByRole('checkbox')[0]; // First checkbox
        await user.click(checkbox);

        expect(mockOnFiltersChange).toHaveBeenCalledWith(['hideIncompleteTasks']);
    });

    it('should remove filter when already active filter is toggled', async () => {
        const user = userEvent.setup();
        const mockOnFiltersChange = vi.fn();

        render(
            <InteractionFilterToggle
                {...defaultProps}
                onFiltersChange={mockOnFiltersChange}
                activeFilters={['hideIncompleteTasks', 'hideArchived']}
            />
        );

        const filterButton = screen.getByRole('button');
        await user.click(filterButton);

        const checkbox = screen.getAllByRole('checkbox')[0]; // hideIncompleteTasks
        await user.click(checkbox);

        expect(mockOnFiltersChange).toHaveBeenCalledWith(['hideArchived']);
    });

    it('should reset to default filters when Default button is clicked', async () => {
        const user = userEvent.setup();
        const mockOnFiltersChange = vi.fn();

        render(
            <InteractionFilterToggle
                {...defaultProps}
                onFiltersChange={mockOnFiltersChange}
                activeFilters={['showOnlyNotes']}
            />
        );

        const filterButton = screen.getByRole('button');
        await user.click(filterButton);

        const defaultButton = screen.getByText('Default');
        await user.click(defaultButton);

        expect(mockOnFiltersChange).toHaveBeenCalledWith(['hideIncompleteTasks']);
    });

    it('should clear all filters when Clear all button is clicked', async () => {
        const user = userEvent.setup();
        const mockOnFiltersChange = vi.fn();

        render(
            <InteractionFilterToggle
                {...defaultProps}
                onFiltersChange={mockOnFiltersChange}
                activeFilters={['hideIncompleteTasks', 'hideArchived']}
            />
        );

        const filterButton = screen.getByRole('button');
        await user.click(filterButton);

        const clearAllButton = screen.getByText('Clear all');
        await user.click(clearAllButton);

        expect(mockOnFiltersChange).toHaveBeenCalledWith([]);
    });

    it('should apply custom className', () => {
        render(
            <InteractionFilterToggle
                {...defaultProps}
                className="custom-class"
            />
        );

        const container = screen.getByRole('button').parentElement;
        expect(container).toHaveClass('custom-class');
    });

    it('should remain open when clicked outside (manual close)', async () => {
        const user = userEvent.setup();

        render(
            <div>
                <InteractionFilterToggle {...defaultProps} />
                <div data-testid="outside">Outside element</div>
            </div>
        );

        const filterButton = screen.getByRole('button');
        await user.click(filterButton);

        // Dropdown should be open
        expect(screen.getByText('Filter interactions')).toBeInTheDocument();

        // Click outside
        const outsideElement = screen.getByTestId('outside');
        await user.click(outsideElement);

        // Dropdown should still be open (no auto-close implemented)
        expect(screen.getByText('Filter interactions')).toBeInTheDocument();

        // User must click the button again to close
        await user.click(filterButton);
        expect(screen.queryByText('Filter interactions')).not.toBeInTheDocument();
    });

    it('should toggle dropdown visibility when button is clicked multiple times', async () => {
        const user = userEvent.setup();

        render(<InteractionFilterToggle {...defaultProps} />);

        const filterButton = screen.getByRole('button');

        // First click - should open
        await user.click(filterButton);
        expect(screen.getByText('Filter interactions')).toBeInTheDocument();

        // Second click - should close
        await user.click(filterButton);
        expect(screen.queryByText('Filter interactions')).not.toBeInTheDocument();

        // Third click - should open again
        await user.click(filterButton);
        expect(screen.getByText('Filter interactions')).toBeInTheDocument();
    });
});