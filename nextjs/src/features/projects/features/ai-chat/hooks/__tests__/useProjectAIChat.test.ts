import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectAIChat } from '../useProjectAIChat';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock Supabase client with proper chain structure
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

const mockSupabaseClient = {
  from: vi.fn(() => mockQuery)
};

const mockSupa = {
  getSupabaseClient: () => mockSupabaseClient
};

vi.mock('@/lib/supabase/client', () => ({
  createSPASassClientAuthenticated: vi.fn(() => Promise.resolve(mockSupa))
}));

describe('useProjectAIChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    expect(result.current.threads).toEqual([]);
    expect(result.current.activeThread).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load threads on mount', async () => {
    const mockThreads = [
      { id: '1', title: 'Thread 1', created_at: '2025-01-01' },
      { id: '2', title: 'Thread 2', created_at: '2025-01-02' }
    ];

    // Mock the query chain return value
    vi.mocked(mockQuery.order).mockResolvedValueOnce({
      data: mockThreads,
      error: null
    });

    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    await act(async () => {
      // Wait for useEffect to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('project_ai_threads');
    expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'test-project-id');
  });

  it('should send message and handle streaming response', async () => {
    const mockResponse = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"content":"Hello"}\n\n'));
        controller.enqueue(encoder.encode('data: {"content":" world"}\n\n'));
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
        controller.close();
      }
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: mockResponse
    });

    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/test-project-id/ai-chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          threadId: null,
          message: 'Test message'
        })
      })
    );
  });

  it('should handle API errors correctly', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({
        error: 'AI service quota exceeded. Please try again later.'
      })
    });

    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error).toBe('AI service quota exceeded. Please try again later.');
  });

  it('should create new thread correctly', async () => {
    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    await act(async () => {
      result.current.createNewThread();
    });

    expect(result.current.activeThread).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it('should switch to different thread', async () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', created_at: '2025-01-01' },
      { id: '2', role: 'assistant', content: 'Hi there!', created_at: '2025-01-02' }
    ];

    vi.mocked(mockQuery.order).mockResolvedValueOnce({
      data: mockMessages,
      error: null
    });

    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    const testThread = {
      id: 'test-thread-id',
      title: 'Test Thread',
      project_id: 'test-project-id',
      household_id: 'test-household-id',
      user_id: 'test-user-id',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
      archived_at: null
    };

    await act(async () => {
      await result.current.switchThread(testThread);
    });

    expect(result.current.activeThread).toEqual(testThread);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('project_ai_messages');
    expect(mockQuery.eq).toHaveBeenCalledWith('thread_id', 'test-thread-id');
  });

  it('should handle network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should clear error state', async () => {
    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    // Simulate an error
    await act(async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Test error'));
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error).toBeTruthy();

    // Clear the error
    await act(async () => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should delete thread correctly', async () => {
    vi.mocked(mockQuery.eq).mockResolvedValueOnce({
      data: null,
      error: null
    });

    // Mock reload response
    vi.mocked(mockQuery.order).mockResolvedValueOnce({
      data: [],
      error: null
    });

    const { result } = renderHook(() =>
      useProjectAIChat({ projectId: 'test-project-id' })
    );

    await act(async () => {
      await result.current.deleteThread('test-thread-id');
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('project_ai_threads');
    expect(mockQuery.delete).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'test-thread-id');
  });
});