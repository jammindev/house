"use client";

import { useRef, type ChangeEvent } from "react";
import { ScanLine, FolderOpen, Image, File, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";

type MobileUploadInterfaceProps = {
    onFilesSelected: (files: FileList) => void;
    onScannerOpen?: () => void;
    disabled?: boolean;
};

export function MobileUploadInterface({ onFilesSelected, onScannerOpen, disabled = false }: MobileUploadInterfaceProps) {
    const { t } = useI18n();
    const { loading: globalLoading } = useGlobal();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const documentInputRef = useRef<HTMLInputElement | null>(null);

    const isDisabled = disabled || globalLoading;

    const handleFileSelection = (files: FileList | null) => {
        if (files && files.length > 0) {
            onFilesSelected(files);
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        handleFileSelection(event.target.files);
        event.target.value = ""; // Reset pour permettre de sélectionner le même fichier
    };

    const openGalleryPicker = () => {
        // Créer un input dynamique pour la galerie avec sélection multiple
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            handleFileSelection(files);
        };
        input.click();
    };

    return (
        <div className="space-y-4">
            {/* Interface mobile optimisée avec boutons larges */}
            <div className="grid grid-cols-1 gap-3">

                {/* Scanner de caméra */}
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-16 w-full border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    onClick={onScannerOpen}
                    disabled={isDisabled || !onScannerOpen}
                >
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                            <ScanLine className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">{t("storage.cameraScanner.action")}</span>
                        </div>
                        <span className="text-xs text-gray-500">{t("storage.cameraScanner.helper")}</span>
                    </div>
                </Button>                {/* Choisir des photos de la galerie */}
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-16 w-full border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    onClick={openGalleryPicker}
                    disabled={isDisabled}
                >
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                            <Image className="h-5 w-5 text-green-600" />
                            <span className="font-medium">{t("storage.mobile.choosePhotos")}</span>
                        </div>
                        <span className="text-xs text-gray-500">{t("storage.mobile.fromGallery")}</span>
                    </div>
                </Button>

                {/* Choisir des documents */}
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-16 w-full border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    onClick={() => documentInputRef.current?.click()}
                    disabled={isDisabled}
                >
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                            <File className="h-5 w-5 text-purple-600" />
                            <span className="font-medium">{t("storage.mobile.chooseFiles")}</span>
                        </div>
                        <span className="text-xs text-gray-500">{t("storage.mobile.documentsAndMore")}</span>
                    </div>
                    <input
                        ref={documentInputRef}
                        type="file"
                        accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isDisabled}
                    />
                </Button>
            </div>

            {/* Info sur les fonctionnalités mobiles */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <div className="flex items-start gap-2">
                    <Smartphone className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                        <p className="font-medium mb-1">{t("storage.mobile.features.title")}</p>
                        <ul className="space-y-0.5 text-blue-700">
                            <li>• {t("storage.mobile.features.scanner")}</li>
                            <li>• {t("storage.mobile.features.gallery")}</li>
                            <li>• {t("storage.mobile.features.files")}</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Inputs cachés */}
            <Input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
                multiple
                className="sr-only"
                onChange={handleFileChange}
                disabled={isDisabled}
            />
        </div>
    );
}