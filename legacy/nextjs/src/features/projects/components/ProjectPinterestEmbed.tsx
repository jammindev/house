// nextjs/src/features/projects/components/ProjectPinterestEmbed.tsx
"use client";

import { useState } from "react";
import { Pin, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface ProjectPinterestEmbedProps {
    projectId: string;
    initialBoardUrl?: string;
}

export default function ProjectPinterestEmbed({
    projectId,
    initialBoardUrl
}: ProjectPinterestEmbedProps) {
    const { t } = useI18n();
    const [boardUrl, setBoardUrl] = useState(initialBoardUrl || "");
    const [embedUrl, setEmbedUrl] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Convertit une URL Pinterest en URL d'embed
    const convertToEmbedUrl = (url: string): string | null => {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);

            // Vérifie que c'est bien une URL Pinterest
            if (!urlObj.hostname.includes('pinterest.')) {
                return null;
            }

            // Format: https://pinterest.com/username/boardname/
            if (pathParts.length >= 2) {
                const username = pathParts[0];
                const boardname = pathParts[1];

                // URL d'embed Pinterest
                return `https://www.pinterest.com/${username}/${boardname}.embed/`;
            }

            return null;
        } catch {
            return null;
        }
    };

    const handleLoadBoard = () => {
        setError(null);

        if (!boardUrl.trim()) {
            setError(t("projects.pinterest.urlRequired"));
            return;
        }

        const embedUrl = convertToEmbedUrl(boardUrl);
        if (!embedUrl) {
            setError(t("projects.pinterest.invalidUrl"));
            return;
        }

        setEmbedUrl(embedUrl);
    };

    const handleClearBoard = () => {
        setEmbedUrl(null);
        setBoardUrl("");
        setError(null);
    };

    const handleOpenInPinterest = () => {
        if (boardUrl) {
            window.open(boardUrl, "_blank", "noopener,noreferrer");
        }
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const isValidUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.includes('pinterest.') && url.includes('/');
        } catch {
            return false;
        }
    };

    const urlValid = boardUrl ? isValidUrl(boardUrl) : true;

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
                            <Input
                                placeholder={t("projects.pinterest.boardUrlPlaceholder")}
                                value={boardUrl}
                                onChange={(e) => setBoardUrl(e.target.value)}
                                className={`flex-1 ${!urlValid ? 'border-red-300' : ''}`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleLoadBoard();
                                    }
                                }}
                            />
                            <Button
                                onClick={handleLoadBoard}
                                disabled={!boardUrl || !urlValid}
                                className="shrink-0"
                            >
                                {t("projects.pinterest.loadBoard")}
                            </Button>
                            {embedUrl && (
                                <Button
                                    variant="outline"
                                    onClick={handleClearBoard}
                                    className="shrink-0"
                                >
                                    {t("common.clear")}
                                </Button>
                            )}
                        </div>

                        {!urlValid && boardUrl && (
                            <p className="text-sm text-red-600">
                                {t("projects.pinterest.invalidUrl")}
                            </p>
                        )}

                        {embedUrl && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span>{t("projects.pinterest.boardLoaded")}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleOpenInPinterest}
                                    className="h-auto p-1"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleFullscreen}
                                    className="h-auto p-1"
                                >
                                    {isFullscreen ? (
                                        <Minimize2 className="h-4 w-4" />
                                    ) : (
                                        <Maximize2 className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
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

            {/* Iframe Pinterest */}
            {embedUrl && (
                <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white p-4' : ''}`}>
                    <div className={`${isFullscreen ? 'h-full' : 'h-96 md:h-[600px] lg:h-[700px]'} overflow-hidden rounded-lg border border-slate-200 shadow-sm`}>
                        <iframe
                            src={embedUrl}
                            className="h-full w-full"
                            frameBorder="0"
                            allowFullScreen
                            loading="lazy"
                            title={t("projects.pinterest.boardTitle")}
                            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                        />
                    </div>

                    {isFullscreen && (
                        <Button
                            onClick={toggleFullscreen}
                            className="absolute right-6 top-6 z-10"
                            variant="outline"
                            size="sm"
                        >
                            <Minimize2 className="h-4 w-4 mr-2" />
                            {t("common.close")}
                        </Button>
                    )}
                </div>
            )}

            {/* État vide */}
            {!embedUrl && !error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-slate-100 p-6 mb-4">
                        <Pin className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                        {t("projects.pinterest.emptyTitle")}
                    </h3>
                    <p className="text-sm text-slate-600 max-w-md mb-4">
                        {t("projects.pinterest.emptyDescription")}
                    </p>
                    <div className="text-xs text-slate-500 space-y-1">
                        <p>{t("projects.pinterest.exampleUrls")}:</p>
                        <div className="font-mono text-slate-400">
                            <p>https://pinterest.com/pinterest/home-decor/</p>
                            <p>https://pinterest.com/pinterest/interior-design/</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}