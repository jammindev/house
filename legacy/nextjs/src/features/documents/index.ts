// nextjs/src/features/documents/index.ts

// Components
export { DocumentsList } from "./components/DocumentsList";
export { DocumentsFilters } from "./components/DocumentsFilters";
export { DocumentUploadSection } from "./components/DocumentUploadSection";
export { DocumentUploadButton } from "./components/DocumentUploadButton";
export { DocumentsSection } from "./components/DocumentsSection";
export { EditDocumentModal } from "./components/EditDocumentModal";
export { AddDocumentsModal } from "./components/AddDocumentModal";
export { MobileUploadInterface } from "./components/MobileUploadInterface";
export { DesktopUploadInterface } from "./components/DesktopUploadInterface";
export { CameraScannerDialog } from "./components/CameraScannerDialog";

// Hooks
export { useDocuments } from "./hooks/useDocuments";
export { useDocumentUpload } from "./hooks/useDocumentUpload";
export { useDocumentHighlight } from "./hooks/useDocumentHighlight";
export { useEditDocument } from "./hooks/useEditDocument";
export { useIsMobile } from "./hooks/useIsMobile";

// Types
export type {
    DocumentWithLinks,
    DocumentLink,
    SupabaseDocumentRow,
    StagedFile,
    DocumentUploadResult,
} from "./types";

// Utils
export {
    createLocalId,
    sanitizeFilename,
    inferDocumentType,
    formatFileSize,
    DOCUMENT_TYPES,
} from "./utils/uploadHelpers";
export { normalizeDocuments } from "./utils/normalizeDocuments";
export { buildDocumentMetadata, compressFileForUpload } from "./utils/fileCompression";
