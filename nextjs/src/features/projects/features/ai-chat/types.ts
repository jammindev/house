export interface ProjectAIThread {
    id: string;
    project_id: string;
    household_id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
}

export interface ProjectAIMessage {
    id: string;
    thread_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata: Record<string, any>;
    created_at: string;
}

export interface ChatResponse {
    content?: string;
    done?: boolean;
    threadId?: string;
    error?: string;
}

export interface ChatState {
    threads: ProjectAIThread[];
    activeThread: ProjectAIThread | null;
    messages: ProjectAIMessage[];
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
}