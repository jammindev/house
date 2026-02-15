# Documents Feature

This feature provides comprehensive document management capabilities, including upload, organization, and viewing functionality.

## Structure

```
src/features/documents/
├── components/              # React components
│   ├── DocumentUploadSection.tsx     # File upload interface
│   ├── DocumentsSection.tsx          # Documents list with filters
│   ├── DocumentsList.tsx             # Individual document items
│   ├── DocumentsFilters.tsx          # Filter controls
│   ├── EditDocumentModal.tsx         # Edit document metadata
│   └── AddDocumentModal.tsx          # Add documents to interactions
├── hooks/                  # Custom React hooks
│   ├── useDocuments.ts               # Fetch and manage documents
│   ├── useDocumentUpload.ts          # Handle file uploads
│   ├── useDocumentHighlight.ts       # Highlight recently uploaded docs
│   └── useEditDocument.ts            # Edit document functionality
├── utils/                  # Utility functions
│   ├── uploadHelpers.ts              # File upload utilities
│   ├── fileCompression.ts            # File compression logic
│   └── normalizeDocuments.ts         # Data normalization
├── types.ts               # TypeScript type definitions
└── index.ts              # Main export file
```

## Components

### DocumentUploadSection

Main upload interface with adaptive mobile/desktop support:
- **Desktop**: Drag & drop zone with file browser fallback
- **Mobile**: Optimized buttons for camera and file selection
- File staging and preview
- Document type selection
- Metadata configuration
- Bulk upload functionality

**Props:**
- `onUploadSuccess?: (uploadedIds: string[]) => void` - Callback when upload completes

### MobileUploadInterface

Mobile-optimized upload interface:
- Large touch-friendly buttons
- Camera integration for photo capture
- File browser for document selection
- No drag & drop (not useful on mobile)

**Props:**
- `onFilesSelected: (files: FileList) => void` - Callback when files are selected
- `disabled?: boolean` - Whether interface is disabled

### DesktopUploadInterface

Desktop upload interface with drag & drop:
- Large drag & drop zone
- Visual feedback on hover/drag
- File browser fallback button
- Supports multiple file selection

**Props:**
- `onFilesSelected: (files: FileList) => void` - Callback when files are selected
- `disabled?: boolean` - Whether interface is disabled

### DocumentsSection

Combined view of filters and document list:
- Filter controls (all vs unlinked documents)
- Document list with search/sort
- Highlighted recently uploaded documents

**Props:**
- `highlightedIds?: string[]` - Document IDs to highlight

### DocumentsList

Individual document display and actions:
- Document metadata display
- Download, edit, delete actions
- Linked interaction navigation
- Visual highlighting support

## Hooks

### useDocumentUpload

Manages file upload workflow:
```typescript
const {
  stagedFiles,          // Files ready for upload
  uploading,            // Upload status
  error,                // Upload errors
  success,              // Upload success message
  stageFiles,           // Add files to staging
  removeStagedFile,     // Remove staged file
  updateStagedFile,     // Update staged file metadata
  uploadFiles,          // Execute upload
  canUpload,            // Whether upload is possible
} = useDocumentUpload();
```

### useDocumentHighlight

Manages visual highlighting of documents:
```typescript
const {
  highlightedIds,       // Currently highlighted document IDs
  highlightDocuments,   // Set documents to highlight
  clearHighlights,      // Clear all highlights
  isHighlighted,        // Check if document is highlighted
} = useDocumentHighlight(6000); // duration in ms
```

### useIsMobile

Detects if the user is on a mobile device:
```typescript
const isMobile = useIsMobile(); // boolean
```

Uses multiple detection methods:
- Touch capability detection
- Screen size analysis
- User agent parsing

### useDocuments

Fetches and manages document data:
```typescript
const {
  documents,            // All documents
  loading,              // Loading state
  error,                // Error message
  refresh,              // Refresh data
  unlinkedCount,        // Count of unlinked documents
} = useDocuments();
```

```typescript
// Simple document page
function DocumentsPage() {
  const { highlightedIds, highlightDocuments } = useDocumentHighlight();

  const handleUploadSuccess = (uploadedIds: string[]) => {
    highlightDocuments(uploadedIds);
  };

  return (
    <div>
      <DocumentUploadSection onUploadSuccess={handleUploadSuccess} />
      <DocumentsSection highlightedIds={highlightedIds} />
    </div>
  );
}
```

## Features

- **📱 Mobile-First Design**: Adaptive interface that provides optimal experience on both mobile and desktop
- **📸 Camera Integration**: Direct camera access on mobile devices for instant photo capture
- **🖱️ Drag & Drop (Desktop)**: Intuitive drag & drop upload with visual feedback
- **👆 Touch-Optimized (Mobile)**: Large, finger-friendly buttons for easy interaction
- **🗜️ File Compression**: Automatic image compression to optimize storage
- **🏷️ Type Detection**: Smart document type inference from file properties
- **✨ Visual Feedback**: Highlight newly uploaded documents
- **🔒 RLS Security**: Household-scoped access with Row Level Security
- **📱 Mobile Responsive**: Seamless experience across all device sizes
- **⚠️ Error Handling**: Comprehensive error states and user feedback

## File Types

Supported document types:
- `document` - General documents
- `photo` - Images and photos
- `quote` - Quotes and estimates
- `invoice` - Invoices and bills
- `contract` - Contracts and agreements
- `other` - Miscellaneous files

## Storage

Files are stored in Supabase Storage with the following structure:
```
files/
  {userId}/
    documents/
      {uuid}_{sanitized_filename}
```

Document metadata is stored in the `documents` table with references to interactions via `interaction_documents` junction table.