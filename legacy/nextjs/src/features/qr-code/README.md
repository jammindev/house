# QR Code Feature

## Purpose
Generate and scan QR codes for quick access to zones, equipment, and documents.

## Key Concepts
- **QR Generation**: Create codes linking to app entities
- **QR Scanning**: Mobile scan to view details
- **Printable Labels**: Generate PDF labels for physical items

## Architecture

### Components
- `QRCodeGenerator`: Create QR codes
- `QRCodeScanner`: Camera-based scanning
- `QRCodeLabel`: Printable label template

### Hooks
- `useQRCode()`: Generate QR codes
- `useQRScanner()`: Handle scan events

### Utils
- `generateQRCode()`: Create QR code data URL
- `parseQRCode()`: Extract entity info from scan

## Import Aliases
- `@qr-code/components/*`
- `@qr-code/hooks/*`
- `@qr-code/utils/*`

## Related Features
- `zones`: QR codes for room/space access
- `equipment`: Labels for appliances
- `documents`: QR codes in document metadata
