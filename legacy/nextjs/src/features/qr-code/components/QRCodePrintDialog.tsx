// nextjs/src/features/qr-code/components/QRCodePrintDialog.tsx
"use client";

import { useState } from "react";
import { Printer, Download } from "lucide-react";

import { SheetDialog } from "@/components/ui/sheet-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/I18nProvider";

import QRCodePrintLabel from "./QRCodePrintLabel";
import type { EquipmentLabelData, QRCodePrintOptions } from "../types";

export interface QRCodePrintDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    equipment: EquipmentLabelData;
    trigger?: React.ReactElement<{ onClick?: () => void }>;
}

export default function QRCodePrintDialog({
    open,
    onOpenChange,
    equipment,
    trigger
}: QRCodePrintDialogProps) {
    const { t } = useI18n();
    const [options, setOptions] = useState<QRCodePrintOptions>({
        includeText: true,
        labelSize: 'medium',
        title: equipment.name,
        subtitle: equipment.category,
        showUrl: false
    });

    const handlePrint = () => {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Get the label HTML
        const labelElement = document.getElementById('qr-print-preview');
        if (!labelElement) return;

        const labelHtml = labelElement.innerHTML;
        const styles = Array.from(document.styleSheets)
            .map(styleSheet => {
                try {
                    return Array.from(styleSheet.cssRules)
                        .map(rule => rule.cssText)
                        .join('\n');
                } catch (e) {
                    // Handle CORS issues with external stylesheets
                    return '';
                }
            })
            .join('\n');

        // Write the print document
        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t('qrCode.print.windowTitle', { name: equipment.name })}</title>
          <style>
            ${styles}
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .print-label {
                page-break-inside: avoid;
                margin: 0;
                padding: 8pt;
                border: 1pt solid #ccc;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          ${labelHtml}
        </body>
      </html>
    `);

        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    const handleDownload = async () => {
        // This would require additional implementation to convert to image
        // For now, we'll trigger the print dialog
        handlePrint();
    };

    // When used without a trigger, create a hidden one since SheetDialog requires it
    const hiddenTrigger = <div style={{ display: 'none' }} />;

    return (
        <SheetDialog
            trigger={trigger || hiddenTrigger}
            open={open}
            onOpenChange={onOpenChange}
            title={t('qrCode.print.title')}
            description={t('qrCode.print.description', { name: equipment.name })}
            contentClassName="gap-6"
            minHeight="60vh"
        >
            {({ close }) => (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Settings Panel */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">{t('qrCode.print.settings')}</h3>

                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="label-size">{t('qrCode.print.labelSize')}</Label>
                                <Select
                                    value={options.labelSize}
                                    onValueChange={(value: any) => setOptions(prev => ({ ...prev, labelSize: value }))}
                                >
                                    <SelectTrigger id="label-size">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="small">{t('qrCode.print.sizes.small')}</SelectItem>
                                        <SelectItem value="medium">{t('qrCode.print.sizes.medium')}</SelectItem>
                                        <SelectItem value="large">{t('qrCode.print.sizes.large')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="custom-title">{t('qrCode.print.customTitle')}</Label>
                                <Input
                                    id="custom-title"
                                    value={options.title || ''}
                                    onChange={(e) => setOptions(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder={equipment.name}
                                />
                            </div>

                            <div>
                                <Label htmlFor="custom-subtitle">{t('qrCode.print.customSubtitle')}</Label>
                                <Input
                                    id="custom-subtitle"
                                    value={options.subtitle || ''}
                                    onChange={(e) => setOptions(prev => ({ ...prev, subtitle: e.target.value }))}
                                    placeholder={equipment.category || ''}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="include-text"
                                        checked={options.includeText}
                                        onChange={(e) =>
                                            setOptions(prev => ({ ...prev, includeText: e.target.checked }))
                                        }
                                        className="rounded border border-gray-300"
                                    />
                                    <Label htmlFor="include-text">{t('qrCode.print.includeText')}</Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="show-url"
                                        checked={options.showUrl}
                                        onChange={(e) =>
                                            setOptions(prev => ({ ...prev, showUrl: e.target.checked }))
                                        }
                                        className="rounded border border-gray-300"
                                    />
                                    <Label htmlFor="show-url">{t('qrCode.print.showUrl')}</Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">{t('qrCode.print.preview')}</h3>

                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[300px]">
                            <div id="qr-print-preview">
                                <QRCodePrintLabel
                                    equipment={equipment}
                                    options={options}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handlePrint} className="flex-1">
                                <Printer className="h-4 w-4 mr-2" />
                                {t('qrCode.print.printButton')}
                            </Button>
                            <Button variant="outline" onClick={handleDownload}>
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </SheetDialog>
    );
}