// nextjs/src/features/qr-code/types.ts

export interface QRCodeOptions {
  size?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  margin?: number;
}

export interface QRCodePrintOptions {
  includeText?: boolean;
  labelSize?: 'small' | 'medium' | 'large';
  title?: string;
  subtitle?: string;
  showUrl?: boolean;
}

export interface EquipmentLabelData {
  id: string;
  name: string;
  category?: string;
  serialNumber?: string;
  url: string;
  householdName?: string;
}