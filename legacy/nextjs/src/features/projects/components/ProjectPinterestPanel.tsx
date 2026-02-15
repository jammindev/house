// nextjs/src/features/projects/components/ProjectPinterestPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Pin, Grid, List, AlertCircle, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { usePinterestBoard } from "@projects/hooks/usePinterestBoard";
import type { PinterestPin } from "@projects/lib/pinterestApi";

interface ProjectPinterestPanelProps {
    projectId: string;
    initialBoardUrl?: string;
}

export default function ProjectPinterestPanel({
    projectId,
    initialBoardUrl
}: ProjectPinterestPanelProps) {
    const { t } = useI18n();
    const [boardUrl, setBoardUrl] = useState(initialBoardUrl || "");
    const [viewMode, setViewMode] = useState<"compact" | "comfortable">("comfortable");

    const { pins, loading, error, loadBoard, clearPins, isValidUrl } = usePinterestBoard();

    // Auto-charger le board initial si fourni
    useEffect(() => {
        if (initialBoardUrl && isValidUrl(initialBoardUrl)) {
            void loadBoard(initialBoardUrl);
        }
    }, [initialBoardUrl, loadBoard, isValidUrl]);

    const handleLoadBoard = async () => {
        if (!boardUrl.trim()) return;
        await loadBoard(boardUrl);
    };

    const handleClearBoard = () => {
        clearPins();
        setBoardUrl("");
    };

    const isUrlValid = boardUrl ? isValidUrl(boardUrl) : true;

    const handlePinClick = (pin: PinterestPin) => {
        window.open(pin.url, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="space-y-6">
            {/* Configuration du board */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Pin className="h-5 w-5" />
                        {t("projects.pinterest.boardTitle")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    placeholder={t("projects.pinterest.boardUrlPlaceholder")}
                                    value={boardUrl}
                                    onChange={(e) => setBoardUrl(e.target.value)}
                                    className={`pr-10 ${!isUrlValid ? 'border-red-300 focus:border-red-500' : ''}`}
                                />
                                {boardUrl && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {isUrlValid ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-red-500" />
                                        )}
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={handleLoadBoard}
                                disabled={!boardUrl || !isUrlValid || loading}
                                className="shrink-0"
                            >
                                {loading ? t("common.loading") : t("projects.pinterest.loadBoard")}
                            </Button>
                            {pins.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={handleClearBoard}
                                    className="shrink-0"
                                >
                                    {t("common.clear")}
                                </Button>
                            )}
                        </div>
                        {!isUrlValid && boardUrl && (
                            <p className="text-sm text-red-600">
                                {t("projects.pinterest.invalidUrl")}
                            </p>
                        )}
                    </div>

                    {pins.length > 0 && (
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                                {t("projects.pinterest.pinsCount", { count: pins.length })}
                            </div>
                            <div className="flex gap-1">
                                <Button
                                    variant={viewMode === "comfortable" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setViewMode("comfortable")}
                                    title="Vue confortable"
                                >
                                    <Grid className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === "compact" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setViewMode("compact")}
                                    title="Vue compacte"
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Affichage des erreurs */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <p className="text-sm text-red-600">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Affichage des pins */}
            {pins.length > 0 && (
                <div className={
                    viewMode === "comfortable"
                        ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                        : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
                }>
                    {pins.map((pin) => (
                        <div
                            key={pin.id}
                            className="group cursor-pointer overflow-hidden rounded-lg bg-white shadow-sm transition-all hover:shadow-lg"
                            onClick={() => handlePinClick(pin)}
                        >
                            <div className="relative aspect-[3/4] overflow-hidden">
                                <img
                                    src={pin.imageUrl}
                                    alt={pin.title}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    onError={(e) => {
                                        // Fallback en cas d'erreur de chargement d'image
                                        const target = e.target as HTMLImageElement;
                                        target.src = `https://via.placeholder.com/300x400/f1f5f9/64748b?text=${encodeURIComponent(pin.title)}`;
                                    }}
                                />
                                {/* Overlay avec informations au survol */}
                                <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/20">
                                    <div className="absolute bottom-0 left-0 right-0 transform translate-y-full bg-gradient-to-t from-black/80 to-transparent p-3 transition-transform duration-300 group-hover:translate-y-0">
                                        <h3 className="text-sm font-medium text-white truncate">
                                            {pin.title}
                                        </h3>
                                        {pin.boardName && (
                                            <p className="text-xs text-white/80 truncate">
                                                {pin.boardName}
                                            </p>
                                        )}
                                        {pin.createdAt && (
                                            <p className="text-xs text-white/60">
                                                {pin.createdAt.toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                    {/* Icône Pinterest au centre */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                        <div className="rounded-full bg-white/90 p-2 shadow-lg">
                                            <ExternalLink className="h-5 w-5 text-slate-700" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* État de chargement */}
            {loading && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="aspect-[3/4] rounded-lg bg-slate-200"></div>
                        </div>
                    ))}
                </div>
            )}

            {/* État vide */}
            {!loading && pins.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-slate-100 p-6 mb-4">
                        <Pin className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                        {t("projects.pinterest.emptyTitle")}
                    </h3>
                    <p className="text-sm text-slate-600 max-w-md">
                        {t("projects.pinterest.emptyDescription")}
                    </p>
                </div>
            )}
        </div>
    );
}