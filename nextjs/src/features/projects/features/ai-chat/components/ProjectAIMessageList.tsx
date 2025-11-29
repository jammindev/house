"use client";

import { useEffect, useRef } from "react";
import { Bot, User, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectAIMessage } from "../types";

interface ProjectAIMessageListProps {
  messages: ProjectAIMessage[];
  isStreaming: boolean;
  isLoading: boolean;
}

export function ProjectAIMessageList({
  messages,
  isStreaming,
  isLoading,
}: ProjectAIMessageListProps) {
  const { t } = useI18n();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageContent = (content: string) => {
    // Simple markdown-like rendering for lists and basic formatting
    const lines = content.split('\n');
    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          // Handle bullet points
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            return (
              <div key={index} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{line.trim().substring(2)}</span>
              </div>
            );
          }
          
          // Handle numbered lists
          const numberedMatch = line.trim().match(/^(\d+\.)\s+(.*)$/);
          if (numberedMatch) {
            return (
              <div key={index} className="flex gap-2">
                <span className="text-muted-foreground">{numberedMatch[1]}</span>
                <span>{numberedMatch[2]}</span>
              </div>
            );
          }
          
          // Handle bold text **text**
          if (line.includes('**')) {
            const parts = line.split(/\*\*(.*?)\*\*/);
            return (
              <p key={index}>
                {parts.map((part, partIndex) => 
                  partIndex % 2 === 1 ? (
                    <strong key={partIndex}>{part}</strong>
                  ) : (
                    <span key={partIndex}>{part}</span>
                  )
                )}
              </p>
            );
          }
          
          // Regular line
          return line.trim() ? <p key={index}>{line}</p> : <br key={index} />;
        })}
      </div>
    );
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t("projects.aiChat.loading")}</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Bot className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("projects.aiChat.noMessages")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgb(203 213 225) transparent'
      }}
    >
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const isLastMessage = index === messages.length - 1;
        const isStreamingThis = isLastMessage && isStreaming && !isUser;
        
        return (
          <div
            key={message.id}
            className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
                <span className="sr-only">{t("projects.aiChat.assistant")}</span>
              </div>
            )}
            
            <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isUser && <User className="h-3 w-3" />}
                <span className="sr-only">
                  {isUser ? t("projects.aiChat.you") : t("projects.aiChat.assistant")}
                </span>
                <span>
                  {isUser ? t("projects.aiChat.you") : t("projects.aiChat.assistant")}
                </span>
                <span>•</span>
                <span>{formatTimestamp(message.created_at)}</span>
              </div>
              
              <div 
                className={`
                  rounded-lg px-3 py-2 text-sm
                  ${isUser 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted border'
                  }
                  ${isStreamingThis ? 'animate-pulse' : ''}
                `}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {renderMessageContent(message.content)}
                  </div>
                )}
                
                {isStreamingThis && (
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">{t("projects.aiChat.thinking")}</span>
                  </div>
                )}
              </div>
            </div>
            
            {isUser && (
              <div className="flex-shrink-0 w-8 h-8 bg-primary/90 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        );
      })}
      
      <div ref={messagesEndRef} />
    </div>
  );
}