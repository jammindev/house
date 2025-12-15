"use client";

import { useState } from "react";
import { Search, Plus, FileText, Paperclip } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectNotes } from "@projects/hooks/useProjectNotes";
import type { Interaction } from "@interactions/types";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { cn } from "@/lib/utils";

interface NoteTabProps {
    projectId: string;
    onRefresh?: () => void;
}

interface NoteItemProps {
    note: Interaction;
    documentCount: number;
    isSelected: boolean;
    onClick: () => void;
}

function NoteItem({ note, documentCount, isSelected, onClick }: NoteItemProps) {
    const { locale } = useI18n();

    // Extract first few words for preview
    const preview = note.content?.substring(0, 100) || "";
    const hasAttachments = documentCount > 0;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) {
            return new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
            }).format(date);
        } else if (diffInDays < 7) {
            return new Intl.DateTimeFormat(locale, {
                weekday: "short",
            }).format(date);
        } else {
            return new Intl.DateTimeFormat(locale, {
                month: "short",
                day: "numeric",
            }).format(date);
        }
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "group cursor-pointer border-b border-gray-100 p-4 transition-all duration-150 hover:bg-gray-50",
                isSelected && "bg-yellow-50 border-yellow-200"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                        <h3 className={cn(
                            "truncate text-sm font-medium",
                            isSelected ? "text-yellow-900" : "text-gray-900"
                        )}>
                            {note.subject}
                        </h3>
                        {hasAttachments && (
                            <Paperclip className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        )}
                    </div>

                    {preview && (
                        <p className={cn(
                            "text-xs leading-relaxed line-clamp-2",
                            isSelected ? "text-yellow-700" : "text-gray-600"
                        )}>
                            {preview}
                            {note.content && note.content.length > 100 && "..."}
                        </p>
                    )}

                    {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {note.tags.slice(0, 2).map((tag) => (
                                <span
                                    key={tag.id}
                                    className={cn(
                                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                                        isSelected
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-gray-100 text-gray-700"
                                    )}
                                >
                                    #{tag.name}
                                </span>
                            ))}
                            {note.tags.length > 2 && (
                                <span className={cn(
                                    "text-[10px]",
                                    isSelected ? "text-yellow-600" : "text-gray-500"
                                )}>
                                    +{note.tags.length - 2}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-1">
                    <time className={cn(
                        "text-[11px] font-medium",
                        isSelected ? "text-yellow-600" : "text-gray-500"
                    )}>
                        {formatDate(note.occurred_at)}
                    </time>
                    {hasAttachments && (
                        <span className={cn(
                            "text-[10px] font-medium",
                            isSelected ? "text-yellow-600" : "text-gray-500"
                        )}>
                            {documentCount}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function NoteTab({ projectId, onRefresh }: NoteTabProps) {
    const { t } = useI18n();
    const { notes, documentsByNote, loading, error } = useProjectNotes(projectId);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    // Filter notes based on search query
    const filteredNotes = notes.filter(note => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            note.subject.toLowerCase().includes(query) ||
            note.content?.toLowerCase().includes(query) ||
            note.tags.some(tag => tag.name.toLowerCase().includes(query))
        );
    });

    const selectedNote = selectedNoteId ? notes.find(n => n.id === selectedNoteId) : null;

    if (loading) {
        return (
            <div className="h-96 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200/50 p-6 flex items-center justify-center">
                <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-yellow-700">{t("projects.notes.loading")}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-96 rounded-xl bg-gradient-to-br from-red-50 to-pink-50 border border-red-200/50 p-6 flex items-center justify-center">
                <div className="text-center space-y-2">
                    <FileText className="h-8 w-8 text-red-400 mx-auto" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[600px] rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden flex">
            {/* Sidebar - Notes List */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
                        <LinkWithOverlay href={`/app/interactions/new?projectId=${projectId}&type=note`}>
                            <Button size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-sm">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </LinkWithOverlay>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder={t("projects.notes.searchPlaceholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-gray-100 border-gray-200 focus:bg-white text-sm"
                        />
                    </div>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredNotes.length === 0 ? (
                        <div className="p-6 text-center">
                            {notes.length === 0 ? (
                                <div className="space-y-3">
                                    <FileText className="h-12 w-12 text-gray-300 mx-auto" />
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-medium text-gray-900">{t("projects.notes.empty")}</h3>
                                        <p className="text-xs text-gray-500">
                                            {t("projects.notes.newNote")}
                                        </p>
                                    </div>
                                    <LinkWithOverlay href={`/app/interactions/new?projectId=${projectId}&type=note`}>
                                        <Button size="sm" variant="outline" className="mt-2">
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t("projects.notes.newNote")}
                                        </Button>
                                    </LinkWithOverlay>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Search className="h-8 w-8 text-gray-300 mx-auto" />
                                    <p className="text-sm text-gray-500">{t("projects.notes.noResults", { query: searchQuery })}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        filteredNotes.map((note) => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                documentCount={documentsByNote[note.id]?.length || 0}
                                isSelected={selectedNoteId === note.id}
                                onClick={() => setSelectedNoteId(note.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Main Content - Note Detail */}
            <div className="flex-1 flex flex-col">
                {selectedNote ? (
                    <>
                        {/* Note Header */}
                        <div className="p-6 border-b border-gray-100 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-xl font-semibold text-gray-900 mb-2">{selectedNote.subject}</h1>
                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                        <time>
                                            {new Intl.DateTimeFormat('fr', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }).format(new Date(selectedNote.occurred_at))}
                                        </time>
                                        {documentsByNote[selectedNote.id]?.length > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Paperclip className="h-4 w-4" />
                                                {documentsByNote[selectedNote.id].length} {t("projects.notes.attachments")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <LinkWithOverlay href={`/app/interactions/${selectedNote.id}`}>
                                    <Button variant="outline" size="sm">
                                        {t("projects.notes.viewDetails")}
                                    </Button>
                                </LinkWithOverlay>
                            </div>
                        </div>

                        {/* Note Content */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            <div className="max-w-none prose prose-sm">
                                {selectedNote.content ? (
                                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                                        {selectedNote.content}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">{t("projects.notes.noContent")}</p>
                                )}
                            </div>

                            {/* Tags */}
                            {selectedNote.tags.length > 0 && (
                                <div className="mt-6 pt-4 border-t border-gray-100">
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">{t("projects.notes.tags")}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedNote.tags.map((tag) => (
                                            <span
                                                key={tag.id}
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                                            >
                                                #{tag.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50">
                        <div className="text-center space-y-3">
                            <FileText className="h-16 w-16 text-yellow-300 mx-auto" />
                            <div className="space-y-1">
                                <h3 className="text-lg font-medium text-yellow-900">{t("projects.notes.selectNote")}</h3>
                                <p className="text-sm text-yellow-700">
                                    {t("projects.notes.selectNoteDescription")}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}