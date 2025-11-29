"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useProjectAIChat } from "../hooks/useProjectAIChat";
import { ProjectAIThreadList } from "./ProjectAIThreadList";
import { ProjectAIMessageList } from "./ProjectAIMessageList";
import { ProjectAIComposer } from "./ProjectAIComposer";

interface ProjectAIChatSheetProps {
    projectId: string;
    projectTitle: string;
}

export function ProjectAIChatSheet({ projectId, projectTitle }: ProjectAIChatSheetProps) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const {
        threads,
        activeThread,
        messages,
        isLoading,
        isStreaming,
        error,
        sendMessage,
        createThread,
        switchThread,
        deleteThread,
        cancelStream,
        clearError,
    } = useProjectAIChat({ projectId });

    const handleSendMessage = async (content: string) => {
        if (activeThread) {
            await sendMessage(content);
        } else {
            await createThread(content);
        }
    };

    const trigger = (
        <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            aria-expanded={isOpen}
        >
            <MessageSquare className="h-4 w-4" />
            {t("projects.aiChat.askAI")}
        </Button>
    );

    return (
        <SheetDialog
            trigger={trigger}
            open={isOpen}
            onOpenChange={setIsOpen}
            title={t("projects.aiChat.title")}
            description={t("projects.aiChat.description", { project: projectTitle })}
            closeLabel={null}
            contentClassName="p-0 gap-0"
            containerClassName="max-w-lg w-full sm:max-w-lg"
        >
            {({ close }) => (
                <>
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Thread Selector */}
                        {threads.length > 0 && (
                            <div className="px-6 py-3 border-b bg-muted/30">
                                <ProjectAIThreadList
                                    threads={threads}
                                    activeThread={activeThread}
                                    onSelectThread={switchThread}
                                    onDeleteThread={deleteThread}
                                    isLoading={isLoading}
                                />
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-scroll">
                            {activeThread ? (
                                <ProjectAIMessageList
                                    messages={messages}
                                    isStreaming={isStreaming}
                                    isLoading={isLoading}
                                />
                            ) : (
                                <div className="flex-1 flex items-center justify-center p-6">
                                    <div className="text-center max-w-sm">
                                        <MessageSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                                        <h3 className="font-medium mb-2">
                                            {t("projects.aiChat.welcome.title")}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t("projects.aiChat.welcome.description")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Composer */}
                        <div className="border-t p-4">
                            <ProjectAIComposer
                                onSendMessage={handleSendMessage}
                                isStreaming={isStreaming}
                                onCancel={cancelStream}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="mx-4 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm text-destructive">{error}</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearError}
                                        className="h-auto p-1 text-destructive hover:text-destructive"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearError}
                                    className="mt-2 h-7 text-xs"
                                >
                                    {t("projects.aiChat.retry")}
                                </Button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </SheetDialog>
    );
}