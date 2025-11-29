import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectAIChatSheet } from '../ProjectAIChatSheet';
import { TestWrapper } from './test-utils';

// Mock the hook
vi.mock('../../hooks/useProjectAIChat', () => ({
  useProjectAIChat: () => ({
    threads: [],
    activeThread: null,
    messages: [],
    isLoading: false,
    isStreaming: false,
    error: null,
    sendMessage: vi.fn(),
    createThread: vi.fn(),
    switchThread: vi.fn(),
    deleteThread: vi.fn(),
    createNewThread: vi.fn(),
    cancelStream: vi.fn(),
    clearError: vi.fn(),
    reload: vi.fn()
  })
}));

// Mock Dialog components
vi.mock('@/components/ui/sheet-dialog', () => ({
  SheetDialog: ({ children, open }: any) => open ? <div role="dialog">{children}</div> : null,
  SheetDialogTrigger: ({ children }: any) => <div>{children}</div>,
  SheetDialogContent: ({ children }: any) => <div>{children}</div>,
  SheetDialogHeader: ({ children }: any) => <div>{children}</div>,
  SheetDialogTitle: ({ children }: any) => <h2>{children}</h2>
}));

// Mock other UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>
}));

describe('ProjectAIChatSheet', () => {
  const mockProps = {
    projectId: 'test-project-id',
    projectTitle: 'Test Project'
  };

  it('should render AI chat button', () => {
    render(
      <TestWrapper>
        <ProjectAIChatSheet {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Ask AI')).toBeInTheDocument();
  });

  it('should open dialog when button is clicked', () => {
    render(
      <TestWrapper>
        <ProjectAIChatSheet {...mockProps} />
      </TestWrapper>
    );

    const button = screen.getByText('Ask AI');
    fireEvent.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should display welcome message in dialog', () => {
    render(
      <TestWrapper>
        <ProjectAIChatSheet {...mockProps} />
      </TestWrapper>
    );

    const button = screen.getByText('Ask AI');
    fireEvent.click(button);

    expect(screen.getByText(/How can I help with this project/)).toBeInTheDocument();
  });
});