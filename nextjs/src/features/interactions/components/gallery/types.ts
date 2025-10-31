import type { Document } from "@interactions/types";

export interface GalleryItem {
    file: Document;
    fileName: string;
    viewUrl: string;
    thumbnailUrl: string;
}
