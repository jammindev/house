# Photos Feature

## Purpose
Specialized photo management with galleries, tagging, and zone associations. Extends documents feature with photo-specific UI.

## Key Concepts
- **Photos**: Documents with `type = 'photo'`
- **Galleries**: Zone-based photo collections via `zone_documents`
- **Metadata**: EXIF data, geolocation, camera info

## Architecture

### Components
- `PhotoGallery`: Grid view with lightbox
- `PhotoUpload`: Drag-and-drop with preview
- `PhotoCard`: Thumbnail with badges

### Hooks
- `useZonePhotos()`: Photos for specific zone
- `usePhotoMetadata()`: EXIF extraction

## Import Aliases
- `@photos/components/*`
- `@photos/hooks/*`

## Related Features
- `documents`: Base document management
- `zones`: Photo galleries per zone
