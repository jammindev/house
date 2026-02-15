"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface ProjectAIComposerProps {
    onSendMessage: (content: string) => void;
    isStreaming: boolean;
    onCancel: () => void;
    disabled?: boolean;
}

export function ProjectAIComposer({
    onSendMessage,
    isStreaming,
    onCancel,
    disabled = false,
}: ProjectAIComposerProps) {
    const { t } = useI18n();
    const [message, setMessage] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
        if (!message.trim() || disabled || isStreaming) return;

        onSendMessage(message.trim());
        setMessage("");

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleCancel = () => {
        onCancel();
    };

    // Auto-resize textarea
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);

        // Auto-resize
        const textarea = e.target;
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    };

    return (
        <div className="flex gap-2">
            <div className="flex-1 relative">
                <Textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={t("projects.aiChat.placeholder")}
                    disabled={disabled}
                    className="min-h-[44px] max-h-[120px] resize-none pr-12"
                    rows={1}
                    aria-label={t("projects.aiChat.messageLabel")}
                />

                {isStreaming ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                        className="absolute right-1 top-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        aria-label={t("projects.aiChat.cancel")}
                    >
                        <Square className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleSubmit}
                        disabled={!message.trim() || disabled}
                        className="absolute right-1 top-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50"
                        aria-label={t("projects.aiChat.send")}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}