// nextjs/src/features/documents/components/MobileUploadInterface.tsx
"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, FolderOpen, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";

type MobileUploadInterfaceProps = {
    onFilesSelected: (files: FileList) => void;
    disabled?: boolean;
};

export function MobileUploadInterface({ onFilesSelected, disabled = false }: MobileUploadInterfaceProps) {
    const { t } = useI18n();
    const { loading: globalLoading } = useGlobal();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);

    const isDisabled = disabled || globalLoading;

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.length) {
            onFilesSelected(event.target.files);
            event.target.value = "";
        }
    };

    const openFileSelector = () => {
        fileInputRef.current?.click();
    };

    const openCamera = () => {
        cameraInputRef.current?.click();
    };

    return (
        <div className="space-y-3">
            {/* Hidden file inputs */}
            <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                className="sr-only"
                onChange={handleFileChange}
                disabled={isDisabled}
            />
            <Input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handleFileChange}
                disabled={isDisabled}
            />

            {/* Mobile-optimized buttons */}
            <div className="space-y-3">
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={openCamera}
                    disabled={isDisabled}
                    className="w-full flex items-center justify-center gap-3 py-6 text-base font-medium"
                >
                    <Camera className="h-6 w-6" />
                    <span>{t("storage.mobile.takePhoto")}</span>
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={openFileSelector}
                    disabled={isDisabled}
                    className="w-full flex items-center justify-center gap-3 py-6 text-base font-medium"
                >
                    <FolderOpen className="h-6 w-6" />
                    <span>{t("storage.mobile.chooseFiles")}</span>
                </Button>
            </div>            <div className="text-center">
                <p className="text-sm text-gray-500">
                    {t("storage.mobile.supportedFormats")}
                </p>
            </div>
        </div>
    );
}