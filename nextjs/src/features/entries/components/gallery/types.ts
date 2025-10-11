// src/features/entries/components/gallery/types.ts
import type { EntryFile } from "@entries/types";

export interface GalleryItem {
    file: EntryFile;
    url: string;
    fileName: string;
}