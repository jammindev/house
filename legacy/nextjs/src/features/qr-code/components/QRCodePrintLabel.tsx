// nextjs/src/features/qr-code/components/QRCodePrintLabel.tsx
"use client";

import { cn } from '@/lib/utils';
import QRCodeDisplay from './QRCodeDisplay';
import type { EquipmentLabelData, QRCodePrintOptions } from '../types';

export interface QRCodePrintLabelProps {
    equipment: EquipmentLabelData;
    options?: QRCodePrintOptions;
    className?: string;
}

export default function QRCodePrintLabel({
    equipment,
    options = {},
    className
}: QRCodePrintLabelProps) {
    const {
        includeText = true,
        labelSize = 'medium',
        title,
        subtitle,
        showUrl = false
    } = options;

    const sizeClasses = {
        small: 'w-20 text-xs',
        medium: 'w-32 text-sm',
        large: 'w-48 text-base'
    };

    const qrSize = {
        small: 64,
        medium: 128,
        large: 192
    };

    return (
        <div className={cn(
            "print-label flex flex-col items-center gap-2 p-4 bg-white",
            "border border-gray-300 rounded-lg shadow-sm",
            className
        )}>
            {/* QR Code */}
            <QRCodeDisplay
                value={equipment.url}
                options={{ size: qrSize[labelSize] }}
                className={cn("border border-gray-200 rounded", sizeClasses[labelSize])}
                alt={`QR code for ${equipment.name}`}
            />

            {/* Equipment Information */}
            {includeText && (
                <div className="text-center space-y-1">
                    <div className="font-semibold text-gray-900 leading-tight">
                        {title || equipment.name}
                    </div>

                    {(subtitle || equipment.category) && (
                        <div className="text-gray-600 leading-tight">
                            {subtitle || equipment.category}
                        </div>
                    )}

                    {equipment.serialNumber && (
                        <div className="text-gray-500 font-mono text-xs leading-tight">
                            S/N: {equipment.serialNumber}
                        </div>
                    )}

                    {equipment.householdName && (
                        <div className="text-gray-500 text-xs leading-tight">
                            {equipment.householdName}
                        </div>
                    )}

                    {showUrl && (
                        <div className="text-gray-400 text-xs font-mono leading-tight break-all">
                            {equipment.url}
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
        @media print {
          .print-label {
            page-break-inside: avoid;
            margin: 0;
            padding: 8pt;
            border: 1pt solid #ccc;
            box-shadow: none;
            font-size: 10pt;
          }
          
          .print-label img {
            max-width: 100%;
            height: auto;
          }

          /* Small label: 1.5" x 1.5" */
          @page label-small {
            size: 1.5in 1.5in;
            margin: 0.1in;
          }

          /* Medium label: 2" x 2" */
          @page label-medium {
            size: 2in 2in;
            margin: 0.1in;
          }

          /* Large label: 3" x 3" */
          @page label-large {
            size: 3in 3in;
            margin: 0.1in;
          }
        }
      `}</style>
        </div>
    );
}