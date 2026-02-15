"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { ProjectAIThread, ProjectAIMessage, ChatResponse, ChatState } from "../types";

interface UseProjectAIChatProps {
    projectId: string;
}

export function useProjectAIChat({ projectId }: UseProjectAIChatProps) {
    const [state, setState] = useState<ChatState>({
        threads: [],
        activeThread: null,
        messages: [],
        isLoading: false,
        isStreaming: false,
        error: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    // Load messages for a specific thread
    const loadMessages = useCallback(async (threadId: string) => {
        try {
            const supa = await createSPASassClient();
            const supabase = supa.getSupabaseClient();
            const { data, error } = await (supabase as any)
                .from('project_ai_messages')
                .select('*')
                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            setState(prev => ({ ...prev, messages: (data || []) as ProjectAIMessage[] }));
        } catch (error) {
            console.error('Failed to load messages:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to load messages'
            }));
        }
    }, []);

    // Load threads for this project
    const loadThreads = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const supa = await createSPASassClient();
            const supabase = supa.getSupabaseClient();
            const { data, error } = await (supabase as any)
                .from('project_ai_threads')
                .select('*')
                .eq('project_id', projectId)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const threads = (data || []) as ProjectAIThread[];
            setState(prev => ({
                ...prev,
                threads,
                activeThread: threads[0] || null,
                isLoading: false
            }));

            // Load messages for the most recent thread
            if (threads[0]) {
                await loadMessages(threads[0].id);
            }
        } catch (error) {
            console.error('Failed to load threads:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to load conversations',
                isLoading: false
            }));
        }
    }, [projectId, loadMessages]);



    // Send a message
    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || state.isStreaming) return;

        try {
            setState(prev => ({ ...prev, isStreaming: true, error: null }));

            // Add user message optimistically
            const userMessage: ProjectAIMessage = {
                id: `temp-${Date.now()}`,
                thread_id: state.activeThread?.id || '',
                role: 'user',
                content: content.trim(),
                metadata: {},
                created_at: new Date().toISOString(),
            };

            setState(prev => ({
                ...prev,
                messages: [...prev.messages, userMessage]
            }));

            // Cancel any existing request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            // Send to API
            const response = await fetch(`/api/projects/${projectId}/ai-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    threadId: state.activeThread?.id,
                    message: content.trim(),
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response stream');

            let assistantContent = '';
            let newThreadId: string | null = null;

            const assistantMessage: ProjectAIMessage = {
                id: `temp-assistant-${Date.now()}`,
                thread_id: state.activeThread?.id || '',
                role: 'assistant',
                content: '',
                metadata: {},
                created_at: new Date().toISOString(),
            };

            setState(prev => ({
                ...prev,
                messages: [...prev.messages, assistantMessage]
            }));

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data: ChatResponse = JSON.parse(line.slice(6));

                                if (data.content) {
                                    assistantContent += data.content;
                                    setState(prev => ({
                                        ...prev,
                                        messages: prev.messages.map(msg =>
                                            msg.id === assistantMessage.id
                                                ? { ...msg, content: assistantContent }
                                                : msg
                                        )
                                    }));
                                }

                                if (data.threadId && !newThreadId) {
                                    newThreadId = data.threadId;
                                }

                                if (data.done) {
                                    setState(prev => ({ ...prev, isStreaming: false }));

                                    // Reload threads if we created a new one
                                    if (newThreadId && !state.activeThread) {
                                        await loadThreads();
                                    } else {
                                        // Reload messages to get the actual stored versions
                                        if (state.activeThread) {
                                            await loadMessages(state.activeThread.id);
                                        }
                                    }
                                    return;
                                }

                                if (data.error) {
                                    throw new Error(data.error);
                                }
                            } catch (parseError) {
                                console.error('Failed to parse SSE data:', parseError);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return; // Request was cancelled
            }

            console.error('Failed to send message:', error);
            setState(prev => ({
                ...prev,
                error: error.message || 'Failed to send message',
                isStreaming: false
            }));
        }
    }, [projectId, state.activeThread?.id, state.isStreaming, loadThreads, loadMessages]);

    // Create a new thread
    const createThread = useCallback(async (firstMessage: string) => {
        setState(prev => ({ ...prev, activeThread: null, messages: [] }));
        await sendMessage(firstMessage);
    }, [sendMessage]);

    // Switch to a different thread
    const switchThread = useCallback(async (thread: ProjectAIThread) => {
        setState(prev => ({ ...prev, activeThread: thread }));
        await loadMessages(thread.id);
    }, [loadMessages]);

    // Delete a thread
    const deleteThread = useCallback(async (threadId: string) => {
        try {
            const supa = await createSPASassClient();
            const supabase = supa.getSupabaseClient();
            const { error } = await (supabase as any)
                .from('project_ai_threads')
                .delete()
                .eq('id', threadId);

            if (error) throw error;

            // Reload threads
            await loadThreads();
        } catch (error) {
            console.error('Failed to delete thread:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to delete conversation'
            }));
        }
    }, [loadThreads]);

    // Cancel streaming
    const cancelStream = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setState(prev => ({ ...prev, isStreaming: false }));
        }
    }, []);

    // Clear error
    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    // Create new thread
    const createNewThread = useCallback(() => {
        setState(prev => ({
            ...prev,
            activeThread: null,
            messages: []
        }));
    }, []);

    // Load threads on mount and when projectId changes
    useEffect(() => {
        loadThreads();
    }, [projectId]);

    return {
        ...state,
        sendMessage,
        createThread,
        switchThread,
        deleteThread,
        createNewThread,
        cancelStream,
        clearError,
        reload: loadThreads,
    };
}