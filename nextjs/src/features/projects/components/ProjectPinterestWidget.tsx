// nextjs/src/features/projects/components/ProjectPinterestWidget.tsx
"use client";

import { useState, useEffect } from "react";
import { Pin, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface ProjectPinterestWidgetProps {
    projectId: string;
    initialBoardUrl?: string;
}

declare global {
    interface Window {
        PinUtils?: {
            build: () => void;
        };
    }
}

export default function ProjectPinterestWidget({
    projectId,
    initialBoardUrl
}: ProjectPinterestWidgetProps) {
    const { t } = useI18n();
    const [boardUrl, setBoardUrl] = useState(initialBoardUrl || "");
    const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Charge le script Pinterest
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://assets.pinterest.com/js/pinit.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        return () => {
            // Nettoyage du script si le composant est démonté
            const existingScript = document.querySelector('script[src="https://assets.pinterest.com/js/pinit.js"]');
            if (existingScript) {
                document.head.removeChild(existingScript);
            }
        };
    }, []);

    // Reconstruit les widgets Pinterest quand widgetUrl change
    useEffect(() => {
        if (widgetUrl && window.PinUtils) {
            // Petit délai pour s'assurer que le DOM est mis à jour
            setTimeout(() => {
                window.PinUtils?.build();
            }, 100);
        }
    }, [widgetUrl]);

    // Convertit une URL Pinterest normale en URL de widget
    const convertToWidgetUrl = (url: string): string | null => {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);

            // Vérifie que c'est bien une URL Pinterest
            if (!urlObj.hostname.includes('pinterest.')) {
                return null;
            }

            // Format: https://pinterest.com/username/boardname/
            if (pathParts.length >= 2) {
                return url.endsWith('/') ? url : `${url}/`;
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

        const widgetUrl = convertToWidgetUrl(boardUrl);
        if (!widgetUrl) {
            setError(t("projects.pinterest.invalidUrl"));
            return;
        }

        setWidgetUrl(widgetUrl);
    };

    const handleClearBoard = () => {
        setWidgetUrl(null);
        setBoardUrl("");
        setError(null);
    };

    const handleOpenInPinterest = () => {
        if (boardUrl) {
            window.open(boardUrl, "_blank", "noopener,noreferrer");
        }
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
                            {widgetUrl && (
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

                        {widgetUrl && (
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

            {/* Widget Pinterest */}
            {widgetUrl && (
                <div className="flex justify-center">
                    <a
                        data-pin-do="embedBoard"
                        data-pin-board-width="900"
                        data-pin-scale-height="600"
                        data-pin-scale-width="115"
                        href={widgetUrl}
                        className="block max-w-full"
                    >
                        {/* Contenu de fallback pendant le chargement */}
                        <div className="flex items-center justify-center h-96 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-center space-y-3">
                                <Pin className="h-8 w-8 text-slate-400 mx-auto" />
                                <p className="text-sm text-slate-600">{t("common.loading")}...</p>
                                <p className="text-xs text-slate-500">
                                    {t("projects.pinterest.loadingWidget")}
                                </p>
                            </div>
                        </div>
                    </a>
                </div>
            )}

            {/* État vide */}
            {!widgetUrl && !error && (
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