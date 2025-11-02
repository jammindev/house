import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";

const VECTOR_IMAGE_TYPES = new Set(["image/svg+xml"]);
const IMAGE_MIN_BYTES = 200 * 1024; // 200 KB
const PDF_MIN_BYTES = 400 * 1024; // 400 KB

type ImageCompressionOptions = NonNullable<Parameters<typeof imageCompression>[1]>;

export type CompressionAlgorithm = "image/webp" | "pdf/object-stream" | "none";

export type CompressionDetails = {
  algorithm: CompressionAlgorithm;
  originalBytes: number;
  finalBytes: number;
  ratio: number;
  convertedMimeType?: string;
};

export type CompressFileResult = {
  file: File;
  wasCompressed: boolean;
  details?: CompressionDetails;
};

export type CompressionOptions = {
  image?: {
    minBytes?: number;
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    initialQuality?: number;
  };
  pdf?: {
    minBytes?: number;
  };
};

const DEFAULT_IMAGE_OPTIONS: ImageCompressionOptions = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 2048,
  initialQuality: 0.82,
  useWebWorker: true,
  alwaysKeepResolution: false,
  fileType: "image/webp",
};

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  image: {
    minBytes: IMAGE_MIN_BYTES,
    maxSizeMB: DEFAULT_IMAGE_OPTIONS.maxSizeMB ?? 1.5,
    maxWidthOrHeight: DEFAULT_IMAGE_OPTIONS.maxWidthOrHeight ?? 2048,
    initialQuality: DEFAULT_IMAGE_OPTIONS.initialQuality ?? 0.82,
  },
  pdf: {
    minBytes: PDF_MIN_BYTES,
  },
};

export function shouldCompressImage(file: File, minBytes = DEFAULT_OPTIONS.image.minBytes): boolean {
  const isImage = file.type.startsWith("image/") && !VECTOR_IMAGE_TYPES.has(file.type);
  return isImage && file.size >= minBytes;
}

export function shouldCompressPdf(file: File, minBytes = DEFAULT_OPTIONS.pdf.minBytes): boolean {
  return file.type === "application/pdf" && file.size >= minBytes;
}

export function ensureExtension(fileName: string, nextExtension?: string): string {
  if (!nextExtension) return fileName;
  const normalized = nextExtension.replace(/^\./, "");
  const base = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;
  return `${base}.${normalized}`;
}

export async function compressFileForUpload(
  originalFile: File,
  options: CompressionOptions = {}
): Promise<CompressFileResult> {
  if (shouldCompressImage(originalFile, options.image?.minBytes ?? DEFAULT_OPTIONS.image.minBytes)) {
    return compressImage(originalFile, options.image);
  }

  if (shouldCompressPdf(originalFile, options.pdf?.minBytes ?? DEFAULT_OPTIONS.pdf.minBytes)) {
    return compressPdf(originalFile);
  }

  return {
    file: originalFile,
    wasCompressed: false,
    details: {
      algorithm: "none",
      originalBytes: originalFile.size,
      finalBytes: originalFile.size,
      ratio: 1,
      convertedMimeType: originalFile.type,
    },
  };
}

async function compressImage(file: File, overrides?: CompressionOptions["image"]): Promise<CompressFileResult> {
  const imageOptions: ImageCompressionOptions = {
    ...DEFAULT_IMAGE_OPTIONS,
    maxSizeMB: overrides?.maxSizeMB ?? DEFAULT_IMAGE_OPTIONS.maxSizeMB,
    maxWidthOrHeight: overrides?.maxWidthOrHeight ?? DEFAULT_IMAGE_OPTIONS.maxWidthOrHeight,
    initialQuality: overrides?.initialQuality ?? DEFAULT_IMAGE_OPTIONS.initialQuality,
  };

  const compressed = await imageCompression(file, imageOptions);
  const targetMime = imageOptions.fileType ?? file.type;
  const nextExtension = targetMime === "image/webp" ? "webp" : undefined;

  const compressedBlob = compressed instanceof Blob ? compressed : new Blob([compressed], { type: targetMime });
  const compressedFile = new File([compressedBlob], ensureExtension(file.name, nextExtension), {
    type: targetMime,
    lastModified: Date.now(),
  });

  if (compressedFile.size >= file.size) {
    return {
      file,
      wasCompressed: false,
      details: {
        algorithm: "none",
        originalBytes: file.size,
        finalBytes: file.size,
        ratio: 1,
        convertedMimeType: file.type,
      },
    };
  }

  return {
    file: compressedFile,
    wasCompressed: true,
    details: {
      algorithm: "image/webp",
      originalBytes: file.size,
      finalBytes: compressedFile.size,
      ratio: compressedFile.size / file.size,
      convertedMimeType: targetMime,
    },
  };
}

async function compressPdf(file: File): Promise<CompressFileResult> {
  const buffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer);
  const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
  const compressedFile = new File([compressedBytes], ensureExtension(file.name, "pdf"), {
    type: "application/pdf",
    lastModified: Date.now(),
  });

  if (compressedFile.size >= file.size) {
    return {
      file,
      wasCompressed: false,
      details: {
        algorithm: "none",
        originalBytes: file.size,
        finalBytes: file.size,
        ratio: 1,
        convertedMimeType: file.type,
      },
    };
  }

  return {
    file: compressedFile,
    wasCompressed: true,
    details: {
      algorithm: "pdf/object-stream",
      originalBytes: file.size,
      finalBytes: compressedFile.size,
      ratio: compressedFile.size / file.size,
      convertedMimeType: "application/pdf",
    },
  };
}

export function buildDocumentMetadata(originalFile: File, result: CompressFileResult) {
  return {
    size: result.file.size,
    originalName: originalFile.name,
    originalMimeType: originalFile.type || null,
    compression: result.wasCompressed
      ? {
          algorithm: result.details?.algorithm,
          originalBytes: result.details?.originalBytes,
          finalBytes: result.details?.finalBytes,
          ratio: Number((result.details?.ratio ?? 1).toFixed(4)),
          convertedMimeType: result.details?.convertedMimeType ?? result.file.type,
        }
      : null,
  };
}
