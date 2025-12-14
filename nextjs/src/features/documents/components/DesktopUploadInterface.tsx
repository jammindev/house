"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, Image, FileText, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";

type DesktopUploadInterfaceProps = {
    onFilesSelected: (files: FileList) => void;
    disabled?: boolean;
};

export function DesktopUploadInterface({ onFilesSelected, disabled = false }: DesktopUploadInterfaceProps) {
    const { t } = useI18n();

    const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
        if (rejectedFiles.length > 0) {
            // Les erreurs seront affichées par le hook useDocumentUpload
            console.warn('Rejected files:', rejectedFiles);
        }

        if (acceptedFiles.length > 0) {
            // Créer une FileList simple à partir du tableau de fichiers
            const dataTransfer = new DataTransfer();
            acceptedFiles.forEach(file => dataTransfer.items.add(file));
            onFilesSelected(dataTransfer.files);
        }
    }, [onFilesSelected]);

    const { getRootProps, getInputProps, isDragActive, open, fileRejections } = useDropzone({
        onDrop,
        disabled,
        noClick: true, // On gère le clic manuellement avec le bouton
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic'],
            'application/pdf': ['.pdf'],
            'text/*': ['.txt', '.md'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/msword': ['.doc'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        multiple: true
    });

    const getSupportedTypesDisplay = () => {
        return t("storage.supportedFormats"); // "Images, PDF, Documents"
    };

    return (
        <div className="space-y-4">
            {/* Zone de drop principale */}
            <div
                {...getRootProps()}
                className={`
                    relative rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200 ease-in-out
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${isDragActive
                        ? 'border-blue-400 bg-blue-50 shadow-lg scale-[1.01] ring-2 ring-blue-200'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
                `}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center gap-4">
                    {/* Icône avec animation */}
                    <div className={`
                        rounded-full p-4 transition-all duration-200
                        ${isDragActive
                            ? 'bg-blue-100 scale-110'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }
                    `}>
                        <Upload className={`h-8 w-8 transition-colors duration-200 ${isDragActive ? 'text-blue-600' : 'text-gray-500'
                            }`} />
                    </div>

                    {/* Messages contextuels */}
                    {isDragActive ? (
                        <div className="space-y-1">
                            <p className="text-lg font-semibold text-blue-700">
                                {t("storage.dropFilesHere")}
                            </p>
                            <p className="text-sm text-blue-600">
                                {t("storage.releaseToUpload")}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-lg font-medium text-gray-700">
                                    {t("storage.dragFilesOr")}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {getSupportedTypesDisplay()} • {t("storage.maxSize", { size: "10MB" })}
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={open}
                                disabled={disabled}
                                className="bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400"
                            >
                                <File className="h-4 w-4 mr-2" />
                                {t("storage.browse")}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Animation de drop overlay */}
                {isDragActive && (
                    <div className="absolute inset-0 rounded-lg border-2 border-blue-400 bg-blue-50/30 animate-pulse pointer-events-none" />
                )}
            </div>

            {/* Types de fichiers acceptés avec icônes */}
            <div className="flex justify-center">
                <div className="flex items-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <Image className="h-3 w-3" />
                        <span>{t("storage.types.images")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{t("storage.types.documents")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <File className="h-3 w-3" />
                        <span>{t("storage.types.pdf")}</span>
                    </div>
                </div>
            </div>

            {/* Erreurs de fichiers rejetés */}
            {fileRejections.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-800 mb-1">
                        {t("storage.rejectedFiles")}
                    </p>
                    <ul className="text-xs text-red-700 space-y-1">
                        {fileRejections.map(({ file, errors }) => (
                            <li key={file.name}>
                                <span className="font-medium">{file.name}</span>: {errors[0]?.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}