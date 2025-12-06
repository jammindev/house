// nextjs/src/features/qr-code/index.ts

// Components
export { default as QRCodeDisplay } from './components/QRCodeDisplay';
export { default as QRCodePrintLabel } from './components/QRCodePrintLabel';
export { default as QRCodePrintDialog } from './components/QRCodePrintDialog';

// Hooks
export { useQRCode } from './hooks/useQRCode';
export { useEquipmentUrl } from './hooks/useEquipmentUrl';

// Utils
export {
    generateQRCode,
    buildEquipmentUrl,
    buildPublicEquipmentUrl,
    isValidUrl,
    getOptimalQRSize,
} from './lib/qr-utils';

// Types
export type {
    QRCodeOptions,
    QRCodePrintOptions,
    EquipmentLabelData,
} from './types';
export type { QRGenerationOptions } from './lib/qr-utils';